"""
LoRA adapter management.

Handles switching between adapters and managing adapter state.
"""

from pathlib import Path
from typing import Dict, List, Optional

from canis.core.llama_client import LlamaClient


class AdapterManager:
    """Manages LoRA adapter switching via llama-server."""
    
    def __init__(self, client: LlamaClient):
        """
        Initialize AdapterManager.
        
        Args:
            client: LlamaClient instance
        """
        self.client = client
        self.adapters: List[Dict] = []
        self.adapter_names: Dict[str, int] = {}
        self.current_adapter: Optional[str] = None
        self.current_alpha: float = 1.0
    
    def refresh(self) -> bool:
        """
        Fetch and cache available adapters from server.
        
        Returns:
            True if adapters were found, False otherwise
        """
        self.adapters = self.client.get_adapters()
        self.adapter_names = {}
        
        for adapter in self.adapters:
            path = Path(adapter.get("path", ""))
            # Extract clean name from path
            name = path.stem.replace("-lora", "").replace("_lora", "")
            name = name.replace("teach-", "")
            self.adapter_names[name] = adapter["id"]
        
        return len(self.adapters) > 0
    
    def list_adapters(self) -> List[Dict[str, any]]:
        """
        Get list of available adapters.
        
        Returns:
            List of adapter info dicts with name, id, scale
        """
        result = []
        for adapter in self.adapters:
            path = Path(adapter.get("path", ""))
            name = path.stem.replace("-lora", "").replace("_lora", "").replace("teach-", "")
            result.append({
                "name": name,
                "id": adapter["id"],
                "path": adapter.get("path", ""),
                "scale": adapter.get("scale", 0.0),
            })
        return result
    
    def apply(self, name: Optional[str], alpha: float = 1.0) -> bool:
        """
        Apply a specific adapter with given strength.
        
        Args:
            name: Adapter name (None to disable all)
            alpha: Adapter strength (0.0 to 1.0)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.adapters:
            self.refresh()
        
        if not self.adapters:
            return True  # No adapters to manage
        
        # Build scales list: all 0 except the selected one
        scales = []
        for adapter in self.adapters:
            adapter_id = adapter["id"]
            adapter_path = Path(adapter.get("path", ""))
            adapter_name = adapter_path.stem.replace("-lora", "").replace("_lora", "").replace("teach-", "")
            
            if name and adapter_name == name:
                scales.append({"id": adapter_id, "scale": alpha})
            else:
                scales.append({"id": adapter_id, "scale": 0.0})
        
        success = self.client.set_adapter_scales(scales)
        
        if success:
            self.current_adapter = name
            self.current_alpha = alpha if name else 0.0
        
        return success
    
    def clear(self) -> bool:
        """
        Disable all adapters, use base model.
        
        Returns:
            True if successful, False otherwise
        """
        return self.apply(None, 0.0)
    
    def get_current(self) -> Dict[str, any]:
        """
        Get current adapter configuration.
        
        Returns:
            Dict with adapter name and alpha
        """
        return {
            "adapter": self.current_adapter,
            "alpha": self.current_alpha,
        }
    
    def set_alpha(self, alpha: float) -> bool:
        """
        Change alpha for current adapter.
        
        Args:
            alpha: New adapter strength (0.0 to 1.0)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.current_adapter:
            return False
        
        self.current_alpha = alpha
        return self.apply(self.current_adapter, alpha)
    
    def adapter_exists(self, name: str) -> bool:
        """
        Check if adapter exists.
        
        Args:
            name: Adapter name
        
        Returns:
            True if adapter exists, False otherwise
        """
        if not self.adapter_names:
            self.refresh()
        
        return name in self.adapter_names
