# Contributing

Thanks for considering a contribution. This project exists to keep AI coding agents from generating outdated Salesforce code — every correction matters.

## What we want

- **Wrong patterns AI generates** — open an issue with: which AI tool, what it generated, what's wrong, what the correct pattern is. We add it to `patterns/deprecated.md`.
- **Outdated numbers** — governor limits, API versions, retired features. Cite the official Salesforce source (PDF page, Help article URL, Trailhead unit).
- **New release content** — when Salesforce ships Winter '27, Spring '27, etc., the existing files need verification and updates.
- **Better examples** — clearer or more representative code samples for existing patterns.

## What we don't want

- Adding patterns that aren't AI-relevant (style preferences, team-specific conventions)
- Comprehensive references (we link to the official docs for those — this project is opinionated and curated)
- Unverified numbers — every limit and API version must have an official source

## Process

1. Open an issue first for anything beyond a typo. Describe the change and link the official source.
2. For PRs, keep them small and scoped — one pattern or limit per PR.
3. Update the `> Release:` and `> Updated:` lines at the top of any file you change.
4. If you touch a content file, regenerate `llms-full.txt`:
   ```bash
   cat patterns/deprecated.md \
       limits/governor-limits.md \
       patterns/apex-best-practices.md \
       patterns/lwc-best-practices.md \
       patterns/soql-best-practices.md \
       patterns/flow-best-practices.md \
       api/versions.md \
       api/rest-api.md \
       api/bulk-api.md \
       > llms-full.txt
   ```

## File structure

See [CLAUDE.md](CLAUDE.md) for the full project layout and content principles.

## Salesforce release cycle

Salesforce releases 3 times per year. After each release, the maintainer downloads the official PDFs (Apex Developer Guide, Limits Quick Reference, REST API, Bulk API, Platform Events, Change Data Capture) and re-verifies every number in `limits/governor-limits.md`. Help us by flagging anything that drifts.

## License

Contributions are accepted under the [MIT License](LICENSE).
