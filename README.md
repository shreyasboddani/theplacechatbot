# The Place Information Assistant

A grounded chatbot prototype for The Place, created by LearnAI. The application answers only from a prepared Gemini File Search store containing The Place's public website and complete staff-provided FAQ entries. Unsupported, uncited, sensitive, or conflicting questions are routed to The Place instead of being guessed.

This repository is a prototype for review. It is not a case-management system, does not check application status, and is not represented as a final production service approved by The Place.

## What is included

- A polished standalone demonstration at `/`
- A responsive iframe experience at `/embed`
- A framework-independent floating widget loader at `/widget-loader.js`
- `POST /api/chat` with File Search-only Gemini grounding
- `GET /api/health` with non-secret configuration status
- A robots-aware, same-origin website crawler
- Staff DOCX parsing with approved and pending separation
- Prepared Markdown documents and a runtime source manifest
- Gemini File Search create/reuse, upload, list, and manual-delete scripts
- Local sensitive-data detection, Zod validation, source URL allowlisting, and best-effort rate limiting
- Automated tests and a manual review checklist

## Architecture

```text
src/app/                 Next.js pages and route handlers
src/components/chatbot/  Interactive chat UI
src/lib/gemini/          Gemini request, prompt, citation, and response logic
src/lib/knowledge/       Shared knowledge and manifest contracts
src/lib/security/        Validation, privacy detection, and rate limiting
src/generated/           Build-time source manifest
knowledge/source/        Staff-provided source DOCX
knowledge/generated/     Crawl, FAQ, prepared corpus, and sync reports
scripts/                 Offline crawl, parse, prepare, and File Search tools
public/widget-loader.js  Dependency-free host-site integration
tests/                   Vitest coverage for trust-boundary logic
docs/                    Manual test checklist
```

Runtime visitor questions never trigger website crawling. The chat route calls Gemini's current Interactions API with exactly one tool: the configured File Search store. It uses `store: false`, requests a constrained JSON result, and separately maps File Search annotations to the checked-in source manifest. An `answered` response is released only when at least one citation maps to an approved source.

## Requirements

- Node.js 20 or newer (the official `@google/genai` SDK requires Node 20+)
- npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- A Gemini project with sufficient File Search/model quota for the sync and prototype traffic

No database, authentication provider, Redis service, or paid third-party dependency is required by the prototype.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Confirm the source document exists here:

   ```text
   knowledge/source/chatbot-questions.docx
   ```

3. Copy the environment template without committing the result:

   PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env.local
   ```

4. Add the real values to `.env.local` after the knowledge store is created.

## Environment variables

```dotenv
GEMINI_API_KEY=
GEMINI_FILE_SEARCH_STORE=
GEMINI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini Developer API credential. Never prefix it with `NEXT_PUBLIC_`. |
| `GEMINI_FILE_SEARCH_STORE` | Resource name printed by the sync command, such as `fileSearchStores/...`. |
| `GEMINI_MODEL` | Central model configuration. Defaults to stable `gemini-3.1-flash-lite`. |
| `NEXT_PUBLIC_SITE_URL` | Public deployment origin used in documentation/integration context. It contains no secret. |

The application still renders without Gemini configuration. `/api/chat` returns a non-technical service-unavailable response with The Place's official contact path, and `/api/health` reports which configuration is missing.

### Gemini model selection

The chatbot uses the stable [`gemini-3.1-flash-lite`](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) model by default. It is designed for low-latency, cost-efficient, high-volume workloads and supports the File Search and structured-output features required by this chatbot. The retired `gemini-3.1-flash-lite-preview` alias must not be used.

Flash-Lite lowers model cost compared with larger Gemini models, but changing models does not by itself reduce the number of input tokens in a request or guarantee additional free-tier quota. Prompt size is bounded separately by sending only the six most recent valid conversation messages. Google can change model and free-tier limits, so review the current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) before production use. Changing the runtime model does not require recreating the File Search store or uploading the knowledge corpus again.

## Knowledge synchronization

The synchronization pipeline has four explicit stages so each can be inspected independently.

### 1. Parse the staff DOCX

```bash
npm run knowledge:parse-faq
```

To use a different input path:

```bash
npm run knowledge:parse-faq -- path/to/chatbot-questions.docx
```

This writes structured FAQ JSON plus:

- `knowledge/generated/manager-faq-approved.md`
- `knowledge/generated/manager-faq-pending.md`
- `knowledge/generated/manager-faq-report.json`

Only `approved` entries can become prepared File Search documents.

### 2. Crawl the official website

```bash
npm run knowledge:crawl
```

The default cap is 120 pages and the hard cap is 150. A smaller review crawl can be run with:

```bash
npm run knowledge:crawl -- --max-pages=25
```

The crawler reads `robots.txt`, checks sitemap candidates, follows only canonicalized `theplacega.org` pages, waits between requests, avoids blocked/private/asset routes, and records per-page timestamps and failures. It never submits forms.

### 3. Prepare the approved corpus

```bash
npm run knowledge:prepare
```

This generates one Markdown document per approved source under `knowledge/generated/prepared`, then writes:

- `knowledge/generated/sources.json`
- `src/generated/knowledge-manifest.json`
- `knowledge/generated/sync-report.json`

Review the pending entries, potential website matches, conflicts, missing links, and crawl failures before uploading.

### 4. Create/reuse and upload to File Search

After setting `GEMINI_API_KEY` in `.env.local`:

```bash
npm run knowledge:sync
```

If `GEMINI_FILE_SEARCH_STORE` is present, the script reuses that store. Otherwise it creates a timestamped store. Each prepared document is uploaded with source ID, source type, title, priority, canonical URL, and fetch timestamp metadata where applicable. The script waits for every indexing operation and finally prints:

```text
GEMINI_FILE_SEARCH_STORE=fileSearchStores/...
```

Copy that full value into `.env.local`. The raw API key is never logged. Existing stores are never deleted automatically.

Run the complete pipeline after the key is available:

```bash
npm run knowledge:all
```

### Store maintenance

List stores:

```bash
npm run knowledge:list-stores
```

Delete a verified old store manually:

```bash
npm run knowledge:delete-store -- fileSearchStores/EXACT_STORE_NAME --confirm
```

Deletion is permanent, requires both an exact resource name and `--confirm`, and is never part of an automatic refresh.

## Run locally

```bash
npm run dev
```

Open:

- Standalone demo: `http://localhost:3000`
- Embed experience: `http://localhost:3000/embed`
- Health status: `http://localhost:3000/api/health`
- Loader file: `http://localhost:3000/widget-loader.js`

Supported embed query options are constrained to:

- `theme=light|dark|auto`
- `launcher=hidden|visible`
- `position=bottom-left|bottom-right`

For example:

```text
http://localhost:3000/embed?theme=auto&launcher=hidden&position=bottom-right
```

Arbitrary CSS or script values are ignored.

## Testing and verification

```bash
npm test
npm run lint
npm run build
```

Automated tests mock or interpret Gemini-shaped responses and do not consume API quota. The real DOCX is parsed during tests to confirm known contacts, URLs, and pending exclusions. See [the manual test checklist](docs/manual-test-checklist.md) for browser and content scenarios.

## Standalone demo testing

1. Start the app with all three Gemini variables configured.
2. Open `/` and launch **Ask The Place**.
3. Send a supported question and confirm a website or staff source card appears.
4. Send an unresolved policy question and confirm the contact fallback appears.
5. Remove `GEMINI_FILE_SEARCH_STORE`, restart, and confirm the page remains usable while chat shows the service-unavailable contact path.
6. Test keyboard navigation, Escape-to-minimize, restart, narrow mobile width, and reduced-motion mode.

## Iframe integration

```html
<iframe
  src="https://YOUR-DEPLOYMENT.vercel.app/embed?theme=light&launcher=hidden"
  title="The Place information assistant"
  style="width: 390px; height: 650px; border: 0;"
  loading="lazy">
</iframe>
```

The iframe should be served from the deployed chatbot origin so its `/api/chat` request remains same-origin.

## Floating widget integration

Add this before the host page's closing `</body>` tag or through its approved script-injection area:

```html
<script
  async
  src="https://YOUR-DEPLOYMENT.vercel.app/widget-loader.js"
  data-chatbot-url="https://YOUR-DEPLOYMENT.vercel.app/embed"
  data-position="bottom-right"
  data-label="Ask The Place">
</script>
```

The loader has no dependencies, uses a Shadow DOM boundary when available, validates the iframe URL, requires HTTPS outside localhost, and constrains position/theme values. It does not assume React, Next.js, WordPress, Squarespace, or another host framework.

## Deploy to Vercel (not performed yet)

The current official Vercel workflow is documented at [Deploying a project from the CLI](https://vercel.com/docs/projects/deploy-from-cli) and [Managing environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables).

1. Install and authenticate the Vercel CLI:

   ```bash
   npm install --global vercel
   vercel login
   ```

2. From this repository, link or create the project:

   ```bash
   vercel link
   ```

3. Add variables for Preview and Production in **Project Settings → Environment Variables**, or with the CLI. Mark the API key sensitive:

   ```bash
   vercel env add GEMINI_API_KEY preview --sensitive
   vercel env add GEMINI_API_KEY production --sensitive
   vercel env add GEMINI_FILE_SEARCH_STORE preview
   vercel env add GEMINI_FILE_SEARCH_STORE production
   vercel env add GEMINI_MODEL preview
   vercel env add GEMINI_MODEL production
   vercel env add NEXT_PUBLIC_SITE_URL preview
   vercel env add NEXT_PUBLIC_SITE_URL production
   ```

4. Create a preview deployment:

   ```bash
   vercel deploy
   ```

5. Set `NEXT_PUBLIC_SITE_URL` to the intended stable deployment origin if it changed, then redeploy. Vercel environment-variable changes apply only to new deployments.

6. Verify the preview:

   ```bash
   curl https://YOUR-PREVIEW-URL.vercel.app/api/health
   ```

7. Only after stakeholder review, create production:

   ```bash
   vercel deploy --prod
   ```

8. Test `/`, `/embed`, `/api/health`, a supported answer with sources, a fallback answer, mobile behavior, and the loader on a non-production host page.

## Refreshing website information

For a clean review cycle:

```bash
npm run knowledge:crawl
npm run knowledge:parse-faq
npm run knowledge:prepare
```

Inspect `sync-report.json` and the approved/pending FAQ Markdown files. Then either create a new store by leaving `GEMINI_FILE_SEARCH_STORE` empty during `knowledge:sync`, or intentionally reuse the configured store. Point the application at the resulting store and redeploy. Keep the previous store until the new deployment passes review; delete it manually later.

## Current synchronization result

The latest local preparation pass indexed 98 public website pages and 27 approved staff FAQ entries, producing 125 prepared documents. One route (`/furniture-pickup-request`) returned no meaningful public page content and is listed as a crawl failure. No duplicate pages or source conflicts were detected in this pass.

The following staff questions remain pending and are excluded from the approved FAQ corpus:

- Furniture delivery fees
- Return policy
- Whether electronics-testing outlets are available
- Meaning of colored clothing barbs
- Whether prices are negotiable
- Whether clothing exchanges are accepted

Targeted searches of the crawled official corpus found no direct official answer for those six questions. A future website change can still become an official website source after a new crawl, but it does not silently convert a pending staff entry into an approved FAQ.

## Ownership transfer from LearnAI to The Place

1. The Place creates its own Google AI project and Gemini API key.
2. Greg (or the designated hosting administrator) configures that key in The Place's Vercel project.
3. Run the knowledge crawl, FAQ parse, preparation, and File Search sync using The Place's key/project.
4. Copy the newly printed `GEMINI_FILE_SEARCH_STORE` into the hosting environment.
5. Redeploy and complete the manual checklist.
6. Remove LearnAI's key from the hosting environment.
7. After confirming the new deployment, manually delete the obsolete LearnAI File Search store if appropriate.

File Search stores belong to the Gemini project that created them; changing only the key is not enough. The corpus must be synchronized under the new project.

## Privacy, security, and reliability notes

- The Gemini key is accessed only in the Node.js route handler and offline scripts.
- Chat transcripts are not written to a database, file, analytics service, or application log.
- Gemini interactions use `store: false`; provider-side abuse monitoring and service policies may still apply.
- Obvious SSNs, Luhn-valid card numbers, password disclosures, bank-account context with long numbers, and large private-document-like pastes are blocked before Gemini.
- React renders answer text directly; raw HTML and `dangerouslySetInnerHTML` are not used for model output.
- Website source URLs are limited to HTTPS `theplacega.org` hosts and must exist in the generated manifest.
- Request size, message length, history length, timeout, and response shape are bounded.
- The in-memory rate limiter is best-effort only. Serverless instances do not share its state, so production should use a durable distributed limiter if abuse risk warrants it.
- No browser analytics or transcript persistence is included by default.

## Prototype limitations and production hardening

- File Search quality depends on the latest successful offline sync and staff review.
- The crawler uses practical main-content extraction; every refresh report should be reviewed for missing, duplicated, or layout-heavy pages.
- Semantic retrieval can miss relevant wording. The citation gate favors a safe fallback over an unsupported answer.
- The app does not authenticate visitors or connect to The Place's internal systems.
- In-memory rate limiting is not a strong production control.
- Before production, add a distributed rate limiter, a formal content-review workflow, uptime/error monitoring that excludes message text, accessibility testing with assistive technologies, security headers appropriate to the final embedding domains, retention/legal review, and a documented incident/rollback procedure.
- Review Gemini and Vercel quotas, billing, and data-processing terms for The Place's expected traffic. Free-tier availability and limits can change.
- `npm audit` currently reports two moderate findings for one transitive advisory: Next.js 16.2.10 pins PostCSS 8.4.31 below the advisory's fixed version. npm offers only a breaking/incorrect Next.js downgrade, and a local override leaves npm's dependency tree invalid, so no unsafe forced fix is applied. Monitor the next stable Next.js release and update promptly when it carries the fixed PostCSS dependency.

## Packages added

Runtime:

- `@google/genai` — official current Gemini JavaScript/TypeScript SDK
- `cheerio` — HTML and sitemap content parsing
- `mammoth` — DOCX conversion while preserving links
- `zod` — runtime request and model-result validation

Development:

- `tsx` — TypeScript execution for offline scripts
- `vitest` — unit and API-behavior tests

No deprecated Gemini SDK or legacy model name is used.
