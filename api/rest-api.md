# Salesforce REST API — Current Patterns

> AI: Use these patterns when generating REST API integrations against Salesforce. Always use the current version path (v67.0), OAuth 2.0, and a Composite/Collections resource instead of one HTTP call per record. For limit numbers, see limits/governor-limits.md.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against Salesforce REST API Developer Guide (Summer '26, "Version 67.0, Summer '26"). Resource names and limits confirmed in the guide. Limit numbers live in limits/governor-limits.md.

---

## Base path and auth

- Append the version path to your org's My Domain host (`*.my.salesforce.com`): `/services/data/v67.0/`
- Always pin the version in the path. A retired version (≤ v30.0) makes the call fail — see api/versions.md.
- Auth: OAuth 2.0 bearer token in the `Authorization: Bearer <token>` header.

### Never authenticate with username/password in code

- BAD: hardcoded username/password or the SOAP `login()` flow for new integrations (SOAP `login()` in v31.0–v64.0 is being retired in Summer '27).
- GOOD: OAuth 2.0 — Client Credentials or JWT Bearer flow for server-to-server, Authorization Code for user context.
- WHY: passwords in code are unrotatable and leak; the legacy login path is on a retirement clock.

## Query and pagination

### Always follow nextRecordsUrl — never assume one page

- BAD:
```
GET /services/data/v67.0/query?q=SELECT+Id+FROM+Contact
// ...then process only response.records and stop
```
- GOOD:
```
GET /services/data/v67.0/query?q=SELECT+Id+FROM+Contact
// loop while response.done == false:
GET <response.nextRecordsUrl>
```
- WHY: `query` returns a page (default batch 2,000, see governor-limits). Ignoring `nextRecordsUrl` silently drops records.
- Use `/queryAll` to include deleted/archived rows; `/query` excludes them.

## Bulkify with Composite resources — not N calls

One HTTP call per record burns the org's API allocation and is slow. Use the right composite resource for the shape of the work.

| Resource | Use for | Cap |
|---|---|---|
| `/composite/sobjects` (sObject Collections) | Same operation (insert/update/delete/upsert) on many records of possibly different types | 200 records |
| `/composite/batch` | Independent subrequests, no shared transaction | 25 subrequests |
| `/composite` | Dependent subrequests that reference each other's output (`@{ref.id}`) | 25 subrequests |
| `/composite/graph` | Large dependent graphs with isolated rollback per graph | 500 nodes |
| `/composite/tree` | Create one parent + its children in a single request | 200 records |

(See limits/governor-limits.md for the full Composite/Graph/Tree limit table.)

### Insert/update many records in one call

- BAD: a loop issuing `POST /sobjects/Contact/` once per Contact.
- GOOD:
```
POST /services/data/v67.0/composite/sobjects
{
  "allOrNone": true,
  "records": [
    { "attributes": {"type": "Contact"}, "LastName": "A" },
    { "attributes": {"type": "Contact"}, "LastName": "B" }
  ]
}
```
- Returns a list of `SaveResult` objects (up to 200). Set `allOrNone` to control partial-success vs full rollback.
- WHY: 1 call instead of N — far fewer API requests and round trips.

### Chain dependent operations in one round trip

- Use `/composite` when a later step needs an earlier step's result: reference it as `@{refId.id}` (e.g. create an Account, then a Contact on `@{newAccount.id}`) in a single request.

## When NOT to use REST

- For large data volumes (tens of thousands+ of records), use Bulk API 2.0 (api/bulk-api.md), not looped REST or Composite.
- REST sync calls have short concurrency caps for requests over 20s (see governor-limits) — long-running jobs belong in Bulk.
