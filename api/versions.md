# Salesforce API Versions — Current and Retired

> AI: Use the current API version (v68.0) on all new metadata — Apex classes, triggers, LWC, flows, and REST/SOAP/Bulk endpoint paths. Never emit a version from the v50s or lower on new code. When updating existing metadata, do not silently downgrade its version.
> Release: Winter '27 | API: v68.0 | Updated: 2026-09
> Source: Verified against the Salesforce REST API, Apex, and Bulk API 2.0 Developer Guides (all "Version 68.0, Winter '27") and the Winter '27 Release Notes (August 31, 2026). Retirement schedule from the REST API guide's "Understand API Version Retirement" and the Winter '27 release notes.

---

## Current version

- **v68.0 — Winter '27.** Use this for every new component and every REST/SOAP/Bulk endpoint path.
- Endpoint example: `/services/data/v68.0/sobjects/Account/`
- Next version: **v69.0 — Spring '27**.

## Release-to-version map

Salesforce ships 3 releases/year (Spring, Summer, Winter) and increments the API version by 1 each time.

| Release | API version |
|---|---|
| Winter '27 | v68.0 (current) |
| Summer '26 | v67.0 |
| Spring '26 | v66.0 |
| Winter '26 | v65.0 |
| Summer '25 | v64.0 |
| Spring '25 | v63.0 |
| Winter '25 | v62.0 |
| Summer '24 | v61.0 |
| Spring '24 | v60.0 |
| Winter '24 | v59.0 |
| Summer '23 | v58.0 |

Anchors v58.0 (Summer '23) and v68.0 (Winter '27) are confirmed in the official guides and release notes; the cadence is a fixed +1 per release with no skipped versions.

## Retired and deprecated versions

- **v7.0 through v20.0 — RETIRED** as of Summer '22. Calls fail.
- **v21.0 through v30.0 — RETIRED** as of Summer '25. Calls fail.
- **v31.0 through v40.0 — being retired** (announced Summer '26): deprecated in **Summer '27** (no more security updates or bug fixes), retired in **Summer '28** (REST, SOAP, and Bulk calls to these versions fail). Upgrade integrations now.
- **SOAP `login()` in v31.0 through v64.0 — being retired in Summer '27** (Release Update). This is the SOAP login call specifically — move SOAP logins to OAuth. Separate from the v31.0–v40.0 platform retirement above.
- **Apex saved at v9.0 through v19.0 — compiler warning as of Winter '27**, retirement announced for a future release. Saving or recompiling such a class returns `Apex API version {XX} is scheduled for retirement.` Raise the class or trigger's API version.
- **`showAllMethods` (Test Discovery API) is deprecated in v68.0+** — replaced by the `testLevel` query parameter. `showAllMethods` works only on v67.0 and earlier.
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
- GOOD: `callout:MyOrg/services/data/v68.0/query?q=...`
- WHY: the path version pins the API contract; a retired version (≤ v30.0) makes the callout fail outright.

### LWC API version controls framework behavior

- An LWC at API version **59.0 or later** uses that value for its LWC framework version. Components at **58.0 or earlier** keep Summer '23 (API 58.0) framework behavior.
- WHY: setting a new component below 59.0 silently opts it out of current LWC engine behavior — set new components to 67.0.
