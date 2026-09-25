// CRA: REACT_APP_CANISCLI_URL; Vite: VITE_CANISCLI_URL. Default matches Canis CLI (llama server), not PAD FastAPI.
const API_BASE =
  (typeof process !== "undefined" && process.env?.REACT_APP_CANISCLI_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_CANISCLI_URL) ||
  "http://localhost:5000";

/** When false (default), no requests to the local Canis CLI pipeline server — avoids noise when it is not running. Set `VITE_PAD_LOCAL_AI=true` or `REACT_APP_PAD_LOCAL_AI=true` to enable. */
export function isPadLocalAiBackendEnabled(): boolean {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_PAD_LOCAL_AI === "true") return true;
  if (typeof process !== "undefined" && process.env?.REACT_APP_PAD_LOCAL_AI === "true") return true;
  return false;
}

// ============================================================================
// Types
// ============================================================================

export interface SessionVariables {
  context?: string;
  student_name?: string;
  note_title?: string;
  [key: string]: string | undefined;
}

export interface Session {
  id: string;
  variables: SessionVariables;
  blocked_topics?: string[];
  chat_history?: Array<{ role: string; content: string }>;
}

export interface PipelineRunRequest {
  input: string;
  session_id?: string;
  variables?: SessionVariables;  // For non-persistent vars like context
  stream: boolean;
}

export interface PipelineTrace {
  node: string;
  type: string;
  classification?: string;
  output_preview?: string;
}

export interface PipelineResult {
  output: string;
  trace: PipelineTrace[];
}

// ============================================================================
// AI Service
// ============================================================================

export const aiService = {
  // -------------------------------------------------------------------------
  // Session Management (API v4) - reserved for future backend support.
  // Currently the store uses local session IDs; these endpoints are not implemented on the PAD server.
  // -------------------------------------------------------------------------

  /**
   * Create a new session
   * POST /v1/sessions
   */
  async createSession(): Promise<{ session_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Load context/variables into a session
   * PUT /v1/sessions/{session_id}/variables
   */
  async loadSessionContext(
    sessionId: string,
    variables: SessionVariables
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/variables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables })
    });
    if (!res.ok) {
      throw new Error(`Failed to load session context: ${res.status}`);
    }
  },

  /**
   * Get session state (for debugging)
   * GET /v1/sessions/{session_id}
   */
  async getSession(sessionId: string): Promise<Session> {
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to get session: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Reset a session (clear variables and history, keep ID)
   * POST /v1/sessions/{session_id}/reset
   */
  async resetSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Failed to reset session: ${res.status}`);
    }
  },

  // -------------------------------------------------------------------------
  // Pipeline Operations
  // -------------------------------------------------------------------------

  /**
   * List available pipelines
   */
  async listPipelines(): Promise<Array<{ id: string; name: string; description: string }>> {
    if (!isPadLocalAiBackendEnabled()) {
      return [];
    }
    // Note: Pipelines require backend - this will fail gracefully if backend is not running
    try {
      const res = await fetch(`${API_BASE}/v1/pipelines`);
      if (!res.ok) {
        throw new Error(`Backend not available: ${res.statusText}`);
      }
      return res.json();
    } catch (error) {
      if (isPadLocalAiBackendEnabled()) {
        console.warn("⚠️ Backend not available for pipelines. AI features will be disabled.", error);
      }
      // Return empty array so UI doesn't break
      return [];
    }
  },

  /**
   * Run pipeline (non-streaming)
   */
  async runPipeline(
    pipelineId: string,
    request: PipelineRunRequest
  ): Promise<PipelineResult> {
    if (!isPadLocalAiBackendEnabled()) {
      throw new Error("Local AI backend is disabled");
    }
    const res = await fetch(`${API_BASE}/v1/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return res.json();
  },

  /**
   * Run pipeline (streaming)
   */
  streamPipeline(
    pipelineId: string,
    request: PipelineRunRequest,
    onChunk: (chunk: string) => void,
    onComplete: (trace: PipelineTrace[]) => void,
    onError: (error: Error) => void,
    onNodeStart?: (trace: PipelineTrace) => void
  ): () => void {
    const controller = new AbortController();

    if (!isPadLocalAiBackendEnabled()) {
      queueMicrotask(() => {
        onError(new Error("Local AI backend is disabled"));
      });
      return () => controller.abort();
    }

    fetch(`${API_BASE}/v1/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
      signal: controller.signal
    })
      .then(response => {
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);

              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk') {
                  onChunk(parsed.content);
                } else if (parsed.type === 'node_start') {
                  if (onNodeStart) {
                    onNodeStart({
                      node: parsed.node,
                      type: parsed.node_type
                    });
                  }
                } else if (parsed.type === 'node_end') {
                  if (onNodeStart && parsed.trace_entry) {
                    onNodeStart(parsed.trace_entry);
                  }
                } else if (parsed.type === 'complete') {
                  onComplete(parsed.trace || []);
                }
              } catch (e) {
                if (isPadLocalAiBackendEnabled()) {
                  console.warn("Failed to parse SSE:", data);
                }
              }
            }
          }
        };

        processStream().catch(onError);
      })
      .catch(onError);

    return () => controller.abort();
  }
};