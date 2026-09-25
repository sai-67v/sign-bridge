"""
Pydantic models for pipeline schema validation.

Defines the structure of pipelines, nodes, and execution results.
"""

from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field


class VariableDefinition(BaseModel):
    """Variable definition in pipeline."""
    type: str = "string"
    default: Any = ""
    persist: bool = False  # Whether variable persists across pipeline runs


class ClassifierNode(BaseModel):
    """Classifier node - routes based on LLM output."""
    type: Literal["classifier"]
    adapter: Optional[str] = None
    alpha: float = 1.0
    prompt: str
    max_tokens: int = 5
    temperature: float = 0.7
    routes: Dict[str, str]  # classification -> next_node
    run_once: bool = False  # Only execute on first pipeline run
    output_var: Optional[str] = None  # Optional variable to store classification result


class GenerateNode(BaseModel):
    """Generate node - produces text output."""
    type: Literal["generate"]
    adapter: Optional[str] = None
    alpha: float = 1.0
    system_prompt: Optional[str] = None
    user_prompt: str
    output_var: Optional[str] = None  # Optional variable to store output (defaults to 'output' and 'last_output')
    max_tokens: int = 512
    temperature: float = 0.7
    next: Optional[str] = None
    run_once: bool = False  # Only execute on first pipeline run


class TerminalNode(BaseModel):
    """Terminal node - ends pipeline execution."""
    type: Literal["terminal"]


class TransformNode(BaseModel):
    """Transform node - applies transformations to variables."""
    type: Literal["transform"]
    input_var: str
    output_var: str
    operation: Literal["regex", "template", "extract"]
    pattern: Optional[str] = None
    next: Optional[str] = None
    run_once: bool = False  # Only execute on first pipeline run


class ExtractorNode(BaseModel):
    """Extractor node - extracts relevant context using LLM."""
    type: Literal["extractor"]
    source_var: str = "context"  # Variable containing full text (e.g., markdown notes)
    query_var: str = "input"  # Variable with user query
    output_var: str = "extracted_context"  # Where to store extracted text
    extraction_prompt: Optional[str] = None  # Custom prompt or use default
    clarify_node: Optional[str] = None  # Node to route to if ambiguous
    next: Optional[str] = None
    run_once: bool = False


class ClarifyNode(BaseModel):
    """Clarify node - asks user for clarification."""
    type: Literal["clarify"]
    clarify_prompt: str  # Prompt to ask for clarification
    options_var: Optional[str] = None  # Variable containing options to present
    max_attempts: int = 3  # Maximum clarification attempts
    fallback_node: str  # Node to route to if max attempts exceeded
    next: Optional[str] = None  # Node to route to after clarification
    run_once: bool = False


class BlockerNode(BaseModel):
    """Blocker node - checks conditions and can block pipeline."""
    type: Literal["blocker"]
    condition_prompt: str  # Prompt to evaluate blocking condition
    block_message: str  # Message to show if blocked
    action: Literal["warn", "stop"] = "warn"  # warn = continue, stop = block session
    max_topic_jumps: Optional[int] = None  # Maximum topic changes allowed
    next: Optional[str] = None
    run_once: bool = False


class WhileLoopNode(BaseModel):
    """While loop - repeats until condition classifier returns false."""
    type: Literal["while_loop"]
    condition_node: str  # Classifier node to evaluate (must route to "continue" or "break")
    body_node: str  # First node in loop body
    max_iterations: int = 100  # Safety limit
    next: Optional[str] = None  # Node to jump to after loop ends
    run_once: bool = False


class ForLoopNode(BaseModel):
    """For loop - repeats body a fixed number of times."""
    type: Literal["for_loop"]
    iterations_var: str = "iterations"  # Variable containing number of iterations (or literal number)
    body_node: str  # First node in loop body
    index_var: str = "loop_index"  # Variable to store current iteration (0-indexed)
    max_iterations: int = 1000  # Safety limit
    next: Optional[str] = None  # Node to jump to after loop ends
    run_once: bool = False


class ForEachLoopNode(BaseModel):
    """ForEach loop - iterates over list items."""
    type: Literal["foreach_loop"]
    list_var: str  # Variable containing list to iterate over
    item_var: str = "item"  # Variable to store current item
    index_var: str = "loop_index"  # Variable to store current index
    body_node: str  # First node in loop body
    accumulator_var: Optional[str] = None  # Optional variable to accumulate results
    max_iterations: int = 1000  # Safety limit
    next: Optional[str] = None  # Node to jump to after loop ends
    run_once: bool = False


class ListExtractorNode(BaseModel):
    """List extractor - extracts list items using LLM."""
    type: Literal["list_extractor"]
    source_var: str = "input"  # Variable containing text to extract from
    output_var: str = "extracted_list"  # Variable to store list
    extraction_prompt: Optional[str] = None  # Custom prompt or use default
    adapter: Optional[str] = None
    alpha: float = 1.0
    max_tokens: int = 512
    temperature: float = 0.7
    next: Optional[str] = None
    run_once: bool = False


# Union of all node types
Node = ClassifierNode | GenerateNode | TerminalNode | TransformNode | ExtractorNode | ClarifyNode | BlockerNode | WhileLoopNode | ForLoopNode | ForEachLoopNode | ListExtractorNode


class Pipeline(BaseModel):
    """Complete pipeline definition."""
    schema_: str = Field(alias="$schema", default="canis-pipeline-v1")
    name: str
    description: str = ""
    variables: Dict[str, VariableDefinition] = {}
    nodes: Dict[str, Node]
    entry_node: str
    
    class Config:
        populate_by_name = True


class TraceEntry(BaseModel):
    """Single step in pipeline execution trace."""
    node: str
    type: str
    classification: Optional[str] = None
    output_preview: Optional[str] = None
    adapter: Optional[str] = None
    alpha: Optional[float] = None
    timestamp: Optional[float] = None


class PipelineResult(BaseModel):
    """Result of pipeline execution."""
    output: Optional[str] = None
    trace: List[TraceEntry] = []
    variables: Dict[str, Any] = {}
    elapsed_time: float = 0.0


class AdapterInfo(BaseModel):
    """Information about a LoRA adapter."""
    name: str
    id: int
    path: str = ""
    scale: float = 0.0
