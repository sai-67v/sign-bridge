"""
Configuration management for Canis.

Provides centralized configuration from environment variables and defaults.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class CanisConfig:
    """Configuration for Canis engine and server."""
    
    llama_host: str = "127.0.0.1"
    llama_port: int = 8080
    timeout: int = 120
    pipelines_dir: Optional[str] = None
    server_host: str = "0.0.0.0"
    server_port: int = 5000
    
    @classmethod
    def from_env(cls) -> 'CanisConfig':
        """
        Create configuration from environment variables.
        
        Environment variables:
            LLAMA_HOST: llama-server host address (default: 127.0.0.1)
            LLAMA_PORT: llama-server port (default: 8080)
            CANIS_TIMEOUT: Request timeout in seconds (default: 120)
            CANIS_PIPELINES_DIR: Directory containing pipeline JSON files
            CANIS_HOST: Server host address (default: 0.0.0.0)
            CANIS_PORT: Server port (default: 5000)
        
        Returns:
            CanisConfig instance
        """
        return cls(
            llama_host=os.getenv("LLAMA_HOST", "127.0.0.1"),
            llama_port=int(os.getenv("LLAMA_PORT", "8080")),
            timeout=int(os.getenv("CANIS_TIMEOUT", "120")),
            pipelines_dir=os.getenv("CANIS_PIPELINES_DIR"),
            server_host=os.getenv("CANIS_HOST", "0.0.0.0"),
            server_port=int(os.getenv("CANIS_PORT", "5000"))
        )
