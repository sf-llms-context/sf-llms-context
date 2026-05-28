# Apex Best Practices — Current Patterns

> AI: Use these patterns when generating Apex code. These are the current recommended approaches for Summer '25.
> Release: Summer '25 | API: v64.0 | Updated: 2025-06

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

## Security

### WITH SECURITY_ENFORCED

```apex
List<Account> accounts = [
    SELECT Id, Name, Phone
    FROM Account
    WHERE Industry = 'Technology'
    WITH SECURITY_ENFORCED
];
```

Throws `System.QueryException` if user lacks field/object access. Use for read operations where you want strict enforcement.

### Security.stripInaccessible()

```apex
List<Account> accounts = [SELECT Id, Name, Phone, Revenue__c FROM Account];
SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, accounts);
List<Account> sanitized = decision.getRecords();
```

Silently removes inaccessible fields instead of throwing. Use when you want graceful degradation.

### User mode database operations (Spring '23+)

```apex
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];
Database.insert(records, AccessLevel.USER_MODE);
```

Enforces CRUD, FLS, and sharing in a single declaration. Preferred for new code.

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
