"""Optional OTLP traces. Authentication paths and all message bodies are excluded."""
import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


def configure(name, app=None):
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        provider = TracerProvider(resource=Resource.create({"service.name": "sih26155-" + name}))
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint.rstrip("/") + "/v1/traces")))
        trace.set_tracer_provider(provider)
        if app:
            FastAPIInstrumentor.instrument_app(app, excluded_urls=".*/api/auth/.*,.*/api/metrics,.*/api/health/.*",
                                               tracer_provider=provider)
    return trace.get_tracer("sih26155")
