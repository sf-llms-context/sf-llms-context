# Salesforce Winter '27 — Developer Change Summary

> AI: Read this for what changed in Winter '27 (API v68.0) that affects generated code. The headlines are higher Apex heap limits, complex template expressions going GA in LWC, and asynchronous sharing recalculation. Generate new code at v68.0.
> Release: Winter '27 | API: v68.0 | Updated: 2026-09
> Source: Verified against the Salesforce Winter '27 Release Notes (August 31, 2026), cross-checked against the Apex, REST API, Bulk API 2.0, and Platform Events Developer Guides (all "Version 68.0, Winter '27") and the Limits and Allocations Quick Reference.

---

## Headline: higher Apex heap limits

- Synchronous heap rises from **6 MB to 10 MB**; asynchronous from **12 MB to 25 MB**.
- Enabled automatically on the Winter '27 rollout schedule. **Spring '27 enforces the higher limits globally.**
- Nonproduction orgs can temporarily keep the old ceilings via Setup > Apex Settings > *Enforce the Summer '26 Apex heap limit* — use it when building in a Winter '27 sandbox for a Summer '26 production org.
- Check the org's actual value with `Limits.getLimitHeapSize()` instead of assuming either number.

## Asynchronous sharing recalculation (Release Update)

After large-scale group or role changes, Salesforce now recalculates some shares asynchronously. Apex classes, triggers, tests, and flows that update group membership or roles and then read the resulting share records in the same transaction can break. Re-query, or move the dependent work to an async step. First available in Spring '26.

## Apex

- **Elastic limits (beta) now cover Batch jobs**, in addition to `@future` and Queueable. Past the standard rolling 24-hour async limit, in-flight Batch jobs are throttled and new Batch jobs are capped at 1 active job. Enable in Apex Settings; beta, so do not build a production dependency on it.
- **Integration tests against real endpoints (developer preview)** — Apex integration tests can call real HTTP endpoints without mock callouts, with relaxed callout and rollback semantics. `@BeforeClass` shares test data across methods in the class. Scratch orgs only; regular unit tests must still mock.
- **`explicitNamespace` on `Database.QueryOptions`**, passed through the SOQL `SET OPTIONS` clause, resolves duplicate field-name errors in managed package queries when a package field and a subscriber field share a name.
- **Apex saved at API v9.0–v19.0 now raises a compiler warning** and is scheduled for retirement in a future release.
- **Block Apex Anonymous Code Execution from Managed Packages (Release Update)** — blocks managed package session IDs from authenticating anonymous Apex.
- **Apex Symbol API (beta)** — Tooling API REST resource returning detailed type metadata for classes, interfaces, methods, and triggers.

## SOQL

- **`FORMULA()` in the WHERE clause (beta)** — arithmetic comparison between fields without a formula field. Available only in sandbox, Developer Edition, and scratch orgs on v68.0+; **not available in production**. Keep production code on formula fields.

## LWC

- **LWC API version 68.0** — set new components to 68.0 in their `.js-meta.xml`.
- **Complex template expressions are GA** — JavaScript expressions are allowed directly in templates, anywhere a basic property is allowed. Requires v68.0; below that the template does not compile. Getters remain the better home for anything beyond a short expression.
- **Third-party web components are GA** — render them natively with `lwc:external` instead of rewriting them as LWC.
- **State manager `refresh()`** — refetch list- or query-shaped data from a built-in state manager without reconfiguring it or reloading the page.
- **`window.open(url, '_blank')` on a same-origin URL throws `LockerSecurityError`** under Lightning Web Security for Aura. Use a detached programmatic anchor click.
- **`lightning/platformNavigationItemApi`** — manage navigation items in a Lightning console app's item menu.

## Flow

- **Flow Test Mode (beta)** — save reusable test scenarios and supply mock outputs for Action and Subflow elements, so a flow can be tested in isolation.

## API versions and retirements

- Current version is **v68.0**. Use it for all new metadata and endpoint paths. (See api/versions.md.)
- **Standard volume platform events are retired on December 15, 2026.** Migrate to high volume platform events.
- **OAuth 2.0 username-password flow**: enforcement postponed from Winter '27 to **February 20, 2027**. Orgs created in Summer '26 and later already have it blocked.
- **Salesforce Functions** is no longer available for purchase or renewal and is being retired; existing subscriptions run to the end of their order term.
- **Salesforce to Salesforce** is being retired in Spring '27.
- **Salesforce Connect cross-org adapter legacy authentication** is being retired — it depends on the SOAP `login()` call. The adapter now supports named credentials.
- **Salesforce for Outlook** is being retired in December 2027.
- Platform API v31.0–v40.0: deprecated in Summer '27, retired in Summer '28 (unchanged from Summer '26).
- SOAP `login()` in v31.0–v64.0: retired in Summer '27 (unchanged from Summer '26).

## Release notes structure

Winter '27 moved the Development, Deployment, and Experience Cloud release notes into a single **Platform** section.
