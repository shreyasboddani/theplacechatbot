# Knowledge automation setup and operations

The automated knowledge pipeline separates public change detection from privileged Gemini synchronization. A crawler can propose updates without credentials; only reviewed code on `main` can use the production Gemini key.

## Workflow sequence

1. `Detect website knowledge updates` runs daily, manually, or from an approved CMS webhook.
2. The workflow crawls public The Place pages, preserves timestamps for unchanged content, prepares the corpus, and runs the safety verifier. A full crawl must meet minimum page-count and failure-ratio checks before it can replace the last-known-good generated snapshot.
3. If meaningful content changed, the workflow opens or updates `automation/knowledge-refresh` as a pull request. It does not parse the staff DOCX or change FAQ approval statuses.
4. Reviewers inspect the generated diff and crawl reports. Normal CI must pass.
5. After merge, `Reconcile approved Gemini knowledge` validates the trusted `main` revision again and enters the protected `knowledge-production` environment.
6. The sync uploads new or changed documents first. Only after every upload succeeds does it delete replaced, duplicate, or obsolete managed documents.
7. The workflow saves reports for 30 days and invokes the optional Vercel Deploy Hook so the deployed source manifest matches the store.

Crawl timestamps remain in the audit data and source manifest but are omitted from retrieval document text, so a timestamp-only change cannot consume indexing quota or alter retrieval.

## One-time GitHub configuration

1. In **Settings → Actions → General → Workflow permissions**, select **Read and write permissions** and allow GitHub Actions to create pull requests.
2. Protect `main` and require the `Continuous integration / validate` check before merge.
3. Create a GitHub environment named `knowledge-production`.
4. Restrict that environment to `main`. Add one or more required reviewers from The Place when the repository plan supports environment protection.
5. Add these environment values:

   | Kind | Name | Purpose |
   | --- | --- | --- |
   | Secret | `GEMINI_API_KEY` | The Place-owned server-side Gemini key. |
   | Variable | `GEMINI_FILE_SEARCH_STORE` | The stable `fileSearchStores/...` resource name. |
   | Secret, optional | `VERCEL_DEPLOY_HOOK_URL` | A Production Deploy Hook for the repository's `main` branch. |

Do not put the Gemini key or Deploy Hook URL in repository variables, workflow YAML, generated reports, pull-request text, or Vercel client-exposed variables.

## Optional Vercel Deploy Hook

In Vercel, open **Project Settings → Git → Deploy Hooks**, create a hook for `main`, and store the resulting URL as the GitHub environment secret `VERCEL_DEPLOY_HOOK_URL`. The hook is invoked only after a successful Gemini reconciliation. If it is omitted, the workflow records a manual deployment reminder.

The normal Vercel variables remain required for Preview and Production. Keep `GEMINI_FILE_SEARCH_STORE` in Vercel aligned with the GitHub environment variable. Routine reconciliation keeps the resource name stable, so it does not need to change after every refresh.

## First automated run

1. Commit the automation files and generated knowledge to `main` after review.
2. Open **Actions → Detect website knowledge updates → Run workflow** to test detection.
3. If a pull request is opened, review and merge it.
4. Approve the `knowledge-production` environment job if prompted.
5. Inspect the `knowledge-sync-report-...` artifact.
6. Confirm the Vercel deployment, `/api/health`, one grounded question, one follow-up, source cards, and a contact fallback.

The first reconciliation of a store created by an older script will upload a fingerprinted replacement for each managed document and then delete the old managed copies. Later runs compare SHA-256 fingerprints and upload only changed documents.

## Review checklist for generated pull requests

- Read `knowledge/generated/crawl-report.json` and its timestamp-free `crawl-health.json` companion, especially failures, duplicates, removals, and page-count changes.
- Inspect changes to hours, dates, addresses, contacts, eligibility, prices, and donation restrictions against the linked official page.
- Confirm event dates are current and that removed events really disappeared from the official site.
- Confirm no navigation, cookie, form, script, unrelated marketing, or instruction-like text entered prepared documents.
- Confirm `manager-faq.json`, approved/pending reports, and staff approval statuses were not changed by the website workflow.
- Require all CI checks before merge.

## Immediate CMS-triggered refresh

If The Place's website platform supports outgoing webhooks, configure a trusted integration to send the GitHub `repository_dispatch` event type `the-place-website-updated`. The GitHub credential used by that integration should have only the repository permission required to dispatch workflows. A webhook triggers detection immediately but still cannot access Gemini secrets or bypass the review pull request.

Without a CMS webhook, the scheduled workflow runs daily at 09:17 UTC. GitHub may delay scheduled jobs during periods of high load, so this is eventual refresh rather than an exact-time guarantee.

## Manual commands

```bash
npm run knowledge:refresh
npm run knowledge:sync -- --reconcile
npm run knowledge:sync -- --reconcile --apply
```

The first command crawls, prepares, and verifies without Gemini credentials. The second performs a read-only reconciliation preview. The third applies the reviewed plan.

For a new Gemini project or intentional blue/green rebuild:

```bash
npm run knowledge:sync -- --new-store
```

Update both GitHub and Vercel store variables after verifying a new store. Keep the previous store until the replacement deployment passes acceptance testing.

## Failure and rollback behavior

- No meaningful content change: no knowledge pull request is created.
- Crawl or safety verification failure: no branch, upload, deletion, or deployment occurs.
- Unmanaged documents found in the configured store: reconciliation aborts before mutation.
- Any upload failure: all pre-existing remote documents are preserved. Successfully uploaded replacements may remain as safe duplicates for the next retry.
- A deletion failure: the new document remains indexed and the stale copy is reported for retry.
- Vercel hook failure: Gemini remains synchronized, but new source IDs may safely fall back until the matching manifest is deployed. Retry the deployment and acceptance tests.
- Bad reviewed content after deployment: revert the knowledge commit, let CI pass, and rerun the protected reconciliation. For a blue/green migration, point Vercel back to the previous verified store.

File Search stores and keys should ultimately belong to The Place's Google project. Never delete an old store automatically; remove it manually only after the replacement deployment is verified.
