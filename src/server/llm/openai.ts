import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LIMITS } from "@/lib/domain";
import { LLMError } from "@/server/errors";
import { toLLMError } from "./errors";
import { buildClassifyPrompt, buildDraftPrompt, CLASSIFY_SYSTEM_PROMPT, DRAFT_SYSTEM_PROMPT } from "./prompts";
import { classificationSchema, type Classification, type DraftReplyInput, type LLMProvider } from "./types";

export type OpenAIClient = Pick<OpenAI, "responses">;

const CLASSIFY_ATTEMPTS = 3;

/**
 * Groq sometimes rejects its own model's answer with a 400 because it missed the schema. That's not
 * a bad request: Groq's docs advise trying again, and the next attempt usually passes.
 */
function isSchemaMismatch(err: unknown): boolean {
  const { status, message } = err as { status?: unknown; message?: unknown };
  return status === 400 && typeof message === "string" && message.includes("does not match the expected schema");
}

/**
 * Alternative provider via the OpenAI Responses API — same prompts, same contract.
 * Also serves compatible APIs (Groq): pass a client with their base URL and a matching name.
 */
export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly client: OpenAIClient,
    readonly model: string,
    readonly name: string = "openai",
  ) {}

  async classify(message: string): Promise<Classification> {
    const res = await this.requestClassification(message);

    const parsed = classificationSchema.safeParse(res.output_parsed);
    if (!parsed.success) throw new LLMError("AI je vrnil neveljavno klasifikacijo.", { cause: parsed.error });
    return parsed.data;
  }

  private async requestClassification(message: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.client.responses.parse({
          model: this.model,
          instructions: CLASSIFY_SYSTEM_PROMPT,
          input: buildClassifyPrompt(message),
          text: { format: zodTextFormat(classificationSchema, "classification") },
        });
      } catch (err) {
        if (attempt < CLASSIFY_ATTEMPTS && isSchemaMismatch(err)) continue;
        throw toLLMError(err);
      }
    }
  }

  async draftReply(input: DraftReplyInput): Promise<string> {
    const res = await this.client.responses
      .create({
        model: this.model,
        instructions: DRAFT_SYSTEM_PROMPT,
        input: buildDraftPrompt(input),
      })
      .catch((err: unknown) => {
        throw toLLMError(err);
      });

    const text = res.output_text.trim();
    if (!text) throw new LLMError("AI ni vrnil predloga odgovora.");
    return text.slice(0, LIMITS.replyMax);
  }
}
