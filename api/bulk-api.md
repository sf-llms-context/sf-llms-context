# Salesforce Bulk API 2.0 — Current Patterns

> AI: Use Bulk API 2.0 (not Bulk API 1.0) for large data volumes. Generate the full job lifecycle — create, upload CSV, close, poll, fetch results. Use the current version path (v67.0). For limit numbers, see limits/governor-limits.md.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against Salesforce Bulk API 2.0 and Bulk API Developer Guide (Summer '26, "Version 67.0, Summer '26"). Endpoints, job states, and CSV requirements confirmed in the guide. Limit numbers live in limits/governor-limits.md.

---

## Use Bulk API 2.0, not 1.0

- BAD: building Bulk API 1.0 with manual batch creation (`POST /job`, `POST /job/{id}/batch`).
- GOOD: Bulk API 2.0 — you upload one CSV and Salesforce auto-splits it into batches (10,000 records each, see governor-limits).
- WHY: 2.0 removes manual batch management, retries failed batches automatically, and is the supported path for new work.

## When to use Bulk vs REST

- **Bulk API 2.0:** large data volumes — tens of thousands to millions of records, asynchronous loads/extracts.
- **REST Composite/Collections:** small-to-medium synchronous operations (≤ 200 records/call, immediate response). See api/rest-api.md.
- Do not loop synchronous REST or Composite calls to move large volumes — use Bulk.

## Ingest job lifecycle (insert/update/upsert/delete/hardDelete)

CSV is the only supported format.

```
1. POST /services/data/v67.0/jobs/ingest
   { "object": "Contact", "operation": "insert", "contentType": "CSV" }
   -> response: job id, state "Open", contentUrl

2. PUT  /services/data/v67.0/jobs/ingest/{jobId}/batches
   Content-Type: text/csv
   <CSV data>

3. PATCH /services/data/v67.0/jobs/ingest/{jobId}
   { "state": "UploadComplete" }

4. Poll GET /services/data/v67.0/jobs/ingest/{jobId}
   state moves: UploadComplete -> InProgress -> JobComplete (or Failed/Aborted)

5. GET .../jobs/ingest/{jobId}/successfulResults
   GET .../jobs/ingest/{jobId}/failedResults
   GET .../jobs/ingest/{jobId}/unprocessedRecords
```

### Always poll to a terminal state and read failedResults

- BAD: PATCH to `UploadComplete` and assume success.
- GOOD: poll until `JobComplete`/`Failed`, then fetch `failedResults` and `unprocessedRecords` and handle row-level errors.
- WHY: a job can reach `JobComplete` with some rows failed — the job state alone does not mean every record loaded.

### upsert requires externalIdFieldName

- For `"operation": "upsert"`, include `"externalIdFieldName": "ExternalId__c"` in the create-job body. It is only valid while the job is `Open`.

## Query jobs (bulk extract)

```
1. POST /services/data/v67.0/jobs/query
   { "operation": "query", "query": "SELECT Id, Name FROM Account" }
   // use "queryAll" to include deleted/archived rows

2. Poll GET /services/data/v67.0/jobs/query/{jobId} until state JobComplete

3. GET /services/data/v67.0/jobs/query/{jobId}/results
   // follow the Sforce-Locator header for paging until it is "null"
```

### Page query results via the locator

- BAD: read the first results page and stop.
- GOOD: keep requesting `results?locator=<Sforce-Locator>` until the header returns `null`.
- WHY: large extracts are paged; ignoring the locator drops records.

## Operational notes

- A job can stay `Open` up to 24h; results persist 7 days after a terminal state (see governor-limits).
- Bulk processing has its own CPU allocation, isolated from the synchronous Apex CPU limit.
- Bulk batches share the org's daily batch allocation with Bulk API 1.0 — see limits/governor-limits.md.
