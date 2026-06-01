# Salesforce API Versions — Current and Retired

> AI: Use the current API version (v67.0) on all new metadata — Apex classes, triggers, LWC, flows, and REST/SOAP/Bulk endpoint paths. Never emit a version from the v50s or lower on new code. When updating existing metadata, do not silently downgrade its version.
> Release: Summer '26 | API: v67.0 | Updated: 2026-06
> Source: Verified against Salesforce REST API Developer Guide, Apex Developer Guide, and Bulk API 2.0 Developer Guide (all Summer '26, "Version 67.0, Summer '26"). Retirement schedule from the REST API guide's "Understand API Version Retirement" and the Summer '26 release notes.

---

## Current version

- **v67.0 — Summer '26.** Use this for every new component and every REST/SOAP/Bulk endpoint path.
- Endpoint example: `/services/data/v67.0/sobjects/Account/`
- Next version: **v68.0 — Winter '27** (GA ~Oct 2026).

## Release-to-version map

Salesforce ships 3 releases/year (Spring, Summer, Winter) and increments the API version by 1 each time.

| Release | API version |
|---|---|
| Summer '26 | v67.0 (current) |
| Spring '26 | v66.0 |
| Winter '26 | v65.0 |
| Summer '25 | v64.0 |
| Spring '25 | v63.0 |
| Winter '25 | v62.0 |
| Summer '24 | v61.0 |
| Spring '24 | v60.0 |
| Winter '24 | v59.0 |
| Summer '23 | v58.0 |

Anchors v58.0 (Summer '23) and v67.0 (Summer '26) are confirmed in the official guides; the cadence is a fixed +1 per release with no skipped versions.

## Retired and deprecated versions

- **v7.0 through v20.0 — RETIRED** as of Summer '22. Calls fail.
- **v21.0 through v30.0 — RETIRED** as of Summer '25. Calls fail.
- **SOAP `login()` in v31.0 through v64.0 — being retired in Summer '27** (Release Update). Move SOAP logins to a supported version or OAuth.
- General rule: API versions more than ~3 years old may stop being supported. Plan to keep metadata current.

### Detecting a deprecated version at runtime

- A REST/SOAP response that uses a deprecated version returns a warning header with `warningCode 299`:
  `Warning: 299 - "This API is deprecated and will be removed by <release>."`
- Treat a 299 warning as a signal to upgrade the endpoint version, not as noise.

## AI guidance

### New metadata must use the current version

- BAD: new Apex class saved at an old version
```xml
<!-- MyService.cls-meta.xml -->
<ApiVersion>52.0</ApiVersion>
```
- GOOD:
```xml
<ApiVersion>67.0</ApiVersion>
```
- WHY: old versions miss current platform behavior (e.g. secure defaults), and very old versions are retired without warning.

### Hardcoded endpoint paths must use the current version

- BAD: `callout:MyOrg/services/data/v49.0/query?q=...`
- GOOD: `callout:MyOrg/services/data/v67.0/query?q=...`
- WHY: the path version pins the API contract; a retired version (≤ v30.0) makes the callout fail outright.

### LWC API version controls framework behavior

- An LWC at API version **59.0 or later** uses that value for its LWC framework version. Components at **58.0 or earlier** keep Summer '23 (API 58.0) framework behavior.
- WHY: setting a new component below 59.0 silently opts it out of current LWC engine behavior — set new components to 67.0.
