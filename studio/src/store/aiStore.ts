import { create } from 'zustand';
import { aiService, PipelineTrace, isPadLocalAiBackendEnabled } from '../services/ai';
import { useWorksheetStore } from './worksheetStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  trace?: PipelineTrace[];
}

interface AIState {
  // UI State
  isOpen: boolean;
  messages: ChatMessage[];
  isGenerating: boolean;
  error: string | null;
  pipelineError: string | null;

  // Pipeline State
  currentPipeline: string;
  pipelines: Array<{ id: string; name: string; description: string }>;
  isLoadingPipelines: boolean;

  // Session State (API v4)
  sessionId: string | null;
  sessionPadId: string | null;
  isInitializingSession: boolean;

  // Actions
  toggleSidebar: () => void;
  sendMessage: (message: string, context: string, padId: string, variables?: Record<string, string>) => Promise<void>;
  clearChat: () => Promise<void>;
  setPipeline: (pipelineId: string) => void;
  fetchPipelines: () => Promise<void>;
  initSession: (padId: string, context: string) => Promise<void>;
  refreshContext: (context: string) => Promise<void>;
  cancelGeneration?: () => void;
  clearError: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  // Initial State
  isOpen: false,
  messages: [],
  isGenerating: false,
  currentPipeline: 'TEACH',
  pipelines: [],
  isLoadingPipelines: false,
  error: null,
  pipelineError: null,
  sessionId: null,
  sessionPadId: null,
  isInitializingSession: false,

  toggleSidebar: () => set(state => ({ isOpen: !state.isOpen })),

  setPipeline: (pipelineId: string) => set({ currentPipeline: pipelineId, pipelineError: null }),

  clearError: () => set({ error: null }),

  // -------------------------------------------------------------------------
  // Session Management (API v4)
  // -------------------------------------------------------------------------

  /**
   * Initialize a session for a pad, or reuse existing if same pad
   */
  initSession: async (padId: string, context: string) => {
    const { sessionId, sessionPadId } = get();

    // Reuse existing session if same pad
    if (sessionId && sessionPadId === padId) {
      console.log('[AI] Reusing existing session:', sessionId);
      return;
    }

    set({ isInitializingSession: true, error: null });

    try {
      // Generate a local session ID (our simple server doesn't have session management)
      console.log('[AI] Creating local session for pad:', padId);
      const session_id = `local-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log('[AI] Local session created:', session_id);

      set({
        sessionId: session_id,
        sessionPadId: padId,
        isInitializingSession: false,
        messages: [] // Clear messages for new session
      });
    } catch (err) {
      console.error('[AI] Failed to initialize session:', err);
      set({
        isInitializingSession: false,
        error: 'Failed to initialize AI session. Is the Canis CLI running?'
      });
    }
  },

  /**
   * Refresh context in current session (when note content changes)
   */
  refreshContext: async (context: string) => {
    const { sessionId } = get();
    if (!sessionId) {
      console.warn('[AI] No session to refresh context');
      return;
    }
    // Context is passed per-request, so nothing to do here
    console.log('[AI] Context will be refreshed on next message');
  },

  // -------------------------------------------------------------------------
  // Pipeline Operations
  // -------------------------------------------------------------------------

  fetchPipelines: async () => {
    if (!isPadLocalAiBackendEnabled()) {
      set({ pipelines: [], isLoadingPipelines: false, pipelineError: null });
      return;
    }
    set({ isLoadingPipelines: true });
    try {
      const pipelines = await aiService.listPipelines();

      // If no pipelines (backend not available), silently disable AI features
      if (pipelines.length === 0) {
        set({ 
          pipelines: [],
          isLoadingPipelines: false,
          pipelineError: null
        });
        return;
      }

      // Check if current pipeline exists
      const { currentPipeline } = get();
      if (!pipelines.find(p => p.id === currentPipeline)) {
        console.warn(`[AI] Current pipeline '${currentPipeline}' not found.`);
        set({ pipelineError: `⚠️ The current pipeline '${currentPipeline}' is not available on the server. Please select a different pipeline below.` });
      } else {
        set({ pipelineError: null });
      }

      set({ pipelines, isLoadingPipelines: false });
    } catch (err) {
      console.error('Failed to fetch pipelines:', err);
      set({ 
        isLoadingPipelines: false,
        pipelineError: null
      });
    }
  },

  clearChat: async () => {
    // Just clear local messages (no server-side sessions)
    console.log('[AI] Clearing chat messages');
    set({ messages: [], error: null, sessionId: null, sessionPadId: null });
  },

  sendMessage: async (message: string, context: string, padId: string, variablesOverride?: Record<string, string>) => {
    if (!isPadLocalAiBackendEnabled()) {
      return;
    }
    const state = get();

    // Ensure session is initialized
    if (!state.sessionId || state.sessionPadId !== padId) {
      await get().initSession(padId, context);
    }

    const { sessionId } = get();
    if (!sessionId) {
      set({ error: 'Failed to create AI session' });
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    // Add user message and empty assistant message before starting stream (avoids race where chunks arrive before message exists)
    set(state => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isGenerating: true,
      error: null
    }));

    let fullResponse = '';

    // Log AI usage for worksheets
    const worksheetStore = useWorksheetStore.getState();
    // Only log IF it's a student pipeline (homework_helper, TEACH)
    const STUDENT_PIPELINES = ['TEACH', 'homework_helper', 'homework_helper_v2'];
    if (worksheetStore.isWorksheet(padId) && STUDENT_PIPELINES.includes(get().currentPipeline)) {
      worksheetStore.logAIUsage({
        padId,
        question: message,
        responsePreview: '...' // Will be updated on complete
      });
    }

    // Stream the response - pass variables (context, student_name, etc.) so pipeline applies them like CLI
    const variables = variablesOverride ?? { context };
    const cancel = aiService.streamPipeline(
      get().currentPipeline,
      {
        input: message,
        session_id: sessionId,
        variables,
        stream: true
      },
      // onChunk
      (chunk: string) => {
        fullResponse += chunk;
        set(state => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: fullResponse }
              : m
          )
        }));
      },
      // onComplete
      (trace: PipelineTrace[]) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, trace }
              : m
          ),
          isGenerating: false,
          cancelGeneration: undefined
        }));
      },
      // onError
      (error: Error) => {
        if (isPadLocalAiBackendEnabled()) {
          console.error('[AI] Stream error:', error);
        }
        set({
          isGenerating: false,
          cancelGeneration: undefined,
          error: `AI error: ${error.message}`
        });
      },
      // onNodeStart
      (nodeTrace: PipelineTrace) => {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId
              ? {
                ...m,
                trace: (() => {
                  const currentTrace = m.trace || [];
                  const index = currentTrace.findIndex(t => t.node === nodeTrace.node);
                  let newTrace;
                  if (index !== -1) {
                    newTrace = [...currentTrace];
                    newTrace[index] = { ...newTrace[index], ...nodeTrace };
                  } else {
                    newTrace = [...currentTrace, nodeTrace];
                  }
                  console.log('[AI Trace]', nodeTrace.node, nodeTrace.type);
                  return newTrace;
                })()
              }
              : m
          )
        }));
      }
    );

    set({ cancelGeneration: cancel });
  }
}));