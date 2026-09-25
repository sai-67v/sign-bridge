"""
Canis v4 - Modular AI Pipeline Engine

A flexible AI inference engine supporting declarative JSON pipelines,
LoRA hot-swapping, and multiple interfaces (CLI, HTTP server, Python SDK).

Usage:
    # As a library
    from canis import CanisEngine
    
    engine = CanisEngine(llama_host="127.0.0.1", llama_port=8080)
    engine.load_pipeline("homework_helper.json")
    result = engine.run_pipeline("homework_helper", "What is 2+2?")
    
    # As a CLI
    python -m canis.interfaces.cli
    
    # As a server
    python -m canis.interfaces.server
"""

__version__ = "4.0.0"
__author__ = "Canis Team"

from canis.core.engine import CanisEngine
from canis.core.llama_client import LlamaClient
from canis.core.adapter_manager import AdapterManager
from canis.pipeline.executor import PipelineExecutor
from canis.pipeline.schema import (
    Pipeline,
    PipelineResult,
    TraceEntry,
    AdapterInfo,
)

__all__ = [
    "CanisEngine",
    "LlamaClient",
    "AdapterManager",
    "PipelineExecutor",
    "Pipeline",
    "PipelineResult",
    "TraceEntry",
    "AdapterInfo",
]
