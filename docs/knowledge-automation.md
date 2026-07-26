# Knowledge automation setup and operations

The automated pipeline separates unprivileged public-site detection from the protected Gemini synchronization job. Routine, bounded website changes can move from crawl to `main` and Gemini without a pull request. Every unsafe, unusually large, or unverifiable change fails closed and requires a person to investigate.

## Workflow sequence

1. `Detect and synchronize website knowledge updates` runs daily, manually, or from an approved CMS webhook.
2. It crawls only public The Place pages, revalidates every previously approved URL first, preserves unchanged timestamps, prepares the corpus, and runs the knowledge verifier.
3. A failed, incomplete, redirected, missing, or suspiciously shrunken approved page retains its last-known-good document and is reported in `retainedPages`. Permanent removal requires a canonical URL already committed to `knowledge/source/approved-removals.json` after human review.
4. If deterministic crawl health and prepared retrieval content are unchanged, the workflow does not commit, contact Gemini, or deploy.
5. If they changed, the workflow verifies that only generated files changed, rejects any staff-FAQ change, limits the automatic change set to 20 prepared documents, and runs the complete test, lint, build, and diff safety gate.
6. Immediately before committing, it fetches `origin/main`. If `main` advanced during validation, it exits instead of rebasing or overwriting newer work. Otherwise, the knowledge bot creates a normal commit directly on `main` and pushes without force.
7. GitHub suppresses push-triggered workflows for commits created with `GITHUB_TOKEN`, so the refresh workflow explicitly calls the reusable protected reconciliation workflow with the exact committed revision.
8. `Reconcile approved Gemini knowledge` validates that revision again inside the `knowledge-production` environment. It uploads every new or changed document before deleting its obsolete managed copy, saves audit reports for 30 days, and optionally calls a Vercel Deploy Hook.

Crawl timestamps remain in audit data and the source manifest but are omitted from retrieval document text. Timestamp-only or intermittent sitemap-candidate failures therefore cannot consume indexing quota or cause noisy commits.

## One-time GitHub configuration

1. In **Settings -> Actions -> General -> Workflow permissions**, allow read and write access so the workflow can push its bounded generated commit to `main`. Pull-request creation permission is not required.
2. If `main` is protected, permit the GitHub Actions knowledge workflow to push only when its repository safety gate succeeds. Never enable force pushes.
3. Create a GitHub environment named `knowledge-production` and restrict it to `main`.
4. Add these environment values:

   | Kind | Name | Purpose |
   | --- | --- | --- |
   | Secret | `GEMINI_API_KEY` | The Place-owned server-side Gemini key. |
   | Variable | `GEMINI_FILE_SEARCH_STORE` | The stable `fileSearchStores/...` resource name. |
   | Secret, optional | `VERCEL_DEPLOY_HOOK_URL` | A Production Deploy Hook for the repository's `main` branch. |

Do not put the Gemini key or Deploy Hook URL in repository variables, workflow YAML, generated reports, commit text, or any `NEXT_PUBLIC_` variable. A Vercel variable is not automatically available to GitHub Actions; configure the `knowledge-production` environment separately.

## Vercel configuration

The normal Vercel Preview and Production variables remain required. Keep `GEMINI_FILE_SEARCH_STORE` aligned between Vercel and GitHub. Routine reconciliation preserves the store resource name, so it does not change after each refresh.

In **Vercel -> Project Settings -> Git -> Deploy Hooks**, an administrator can create a Production hook for `main` and save it as the optional GitHub environment secret `VERCEL_DEPLOY_HOOK_URL`. The hook runs only after Gemini synchronization succeeds. Without it, the normal Git integration still deploys the main commit, and the sync workflow records a reminder.

## Initial and periodic checks

1. Commit the automation and current verified corpus to `main`.
2. Open **Actions -> Detect and synchronize website knowledge updates -> Run workflow**.
3. Confirm an unchanged crawl completes without a commit or Gemini call.
4. For a real bounded change, inspect the knowledge-bot commit, both workflow jobs, and the `knowledge-sync-report-...` artifact.
5. Confirm the Vercel deployment, `/api/health`, one grounded question, one follow-up, source cards, and a contact fallback.

## Permanent page removal

The crawler never infers that approved information should be deleted. HTTP errors, empty responses, redirects, extraction shrinkage, discovery gaps, and crawl-capacity issues retain the last-known-good page. If The Place intentionally and permanently removes a page:

1. Verify the old URL and any replacement in a normal browser.
2. Check that no unique policy, schedule, eligibility rule, address, contact, or service detail would be lost.
3. Add the canonical URL to `knowledge/source/approved-removals.json` in a human-authored, reviewed commit.
4. Run the refresh workflow and inspect the resulting deletion and synchronization report.

Removal approvals accept only canonical public `theplacega.org` HTML routes. The public-site workflow never edits this allowlist or staff FAQ approval files.

## Immediate CMS-triggered refresh

If The Place's website platform supports outgoing webhooks, configure a trusted integration to send the `repository_dispatch` event type `the-place-website-updated`. Its GitHub credential should have only the permission needed to dispatch the workflow. The same crawl, size limit, tests, main-race check, and protected Gemini job apply.

Without a webhook, the workflow checks daily at 09:17 UTC. It must fetch the public site to discover changes, but an unchanged check does not contact Gemini or create a commit. GitHub may delay scheduled jobs, so this is eventual detection rather than an exact-time guarantee.

## Manual commands

```bash
npm run knowledge:refresh
npm run knowledge:sync -- --reconcile
npm run knowledge:sync -- --reconcile --apply
```

The first command crawls, prepares, and verifies without Gemini credentials. The second previews reconciliation without mutation. The third applies the reviewed plan.

For a new Gemini project or intentional blue/green rebuild only:

```bash
npm run knowledge:sync -- --new-store
```

Update both GitHub and Vercel store variables after verifying a new store. Keep the previous store until the replacement deployment passes acceptance testing.

## Failure and rollback behavior

- No meaningful content change: no commit, Gemini call, or deployment hook.
- Crawl, extraction, corpus, prompt-injection, test, lint, build, or diff failure: no commit, upload, deletion, or hook.
- More than 20 changed prepared documents: no commit; manual inspection is required.
- Approved-page fetch or suspicious shrink failure: retain last-known-good content and record the warning.
- Staff FAQ or out-of-boundary file change: no commit.
- `main` advances during validation: no push; the next run starts from the new revision.
- Unmanaged Gemini documents: reconciliation aborts before mutation.
- Upload failure: all pre-existing remote documents remain. A successfully uploaded replacement may remain as a safe duplicate for the next retry.
- Deletion failure: the new document remains indexed and the stale copy is reported for retry.
- Vercel hook failure: Gemini remains synchronized; retry deployment and acceptance checks.
- Bad automated content discovered later: revert the knowledge commit and rerun the protected reconciliation. The old File Search store itself is never automatically deleted.

File Search stores and keys should ultimately belong to The Place's Google project. Store deletion is always manual and permanent:

```bash
npm run knowledge:delete-store -- fileSearchStores/EXACT_STORE_NAME --confirm
```
