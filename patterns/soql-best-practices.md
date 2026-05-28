# SOQL Best Practices — Current Patterns

> AI: Use these patterns when generating SOQL queries (Apex, LWC `@wire`, REST, Bulk API). Focus on selectivity, bulkification, and the User Mode security model introduced in v67.0.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06

---

## Selective Filters

A query is **selective** when its WHERE clause filters on an indexed field that returns < 10% of the records in the object (max 333,000 rows). Non-selective queries fail with `QueryException: Non-selective query against large object type` once the object exceeds ~200K records.

### Indexed fields (selective by default)

- `Id`, `Name`, `OwnerId`
- All foreign keys (lookup / master-detail)
- `RecordTypeId`
- `CreatedDate`, `SystemModstamp`, `LastModifiedDate`
- Audit fields: `CreatedById`, `LastModifiedById`
- External ID fields
- Unique fields
- Custom indexes (request from Salesforce Support)

### Filters that defeat indexes

```apex
// ❌ NOT selective — index can't be used
[SELECT Id FROM Account WHERE Name != 'Acme'];
[SELECT Id FROM Account WHERE NOT (Industry = 'Tech')];
[SELECT Id FROM Account WHERE Industry = NULL];
[SELECT Id FROM Account WHERE Phone LIKE '%555%'];        // leading wildcard
[SELECT Id FROM Account WHERE AnnualRevenue + 100 > 1000]; // expression on indexed field
[SELECT Id FROM Opportunity WHERE TotalAmount__c > 0];     // formula field
```

```apex
// ✅ Selective
[SELECT Id FROM Account WHERE Industry = 'Tech'];
[SELECT Id FROM Account WHERE Name LIKE 'Acme%'];          // trailing wildcard OK
[SELECT Id FROM Account WHERE CreatedDate = TODAY];
[SELECT Id FROM Opportunity WHERE Amount > 0];             // standard numeric field
```

### Check selectivity with the Query Plan tool

Use **Developer Console → Query Editor → Query Plan** (or REST API `/services/data/v67.0/query/?explain=...`) to see cost. Cost > 1.0 = not selective.

---

## Bind Variables (SOQL Injection Prevention)

```apex
// ❌ String concat — SOQL injection vulnerability
String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';
List<Account> accounts = Database.query(query);
```

```apex
// ✅ Bind variables in static SOQL
String accountName = userInput;
List<Account> accounts = [SELECT Id FROM Account WHERE Name = :accountName];

// ✅ Bind variables in dynamic SOQL (v54.0+)
Map<String, Object> binds = new Map<String, Object>{ 'accountName' => userInput };
List<Account> accounts = Database.queryWithBinds(
    'SELECT Id FROM Account WHERE Name = :accountName',
    binds,
    AccessLevel.USER_MODE
);

// ✅ Sanitize when concatenation is unavoidable (rare)
String safeInput = String.escapeSingleQuotes(userInput);
```

---

## User Mode (Security Enforcement)

Since API v67.0, query in **User Mode** to enforce CRUD, FLS, and sharing automatically. `WITH SECURITY_ENFORCED` is removed — use `WITH USER_MODE` (SOQL clause) or `AccessLevel.USER_MODE` (Apex parameter).

```apex
// ❌ Old patterns
[SELECT Id, Name FROM Account WITH SECURITY_ENFORCED];
Account a = Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Account]).getRecords()[0];
```

```apex
// ✅ Static SOQL with USER_MODE clause
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];

// ✅ Dynamic SOQL with AccessLevel
List<Account> accounts = Database.query(
    'SELECT Id, Name FROM Account',
    AccessLevel.USER_MODE
);

// ✅ System Mode when justified (no FLS/sharing)
List<Account> accounts = [SELECT Id, Name FROM Account WITH SYSTEM_MODE];
```

---

## Relationship Queries

### Parent-to-child (subqueries)

```apex
List<Account> accounts = [
    SELECT Id, Name,
        (SELECT Id, Email FROM Contacts WHERE Email != null)
    FROM Account
    WHERE Industry = 'Tech'
    LIMIT 100
];

for (Account acc : accounts) {
    for (Contact c : acc.Contacts) {
        // child records pre-loaded — no extra query
    }
}
```

Limits: max 20 parent-to-child relationships per query; max 5 levels deep (v58.0+).

### Child-to-parent (dot notation)

```apex
List<Contact> contacts = [
    SELECT Id, Name, Account.Name, Account.Owner.Name
    FROM Contact
    WHERE Account.Industry = 'Tech'
];
```

Limit: max 55 child-to-parent relationships per query.

### Polymorphic lookups (TYPEOF)

```apex
List<Task> tasks = [
    SELECT Id, Subject,
        TYPEOF What
            WHEN Account THEN Name, Industry
            WHEN Opportunity THEN Name, Amount, StageName
            ELSE Id
        END
    FROM Task
    WHERE What.Type IN ('Account', 'Opportunity')
];
```

---

## Aggregates

```apex
// COUNT
Integer total = [SELECT COUNT() FROM Account WHERE Industry = 'Tech'];

// GROUP BY with AggregateResult
List<AggregateResult> results = [
    SELECT Industry, COUNT(Id) cnt, SUM(AnnualRevenue) revenue
    FROM Account
    WHERE Industry != null
    GROUP BY Industry
    HAVING COUNT(Id) > 10
];

for (AggregateResult ar : results) {
    String industry = (String) ar.get('Industry');
    Integer count = (Integer) ar.get('cnt');
    Decimal revenue = (Decimal) ar.get('revenue');
}

// COUNT_DISTINCT
Integer distinctOwners = [SELECT COUNT_DISTINCT(OwnerId) FROM Account];

// GROUP BY ROLLUP / CUBE
List<AggregateResult> totals = [
    SELECT Industry, Type, COUNT(Id) cnt
    FROM Account
    GROUP BY ROLLUP(Industry, Type)
];
```

`HAVING` filters aggregated groups; `WHERE` filters rows before aggregation. Aggregate queries count against the SOQL query limit (1 query) but the rows returned count against the 50,000 row limit.

---

## Date Literals

```apex
[SELECT Id FROM Opportunity WHERE CloseDate = TODAY];
[SELECT Id FROM Opportunity WHERE CloseDate = YESTERDAY];
[SELECT Id FROM Opportunity WHERE CloseDate = THIS_WEEK];
[SELECT Id FROM Opportunity WHERE CloseDate = LAST_N_DAYS:30];
[SELECT Id FROM Opportunity WHERE CloseDate = NEXT_FISCAL_QUARTER];
[SELECT Id FROM Opportunity WHERE CreatedDate >= LAST_N_DAYS:7 AND CreatedDate <= TODAY];

// Bind a Date value
Date cutoff = Date.today().addDays(-30);
[SELECT Id FROM Account WHERE CreatedDate >= :cutoff];

// Bind a DateTime (note format: YYYY-MM-DDTHH:MM:SSZ when serialized)
Datetime since = Datetime.now().addHours(-1);
[SELECT Id FROM Account WHERE SystemModstamp >= :since];
```

Date literals are evaluated by the server in the user's locale/timezone. Don't construct date strings manually — use literals or bind variables.

---

## LIMIT, OFFSET, and Pagination

```apex
// ✅ Always cap result size when records aren't expected to be bounded
List<Account> recent = [SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 200];

// ⚠️ OFFSET is allowed but capped at 2,000 and slow for large datasets
List<Account> page2 = [SELECT Id FROM Account ORDER BY Id LIMIT 50 OFFSET 50];

// ✅ Keyset pagination — fast, no OFFSET cap
Id lastId = ...;
List<Account> nextPage = [
    SELECT Id, Name FROM Account
    WHERE Id > :lastId
    ORDER BY Id
    LIMIT 200
];
```

For paginating large result sets, prefer **Apex Cursors** (Spring '26, see below) over OFFSET.

---

## Cursors (Spring '26, API v66.0+)

Cursors let you query once and consume results in chunks across multiple transactions — without re-querying.

```apex
public class AccountProcessor implements Queueable {
    private Database.Cursor cursor;
    private Integer position;

    public AccountProcessor() {
        this.cursor = Database.getCursor(
            'SELECT Id, Name, AnnualRevenue FROM Account WHERE Industry = \'Tech\' ORDER BY Id'
        );
        this.position = 0;
    }

    public AccountProcessor(Database.Cursor cursor, Integer position) {
        this.cursor = cursor;
        this.position = position;
    }

    public void execute(QueueableContext ctx) {
        List<Account> chunk = (List<Account>) cursor.fetch(position, 200);
        if (chunk.isEmpty()) return;

        // process chunk
        for (Account acc : chunk) { /* ... */ }

        if (cursor.getNumRecords() > position + 200) {
            System.enqueueJob(new AccountProcessor(cursor, position + 200));
        }
    }
}
```

Use cursors when: result set > 50K rows but < 50M, you need precise control over chunk size, and Batch Apex granularity is too coarse. Limits: 50M rows per cursor, 100 `fetch()` calls per transaction, 10K cursors per 24h.

---

## Database.getQueryLocator (Batch Apex)

```apex
public class OldAccountCleanup implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Name, LastActivityDate
            FROM Account
            WHERE LastActivityDate < LAST_N_DAYS:365
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        // scope size set in executeBatch(job, scopeSize)
    }

    public void finish(Database.BatchableContext bc) {}
}
```

`Database.getQueryLocator` bypasses the 50,000 row limit (up to 50M rows). Use for Batch Apex only.

---

## FOR UPDATE (Pessimistic Locking)

```apex
// ✅ Lock records to prevent concurrent modification
List<Account> accounts = [
    SELECT Id, Status__c FROM Account
    WHERE Id IN :accountIds
    FOR UPDATE
];

for (Account acc : accounts) {
    acc.Status__c = 'Processed';
}
update accounts;
```

Use sparingly. `FOR UPDATE`:
- Blocks other transactions trying to lock the same rows (5-second timeout)
- Doesn't work with `ORDER BY`, `GROUP BY`, aggregate queries, or relationship queries
- Helps prevent lost-update races in concurrent triggers/queueable chains

---

## Picklist Labels and Currencies

```apex
// toLabel() — get translated picklist label instead of API value
List<Account> accounts = [
    SELECT Id, toLabel(Industry) IndustryLabel
    FROM Account
];

// FORMAT() — format numbers and dates per user locale
List<Opportunity> opps = [
    SELECT Id, FORMAT(Amount) AmountStr, FORMAT(CloseDate) CloseDateStr
    FROM Opportunity
];

// convertCurrency() — return values in user's currency (multi-currency orgs)
List<Opportunity> opps = [
    SELECT Id, convertCurrency(Amount) AmountInUserCurrency
    FROM Opportunity
];
```

---

## ALL ROWS (Including Deleted/Archived)

```apex
// Standard query — excludes soft-deleted records
Integer active = [SELECT COUNT() FROM Account];

// Include records in Recycle Bin + archived
Integer all = [SELECT COUNT() FROM Account ALL ROWS];
```

Use for audit/recovery flows only. `ALL ROWS` is incompatible with `FOR UPDATE`.

---

## USING SCOPE

```apex
// Records the running user owns
List<Account> mine = [SELECT Id FROM Account USING SCOPE Mine LIMIT 100];

// Records the running user has explicit access to
List<Account> delegated = [SELECT Id FROM Account USING SCOPE Delegated LIMIT 100];

// Records owned by the user or their subordinates in the role hierarchy
List<Account> team = [SELECT Id FROM Account USING SCOPE Team LIMIT 100];
```

`USING SCOPE` works without manual sharing filter logic — server handles ownership/hierarchy.

---

## SOSL vs SOQL

Use **SOSL** when you need full-text search across multiple object types; use SOQL when you know the object and want structured filtering.

```apex
// ✅ SOSL — searches indexed text fields across multiple objects
List<List<SObject>> results = [
    FIND 'Acme*' IN NAME FIELDS
    RETURNING Account(Id, Name), Contact(Id, Email), Opportunity(Id, StageName)
    LIMIT 50
];
List<Account> accounts = (List<Account>) results[0];
List<Contact> contacts = (List<Contact>) results[1];
List<Opportunity> opps = (List<Opportunity>) results[2];
```

SOSL limits per transaction: 20 queries, 2,000 rows per query.

---

## Common AI-Generated Mistakes

| Mistake | Fix |
|---|---|
| `SELECT * FROM Account` | SOQL has no `*`. List every field explicitly or use `Schema.SObjectType.Account.fields.getMap()` |
| Hardcoded RecordType IDs | Use `Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Partner').getRecordTypeId()` |
| Query in a `for` loop | Move query outside loop; build a Map<Id, Object> for lookups |
| Missing `LIMIT` on unbounded queries | Always add `LIMIT` for queries that may grow with data volume |
| `WHERE Id IN :hugeSet` with 10K+ ids | Batch the set into chunks of ≤200 IDs |
| Filtering on formula fields | Add a custom indexed field or restructure the data model |
| `ORDER BY` without indexed field | Sort in Apex after query, or index the sort field |
| String concat for dynamic SOQL | Use `Database.queryWithBinds` with a binds map |
