"""
Pipeline loader and validator.

Loads pipeline JSON files and validates them against schema.
"""

import json
from pathlib import Path
from typing import Union

from pydantic import ValidationError

from canis.pipeline.schema import Pipeline


def load_pipeline(path: Union[str, Path]) -> Pipeline:
    """
    Load and validate pipeline from JSON file.
    
    Args:
        path: Path to pipeline JSON file
    
    Returns:
        Validated Pipeline object
    
    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If JSON is invalid or validation fails
    """
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Pipeline file not found: {path}")
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in pipeline file: {e}")
    
    try:
        pipeline = Pipeline(**data)
    except ValidationError as e:
        raise ValueError(f"Pipeline validation failed: {e}")
    
    # Additional validation: check that entry_node exists
    if pipeline.entry_node not in pipeline.nodes:
        raise ValueError(f"Entry node '{pipeline.entry_node}' not found in nodes")
    
    # Check that all referenced nodes exist
    for node_name, node in pipeline.nodes.items():
        if node.type == "classifier":
            for route_name, next_node in node.routes.items():
                if next_node not in pipeline.nodes:
                    raise ValueError(
                        f"Node '{node_name}' routes to non-existent node '{next_node}'"
                    )
        elif node.type == "generate" and node.next:
            if node.next not in pipeline.nodes:
                raise ValueError(
                    f"Node '{node_name}' references non-existent next node '{node.next}'"
                )
        elif node.type == "transform" and node.next:
            if node.next not in pipeline.nodes:
                raise ValueError(
                    f"Node '{node_name}' references non-existent next node '{node.next}'"
                )
    
    return pipeline


def load_pipeline_from_dict(data: dict) -> Pipeline:
    """
    Load and validate pipeline from dictionary.
    
    Args:
        data: Pipeline definition as dict
    
    Returns:
        Validated Pipeline object
    
    Raises:
        ValueError: If validation fails
    """
    try:
        pipeline = Pipeline(**data)
    except ValidationError as e:
        raise ValueError(f"Pipeline validation failed: {e}")
    
    # Additional validation
    if pipeline.entry_node not in pipeline.nodes:
        raise ValueError(f"Entry node '{pipeline.entry_node}' not found in nodes")
    
    return pipeline
