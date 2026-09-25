"""
Pipeline executor.

Runs pipelines from entry to terminal, managing state and tracing.
"""

import time
from typing import Dict, Any, Optional, Callable, List, TYPE_CHECKING

from canis.pipeline.schema import Pipeline, PipelineResult, TraceEntry
from canis.pipeline.nodes import NODE_REGISTRY
from canis.pipeline.session import SessionState


def _format_chat_history(messages: List[Any]) -> str:
    """Format chat messages for use in prompt templates (e.g. {{chat_history}})."""
    if not messages:
        return ""
    lines = []
    for m in messages:
        role = getattr(m, "role", "user")
        content = getattr(m, "content", "") or ""
        label = "User" if role == "user" else "Assistant"
        lines.append(f"{label}: {content.strip()}")
    return "\n\n".join(lines)


def _init_run_variables(
    executor: "PipelineExecutor",
    input_text: str,
    variables: Optional[Dict[str, Any]] = None,
    *,
    add_user_message: bool = True,
) -> None:
    """
    Initialize executor.variables for a run: defaults, session persistent,
    overrides, input, and chat_history. Optionally add current user message to session.
    """
    if add_user_message and executor.session_state:
        executor.session_state.add_message("user", input_text)

    executor.variables = {}
    for var_name, var_def in executor.pipeline.variables.items():
        executor.variables[var_name] = var_def.default

    if executor.session_state:
        for var_name, var_def in executor.pipeline.variables.items():
            if var_def.persist and var_name in executor.session_state.persistent_vars:
                executor.variables[var_name] = executor.session_state.persistent_vars[var_name]

    if variables:
        executor.variables.update(variables)

    executor.variables["input"] = input_text

    if executor.session_state and executor.session_state.chat_history:
        previous = executor.session_state.chat_history[:-1]
        executor.variables["chat_history"] = _format_chat_history(previous)
    else:
        executor.variables["chat_history"] = ""


if TYPE_CHECKING:
    from canis.core.engine import CanisEngine


class PipelineExecutor:
    """Executes pipelines with state management and tracing."""
    
    def __init__(
        self, 
        engine: 'CanisEngine', 
        pipeline: Pipeline, 
        trace_callback: Optional[Callable] = None,
        stream_callback: Optional[Callable] = None,
        session_state: Optional[SessionState] = None,
        verbose_trace: bool = False
    ):
        """
        Initialize PipelineExecutor.
        
        Args:
            engine: CanisEngine instance
            pipeline: Pipeline definition
            trace_callback: Optional callback for live trace updates (node_name, node_type, status)
            stream_callback: Optional callback for streaming token output (chunk)
            session_state: Optional session state for persistent memory
            verbose_trace: If True, show detailed debug info (interpolated prompts, accumulator contents)
        """
        self.engine = engine
        self.pipeline = pipeline
        self.variables: Dict[str, Any] = {}
        self.trace: list[TraceEntry] = []
        self.trace_callback = trace_callback
        self.stream_callback = stream_callback
        self.session_state = session_state
        self.verbose_trace = verbose_trace
    
    def execute(
        self,
        input_text: str,
        variables: Optional[Dict[str, Any]] = None
    ) -> PipelineResult:
        """
        Execute pipeline from entry node to terminal.
        
        Args:
            input_text: User input
            variables: Runtime variables to override defaults
        
        Returns:
            PipelineResult with output, trace, and variables
        """
        start_time = time.time()
        
        # Check if session is blocked
        if self.session_state and self.session_state.blocked:
            return PipelineResult(
                output=f"Session blocked: {self.session_state.block_reason}\n\nUse /session reset to continue.",
                trace=[],
                variables={"blocked": True},
                elapsed_time=0.0
            )

        _init_run_variables(self, input_text, variables, add_user_message=True)
        self.trace = []
        
        # Execute from entry node
        current_node_name = self.pipeline.entry_node
        
        while current_node_name:
            # Get node definition
            node = self.pipeline.nodes.get(current_node_name)
            if not node:
                raise ValueError(f"Node '{current_node_name}' not found in pipeline")
            
            # Check if node should run only once
            if hasattr(node, 'run_once') and node.run_once:
                if self.session_state and current_node_name in self.session_state.executed_init_nodes:
                    # Skip this node, go to next
                    if hasattr(node, 'next'):
                        current_node_name = node.next
                    else:
                        # No next node, try to get it from routes if classifier
                        current_node_name = None
                    continue
                elif self.session_state:
                    # Mark as executed
                    self.session_state.executed_init_nodes.add(current_node_name)
            
            # Notify callback - node starting
            if self.trace_callback:
                self.trace_callback(current_node_name, node.type, "starting")
            
            # Add trace entry
            trace_entry = TraceEntry(
                node=current_node_name,
                type=node.type,
                timestamp=time.time()
            )
            self.trace.append(trace_entry)
            
            # Execute node
            handler = NODE_REGISTRY.get(node.type)
            if not handler:
                raise ValueError(f"No handler for node type '{node.type}'")
            
            current_node_name = handler(self, node)
            
            # Notify callback - node completed
            if self.trace_callback:
                self.trace_callback(trace_entry.node, node.type, "completed")
        
        elapsed_time = time.time() - start_time
        
        # Save persistent variables back to session
        if self.session_state:
            for var_name, var_def in self.pipeline.variables.items():
                if var_def.persist and var_name in self.variables:
                    self.session_state.persistent_vars[var_name] = self.variables[var_name]
            
            # Add assistant message to chat history
            output = self.variables.get("output")
            if output:
                # Get current adapter info
                adapter_name = None
                if hasattr(self.trace[-1], 'adapter'):
                    adapter_name = self.trace[-1].adapter
                
                self.session_state.add_message(
                    "assistant", 
                    output,
                    classification=getattr(self.trace[-1], 'classification', None),
                    adapter=adapter_name,
                    node=self.trace[-1].node if self.trace else None
                )
        
        return PipelineResult(
            output=self.variables.get("output"),
            trace=self.trace,
            variables=self.variables,
            elapsed_time=elapsed_time
        )
    
    def execute_stream(
        self,
        input_text: str,
        variables: Optional[Dict[str, Any]] = None
    ):
        """
        Execute pipeline with streaming events.
        
        Args:
            input_text: User input
            variables: Runtime variables to override defaults
        
        Yields:
            Event dicts:
            - {"type": "node_start", "node": "...", "node_type": "..."}
            - {"type": "chunk", "content": "..."}
            - {"type": "node_end", "node": "...", ...}
            - {"type": "complete", "result": {...}}
        """
        import time
        start_time = time.time()

        # Blocked session: yield a single complete event and exit
        if self.session_state and self.session_state.blocked:
            yield {
                "type": "complete",
                "result": {
                    "output": f"Session blocked: {self.session_state.block_reason}\n\nUse /session reset to continue.",
                    "trace": [],
                    "elapsed_time": 0.0,
                },
            }
            return

        _init_run_variables(self, input_text, variables, add_user_message=True)
        self.trace = []

        current_node_name = self.pipeline.entry_node

        while current_node_name:
            node = self.pipeline.nodes.get(current_node_name)
            if not node:
                raise ValueError(f"Node '{current_node_name}' not found in pipeline")

            # run_once: skip if already executed (same as execute())
            if hasattr(node, "run_once") and node.run_once and self.session_state:
                if current_node_name in self.session_state.executed_init_nodes:
                    current_node_name = getattr(node, "next", None)
                    if current_node_name is None and getattr(node, "routes", None):
                        current_node_name = node.routes.get("*")
                    continue
                self.session_state.executed_init_nodes.add(current_node_name)

            # Signal node start
            yield {"type": "node_start", "node": current_node_name, "node_type": node.type}
            
            trace_entry = TraceEntry(
                node=current_node_name,
                type=node.type,
                timestamp=time.time()
            )
            self.trace.append(trace_entry)
            
            # Execute node
            handler = NODE_REGISTRY.get(node.type)
            if not handler:
                raise ValueError(f"No handler for node type '{node.type}'")
            
            # Check if handler supports streaming
            if hasattr(handler, 'stream') and callable(handler.stream):
                # Stream from this node
                for event in handler.stream(self, node):
                    if event["type"] == "chunk":
                        yield event
                    elif event["type"] == "result":
                        current_node_name = event.get("next_node")
            else:
                # Non-streaming node
                current_node_name = handler(self, node)
            
            # Signal node end (include trace details for server/CLI logging)
            yield {
                "type": "node_end",
                "node": trace_entry.node,
                "node_type": node.type,
                "classification": getattr(trace_entry, "classification", None),
                "adapter": getattr(trace_entry, "adapter", None),
                "alpha": getattr(trace_entry, "alpha", None),
                "output_preview": getattr(trace_entry, "output_preview", None),
            }
        
        # Persist session state (same as in execute())
        if self.session_state:
            for var_name, var_def in self.pipeline.variables.items():
                if var_def.persist and var_name in self.variables:
                    self.session_state.persistent_vars[var_name] = self.variables[var_name]
            output = self.variables.get("output")
            if output and self.trace:
                last = self.trace[-1]
                self.session_state.add_message(
                    "assistant",
                    output,
                    classification=getattr(last, "classification", None),
                    adapter=getattr(last, "adapter", None),
                    node=last.node,
                )
        
        # Signal completion
        elapsed_time = time.time() - start_time
        yield {
            "type": "complete",
            "result": {
                "output": self.variables.get("output"),
                "trace": [
                    {
                        "node": t.node,
                        "type": t.type,
                        "classification": getattr(t, "classification", None),
                        "adapter": getattr(t, "adapter", None),
                        "alpha": getattr(t, "alpha", None),
                        "output_preview": getattr(t, "output_preview", None),
                    }
                    for t in self.trace
                ],
                "elapsed_time": elapsed_time
            }
        }

