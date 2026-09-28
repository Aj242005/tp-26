"""Bounded configuration interpretation. No generated code is executed."""

import hashlib
import json
import re
from typing import Any, Literal

from defusedxml import ElementTree
from pydantic import BaseModel, Field, model_validator


class MappingCase(BaseModel):
    text: str = Field(max_length=50000)
    expected: Any = None
    label_source: str = Field(default="Reviewer supplied", max_length=500)


class MappingSpec(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    vendor: str = Field(min_length=2, max_length=60)
    firmware: str = Field(min_length=1, max_length=120)
    fact: str = Field(pattern=r"^[a-z][a-z0-9_]{1,60}$")
    selector_type: Literal["line_prefix", "json_path", "xml_path"] = "line_prefix"
    selector: str = Field(min_length=1, max_length=240)
    scope_prefix: str = Field(default="", max_length=200)
    value_mode: Literal["last_token", "literal", "selected"] = "last_token"
    value_type: Literal["string", "integer", "boolean"] = "string"
    literal: str | int | bool | None = None
    description: str = Field(default="", max_length=2000)
    cases: list[MappingCase] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def bounded_selector(self):
        if self.selector_type == "xml_path" and (
            "//" in self.selector or ".." in self.selector or "[" in self.selector
        ):
            raise ValueError("Use a simple element path without descendant queries or predicates")
        if self.value_mode == "literal" and self.literal is None:
            raise ValueError("A literal value is required")
        return self


def fact(value, lines, reason="Explicit configuration", origin="native-v1", scope="device"):
    return {"value": value, "lines": lines, "reason": reason, "origin": origin, "scope": scope}


def redact(text: str):
    output, private = [], False
    for line in text.splitlines():
        if re.search(r"BEGIN .*PRIVATE KEY", line):
            private = True
        if private:
            output.append("[private key redacted]")
            if re.search(r"END .*PRIVATE KEY", line):
                private = False
            continue
        # Keep control keywords/types while excluding secret material and its hash.
        line = re.sub(r"(?i)(\b(?:password|secret|community|passwd|psksecret|private-key|key-string|api[_-]?key|access[_-]?token|client[_-]?secret|token)\b)(.*)",
                      r"\1 [redacted]", line)
        line = re.sub(r"(?i)(\b(?:auth|priv)\s+(?:sha\d*|md5|aes(?:\s+\d+)?|des))\s+\S+",
                      r"\1 [redacted]", line)
        line = re.sub(r"(?i)(ntp authentication-key\s+\d+\s+\S+)\s+.*", r"\1 [redacted]", line)
        output.append(line)
    return "\n".join(output)


def identify(text: str):
    if re.search(r"(?m)^config system (?:global|interface)", text):
        vendor = "fortios"
    elif re.search(r"(?m)^set (?:system|interfaces|snmp) ", text):
        vendor = "junos"
    elif re.search(r"(?m)^(?:hostname |version \d|aaa new-model|line vty )", text):
        vendor = "ios"
    else:
        vendor = "unknown"
    patterns = {
        "hostname": [r"(?m)^hostname (\S+)", r"(?m)^set system host-name (\S+)",
                     r'(?m)^\s*set hostname "?([^"\n]+)'],
        "firmware": [r"(?m)^version ([^\n]+)", r"(?m)^#config-version=([^:\n]+)"],
        "serial": [r"(?im)^(?:!\s*)?serial(?: number)?[:= ]+([\w-]+)"],
    }
    result = {"vendor": vendor}
    for key, choices in patterns.items():
        for pattern in choices:
            match = re.search(pattern, text)
            if match:
                result[key] = match.group(1).strip()[:160]
                break
    return result


def normalize(text: str, vendor: str, complete=False):
    raw_lines = text.splitlines()
    rows = [(i + 1, line.strip()) for i, line in enumerate(raw_lines)]
    facts, unknown = {}, []

    def put(name, value, number, reason="Explicit configuration"):
        candidate = fact(value, [number], reason)
        previous = facts.get(name)
        if previous and previous["value"] != value:
            facts[name] = fact(None, previous["lines"] + [number], "Conflicting configuration; review required")
        elif previous:
            previous["lines"].append(number)
        else:
            facts[name] = candidate

    vty, vty_groups, interfaces, current_interface = None, [], [], None
    stack, syslog = [], {}
    banner_delimiter = None
    for number, line in rows:
        if not line or line.startswith(("!", "#")):
            continue
        recognized = False
        if vendor == "ios":
            original = raw_lines[number - 1]
            if banner_delimiter:
                if banner_delimiter in line:
                    banner_delimiter = None
                continue
            if line.startswith("banner "):
                pieces = line.split(maxsplit=2)
                if len(pieces) == 3 and pieces[2]:
                    delimiter = "^C" if pieces[2].startswith("^C") else pieces[2][0]
                    if delimiter not in pieces[2][len(delimiter):]:
                        banner_delimiter = delimiter
                    if pieces[1] == "login":
                        put("login_banner", True, number, "Login banner configured; notice content requires review")
                continue
            global_line = bool(original) and not original[0].isspace()
            if line.startswith("line vty "):
                vty = {"start": number}
                vty_groups.append(vty)
                recognized = True
            elif original and not original[0].isspace():
                vty = None
            if vty is not None:
                if line.startswith("transport input "):
                    vty["transport"] = (number, line.split()[2:])
                    recognized = True
                if line.startswith("exec-timeout "):
                    try:
                        parts = line.split()
                        vty["timeout"] = (number, int(parts[1]) * 60 + (int(parts[2]) if len(parts) > 2 else 0))
                        recognized = True
                    except ValueError:
                        pass
                if line.startswith("access-class ") and line.endswith(" in"):
                    vty["acl"] = (number, True)
                    recognized = True
            literal_rules = {
                "no ip http server": ("http_disabled", True), "ip http server": ("http_disabled", False),
                "ip http secure-server": ("https_enabled", True),
                "no ip http secure-server": ("https_enabled", False),
                "aaa new-model": ("aaa_enabled", True), "no aaa new-model": ("aaa_enabled", False),
                "ntp authenticate": ("ntp_authenticated", True),
                "no ntp authenticate": ("ntp_authenticated", False),
                "no ip source-route": ("source_routing_disabled", True),
                "ip source-route": ("source_routing_disabled", False),
                "login on-success log": ("login_success_logged", True),
                "login on-failure log": ("login_failure_logged", True),
                "no login on-success log": ("login_success_logged", False),
                "no login on-failure log": ("login_failure_logged", False),
                "service password-encryption": ("password_obfuscation", True),
            }
            if global_line and line in literal_rules:
                name, value = literal_rules[line]
                put(name, value, number)
                recognized = True
            for prefix, name in (("ip ssh version ", "ssh_version"), ("ip ssh time-out ", "ssh_timeout"),
                                 ("ip ssh authentication-retries ", "login_retries")):
                if global_line and line.startswith(prefix):
                    try:
                        put(name, int(line[len(prefix):]), number)
                        recognized = True
                    except ValueError:
                        pass
            for prefix, name in (("logging host ", "remote_logging"), ("ntp server ", "ntp_configured"),
                                 ("service timestamps log datetime", "log_timestamps"),
                                 ("banner login ", "login_banner")):
                if global_line and line.startswith(prefix):
                    put(name, True, number)
                    recognized = True
            if global_line and line.startswith("snmp-server group ") and " v3 priv" in line:
                put("snmp_v3_private", True, number)
                recognized = True
            if global_line and line.startswith("snmp-server community "):
                put("snmp_v2_disabled", False, number)
                recognized = True
            if global_line and line.startswith("username "):
                strong = bool(re.search(r"\bsecret (?:8|9) ", line))
                put("local_strong_secret", strong, number)
                recognized = True
        elif vendor == "junos":
            literal_rules = {
                "set system services ssh protocol-version v2": ("ssh_version", 2),
                "set system services ssh protocol-version v1": ("ssh_version", 1),
                "set system services telnet": ("telnet_disabled", False),
                "set system services web-management http": ("http_disabled", False),
                "set system syslog time-format year": ("log_timestamps", True),
            }
            if line in literal_rules:
                name, value = literal_rules[line]
                put(name, value, number)
                recognized = True
            prefixes = (("set system syslog host ", "remote_logging"),
                        ("set system ntp server ", "ntp_configured"),
                        ("set system login message ", "login_banner"),
                        ("set system authentication-order ", "aaa_enabled"),
                        ("set system services web-management https ", "https_enabled"))
            for prefix, name in prefixes:
                if line.startswith(prefix):
                    put(name, True, number)
                    recognized = True
            if line.startswith("set snmp community "):
                put("snmp_v2_disabled", False, number)
                recognized = True
            if line.startswith("set system services ssh authentication-retries "):
                try:
                    put("login_retries", int(line.split()[-1]), number)
                    recognized = True
                except ValueError:
                    pass
        elif vendor == "fortios":
            if line.startswith("config "):
                stack.append(line)
                recognized = True
            elif line.startswith("edit "):
                stack.append(line)
                if "config system interface" in stack:
                    current_interface = {"start": number}
                    interfaces.append(current_interface)
                recognized = True
            elif line in ("next", "end"):
                if stack:
                    stack.pop()
                if line == "next":
                    current_interface = None
                recognized = True
            if "config system global" in stack:
                scalar = {"set admintimeout ": ("session_timeout_seconds", 60),
                          "set admin-lockout-threshold ": ("login_retries", 1),
                          "set admin-ssh-grace-time ": ("ssh_timeout", 1)}
                for prefix, (name, multiplier) in scalar.items():
                    if line.startswith(prefix):
                        try:
                            put(name, int(line[len(prefix):]) * multiplier, number)
                            recognized = True
                        except ValueError:
                            pass
                if line == "set admin-ssh-v1 disable":
                    put("ssh_version", 2, number)
                    recognized = True
            if current_interface is not None and line.startswith("set allowaccess "):
                current_interface["access"] = (number, line.split()[2:])
                recognized = True
            if "config log syslogd setting" in stack:
                if line in ("set status enable", "set status disable"):
                    syslog["enabled"] = (number, line.endswith("enable"))
                    recognized = True
                if line.startswith("set server "):
                    syslog["server"] = (number, line[len("set server "):].strip('" '))
                    recognized = True
        if not recognized and not line.startswith(("hostname ", "version ", "end", "exit", "set system host-name")):
            unknown.append({"line": number, "text": redact(line)[:300]})
    if vendor == "ios" and complete and vty_groups:
        for field, output, transform in (
            ("transport", "telnet_disabled", lambda values: all("telnet" not in x and "all" not in x for x in values)),
            ("timeout", "session_timeout_seconds", lambda values: 0 if 0 in values else max(values)),
            ("acl", "management_acl", lambda values: all(values)),
        ):
            if all(field in group for group in vty_groups):
                facts[output] = fact(transform([group[field][1] for group in vty_groups]),
                                     [group[field][0] for group in vty_groups],
                                     "All declared VTY blocks in a user-declared complete snapshot")
    if vendor == "fortios" and complete and interfaces and all("access" in row for row in interfaces):
        for protocol, key in (("telnet", "telnet_disabled"), ("http", "http_disabled")):
            facts[key] = fact(all(protocol not in row["access"][1] for row in interfaces),
                              [row["access"][0] for row in interfaces], "All declared interface allowaccess lists")
    if vendor == "fortios" and "enabled" in syslog:
        if not syslog["enabled"][1]:
            facts["remote_logging"] = fact(False, [syslog["enabled"][0]], "Syslog explicitly disabled")
        elif syslog.get("server", (0, ""))[1] not in ("", "0.0.0.0", "::"):
            facts["remote_logging"] = fact(True, [syslog["enabled"][0], syslog["server"][0]], "Syslog enabled with an explicit destination; reachability unverified")
    if vendor == "junos" and any(line.startswith(("deactivate ", "delete ", "insert ")) or " apply-groups" in line for _, line in rows):
        for value in facts.values():
            value.update(value=None, reason="Junos inheritance or edit operations require an expanded effective configuration")
    if banner_delimiter and "login_banner" in facts:
        facts["login_banner"].update(value=None, reason="Login banner is unterminated")
    return {"facts": facts, "unrecognized": unknown[:100], "unrecognized_count": len(unknown),
            "native_version": "native-v1", "complete_declared": complete}


def apply_mapping(spec: MappingSpec, text: str):
    matches = []
    if len(text) > 10 * 1024 * 1024:
        raise ValueError("Mapping input too large")
    if spec.selector_type == "line_prefix":
        scope = not bool(spec.scope_prefix)
        for number, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            if spec.scope_prefix and line and not line[0].isspace():
                scope = stripped.startswith(spec.scope_prefix)
            prefix = spec.selector.rstrip()
            if scope and (stripped == prefix or stripped.startswith(prefix + " ") or stripped.startswith(prefix + "\t")):
                tail = stripped[len(prefix):].strip()
                selected = tail.split()[-1] if spec.value_mode == "last_token" and tail else tail
                matches.append((number, selected))
    elif spec.selector_type == "json_path":
        value = json.loads(text)
        for part in spec.selector.split("."):
            if not isinstance(value, dict) or part not in value:
                return None
            value = value[part]
        matches = [(1, value)]
    else:
        root = ElementTree.fromstring(text)
        path = spec.selector.strip("/").split("/")
        if path and path[0] == root.tag:
            path = path[1:]
        node = root.find("/".join(path)) if path else root
        if node is not None:
            matches = [(1, node.text)]
    values, lines = [], []
    for number, selected in matches:
        value = spec.literal if spec.value_mode == "literal" else selected
        try:
            if spec.value_type == "integer":
                if isinstance(value, bool):
                    return None
                value = int(value)
            elif spec.value_type == "boolean":
                if isinstance(value, bool):
                    pass
                elif str(value).lower() in ("true", "enable", "enabled", "yes"):
                    value = True
                elif str(value).lower() in ("false", "disable", "disabled", "no"):
                    value = False
                else:
                    return None
            else:
                if isinstance(value, (dict, list)) or value is None:
                    return None
                value = str(value)
        except (ValueError, TypeError):
            return None
        if values and (type(value) is not type(values[0]) or value != values[0]):
            return None
        values.append(value)
        lines.append(number)
    return fact(values[0], lines, "Reviewed declarative mapping", "mapping") if values else None


def test_mapping(spec: MappingSpec):
    results = []
    for case in spec.cases:
        try:
            result = apply_mapping(spec, case.text)
            actual = result["value"] if result else None
            passed = type(actual) is type(case.expected) and actual == case.expected
            results.append({"passed": passed, "actual": actual, "expected": case.expected})
        except Exception:
            results.append({"passed": False, "actual": None, "expected": case.expected,
                            "error": "Input cannot be interpreted by this mapping"})
    diverse = len({hashlib.sha256(case.text.encode()).hexdigest() for case in spec.cases}) >= 3
    eligible = diverse and any(case.expected is None for case in spec.cases) and any(
        case.expected is not None for case in spec.cases)
    return {"results": results, "eligible": eligible,
            "passed": bool(results) and eligible and all(item["passed"] for item in results)}
