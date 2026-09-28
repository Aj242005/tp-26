# Declared coverage and evidence

All shipped configurations are team-authored synthetic examples. The organizer supplied authority names, not a downloadable dataset. No real-vendor accuracy, novelty superiority or certification result is claimed.

| Fixture | Interpreted family | Pass | Fail | Need evidence | Evaluated coverage |
| --- | --- | ---: | ---: | ---: | ---: |
| fortios-example.cfg | fortios | 6 | 0 | 14 | 30.0% |
| ios-review.cfg | ios | 2 | 9 | 9 | 55.0% |
| ios-secure.cfg | ios | 19 | 0 | 1 | 95.0% |
| junos-example.cfg | junos | 7 | 0 | 13 | 35.0% |
| unfamiliar-example.cfg | unknown | 0 | 0 | 20 | 0.0% |

Coverage is evaluated applicable controls divided by all applicable controls. Unknowns do not inflate the pass percentage. Fixture outcomes are regression observations, not independently validated vendor labels.

## Interpretation contract

- IOS/IOS-XE: explicit global commands, scoped VTY transport/timeouts/ACL binding, account secret type, logging/NTP/SNMP configuration declarations. Complete-snapshot claims are needed for cross-VTY aggregates. Banner contents are opaque. ACL effectiveness, method-list reachability and full defaults are unverified.
- Junos: selected `set` statements. Inheritance or edit/deactivation operations require expanded effective configuration and invalidate native positive conclusions. Brace configuration and arbitrary inheritance are not claimed supported.
- FortiOS: selected global settings and interface allowaccess lists; syslog needs explicit enabled state and a nonempty destination. Routing/VDOM effective policy and reachability are unverified.
- Unfamiliar text, JSON and XML: reviewed declarative prefix/object-path/element-path mappings. XML entities/unsafe selectors are rejected. A file being accepted is not a claim of verified vendor support.

## Standards and provenance

The 20 definitions in `service/policies.py` are team technical checks. CIS/NIST/STIG/ISO selections currently share these definitions; their crosswalk notes are candidates for review. No copyrighted benchmark document is bundled or represented as an official rule pack. Import authorized reference text and independently reviewed policy JSON to add exact editions. Vendor-model/serial/firmware identity remains unavailable when not present in the source.

## Adaptation evidence and outstanding evaluation

The browser test holds out a synthetic command dialect. Before review, its SSH-version control is unknown. After a three-case mapping is tested and approved, a fresh audit passes that single control; retiring the mapping returns future audits to unknown while older reports retain their result. This is a functional adaptation demonstration, not an independent vendor benchmark.

An expert-labelled corpus, direct-LLM comparisons, question-selection ablations and overlapping-tool comparisons remain necessary to establish accuracy or superiority. No such results are invented. External Batfish validation is optional in the plan and is not bundled in this release; all operational remediation proposals remain review-required.
