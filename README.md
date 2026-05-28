# sf-llms-context

Salesforce knowledge base optimized for AI coding agents. Curated, opinionated, AI-friendly Markdown content that prevents LLMs from generating deprecated Salesforce patterns.

## The problem

AI models consistently generate outdated Salesforce code:
- SOQL queries inside `for` loops
- Workflow Rules and Process Builder (deprecated since Spring '23)
- Old trigger patterns without handler classes
- Hardcoded IDs instead of Custom Metadata Types
- Aura components instead of LWC
- Outdated API versions

Salesforce releases 3x/year. AI training data lags 6–18 months. This project bridges that gap.

## How to use

### Method 1: llms.txt (recommended for AI tools that support it)

Point your AI tool to:

```
https://raw.githubusercontent.com/YOUR_USER/sf-llms-context/main/llms.txt
```

This is a lightweight index file that links to specific topic files.

### Method 2: Raw URL (single file)

Feed your AI agent the full context in one fetch:

```
https://raw.githubusercontent.com/YOUR_USER/sf-llms-context/main/llms-full.txt
```

### Method 3: Copy-paste

Copy the contents of any file in `patterns/`, `limits/`, or `api/` directly into your AI tool's context or system prompt.

### Method 4: MCP Server (coming soon)

```bash
npx @sf-llms/context
```

## What's inside

| File | What it covers |
|---|---|
| `patterns/deprecated.md` | What AI must NOT generate — deprecated patterns with correct alternatives |
| `patterns/apex-best-practices.md` | Current Apex patterns and idioms |
| `limits/governor-limits.md` | Current governor limit numbers (Summer '26 / v67.0) |
| `api/rest-api.md` | REST API patterns *(Phase 2)* |
| `api/bulk-api.md` | Bulk API 2.0 patterns *(Phase 2)* |
| `releases/current.md` | Latest release summary *(Phase 2)* |

## Current Salesforce version

- **Release:** Summer '26
- **API version:** v67.0
- **Next release:** Winter '27 (Oct 2026)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).

Found a pattern where AI generates wrong Salesforce code? [Open an issue](../../issues/new).

## License

[MIT](LICENSE)
