"""
Canis CLI v4 - Pipeline-enabled interactive interface.

Usage:
    python -m canis.interfaces.cli --host 127.0.0.1 --port 8080
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Optional

from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
from prompt_toolkit.completion import Completer, Completion
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.syntax import Syntax

from canis.core.engine import CanisEngine
from canis.pipeline.session import SessionState


BANNER = r"""
[dim]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/dim]
                   [bold #5165E2] ██████╗[/][bold #5165E2]  █████╗[/][bold #6A4FE5] ███╗   ██╗[/][bold #6A4FE5]██╗[/][bold #8439E8]███████╗[/]
                   [bold #5165E2]██╔════╝[/][bold #6A4FE5] ██╔══██╗[/][bold #6A4FE5]████╗  ██║[/][bold #8439E8]██║[/][bold #8439E8]██╔════╝[/]
                   [bold #6A4FE5]██║     [/][bold #6A4FE5] ███████║[/][bold #8439E8]██╔██╗ ██║[/][bold #8439E8]██║[/][bold #9E23EB]███████╗[/]
                   [bold #6A4FE5]██║     [/][bold #8439E8] ██╔══██║[/][bold #8439E8]██║╚██╗██║[/][bold #9E23EB]██║[/][bold #9E23EB]╚════██║[/]
                   [bold #8439E8]╚██████╗[/][bold #8439E8] ██║  ██║[/][bold #9E23EB]██║ ╚████║[/][bold #9E23EB]██║[/][bold #B80DEE]███████║[/]
                   [bold #8439E8] ╚═════╝[/][bold #9E23EB] ╚═╝  ╚═╝[/][bold #9E23EB]╚═╝  ╚═══╝[/][bold #B80DEE]╚═╝[/][bold #B80DEE]╚══════╝[/]
[dim]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/dim]
         [dim]Declarative Pipelines • LoRA Hot-Swap • Jugend Forscht[/dim]
"""

HELP_TEXT = """
[bold cyan]Pipeline Commands:[/bold cyan]
  [green]/pipeline load <file>[/green]          Load pipeline from file
  [green]/pipeline list[/green]                List loaded pipelines
  [green]/pipeline run <name>[/green]          Enter pipeline chat mode
  [green]/pipeline use <name>[/green]          Quick switch to pipeline (alias for run)
  [green]/pipeline unload <name>[/green]       Unload a pipeline
  [green]/pipeline vars[/green]                Show current variables
  [green]/pipeline set <key> <value>[/green]   Set runtime variable
  [green]/var <key> <value>[/green]            Quick set variable (shortcut)

[bold cyan]Context Commands:[/bold cyan]
  [green]/context load <file>[/green]          Load notes/context from file
  [green]/context clear[/green]                Clear loaded context
  [green]/context show[/green]                 Show current context

[bold cyan]Session Commands:[/bold cyan]
  [green]/session save <file.json>[/green]     Save chat history for analysis
  [green]/session reset[/green]                Reset session state (clear history, unblock)
  [green]/session show[/green]                 Show session statistics

[bold cyan]Adapter Commands:[/bold cyan]
  [green]/adapter list[/green]                 List available adapters
  [green]/adapter use <name>[/green]           Switch to adapter
  [green]/adapter alpha <0.0-1.0>[/green]      Set adapter strength
  [green]/adapter off[/green]                  Disable all adapters
  [green]/compare <adapter1,adapter2,...>[/green] Compare adapters side-by-side (use 'base' for base model)

[bold cyan]General Commands:[/bold cyan]
  [green]/help[/green]                         Show this help message
  [green]/clear[/green]                        Clear screen
  [green]/exit[/green]                         Exit Canis CLI

[bold cyan]Tips:[/bold cyan]
  • In pipeline mode, all inputs go through the pipeline
  • Use variables like {{context}} in pipeline definitions
  • Sessions track chat history and persistent variables
  • Save sessions with /session save for teacher analysis
  • Press [bold]Ctrl+C[/bold] to cancel generation
  • Use [bold]↑/↓[/bold] for command history
"""


class CanisCompleter(Completer):
    """Command and file completer."""
    def __init__(self, cli):
        self.cli = cli
        self.commands = [
            "pipeline", "context", "adapter", "var", "compare", "session", "help", "clear", "exit"
        ]
        self.pipeline_subcommands = ["load", "list", "run", "use", "unload", "vars", "set"]
        self.context_subcommands = ["load", "clear", "show"]
        self.adapter_subcommands = ["list", "use", "alpha", "off"]
        self.session_subcommands = ["save", "reset", "show"]
    
    def get_completions(self, document, complete_event):
        text = document.text_before_cursor.lstrip()
        
        if not text.startswith("/"):
            return
        
        parts = text[1:].split()
        
        if len(parts) == 0:
            # Complete main commands
            for cmd in self.commands:
                yield Completion(cmd, start_position=0)
        
        elif len(parts) == 1:
            # Complete main commands or subcommands
            partial = parts[0].lower()
            
            if "/" + partial == text:
                # Still typing main command
                for cmd in self.commands:
                    if cmd.startswith(partial):
                        yield Completion(cmd, start_position=-len(partial))
            else:
                # Typing subcommand
                if parts[0] == "pipeline":
                    for sub in self.pipeline_subcommands:
                        yield Completion(sub, start_position=0)
                elif parts[0] == "context":
                    for sub in self.context_subcommands:
                        yield Completion(sub, start_position=0)
                elif parts[0] == "adapter":
                    for sub in self.adapter_subcommands:
                        yield Completion(sub, start_position=0)
                elif parts[0] == "session":
                    for sub in self.session_subcommands:
                        yield Completion(sub, start_position=0)
        
        elif len(parts) >= 2:
            # Complete arguments
            if parts[0] == "pipeline" and parts[1] in ("run", "use"):
                # Complete pipeline names
                partial = parts[2] if len(parts) > 2 else ""
                for name in self.cli.engine.pipelines.keys():
                    if name.startswith(partial):
                        yield Completion(name, start_position=-len(partial))
            
            elif parts[0] == "pipeline" and parts[1] == "set":
                # Complete variable names from current pipeline
                if self.cli.current_pipeline:
                    partial = parts[2] if len(parts) > 2 else ""
                    pipeline = self.cli.engine.get_pipeline(self.cli.current_pipeline)
                    if pipeline:
                        for var_name in pipeline.variables.keys():
                            if var_name.startswith(partial):
                                yield Completion(var_name, start_position=-len(partial))
            
            elif parts[0] == "var":
                # Complete variable names from current pipeline (shortcut command)
                if self.cli.current_pipeline:
                    partial = parts[1] if len(parts) > 1 else ""
                    pipeline = self.cli.engine.get_pipeline(self.cli.current_pipeline)
                    if pipeline:
                        for var_name in pipeline.variables.keys():
                            if var_name.startswith(partial):
                                yield Completion(var_name, start_position=-len(partial))
            
            elif parts[0] == "adapter" and parts[1] == "use":
                # Complete adapter names
                partial = parts[2] if len(parts) > 2 else ""
                for adapter in self.cli.engine.list_adapters():
                    if adapter.name.startswith(partial):
                        yield Completion(adapter.name, start_position=-len(partial))


class CanisCLIv4:
    """Main CLI application with pipeline support."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8080):
        self.console = Console()
        self.engine = CanisEngine(llama_host=host, llama_port=port)
        
        # CLI state
        self.current_pipeline: Optional[str] = None
        self.pipeline_variables: dict = {}
        self.pipeline_sessions: dict[str, SessionState] = {}  # Per-pipeline session state
        self.context_text: str = ""
        self.last_result = None
        self.compare_mode: Optional[list] = None  # List of adapter names to compare
        self.verbose_trace: bool = False  # If True, show interpolated prompts and accumulator contents
        
        # Pipeline discovery paths
        self.pipeline_dirs = [
            Path("examples"),
            Path("pipelines"),
            Path("."),
        ]
    
    def show_banner(self):
        self.console.print(BANNER)
    
    def initialize(self) -> bool:
        """Initialize engine and connect to server."""
        self.console.print()
        self.console.print("[bold yellow]Initializing Canis Engine...[/bold yellow]")
        self.console.print(f"[dim]   Server: http://{self.engine.client.host}:{self.engine.client.port}[/dim]")
        self.console.print()
        
        if not self.engine.initialize():
            self.console.print("[red]✗ Cannot connect to llama-server[/red]")
            self.console.print()
            self.console.print("[yellow]Make sure llama-server is running:[/yellow]")
            self.console.print(f"[dim]  llama-server --model <model.gguf> --host {self.engine.client.host} --port {self.engine.client.port}[/dim]")
            return False
        
        self.console.print("[green]✓ Connected to llama-server[/green]")
        
        adapters = self.engine.list_adapters()
        if adapters:
            self.console.print(f"[green]✓ Found {len(adapters)} LoRA adapters[/green]")
            for adapter in adapters:
                self.console.print(f"  [dim]• {adapter.name}[/dim]")
            # Clear all adapters at startup to ensure base model is used by default
            self.engine.adapters.clear()
            self.console.print("[dim]  (All adapters disabled - using base model)[/dim]")
        else:
            self.console.print("[yellow]⚠ No LoRA adapters loaded[/yellow]")
        
        # Auto-discover and load pipelines
        self.console.print()
        loaded_count = self._auto_load_pipelines()
        if loaded_count > 0:
            self.console.print(f"[green]✓ Auto-loaded {loaded_count} pipeline{'s' if loaded_count != 1 else ''}[/green]")
            for pipeline in self.engine.list_pipelines():
                self.console.print(f"  [dim]• {pipeline['name']}[/dim]")
        else:
            self.console.print("[dim]  No pipelines found[/dim]")
        
        self.console.print()
        return True
    
    def _auto_load_pipelines(self) -> int:
        """Auto-discover and load pipelines from known directories."""
        loaded = 0
        
        for pipeline_dir in self.pipeline_dirs:
            if not pipeline_dir.exists():
                continue
            
            # Find all .json files
            for json_file in pipeline_dir.glob("*.json"):
                try:
                    pipeline_id = self.engine.load_pipeline(str(json_file))
                    loaded += 1
                except Exception:
                    # Silently skip invalid pipeline files
                    pass
        
        return loaded
    
    def get_prompt_text(self) -> str:
        """Get prompt prefix based on mode."""
        if self.compare_mode:
            return f"[compare:{','.join(self.compare_mode)}]"
        elif self.current_pipeline:
            return f"[{self.current_pipeline}]"
        else:
            adapter_info = self.engine.get_current_adapter()
            if adapter_info["adapter"]:
                return f"[{adapter_info['adapter']}@{adapter_info['alpha']}]"
            return "[base]"
    
    # ==================== Pipeline Commands ====================
    
    def cmd_pipeline_load(self, path: str):
        """Load pipeline from file."""
        if not path:
            self.console.print("[yellow]Usage: /pipeline load <file.json>[/yellow]")
            return
        
        try:
            pipeline_id = self.engine.load_pipeline(path)
            self.console.print(f"[green]✓ Loaded pipeline '{pipeline_id}'[/green]")
            
            # Show pipeline info
            pipeline = self.engine.get_pipeline(pipeline_id)
            if pipeline:
                self.console.print(f"[dim]  Description: {pipeline.description}[/dim]")
                self.console.print(f"[dim]  Nodes: {len(pipeline.nodes)}[/dim]")
                self.console.print(f"[dim]  Variables: {', '.join(pipeline.variables.keys()) or 'none'}[/dim]")
        
        except FileNotFoundError as e:
            self.console.print(f"[red]✗ {e}[/red]")
        except ValueError as e:
            self.console.print(f"[red]✗ {e}[/red]")
    
    def cmd_pipeline_list(self):
        """List loaded pipelines."""
        pipelines = self.engine.list_pipelines()
        
        if not pipelines:
            self.console.print("[dim]No pipelines loaded[/dim]")
            return
        
        table = Table(title="Loaded Pipelines", show_header=True)
        table.add_column("Name", style="cyan")
        table.add_column("Description", style="white")
        table.add_column("Active", style="green")
        
        for p in pipelines:
            active = "●" if p["id"] == self.current_pipeline else ""
            table.add_row(p["name"], p["description"], active)
        
        self.console.print(table)
    
    def cmd_pipeline_run(self, name: str):
        """Enter pipeline mode."""
        if not name:
            self.console.print("[yellow]Usage: /pipeline run <name>[/yellow]")
            return
        
        if name not in self.engine.pipelines:
            self.console.print(f"[red]Pipeline '{name}' not found[/red]")
            self.console.print("[dim]Use /pipeline list to see loaded pipelines[/dim]")
            return
        
        self.current_pipeline = name
        self.pipeline_variables = {"context": self.context_text}
        
        # Initialize session state if not exists
        if name not in self.pipeline_sessions:
            pipeline = self.engine.get_pipeline(name)
            self.pipeline_sessions[name] = SessionState(
                pipeline_name=name,
                student_name=self.pipeline_variables.get("student_name", "Student")
            )
        
        self.console.print(f"[green]✓ Entered pipeline mode: {name}[/green]")
        self.console.print("[dim]  All inputs will be processed through this pipeline[/dim]")
        self.console.print("[dim]  Use /pipeline vars to see variables[/dim]")
        self.console.print("[dim]  Use /session commands to manage session state[/dim]")
        self.console.print("[dim]  Type regular text to exit pipeline mode[/dim]")
    
    def cmd_pipeline_unload(self, name: str):
        """Unload pipeline."""
        if not name:
            self.console.print("[yellow]Usage: /pipeline unload <name>[/yellow]")
            return
        
        if self.engine.unload_pipeline(name):
            self.console.print(f"[green]✓ Unloaded pipeline '{name}'[/green]")
            if self.current_pipeline == name:
                self.current_pipeline = None
        else:
            self.console.print(f"[red]Pipeline '{name}' not found[/red]")
    
    def cmd_pipeline_trace(self):
        """Show last execution trace."""
        if not self.last_result or not self.last_result.trace:
            self.console.print("[dim]No execution trace available[/dim]")
            return
        
        table = Table(title="Last Pipeline Execution Trace", show_header=True)
        table.add_column("Step", style="dim")
        table.add_column("Node", style="cyan")
        table.add_column("Type", style="yellow")
        table.add_column("Details", style="white")
        
        for i, entry in enumerate(self.last_result.trace, 1):
            details = []
            if entry.classification:
                details.append(f"→ {entry.classification}")
            if entry.adapter:
                details.append(f"adapter={entry.adapter} α={entry.alpha}")
            if entry.output_preview:
                details.append(f"output: {entry.output_preview[:50]}...")
            
            table.add_row(
                str(i),
                entry.node,
                entry.type,
                " | ".join(details) if details else "-"
            )
        
        self.console.print(table)
        self.console.print(f"[dim]Elapsed: {self.last_result.elapsed_time:.2f}s[/dim]")
    
    def cmd_trace_verbose(self):
        """Toggle verbose trace mode."""
        self.verbose_trace = not self.verbose_trace
        status = "[green]ON[/green]" if self.verbose_trace else "[red]OFF[/red]"
        self.console.print(f"[cyan]Verbose trace:[/cyan] {status}")
        if self.verbose_trace:
            self.console.print("[dim]  Will show interpolated prompts and accumulator contents[/dim]")
    
    def cmd_pipeline_vars(self):
        """Show pipeline variables."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode[/yellow]")
            return
        
        if not self.pipeline_variables:
            self.console.print("[dim]No variables set[/dim]")
            return
        
        table = Table(title="Pipeline Variables", show_header=False)
        table.add_column("Variable", style="cyan")
        table.add_column("Value", style="white")
        
        for key, value in self.pipeline_variables.items():
            value_str = str(value)[:100] + "..." if len(str(value)) > 100 else str(value)
            table.add_row(key, value_str)
        
        self.console.print(table)
    
    def cmd_pipeline_set(self, args: str):
        """Set pipeline variable."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode[/yellow]")
            return
        
        parts = args.split(maxsplit=1)
        if len(parts) < 2:
            self.console.print("[yellow]Usage: /pipeline set <key> <value>[/yellow]")
            return
        
        key, value = parts
        self.pipeline_variables[key] = value
        self.console.print(f"[green]✓ Set {key} = {value[:50]}{'...' if len(value) > 50 else ''}[/green]")
    
    # ==================== Context Commands ====================
    
    def cmd_context_load(self, path: str):
        """Load context from file."""
        if not path:
            self.console.print("[yellow]Usage: /context load <file>[/yellow]")
            return
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                self.context_text = f.read()
            
            self.console.print(f"[green]✓ Loaded context from {path}[/green]")
            self.console.print(f"[dim]  {len(self.context_text)} characters[/dim]")
            
            # Update pipeline variables if in pipeline mode
            if self.current_pipeline:
                self.pipeline_variables["context"] = self.context_text
        
        except FileNotFoundError:
            self.console.print(f"[red]File not found: {path}[/red]")
        except Exception as e:
            self.console.print(f"[red]Error loading file: {e}[/red]")
    
    def cmd_context_clear(self):
        """Clear context."""
        self.context_text = ""
        if self.current_pipeline:
            self.pipeline_variables["context"] = ""
        self.console.print("[green]✓ Context cleared[/green]")
    
    def cmd_context_show(self):
        """Show current context."""
        if not self.context_text:
            self.console.print("[dim]No context loaded[/dim]")
            return
        
        preview = self.context_text[:500] + "..." if len(self.context_text) > 500 else self.context_text
        self.console.print(Panel(preview, title=f"Context ({len(self.context_text)} chars)", border_style="cyan"))
    
    # ==================== Adapter Commands ====================
    
    def cmd_adapter_list(self):
        """List available adapters."""
        self.engine.adapters.refresh()
        adapters = self.engine.list_adapters()
        
        if not adapters:
            self.console.print("[yellow]No adapters loaded on server[/yellow]")
            return
        
        table = Table(title="Available Adapters", show_header=True)
        table.add_column("ID", style="dim")
        table.add_column("Name", style="cyan")
        table.add_column("Scale", style="yellow")
        table.add_column("Active", style="green")
        
        current = self.engine.get_current_adapter()
        
        for adapter in adapters:
            active = "●" if adapter.name == current["adapter"] else ""
            table.add_row(
                str(adapter.id),
                adapter.name,
                f"{adapter.scale:.2f}",
                active
            )
        
        self.console.print(table)
    
    def cmd_adapter_use(self, name: str):
        """Switch to adapter."""
        if not name:
            self.console.print("[yellow]Usage: /adapter use <name>[/yellow]")
            return
        
        if not self.engine.adapters.adapter_exists(name):
            self.console.print(f"[red]Adapter '{name}' not found[/red]")
            adapters = self.engine.list_adapters()
            self.console.print(f"[dim]Available: {', '.join(a.name for a in adapters)}[/dim]")
            return
        
        # Use current alpha if already set, otherwise default to 1.0
        current = self.engine.get_current_adapter()
        alpha = current["alpha"] if current["adapter"] else 1.0
        
        if self.engine.apply_adapter(name, alpha):
            self.console.print(f"[green]✓ Switched to adapter '{name}'[/green]")
        else:
            self.console.print("[red]Failed to switch adapter[/red]")
    
    def cmd_adapter_alpha(self, value: str):
        """Set adapter alpha."""
        try:
            alpha = float(value)
            if not 0.0 <= alpha <= 1.0:
                self.console.print("[red]Alpha must be between 0.0 and 1.0[/red]")
                return
            
            current = self.engine.get_current_adapter()
            if current["adapter"]:
                self.engine.adapters.set_alpha(alpha)
                self.console.print(f"[green]✓ Alpha set to {alpha}[/green]")
            else:
                self.console.print("[yellow]No adapter active[/yellow]")
        
        except ValueError:
            self.console.print("[red]Invalid alpha value[/red]")
    
    def cmd_adapter_off(self):
        """Disable all adapters."""
        if self.engine.apply_adapter(None):
            self.console.print("[green]✓ All adapters disabled[/green]")
        else:
            self.console.print("[red]Failed to disable adapters[/red]")
    
    # ==================== Session Commands ====================
    
    def cmd_session_save(self, path: str):
        """Save current session to file."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode[/yellow]")
            return
        
        if not path:
            self.console.print("[yellow]Usage: /session save <file.json>[/yellow]")
            return
        
        session = self.pipeline_sessions.get(self.current_pipeline)
        if not session:
            self.console.print("[yellow]No session data to save[/yellow]")
            return
        
        try:
            session.save_to_file(path)
            self.console.print(f"[green]✓ Session saved to {path}[/green]")
            summary = session.get_summary()
            self.console.print(f"[dim]  Messages: {summary['messages']} | Topics: {summary['topics']}[/dim]")
        except Exception as e:
            self.console.print(f"[red]Error saving session: {e}[/red]")
    
    def cmd_session_reset(self):
        """Reset current session state."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode[/yellow]")
            return
        
        if self.current_pipeline in self.pipeline_sessions:
            # Create fresh session
            self.pipeline_sessions[self.current_pipeline] = SessionState(
                pipeline_name=self.current_pipeline,
                student_name=self.pipeline_variables.get("student_name", "Student")
            )
            self.console.print("[green]✓ Session reset[/green]")
        else:
            self.console.print("[dim]No active session to reset[/dim]")
    
    def cmd_session_show(self):
        """Show current session state."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode[/yellow]")
            return
        
        session = self.pipeline_sessions.get(self.current_pipeline)
        if not session:
            self.console.print("[dim]No active session[/dim]")
            return
        
        summary = session.get_summary()
        
        table = Table(title=f"Session: {self.current_pipeline}", show_header=False)
        table.add_column("Property", style="cyan")
        table.add_column("Value", style="white")
        
        table.add_row("Student", summary["student"])
        table.add_row("Messages", str(summary["messages"]))
        table.add_row("Topic Changes", str(summary["topics"]))
        table.add_row("Persistent Vars", str(summary["persistent_vars"]))
        table.add_row("Init Nodes Run", str(summary["init_nodes_executed"]))
        table.add_row("Blocked", "🔴 Yes" if summary["blocked"] else "🟢 No")
        
        if session.blocked:
            table.add_row("Block Reason", session.block_reason or "Unknown")
        
        self.console.print(table)
        
        # Show topic history if exists
        if session.topic_history:
            self.console.print()
            self.console.print("[cyan]Topic History:[/cyan]")
            for i, topic in enumerate(session.topic_history, 1):
                self.console.print(f"  {i}. {topic}")
    
    # ==================== General Commands ====================
    
    def cmd_help(self):
        """Show help."""
        self.console.print(Panel(HELP_TEXT, title="Canis CLI v4 Help", border_style="cyan"))
    
    def cmd_clear(self):
        """Clear screen."""
        self.console.clear()
        self.show_banner()
    def cmd_var(self, args: str):
        """Quick variable set (shortcut for /pipeline set)."""
        if not self.current_pipeline:
            self.console.print("[yellow]Not in pipeline mode. Use /pipeline run <name> first.[/yellow]")
            return
        
        parts = args.split(maxsplit=1)
        if len(parts) < 2:
            self.console.print("[yellow]Usage: /var <key> <value>[/yellow]")
            return
        
        key, value = parts
        self.pipeline_variables[key] = value
        self.console.print(f"[green]✓ Set {key} = {value[:50]}{'...' if len(value) > 50 else ''}[/green]")
    
    def cmd_compare(self, args: str):
        """Enable compare mode with multiple adapters."""
        if not args:
            self.console.print("[yellow]Usage: /compare <adapter1,adapter2,...> or /compare off[/yellow]")
            self.console.print("[dim]Example: /compare base,math,science[/dim]")
            self.console.print("[dim]Use 'base' for base model without adapters[/dim]")
            return
        
        if args.lower() == "off":
            self.compare_mode = None
            self.console.print("[green]✓ Compare mode disabled[/green]")
            return
        
        # Parse adapter list
        adapters = [a.strip() for a in args.split(",")]
        
        # Validate adapters (except 'base')
        invalid = []
        for adapter in adapters:
            if adapter != "base" and not self.engine.adapters.adapter_exists(adapter):
                invalid.append(adapter)
        
        if invalid:
            self.console.print(f"[red]Unknown adapters: {', '.join(invalid)}[/red]")
            self.console.print("[dim]Use /adapter list to see available adapters[/dim]")
            return
        
        self.compare_mode = adapters
        self.console.print(f"[green]✓ Compare mode enabled: {', '.join(adapters)}[/green]")
        self.console.print("[dim]All inputs will generate responses from each adapter[/dim]")
    
    # ==================== Input Processing ====================
    # ==================== Input Processing ====================
    
    def process_command(self, line: str) -> bool:
        """
        Process command line.
        
        Returns:
            False to exit, True to continue
        """
        parts = line[1:].split(maxsplit=2)
        if not parts:
            return True
        
        cmd = parts[0].lower()
        subcmd = parts[1].lower() if len(parts) > 1 else ""
        args = parts[2] if len(parts) > 2 else ""
        
        # Exit commands
        if cmd in ("exit", "quit", "q"):
            return False
        
        # Help
        elif cmd == "help":
            self.cmd_help()
        
        # Clear
        elif cmd == "clear":
            self.cmd_clear()
        
        # Quick variable set
        elif cmd == "var":
            self.cmd_var(subcmd + " " + args if args else subcmd)
        
        # Pipeline commands
        elif cmd == "pipeline":
            if subcmd == "load":
                self.cmd_pipeline_load(args)
            elif subcmd == "list":
                self.cmd_pipeline_list()
            elif subcmd in ("run", "use"):  # Support both run and use
                self.cmd_pipeline_run(args)
            elif subcmd == "unload":
                self.cmd_pipeline_unload(args)
            elif subcmd == "vars":
                self.cmd_pipeline_vars()
            elif subcmd == "set":
                self.cmd_pipeline_set(args)
            else:
                self.console.print(f"[red]Unknown pipeline command: {subcmd}[/red]")
        
        # Context commands
        elif cmd == "context":
            if subcmd == "load":
                self.cmd_context_load(args)
            elif subcmd == "clear":
                self.cmd_context_clear()
            elif subcmd == "show":
                self.cmd_context_show()
            else:
                self.console.print(f"[red]Unknown context command: {subcmd}[/red]")
        
        # Adapter commands
        elif cmd == "adapter":
            if subcmd == "list":
                self.cmd_adapter_list()
            elif subcmd == "use":
                self.cmd_adapter_use(args)
            elif subcmd == "alpha":
                self.cmd_adapter_alpha(args)
            elif subcmd == "off":
                self.cmd_adapter_off()
            else:
                self.console.print(f"[red]Unknown adapter command: {subcmd}[/red]")
        
        # Session commands
        elif cmd == "session":
            if subcmd == "save":
                self.cmd_session_save(args)
            elif subcmd == "reset":
                self.cmd_session_reset()
            elif subcmd == "show":
                self.cmd_session_show()
            else:
                self.console.print(f"[red]Unknown session command: {subcmd}[/red]")
        
        # Trace commands
        elif cmd == "trace":
            if subcmd == "verbose":
                self.cmd_trace_verbose()
            elif subcmd == "show" or not subcmd:
                self.cmd_pipeline_trace()
            else:
                self.console.print(f"[red]Unknown trace command: {subcmd}[/red]")
        
        # Compare mode
        elif cmd == "compare":
            self.cmd_compare(subcmd + " " + args if args else subcmd)
        
        else:
            self.console.print(f"[red]Unknown command: {cmd}[/red]")
            self.console.print("[dim]Type /help for available commands[/dim]")
        
        return True
    
    def process_input(self, text: str):
        """Process user input (pipeline or direct)."""
        if self.current_pipeline:
            # Run through pipeline with live tracing
            # Save current adapter state to restore after pipeline execution
            saved_adapter = self.engine.get_current_adapter()
            
            try:
                self.console.print()
                self.console.print("[bold cyan]🐕 Processing through pipeline...[/bold cyan]")
                self.console.print()
                
                # Track live node execution
                live_status = {}
                current_node_output_started = False
                
                def trace_callback(node_name: str, node_type: str, status: str):
                    """Display live node execution status."""
                    nonlocal current_node_output_started
                    if status == "starting":
                        # Show node starting
                        icon = {"classifier": "🔀", "generate": "✨", "terminal": "🎯", "transform": "⚙️"}.get(node_type, "▶️")
                        self.console.print(f"  {icon} [cyan]{node_name}[/cyan] [dim]({node_type})[/dim] [yellow]→ executing...[/yellow]")
                        live_status[node_name] = time.time()
                        current_node_output_started = False
                        
                        # Show output label for generate/classifier nodes
                        if node_type in ("generate", "classifier"):
                            self.console.print(f"     [dim]output:[/dim] ", end="")
                            current_node_output_started = True
                    elif status == "completed":
                        # Show node completed with duration
                        if current_node_output_started:
                            self.console.print()  # New line after streamed output
                        elapsed = time.time() - live_status.get(node_name, time.time())
                        self.console.print(f"     [green]✓[/green] [dim]completed in {elapsed:.2f}s[/dim]")
                        current_node_output_started = False
                
                def stream_callback(chunk: str):
                    """Display streaming token output."""
                    self.console.print(chunk, end="", style="#888888")
                
                # Get session state for this pipeline
                session = self.pipeline_sessions.get(self.current_pipeline)
                
                result = self.engine.run_pipeline(
                    self.current_pipeline,
                    text,
                    self.pipeline_variables,
                    trace_callback=trace_callback,
                    stream_callback=stream_callback,
                    session_state=session,
                    verbose_trace=self.verbose_trace
                )
                
                self.last_result = result
                
                self.console.print()
                self.console.print("[bold cyan]🐕 Final Output:[/bold cyan]")
                self.console.print(result.output or "[dim]No output[/dim]")
                self.console.print()
                self.console.print(f"[dim]Total: {result.elapsed_time:.2f}s | Steps: {len(result.trace)}[/dim]")
                
                # Restore adapter state after pipeline execution
                if saved_adapter["adapter"]:
                    self.engine.adapters.apply(saved_adapter["adapter"], saved_adapter["alpha"])
                else:
                    self.engine.adapters.clear()
            
            except Exception as e:
                self.console.print(f"[red]Pipeline error: {e}[/red]")
                # Restore adapter state even on error
                if saved_adapter["adapter"]:
                    self.engine.adapters.apply(saved_adapter["adapter"], saved_adapter["alpha"])
                else:
                    self.engine.adapters.clear()
        
        elif self.compare_mode:
            # Compare mode: generate with multiple adapters
            # Save current adapter state to restore after comparison
            saved_adapter = self.engine.get_current_adapter()
            
            try:
                self.console.print()
                
                for i, adapter_name in enumerate(self.compare_mode):
                    # Set adapter
                    if adapter_name == "base":
                        self.engine.adapters.clear()
                        display_name = "Base Model"
                    else:
                        self.engine.apply_adapter(adapter_name, 1.0)
                        display_name = f"{adapter_name.title()} Adapter"
                    
                    # Show header
                    self.console.print(f"[bold cyan]━━━ {display_name} ━━━[/bold cyan]")
                    
                    start_time = time.time()
                    token_count = 0
                    
                    # Stream response
                    response = self.engine.client.chat(
                        user=text,
                        max_tokens=512,
                        temperature=0.7,
                        stream=True
                    )
                    
                    for chunk in response:
                        self.console.print(chunk, end="")
                        token_count += 1
                    
                    elapsed = time.time() - start_time
                    tps = token_count / elapsed if elapsed > 0 else 0
                    
                    self.console.print()
                    self.console.print(f"[dim]~{token_count} tokens • {elapsed:.1f}s • {tps:.1f} tok/s[/dim]")
                    self.console.print()
                
                # Restore previous adapter state after comparison
                if saved_adapter["adapter"]:
                    self.engine.adapters.apply(saved_adapter["adapter"], saved_adapter["alpha"])
                else:
                    self.engine.adapters.clear()
            
            except KeyboardInterrupt:
                self.console.print("\n[yellow]⚠ Comparison cancelled[/yellow]")
                # Still restore adapter state on interrupt
                if saved_adapter["adapter"]:
                    self.engine.adapters.apply(saved_adapter["adapter"], saved_adapter["alpha"])
                else:
                    self.engine.adapters.clear()
            except Exception as e:
                self.console.print(f"\n[red]Comparison error: {e}[/red]")
        
        else:
            # Direct generation with streaming
            try:
                self.console.print()
                self.console.print("[bold cyan]🐕 Canis:[/bold cyan] ", end="")
                
                start_time = time.time()
                token_count = 0
                
                # Get current adapter config and ensure it's properly applied
                current = self.engine.get_current_adapter()
                if current["adapter"]:
                    # Re-apply the current adapter to ensure correct state
                    self.engine.adapters.apply(current["adapter"], current["alpha"])
                else:
                    # Clear adapters to ensure base model is used
                    self.engine.adapters.clear()
                
                # Stream from llama-server directly
                response = self.engine.client.chat(
                    user=text,
                    max_tokens=512,
                    temperature=0.7,
                    stream=True
                )
                
                for chunk in response:
                    self.console.print(chunk, end="")
                    token_count += 1
                
                elapsed = time.time() - start_time
                tps = token_count / elapsed if elapsed > 0 else 0
                
                self.console.print()
                self.console.print(f"[dim]   ~{token_count} tokens • {elapsed:.1f}s • {tps:.1f} tok/s[/dim]")
            
            except KeyboardInterrupt:
                self.console.print("\n[yellow]⚠ Generation cancelled[/yellow]")
            except Exception as e:
                self.console.print(f"\n[red]Generation error: {e}[/red]")
    
    def run(self):
        """Main CLI loop."""
        self.show_banner()
        
        if not self.initialize():
            sys.exit(1)
        
        session = PromptSession(
            history=FileHistory(".canis_history"),
            auto_suggest=AutoSuggestFromHistory(),
            completer=CanisCompleter(self),
        )
        
        consecutive_interrupts = 0
        
        while True:
            try:
                prompt_text = self.get_prompt_text()
                line = session.prompt(f"{prompt_text} > ").strip()
                
                consecutive_interrupts = 0  # Reset on successful input
                
                if not line:
                    continue
                
                if line.startswith("/"):
                    if not self.process_command(line):
                        break
                else:
                    self.process_input(line)
                
                self.console.print()
            
            except KeyboardInterrupt:
                consecutive_interrupts += 1
                if consecutive_interrupts >= 2:
                    self.console.print("\n[yellow]Exiting...[/yellow]")
                    break
                self.console.print("\n[dim]Press Ctrl+C again to quit or type /exit[/dim]")
            except EOFError:
                break
        
        self.console.print()
        self.console.print("[bold cyan]🐕 Goodbye from Canis v4![/bold cyan]")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Canis CLI v4 - Declarative Pipeline Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--host", default="127.0.0.1", help="llama-server host")
    parser.add_argument("--port", type=int, default=8080, help="llama-server port")
    args = parser.parse_args()
    
    cli = CanisCLIv4(host=args.host, port=args.port)
    cli.run()


if __name__ == "__main__":
    main()
