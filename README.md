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
https://raw.githubusercontent.com/sf-llms-context/sf-llms-context/main/llms.txt
```

This is a lightweight index file that links to specific topic files.

### Method 2: Raw URL (single file)

Feed your AI agent the full context in one fetch:

```
https://raw.githubusercontent.com/sf-llms-context/sf-llms-context/main/llms-full.txt
```

### Method 3: Copy-paste

Copy the contents of any file in `patterns/`, `limits/`, or `api/` directly into your AI tool's context or system prompt.

> **Tools without web access (e.g. free ChatGPT):** paste the *content* of `llms-full.txt`, or upload it as a file — do **not** just paste the URL. Without browsing, the model never fetches the link and silently runs with no context.

### Method 4: MCP Server (coming soon)

```bash
npx @sf-llms/context
```

## What's inside

| File | What it covers |
|---|---|
| `patterns/deprecated.md` | What AI must NOT generate — deprecated patterns with correct alternatives |
| `patterns/apex-best-practices.md` | Current Apex patterns and idioms |
| `patterns/soql-best-practices.md` | Selective queries, bind variables, User Mode, cursors |
| `patterns/lwc-best-practices.md` | Lightning Data Service, lwc:if/ref, custom events, LMS, GraphQL |
| `patterns/flow-best-practices.md` | Record-Triggered Flow patterns, fault paths, subflows |
| `limits/governor-limits.md` | Current governor limit numbers (Summer '26 / v67.0) |
| `api/rest-api.md` | REST API patterns *(Phase 3)* |
| `api/bulk-api.md` | Bulk API 2.0 patterns *(Phase 3)* |
| `releases/current.md` | Latest release summary *(Phase 3)* |

## Current Salesforce version

- **Release:** Summer '26
- **API version:** v67.0
- **Next release:** Winter '27 (Oct 2026)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Found a pattern where AI generates wrong Salesforce code? [Open an issue](https://github.com/sf-llms-context/sf-llms-context/issues/new/choose).

## License

[MIT](LICENSE)
