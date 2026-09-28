"""Send only synthetic content; never print credentials or provider exception payloads."""
import json
import os
import sys
from pathlib import Path

from google import genai
from google.genai import types

from service.config import settings


def main():
    cfg = settings()
    result = {"backend": cfg.gemini_backend, "model": cfg.gemini_model, "live": True}
    if not cfg.gemini_api_key or not cfg.gemini_model:
        print("Configure GEMINI_API_KEY and GEMINI_MODEL before this check")
        return 2
    try:
        with genai.Client(api_key=cfg.gemini_api_key, vertexai=cfg.gemini_backend == "vertex_express",
                          http_options=types.HttpOptions(timeout=30000, base_url=cfg.gemini_base_url)) as client:
            response = client.models.generate_content(model=cfg.gemini_model,
                contents="Synthetic capability check: call report_status with status ready.",
                config=types.GenerateContentConfig(max_output_tokens=256, tools=[types.Tool(function_declarations=[
                    types.FunctionDeclaration(name="report_status", description="Report this synthetic test status",
                        parameters_json_schema={"type": "object", "properties": {"status": {"type": "string"}}, "required": ["status"]})])],
                    tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="ANY")),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)))
            result.update(success=bool(response.function_calls), function_call=bool(response.function_calls),
                          tokens=response.usage_metadata.total_token_count if response.usage_metadata else None)
    except Exception as exc:
        result.update(success=False, error_type=type(exc).__name__, status=getattr(exc, "code", None))
    directory = Path(os.getenv("RUNTIME_DIR", "runtime"))
    directory.mkdir(exist_ok=True)
    (directory / "provider-check.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
