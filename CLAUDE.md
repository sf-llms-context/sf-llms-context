# sf-llms-context

Salesforce knowledge base optimized for AI coding agents. Curated, opinionated, AI-friendly Markdown content that prevents LLMs from generating deprecated Salesforce patterns.

## Why this exists

AI models (Claude, GPT, Copilot) consistently generate outdated Salesforce code: SOQL in loops, old trigger patterns, wrong API versions, deprecated Workflow Rules. Salesforce releases 3x/year but AI training data lags 6-18 months. This project bridges that gap.

## Project structure

```
sf-llms-context/
├── llms.txt                    # AI entry point (like robots.txt for LLMs)
├── llms-full.txt               # Complete concatenated content for single-fetch
├── README.md                   # For humans — project overview, usage, contributing
├── CONTRIBUTING.md             # How to contribute
├── CLAUDE.md                   # This file — agent instructions
├── RESEARCH.md                 # Market research (not shipped to users)
├── PLAN.md                     # Development plan (not shipped to users)
│
├── patterns/
│   ├── deprecated.md           # PRIORITY #1 — what AI must NOT generate
│   ├── apex-best-practices.md  # Current Apex patterns and idioms
│   ├── lwc-best-practices.md   # Lightning Web Components patterns
│   ├── soql-best-practices.md  # SOQL/SOSL patterns
│   └── flow-best-practices.md  # Flow Builder patterns
│
├── limits/
│   └── governor-limits.md      # Current governor limit numbers
│
├── api/
│   ├── rest-api.md             # REST API current patterns
│   ├── bulk-api.md             # Bulk API 2.0 patterns
│   └── versions.md             # API version history and current
│
├── releases/
│   ├── current.md              # Always points to latest release
│   ├── summer-25.md            # Per-release change summaries
│   └── spring-25.md
│
└── packages/
    └── mcp-server/             # MCP server (Phase 2)
        ├── package.json
        ├── index.js
        └── README.md
```

## Content principles

1. **AI-first format** — every file starts with a one-line instruction for the AI agent, then structured content. No HTML, no navigation chrome, no marketing.
2. **Show wrong AND right** — every deprecated pattern shows the bad code and the correct alternative side by side.
3. **Token-efficient** — no filler text, no repeated explanations. Every token counts.
4. **Versioned** — every file states which Salesforce release and API version it covers.
5. **Opinionated** — this is not a neutral reference. It tells the AI what to do and what NOT to do.

## Content format for pattern files

Every pattern file follows this structure:

```markdown
# [Topic] — Salesforce [Best Practices / Deprecated Patterns]
> AI: [One-line instruction — when to read this file]
> Release: Summer '25 | API: v64.0 | Updated: 2025-06

## [Category]

### [Pattern name]
- BAD: [what not to do — with code example]
- GOOD: [what to do instead — with code example]
- WHY: [one sentence — governor limit, security, maintenance, deprecation]
```

## Writing rules

- All content in English
- Code examples in Apex, SOQL, JavaScript (LWC), or Flow XML as appropriate
- No inline comments in code examples unless they clarify something non-obvious
- Keep each pattern under 200 tokens — brevity is a feature
- Never reference this project's internal files (RESEARCH.md, PLAN.md) in user-facing content
- File headers use `>` blockquote for AI instructions — these are the first thing an agent reads

## llms.txt format

Follow the llms.txt standard (https://llmstxt.org):
- Title line with `#`
- Description with `>`
- Sections with `##`
- Links as `- [Label](/path/to/file.md): Description`
- Keep it under 100 lines — this is an index, not content

## llms-full.txt

Concatenation of all content files in priority order:
1. patterns/deprecated.md (always first)
2. limits/governor-limits.md
3. patterns/apex-best-practices.md
4. patterns/lwc-best-practices.md
5. patterns/soql-best-practices.md
6. patterns/flow-best-practices.md
7. api/versions.md
8. api/rest-api.md
9. api/bulk-api.md
10. releases/current.md

Generate with: `cat [files in order] > llms-full.txt`

## MCP server (Phase 2)

Simple Node.js stdio server. Tools:
- `get_deprecated_patterns` — returns patterns/deprecated.md
- `get_governor_limits` — returns limits/governor-limits.md
- `get_best_practices(topic)` — returns patterns/{topic}-best-practices.md
- `get_api_patterns(topic)` — returns api/{topic}.md
- `get_release_notes(version?)` — returns releases/{version}.md or current.md

Use `@modelcontextprotocol/sdk` package. Keep it under 150 lines.

## Current Salesforce release info

- Current release: Summer '25
- API version: v64.0
- Next release: Winter '26 (Oct 2025)
- Release notes: https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm

## Git

- Commit messages in English, short and descriptive
- Branch naming: `content/topic-name`, `fix/description`, `feat/description`
- No generated files in commits (llms-full.txt is generated, but committed for GitHub raw URL access)
