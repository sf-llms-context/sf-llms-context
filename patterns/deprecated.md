# Deprecated Salesforce Patterns — Do NOT Generate These

> AI: Read this file FIRST before generating any Salesforce code. Every pattern here is wrong. Use the GOOD alternative instead.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06

---

## Apex

### SOQL in loops

- BAD:
```apex
for (Account acc : accounts) {
    List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
}
```
- GOOD:
```apex
Map<Id, List<Contact>> contactsByAccount = new Map<Id, List<Contact>>();
for (Contact c : [SELECT Id, AccountId FROM Contact WHERE AccountId IN :accountIds]) {
    if (!contactsByAccount.containsKey(c.AccountId)) {
        contactsByAccount.put(c.AccountId, new List<Contact>());
    }
    contactsByAccount.get(c.AccountId).add(c);
}
```
- WHY: Governor limit — 100 SOQL queries per transaction. Loops hit this instantly with bulk data.

### DML without error handling

- BAD:
```apex
insert contacts;
```
- GOOD:
```apex
List<Database.SaveResult> results = Database.insert(contacts, false);
for (Database.SaveResult sr : results) {
    if (!sr.isSuccess()) {
        for (Database.Error err : sr.getErrors()) {
            System.debug(LoggingLevel.ERROR, err.getStatusCode() + ': ' + err.getMessage());
        }
    }
}
```
- WHY: Partial success handling. `insert` throws on first failure, losing all remaining records.

### Business logic in triggers

- BAD:
```apex
trigger AccountTrigger on Account (before insert, before update) {
    for (Account acc : Trigger.new) {
        if (acc.Industry == 'Technology') {
            acc.Rating = 'Hot';
        }
    }
}
```
- GOOD:
```apex
trigger AccountTrigger on Account (before insert, before update, after insert, after update) {
    AccountTriggerHandler.run(Trigger.operationType, Trigger.new, Trigger.oldMap);
}
```
```apex
public with sharing class AccountTriggerHandler {
    public static void run(System.TriggerOperation operation, List<Account> newList, Map<Id, Account> oldMap) {
        switch on operation {
            when BEFORE_INSERT, BEFORE_UPDATE {
                setRatingForTechAccounts(newList);
            }
        }
    }

    private static void setRatingForTechAccounts(List<Account> accounts) {
        for (Account acc : accounts) {
            if (acc.Industry == 'Technology') {
                acc.Rating = 'Hot';
            }
        }
    }
}
```
- WHY: One trigger per object. Logic in handler classes for testability and maintainability.

### Hardcoded Record Type IDs

- BAD:
```apex
acc.RecordTypeId = '012000000000001';
```
- GOOD:
```apex
acc.RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
    .get('Enterprise').getRecordTypeId();
```
- WHY: IDs differ between orgs and sandboxes. Hardcoded IDs break on deploy.

### Hardcoded IDs

- BAD:
```apex
Id priceBookId = '01s000000000001';
```
- GOOD:
```apex
Id priceBookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;
// Or use Custom Metadata Types for configurable IDs
MyConfig__mdt config = MyConfig__mdt.getInstance('Default');
Id priceBookId = config.PriceBookId__c;
```
- WHY: IDs are org-specific. Use queries, Custom Metadata Types, or Custom Labels.

### Missing explicit sharing declaration

- BAD:
```apex
public class AccountService {
    public List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }
}
```
- GOOD:
```apex
public with sharing class AccountService {
    public List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }
}
```
- WHY: Since API v67.0 (Summer '26), classes without an explicit sharing declaration default to `with sharing`. In v66.0 and earlier, they default to `without sharing`. Always declare sharing explicitly (`with sharing`, `without sharing`, or `inherited sharing`) to make intent clear and avoid behavior changes on API version upgrade.

### WITH SECURITY_ENFORCED (removed in v67.0)

- BAD:
```apex
List<Account> accounts = [SELECT Id, Name FROM Account WITH SECURITY_ENFORCED];
```
- GOOD:
```apex
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];
```
- WHY: `WITH SECURITY_ENFORCED` is removed in API v67.0+ — code using it will not compile. Use `WITH USER_MODE` instead. It has better error reporting (returns all FLS errors, not just the first) and handles polymorphic fields correctly.

### Database operations without explicit access mode

- BAD:
```apex
List<Account> accounts = [SELECT Id, Name FROM Account];
insert accounts;
```
- GOOD:
```apex
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];
insert as user accounts;
```
- WHY: Since API v67.0 (Summer '26), database operations default to User Mode — they enforce the current user's CRUD, FLS, and sharing. In v66.0 and earlier, they default to System Mode. Always set access mode explicitly (`WITH USER_MODE`/`WITH SYSTEM_MODE` for queries, `as user`/`as system` for DML) to make intent clear.

### String concatenation in SOQL

- BAD:
```apex
String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';
List<Account> accounts = Database.query(query);
```
- GOOD:
```apex
String query = 'SELECT Id FROM Account WHERE Name = :userInput';
List<Account> accounts = Database.query(query);
```
- WHY: SOQL injection vulnerability. Always use bind variables.

### Tests without bulk data

- BAD:
```apex
@isTest
static void testInsert() {
    Account acc = new Account(Name = 'Test');
    insert acc;
    System.assertNotEquals(null, acc.Id);
}
```
- GOOD:
```apex
@isTest
static void testInsertBulk() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 200; i++) {
        accounts.add(new Account(Name = 'Test ' + i));
    }
    insert accounts;
    System.assertEquals(200, [SELECT COUNT() FROM Account]);
}
```
- WHY: Triggers and automation fire on bulk operations. Testing with 1 record hides governor limit issues.

### @future for complex async

- BAD:
```apex
@future
public static void processRecords(Set<Id> recordIds) {
    // Can't chain, can't monitor, limited parameters
}
```
- GOOD:
```apex
public class RecordProcessor implements Queueable {
    private List<Id> recordIds;

    public RecordProcessor(List<Id> recordIds) {
        this.recordIds = recordIds;
    }

    public void execute(QueueableContext context) {
        // Can chain, can pass complex objects, can monitor via AsyncApexJob
    }
}
```
- WHY: Queueable supports chaining, complex parameters, and job monitoring. `@future` is fire-and-forget only.

### String concatenation for multiline text

- BAD:
```apex
String json = '{\n' +
    '  "Name": "' + acc.Name + '",\n' +
    '  "Type": "' + acc.Type + '"\n' +
    '}';
```
- GOOD:
```apex
String json = '''
{
  "Name": "${name}",
  "Type": "${type}"
}'''.template(new Map<String, Object>{
    'name' => acc.Name,
    'type' => acc.Type
});
```
- WHY: Apex now supports multiline strings (triple single quotes `'''`) and `String.template()` with named `${variable}` placeholders. Available in all API versions since Summer '26.

### Workflow Rules

- BAD: Creating or referencing Workflow Rules for field updates, email alerts, or outbound messages.
- GOOD: Use Flow Builder (Record-Triggered Flows) for all automation.
- WHY: Workflow Rules deprecated since Spring '23. Salesforce will remove them. Migrate existing ones with the Migrate to Flow tool.

### Process Builder

- BAD: Creating or referencing Process Builder for any automation.
- GOOD: Use Flow Builder (Record-Triggered Flows) for all automation.
- WHY: Process Builder deprecated since Spring '23. Cannot be created in new orgs. Migrate existing ones with the Migrate to Flow tool.

---

## LWC

### Aura components for new development

- BAD:
```html
<aura:component>
    <aura:attribute name="greeting" type="String" default="Hello"/>
    <p>{!v.greeting}</p>
</aura:component>
```
- GOOD:
```html
<template>
    <p>{greeting}</p>
</template>
```
```javascript
import { LightningElement } from 'lwc';
export default class MyComponent extends LightningElement {
    greeting = 'Hello';
}
```
- WHY: Aura is in maintenance mode. LWC is faster, uses web standards, and is the only actively developed component framework.

### Template expressions with JS logic

- BAD:
```html
<template>
    <p>{count + 1}</p>
    <p>{items.length > 0 ? 'Has items' : 'Empty'}</p>
</template>
```
- GOOD:
```html
<template>
    <p>{nextCount}</p>
    <template lwc:if={hasItems}>
        <p>Has items</p>
    </template>
</template>
```
```javascript
get nextCount() {
    return this.count + 1;
}
get hasItems() {
    return this.items.length > 0;
}
```
- WHY: LWC templates don't support JavaScript expressions. Use getter properties in the JS class.

### Direct DOM manipulation

- BAD:
```javascript
this.template.querySelector('.counter').textContent = this.count;
```
- GOOD:
```javascript
// Use reactive properties — the template re-renders automatically
this.count = newValue;
```
- WHY: LWC uses a reactive rendering model. Direct DOM manipulation bypasses it and causes state inconsistencies.

### Imperative Apex without error handling

- BAD:
```javascript
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

async connectedCallback() {
    this.accounts = await getAccounts();
}
```
- GOOD:
```javascript
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

async connectedCallback() {
    try {
        this.accounts = await getAccounts();
    } catch (error) {
        this.dispatchEvent(
            new ShowToastEvent({ title: 'Error', message: error.body.message, variant: 'error' })
        );
    }
}
```
- WHY: Apex calls fail (permissions, governor limits, network). Unhandled errors leave the component in a broken state.

### Deprecated template directives

- BAD:
```html
<template if:true={isVisible}>
    <p>Visible</p>
</template>
<template for:each={items} for:item="item">
    <p key={item.id}>{item.name}</p>
</template>
```
- GOOD:
```html
<template lwc:if={isVisible}>
    <p>Visible</p>
</template>
<template for:each={items} for:item="item">
    <p key={item.id}>{item.name}</p>
</template>
```
- WHY: `if:true` and `if:false` are deprecated since Spring '23. Use `lwc:if`, `lwc:elseif`, `lwc:else`.

---

## SOQL

### SELECT * (doesn't exist)

- BAD:
```sql
SELECT * FROM Account
```
- GOOD:
```sql
SELECT Id, Name, Industry, Rating FROM Account
```
- WHY: SOQL has no `SELECT *`. AI models hallucinate this. Always list fields explicitly.

### Queries without LIMIT

- BAD:
```sql
SELECT Id, Name FROM Account WHERE Industry = 'Technology'
```
- GOOD:
```sql
SELECT Id, Name FROM Account WHERE Industry = 'Technology' LIMIT 200
```
- WHY: Governor limit — 50,000 rows per transaction. Unbounded queries risk hitting this in production.

### Nested subqueries beyond 1 level

- BAD:
```sql
SELECT Id, (SELECT Id, (SELECT Id FROM Tasks) FROM Contacts) FROM Account
```
- GOOD:
```sql
// Query 1: Accounts with Contacts
SELECT Id, (SELECT Id FROM Contacts) FROM Account
// Query 2: Tasks for those contacts
SELECT Id, WhoId FROM Task WHERE WhoId IN :contactIds
```
- WHY: SOQL doesn't support nested subqueries beyond one level. This will throw a runtime error.

### COUNT() with other fields

- BAD:
```sql
SELECT Name, COUNT() FROM Account GROUP BY Name
```
- GOOD:
```sql
SELECT Name, COUNT(Id) cnt FROM Account GROUP BY Name
```
- WHY: `COUNT()` can't be mixed with other fields. Use `COUNT(fieldName)` with an alias in aggregate queries.

### Queries in loops

- BAD:
```apex
for (Account acc : accounts) {
    acc.Primary_Contact__c = [SELECT Id FROM Contact WHERE AccountId = :acc.Id LIMIT 1].Id;
}
```
- GOOD:
```apex
Map<Id, Contact> primaryContacts = new Map<Id, Contact>();
for (Contact c : [SELECT Id, AccountId FROM Contact WHERE AccountId IN :accountIds ORDER BY CreatedDate DESC]) {
    if (!primaryContacts.containsKey(c.AccountId)) {
        primaryContacts.put(c.AccountId, c);
    }
}
for (Account acc : accounts) {
    Contact primary = primaryContacts.get(acc.Id);
    if (primary != null) {
        acc.Primary_Contact__c = primary.Id;
    }
}
```
- WHY: Same as SOQL-in-loops above. Query once, filter in memory.

---

## Flow

### BEFORE + AFTER in one Record-Triggered Flow

- BAD: A single Record-Triggered Flow that runs in both Before Save and After Save context.
- GOOD: Create two separate Record-Triggered Flows — one for Before Save, one for After Save.
- WHY: Since Spring '24, combining BEFORE and AFTER in one flow causes unexpected order-of-execution issues. Salesforce recommends separating them.

### Get Records inside loops

- BAD: A Loop element containing a Get Records element.
- GOOD: Use Get Records before the Loop. Use a Collection Filter or Assignment to process data inside the loop.
- WHY: Each Get Records inside a loop counts against the SOQL governor limit. Same principle as SOQL-in-loops in Apex.

### No fault paths

- BAD: Flow with DML or callout elements but no Fault connectors.
- GOOD: Add Fault connectors on every Create/Update/Delete/Callout element. Route to a Screen or Platform Event that logs the error.
- WHY: Flows fail silently in production without fault paths. Users see a generic error page with no actionable information.

### Auto-Launched Flows for record triggers

- BAD: Creating an Auto-Launched Flow and wiring it via Process Builder or Workflow Rule.
- GOOD: Use Record-Triggered Flows directly.
- WHY: Process Builder and Workflow Rules are deprecated. Record-Triggered Flows are the native replacement with better performance and debugging.

---

## API

### Outdated API versions

- BAD: Using API version below v67.0 in any new code, metadata, or integration.
- GOOD: Use API version v67.0 (Summer '26) for all new work.
- WHY: API versions 31.0–40.0 are being retired in Summer '26. Old API versions miss security fixes, new features, and the v67.0 security model improvements (User Mode by default, sharing by default). Salesforce actively retires old versions.

### SOAP API for new integrations

- BAD: Using SOAP API (enterprise.wsdl / partner.wsdl) for new integrations.
- GOOD: Use REST API for real-time operations. Use Bulk API 2.0 for data loading (>2,000 records).
- WHY: SOAP API is legacy. REST API is simpler, supports JSON, and has better tooling. Additionally, SOAP API `login()` call for versions 31.0–64.0 is being retired in Summer '27.

### Bulk API 1.0

- BAD: Using Bulk API 1.0 (XML batches, `/job` endpoint).
- GOOD: Use Bulk API 2.0 (`/jobs/ingest` endpoint, CSV upload).
- WHY: Bulk API 2.0 is simpler (no batch management), supports CSV natively, and handles retry automatically.

### Composite API without limits awareness

- BAD: Sending >25 subrequests in a single Composite API call without checking limits.
- GOOD: Batch subrequests into groups of 25. Use `allOrNone` parameter for transaction control.
- WHY: Composite API maximum is 25 subrequests per call. Exceeding this returns an error.

### Standard Volume Platform Events

- BAD: Creating or using Standard Volume Platform Events.
- GOOD: Use High Volume Platform Events. Migrate existing ones with the Salesforce migration tool (Tooling API or Metadata API).
- WHY: Standard Volume Platform Events are no longer supported starting Winter '27. Migrate before then — unmigrated events will stop working.

### OAuth 2.0 username-password flow

- BAD: Using the OAuth 2.0 username-password flow for Connected App integrations.
- GOOD: Use the OAuth 2.0 web-server flow (authorization code) or client credentials flow.
- WHY: Username-password flow is being retired in Winter '27. It bypasses MFA and is a security risk.

### Salesforce to Salesforce

- BAD: Using Salesforce to Salesforce for org-to-org data sharing.
- GOOD: Use Partner Cloud, Data Cloud, MuleSoft Anypoint, or MuleSoft for Flow.
- WHY: Salesforce to Salesforce is being retired in Spring '27.

---

## General Tooling

### Metadata API for simple deployments

- BAD: Using Metadata API directly or Ant Migration Tool for deployments.
- GOOD: Use Salesforce CLI: `sf project deploy start --source-dir force-app`
- WHY: Ant Migration Tool is deprecated. Salesforce CLI (sf) is the current standard for all deployments.

### Force.com IDE

- BAD: Using Force.com IDE, MavensMate, or Illuminated Cloud 1.
- GOOD: Use VS Code + Salesforce Extension Pack.
- WHY: Force.com IDE discontinued in 2018. VS Code is the only officially supported IDE for Salesforce development.

### Classic UI development

- BAD: Building Visualforce pages, JavaScript buttons, or S-Controls for new functionality.
- GOOD: Build with LWC (Lightning Web Components). Use Visualforce only for edge cases not yet supported in Lightning.
- WHY: Salesforce Classic is in maintenance mode. Lightning Experience is the standard UI platform.
