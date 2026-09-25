"""
Main Canis engine orchestrating pipelines and direct generation.

The engine is interface-agnostic and can be used by CLI, HTTP server, or as a library.
"""

from pathlib import Path
from typing import Dict, Optional, List, Union, Callable, Any

from canis.core.llama_client import LlamaClient
from canis.core.adapter_manager import AdapterManager
from canis.pipeline.schema import Pipeline, PipelineResult, AdapterInfo
from canis.pipeline.loader import load_pipeline, load_pipeline_from_dict
from canis.pipeline.executor import PipelineExecutor


class CanisEngine:
    """Main orchestrator for pipelines and direct generation."""
    
    def __init__(self, llama_host: str = "127.0.0.1", llama_port: int = 8080):
        """
        Initialize CanisEngine.
        
        Args:
            llama_host: llama-server host address
            llama_port: llama-server port
        """
        self.client = LlamaClient(llama_host, llama_port)
        self.adapters = AdapterManager(self.client)
        self.pipelines: Dict[str, Pipeline] = {}
    
    def check_connection(self) -> bool:
        """
        Check if llama-server is reachable.
        
        Returns:
            True if connected, False otherwise
        """
        return self.client.check_health()
    
    def initialize(self) -> bool:
        """
        Initialize engine by connecting to server and fetching adapters.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.check_connection():
            return False
        
        self.adapters.refresh()
        return True
    
    # ==================== Pipeline Management ====================
    
    def load_pipeline(self, path: Union[str, Path]) -> str:
        """
        Load pipeline from JSON file.
        
        Args:
            path: Path to pipeline JSON file
        
        Returns:
            Pipeline ID (name)
        
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If pipeline is invalid
        """
        pipeline = load_pipeline(path)
        self.pipelines[pipeline.name] = pipeline
        return pipeline.name
    
    def load_pipeline_from_dict(self, data: dict) -> str:
        """
        Load pipeline from dictionary.
        
        Args:
            data: Pipeline definition as dict
        
        Returns:
            Pipeline ID (name)
        
        Raises:
            ValueError: If pipeline is invalid
        """
        pipeline = load_pipeline_from_dict(data)
        self.pipelines[pipeline.name] = pipeline
        return pipeline.name
    
    def list_pipelines(self) -> List[Dict[str, str]]:
        """
        List loaded pipelines.
        
        Returns:
            List of pipeline info dicts with id, name, description
        """
        return [
            {
                "id": name,
                "name": pipeline.name,
                "description": pipeline.description,
            }
            for name, pipeline in self.pipelines.items()
        ]
    
    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """
        Get pipeline by ID.
        
        Args:
            pipeline_id: Pipeline ID
        
        Returns:
            Pipeline object or None
        """
        return self.pipelines.get(pipeline_id)
    
    def unload_pipeline(self, pipeline_id: str) -> bool:
        """
        Unload pipeline.
        
        Args:
            pipeline_id: Pipeline ID
        
        Returns:
            True if unloaded, False if not found
        """
        if pipeline_id in self.pipelines:
            del self.pipelines[pipeline_id]
            return True
        return False
    
    # ==================== Pipeline Execution ====================
    
    def run_pipeline(
        self,
        pipeline_id: str,
        input_text: str,
        variables: Optional[Dict] = None,
        trace_callback: Optional[Callable[[str, str, str], None]] = None,
        stream_callback: Optional[Callable[[str], None]] = None,
        session_state: Optional['SessionState'] = None,
        verbose_trace: bool = False,
    ) -> PipelineResult:
        """
        Execute pipeline.
        
        Args:
            pipeline_id: Pipeline ID
            input_text: User input
            variables: Runtime variables
            trace_callback: Optional callback for live trace updates (node_name, node_type, status)
            stream_callback: Optional callback for streaming token output (chunk)
            session_state: Optional session state for persistent memory
            verbose_trace: If True, show detailed debug info (interpolated prompts, accumulator contents)
        
        Returns:
            PipelineResult with output, trace, and variables
        
        Raises:
            ValueError: If pipeline not found
        """
        pipeline = self.pipelines.get(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline '{pipeline_id}' not found")
        
        executor = PipelineExecutor(
            self, 
            pipeline, 
            trace_callback, 
            stream_callback,
            session_state,
            verbose_trace
        )
        return executor.execute(input_text, variables)
    
    def run_pipeline_stream(
        self,
        pipeline_id: str,
        input_text: str,
        variables: Optional[Dict] = None,
        session_state: Optional['SessionState'] = None,
    ):
        """
        Execute pipeline with streaming events.
        
        Args:
            pipeline_id: Pipeline ID
            input_text: User input
            variables: Runtime variables
            session_state: Optional session state
        
        Yields:
            Event dicts with streaming updates
        
        Raises:
            ValueError: If pipeline not found
        """
        pipeline = self.pipelines.get(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline '{pipeline_id}' not found")
        
        executor = PipelineExecutor(
            self, 
            pipeline,
            session_state=session_state
        )
        yield from executor.execute_stream(input_text, variables)
    
    # ==================== Direct Generation ====================
    
    def generate(
        self,
        prompt: str,
        adapter: Optional[str] = None,
        alpha: float = 1.0,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream: bool = False,
    ):
        """
        Direct generation without pipeline.
        
        Args:
            prompt: Text prompt
            adapter: Adapter name (None for base model)
            alpha: Adapter strength
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: If True, return iterator
        
        Returns:
            Generated text or iterator of chunks
        """
        if adapter:
            self.adapters.apply(adapter, alpha)
        else:
            self.adapters.clear()
        
        return self.client.generate(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream,
        )
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        adapter: Optional[str] = None,
        alpha: float = 1.0,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream: bool = False,
    ):
        """
        Chat completion without pipeline.
        
        Args:
            messages: List of message dicts
            adapter: Adapter name (None for base model)
            alpha: Adapter strength
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: If True, return iterator
        
        Returns:
            Generated response or iterator of chunks
        """
        if adapter:
            self.adapters.apply(adapter, alpha)
        else:
            self.adapters.clear()
        
        return self.client.chat(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream,
        )
    
    # ==================== Adapter Management ====================
    
    def list_adapters(self) -> List[AdapterInfo]:
        """
        Get available adapters.
        
        Returns:
            List of AdapterInfo objects
        """
        adapter_list = self.adapters.list_adapters()
        return [
            AdapterInfo(
                name=a["name"],
                id=a["id"],
                path=a["path"],
                scale=a["scale"],
            )
            for a in adapter_list
        ]
    
    def apply_adapter(self, name: Optional[str], alpha: float = 1.0) -> bool:
        """
        Apply adapter.
        
        Args:
            name: Adapter name (None to disable all)
            alpha: Adapter strength
        
        Returns:
            True if successful, False otherwise
        """
        return self.adapters.apply(name, alpha)
    
    def get_current_adapter(self) -> Dict[str, any]:
        """
        Get current adapter configuration.
        
        Returns:
            Dict with adapter name and alpha
        """
        return self.adapters.get_current()
