from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def pdf_report(audit_id: str, data: dict, device: dict):
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=(210 * mm, 297 * mm),
                                 leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SmallCode", fontName="Courier", fontSize=8, leading=11, wordWrap="CJK"))
    body = [Paragraph("Prooflane configuration audit", styles["Title"]),
            Paragraph(escape(data["name"]), styles["Heading2"]),
            Paragraph(escape(f"Audit {audit_id} · {data.get('completed_at', '')}"), styles["Normal"]),
            Spacer(1, 10)]
    identity = [["Device", device.get("name", "Unavailable")], ["Vendor", device.get("vendor", "Unknown")],
                ["Firmware", device.get("firmware", "Unavailable")], ["Serial", device.get("serial", "Unavailable")],
                ["Snapshot SHA-256", data["input_sha256"]], ["Policy", data["policy"]["name"] + " / " + data["policy"]["version"]]]
    table = Table([[Paragraph(escape(str(a)), styles["Normal"]), Paragraph(escape(str(b)), styles["Normal"])]
                   for a, b in identity], colWidths=[40 * mm, 132 * mm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9dee7"))]))
    body += [table, Spacer(1, 12), Paragraph(escape(data["policy"]["scope"]), styles["Normal"])]
    if data.get("synthetic"):
        body.append(Paragraph("SYNTHETIC EXAMPLE — this configuration was authored for testing.", styles["Heading3"]))
    body += [Paragraph("Coverage", styles["Heading2"]), Paragraph(
        escape(f"Evaluated {data.get('coverage', 0)}% of applicable checks. Counts: {data.get('counts', {})}. "
               "Insufficient evidence is not a pass."), styles["Normal"])]
    for finding in data.get("findings", []):
        body.append(Paragraph(escape(f"{finding['id']} — {finding['title']}"), styles["Heading3"]))
        body.append(Paragraph(escape(f"{finding['verdict'].replace('_', ' ').upper()} | {finding['severity']} severity | "
                                     f"Observed: {finding.get('observed')} | Expected: {finding.get('expected')}"), styles["Normal"]))
        evidence = finding.get("evidence")
        if evidence:
            body.append(Paragraph(escape(f"Source lines: {evidence['lines']}. {evidence['reason']}. Mapping: {evidence['origin']}"), styles["Normal"]))
        body.append(Paragraph(escape(finding["source"]), styles["Normal"]))
        if finding.get("remediation") and finding["verdict"] == "fail":
            body.append(Paragraph("Proposed remediation — review required", styles["Heading4"]))
            body.append(Paragraph(escape(finding["remediation"]).replace("\n", "<br/>"), styles["SmallCode"]))
            body.append(Paragraph(escape(finding["remediation_note"]), styles["Normal"]))
        body.append(Spacer(1, 5))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#596477"))
        canvas.drawString(18 * mm, 10 * mm, "Prooflane · Evidence-backed technical assessment")
        canvas.drawRightString(192 * mm, 10 * mm, str(doc.page))
        canvas.restoreState()

    document.build(body, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
