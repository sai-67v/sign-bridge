"""
Pipeline node implementations.

Each node type has a handler function that executes the node logic.
"""

import re
import time
from typing import Optional, TYPE_CHECKING

from canis.pipeline.schema import (
    ClassifierNode,
    GenerateNode,
    TerminalNode,
    TransformNode,
    ExtractorNode,
    ClarifyNode,
    BlockerNode,
    WhileLoopNode,
    ForLoopNode,
    ForEachLoopNode,
    ListExtractorNode,
)
from canis.utils.templating import interpolate

if TYPE_CHECKING:
    from canis.pipeline.executor import PipelineExecutor


# Node registry: maps node type to handler function
NODE_REGISTRY = {}


def register_node(name: str):
    """
    Decorator to register a node handler.
    
    Args:
        name: Node type name
    """
    def decorator(fn):
        NODE_REGISTRY[name] = fn
        return fn
    return decorator


def extract_classification(text: str, valid_classes: list[str]) -> str:
    """
    Extract classification from LLM output using multiple strategies.
    
    Tries in order:
    1. XML tags: <classification>value</classification> or nested <category>value</category>
    2. Code blocks: ```classification\nvalue\n```
    3. Triple quotes: '''value'''
    4. Exact match of valid class on last non-empty line
    5. Valid class found anywhere in last line
    6. First valid class found in entire text
    7. First word of text (fallback)
    
    Args:
        text: Input text from LLM
        valid_classes: List of valid classification values
    
    Returns:
        Classification string, lowercased
    """
    text = text.strip()
    if not text:
        return ""
    
    # Normalize valid classes to lowercase
    valid_set = {cls.lower() for cls in valid_classes}
    valid_set.add("*")  # Always include wildcard
    
    # Strategy 1a: XML tags <classification>value</classification>
    xml_match = re.search(r'<classification>\s*(\w+)\s*</classification>', text, re.IGNORECASE)
    if xml_match:
        value = xml_match.group(1).lower()
        if value in valid_set:
            return value
    
    # Strategy 1b: Nested XML like <category>value</category> or <subject>value</subject>
    for tag in ['category', 'subject', 'type', 'class']:
        xml_match = re.search(f'<{tag}>\s*(\w+)\s*</{tag}>', text, re.IGNORECASE)
        if xml_match:
            value = xml_match.group(1).lower()
            if value in valid_set:
                return value
    
    # Strategy 2: Code blocks ```classification\nvalue\n``` or ```value```
    code_match = re.search(r'```(?:classification)?\s*(\w+)\s*```', text, re.IGNORECASE | re.DOTALL)
    if code_match:
        value = code_match.group(1).strip().lower()
        if value in valid_set:
            return value
    
    # Strategy 3: Triple quotes '''value'''
    triple_match = re.search(r"'''(\w+)'''", text)
    if triple_match:
        value = triple_match.group(1).lower()
        if value in valid_set:
            return value
    
    # Strategy 4: Check last non-empty line for exact match
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if lines:
        last_line = lines[-1].lower()
        if last_line in valid_set:
            return last_line
        
        # Strategy 5: Check if any valid class appears in last line
        for valid_class in valid_set:
            if valid_class in last_line:
                return valid_class
    
    # Strategy 6: Search entire text for first valid class
    text_lower = text.lower()
    for valid_class in valid_set:
        if valid_class in text_lower:
            return valid_class
    
    # Strategy 7: Fallback - extract first word
    match = re.match(r'^(\w+)', text_lower)
    if match:
        return match.group(1)
    
    words = text_lower.split()
    return words[0] if words else ""


@register_node("classifier")
def execute_classifier(executor: 'PipelineExecutor', node: ClassifierNode) -> Optional[str]:
    """
    Execute classifier node.
    
    Generates text using LLM, extracts first word as classification,
    and routes to appropriate next node.
    
    Args:
        executor: Pipeline executor
        node: Classifier node definition
    
    Returns:
        Next node name or None
    """
    prompt = interpolate(node.prompt, executor.variables)
    
    # Apply adapter if specified
    if node.adapter:
        executor.engine.adapters.apply(node.adapter, node.alpha)
    else:
        executor.engine.adapters.clear()
    
    # Generate classification with streaming if callback available
    if executor.stream_callback:
        result_parts = []
        response = executor.engine.client.generate(
            prompt=prompt,
            max_tokens=node.max_tokens,
            temperature=node.temperature,
            stream=True
        )
        for chunk in response:
            executor.stream_callback(chunk)
            result_parts.append(chunk)
        result = "".join(result_parts)
    else:
        result = executor.engine.client.generate(
            prompt=prompt,
            max_tokens=node.max_tokens,
            temperature=node.temperature,
            stream=False
        )
    
    # Extract classification
    valid_classes = list(node.routes.keys())
    classification = extract_classification(result, valid_classes)
    
    # Store classification in output_var if specified
    if node.output_var:
        executor.variables[node.output_var] = classification
    
    # Update trace
    executor.trace[-1].classification = classification
    executor.trace[-1].adapter = node.adapter
    executor.trace[-1].alpha = node.alpha
    executor.trace[-1].output_preview = result[:100] if result else None
    
    # Route to next node (prefer exact match, then wildcard, then any route)
    next_node = node.routes.get(classification) or node.routes.get("*")
    if next_node is None and node.routes:
        next_node = next(iter(node.routes.values()), None)
    return next_node


@register_node("generate")
def execute_generate(executor: 'PipelineExecutor', node: GenerateNode) -> Optional[str]:
    """
    Execute generate node.
    
    Generates text using LLM with system and user prompts.
    
    Args:
        executor: Pipeline executor
        node: Generate node definition
    
    Returns:
        Next node name or None
    """
    # Apply adapter if specified
    if node.adapter:
        executor.engine.adapters.apply(node.adapter, node.alpha)
    else:
        executor.engine.adapters.clear()
    
    # Interpolate prompts
    system = interpolate(node.system_prompt, executor.variables) if node.system_prompt else None
    user = interpolate(node.user_prompt, executor.variables)
    
    # Debug: Show interpolated user prompt (helps debug template issues)
    if hasattr(executor, 'verbose_trace') and executor.verbose_trace and executor.stream_callback:
        executor.stream_callback(f"\n     [PROMPT]: {user[:300]}...\n     [OUTPUT]: ")
    
    # Generate output with streaming if callback available
    if executor.stream_callback:
        output_parts = []
        response = executor.engine.client.chat(
            system=system,
            user=user,
            max_tokens=node.max_tokens,
            temperature=node.temperature,
            stream=True
        )
        for chunk in response:
            executor.stream_callback(chunk)
            output_parts.append(chunk)
        output = "".join(output_parts)
    else:
        output = executor.engine.client.chat(
            system=system,
            user=user,
            max_tokens=node.max_tokens,
            temperature=node.temperature,
            stream=False
        )

    output = (output or "").strip()
    # Update variables
    executor.variables["last_output"] = output
    executor.variables["output"] = output
    
    # If output_var is specified, also store in that variable
    if node.output_var:
        executor.variables[node.output_var] = output
    
    # Update trace
    executor.trace[-1].output_preview = output[:100] if output else None
    executor.trace[-1].adapter = node.adapter
    executor.trace[-1].alpha = node.alpha
    
    return node.next


def execute_generate_stream(executor: 'PipelineExecutor', node: GenerateNode):
    """
    Execute generate node with streaming.
    
    Yields chunks and final result.
    """
    # Apply adapter if specified
    if node.adapter:
        executor.engine.adapters.apply(node.adapter, node.alpha)
    else:
        executor.engine.adapters.clear()
    
    # Interpolate prompts
    system = interpolate(node.system_prompt, executor.variables) if node.system_prompt else None
    user = interpolate(node.user_prompt, executor.variables)
    
    # Stream generation
    output_parts = []
    response = executor.engine.client.chat(
        system=system,
        user=user,
        max_tokens=node.max_tokens,
        temperature=node.temperature,
        stream=True
    )
    
    for chunk in response:
        output_parts.append(chunk)
        yield {"type": "chunk", "content": chunk}

    output = ("".join(output_parts) or "").strip()
    # Update variables
    executor.variables["last_output"] = output
    executor.variables["output"] = output
    # Update trace
    executor.trace[-1].output_preview = output[:100] if output else None
    executor.trace[-1].adapter = node.adapter
    executor.trace[-1].alpha = node.alpha
    
    yield {"type": "result", "next_node": node.next}


# Attach streaming method to generate handler
execute_generate.stream = execute_generate_stream


@register_node("terminal")
def execute_terminal(executor: 'PipelineExecutor', node: TerminalNode) -> None:
    """
    Execute terminal node.
    
    Ends pipeline execution.
    
    Args:
        executor: Pipeline executor
        node: Terminal node definition
    
    Returns:
        None (ends execution)
    """
    return None


@register_node("transform")
def execute_transform(executor: 'PipelineExecutor', node: TransformNode) -> Optional[str]:
    """
    Execute transform node.
    
    Applies transformation to input variable and stores in output variable.
    
    Args:
        executor: Pipeline executor
        node: Transform node definition
    
    Returns:
        Next node name or None
    """
    input_val = executor.variables.get(node.input_var, "")
    
    if node.operation == "regex":
        # Apply regex pattern
        if node.pattern:
            match = re.search(node.pattern, input_val)
            result = match.group(0) if match else ""
        else:
            result = input_val
    
    elif node.operation == "template":
        # Apply template
        result = interpolate(node.pattern or "", executor.variables)
    
    elif node.operation == "extract":
        # Extract using pattern
        if node.pattern:
            match = re.search(node.pattern, input_val)
            result = match.group(1) if match and match.groups() else ""
        else:
            result = input_val
    
    else:
        result = input_val
    
    # Store result
    executor.variables[node.output_var] = result
    
    # Special handling: if clearing awaiting_clarification, also reset clarify_attempts
    if node.output_var == "awaiting_clarification" and not result:
        session = getattr(executor, 'session_state', None)
        if session:
            session.reset_clarify_attempts()
    
    return node.next


@register_node("extractor")
def execute_extractor(executor: 'PipelineExecutor', node: ExtractorNode) -> Optional[str]:
    """
    Execute extractor node.
    
    Uses LLM to extract relevant context from a large source text based on user query.
    
    Args:
        executor: Pipeline executor
        node: Extractor node definition
    
    Returns:
        Next node name or clarify node if ambiguous
    """
    source_text = executor.variables.get(node.source_var, "")
    query = executor.variables.get(node.query_var, "")
    
    # If no source text, skip extraction
    if not source_text:
        executor.variables[node.output_var] = ""
        return node.next
    
    # Build extraction prompt
    if node.extraction_prompt:
        prompt = interpolate(node.extraction_prompt, executor.variables)
    else:
        # Default extraction prompt – make "1)" / "question 1" style references explicit
        prompt = f"""Extract the relevant section from this homework/notes.

TEXT:
{source_text}

QUERY: {query}

RULES:
- When the user says "1)" or "help with 1)" or "question 1", they mean the line in the text that STARTS with "1)" (e.g. "1) x² -1 = 0"). Extract that full line/task.
- Same for "2)", "3)", "a)", "b)" etc. – match the line that begins with that label.
- If query says "task b" or "b)" without section, check if there are multiple "b)" tasks in different sections.
- If multiple matches exist, respond ONLY: AMBIGUOUS: Section 1 Task b, Section 2 Task b, etc.
- If ONE clear match, extract just that task (include the task text only).
- If not found: NOT_FOUND

OUTPUT:"""
    
    # Generate extraction with LLM
    raw = executor.engine.client.generate(
        prompt=prompt,
        max_tokens=512,
        temperature=0.2,
        stream=False
    )
    result = (raw or "").strip()

    # Check if clarification needed
    if result.startswith("AMBIGUOUS:"):
        if node.clarify_node:
            # Store options for clarify node
            options_text = result.replace("AMBIGUOUS:", "").strip()
            executor.variables["clarify_options"] = options_text
            executor.variables[node.output_var] = ""
            return node.clarify_node
        else:
            # No clarify node, store as-is
            executor.variables[node.output_var] = result
    elif result.startswith("NOT_FOUND") or not result.strip():
        # Fallback: for short context, try to match "1)" / "2)" / "a)" in query to a line in source
        fallback = _extractor_fallback_short_context(source_text, query)
        if fallback:
            executor.variables[node.output_var] = fallback
        elif not executor.variables.get(node.output_var):
            executor.variables[node.output_var] = ""
        # else: keep the existing extracted context
    else:
        extracted = result.strip()
        # Only update if we actually extracted something meaningful
        if extracted:
            executor.variables[node.output_var] = extracted
        # else: keep existing context if extraction was empty
    
    # Update trace
    executor.trace[-1].output_preview = f"Extracted {len(executor.variables.get(node.output_var, ''))} chars"
    
    return node.next


def _extractor_fallback_short_context(source_text: str, query: str, max_source_len: int = 600) -> Optional[str]:
    """
    When the LLM returns NOT_FOUND, try to extract a matching line from short context.
    E.g. query "Could you help me with 1)?" → find line starting with "1)" in source.
    """
    if not source_text or len(source_text) > max_source_len:
        return None
    # Find patterns like "1)", "2)", "a)", "b)", "question 1", "task 2" in the query
    match = re.search(
        r"(?:question|task|help with|number)\s*(\d+)\)?|(\d+)\)|([a-z])\)",
        query,
        re.IGNORECASE,
    )
    if not match:
        return None
    num = match.group(1) or match.group(2)
    letter = match.group(3)
    # Build regex for a line starting with "1)" or "a)" etc.
    if num:
        prefix = re.escape(num) + r"\)"
    elif letter:
        prefix = re.escape(letter) + r"\)"
    else:
        return None
    line_re = re.compile(r"^\s*" + prefix + r"\s*.+", re.MULTILINE)
    found = line_re.search(source_text)
    if not found:
        return None
    line = found.group(0).strip()
    # Optionally include following lines until next numbered item or blank line
    start = found.end()
    rest = source_text[start:]
    next_item = re.search(r"^\s*(\d+\)|[a-z]\))\s*", rest, re.MULTILINE | re.IGNORECASE)
    if next_item:
        line += "\n" + rest[: next_item.start()].strip()
    elif rest.strip():
        line += "\n" + rest.strip()
    return line.strip()


@register_node("clarify")
def execute_clarify(executor: 'PipelineExecutor', node: ClarifyNode) -> Optional[str]:
    """
    Execute clarify node.
    
    Asks user for clarification and manages attempt counter.
    
    Args:
        executor: Pipeline executor
        node: Clarify node definition
    
    Returns:
        Next node name or fallback node if max attempts exceeded
    """
    session = getattr(executor, 'session_state', None)
    
    # Check if this is a RETURNING clarification attempt (user already saw prompt once)
    # We detect this by checking if awaiting_clarification was already set in a PREVIOUS run
    # If clarify_attempts > 0, user has already been asked and is responding
    if session:
        if session.clarify_attempts >= node.max_attempts:
            # Max attempts exceeded, route to fallback
            session.reset_clarify_attempts()
            return node.fallback_node
        
        # Increment for next time
        session.clarify_attempts += 1
    
    # Build clarification message
    clarify_text = interpolate(node.clarify_prompt, executor.variables)
    
    # Only add options if NOT already in the prompt template (avoid duplication)
    if node.options_var and f"{{{{{node.options_var}}}}}" not in node.clarify_prompt:
        options = executor.variables.get(node.options_var, "")
        if options:
            clarify_text += f"\n\n{options}"
    
    # Store as output for user to see
    executor.variables["output"] = clarify_text
    
    # Update trace
    executor.trace[-1].output_preview = "Clarification requested"
    
    # Mark that we need user input - the executor should handle this
    # For now, return next node (typically would pause for user input)
    return node.next


@register_node("blocker")
def execute_blocker(executor: 'PipelineExecutor', node: BlockerNode) -> Optional[str]:
    """
    Execute blocker node.
    
    Evaluates condition and can warn or stop the session based on topic jumping.
    
    Args:
        executor: Pipeline executor
        node: Blocker node definition
    
    Returns:
        Next node name or None if blocked
    """
    session = getattr(executor, 'session_state', None)
    
    # Check topic jump limit if specified
    if node.max_topic_jumps is not None and session:
        if len(session.topic_history) > node.max_topic_jumps:
            if node.action == "stop":
                session.block(node.block_message)
                executor.variables["output"] = node.block_message
                executor.trace[-1].output_preview = "Session blocked"
                return None  # Stop execution
            else:
                # Warn but continue
                executor.variables["output"] = f"⚠️ Warning: {node.block_message}"
                return node.next
    
    # Evaluate condition with LLM
    condition_prompt = interpolate(node.condition_prompt, executor.variables)
    
    result = executor.engine.client.generate(
        prompt=f"{condition_prompt}\n\nRespond with YES or NO:",
        max_tokens=10,
        temperature=0.1,
        stream=False
    )
    
    should_block = "yes" in result.lower()
    
    if should_block:
        if node.action == "stop":
            if session:
                session.block(node.block_message)
            executor.variables["output"] = node.block_message
            executor.trace[-1].output_preview = "Session blocked"
            return None  # Stop execution
        else:
            # Warn but continue
            warning = f"⚠️ Warning: {node.block_message}"
            current_output = executor.variables.get("output", "")
            executor.variables["output"] = f"{warning}\n\n{current_output}" if current_output else warning
            executor.trace[-1].output_preview = "Warning issued"
    
    return node.next


@register_node("list_extractor")
def execute_list_extractor(executor: 'PipelineExecutor', node: ListExtractorNode) -> Optional[str]:
    """
    Execute list extractor node.
    
    Extracts a list of items from text using LLM, wrapping each in <item></item> tags.
    
    Args:
        executor: Pipeline executor
        node: ListExtractorNode definition
    
    Returns:
        Next node name or None
    """
    source_text = executor.variables.get(node.source_var, "")
    
    if not source_text:
        executor.variables[node.output_var] = []
        return node.next
    
    # Apply adapter if specified
    if node.adapter:
        executor.engine.adapters.apply(node.adapter, node.alpha)
    else:
        executor.engine.adapters.clear()
    
    # Build extraction prompt
    if node.extraction_prompt:
        prompt = interpolate(node.extraction_prompt, executor.variables)
    else:
        # Default list extraction prompt
        prompt = f"""Extract all distinct items from the following text as a list.
Wrap each item in XML tags like this: <item>text here</item>

TEXT:
{source_text}

OUTPUT (one <item> per line):"""
    
    # Generate list extraction
    result = executor.engine.client.generate(
        prompt=prompt,
        max_tokens=node.max_tokens,
        temperature=node.temperature,
        stream=False
    )
    
    # Extract items from <item></item> tags
    items = re.findall(r'<item>(.*?)</item>', result, re.DOTALL)
    items = [item.strip() for item in items if item.strip()]
    
    # Store as list
    executor.variables[node.output_var] = items
    
    # Update trace
    executor.trace[-1].output_preview = f"Extracted {len(items)} items"
    executor.trace[-1].adapter = node.adapter
    executor.trace[-1].alpha = node.alpha
    
    return node.next


@register_node("while_loop")
def execute_while_loop(executor: 'PipelineExecutor', node: WhileLoopNode) -> Optional[str]:
    """
    Execute while loop node.
    
    Repeatedly executes body until condition classifier returns "break".
    The condition_node must be a classifier that routes to "continue" or "break".
    
    Args:
        executor: Pipeline executor
        node: WhileLoopNode definition
    
    Returns:
        Next node name after loop completes
    """
    iteration = 0
    
    while iteration < node.max_iterations:
        # Execute condition node (must be a classifier)
        condition_node_def = executor.pipeline.nodes.get(node.condition_node)
        if not condition_node_def:
            raise ValueError(f"Condition node '{node.condition_node}' not found")
        
        if condition_node_def.type != "classifier":
            raise ValueError(f"While loop condition must be a classifier node, got {condition_node_def.type}")
        
        # Store iteration count
        executor.variables["loop_iteration"] = iteration
        
        # Execute condition
        from canis.pipeline.schema import TraceEntry
        trace_entry = TraceEntry(
            node=node.condition_node,
            type="classifier",
            timestamp=time.time()
        )
        executor.trace.append(trace_entry)
        
        next_node = execute_classifier(executor, condition_node_def)
        
        # Check if we should break
        if next_node == "break" or not next_node:
            break
        
        # Execute loop body starting from body_node
        current = node.body_node
        body_iterations = 0
        
        while current and body_iterations < 1000:  # Safety limit for body
            # Check if we've looped back to condition (means continue to next iteration)
            if current == node.condition_node:
                break
            
            # Check if we're jumping outside the loop (break)
            if current == node.next:
                return current
            
            node_def = executor.pipeline.nodes.get(current)
            if not node_def:
                raise ValueError(f"Node '{current}' not found in pipeline")
            
            # Add trace
            trace_entry = TraceEntry(
                node=current,
                type=node_def.type,
                timestamp=time.time()
            )
            executor.trace.append(trace_entry)
            
            # Execute node
            handler = NODE_REGISTRY.get(node_def.type)
            if not handler:
                raise ValueError(f"No handler for node type '{node_def.type}'")
            
            current = handler(executor, node_def)
            body_iterations += 1
        
        iteration += 1
    
    # Update trace
    if executor.trace:
        executor.trace[-1].output_preview = f"Loop completed after {iteration} iterations"
    
    return node.next


@register_node("for_loop")
def execute_for_loop(executor: 'PipelineExecutor', node: ForLoopNode) -> Optional[str]:
    """
    Execute for loop node.
    
    Repeats body a fixed number of times.
    
    Args:
        executor: Pipeline executor
        node: ForLoopNode definition
    
    Returns:
        Next node name after loop completes
    """
    # Get number of iterations
    iterations_value = executor.variables.get(node.iterations_var, node.iterations_var)
    
    # Convert to int if it's a string number
    try:
        if isinstance(iterations_value, str):
            iterations = int(iterations_value)
        else:
            iterations = int(iterations_value)
    except (ValueError, TypeError):
        iterations = 0
    
    # Enforce safety limit
    iterations = min(iterations, node.max_iterations)
    
    for i in range(iterations):
        # Store current index
        executor.variables[node.index_var] = i
        
        # Execute loop body
        current = node.body_node
        body_iterations = 0
        
        while current and body_iterations < 1000:  # Safety limit
            # Check if we're jumping to the loop node again (shouldn't happen)
            if current == executor.trace[-1].node if executor.trace else None:
                break
            
            # Check if jumping outside the loop
            if current == node.next:
                return current
            
            node_def = executor.pipeline.nodes.get(current)
            if not node_def:
                raise ValueError(f"Node '{current}' not found in pipeline")
            
            # Add trace
            from canis.pipeline.schema import TraceEntry
            trace_entry = TraceEntry(
                node=current,
                type=node_def.type,
                timestamp=time.time()
            )
            executor.trace.append(trace_entry)
            
            # Execute node
            handler = NODE_REGISTRY.get(node_def.type)
            if not handler:
                raise ValueError(f"No handler for node type '{node_def.type}'")
            
            current = handler(executor, node_def)
            body_iterations += 1
    
    # Update trace
    if executor.trace:
        executor.trace[-1].output_preview = f"For loop completed {iterations} iterations"
    
    return node.next


@register_node("foreach_loop")
def execute_foreach_loop(executor: 'PipelineExecutor', node: ForEachLoopNode) -> Optional[str]:
    """
    Execute foreach loop node.
    
    Iterates over a list, executing body for each item.
    Results can be accumulated in an optional accumulator variable.
    
    Args:
        executor: Pipeline executor
        node: ForEachLoopNode definition
    
    Returns:
        Next node name after loop completes
    """
    # Get the list to iterate over
    items = executor.variables.get(node.list_var, [])
    
    if not isinstance(items, list):
        items = []
    
    # Enforce safety limit
    items = items[:node.max_iterations]
    
    # Initialize accumulator if specified
    if node.accumulator_var:
        executor.variables[node.accumulator_var] = []
    
    for idx, item in enumerate(items):
        # Store current item and index
        executor.variables[node.item_var] = item
        executor.variables[node.index_var] = idx
        
        # Execute loop body
        current = node.body_node
        body_iterations = 0
        
        while current and body_iterations < 1000:  # Safety limit
            # Check if jumping outside the loop
            if current == node.next:
                # Before breaking, collect accumulated result if needed
                if node.accumulator_var:
                    accumulated_item = executor.variables.get("output") or executor.variables.get("last_output")
                    if accumulated_item:
                        executor.variables[node.accumulator_var].append(accumulated_item)
                return current
            
            node_def = executor.pipeline.nodes.get(current)
            if not node_def:
                raise ValueError(f"Node '{current}' not found in pipeline")
            
            # Add trace
            from canis.pipeline.schema import TraceEntry
            trace_entry = TraceEntry(
                node=current,
                type=node_def.type,
                timestamp=time.time()
            )
            executor.trace.append(trace_entry)
            
            # Execute node
            handler = NODE_REGISTRY.get(node_def.type)
            if not handler:
                raise ValueError(f"No handler for node type '{node_def.type}'")
            
            current = handler(executor, node_def)
            body_iterations += 1
        
        # After body completes, accumulate result if needed
        if node.accumulator_var:
            # Collect the output from this iteration
            accumulated_item = executor.variables.get("output") or executor.variables.get("last_output")
            if accumulated_item:
                executor.variables[node.accumulator_var].append(accumulated_item)
                # Debug: print accumulated item
                if executor.trace_callback:
                    executor.trace_callback(f"  [accumulator] Item {idx}", "debug", "starting")
                    executor.trace_callback(f"  [accumulator] Collected: {str(accumulated_item)[:100]}...", "debug", "completed")
    
    # Update trace with accumulated results summary
    if executor.trace:
        accumulated_count = len(executor.variables.get(node.accumulator_var, [])) if node.accumulator_var else 0
        accumulated_preview = ""
        if node.accumulator_var and accumulated_count > 0:
            accumulated_preview = f" | Accumulated {accumulated_count} results in '{node.accumulator_var}'"
        executor.trace[-1].output_preview = f"ForEach loop completed {len(items)} iterations{accumulated_preview}"
    
    return node.next
