# LWC Best Practices — Current Patterns

> AI: Use these patterns when generating Lightning Web Components. Default to Lightning Data Service over imperative Apex, use the modern `lwc:if`/`lwc:ref` syntax, and respect Lightning Web Security.
> Release: Winter '27 | API: v68.0 | Updated: 2026-09

---

## Data Access — Prefer Lightning Data Service

LDS handles caching, FLS, sharing, and cache invalidation across components automatically. Reach for imperative Apex only when LDS can't model the operation.

### Reactive single record with `@wire(getRecord)`

```javascript
import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import NAME_FIELD from '@salesforce/schema/Account.Name';
import INDUSTRY_FIELD from '@salesforce/schema/Account.Industry';

export default class AccountSummary extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD, INDUSTRY_FIELD] })
    account;

    get name() {
        return getFieldValue(this.account.data, NAME_FIELD);
    }

    get industry() {
        return getFieldValue(this.account.data, INDUSTRY_FIELD);
    }
}
```

The `$` prefix makes `recordId` reactive — when it changes, the wire re-fires.

### Edit a record with `lightning-record-form` / `lightning-record-edit-form`

```html
<!-- Simplest: full LDS-managed form -->
<lightning-record-form
    record-id={recordId}
    object-api-name="Account"
    fields={fields}
    mode="edit">
</lightning-record-form>

<!-- More control: explicit field components, can wrap with custom layout -->
<lightning-record-edit-form record-id={recordId} object-api-name="Account">
    <lightning-input-field field-name="Name"></lightning-input-field>
    <lightning-input-field field-name="Industry"></lightning-input-field>
    <lightning-button type="submit" label="Save"></lightning-button>
</lightning-record-edit-form>
```

LDS-managed forms automatically refresh other components wired to the same record.

### Create / update / delete from JS

```javascript
import { createRecord, updateRecord, deleteRecord } from 'lightning/uiRecordApi';

async handleCreate() {
    const recordInput = {
        apiName: 'Account',
        fields: { Name: 'Acme', Industry: 'Technology' }
    };
    const account = await createRecord(recordInput);
    // LDS cache and any @wire(getRecord) on this record are updated automatically
}

async handleUpdate() {
    const fields = { Id: this.recordId, Industry: 'Finance' };
    await updateRecord({ fields });
}

async handleDelete() {
    await deleteRecord(this.recordId);
}
```

### When to use imperative Apex

Use imperative Apex calls when:
- The operation isn't a simple CRUD on a standard sObject (custom logic, multi-step workflows)
- You need a custom DTO shape
- You need a callout (LDS can't call external services)
- Aggregate or complex SOQL not expressible via LDS

```javascript
import { LightningElement, wire } from 'lwc';
import getTopAccounts from '@salesforce/apex/AccountController.getTopAccounts';

export default class TopAccounts extends LightningElement {
    @wire(getTopAccounts, { limitSize: 10 })
    accounts;
}
```

Apex method must be `@AuraEnabled(cacheable=true)` to be `@wire`-compatible. Methods with `cacheable=false` (or omitted) must be invoked imperatively.

---

## Imperative Apex Call

```javascript
import { LightningElement } from 'lwc';
import processOrder from '@salesforce/apex/OrderController.processOrder';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OrderProcessor extends LightningElement {
    async handleClick() {
        try {
            const result = await processOrder({ orderId: this.recordId });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: `Order ${result.orderNumber} processed`,
                variant: 'success'
            }));
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message ?? error.message,
                variant: 'error'
            }));
        }
    }
}
```

---

## Conditional Rendering — `lwc:if` / `lwc:elseif` / `lwc:else`

Use the modern directives. `if:true` / `if:false` were deprecated in v59.0 (Winter '24).

```html
<!-- ❌ Deprecated -->
<template if:true={isLoading}>...</template>
<template if:false={isLoading}>...</template>

<!-- ✅ Current -->
<template lwc:if={isLoading}>
    <lightning-spinner></lightning-spinner>
</template>
<template lwc:elseif={hasError}>
    <p class="slds-text-color_error">{errorMessage}</p>
</template>
<template lwc:else>
    <div>{content}</div>
</template>
```

---

## Template Expressions (GA in Winter '27, requires LWC API v68.0)

Complex JavaScript expressions are allowed directly in the template, anywhere a basic property is allowed.

```html
<template>
    <p>{count + 1}</p>
    <p>{user.firstName + ' ' + user.lastName}</p>
</template>
```

Rules:

- Requires `<apiVersion>68.0</apiVersion>` in the component's `.js-meta.xml`. Below v68.0 the template does not compile.
- Keep expressions short. A getter is still the better home for anything with branching, a loop, or a non-obvious name — the expression syntax removes boilerplate, it does not replace readable code.
- Do not rewrite existing working getters into expressions; there is no runtime benefit.

---

## Third-Party Web Components — `lwc:external` (GA in Winter '27)

Render a third-party custom element natively instead of rewriting it as an LWC.

```html
<template>
    <my-chart lwc:external data-id="revenue"></my-chart>
</template>
```

- The component must be registered as a real custom element before use (for example from a static resource loaded in `connectedCallback`).
- Without `lwc:external`, LWC treats an unknown tag as a compile error.
- The element still runs under Lightning Web Security — check the library for `window`-level global access.

---

## Iteration — `for:each` and `iterator`

```html
<template for:each={accounts} for:item="acc" for:index="idx">
    <li key={acc.Id}>{idx}: {acc.Name}</li>
</template>

<!-- iterator gives you isFirst/isLast for separators -->
<template iterator:it={accounts}>
    <li key={it.value.Id}>
        <span lwc:if={it.first}>★ </span>
        {it.value.Name}
        <span lwc:if={it.last}>(last)</span>
    </li>
</template>
```

`key` must be unique and stable. Don't use array index as key — re-renders break.

---

## Querying the DOM — `lwc:ref`

`lwc:ref` (Winter '24+) replaces `this.template.querySelector` in most cases.

```html
<template>
    <lightning-input lwc:ref="email" label="Email"></lightning-input>
    <lightning-input lwc:ref="phone" label="Phone"></lightning-input>
</template>
```

```javascript
validate() {
    const email = this.refs.email;
    const phone = this.refs.phone;
    return email.checkValidity() && phone.checkValidity();
}
```

Use `querySelector` only for dynamic selection (e.g., querying inside an iteration).

---

## Component Lifecycle

```javascript
import { LightningElement } from 'lwc';

export default class LifecycleDemo extends LightningElement {
    connectedCallback() {
        // Component inserted into DOM — set up subscriptions, fetch initial data
    }

    renderedCallback() {
        // After every render — keep logic minimal and idempotent (guard with a flag)
        if (this.hasRendered) return;
        this.hasRendered = true;
        // one-time post-render setup
    }

    disconnectedCallback() {
        // Component removed — unsubscribe, clear timers, release resources
    }

    errorCallback(error, stack) {
        // Catches errors thrown from child component lifecycle hooks
        console.error(error, stack);
    }
}
```

Never mutate reactive state in `renderedCallback` without a guard — causes infinite re-render loops.

---

## Reactivity

Top-level field assignments are reactive automatically (no `@track` needed since v45).

```javascript
export default class ReactiveDemo extends LightningElement {
    count = 0;          // reactive
    user = { name: '' };  // reactive at top level

    increment() {
        this.count++;                          // ✅ triggers re-render
        this.user = { ...this.user, name: 'Y' }; // ✅ triggers re-render (new object reference)
        this.user.name = 'X';                  // ❌ no re-render — nested mutation
    }
}
```

For nested object/array mutations to trigger re-render, reassign the top-level field to a new reference.

---

## Custom Events

```javascript
// Child component dispatches
this.dispatchEvent(new CustomEvent('select', {
    detail: { accountId: this.accountId },
    bubbles: true,        // bubble up the DOM
    composed: false       // stay within the shadow boundary (default)
}));
```

```html
<!-- Parent listens -->
<c-account-tile onselect={handleSelect}></c-account-tile>
```

```javascript
handleSelect(event) {
    const accountId = event.detail.accountId;
}
```

- `composed: true` lets the event cross shadow DOM boundaries. Use sparingly — most cross-component communication should use LMS or `@api` methods on the parent.
- Event names: lowercase, no dashes, no event-prefix (`accountselect`, not `account-select` or `onAccountSelect`).

---

## Cross-Component Messaging — Lightning Message Service

LMS replaces pubsub for any communication between components that don't share a parent.

```javascript
// message channel: force-app/main/default/messageChannels/AccountSelected.messageChannel-meta.xml
import { LightningElement, wire } from 'lwc';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import ACCOUNT_SELECTED from '@salesforce/messageChannel/AccountSelected__c';

export default class Publisher extends LightningElement {
    @wire(MessageContext) messageContext;

    notify(accountId) {
        publish(this.messageContext, ACCOUNT_SELECTED, { accountId });
    }
}

export default class Subscriber extends LightningElement {
    subscription = null;
    @wire(MessageContext) messageContext;

    connectedCallback() {
        this.subscription = subscribe(
            this.messageContext,
            ACCOUNT_SELECTED,
            (message) => this.handleMessage(message)
        );
    }

    disconnectedCallback() {
        if (this.subscription) {
            unsubscribe(this.subscription);
            this.subscription = null;
        }
    }
}
```

---

## Cache Refresh — `refreshApex` and `getRecordNotifyChange`

After mutating data, the cache must be told to refetch.

```javascript
import { refreshApex } from '@salesforce/apex';
import { getRecordNotifyChange } from 'lightning/uiRecordApi';

@wire(getAccounts) wiredAccountsResult;

async handleSave() {
    await updateRecord({ fields: { Id: this.recordId, Name: 'New' } });

    // ✅ Refresh imperatively-wired Apex result
    await refreshApex(this.wiredAccountsResult);

    // ✅ Notify LDS that a record changed (so other components re-fetch)
    getRecordNotifyChange([{ recordId: this.recordId }]);
}
```

`updateRecord` already invalidates LDS cache for that record — you only need `getRecordNotifyChange` when the change happened outside LDS (Apex callout, external system, custom action).

**State managers (Winter '27):** call `refresh()` on a built-in state manager to refetch list- or query-shaped data (related list records, for example) without reconfiguring the state manager or reloading the page. Use it instead of forcing a full page refresh when only the collection went stale.

---

## Navigation

```javascript
import { NavigationMixin } from 'lightning/navigation';

export default class NavDemo extends NavigationMixin(LightningElement) {
    openAccount(accountId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: accountId, objectApiName: 'Account', actionName: 'view' }
        });
    }

    openList() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Account', actionName: 'list' },
            state: { filterName: 'Recent' }
        });
    }
}
```

---

## Toasts

```javascript
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

this.dispatchEvent(new ShowToastEvent({
    title: 'Saved',
    message: 'Account updated successfully',
    variant: 'success',    // 'info' | 'success' | 'warning' | 'error'
    mode: 'dismissable'    // 'dismissable' | 'pester' | 'sticky'
}));
```

Toasts only work in Lightning Experience and the Salesforce mobile app — they're no-ops in standalone Lightning Out apps.

---

## Public API — `@api`

```javascript
import { LightningElement, api } from 'lwc';

export default class AccountTile extends LightningElement {
    @api recordId;                              // public property
    @api compact = false;                       // public property with default

    @api focusFirstField() {                    // public method
        this.refs.firstInput.focus();
    }

    // ❌ Don't mutate @api properties inside the component
    @api count = 0;
    increment() { this.count++; }               // anti-pattern — parent owns this value
}
```

Public properties are read-only inside the component — the parent owns the value.

---

## GraphQL — `lightning/graphql`

```javascript
import { LightningElement, wire } from 'lwc';
import { gql, graphql } from 'lightning/graphql';

export default class AccountsGraph extends LightningElement {
    @wire(graphql, {
        query: gql`
            query getAccounts {
                uiapi {
                    query {
                        Account(where: { Industry: { eq: "Technology" } }, first: 10) {
                            edges {
                                node {
                                    Id
                                    Name { value }
                                    AnnualRevenue { value }
                                }
                            }
                        }
                    }
                }
            }
        `
    })
    accounts;
}
```

`lightning/uiGraphQLApi` is removed — use `lightning/graphql` (GA Summer '24).

---

## Loading External Resources

```javascript
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import CHARTJS from '@salesforce/resourceUrl/chartjs';

async renderedCallback() {
    if (this.chartInitialized) return;
    this.chartInitialized = true;

    await Promise.all([
        loadScript(this, CHARTJS + '/chart.min.js'),
        loadStyle(this, CHARTJS + '/chart.min.css')
    ]);
    this.renderChart();
}
```

External libraries must run under **Lightning Web Security** (replaced Locker Service in Spring '23). Most modern libraries work without changes; legacy libraries that rely on `window`-level globals may need adapters.

---

## Common AI-Generated Mistakes

| Mistake | Fix |
|---|---|
| `if:true={x}` / `if:false={x}` | Use `lwc:if={x}` / `lwc:elseif={x}` / `lwc:else` |
| `this.template.querySelector('lightning-input')` for static refs | Use `lwc:ref` and `this.refs.name` |
| `@track` on every field | Reactive by default since v45; only needed for deep observation of objects with `@track` (rare) |
| `import { ... } from 'lightning/uiGraphQLApi'` | Use `lightning/graphql` |
| Aura: `<aura:component>`, `c:childCmp` | LWC: `<template>`, `<c-child-cmp>` |
| `pubsub` library imports | Use `lightning/messageService` (LMS) |
| Mutating nested object/array fields and expecting re-render | Reassign top-level field with new reference |
| Calling Apex `@wire` on `cacheable=false` method | Either invoke imperatively or set `cacheable=true` |
| Custom event with dashes/camelCase: `onAccount-Select` | Lowercase, no dashes: `accountselect` |
| Toast in Lightning Out app | Toasts only work in LEX / Salesforce mobile |
| Forgetting `key={item.Id}` in `for:each` | Always provide a unique stable key |
| Importing fields as strings: `fields: ['Account.Name']` | Use `@salesforce/schema/Account.Name` imports |
| Template expression in a component below API v68.0 | Raise `apiVersion` to 68.0 or use a getter |
| `window.open(url, '_blank')` for a same-origin URL | Detached anchor click — `window.open` throws `LockerSecurityError` under LWS for Aura |
