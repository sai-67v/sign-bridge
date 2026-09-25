"""
HTTP client for llama-server API.

Provides clean interface for chat completions, generation, and streaming.
"""

import json
import time
from typing import Dict, List, Optional, Iterator, Any

import requests


class LlamaClient:
    """HTTP client for llama-server API."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8080, timeout: int = 120):
        """
        Initialize LlamaClient.
        
        Args:
            host: llama-server host address
            port: llama-server port
            timeout: Request timeout in seconds
        """
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout
    
    def check_health(self) -> bool:
        """
        Check if llama-server is running.
        
        Returns:
            True if server is healthy, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_health_status(self) -> Optional[Dict[str, Any]]:
        """
        Get server health information.
        
        Returns:
            Health status dict or None if unreachable
        """
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                return response.json() if response.text else {"status": "ok"}
            return None
        except requests.exceptions.RequestException:
            return None
    
    def chat(
        self,
        messages: Optional[List[Dict[str, str]]] = None,
        system: Optional[str] = None,
        user: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> str:
        """
        Send chat completion request (non-streaming).
        
        Args:
            messages: List of message dicts (system, user, assistant)
            system: System prompt (shortcut for single system message)
            user: User prompt (shortcut for single user message)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: If True, return iterator instead of string
        
        Returns:
            Generated text response
        """
        if messages is None:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            if user:
                messages.append({"role": "user", "content": user})
        
        if stream:
            return self._chat_stream(messages, max_tokens, temperature)
        
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            },
            timeout=self.timeout
        )
        
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    
    def _chat_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int,
        temperature: float,
    ) -> Iterator[str]:
        """
        Stream chat completion response.
        
        Yields:
            Text chunks as they arrive
        """
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": True,
            },
            stream=True,
            timeout=self.timeout
        )
        
        response.raise_for_status()
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line = line.decode("utf-8")
            if not line.startswith("data: "):
                continue
            
            data = line[6:]
            if data == "[DONE]":
                break
            
            try:
                chunk = json.loads(data)
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                content = delta.get("content", "")
                
                if content:
                    yield content
            except json.JSONDecodeError:
                continue
    
    def generate(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> str:
        """
        Simple text generation (wrapper around chat).
        
        Args:
            prompt: Text prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: If True, return iterator instead of string
        
        Returns:
            Generated text
        """
        return self.chat(
            user=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream,
        )
    
    def get_adapters(self) -> List[Dict[str, Any]]:
        """
        Fetch list of LoRA adapters from server.
        
        Returns:
            List of adapter dicts with id, path, scale
        """
        try:
            response = requests.get(f"{self.base_url}/lora-adapters", timeout=5)
            if response.status_code == 200:
                return response.json()
            return []
        except requests.exceptions.RequestException:
            return []
    
    def set_adapter_scales(self, scales: List[Dict[str, Any]]) -> bool:
        """
        Set adapter scales via POST /lora-adapters.
        
        Args:
            scales: List of dicts with {"id": int, "scale": float}
        
        Returns:
            True if successful, False otherwise
        """
        try:
            response = requests.post(
                f"{self.base_url}/lora-adapters",
                json=scales,
                timeout=10
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
