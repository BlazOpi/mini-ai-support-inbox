import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LIMITS } from "@/lib/domain";
import { LLMError } from "@/server/errors";
import { toLLMError } from "./errors";
import { buildClassifyPrompt, buildDraftPrompt, CLASSIFY_SYSTEM_PROMPT, DRAFT_SYSTEM_PROMPT } from "./prompts";
import { classificationSchema, type Classification, type DraftReplyInput, type LLMProvider } from "./types";

/** Subset of the SDK we use — lets tests inject a stub instead of hitting the network. */
export type AnthropicClient = Pick<Anthropic, "messages">;

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";

  constructor(
    private readonly client: AnthropicClient,
    readonly model: string,
  ) {}

  async classify(message: string): Promise<Classification> {
    const res = await this.client.messages
      .parse({
        model: this.model,
        max_tokens: 1024,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildClassifyPrompt(message) }],
        // Structured output: the API constrains the response to this JSON schema.
        output_config: { format: zodOutputFormat(classificationSchema), effort: "low" },
      })
      .catch((err: unknown) => {
        throw toLLMError(err);
      });

    if (res.stop_reason === "refusal") throw new LLMError("AI je zavrnil obdelavo sporočila.");

    // Defence in depth: never trust model output blindly, validate again.
    const parsed = classificationSchema.safeParse(res.parsed_output);
    if (!parsed.success) throw new LLMError("AI je vrnil neveljavno klasifikacijo.", { cause: parsed.error });
    return parsed.data;
  }

  async draftReply(input: DraftReplyInput): Promise<string> {
    const res = await this.client.messages
      .create({
        model: this.model,
        max_tokens: 2048,
        system: DRAFT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildDraftPrompt(input) }],
        output_config: { effort: "low" },
      })
      .catch((err: unknown) => {
        throw toLLMError(err);
      });

    if (res.stop_reason === "refusal") throw new LLMError("AI je zavrnil pripravo odgovora.");

    // Adaptive-thinking models may return thinking blocks — keep only the visible text.
    const text = res.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new LLMError("AI ni vrnil predloga odgovora.");
    return text.slice(0, LIMITS.replyMax);
  }
}
