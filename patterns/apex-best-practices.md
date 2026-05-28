# Apex Best Practices — Current Patterns

> AI: Use these patterns when generating Apex code. These are the current recommended approaches for Summer '26.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06

---

## Trigger Framework

### One trigger per object, logic in handler class

```apex
trigger OpportunityTrigger on Opportunity (
    before insert, before update, before delete,
    after insert, after update, after delete, after undelete
) {
    OpportunityTriggerHandler.run(Trigger.operationType, Trigger.new, Trigger.old, Trigger.newMap, Trigger.oldMap);
}
```

```apex
public with sharing class OpportunityTriggerHandler {
    public static void run(
        System.TriggerOperation operation,
        List<Opportunity> newList,
        List<Opportunity> oldList,
        Map<Id, Opportunity> newMap,
        Map<Id, Opportunity> oldMap
    ) {
        switch on operation {
            when BEFORE_INSERT {
                setDefaults(newList);
            }
            when AFTER_INSERT {
                createRelatedRecords(newList);
            }
            when BEFORE_UPDATE {
                validateChanges(newList, oldMap);
            }
            when AFTER_UPDATE {
                syncExternalSystem(newList, oldMap);
            }
        }
    }

    private static void setDefaults(List<Opportunity> opps) { /* ... */ }
    private static void createRelatedRecords(List<Opportunity> opps) { /* ... */ }
    private static void validateChanges(List<Opportunity> opps, Map<Id, Opportunity> oldMap) { /* ... */ }
    private static void syncExternalSystem(List<Opportunity> opps, Map<Id, Opportunity> oldMap) { /* ... */ }
}
```

Note: Triggers always run in System Mode (all API versions). The handler class enforces sharing and access control. Always declare `with sharing`, `without sharing`, or `inherited sharing` explicitly on handler classes — since API v67.0, omitting the declaration defaults to `with sharing`.

---

## Bulkification

### Use Maps for record lookups

```apex
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name, Industry FROM Account WHERE Id IN :accountIds]
);

for (Contact c : contacts) {
    Account acc = accountMap.get(c.AccountId);
    if (acc != null && acc.Industry == 'Technology') {
        c.Tech_Account__c = true;
    }
}
```

### Use Sets for ID collections

```apex
Set<Id> accountIds = new Set<Id>();
for (Contact c : Trigger.new) {
    accountIds.add(c.AccountId);
}
// One query for all contacts
List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id IN :accountIds];
```

### Collect DML into lists

```apex
List<Task> tasksToInsert = new List<Task>();
for (Opportunity opp : opportunities) {
    tasksToInsert.add(new Task(
        WhatId = opp.Id,
        Subject = 'Follow up',
        ActivityDate = Date.today().addDays(7)
    ));
}
insert tasksToInsert;
```

---

## Database Methods vs DML Statements

### Use Database methods for partial success

```apex
List<Database.SaveResult> results = Database.insert(records, false);
for (Database.SaveResult sr : results) {
    if (!sr.isSuccess()) {
        for (Database.Error err : sr.getErrors()) {
            System.debug(LoggingLevel.ERROR, err.getStatusCode() + ': ' + err.getMessage());
        }
    }
}
```

### Use DML statements when all-or-nothing is required

```apex
Savepoint sp = Database.setSavepoint();
try {
    insert parentRecord;
    insert childRecords;
} catch (DmlException e) {
    Database.rollback(sp);
    throw e;
}
```

---

## Async Patterns

### Queueable — default choice for async

```apex
public class DataSyncJob implements Queueable, Database.AllowsCallouts {
    private List<Id> recordIds;

    public DataSyncJob(List<Id> recordIds) {
        this.recordIds = recordIds;
    }

    public void execute(QueueableContext context) {
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id IN :recordIds];
        // Process and optionally chain
        if (!remainingIds.isEmpty()) {
            System.enqueueJob(new DataSyncJob(remainingIds));
        }
    }
}
// Enqueue
System.enqueueJob(new DataSyncJob(recordIds));
```

### Batch — for processing large data volumes (>50k records)

```apex
public class AccountCleanupBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id, Name FROM Account WHERE IsCleanedUp__c = false');
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        for (Account acc : scope) {
            acc.IsCleanedUp__c = true;
        }
        update scope;
    }

    public void finish(Database.BatchableContext bc) {
        System.debug('Batch complete');
    }
}
// Execute with batch size of 200
Database.executeBatch(new AccountCleanupBatch(), 200);
```

### Schedulable — for recurring jobs

```apex
public class WeeklyReportScheduler implements Schedulable {
    public void execute(SchedulableContext sc) {
        Database.executeBatch(new WeeklyReportBatch(), 200);
    }
}
// Schedule: every Monday at 6 AM
System.schedule('Weekly Report', '0 0 6 ? * MON', new WeeklyReportScheduler());
```

### When to use which

| Pattern | Use when |
|---|---|
| Queueable | Default async. Supports chaining, complex params, callouts |
| Batch | Processing >50k records. QueryLocator supports 50M rows |
| Schedulable | Recurring jobs on a cron schedule |
| @future | Simple fire-and-forget with primitive params only (avoid for new code) |
| Platform Events | Cross-boundary async, guaranteed delivery, event-driven architecture |

### Apex Cursors — flexible large dataset processing (GA, API v66.0+)

```apex
Database.Cursor cursor = Database.getCursor(
    'SELECT Id, Name FROM Account WHERE Industry = \'Technology\''
);
Integer totalSize = cursor.getNumRecords();

List<Account> chunk = (List<Account>) cursor.fetch(0, 200);

List<Account> nextChunk = (List<Account>) cursor.fetch(200, 200);
```

Use cursors when you need flexible random-access to large result sets without Batch Apex overhead. Cursors can be serialized and passed between Queueable jobs. Each `fetch()` counts against the SOQL query limit and rows fetched count against the row limit.

---

## Test Patterns

### TestDataFactory

```apex
@isTest
public class TestDataFactory {
    public static List<Account> createAccounts(Integer count) {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < count; i++) {
            accounts.add(new Account(Name = 'Test Account ' + i));
        }
        insert accounts;
        return accounts;
    }

    public static List<Contact> createContacts(List<Account> accounts, Integer perAccount) {
        List<Contact> contacts = new List<Contact>();
        for (Account acc : accounts) {
            for (Integer i = 0; i < perAccount; i++) {
                contacts.add(new Contact(
                    FirstName = 'Test',
                    LastName = 'Contact ' + i,
                    AccountId = acc.Id
                ));
            }
        }
        insert contacts;
        return contacts;
    }
}
```

### @TestSetup for shared test data

```apex
@isTest
private class OpportunityServiceTest {
    @TestSetup
    static void setup() {
        List<Account> accounts = TestDataFactory.createAccounts(5);
        TestDataFactory.createContacts(accounts, 2);
    }

    @isTest
    static void testBulkInsert() {
        List<Account> accounts = [SELECT Id FROM Account];
        List<Opportunity> opps = new List<Opportunity>();
        for (Account acc : accounts) {
            opps.add(new Opportunity(
                AccountId = acc.Id,
                Name = 'Test Opp',
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(30)
            ));
        }

        Test.startTest();
        insert opps;
        Test.stopTest();

        System.assertEquals(5, [SELECT COUNT() FROM Opportunity]);
    }
}
```

### Test.startTest() / Test.stopTest() resets governor limits

Always wrap the method under test in `Test.startTest()` / `Test.stopTest()` to get a fresh set of governor limits and to force async jobs to complete synchronously.

---

## Security — Access Modes (Summer '26 / API v67.0)

Since API v67.0, database operations run in **User Mode by default** — they enforce the current user's CRUD, FLS, and sharing. In v66.0 and earlier, they default to System Mode. Always set access mode explicitly.

### SOQL/SOSL — WITH USER_MODE / WITH SYSTEM_MODE

```apex
List<Account> accounts = [
    SELECT Id, Name, Phone
    FROM Account
    WHERE Industry = 'Technology'
    WITH USER_MODE
];
```

Use `WITH SYSTEM_MODE` only when intentionally bypassing security (e.g., system-level operations).

Note: `WITH SECURITY_ENFORCED` is removed in API v67.0 — it will not compile. Use `WITH USER_MODE` instead.

### DML — as user / as system

```apex
Account acc = new Account(Name = 'Acme');
insert as user acc;

update as system systemRecord;
```

For Database methods, use the `AccessLevel` parameter:

```apex
Database.insert(records, false, AccessLevel.USER_MODE);
List<Account> results = Database.query(
    'SELECT Id, Name FROM Account WHERE Rating = \'Hot\'',
    AccessLevel.USER_MODE
);
```

### Security.stripInaccessible()

```apex
List<Account> accounts = [SELECT Id, Name, Phone, Revenue__c FROM Account WITH SYSTEM_MODE];
SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, accounts);
List<Account> sanitized = decision.getRecords();
```

Silently removes inaccessible fields instead of throwing. Use when you need System Mode query results filtered for a specific user's access.

### Sharing declarations — always explicit

```apex
public with sharing class AccountService { /* enforces sharing rules */ }
public without sharing class SystemService { /* bypasses sharing — use sparingly */ }
public inherited sharing class UtilityClass { /* inherits from caller */ }
```

Since API v67.0, classes without an explicit sharing declaration default to `with sharing`. Always declare it explicitly to avoid behavior changes on API version upgrade.

---

## Custom Metadata Types for Configuration

```apex
List<Integration_Setting__mdt> settings = Integration_Setting__mdt.getAll().values();
Integration_Setting__mdt apiConfig = Integration_Setting__mdt.getInstance('PaymentGateway');
String endpoint = apiConfig.Endpoint__c;
String apiKey = apiConfig.API_Key__c;
```

Use Custom Metadata Types instead of Custom Settings (Legacy) or hardcoded values. They are deployable, packageable, and editable in production.

---

## Platform Events

### Publishing

```apex
OrderEvent__e event = new OrderEvent__e(
    OrderId__c = order.Id,
    Action__c = 'CREATED'
);
Database.SaveResult sr = EventBus.publish(event);
```

### Subscribing (Apex trigger)

```apex
trigger OrderEventTrigger on OrderEvent__e (after insert) {
    List<Task> tasks = new List<Task>();
    for (OrderEvent__e event : Trigger.new) {
        tasks.add(new Task(
            Subject = 'Process Order: ' + event.OrderId__c,
            Status = 'New'
        ));
    }
    insert tasks;
}
```

Use Platform Events for:
- Cross-system async communication
- Loosely coupled integrations
- Event-driven architecture
- Logging from triggers (commit-independent)

---

## Exception Handling

```apex
public with sharing class OrderService {
    public class OrderServiceException extends Exception {}

    public static Order__c createOrder(Id accountId, List<OrderItem> items) {
        if (items == null || items.isEmpty()) {
            throw new OrderServiceException('Order must have at least one item');
        }

        Savepoint sp = Database.setSavepoint();
        try {
            Order__c order = new Order__c(Account__c = accountId, Status__c = 'Draft');
            insert order;

            List<OrderLineItem__c> lineItems = new List<OrderLineItem__c>();
            for (OrderItem item : items) {
                lineItems.add(new OrderLineItem__c(
                    Order__c = order.Id,
                    Product__c = item.productId,
                    Quantity__c = item.quantity
                ));
            }
            insert lineItems;

            return order;
        } catch (DmlException e) {
            Database.rollback(sp);
            throw new OrderServiceException('Failed to create order: ' + e.getMessage());
        }
    }
}
```

Custom exception classes for each service. Use Savepoints for multi-step DML. Catch specific exceptions, not generic `Exception`.

---

## Multiline Strings and String Interpolation (Summer '26)

### Multiline strings

```apex
String json = '''
{
    "name": "John Doe",
    "type": "New Customer"
}''';
```

Use triple single quotes (`'''`) to declare strings spanning multiple lines. Available in all API versions since Summer '26.

### String.template() — named variable interpolation

```apex
String body = '''
{
    "Account": "${accountName}",
    "Updated": "${date}"
}'''.template(new Map<String, Object>{
    'accountName' => acc.Name,
    'date' => DateTime.now()
});
```

Use `String.template()` with named `${variable}` placeholders instead of `String.format()` with index-based `{0}` placeholders. Keys map to descriptive names, making the code easier to read and maintain.
