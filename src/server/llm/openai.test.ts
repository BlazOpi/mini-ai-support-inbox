import { describe, expect, it, vi } from "vitest";
import { LLMError } from "@/server/errors";
import { OpenAIProvider, type OpenAIClient } from "./openai";

function stubClient({ parse, create }: { parse?: unknown; create?: unknown }) {
  return {
    responses: {
      parse: vi.fn(async () => parse),
      create: vi.fn(async () => create),
    },
  } as unknown as OpenAIClient & { responses: { parse: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } };
}

describe("OpenAIProvider", () => {
  it("returns validated structured classification", async () => {
    const client = stubClient({ parse: { output_parsed: { category: "praise", confidence: 0.93 } } });
    const provider = new OpenAIProvider(client, "gpt-5-mini");

    await expect(provider.classify("Hvala!")).resolves.toEqual({ category: "praise", confidence: 0.93 });

    const request = client.responses.parse.mock.calls[0][0];
    expect(request.model).toBe("gpt-5-mini");
    expect(request.text.format.type).toBe("json_schema");
    expect(request.input).toContain("<customer_message>\nHvala!\n</customer_message>");
  });

  it("rejects output that does not match the schema", async () => {
    const client = stubClient({ parse: { output_parsed: { category: "spam", confidence: 2 } } });
    await expect(new OpenAIProvider(client, "m").classify("x")).rejects.toBeInstanceOf(LLMError);
  });

  it("returns the trimmed draft and fails on an empty one", async () => {
    const ok = stubClient({ create: { output_text: "  Pozdravljeni!  " } });
    await expect(new OpenAIProvider(ok, "m").draftReply({ message: "x", category: "praise" })).resolves.toBe(
      "Pozdravljeni!",
    );

    const empty = stubClient({ create: { output_text: "   " } });
    await expect(
      new OpenAIProvider(empty, "m").draftReply({ message: "x", category: "praise" }),
    ).rejects.toBeInstanceOf(LLMError);
  });

  it("identifies as openai by default and as the given compatible provider otherwise", () => {
    const client = stubClient({});
    expect(new OpenAIProvider(client, "m").name).toBe("openai");
    expect(new OpenAIProvider(client, "openai/gpt-oss-20b", "groq").name).toBe("groq");
  });
});
