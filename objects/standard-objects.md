# Salesforce Standard Objects — What AI Gets Wrong

> AI: Read this before generating SOQL, DML, or schema code against standard objects. The API name, relationship, or field you assume is often not the real one. Verify against the org's Object Manager when unsure.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Stable Salesforce standard-object schema (not version-specific). These are common AI mistakes; confirm exact field/relationship names in the org's Object Manager or the SOAP API Object Reference.

---

## API names AI gets wrong

The label and the API name differ for several core objects. Querying the label fails.

- BAD: `Product`, `Pricebook`, `PricebookEntry` parent `Price`, `Opportunity Product`, `Quote Line`.
- GOOD:
  - Product → `Product2`
  - Price book → `Pricebook2`
  - Price book entry → `PricebookEntry` (links `Product2` + `Pricebook2`, holds `UnitPrice`)
  - Opportunity line item → `OpportunityLineItem`
  - Quote line item → `QuoteLineItem`
- WHY: the friendly label is not the queryable name. `[SELECT Id FROM Product]` throws — use `Product2`.

## Relationships AI gets wrong

### Opportunity has no Contact lookup

- BAD: `Opportunity.ContactId`, or `[SELECT Id FROM Opportunity WHERE ContactId = :cId]`.
- GOOD: relate Contacts to Opportunities through the junction `OpportunityContactRole` (`OpportunityId`, `ContactId`, `Role`, `IsPrimary`).
- WHY: there is no direct Opportunity→Contact field. The relationship is many-to-many via OpportunityContactRole.

### Contact's account is AccountId — but a Contact can relate to many accounts

- A Contact has one primary `AccountId`. Additional account relationships use `AccountContactRelation` (only when "Contacts to Multiple Accounts" is enabled).
- BAD: assuming a custom field for the "other" accounts.
- GOOD: query `AccountContactRelation` for non-primary links.

### Lead conversion writes three lookups on the Lead

- After `Database.convertLead`, the Lead carries `ConvertedAccountId`, `ConvertedContactId`, and `ConvertedOpportunityId` (Opportunity is optional).
- BAD: trying to "move" Lead fields manually, or re-querying by email to find the new records.
- GOOD: read the `Converted*` fields on the converted Lead.

## Polymorphic fields — the lookup points to more than one object

### OwnerId

- `OwnerId` is `User` on most objects (Account, Contact, Opportunity).
- On `Lead`, `Case`, and a few others it can be a `User` **or** a `Queue` (`Group` of type Queue).
- BAD: `[SELECT Owner.Email FROM Case]` assuming a User — fails when the owner is a Queue.
- GOOD: use `TYPEOF Owner WHEN User THEN Email WHEN Group THEN ... END`, or check `Owner.Type` before dereferencing user-only fields.

### Task / Event: WhoId and WhatId

- `WhoId` → a `Contact` or `Lead` (the "who").
- `WhatId` → an `Account`, `Opportunity`, `Case`, custom object, etc. (the "what").
- BAD: setting `WhatId` to a Contact, or `WhoId` to an Account.
- GOOD: WhoId = person (Contact/Lead), WhatId = related non-person record.

## Activities: Task and Event are real; "Activity" is not insertable

- BAD: `insert new Activity(...)` or `[SELECT Id FROM Activity]`.
- GOOD: create/query `Task` and `Event`. `ActivityHistory` and `OpenActivity` exist but are **read-only** roll-up objects queried only as child relationships (e.g. `(SELECT Subject FROM ActivityHistories)` from Account).
- WHY: `Activity` exists in Setup only as the shared place where Task/Event fields are defined — it is not a writable or directly queryable record object. Task and Event are the concrete types.

## Field gotchas

- **Name fields:** `Contact` and `Lead` use `FirstName` + `LastName` (LastName required); `Account` uses a single `Name`. There is no `Contact.Name` you can write to — `Name` is a read-only compound of First/Last.
- **Person Accounts:** when enabled, a "person account" is an Account row with Contact-style fields (`FirstName`, `LastName`, `PersonEmail`); `IsPersonAccount` flags it. Code that assumes Account always has a business `Name` and separate Contacts breaks.
- **System lookups:** `CreatedById`, `LastModifiedById`, `OwnerId` (when User) point to `User`. `CreatedDate`/`LastModifiedDate` are not writable.
- **RecordTypeId:** present on most standard objects; filter and set it by the record type's developer name, not its label.
