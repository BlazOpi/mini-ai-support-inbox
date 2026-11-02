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

const FOLLOW_UP_TEMPLATES: Record<Category, string> = {
  question:
    "hvala za dodatno vprašanje. Podatke preverjamo in vam jih potrdimo v naslednjem sporočilu: [odgovor agenta].",
  complaint:
    "razumemo vašo skrb in se opravičujemo, ker zadeva še ni urejena. Primer smo predali odgovorni osebi, naslednji korak pa je [naslednji korak].",
  praise: "hvala za povratno informacijo. Veseli nas, da je zadeva urejena, zato jo s tem zaključujemo.",
  other: "hvala za informacijo, zabeležili smo jo pri vašem primeru. Če boste potrebovali še kaj, smo vam na voljo.",
};

export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-v1";

  async classify(message: string): Promise<Classification> {
    const match = RULES.find(([, pattern]) => pattern.test(message));
    return match ? { category: match[0], confidence: 0.6 } : { category: "other", confidence: 0.3 };
  }

  async draftReply({ category, customerName, history }: DraftReplyInput): Promise<string> {
    const greeting = customerName ? `Pozdravljeni, ${customerName.trim()},` : "Pozdravljeni,";
    const templates = history?.length ? FOLLOW_UP_TEMPLATES : TEMPLATES;
    return `${greeting}\n\n${templates[category]}\n\nLep pozdrav,\nEkipa za podporo strankam`;
  }
}
