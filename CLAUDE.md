# CLAUDE.md — context for AI coding agents

@AGENTS.md

## Project

Mini AI Support Inbox: customer message → LLM classification → LLM reply draft → human edits/approves.
Next.js 16 App Router (Cache Components on), TypeScript strict, Drizzle + Postgres (Supabase), Sentry.

## Architecture rules

- Layers: `app/api/*` (HTTP only) → `server/messages/service.ts` (business rules) → `repository.ts` (SQL only) + `server/llm/*` (LLMProvider port).
- `server/container.ts` is the only composition root — never instantiate SDK clients elsewhere.
- Everything under `src/server` is server-only. `src/lib` must stay importable from the browser.
- Validate all input with zod schemas from `src/lib/validation.ts`; throw `AppError` subclasses, never raw errors with internals.
- Persist before calling the LLM; AI failures set `status=failed` with a user-safe message.
- Customer text is untrusted: keep it inside `<customer_message>` delimiters (see `prompts.ts`). Never log it or send it to Sentry.
- Bump `PROMPT_VERSION` when changing prompts.

## Commands

- `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint`
- `npm run db:generate` after schema changes, `npm run db:migrate` to apply.
- `npm run db:local` runs Postgres without Docker (embedded-postgres on port 5432, applies migrations itself).
