"""Scan pinned local images without exposing Docker's control socket to the scanner."""
import argparse
import json
import subprocess
import uuid
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCANNER = "aquasec/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969"


def run(*args):
    result = subprocess.run(["docker", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-1800:])
    return result.stdout.strip()


def main(optional=False, selected_image=None):
    output = ROOT / "runtime" / "security"
    output.mkdir(exist_ok=True)
    flags = ["-f", "compose.yaml"] + (["-f", "compose.observability.yaml"] if optional else [])
    images = [selected_image] if selected_image else list(dict.fromkeys(run("compose", *flags, "config", "--images").splitlines()))
    run("volume", "create", "sih26155-scan-cache")
    helper = "sih26155-scan-transfer-" + uuid.uuid4().hex[:8]
    run("run", "-d", "--name", helper, "--mount", "type=volume,source=sih26155-scan-cache,target=/cache",
        "--entrypoint", "sh", SCANNER, "-c", "sleep 3600")
    inventory_path = output / "inventory.json"
    inventory = json.loads(inventory_path.read_text(encoding="utf-8")) if selected_image and inventory_path.exists() else []
    try:
        for image in images:
            label = image.split("/")[-1].split("@")[0].replace(":", "-")
            if label == "sih26155-app-local":
                label = "app"
            elif label == "sih26155-web-local":
                label = "web"
            archive = output / "input-image.tar"
            run("image", "save", "--output", str(archive), image)
            # Linux storage avoids extremely slow random archive reads through Windows/OneDrive mounts.
            run("cp", str(archive), helper + ":/cache/qualification-input.tar")
            common = ["run", "--rm", "--cpus", "1", "--memory", "1g", "--network", "none",
                      "--env", "TRIVY_SKIP_VERSION_CHECK=true",
                      "--mount", "type=volume,source=sih26155-scan-cache,target=/cache",
                      "--mount", "type=bind,source=" + str(output) + ",target=/reports", SCANNER]
            run(*common, "image", "--timeout", "10m", "--parallel", "1", "--cache-dir", "/cache",
                "--cache-backend", "memory", "--offline-scan", "--skip-db-update", "--skip-java-db-update",
                "--scanners", "vuln", "--list-all-pkgs", "--input", "/cache/qualification-input.tar",
                "--format", "json", "--output", f"/reports/{label}-image-scan.json")
            run(*common, "convert", "--format", "cyclonedx", "--output", f"/reports/{label}-sbom.cdx.json",
                f"/reports/{label}-image-scan.json")
            report = json.loads((output / f"{label}-image-scan.json").read_text(encoding="utf-8"))
            issues = [v for result in report.get("Results", []) for v in result.get("Vulnerabilities", [])]
            item = {"image": image, "image_id": run("image", "inspect", image, "--format", "{{.Id}}"),
                    "report": label + "-image-scan.json", "sbom": label + "-sbom.cdx.json",
                    "findings_by_severity": dict(Counter(v["Severity"] for v in issues))}
            repository = image.split("@")[0].rsplit(":", 1)[0]
            inventory = [entry for entry in inventory if entry["image"].split("@")[0].rsplit(":", 1)[0] != repository]
            inventory.append(item)
            inventory_path.write_text(json.dumps(inventory, indent=2), encoding="utf-8")
            print(json.dumps(item), flush=True)
        archive.unlink(missing_ok=True)
    finally:
        run("rm", "-f", helper)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--optional", action="store_true", help="Include observability images")
    parser.add_argument("--image", help="Rescan one replacement image, preserving the other inventory entries")
    args = parser.parse_args()
    main(args.optional, args.image)
