import "server-only";
import { z } from "zod";

/**
 * Validated server environment. Parsed lazily (on first use) so `next build`
 * does not require runtime secrets, but a misconfiguration fails loudly on the first request.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    LLM_PROVIDER: z.enum(["anthropic", "openai", "groq", "mock"]).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
    GROQ_API_KEY: z.string().min(1).optional(),
    GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

    RATE_LIMIT_AI_PER_MINUTE: z.coerce.number().int().positive().default(10),
  })
  .transform((env) => ({
    ...env,
    // Without an explicit choice, use the first provider with a key, or the offline mock if there is none.
    LLM_PROVIDER:
      env.LLM_PROVIDER ??
      (env.ANTHROPIC_API_KEY ? "anthropic" : env.OPENAI_API_KEY ? "openai" : env.GROQ_API_KEY ? "groq" : "mock"),
  }))
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", message: "ANTHROPIC_API_KEY is required for LLM_PROVIDER=anthropic" });
    }
    if (env.LLM_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({ code: "custom", message: "OPENAI_API_KEY is required for LLM_PROVIDER=openai" });
    }
    if (env.LLM_PROVIDER === "groq" && !env.GROQ_API_KEY) {
      ctx.addIssue({ code: "custom", message: "GROQ_API_KEY is required for LLM_PROVIDER=groq" });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  // Settings can't change in production. In development, Next.js reloads an edited .env.local.
  if (cached && process.env.NODE_ENV === "production") return cached;
  // A blank value, like `GROQ_API_KEY=` in a copied .env.example, means "not set", not an invalid key.
  const parsed = envSchema.safeParse(
    Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n- ${issues.join("\n- ")}`);
  }
  cached = parsed.data;
  return cached;
}
