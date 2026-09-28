"""Team-authored technical baseline; crosswalks are not certified benchmark packs."""

from pydantic import BaseModel, Field
from typing import Literal


class Rule(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{2,60}$")
    title: str = Field(min_length=3, max_length=160)
    fact: str = Field(pattern=r"^[a-z][a-z0-9_]{1,60}$")
    operator: Literal["eq", "lte", "gte", "present"] = "eq"
    expected: str | int | bool | None = True
    severity: Literal["critical", "high", "medium", "low"] = "medium"
    source: str = Field(min_length=3, max_length=2000)
    rationale: str = Field(max_length=2000)
    vendors: list[str] = Field(default_factory=list, max_length=100)
    remediation: dict[str, str] = Field(default_factory=dict)


class Policy(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    framework: Literal["Baseline", "CIS", "NIST", "STIG", "ISO"] = "Baseline"
    version: str = Field(min_length=1, max_length=100)
    scope: str = Field(min_length=10, max_length=3000)
    rules: list[Rule] = Field(min_length=1, max_length=200)


DEFINITIONS = [
    ("AC-01", "Disable Telnet management", "telnet_disabled", "eq", True, "high", "AC-17 / SC-8"),
    ("AC-02", "Disable plaintext HTTP management", "http_disabled", "eq", True, "high", "SC-8"),
    ("AC-03", "Configure HTTPS management", "https_enabled", "eq", True, "medium", "SC-8"),
    ("AC-04", "Require SSH protocol version 2", "ssh_version", "eq", 2, "high", "SC-13"),
    ("AC-05", "Bound SSH negotiation timeout", "ssh_timeout", "lte", 60, "medium", "AC-12"),
    ("AC-06", "Limit idle administrative sessions", "session_timeout_seconds", "lte", 600, "medium", "AC-12"),
    ("AC-07", "Limit authentication retries", "login_retries", "lte", 3, "medium", "AC-7"),
    ("IA-01", "Enable explicit authentication configuration", "aaa_enabled", "eq", True, "high", "IA-2"),
    ("IA-02", "Use stronger local account secret formats", "local_strong_secret", "eq", True, "high", "IA-5"),
    ("AU-01", "Configure remote audit logging", "remote_logging", "eq", True, "high", "AU-9"),
    ("AU-02", "Include timestamps in audit logs", "log_timestamps", "eq", True, "medium", "AU-8"),
    ("AU-03", "Log successful administrative logins", "login_success_logged", "eq", True, "low", "AU-2"),
    ("AU-04", "Log failed administrative logins", "login_failure_logged", "eq", True, "medium", "AU-2"),
    ("AU-05", "Configure a reference time server", "ntp_configured", "eq", True, "medium", "AU-8"),
    ("AU-06", "Enable NTP authentication mode", "ntp_authenticated", "eq", True, "medium", "SC-45"),
    ("SC-01", "Define an SNMPv3 privacy group", "snmp_v3_private", "eq", True, "high", "SC-8"),
    ("SC-02", "Remove legacy SNMP communities", "snmp_v2_disabled", "eq", True, "high", "SC-8"),
    ("AC-08", "Provide an administrative login notice", "login_banner", "eq", True, "low", "AC-8"),
    ("AC-09", "Bind an inbound VTY access list", "management_acl", "eq", True, "high", "AC-3 / SC-7"),
    ("SC-03", "Disable IPv4 source routing", "source_routing_disabled", "eq", True, "high", "SC-7"),
]

IOS_FIXES = {
    "telnet_disabled": "line vty <review all configured ranges>\n transport input ssh",
    "http_disabled": "no ip http server", "https_enabled": "ip http secure-server",
    "ssh_version": "ip ssh version 2", "ssh_timeout": "ip ssh time-out 60",
    "session_timeout_seconds": "line vty <review all configured ranges>\n exec-timeout 10 0",
    "login_retries": "ip ssh authentication-retries 3", "aaa_enabled": "aaa new-model",
    "log_timestamps": "service timestamps log datetime msec",
    "login_success_logged": "login on-success log", "login_failure_logged": "login on-failure log",
    "source_routing_disabled": "no ip source-route",
}


def baseline(framework="Baseline"):
    rules = []
    for identifier, title, path, operator, value, severity, crosswalk in DEFINITIONS:
        rules.append(Rule(id=identifier, title=title, fact=path, operator=operator, expected=value,
                          severity=severity, source=f"Team technical baseline v1. Candidate NIST crosswalk: {crosswalk}.",
                          rationale="Technical evidence check. Review applicability against your exact device, firmware and benchmark edition.",
                          remediation={"ios": IOS_FIXES[path]} if path in IOS_FIXES else {}))
    return Policy(name=f"{framework} technical evidence baseline", framework=framework, version="team-v1",
                  scope="Team-authored technical checks with illustrative framework crosswalks. Not a CIS/STIG "
                        "benchmark release, an ISO certification assessment, or full NIST control coverage. "
                        "Import a reviewed policy for your exact benchmark edition.", rules=rules)


def evaluate(policy: Policy, facts: dict, vendor: str):
    results = []
    for rule in policy.rules:
        evidence = facts.get(rule.fact)
        value = evidence.get("value") if evidence else None
        if rule.vendors and vendor not in rule.vendors:
            verdict = "not_applicable"
        elif value is None:
            verdict = "insufficient_evidence"
        else:
            if rule.operator == "eq":
                passed = type(value) is type(rule.expected) and value == rule.expected
            elif rule.operator in ("lte", "gte"):
                numeric = type(value) in (int, float) and type(rule.expected) in (int, float)
                passed = numeric and value > 0 and (
                    value <= rule.expected if rule.operator == "lte" else value >= rule.expected)
            else:
                passed = value not in (None, "", [], {})
            verdict = "pass" if passed else "fail"
        remediation = rule.remediation.get(vendor)
        results.append({**rule.model_dump(exclude={"remediation"}), "verdict": verdict,
                        "evidence": evidence, "observed": value,
                        "remediation": remediation,
                        "remediation_status": "review_required" if remediation else "not_available",
                        "remediation_note": "Configuration proposal only. Validate device/firmware syntax, "
                                             "management reachability and rollback in a lab before use."})
    counts = {key: sum(row["verdict"] == key for row in results)
              for key in ("pass", "fail", "insufficient_evidence", "not_applicable")}
    checked = counts["pass"] + counts["fail"]
    applicable = len(results) - counts["not_applicable"]
    return {"findings": results, "counts": counts,
            "coverage": round(checked * 100 / applicable, 1) if applicable else 0,
            "pass_rate": round(counts["pass"] * 100 / checked, 1) if checked else None}
