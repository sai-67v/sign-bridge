"""
Session state management for pipelines.

Handles persistent variables, chat history, and session state across pipeline runs.
"""

import json
import time
from typing import Dict, List, Any, Optional
from pathlib import Path
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single message in chat history."""
    role: str  # "user" or "assistant"
    content: str
    timestamp: float
    classification: Optional[str] = None  # For classifier nodes
    adapter: Optional[str] = None  # Which adapter was used
    node: Optional[str] = None  # Which node generated this


class SessionState(BaseModel):
    """
    Persistent state across pipeline executions.
    
    Tracks variables, execution history, chat messages, and blocking state.
    """
    pipeline_name: str = "default"
    session_id: Optional[str] = None
    persistent_vars: Dict[str, Any] = Field(default_factory=dict)
    executed_init_nodes: set[str] = Field(default_factory=set)
    chat_history: List[ChatMessage] = Field(default_factory=list)
    topic_history: List[str] = Field(default_factory=list)
    blocked: bool = False
    block_reason: Optional[str] = None
    clarify_attempts: int = 0
    student_name: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    
    class Config:
        # Allow set type for executed_init_nodes
        arbitrary_types_allowed = True
    
    def add_message(
        self, 
        role: str, 
        content: str, 
        classification: Optional[str] = None,
        adapter: Optional[str] = None,
        node: Optional[str] = None
    ):
        """Add a message to chat history."""
        self.chat_history.append(ChatMessage(
            role=role,
            content=content,
            timestamp=time.time(),
            classification=classification,
            adapter=adapter,
            node=node
        ))
    
    def add_topic(self, topic: str):
        """Track topic changes."""
        if not self.topic_history or self.topic_history[-1] != topic:
            self.topic_history.append(topic)
    
    def reset_clarify_attempts(self):
        """Reset clarification attempt counter."""
        self.clarify_attempts = 0
    
    def increment_clarify_attempts(self) -> int:
        """Increment and return clarification attempts."""
        self.clarify_attempts += 1
        return self.clarify_attempts
    
    def block(self, reason: str):
        """Block the session with a reason."""
        self.blocked = True
        self.block_reason = reason
    
    def unblock(self):
        """Unblock the session."""
        self.blocked = False
        self.block_reason = None
    
    def save_to_file(self, path: str):
        """
        Save session state to JSON file for teacher analysis.
        
        Args:
            path: File path to save to
        """
        output = {
            "student_name": self.student_name or "Unknown",
            "pipeline": self.pipeline_name,
            "created_at": self.created_at,
            "session_duration": time.time() - self.created_at,
            "topic_changes": self.topic_history,
            "total_messages": len(self.chat_history),
            "blocked": self.blocked,
            "block_reason": self.block_reason,
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp,
                    "classification": msg.classification,
                    "adapter": msg.adapter,
                    "node": msg.node
                }
                for msg in self.chat_history
            ],
            "persistent_vars": self.persistent_vars
        }
        
        path_obj = Path(path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
    
    @staticmethod
    def load_from_file(path: str) -> 'SessionState':
        """
        Load session state from JSON file.
        
        Args:
            path: File path to load from
        
        Returns:
            SessionState instance
        """
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        session = SessionState(
            pipeline_name=data.get("pipeline", "unknown"),
            student_name=data.get("student_name"),
            created_at=data.get("created_at", time.time()),
            blocked=data.get("blocked", False),
            block_reason=data.get("block_reason"),
            topic_history=data.get("topic_changes", []),
            persistent_vars=data.get("persistent_vars", {})
        )
        
        # Reconstruct chat history
        for msg_data in data.get("messages", []):
            session.chat_history.append(ChatMessage(
                role=msg_data["role"],
                content=msg_data["content"],
                timestamp=msg_data["timestamp"],
                classification=msg_data.get("classification"),
                adapter=msg_data.get("adapter"),
                node=msg_data.get("node")
            ))
        
        return session
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics for display."""
        return {
            "pipeline": self.pipeline_name,
            "student": self.student_name or "Unknown",
            "messages": len(self.chat_history),
            "topics": len(self.topic_history),
            "blocked": self.blocked,
            "persistent_vars": len(self.persistent_vars),
            "init_nodes_executed": len(self.executed_init_nodes)
        }
