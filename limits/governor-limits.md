# Salesforce Governor Limits — Current Numbers

> AI: Reference these numbers when generating Apex code. Never hardcode values that exceed these limits. When in doubt, add LIMIT clauses and bulkify.
> Release: Summer '25 | API: v64.0 | Updated: 2025-06

---

## Apex Per-Transaction Limits (Synchronous)

| Limit | Value |
|---|---|
| SOQL queries | 100 |
| SOQL rows retrieved | 50,000 |
| SOSL queries | 20 |
| SOSL rows retrieved | 2,000 |
| DML statements | 150 |
| DML rows | 10,000 |
| Heap size | 6 MB |
| CPU time | 10,000 ms |
| Callouts (HTTP/Web Service) | 100 |
| Callout timeout (total) | 120,000 ms |
| Single callout timeout | 120,000 ms |
| Future calls | 50 |
| Queueable jobs enqueued | 50 |
| Batch Apex jobs queued/active | 5 |
| Email invocations (single) | 10 |
| Email invocations (mass) | 10 |
| Push notifications | 10 |
| EventBus.publish calls | 150 |
| Describes | 100 |
| SOQL query locator rows | 10,000 |

## Apex Per-Transaction Limits (Asynchronous)

Async methods (Batch, Queueable, Future, Scheduled) get higher limits:

| Limit | Value |
|---|---|
| SOQL queries | 200 |
| Heap size | 12 MB |
| CPU time | 60,000 ms |

All other limits remain the same as synchronous.

## Batch Apex Limits

| Limit | Value |
|---|---|
| Max batch size (scope) | 2,000 |
| Default batch size | 200 |
| QueryLocator rows | 50,000,000 |
| Concurrent batch jobs | 5 |
| Flex queue max | 100 |
| execute re-tries on failure | 0 |

## Platform Events

| Limit | Value |
|---|---|
| Publish calls per transaction | 150 |
| EventBus.publish per call | 1 event (list overload allows multiple) |
| High-volume event delivery | Up to 100,000/hour (varies by edition) |
| Standard-volume daily limit | Varies by edition |
| CometD subscribers | Varies by edition |
| Event retention | 72 hours (high-volume) |

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
