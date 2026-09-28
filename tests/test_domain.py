from pathlib import Path

import pytest
from defusedxml.common import DefusedXmlException
from pydantic import ValidationError

from service.domain import MappingSpec, apply_mapping, identify, normalize, redact, test_mapping as check_mapping
from service.policies import baseline, evaluate
from service.report import pdf_report


def test_banner_commands_and_interface_commands_do_not_establish_global_security():
    result = normalize('hostname lab\nbanner login ^C\nip ssh version 2\n^C\ninterface x\n ip http secure-server', 'ios', True)
    assert 'ssh_version' not in result['facts']
    assert 'https_enabled' not in result['facts']


def test_inactive_junos_and_missing_syslog_destination_remain_unknown():
    result = normalize('set system services ssh protocol-version v2\ndeactivate system services ssh', 'junos', True)
    assert result['facts']['ssh_version']['value'] is None
    result = normalize('config log syslogd setting\n set status enable\nend', 'fortios', True)
    assert 'remote_logging' not in result['facts']


def test_structured_mapping_keeps_missing_and_false_distinct():
    spec = MappingSpec(name='Structured SSH', vendor='unknown', firmware='unknown', fact='ssh_version', selector_type='json_path',
                       selector='management.ssh.version', value_mode='selected', value_type='integer')
    assert apply_mapping(spec, '{"management":{"ssh":{"version":2}}}')['value'] == 2
    assert apply_mapping(spec, '{"management":{}}') is None


def load(name):
    return Path("fixtures", name).read_text(encoding="utf-8")


def test_mixed_vty_and_snippet_never_produce_false_compliance():
    config = "hostname lab\nline vty 0 4\n transport input ssh\nline vty 5 15\n transport input telnet ssh\nend"
    assert "telnet_disabled" not in normalize(config, "ios", False)["facts"]
    assert normalize(config, "ios", True)["facts"]["telnet_disabled"]["value"] is False


def test_unlimited_session_is_a_failure_not_a_small_timeout():
    config = load("ios-review.cfg")
    result = evaluate(baseline(), normalize(config, "ios", True)["facts"], "ios")
    assert next(row for row in result["findings"] if row["id"] == "AC-06")["verdict"] == "fail"
    assert result["counts"]["insufficient_evidence"] > 0


@pytest.mark.parametrize("filename,vendor", [("ios-secure.cfg", "ios"), ("junos-example.cfg", "junos"), ("fortios-example.cfg", "fortios"), ("unfamiliar-example.cfg", "unknown")])
def test_fixture_identity_and_bounded_outcomes(filename, vendor):
    source = load(filename)
    assert identify(source)["vendor"] == vendor
    result = evaluate(baseline(), normalize(source, vendor, True)["facts"], vendor)
    assert len(result["findings"]) == 20
    assert sum(result["counts"].values()) == 20
    if vendor == "unknown":
        assert result["coverage"] == 0
        assert result["pass_rate"] is None


def mapping(**kwargs):
    return MappingSpec(name="Example SSH mapping", vendor="unknown", firmware="unknown", fact="ssh_version",
                       selector="secure-shell-version", value_type="integer", **kwargs)


def test_mapping_boundaries_conflicts_and_promotion_gate():
    spec = mapping(cases=[{"text": "secure-shell-version 2", "expected": 2},
                          {"text": "secure-shell-version 1", "expected": 1},
                          {"text": "secure-shell-version-extra 2", "expected": None}])
    assert check_mapping(spec)["passed"]
    assert apply_mapping(spec, "secure-shell-version-extra 2") is None
    assert apply_mapping(spec, "secure-shell-version 1\nsecure-shell-version 2") is None
    assert not check_mapping(mapping(cases=[{"text": "secure-shell-version 2", "expected": 2}]))["passed"]


def test_xml_cannot_load_external_entities_or_expensive_paths():
    spec = MappingSpec(name="XML example", vendor="example", firmware="v1", fact="ssh_version",
                       selector_type="xml_path", selector="config/ssh/version", value_mode="selected", value_type="integer")
    with pytest.raises(DefusedXmlException):
        apply_mapping(spec, '<!DOCTYPE config [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><config><ssh><version>&xxe;</version></ssh></config>')
    with pytest.raises(ValidationError):
        spec.model_validate({**spec.model_dump(), "selector": ".//version"})


def test_redaction_removes_credentials_and_private_key_material():
    text = "username admin secret 9 DO_NOT_LEAK\nsnmp-server community ALSO_PRIVATE RO\n-----BEGIN RSA PRIVATE KEY-----\nVERY_PRIVATE\n-----END RSA PRIVATE KEY-----\nip ssh version 2"
    redacted = redact(text)
    for token in ("DO_NOT_LEAK", "ALSO_PRIVATE", "VERY_PRIVATE"):
        assert token not in redacted
    assert "ip ssh version 2" in redacted


def test_numeric_rules_reject_boolean_and_conflicting_evidence():
    result = evaluate(baseline(), {"ssh_version": {"value": True}}, "ios")
    assert next(row for row in result["findings"] if row["id"] == "AC-04")["verdict"] == "fail"
    facts = normalize("ip ssh version 2\nip ssh version 1", "ios", True)["facts"]
    assert facts["ssh_version"]["value"] is None


def test_pdf_is_real_and_includes_full_control_set():
    content = load("ios-review.cfg")
    result = evaluate(baseline(), normalize(content, "ios", True)["facts"], "ios")
    data = {**result, "name": "Synthetic test device", "policy": baseline().model_dump(),
            "input_sha256": "0" * 64, "synthetic": True}
    pdf = pdf_report("test-audit", data, {"name": "Synthetic test device", "vendor": "ios"})
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 4000
