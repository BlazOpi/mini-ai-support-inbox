import { describe, expect, it, vi } from "vitest";
import { LLMError } from "@/server/errors";
import { AnthropicProvider, type AnthropicClient } from "./anthropic";

function stubClient({ parse, create }: { parse?: unknown; create?: unknown }) {
  return {
    messages: {
      parse: vi.fn(async () => parse),
      create: vi.fn(async () => create),
    },
  } as unknown as AnthropicClient & { messages: { parse: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } };
}

describe("AnthropicProvider", () => {
  it("returns validated structured classification", async () => {
    const client = stubClient({
      parse: { stop_reason: "end_turn", parsed_output: { category: "praise", confidence: 0.93 } },
    });
    const provider = new AnthropicProvider(client, "claude-haiku-5-5");

    await expect(provider.classify("Hvala!")).resolves.toEqual({ category: "praise", confidence: 0.93 });

    const request = client.messages.parse.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.messages[0].content).toContain("<customer_message>\nHvala!\n</customer_message>");
  });

  it("rejects output that does not match the schema", async () => {
    const client = stubClient({
      parse: { stop_reason: "end_turn", parsed_output: { category: "spam", confidence: 2 } },
    });
    await expect(new AnthropicProvider(client, "m").classify("x")).rejects.toBeInstanceOf(LLMError);
  });

  it("treats refusals as LLM errors", async () => {
    const client = stubClient({ parse: { stop_reason: "refusal", parsed_output: null } });
    await expect(new AnthropicProvider(client, "m").classify("x")).rejects.toThrow("zavrnil");
  });

  it("maps SDK failures to user-safe LLM errors", async () => {
    const client = stubClient({});
    client.messages.parse.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));
    await expect(new AnthropicProvider(client, "m").classify("x")).rejects.toThrow("preobremenjena");
  });

  it("returns only visible text from the draft (ignores thinking blocks)", async () => {
    const client = stubClient({
      create: {
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "internal reasoning" },
          { type: "text", text: "  Pozdravljeni, hvala za sporočilo.  " },
        ],
      },
    });
    const draft = await new AnthropicProvider(client, "m").draftReply({ message: "Hej", category: "other" });
    expect(draft).toBe("Pozdravljeni, hvala za sporočilo.");
  });

  it("fails when the draft is empty", async () => {
    const client = stubClient({ create: { stop_reason: "end_turn", content: [] } });
    await expect(
      new AnthropicProvider(client, "m").draftReply({ message: "Hej", category: "other" }),
    ).rejects.toBeInstanceOf(LLMError);
  });
});
