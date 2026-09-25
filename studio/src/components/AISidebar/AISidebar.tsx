import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownIt from 'markdown-it';
import { AiOutlineClose } from 'react-icons/ai';
import { HiOutlineStar } from 'react-icons/hi';
import { useAIStore } from '../../store/aiStore';
import { useNoteStore } from '../../store/noteStore';
import { useWorksheetStore } from '../../store/worksheetStore';
import { useAuth } from '../../hooks/useAuth';
import { usePadStore } from '../../store';
import { addPad, updatePad, updatePadWorksheetSections, IWorksheetSection } from '../../services/pads';
import { encryptText } from '../../services/encryption';
import { isWorksheetContent, parseWorksheetMarkdown } from '../../utils/WorksheetParser';
// TraceViewer imported but not currently used - may be used in future
// import { TraceViewer } from './TraceViewer';
import './AISidebar.css';

// Markdown renderer for AI content
const md = new MarkdownIt({ html: false, breaks: true });

export const AISidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role || 'student';
  const {
    isOpen,
    messages,
    isGenerating,
    error,
    sendMessage,
    clearChat,
    clearError,
    pipelines,
    currentPipeline,
    setPipeline,
    toggleSidebar,
    fetchPipelines,
    pipelineError
  } = useAIStore();
  const { currentNote } = useNoteStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragActiveRef = useRef(false);
  const navigate = useNavigate();
  const increaseNewPadAdded = usePadStore(state => state.setNeedToUpdate);
  const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 420, y: 92 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragActiveRef.current || !panelRef.current) {
        return;
      }
      const panel = panelRef.current;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const nextX = event.clientX - dragOffsetRef.current.x;
      const nextY = event.clientY - dragOffsetRef.current.y;
      const minX = 12;
      const minY = 72;
      const maxX = Math.max(minX, window.innerWidth - width - 12);
      const maxY = Math.max(minY, window.innerHeight - height - 12);
      setPanelPos({
        x: Math.min(Math.max(nextX, minX), maxX),
        y: Math.min(Math.max(nextY, minY), maxY),
      });
    };

    const onUp = () => {
      dragActiveRef.current = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  // Effect to enforce role-based pipeline selection
  useEffect(() => {
    if (pipelines.length > 0) {
      if (role === 'student') {
        const teachPipeline = pipelines.find(p => p.name === 'TEACH');
        if (teachPipeline && currentPipeline !== teachPipeline.id) {
          setPipeline(teachPipeline.id);
        }
      } else if (role === 'teacher') {
        const catcherPipeline = pipelines.find(p => p.name === 'Catcher');
        if (catcherPipeline && currentPipeline !== catcherPipeline.id) {
          setPipeline(catcherPipeline.id);
        }
      }
    }
  }, [role, pipelines, currentPipeline, setPipeline]);

  // Track previous role to clear chat only on switch
  const prevRoleRef = useRef(role);

  useEffect(() => {
    if (prevRoleRef.current !== role) {
      clearChat();
      prevRoleRef.current = role;
    }
  }, [role, clearChat]);

  // Strip HTML tags and convert to plain text for AI context
  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Replace block elements with double newlines
    div.querySelectorAll('p, br, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
      el.insertAdjacentText('beforebegin', '\n\n');
    });
    return div.textContent || div.innerText || '';
  };

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;

    // Read latest note from store at send time (avoids stale context when user just edited)
    const note = useNoteStore.getState().currentNote;
    const padId = note?.id || 'default';
    const rawContent = note?.content || '';

    // Build context: worksheets get structured data, notes get stripped HTML
    let context: string;
    const worksheetStore = useWorksheetStore.getState();

    // Check if content is a worksheet (based on ---worksheet--- marker)
    if (isWorksheetContent(rawContent)) {
      // Parse the worksheet to get structured elements
      const parsed = parseWorksheetMarkdown(rawContent);
      const answers = worksheetStore.answers[padId] || {};

      // Build context with tasks and student answers
      const contextParts: string[] = [];

      for (const element of parsed.elements) {
        if (element.type === 'task') {
          // Add the task content
          contextParts.push(`**Task:** ${element.content}`);
        } else if (element.type === 'long-input' || element.type === 'short-input' || element.type === 'input') {
          // Add the student's answer for this input
          const studentAnswer = answers[element.id] || '(no answer provided)';
          contextParts.push(`**Student Answer:** ${studentAnswer}`);
        } else if (element.type === 'markdown') {
          // Include markdown content (titles, instructions, etc.)
          if (element.content.trim()) {
            contextParts.push(element.content);
          }
        }
      }

      context = contextParts.join('\n\n');
      console.log('[AISidebar] Worksheet context with answers:', context.substring(0, 500));
    } else {
      // For regular notes, convert HTML to clean text
      context = stripHtml(rawContent)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    console.log('[AISidebar] Sending with padId:', padId);
    console.log('[AISidebar] Context length:', context.length);
    console.log('[AISidebar] Context preview:', context.substring(0, 300));

    // Pass pipeline variables like CLI: context (note content) and student_name
    const pipelineVariables: Record<string, string> = {
      context: context,
      student_name: user?.displayName || user?.email || 'Student',
    };
    sendMessage(input, context, padId, pipelineVariables);
    setInput('');
  };

  // Threshold for showing "Open in New Pad" button
  const LONG_RESPONSE_THRESHOLD = 300;



  // Parse markdown content into worksheet sections
  const parseWorksheetSections = (content: string): IWorksheetSection[] => {
    const sections: IWorksheetSection[] = [];
    let sectionIndex = 0;
    const lines = content.split('\n');
    let currentLockedContent = '';

    for (const line of lines) {
      const isHeading = line.startsWith('## ') || line.startsWith('### ') || line.startsWith('# ');

      if (isHeading) {
        // When we hit a new heading, save any accumulated content as locked + editable
        if (currentLockedContent.trim()) {
          sections.push({
            id: `section-${sectionIndex++}`,
            type: 'locked',
            content: currentLockedContent.trim()
          });
          sections.push({
            id: `section-${sectionIndex++}`,
            type: 'editable',
            content: ''
          });
        }
        // Start accumulating new locked content with this heading
        currentLockedContent = line.replace(/^#+\s*/, '') + '\n';
      } else if (line.trim()) {
        // Accumulate non-heading content (problem text, equations, etc.)
        currentLockedContent += line + '\n';
      }
    }

    // Save any remaining accumulated content
    if (currentLockedContent.trim()) {
      sections.push({
        id: `section-${sectionIndex++}`,
        type: 'locked',
        content: currentLockedContent.trim()
      });
      sections.push({
        id: `section-${sectionIndex++}`,
        type: 'editable',
        content: ''
      });
    }

    // If no structure found, create simple locked intro + editable area
    if (sections.length === 0) {
      sections.push(
        { id: 'section-0', type: 'locked', content: '📝 Complete the worksheet below:' },
        { id: 'section-1', type: 'editable', content: '' }
      );
    }

    return sections;
  };

  const handleOpenInNewPad = async (content: string) => {
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const title = `📝 AI Worksheet - ${timestamp}`;

    console.log('[handleOpenInNewPad] Creating new pad with title:', title);

    // Create pad using the same pattern as PadNew.tsx
    const id = await addPad({
      uid: 'local-user-123',
      title,
      shortDesc: 'AI-generated worksheet from Catcher analysis',
    });

    console.log('[handleOpenInNewPad] Created pad with ID:', id);

    if (id) {
      // Convert markdown to proper HTML using markdown-it
      const htmlContent = md.render(content);
      const cipherContent = encryptText(htmlContent);

      // Update the pad content
      await updatePad({ id, content: htmlContent, cipherContent });

      // Parse markdown into worksheet sections
      const sections = parseWorksheetSections(content);
      console.log('[handleOpenInNewPad] Parsed sections:', sections);

      // Save worksheet sections to the server (persisted, works across browsers)
      await updatePadWorksheetSections(id, sections);
      console.log('[handleOpenInNewPad] Saved worksheet sections to server');

      // Refresh pad list
      increaseNewPadAdded();

      // Navigate to the new pad
      navigate(`/app/pad/${id}`);
    }
  };

  const currentPipelineData = pipelines.find(p => p.id === currentPipeline);
  const panelInlineStyle = {
    left: `${panelPos.x}px`,
    top: `${panelPos.y}px`,
  };
  const pillInlineStyle = isOpen
    ? { left: `${panelPos.x - 26}px`, top: `${panelPos.y + 14}px` }
    : { right: '1rem', bottom: '1rem' };

  return (
    <>
      <button
        type="button"
        className="ai-sidebar-pill"
        style={pillInlineStyle}
        onClick={toggleSidebar}
        title={isOpen ? 'Hide AI assistant' : 'Show AI assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? <AiOutlineClose aria-hidden /> : <HiOutlineStar aria-hidden />}
      </button>

      {!isOpen ? null : (
        <div ref={panelRef} className="ai-sidebar" style={panelInlineStyle}>
          <div
            className="ai-sidebar-header"
            onPointerDown={(event) => {
              if (!panelRef.current) {
                return;
              }
              const rect = panelRef.current.getBoundingClientRect();
              dragOffsetRef.current = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              };
              dragActiveRef.current = true;
            }}
          >
            <div className="ai-sidebar-header-left">
              <h3>Canis Assistant</h3>
            </div>
            <button onClick={clearChat} className="btn-clear" title="Clear Chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>

          <div className="ai-messages">
            {messages.length === 0 ? (
              <div className="ai-welcome-state">
                <div className="ai-logo-placeholder">
                  {/* Using a sleek generic icon or the first letter of the pipeline name */}
                  <span>{currentPipelineData?.name?.charAt(0) || 'C'}</span>
                </div>
                <h2 className="ai-welcome-title">
                  {currentPipelineData?.name || 'Canis Assistant'}
                </h2>
                <p className="ai-welcome-desc">
                  {currentPipelineData?.description || 'How can I help you with your notes today?'}
                </p>
                {currentNote && (
                  <div className="ai-context-badge">
                    Working on: {currentNote.title}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} className={`ai-message ai-message-${msg.role}`}>
                    <div
                      className="ai-message-content"
                      dangerouslySetInnerHTML={{
                        __html: msg.content ? md.render(msg.content) : ''
                      }}
                    />
                    {!msg.content && <span className="ai-typing">Thinking...</span>}
                    {/* Show "Open in New Pad" button for long assistant responses */}
                    {msg.role === 'assistant' && msg.content && msg.content.length > LONG_RESPONSE_THRESHOLD && (
                      <button
                        className="ai-open-in-pad-btn"
                        onClick={() => handleOpenInNewPad(msg.content)}
                        title="Create a new pad with this content"
                      >
                        📝 Open in New Pad
                      </button>
                    )}
                  </div>
                ))}
                {pipelineError && (
                  <div className="ai-message ai-message-assistant ai-message-error">
                    <div className="ai-message-content">
                      {pipelineError}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="ai-footer">
            <div className="ai-input-wrapper">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                disabled={isGenerating}
                className="ai-minimal-input"
              />
              <button
                onClick={handleSend}
                disabled={isGenerating || !input.trim()}
                className="ai-minimal-send-btn"
              >
                {isGenerating ? (
                  <span className="loading-dots">...</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="ai-error-toast">
              <span>{error}</span>
              <button onClick={clearError}>×</button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
