"""
Canis HTTP Server v4 - FastAPI REST API with SSE streaming.

Usage:
    python -m canis.interfaces.server --host 0.0.0.0 --port 5000
    
    Or with uvicorn:
    uvicorn canis.interfaces.server:app --host 0.0.0.0 --port 5000
"""

import argparse
import json
import os
import time
import uuid
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from canis.core.engine import CanisEngine
from canis.pipeline.session import SessionState


# ==================== Request/Response Models ====================

class PipelineLoadRequest(BaseModel):
    """Request to load a pipeline."""
    pipeline: dict


class PipelineRunRequest(BaseModel):
    """Request to run a pipeline."""
    input: str
    variables: Dict = {}
    stream: bool = False
    session_id: Optional[str] = None


class VariableUpdateRequest(BaseModel):
    """Request to update session variables."""
    variables: Dict[str, Any]


class GenerateRequest(BaseModel):
    """Request for direct generation."""
    prompt: str
    adapter: Optional[str] = None
    alpha: float = 1.0
    max_tokens: int = 512
    temperature: float = 0.7
    stream: bool = False


class ChatRequest(BaseModel):
    """Request for chat completion."""
    messages: List[Dict[str, str]]
    adapter: Optional[str] = None
    alpha: float = 1.0
    max_tokens: int = 512
    temperature: float = 0.7
    stream: bool = False


class AdapterApplyRequest(BaseModel):
    """Request to apply an adapter."""
    name: Optional[str]
    alpha: float = 1.0


# ==================== FastAPI App ====================

# Global engine instance
engine: Optional[CanisEngine] = None
# Global session store (in-memory)
sessions: Dict[str, SessionState] = {}
# Rich console for pipeline logging (CLI-style output in server terminal)
_console = Console()


def _log_pipeline_context(input_text: str, variables: Dict[str, Any]) -> None:
    """Print context and input at the start of a pipeline run (CLI-style)."""
    context = variables.get("context") if variables else None
    if context:
        preview = context[:500] + "..." if len(context) > 500 else context
        _console.print(Panel(preview, title=f"This is the context ({len(context)} chars)", border_style="cyan"))
    else:
        _console.print("[dim]This is the context: (none)[/dim]")
    input_preview = input_text[:300] + "..." if len(input_text) > 300 else input_text
    _console.print(Panel(input_preview, title="Input", border_style="dim"))
    _console.print()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize engine on startup, cleanup on shutdown."""
    global engine
    
    llama_host = os.getenv("LLAMA_HOST", "127.0.0.1")
    llama_port = int(os.getenv("LLAMA_PORT", "8080"))
    
    engine = CanisEngine(llama_host=llama_host, llama_port=llama_port)
    
    if not engine.initialize():
        print(f"[WARNING] Could not connect to llama-server at {llama_host}:{llama_port}")
    else:
        print(f"[OK] Connected to llama-server at {llama_host}:{llama_port}")
        adapters = engine.list_adapters()
        print(f"[INFO] Found {len(adapters)} adapter(s)")
        teach_adapter = os.getenv("CANIS_TEACH_ADAPTER", "teach").strip()
        if teach_adapter and engine.adapters.adapter_exists(teach_adapter):
            if engine.adapters.apply(teach_adapter, 1.0):
                print(f"[OK] TEACH adapter active: {teach_adapter}")
            else:
                print(f"[WARNING] Could not apply adapter '{teach_adapter}'")
        elif teach_adapter:
            print(
                f"[WARNING] Adapter '{teach_adapter}' not on llama-server — "
                "run sync script and ensure lora/teach/ exists (see EDGE_SETUP.md)"
            )

    # Auto-load pipeline JSON files on startup
    pipelines_dir = os.getenv("CANIS_PIPELINES_DIR")
    if not pipelines_dir:
        cwd_pipelines = os.path.join(os.getcwd(), "pipelines")
        if os.path.isdir(cwd_pipelines):
            pipelines_dir = cwd_pipelines
        else:
            # Fall back to examples/ relative to package or repo root
            pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            examples_dir = os.path.join(pkg_root, "examples")
            if os.path.isdir(examples_dir):
                pipelines_dir = examples_dir
            else:
                # Repo-level examples (e.g. CLI/examples when package is CLI/canis)
                repo_examples = os.path.join(os.path.dirname(pkg_root), "examples")
                if os.path.isdir(repo_examples):
                    pipelines_dir = repo_examples

    if pipelines_dir and os.path.isdir(pipelines_dir):
        json_files = [
            os.path.join(pipelines_dir, f)
            for f in os.listdir(pipelines_dir)
            if f.endswith(".json")
        ]
        print(f"[INFO] Auto-loading {len(json_files)} pipeline(s) from {pipelines_dir}")
        for json_path in json_files:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    pipeline_data = json.load(f)
                pipeline_id = engine.load_pipeline_from_dict(pipeline_data)
                print(f"[OK] Loaded pipeline '{pipeline_id}' from {os.path.basename(json_path)}")
            except Exception as e:
                print(f"[WARNING] Failed to load pipeline from {os.path.basename(json_path)}: {e}")
    else:
        print("[INFO] No pipelines directory found; skipping auto-load")

    yield

    # Cleanup on shutdown
    print("[INFO] Shutting down Canis server")


app = FastAPI(
    title="Canis API v4",
    description="Declarative AI Pipeline Engine with LoRA hot-swapping",
    version="4.0.0",
    lifespan=lifespan
)

# CORS middleware for web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Canis API v4",
        "version": "4.1.0",
        "status": "running",
        "endpoints": {
            "pipelines": "/v1/pipelines",
            "generate": "/v1/generate",
            "chat": "/v1/chat",
            "adapters": "/v1/adapters",
            "sessions": "/v1/sessions",
            "health": "/v1/health",
        }
    }


@app.get("/v1/health")
async def health():
    """Health check."""
    if engine and engine.check_connection():
        return {"status": "healthy", "llama_server": "connected"}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "llama_server": "disconnected"}
        )


# ==================== Pipeline Endpoints ====================

@app.post("/v1/pipelines")
async def load_pipeline(req: PipelineLoadRequest):
    """Load a pipeline from JSON definition."""
    try:
        pipeline_id = engine.load_pipeline_from_dict(req.pipeline)
        pipeline = engine.get_pipeline(pipeline_id)
        
        return {
            "id": pipeline_id,
            "name": pipeline.name,
            "description": pipeline.description,
            "status": "loaded"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/v1/pipelines")
async def list_pipelines():
    """List all loaded pipelines."""
    return engine.list_pipelines()


@app.get("/v1/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    """Get pipeline details."""
    pipeline = engine.get_pipeline(pipeline_id)
    
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return {
        "id": pipeline.name,
        "name": pipeline.name,
        "description": pipeline.description,
        "variables": list(pipeline.variables.keys()),
        "nodes": list(pipeline.nodes.keys()),
        "entry_node": pipeline.entry_node,
    }


@app.delete("/v1/pipelines/{pipeline_id}")
async def unload_pipeline(pipeline_id: str):
    """Unload a pipeline."""
    if engine.unload_pipeline(pipeline_id):
        return {"status": "unloaded"}
    else:
        raise HTTPException(status_code=404, detail="Pipeline not found")


@app.post("/v1/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str, req: PipelineRunRequest):
    """Run a pipeline (with optional streaming)."""
    if pipeline_id not in engine.pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # Handle Session
    session_state = None
    if req.session_id:
        if req.session_id not in sessions:
            # Auto-create session if passed ID does not exist
            sessions[req.session_id] = SessionState(session_id=req.session_id, pipeline_name=pipeline_id)
        session_state = sessions[req.session_id]
    
    if req.stream:
        # Return SSE stream and log each step to server terminal (CLI-style with Rich)
        async def event_stream():
            node_start_time: Dict[str, float] = {}
            current_node_output_started = False
            try:
                _console.print()
                _console.print("[bold cyan]🐕 Processing through pipeline...[/bold cyan]")
                _console.print()
                _log_pipeline_context(req.input, req.variables or {})
                for event in engine.run_pipeline_stream(pipeline_id, req.input, req.variables, session_state=session_state):
                    if event.get("type") == "node_start":
                        node_name = event.get("node", "?")
                        node_type = event.get("node_type", "")
                        icon = {"classifier": "🔀", "generate": "✨", "terminal": "🎯", "transform": "⚙️"}.get(node_type, "▶️")
                        _console.print(f"  {icon} [cyan]{node_name}[/cyan] [dim]({node_type})[/dim] [yellow]→ executing...[/yellow]")
                        node_start_time[node_name] = time.time()
                        current_node_output_started = False
                        if node_type in ("generate", "classifier"):
                            _console.print(f"     [dim]output:[/dim] ", end="")
                            current_node_output_started = True
                    elif event.get("type") == "chunk":
                        if os.getenv("CANIS_SERVER_LOG_CHUNKS"):
                            _console.print(event.get("content", ""), end="")
                    elif event.get("type") == "node_end":
                        if current_node_output_started:
                            _console.print()
                            current_node_output_started = False
                        node_name = event.get("node", "?")
                        elapsed = time.time() - node_start_time.get(node_name, time.time())
                        details = []
                        if event.get("classification"):
                            details.append(f"→ {event['classification']}")
                        if event.get("adapter"):
                            details.append(f"adapter={event['adapter']} α={event.get('alpha', 1.0)}")
                        if event.get("output_preview"):
                            preview = event["output_preview"]
                            details.append(f"output: {preview[:50]}{'...' if len(preview) > 50 else ''}")
                        suffix = " | ".join(details) if details else ""
                        _console.print(f"     [green]✓[/green] [dim]completed in {elapsed:.2f}s[/dim]" + (f" — {suffix}" if suffix else ""))
                    elif event.get("type") == "complete":
                        res = event.get("result", {})
                        elapsed = res.get("elapsed_time", 0)
                        steps = len(res.get("trace", []))
                        _console.print()
                        _console.print("[bold cyan]🐕 Pipeline run complete[/bold cyan]")
                        _console.print(f"[dim]Total: {elapsed:.2f}s | Steps: {steps}[/dim]")
                        _console.print()
                    yield f"data: {json.dumps(event)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                _console.print(f"[red]Pipeline error: {e}[/red]")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    try:
        # Log context and input at the start (CLI-style)
        _console.print()
        _console.print("[bold cyan]🐕 Processing through pipeline...[/bold cyan]")
        _console.print()
        _log_pipeline_context(req.input, req.variables or {})

        result = engine.run_pipeline(pipeline_id, req.input, req.variables, session_state=session_state)

        # Log pipeline trace to server terminal (CLI-style: table + final output)
        _console.print("[bold cyan]🐕 Pipeline run complete[/bold cyan]")
        if result.trace:
            table = Table(title="Pipeline Execution Trace", show_header=True)
            table.add_column("Step", style="dim")
            table.add_column("Node", style="cyan")
            table.add_column("Type", style="yellow")
            table.add_column("Details", style="white")
            for i, t in enumerate(result.trace, 1):
                details = []
                if getattr(t, "classification", None):
                    details.append(f"→ {t.classification}")
                if getattr(t, "adapter", None):
                    details.append(f"adapter={t.adapter} α={getattr(t, 'alpha', 1.0)}")
                if getattr(t, "output_preview", None):
                    preview = t.output_preview
                    details.append(f"output: {preview[:50]}{'...' if len(preview) > 50 else ''}")
                table.add_row(str(i), t.node, t.type, " | ".join(details) if details else "-")
            _console.print(table)
        _console.print("[bold cyan]🐕 Final Output:[/bold cyan]")
        _console.print(result.output or "[dim]No output[/dim]")
        _console.print()
        _console.print(f"[dim]Total: {result.elapsed_time:.2f}s | Steps: {len(result.trace)}[/dim]")
        _console.print()

        return {
            "output": result.output,
            "session_id": session_state.session_id if session_state else None,
            "trace": [
                {
                    "node": t.node,
                    "type": t.type,
                    "classification": t.classification,
                    "adapter": t.adapter,
                    "alpha": t.alpha,
                }
                for t in result.trace
            ],
            "elapsed_time": result.elapsed_time,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Session Endpoints ====================

@app.post("/v1/sessions")
async def create_session():
    """Create a new session."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = SessionState(session_id=session_id)
    return {"session_id": session_id, "status": "created"}


@app.get("/v1/sessions")
async def list_sessions():
    """List active sessions."""
    return [
        {
            "id": s_id,
            "created_at": getattr(s, "created_at", None), # Future proofing
            "variables_count": len(s.persistent_vars),
            "history_count": len(s.chat_history),
        }
        for s_id, s in sessions.items()
    ]


@app.get("/v1/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    return {
        "id": session.session_id,
        "variables": session.persistent_vars,
        "chat_history": [
           {"role": m.role, "content": m.content, "timestamp": m.timestamp} 
           for m in session.chat_history
        ],
        "blocked_topics": list(session.blocked_topics),
        "topic_history": session.topic_history
    }


@app.delete("/v1/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    if session_id in sessions:
        del sessions[session_id]
        return {"status": "deleted", "id": session_id}
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@app.post("/v1/sessions/{session_id}/reset")
async def reset_session(session_id: str):
    """Reset a session's state."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Re-initialize
    sessions[session_id] = SessionState(session_id=session_id)
    return {"status": "reset", "id": session_id}


@app.put("/v1/sessions/{session_id}/variables")
async def update_session_variables(session_id: str, req: VariableUpdateRequest):
    """
    Update session variables.
    
    This is useful for loading context (e.g. set "context" variable)
    or manually injecting state before a run.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    sessions[session_id].persistent_vars.update(req.variables)
    return {
        "status": "updated",
        "id": session_id,
        "variables": sessions[session_id].persistent_vars
    }


# ==================== Generation Endpoints ====================

@app.post("/v1/generate")
async def generate(req: GenerateRequest):
    """Direct text generation."""
    if req.stream:
        # Return SSE stream
        async def event_stream():
            try:
                for chunk in engine.generate(
                    prompt=req.prompt,
                    adapter=req.adapter,
                    alpha=req.alpha,
                    max_tokens=req.max_tokens,
                    temperature=req.temperature,
                    stream=True
                ):
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    try:
        output = engine.generate(
            prompt=req.prompt,
            adapter=req.adapter,
            alpha=req.alpha,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            stream=False
        )
        
        return {"output": output}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/chat")
async def chat(req: ChatRequest):
    """Chat completion."""
    if req.stream:
        # Return SSE stream
        async def event_stream():
            try:
                for chunk in engine.chat(
                    messages=req.messages,
                    adapter=req.adapter,
                    alpha=req.alpha,
                    max_tokens=req.max_tokens,
                    temperature=req.temperature,
                    stream=True
                ):
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    try:
        output = engine.chat(
            messages=req.messages,
            adapter=req.adapter,
            alpha=req.alpha,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            stream=False
        )
        
        return {"output": output}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Adapter Endpoints ====================

@app.get("/v1/adapters")
async def list_adapters():
    """List available adapters."""
    adapters = engine.list_adapters()
    return [
        {
            "name": a.name,
            "id": a.id,
            "scale": a.scale,
        }
        for a in adapters
    ]


@app.post("/v1/adapters")
async def apply_adapter(req: AdapterApplyRequest):
    """Apply an adapter."""
    if req.name and not engine.adapters.adapter_exists(req.name):
        raise HTTPException(status_code=404, detail=f"Adapter '{req.name}' not found")
    
    success = engine.apply_adapter(req.name, req.alpha)
    
    if success:
        return {
            "status": "applied",
            "adapter": req.name,
            "alpha": req.alpha,
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to apply adapter")


@app.get("/v1/adapters/current")
async def get_current_adapter():
    """Get current adapter configuration."""
    return engine.get_current_adapter()


# ==================== CLI Entry Point ====================

def main():
    """Server entry point."""
    parser = argparse.ArgumentParser(
        description="Canis HTTP Server v4",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Server host")
    parser.add_argument("--port", type=int, default=5000, help="Server port")
    parser.add_argument("--llama-host", default="127.0.0.1", help="llama-server host")
    parser.add_argument("--llama-port", type=int, default=8080, help="llama-server port")
    args = parser.parse_args()
    
    # Set environment variables for startup
    os.environ["LLAMA_HOST"] = args.llama_host
    os.environ["LLAMA_PORT"] = str(args.llama_port)
    
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
