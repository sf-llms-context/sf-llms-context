# Salesforce Summer '26 — Developer Change Summary

> AI: Read this for what changed in Summer '26 (API v67.0) that affects generated code. The headline is the "secure by default" Apex model — on v67.0+, database operations run in User Mode and classes default to `with sharing`. Generate new code at v67.0.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against the Salesforce Summer '26 Release Notes (May 25, 2026 edition) and the Summer '26 REST/Apex/Bulk Developer Guides. Each item below is quoted or paraphrased from those documents.

---

## Headline: Apex is "secure by default" on v67.0

These are versioned changes — they apply to Apex **set to API version 67.0 and later**. Code at v66.0 and earlier keeps the old behavior.

### Database operations run in User Mode by default

- SOQL, SOSL, DML, and `Database` methods now run in **User Mode** by default — enforcing the running user's CRUD, FLS, and sharing. In v66.0 and earlier they defaulted to System Mode.
- To bypass security you must now be explicit: `WITH SYSTEM_MODE` / `AccessLevel.SYSTEM_MODE`.
- For AI: a bare `[SELECT ...]` or `update records` in a v67.0 class is already User Mode. Explicit `WITH USER_MODE` / `AccessLevel.USER_MODE` is still good for clarity and for code that may run at lower versions. Never default to System Mode.

### Apex classes default to `with sharing`

- A class with no sharing declaration now defaults to **`with sharing`** (was `without sharing`, with exceptions). Still declare `with sharing` / `without sharing` / `inherited sharing` explicitly to avoid behavior changes on version upgrade.

### WITH SECURITY_ENFORCED is removed

- The `WITH SECURITY_ENFORCED` SOQL clause is **removed as of API v67.0** — classes at v67.0+ that use it error. Use `WITH USER_MODE` instead.

## API versions and retirements

- Current version is **v67.0**. Use it for all new metadata and endpoint paths. (See api/versions.md.)
- **Platform API v31.0–v40.0 retirement announced:** deprecated in Summer '27, retired in Summer '28 — REST, SOAP, and Bulk calls to those versions will then fail.
- **SOAP `login()` in v31.0–v64.0** is being retired in Summer '27 (Release Update) — move SOAP logins to OAuth.

## Apex language

- **Multiline strings + improved string interpolation** — declare multiline strings directly and use the improved interpolation method instead of concatenation.
- **Invocable action constructor visibility:** since API v66.0, REST calls validate that a custom Apex class used as an invocable action has an accessible no-argument constructor. A non-public/no-arg constructor causes instantiation failures — make it `public`.

## LWC

- **LWC API version 67.0** — set new components to 67.0 to get current framework behavior (a component at 58.0 or earlier keeps Summer '23 engine behavior).
- **State Managers for LWC (GA)** — manage shared component state without prop-drilling or ad-hoc pub/sub.
