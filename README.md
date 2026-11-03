# Mini AI Support Inbox

[![CI](https://github.com/BlazOpi/mini-ai-support-inbox/actions/workflows/ci.yml/badge.svg)](https://github.com/BlazOpi/mini-ai-support-inbox/actions/workflows/ci.yml)

Spletna aplikacija za obdelavo sporočil strank. **AI razvrsti sporočilo in pripravi predlog odgovora, človek ga uredi in potrdi.**

![Inbox](docs/screenshot-inbox.png)

## Kaj zna

- **Vnos sporočila stranke** (ime, e-pošta, besedilo) z validacijo na clientu in serverju
- **AI klasifikacija**: `vprašanje | pritožba | pohvala | drugo` + zanesljivost (structured output, JSON schema)
- **Predlog odgovora z LLM**: ton glede na kategorijo, odgovor v jeziku stranke, brez izmišljenih dejstev (manjkajoči podatki ostanejo kot `[placeholder]`)
- **Urejanje in potrditev odgovora**: po potrditvi je odgovor zaklenjen, original AI osnutka ostane shranjen
- **Pogovori**: stranka lahko odgovori, AI pa pripravi naslednji osnutek s kontekstom prejšnjih sporočil. Potrjen odgovor se takoj prikaže v pogovoru.
- **Zgodovina sprememb**: vsaka sprememba je zapisana v bazi in vidna na strani sporočila
- **Filtri** po kategoriji in statusu, ročni popravek kategorije, ponovno generiranje osnutka
- **Zaščita pred preveč zahtevami**: števec preostalih AI zahtev, zaklenjeni gumbi med obdelavo
- **Stanje nalaganja**: spinner ob osvežitvi strani, med delom AI in med osveževanjem pogovora
- **Sentry**: produkcijske napake (client + server), sledenje LLM klicem, brez osebnih podatkov

![Podrobnosti](docs/screenshot-detail.png)

## Hiter zagon

Potrebuješ Node.js 22+ in brezplačen projekt na [Supabase](https://supabase.com).

1. Nameščanje in nastavitve:
   ```bash
   npm install
   cp .env.example .env.local
   ```
2. V Supabase odpri **SQL Editor**, prilepi celotno datoteko [`supabase/setup.sql`](supabase/setup.sql) in klikni **Run**. Ustvari tabele, vklopi zaščito RLS in naloži demo tickete.
3. V `.env.local` nastavi `DATABASE_URL` (glej spodaj).
4. Preveri bazo, zaženi aplikacijo in odpri <http://localhost:3000>:
   ```bash
   npm run db:check
   npm run dev
   ```

Namesto Supabase lahko uporabiš tudi drug Postgres, na primer v Dockerju. V `DATABASE_URL` vpiši njegov naslov in tabele ustvari z `npm run db:migrate`.

Brez AI ključa aplikacija uporabi **mock provider** (pravila po ključnih besedah), zato cel tok deluje tudi brez AI računa. Z `GROQ_API_KEY`, `ANTHROPIC_API_KEY` ali `OPENAI_API_KEY` se samodejno vklopi pravi model. [Groq](https://console.groq.com) ima brezplačen paket, primeren za preizkus.

### Povezava s Supabase

Vse nastavitve so v eni vrstici v `.env.local`, ki je git ne shranjuje:

```
DATABASE_URL=postgresql://postgres.PROJECT-REF:GESLO@HOST:6543/postgres?sslmode=require
```

Vrednosti najdeš v Supabase pod **Connect → Direct → Transaction pooler**:

| Del                | Vrednost                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Uporabnik          | `postgres.PROJECT-REF`                                                           |
| Geslo              | geslo baze, **ne** API ključ. Posebne znake zapiši URL-kodirano (`$` kot `%24`). |
| Host               | se konča s `pooler.supabase.com`                                                 |
| Port               | `6543`. Neposredna povezava (`db.…supabase.co:5432`) je privzeto samo IPv6.      |
| `?sslmode=require` | dodaj sam na konec, da povezava brez šifriranja ni mogoča                        |

Aplikacija se z bazo povezuje neposredno, zato ključev Supabase (Publishable, Secret) in paketa `@supabase/supabase-js` ne potrebuje.

V razvojnem načinu glava strani pokaže, katera baza je v uporabi. Sprememba `DATABASE_URL` v `.env.local` začne veljati takoj, brez ponovnega zagona.

### Ukazi

| Ukaz                                 | Opis                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `npm run dev`                        | razvojni strežnik                                                                 |
| `npm test`                           | testi (Vitest, servis teče proti pravemu Postgresu v PGlite)                      |
| `npm run typecheck` / `npm run lint` | TypeScript strict / ESLint                                                        |
| `npm run format`                     | Prettier                                                                          |
| `npm run db:generate`                | nova migracija po spremembi sheme                                                 |
| `npm run db:migrate`                 | aplicira migracije iz `drizzle/`                                                  |
| `npm run db:check`                   | preizkusi bazo v `DATABASE_URL`: povezava, tabele, migracije, branje in pisanje   |
| `npm run db:supabase-sql`            | po novi migraciji ali spremembi demo podatkov na novo zgradi `supabase/setup.sql` |
| `npm run db:studio`                  | Drizzle Studio za pregled podatkov                                                |

V razvojnem načinu ima obrazec še **testne scenarije** ([`src/lib/scenarios.ts`](src/lib/scenarios.ts)): en klik ustvari izmišljeno stranko in njeno sporočilo. Ko odgovor potrdiš, z gumbom _Generiraj odgovor stranke_ stranka odpiše. Med scenariji je tudi poskus manipulacije AI (prompt injection).

### Demo podatki

`supabase/setup.sql` doda 8 izmišljenih pogovorov. Dodaš jih lahko tudi kasneje s [`supabase/seed.sql`](supabase/seed.sql), pred uporabo s pravimi strankami pa jih odstrani:

```sql
delete from messages where id::text like '10000000-%';
```

### Deploy (Vercel + Supabase + Sentry)

1. **Supabase**: pripravi bazo kot zgoraj. Za bazo brez demo podatkov namesto `setup.sql` zaženi `npm run db:migrate`, z **Session pooler** URL-jem (port 5432) v `DATABASE_MIGRATION_URL`.
2. **Sentry**: ustvari Next.js projekt in kopiraj DSN (`NEXT_PUBLIC_SENTRY_DSN`). Za source mape dodaj še `SENTRY_ORG`, `SENTRY_PROJECT` in `SENTRY_AUTH_TOKEN`.
3. **Vercel**: uvozi GitHub repozitorij in nastavi env spremenljivke iz `.env.example`: `DATABASE_URL`, ključ AI ponudnika, Sentry in nujno `BASIC_AUTH_USER` ter `BASIC_AUTH_PASSWORD`, sicer je aplikacija javno dostopna.
4. Preveri: `GET /api/health` vrne `{"status":"ok","database":"ok"}`.

## Arhitektura

```mermaid
flowchart LR
  UI["React UI<br/>(Server + Client Components)"] -->|fetch JSON| API["Route Handlers<br/>app/api/*"]
  UI -. "branje (RSC)" .-> SVC
  API --> SVC["MessageService<br/>poslovna logika"]
  SVC --> REPO["Repository<br/>Drizzle ORM"] --> DB[(PostgreSQL<br/>Supabase)]
  SVC --> LLM{{"LLMProvider"}}
  LLM --> A["Claude (Anthropic)"]
  LLM --> O["OpenAI"]
  LLM --> G["Groq"]
  LLM --> M["Mock"]
  API & SVC -. "napake + tracing" .-> S["Sentry"]
```

**Sloji** (`src/`):

| Sloj        | Datoteke                                                 | Odgovornost                                                                                                   |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| UI          | `app/page.tsx`, `app/messages/[id]`, `components/*`      | Server Components berejo podatke (streaming prek `Suspense`), Client Components izvajajo akcije prek REST API |
| HTTP        | `app/api/**/route.ts`, `server/api.ts`, `server/http.ts` | validacija (zod), preverjanje izvora, rate limit, preslikava napak v HTTP kode                                |
| Domena      | `server/messages/service.ts`                             | statusni tok, pravila (urejanje samo osnutkov, potrditev enkrat …)                                            |
| Podatki     | `server/messages/repository.ts`, `server/db/*`           | samo SQL; pogojni UPDATE-i za konsistenco                                                                     |
| AI          | `server/llm/*`                                           | vmesnik `LLMProvider`, prompti, Claude/OpenAI/Groq/mock implementacije                                        |
| Kompozicija | `server/container.ts`                                    | edino mesto, ki pozna konkretne implementacije (DI)                                                           |

**Statusni tok sporočila:**

```mermaid
stateDiagram-v2
  [*] --> processing: vnos (najprej shranjeno)
  processing --> draft_ready: klasifikacija + osnutek OK
  processing --> failed: napaka LLM
  failed --> processing: Ponovi
  draft_ready --> processing: Ponovno generiraj
  draft_ready --> draft_ready: urejanje / popravek kategorije
  draft_ready --> approved: Potrdi
  approved --> [*]
```

**Podatkovni model:**

| Tabela           | Vsebina                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `messages`       | besedilo, kategorija, zanesljivost, vir kategorije `ai\|human`, status, napaka, `thread_id`    |
| `replies`        | 1:1 s sporočilom; `ai_draft` = original LLM, `body` = trenutna verzija, `model`, `approved_at` |
| `message_events` | zgodovina sprememb: `type`, `actor` (`customer\|ai\|agent`), `old_value`, `new_value`          |

Vrstica v `message_events` se zapiše v isti transakciji kot sprememba, zato zgodovina ne more izpustiti spremembe ali zabeležiti neuspele. Ob brisanju sporočila se izbriše tudi njegova zgodovina. Agenti še nimajo svojih računov, zato je vsak človek zabeležen kot `agent`.

### Ključne odločitve

- **Sporočilo se shrani pred klicem LLM-ja.** Če AI pade (timeout, 429, neveljaven output), podatki niso izgubljeni: status je `failed`, uporabnik vidi razlog in gumb »Ponovi«. API vseeno vrne `201`, ker je bil vir ustvarjen.
- **Structured outputs + ponovna zod validacija.** Klasifikacija je omejena na JSON shemo z enumom, rezultat se še enkrat preveri. Modelu ne zaupamo na slepo.
- **Dva ločena LLM klica** (klasifikacija → osnutek): osnutek dobi kategorijo kot kontekst (ton), klasifikacija pa ostane poceni in hitra.
- **Človek v zanki:** AI nikoli ne pošlje odgovora sam. Ročni popravek kategorije ima prednost pri ponovnem generiranju.
- **Original AI osnutka se hrani** (`ai_draft` ≠ `body`), tako se da meriti, koliko ljudje popravljajo AI. To je osnova za evals in izboljšave promptov (`prompt_version`).
- **Konsistenca:** prehodi stanj so pogojni UPDATE-i (`WHERE status = 'draft_ready'`), zato dvojna potrditev ali urejanje po potrditvi ni možno niti ob sočasnih zahtevah (`409 Conflict`). Sporočilo, ki obvisi v `processing` (npr. ubit serverless proces), se po 2 min lahko ponovno obdela.
- **En Next.js projekt za frontend in backend.** Jasni sloji, en deploy, deljeni tipi in validacijske sheme med clientom in serverjem.

## REST API

| Metoda  | Pot                                      | Opis                                                             |
| ------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `GET`   | `/api/messages?category=&status=&limit=` | zgodovina (najnovejša najprej)                                   |
| `POST`  | `/api/messages`                          | `{ body, customerName?, customerEmail? }` → shrani + AI obdelava |
| `GET`   | `/api/messages/:id`                      | eno sporočilo z odgovorom                                        |
| `PATCH` | `/api/messages/:id`                      | `{ category }`: ročni popravek kategorije                        |
| `PATCH` | `/api/messages/:id/reply`                | `{ body }`: urejanje osnutka                                     |
| `POST`  | `/api/messages/:id/approve`              | potrditev odgovora                                               |
| `POST`  | `/api/messages/:id/process`              | ponovi obdelavo / ponovno generiraj                              |
| `POST`  | `/api/messages/:id/customer-reply`       | `{ body }`: odgovor stranke, nadaljuje pogovor                   |
| `GET`   | `/api/ai-quota`                          | preostale AI zahteve tega odjemalca                              |
| `GET`   | `/api/health`                            | stanje aplikacije in baze                                        |

Napake imajo enotno obliko `{ "error": { "code": "...", "message": "..." } }` in ustrezne kode `400/403/404/409/413/429/500`.

## Varnost

- **Validacija vhodov** z zod (omejitve dolžine, e-pošta, UUID parametri), omejitev velikosti telesa (32 KB), sporočila napak brez internih podrobnosti
- **SQL injection**: samo parametrizirane poizvedbe (Drizzle)
- **XSS**: vsebina strank se izpisuje samo kot tekst (React escaping, brez `dangerouslySetInnerHTML`)
- **Prompt injection**: besedilo stranke je med ločili `<customer_message>`, ki jih stranka ne more zapreti. Model dobi navodilo, naj ga obravnava kot podatke, output je omejen na shemo, človek vedno potrdi.
- **Skrivnosti** samo na serverju (`server-only`, env validacija z zod)
- **Rate limit** na AI endpointih (privzeto 10/min/IP, `RATE_LIMIT_AI_PER_MINUTE`) z `Retry-After`
- **CSRF**: preverjanje `Origin` pri mutacijah + JSON telo (CORS preflight)
- **Dostop**: HTTP Basic Auth (Next.js `proxy.ts`, primerjava v konstantnem času) za demo
- **Supabase RLS** vklopljen na vseh tabelah (brez politik): javni Data API nima dostopa, aplikacija dostopa kot lastnik tabel
- **Security headerji** (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, osnovni CSP)
- **Zasebnost v logih in Sentryju**: brez teles zahtev, piškotkov, IP-jev, vrednosti SQL poizvedb in LLM promptov/odgovorov

## Obravnava napak in observability

- Hierarhija napak (`ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `LLMError` …) → enoten JSON odgovor
- Napake SDK-jev (timeout, 401, 429, 5xx) se preslikajo v razumljiva sporočila. LLM klici imajo timeout (20 s) in 2 retryja z backoffom (SDK). Klasifikacija se ponovi do trikrat, kadar Groq zavrne odgovor svojega modela, ker ne ustreza shemi.
- `error.tsx` / `global-error.tsx` / `not-found.tsx` v UI, napake se pošljejo v Sentry
- **Sentry**: `instrumentation.ts` (server, `onRequestError`), `instrumentation-client.ts` (browser), tunnel route proti ad-blockerjem, source mapi ob buildu. LLM klici so instrumentirani: model, latenca in tokeni, brez vsebine.
- Strukturirani JSON logi brez osebnih podatkov (`ai.processed`, `ai.failed` z `messageId`, `stage`, `durationMs`)

## Testi

`npm test` pokrije:

- **Servis** (integracijski, pravi Postgres prek PGlite + produkcijske migracije): celoten tok, AI napaka → `failed` → retry, pogovori, zgodovina sprememb, zaklep po potrditvi, ohranjanje ročne kategorije, obnovitev zastarelega `processing`, filtri
- **Supabase setup**: `setup.sql` ustreza migracijam, javna vloga ne vidi ničesar, demo podatki delujejo v aplikaciji
- **LLM provider**: validacija structured outputa, zavrnitve, preslikava napak, ignoriranje thinking blokov
- **Prompt injection** zaščita, rate limiter, števec zahtev, validacijske sheme, zasebnost logov

## Uporaba AI orodij pri razvoju

- **Claude Code (Claude Opus 5.5)** kot pair-programmer v celotnem procesu:
  1. **Najprej plan**: arhitektura, podatkovni model, statusni tok, varnost. Šele nato koda.
  2. **Inkrementalna implementacija** po slojih (glej git zgodovino): baza → LLM sloj → servis/API → UI → Sentry → testi.
  3. **Sprotno preverjanje**: typecheck, lint, testi, produkcijski build in E2E klik skozi aplikacijo v headless brskalniku po vsakem koraku.
  4. Next.js 16 ima precej novosti (Cache Components, `proxy.ts` namesto middleware). Agent je bral dokumentacijo, ki je priložena paketu (`AGENTS.md`), namesto da bi se zanašal na zastarelo znanje.
- **`CLAUDE.md`** v repozitoriju opisuje arhitekturna pravila za nadaljnje delo z AI agenti.
- Moja vloga: odločitve o arhitekturi in obsegu, pregled kode, preverjanje robnih primerov.
- **V produktu**: structured outputs, verzioniranje promptov, zamenljiv ponudnik (Claude, OpenAI, Groq).

## Kaj bi še izboljšal

1. **Asinhrona obdelava**: queue (npr. Vercel Queues/Inngest) in streaming osnutka (SSE) namesto sinhronega klica (~2–4 s)
2. **Avtentikacija in vloge** (Supabase Auth/SSO), da zgodovina sprememb pokaže, kateri agent je urejal/potrdil
3. **Evals**: zlati nabor sporočil za klasifikacijo v CI, metrika »edit distance« med `ai_draft` in potrjenim odgovorom po verziji prompta
4. **RAG nad bazo znanja/FAQ**, da osnutki vsebujejo prava dejstva namesto placeholderjev
5. **Integracija z e-pošto/helpdeskom**: inbound webhook, pošiljanje potrjenega odgovora
6. **Porazdeljen rate limit** (Redis/Upstash), ker je trenutni per-instance
7. Paginacija s kursorjem, iskanje (Postgres full-text), prioritizacija/sentiment
8. Strožji CSP z nonce, Playwright E2E testi v CI, redakcija PII pred pošiljanjem LLM-ju
