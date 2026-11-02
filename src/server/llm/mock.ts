import type { Category } from "@/lib/domain";
import type { Classification, DraftReplyInput, LLMProvider } from "./types";

/**
 * Deterministic, offline provider for local development, demos without an API key and tests.
 * Keyword heuristics follow the same priority as the real prompt: complaint > question > praise.
 */
const RULES: ReadonlyArray<readonly [Category, RegExp]> = [
  [
    "complaint",
    /(pritož|razočar|slab[aoie]?\b|ne deluje|pokvarjen|poškodovan|uničen|nesprejemljiv|zahtevam|zamuj|zamud|reklamac|nezadovolj|vračil|broken|damaged|refund|complain|terrible|disappoint|not working)/i,
  ],
  [
    "question",
    /(\?|\bkako\b|\bkdaj\b|\bkje\b|\bzakaj\b|\bkoliko\b|\bali\b|\bhow\b|\bwhen\b|\bwhere\b|\bwhy\b|\bcan i\b)/i,
  ],
  ["praise", /(hvala|odlič|super|pohval|zadovolj|navdušen|thank|great|awesome|excellent|love)/i],
];

const TEMPLATES: Record<Category, string> = {
  question:
    "hvala za vaše vprašanje. Z veseljem vam pomagamo. Da vam lahko odgovorimo natančno, nam prosim pošljite še [manjkajoči podatek, npr. številko naročila].",
  complaint:
    "iskreno se opravičujemo za nevšečnosti. Vašo težavo smo zabeležili in jo že preverjamo. Prosimo, pošljite nam še [številka naročila], da lahko čim prej predlagamo rešitev.",
  praise: "najlepša hvala za vaše prijazne besede! Vesele nas, da ste zadovoljni, in jih z veseljem delimo z ekipo.",
  other: "hvala za vaše sporočilo. Nam lahko prosim zaupate, kako vam lahko pomagamo?",
};

export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-v1";

  async classify(message: string): Promise<Classification> {
    const match = RULES.find(([, pattern]) => pattern.test(message));
    return match ? { category: match[0], confidence: 0.6 } : { category: "other", confidence: 0.3 };
  }

  async draftReply({ category, customerName }: DraftReplyInput): Promise<string> {
    const greeting = customerName ? `Pozdravljeni, ${customerName.trim()},` : "Pozdravljeni,";
    return `${greeting}\n\n${TEMPLATES[category]}\n\nLep pozdrav,\nEkipa za podporo strankam`;
  }
}
