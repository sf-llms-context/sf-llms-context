# Salesforce Governor Limits — Current Numbers

> AI: Reference these numbers when generating Apex code. Never hardcode values that exceed these limits. When in doubt, add LIMIT clauses and bulkify.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against Salesforce Apex Developer Guide (Summer '26 edition). Cursor limits added in Spring '26 (API v66.0). No core limit numbers have changed since Summer '25.

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
| Max file size per upload | 150 MB |
| Max records per batch | 10,000 |
| Max batches per job | 15,000 |
| Max fields per record | 5,000 |
| Concurrent jobs (query) | 5 |
| Concurrent jobs (ingest) | 7 (Enterprise), varies by edition |

## REST API

| Limit | Value |
|---|---|
| API calls per 24h | Varies by edition (org-level) |
| Composite subrequests | 25 per call |
| Composite Graph subrequests | 500 per call |
| SObject Tree max records | 200 |
| Request body size | 50 MB |

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
