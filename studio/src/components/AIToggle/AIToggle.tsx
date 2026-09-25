import React from 'react';
import { useAIStore } from '../../store/aiStore';
import './AIToggle.css';

export const AIToggle: React.FC = () => {
  const { isOpen, toggleSidebar } = useAIStore();

  return (
    <button
      className={`ai-toggle-btn ${isOpen ? 'active' : ''}`}
      onClick={toggleSidebar}
      title="Toggle AI Assistant"
    >
      <img src="/canis_logo.png" alt="Canis Logo" className="ai-toggle-logo" />
    </button>
  );
};