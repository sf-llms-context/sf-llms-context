# Flow Best Practices — Current Patterns

> AI: Use these patterns when designing Flow Builder automations. Flow is the only declarative automation tool — Workflow Rules and Process Builder are retired.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06

---

## Choose the Right Flow Type

| Type | When to use |
|---|---|
| **Record-Triggered Flow** | Logic that runs when a record is created, updated, or deleted. Replaces Workflow Rules and Process Builder. |
| **Schedule-Triggered Flow** | Recurring batch logic (daily/weekly cleanup, scheduled syncs). Replaces Schedulable Apex for simple cases. |
| **Platform Event–Triggered Flow** | Subscribe to platform events for event-driven integrations. |
| **Screen Flow** | Multi-step UI wizards, embedded in Lightning pages or community sites. |
| **Autolaunched Flow (no trigger)** | Called from Apex, REST, subflow, action button. Reusable business logic. |
| **Approval Process** | (deprecated for new work — model approvals in Record-Triggered Flow with custom fields or Approvals in Flow.) |

---

## Record-Triggered Flow — Choose the Right Stage

### Before-save (Fast Field Updates)

Use when the flow **only updates fields on the triggering record itself**. Runs ~10× faster than after-save and avoids extra DML.

```
Trigger: A record is updated
Optimize for: Fast Field Updates
Run flow when: A record is created or updated
Entry condition: Status = 'Closed Won'

Steps:
1. Decision: Was Amount changed?
2. Assignment: $Record.Commission__c = $Record.Amount * 0.1
   (No "Update Records" element needed — the change is saved automatically)
```

Before-save flows **cannot**:
- Make callouts
- Send emails
- Update related records
- Call subflows that do any of the above

### After-save (Actions and Related Records)

Use when you need to update related records, create new records, send emails, or call Apex.

```
Trigger: A record is updated
Optimize for: Actions and Related Records
Run flow when: A record is created or updated

Steps:
1. Decision: Was StageName changed to 'Closed Won'?
2. Get Records: Contacts where AccountId = $Record.AccountId
3. Loop: For each contact, add to "high-value contacts" collection
4. Update Records: Apply collection (one DML for all contacts)
```

### Async Path

Use for callouts and long-running logic. The async path runs after the original transaction commits, so it has its own governor limits and can make callouts.

---

## Bulkification

Flow auto-bulkifies records that trigger the same flow in one transaction. **Your job: don't break it with DML inside loops.**

```
❌ BAD — DML inside loop = 1 SOQL/DML per iteration

Loop: For each opportunity in collection
    └── Get Records: Account where Id = currentOpportunity.AccountId
    └── Update Records: Set Account.Last_Opp_Date__c
End Loop
```

```
✅ GOOD — collect, then bulk DML

Loop: For each opportunity in collection
    └── Assignment: Add { Id: opp.AccountId, Last_Opp_Date__c: TODAY }
                    to accountsToUpdate collection
End Loop
Update Records: accountsToUpdate (one DML, all records)
```

Same principle for Get Records: collect IDs in a Set first, then make one `Get Records WHERE Id IN <collection>` call.

---

## Fault Paths

Every Get/Create/Update/Delete element can fail (validation rule, FLS, lock contention). Add a Fault Path so errors don't surface to the user as a cryptic "An unhandled fault has occurred."

```
Update Records (Opportunity)
    ├── Normal path → continue flow
    └── Fault path
        ├── Assignment: errorMessage = $Flow.FaultMessage
        ├── Action: Send custom error email to admin
        └── End
```

Read `$Flow.FaultMessage` inside the fault path to capture the actual error.

---

## $Record vs $Record__Prior

In update-triggered flows, you can compare the new and old values:

```
Decision: Did StageName change to 'Closed Won'?
    Condition: $Record.StageName = 'Closed Won'
           AND $Record__Prior.StageName != 'Closed Won'
```

Use `$Record__Prior` for "field was X, now Y" patterns to avoid running the same logic every time the record is touched.

For new records, `$Record__Prior` is null — guard with a "Run flow when: A record is updated" entry condition or check `IsNew()` style logic.

---

## Subflows

Move reusable logic into autolaunched flows and call them from other flows. Keeps individual flows readable and makes logic testable.

```
Parent flow:
    Subflow: Calculate_Tax
        Input: amount = $Record.Amount, region = $Record.BillingCountry
        Output: taxAmount → set on $Record.Tax__c
```

Subflow inputs/outputs are declared in the called flow's Start element under "Manage Variables → Available for input/output."

---

## Get Records Patterns

### Filter what you need

```
❌ Get Records: All Accounts → Loop → check Industry in flow
✅ Get Records: Accounts WHERE Industry = 'Technology' AND IsActive__c = TRUE
```

### Cap the result size

Add a "Sort and limit number of records returned" of N records, or use a tight WHERE clause. Each Get Records can return up to 50,000 rows but counts against the per-transaction 50,000 SOQL row limit.

### Store only fields you use

In Get Records → "How to store record data" → choose specific fields. Reduces heap and improves performance.

---

## Custom Metadata over Hardcoded Values

```
❌ Decision: Discount > 0.20 → Manager approval
✅ Decision: Discount > {!$CustomMetadata.Approval_Settings__mdt.Default.Max_Discount__c}
```

Custom Metadata Type queries don't count against SOQL governor limits. Use them for:
- Threshold values (max discount, late fee)
- Email recipients per region
- Feature flags
- API endpoints / configuration

---

## Don't Mix Flow and Apex on the Same Operation

If a record is updated by both an Apex trigger and a record-triggered flow, **execution order is not guaranteed in all cases**. Pick one tool per object per operation. Document the choice in the flow description or trigger comment.

Order of execution (relevant portions):
1. System validation rules
2. Before-save flows (record-triggered)
3. Before triggers (Apex)
4. Custom validation rules
5. After triggers (Apex)
6. Assignment rules → auto-response → workflow rules (legacy)
7. After-save flows (record-triggered)
8. Async paths and time-based actions

---

## When to Use Flow vs Apex

| Use Flow when | Use Apex when |
|---|---|
| Logic is declarative and a non-dev needs to read/maintain it | Logic is algorithmic (loops with complex conditions, math) |
| Same-record field updates (before-save) | Recursive operations across object hierarchies |
| Simple cross-object updates | Complex SOQL (aggregates, polymorphic, dynamic queries) |
| Scheduled batch under 200 records per batch | Bulk processing > 10,000 records (Batch Apex) |
| Calling REST endpoints via HTTP Callout Action | Custom REST/SOAP integrations |
| Approval logic, branching workflows | Trigger frameworks, custom exception handling |

Rule of thumb: **start in Flow, escalate to Apex when Flow becomes brittle or unreadable.**

---

## Schedule-Triggered Flow vs Scheduled Path

**Schedule-Triggered Flow** — runs on a schedule (daily/weekly) against a filtered set of records. Replaces Schedulable Apex for record-iteration jobs.

```
Trigger: Daily at 2:00 AM
Run for: Account where Health_Score__c < 50 AND LastModifiedDate < LAST_N_DAYS:30
Action: Send "we miss you" email, create follow-up Task
```

Limits: max 200 records per execution per scheduled time. For higher volume, use Batch Apex.

**Scheduled Path** (inside Record-Triggered Flow) — runs an action N hours/days **after** a record event.

```
Trigger: After Opportunity is created
Path: 7 days after CreatedDate
Action: If StageName still = 'Prospecting', send nudge email
```

Use Scheduled Paths instead of Time-Dependent Workflow Actions (Workflow Rules are retired).

---

## Screen Flows — Reactive Components (Spring '24+)

Screen components react to changes in other components on the same screen without a Next-button reload.

```
Screen "Quote Builder":
    Component A: Number input "Quantity"
    Component B: Number input "Unit Price"
    Component C: Display Text — value: {!Quantity} × {!UnitPrice} = {!Quantity * UnitPrice}
```

Component C re-renders as Quantity/UnitPrice change. Available on Lightning App and Experience Builder pages.

---

## HTTP Callout Actions (Spring '23+)

Call REST APIs without writing Apex. Define a Named Credential + External Service or use the HTTP Callout action directly.

```
Action: HTTP Callout
Named Credential: Stripe_API
Method: POST
Endpoint: /v1/charges
Request body: { amount: {!$Record.Amount}, currency: 'usd', source: {!stripeToken} }
Response: Stripe_Charge_Response (typed via JSON sample)
```

Use HTTP Callouts for simple integrations. Drop to Apex when you need OAuth flows, retries with backoff, or complex error mapping.

---

## Naming and Documentation

| Element type | Naming convention |
|---|---|
| Flow API name | `<Object>_<Trigger>_<Purpose>` — e.g., `Opportunity_AfterUpdate_SyncCommission` |
| Variable | camelCase — `accountToUpdate`, `errorMessages` |
| Decision outcome | Sentence describing the condition — `Is Closed Won` |
| Get Records element | `Get_<Object>_<Filter>` — `Get_Contacts_ByAccount` |
| Update Records element | `Update_<Object>_<Field>` — `Update_Account_Status` |

Always fill the **Description** field on the flow and on each element. Future-you and your teammates will thank you.

---

## Testing and Debug

- **Debug runs** — built-in. Provide sample record IDs and see element-by-element execution.
- **Flow Tests** (GA Winter '23) — declarative test cases stored with the flow. Cover positive paths, negative paths, and edge cases.
- **Salesforce DevOps Center** — version control and deployment for flows.

---

## Migrating Off Legacy Tools

### Process Builder

Process Builder was **retired in August 2025**. Existing processes still run, but no new ones can be created. Migrate using **Setup → Migrate to Flow**.

### Workflow Rules

Workflow Rules were **deprecated for new use in Winter '23** and are scheduled for end-of-life. Migrate using the same tool. Field updates → before-save flow; email alerts and outbound messages → after-save flow.

### Time-Dependent Workflow Actions

Convert to **Scheduled Paths** in a Record-Triggered Flow.

---

## Common AI-Generated Mistakes

| Mistake | Fix |
|---|---|
| Creating new Process Builder processes or Workflow Rules | Both are retired/deprecated. Use Record-Triggered Flow. |
| Suggesting "Workflow Rule" for field updates | Use a before-save Record-Triggered Flow. |
| DML inside a loop | Build a collection in the loop, DML once outside. |
| Missing fault paths on Create/Update/Delete | Add a fault path; capture `$Flow.FaultMessage`. |
| Hardcoded values in Decision conditions | Use Custom Metadata Type records. |
| After-save flow for same-record field updates | Use before-save (Fast Field Updates) — 10× faster, no extra DML. |
| Suggesting `if:true` / `if:false` syntax for Screen flows | Screen flows use Visibility rules, not LWC directives. |
| Get Records returning every field | Specify only the fields used downstream. |
| Logic split between Apex trigger AND record-triggered flow on the same object | Pick one. Document the choice. |
| Approval Process for new approval workflows | Build approvals with Flow + custom status fields, or use the modern Approvals in Flow feature. |
