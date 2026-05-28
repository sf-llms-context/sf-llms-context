# Salesforce Governor Limits — Current Numbers

> AI: Reference these numbers when generating Apex code. Never hardcode values that exceed these limits. When in doubt, add LIMIT clauses and bulkify.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against Salesforce Apex Developer Guide and Salesforce Developer Limits and Allocations Quick Reference (Summer '26, last updated May 8, 2026). Cursor limits added in Spring '26 (API v66.0). No core limit numbers have changed since Summer '25.

---

## Apex Per-Transaction Limits

This table lists synchronous and asynchronous limits. Async = Batch Apex, Queueable, @future, scheduled.

| Limit | Sync | Async |
|---|---|---|
| SOQL queries | 100 | 200 |
| SOQL rows retrieved | 50,000 | 50,000 |
| Database.getQueryLocator rows | 10,000 | 10,000 |
| SOSL queries | 20 | 20 |
| SOSL rows per query | 2,000 | 2,000 |
| DML statements | 150 | 150 |
| DML rows | 10,000 | 10,000 |
| Stack depth (recursive triggers via insert/update/delete) | 16 | 16 |
| Callouts (HTTP/Web Service) | 100 | 100 |
| Callout timeout (cumulative) | 120,000 ms | 120,000 ms |
| @future methods invoked | 50 | 0 in batch/future; 50 in queueable |
| Queueable jobs enqueued (System.enqueueJob) | 50 | 1 |
| sendEmail invocations | 10 | 10 |
| Heap size | 6 MB | 12 MB |
| CPU time | 10,000 ms | 60,000 ms |
| Max transaction execution time | 10 minutes | 10 minutes |
| Push notification method calls | 10 | 10 |
| Push notifications per call | 2,000 | 2,000 |
| EventBus.publish (publish immediately) | 150 | 150 |

Notes:
- Email services heap size: **50 MB** (override of the 6 MB sync heap for email services).
- "Describes" no longer has a hard per-transaction limit — describe operations are cached and don't count.
- Scheduled Apex uses synchronous limits despite being async-launched.
- For Bulk API/Bulk API 2.0 transactions, the effective limit is the higher of the sync/async values.
- **Trigger batch size: 200 for regular DML triggers, 2,000 for Platform Event and Change Data Capture triggers.** AI commonly assumes 200 for all triggers — wrong for PE/CDC.

## Apex Cursor Limits (Spring '26, API v66.0+)

Cursors are tracked separately from regular SOQL — they have their own row and call quotas.

| Limit | Sync | Async |
|---|---|---|
| Total rows across all cursors per transaction | 50,000,000 | 50,000,000 |
| Cursor.fetch() calls per transaction | 100 | 100 |
| New cursors created per 24 hours | 10,000 | 10,000 |
| New cursor + pagination rows per 24 hours | 100,000,000 | 100,000,000 |
| Pagination cursor instances per transaction | 50 | 50 |
| Pagination cursor instances per 24 hours | 200,000 | 200,000 |
| Rows across all pagination cursors per transaction | 100,000 | 100,000 |
| Rows per page from a pagination cursor | 2,000 | 2,000 |

**Elastic Limits (Beta, Summer '26):** Orgs can enable elastic limits for Queueable and @future jobs. The elastic limit is 2× the org's licensed daily async job limit (capped at +10M executions). Jobs exceeding the licensed limit are throttled instead of failing.

## Batch Apex Limits

| Limit | Value |
|---|---|
| Max batch size (scope) | 2,000 |
| Default batch size | 200 |
| QueryLocator rows | 50,000,000 |
| Concurrent batch jobs queued or active | 5 |
| Flex queue (Holding status) | 100 |
| Concurrent start method executions | 1 |
| execute re-tries on failure | 0 |

## Platform / Org-Level Limits

These limits aren't per-transaction — they apply across the entire org over time. AI should be aware they exist but doesn't need exact numbers when generating code.

| Limit | Value |
|---|---|
| Daily async Apex executions (batch + queueable + future + scheduled) | 250,000 or 200 × user licenses, whichever is greater |
| Concurrent long-running sync transactions (>5s each) | 10–50 (based on org license count) |
| Max scheduled Apex classes concurrently | 100 (5 in Developer Edition) |

Why this matters: even when a single transaction stays within per-transaction limits, an org can hit daily caps under load. Prefer Batch Apex over many small Queueable jobs when processing huge volumes.

## Platform Events

| Limit | Value |
|---|---|
| Publish calls per transaction | 150 |
| EventBus.publish per call | 1 event (list overload allows multiple) |
| High-volume event delivery | Up to 100,000/hour (varies by edition) |
| Standard-volume daily limit | Varies by edition |
| CometD subscribers | Varies by edition |
| Event retention | 72 hours (high-volume) |

Note: Standard Volume Platform Events are no longer supported starting Winter '27. Migrate to High Volume Platform Events.

## Bulk API 2.0

| Limit | Value |
|---|---|
| Max file size per upload (base64 encoded) | 150 MB |
| Recommended raw data size (pre-encoding) | 100 MB |
| Records per batch (auto-split) | 10,000 |
| Max fields per record | 5,000 |
| Max characters per field | 131,072 |
| Max characters per record | 400,000 |
| Daily max records per ingest job | 150,000,000 |
| Daily batch allocations (shared with Bulk API v1) | 15,000 batches per rolling 24h |
| Daily query jobs (Bulk API 2.0) | 10,000 |
| Daily query results storage | 1 TB |
| Per-batch processing timeout | 5 minutes |
| Per-batch retry attempts | 20 |
| Bulk API CPU time (isolated from Apex limit) | 60,000 ms |
| Job lifespan after terminal state (completed/aborted/failed) | 7 days |
| Max time a job can remain open | 24 hours |

Note: The Bulk API has no explicit "concurrent jobs" cap. Throughput is governed by the 15,000 daily batches and the 250,000 daily async Apex executions allocation (for any code processing the results).

## REST API — Composite

| Limit | Value |
|---|---|
| Composite Batch subrequests | 25 per call |
| Composite Batch timeout | 10 minutes |
| Composite Graph total nodes per payload | 500 |
| Composite Graph graphs per payload | 75 |
| Composite Graph max depth | 15 |
| Composite Graph different node types per payload | 15 |
| Composite Graph max failed graphs before halt | 14 |

Note: Composite Graph counts a node as "different" when it uses a different API version, HTTP method, or sObject type.

## REST API — sObject Tree

| Limit | Value |
|---|---|
| Max records (total across all trees) | 200 |
| Max different object types | 5 |
| Max tree depth | 5 levels |

## REST API — General

| Limit | Value |
|---|---|
| API calls per 24h | Varies by edition (org-level) |
| Query batch size (Sforce-Query-Options header) | 200–2,000 (default 2,000) |

## API Request Limits (REST + SOAP)

| Limit | Value |
|---|---|
| Concurrent inbound requests longer than 20s — Developer Edition / Trial | 5 |
| Concurrent inbound requests longer than 20s — Production / Sandbox | 25 |
| Concurrent requests shorter than 20s | unlimited |
| REST/SOAP call timeout (non-query) | 10 minutes |
| Query call timeout (SOQL) | 120 seconds (server) / 32 minutes (total: 2 min execute + 30 min process) |
| Combined URI + headers length per REST call | 16,384 bytes |
| Stored third-party access/refresh token length | up to 10,000 chars |

Daily API call allocation per edition (`Total Calls Per 24-Hour Period`):
- Developer Edition: 15,000
- Enterprise / Professional+API: `100,000 + (licenses × per-license calls)` (Salesforce/Platform license = 1,000)
- Unlimited / Performance: `100,000 + (licenses × per-license calls)` (Salesforce/Platform license = 5,000)

## Static Apex Limits

| Limit | Value |
|---|---|
| Default callout timeout | 10 seconds (max 120s per `setTimeout`) |
| Max callout request/response size | 6 MB (sync) / 12 MB (async) |
| Max SOQL query runtime before cancel | 120 seconds |
| Max class + trigger code units per deployment | 7,500 |
| Max characters per class | 1,000,000 |
| Max characters per trigger | 1,000,000 |
| Total Apex code per org | 6 MB (10 MB for scratch orgs) |
| Method bytecode size | 65,535 instructions (compiled) |
| Batch Apex QueryLocator max rows | 50,000,000 |
| Daily test classes queued (production) | greater of 500 or 10 × test class count |
| Daily test classes queued (sandbox/DE) | greater of 500 or 20 × test class count |

Notes:
- Org-wide 6 MB code limit excludes managed packages (1GP/2GP) and `@isTest` classes. Increase via support case.
- HTTP callout req/resp size counts against heap.

## SOQL & SOSL Specifics

| Limit | Value |
|---|---|
| Max SOQL statement length | 100,000 characters |
| Max string in WHERE clause | 4,000 characters |
| Max junction IDs per query | 500 (returns MALFORMED_QUERY beyond) |
| Max SOQL results per request | 2,000 (API v28+) |
| OFFSET clause max | 2,000 rows |
| Child-to-parent relationships per query | max 55 |
| Parent-to-child relationships per query | max 20 |
| Relationship depth (e.g. `Contact.Account.Owner.Name`) | max 5 levels |
| Parent-to-child nesting via REST/SOAP/Apex (v58+) | max 5 levels (not for big objects / external objects / Bulk API) |
| Cursor / query locator result lifespan | 2 days |
| Max SOSL `SearchQuery` length | 10,000 chars (logical operators stripped above 4,000) |
| Max SOSL results | 2,000 (API v28+) |

## Flows

| Limit | Value |
|---|---|
| Interviews per transaction | 2,000 |
| Elements executed per interview | 2,000 |
| SOQL queries | Same as Apex (100/200) |
| DML statements | Same as Apex (150) |
| Scheduled paths per flow | 10 |
| Scheduled path time range | Up to 6 months |

## Data Storage

| Limit | Value |
|---|---|
| Record storage | Varies by edition + per-user allocation |
| File storage | Varies by edition + per-user allocation |
| Max records returned by report | 2,000 (UI), 2,000 (API) |
| Max report filters | 20 |
| Big Object max rows per insert | 100 |

## Commonly Hit Limits

These are the limits AI-generated code violates most frequently:

1. **SOQL 100 query limit** — #1 cause of production failures. Always bulkify.
2. **DML 150 statement limit** — Don't DML inside loops.
3. **CPU 10s limit** — Watch nested loops and complex string operations.
4. **50,000 row limit** — Always add WHERE clauses and LIMIT.
5. **Heap 6MB limit** — Don't load large datasets into memory. Use Batch Apex for large volumes.
