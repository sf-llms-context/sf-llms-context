# Releasing — Per-Salesforce-Release Update Process

Salesforce ships three releases a year (Spring, Summer, Winter). Each one can change governor limits, the current API version, deprecations, and security defaults. This is the checklist to bring the knowledge base current. Budget ~2–4 hours.

The guiding rule: **verify every number and pattern against an official source. Never guess.** If a fact isn't in an AI-accessible official document, label it as unverified in the file rather than stating it as fact.

## 0. Get the official sources

Download the new release's PDFs into a working folder (not committed), e.g. `~/dev/tmp/sf-<season>-<yy>/`:

- Release Notes (the big one)
- Apex Developer Guide
- REST API Developer Guide
- Bulk API 2.0 Developer Guide
- Limits and Allocations Quick Reference
- Platform Events Developer Guide
- Change Data Capture Developer Guide
- Pub/Sub API allocations (web page; JS-rendered but readable)

Source: the Salesforce Release Notes site and the developer.salesforce.com guide downloads.

## 1. Verify against the sources

Extract text and grep for the facts you're changing:

```bash
cd ~/dev/tmp/sf-<season>-<yy>/
pdftotext salesforce_release_notes_<date>.pdf - | grep -iE "<term>"
```

Confirm: the new API version + season string, any changed limit numbers, newly deprecated/removed features, security-default changes, and the API-version retirement schedule.

## 2. Update content files

- `api/versions.md` — current version, release→version map, retirement schedule.
- `patterns/deprecated.md` — newly deprecated/removed features.
- `limits/governor-limits.md` — any changed numbers (keep the `Source:` line accurate).
- `patterns/{apex,soql,lwc,flow}-best-practices.md` — new patterns or security-model changes.
- `objects/standard-objects.md` — usually stable; touch only if schema changed.
- `api/rest-api.md`, `api/bulk-api.md` — usually stable; check for new resources/limits.
- `releases/<season>-<yy>.md` — NEW: developer change summary for the release.
- `releases/current.md` — overwrite with a copy of the new `releases/<season>-<yy>.md`.

### Bump the version headers everywhere

Update the `> Release:` / `> API:` / `> Updated:` blockquote lines at the top of **every** content file, and the `> Current:` line in `llms.txt`. Grep to catch them all:

```bash
grep -rn "API: v" patterns/ limits/ api/ objects/ releases/
```

## 3. Regenerate llms-full.txt

Use the exact `cat` command in `CONTRIBUTING.md` (it lists the files in priority order). The CI job **llms-full.txt in sync** fails the build if `llms-full.txt` doesn't match that concatenation, so this is mandatory. If you add a new content file, add it to the `cat` list in **both** `CONTRIBUTING.md` and `.github/workflows/ci.yml`.

## 4. Re-sync GitHub Pages

Pages repo: `sf-llms-context/sf-llms-context.github.io` (working copy `~/dev/sf-llms-context.github.io`).

- `llms-full.txt` — straight copy from the main repo, then push.
- `llms.txt` — **DO NOT overwrite** with the main repo's version. The Pages `llms.txt` is hand-customized: it uses absolute `raw.githubusercontent.com/.../main/...` links (so links resolve from the hosted site), an absolute `https://sf-llms-context.github.io/llms-full.txt` full-context link, and an extra `## Source` section. Port any new sections/links into it manually with absolute URLs.

```bash
PAGES=~/dev/sf-llms-context.github.io
cp llms-full.txt "$PAGES/llms-full.txt"
# edit "$PAGES/llms.txt" by hand if llms.txt changed
git -C "$PAGES" add -A && git -C "$PAGES" commit -m "Sync <season> '<yy>" && git -C "$PAGES" push
```

GitHub Pages takes ~1 minute to deploy. Verify the live URLs return 200 and contain the new content before considering it done.

## 5. PR and merge

Branch as `content/<season>-<yy>` (see naming in `CLAUDE.md`), open a PR, let CI pass (markdownlint, link check, llms-full sync), then merge. Re-sync Pages (step 4) after merge.

## Notes

- The smoke-test method (give the same user story to several models, with and without the context, and diff the output) is a good way to validate that a release's changes actually steer model output.
- Bump the MCP server version (`packages/mcp-server/`) once it exists.
