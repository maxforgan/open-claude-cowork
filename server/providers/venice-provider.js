import { BaseProvider } from './base-provider.js';

/**
 * Venice AI provider implementation
 * Uses Venice API which provides an OpenAI-compatible interface
 */
export class VeniceProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.VENICE_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.venice.ai/api/v1';
    this.defaultModel = config.model || 'llama-3.3-70b';

    if (!this.apiKey) {
      throw new Error('Venice API key is required. Set VENICE_API_KEY in environment or config.');
    }
  }

  get name() {
    return 'venice';
  }

  /**
   * Execute a query using Venice API
   * Venice provides OpenAI-compatible chat completions API
   *
   * @param {Object} params
   * @param {string} params.prompt - The user message
   * @param {string} params.chatId - Chat session identifier
   * @param {string} [params.model] - Model to use
   * @param {number} [params.maxTurns] - Maximum conversation turns (for context)
   * @yields {Object} Normalized response chunks
   */
  async *query(params) {
    const {
      prompt,
      chatId,
      model = this.defaultModel
    } = params;

    console.log('[Venice] Using model:', model);

    // Get conversation history from session
    let messages = [];
    const sessionData = chatId ? this.getSession(chatId) : null;

    if (sessionData && Array.isArray(sessionData)) {
      messages = sessionData;
      console.log('[Venice] Resuming with', messages.length, 'messages');
    } else {
      console.log('[Venice] Starting new conversation');
    }

    // Add user message
    messages.push({
      role: 'user',
      content: prompt
    });

    try {
      // Make streaming request to Venice API
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Venice API error: ${response.status} - ${errorText}`);
      }

      // Yield session init
      const sessionId = chatId || `venice-${Date.now()}`;
      yield {
        type: 'session_init',
        session_id: sessionId,
        provider: this.name
      };

      // Parse streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta;

              if (delta?.content) {
                fullResponse += delta.content;
                yield {
                  type: 'text',
                  content: delta.content,
                  provider: this.name
                };
              }

              // Handle function/tool calls if Venice supports them
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function) {
                    yield {
                      type: 'tool_use',
                      name: toolCall.function.name,
                      input: JSON.parse(toolCall.function.arguments || '{}'),
                      id: toolCall.id,
                      provider: this.name
                    };
                  }
                }
              }
            } catch (e) {
              console.error('[Venice] Parse error:', e.message);
            }
          }
        }
      }

      // Store assistant response in session history
      messages.push({
        role: 'assistant',
        content: fullResponse
      });

      // Update session with conversation history
      if (chatId) {
        this.setSession(chatId, messages);
        console.log('[Venice] Updated session with', messages.length, 'messages');
      }

      // Signal completion
      yield {
        type: 'done',
        provider: this.name
      };

      console.log('[Venice] Stream completed');

    } catch (error) {
      console.error('[Venice] Query error:', error);
      yield {
        type: 'error',
        message: error.message,
        provider: this.name
      };
    }
  }

  /**
   * Get session data (message history)
   * @param {string} chatId
   * @returns {Array|null}
   */
  getSession(chatId) {
    return this.sessions.get(chatId) || null;
  }

  /**
   * Store session data (message history)
   * @param {string} chatId
   * @param {Array} messages
   */
  setSession(chatId, messages) {
    this.sessions.set(chatId, messages);
  }
}
