import Exa from 'exa-js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Exa List Generation Provider
 * Combines Claude AI reasoning with Exa search for structured list generation
 */
export class ExaListProvider {
  constructor(config = {}) {
    this.exaApiKey = config.exaApiKey || process.env.EXA_API_KEY;
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

    if (!this.exaApiKey) {
      throw new Error('EXA_API_KEY is required');
    }
    if (!this.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.exa = new Exa(this.exaApiKey);
    this.anthropic = new Anthropic({
      apiKey: this.anthropicApiKey,
    });

    // Session storage for conversation history
    this.sessions = new Map();
  }

  get name() {
    return 'exa-list';
  }

  /**
   * Get conversation history for a chat session
   */
  getSession(chatId) {
    return this.sessions.get(chatId) || [];
  }

  /**
   * Add message to conversation history
   */
  addToSession(chatId, message) {
    const history = this.getSession(chatId);
    history.push(message);
    this.sessions.set(chatId, history);
  }

  /**
   * Execute a list generation query using Claude + Exa
   */
  async *query(params) {
    const { prompt, chatId } = params;

    try {
      // Get conversation history
      const history = this.getSession(chatId);

      // Build messages array
      const messages = [
        ...history,
        { role: 'user', content: prompt }
      ];

      // Add user message to history
      this.addToSession(chatId, { role: 'user', content: prompt });

      yield {
        type: 'text',
        content: 'Analyzing your request and planning search strategy...\n\n',
        provider: this.name
      };

      // Step 1: Use Claude to understand the request and plan search strategy
      const planningResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are a list generation assistant that helps users create structured lists using web search.

Your task is to:
1. Understand what kind of list the user wants to generate
2. Extract key search parameters (topics, filters, time ranges, etc.)
3. Plan the Exa search queries needed to generate this list
4. Define what columns/fields should be in the final list

Respond with a JSON object in this format:
{
  "listType": "description of what kind of list this is",
  "searchQueries": ["query 1", "query 2", ...],
  "columns": ["column1", "column2", ...],
  "numResults": number of results to fetch,
  "useNeuralSearch": true/false,
  "searchFilters": {
    "includeDomains": ["domain1", ...] or null,
    "excludeDomains": ["domain1", ...] or null,
    "startPublishedDate": "YYYY-MM-DD" or null
  }
}

Only respond with the JSON object, nothing else.`,
        messages: [{ role: 'user', content: prompt }]
      });

      const planText = planningResponse.content[0].text;
      let plan;

      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = planText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (e) {
        console.error('Failed to parse planning response:', planText);
        yield {
          type: 'error',
          content: 'Failed to understand your request. Please try rephrasing.',
          provider: this.name
        };
        return;
      }

      yield {
        type: 'text',
        content: `**List Type:** ${plan.listType}\n\n**Columns:** ${plan.columns.join(', ')}\n\n**Searching Exa...**\n\n`,
        provider: this.name
      };

      // Step 2: Execute Exa searches
      const allResults = [];

      for (const searchQuery of plan.searchQueries) {
        yield {
          type: 'text',
          content: `🔍 Searching: "${searchQuery}"\n`,
          provider: this.name
        };

        try {
          const searchOptions = {
            numResults: Math.ceil(plan.numResults / plan.searchQueries.length),
            useAutoprompt: plan.useNeuralSearch,
            contents: {
              text: { maxCharacters: 500 }
            }
          };

          // Add filters if specified
          if (plan.searchFilters.includeDomains?.length > 0) {
            searchOptions.includeDomains = plan.searchFilters.includeDomains;
          }
          if (plan.searchFilters.excludeDomains?.length > 0) {
            searchOptions.excludeDomains = plan.searchFilters.excludeDomains;
          }
          if (plan.searchFilters.startPublishedDate) {
            searchOptions.startPublishedDate = plan.searchFilters.startPublishedDate;
          }

          const searchResults = await this.exa.searchAndContents(
            searchQuery,
            searchOptions
          );

          allResults.push(...searchResults.results);

          yield {
            type: 'text',
            content: `   ✓ Found ${searchResults.results.length} results\n`,
            provider: this.name
          };
        } catch (error) {
          console.error('Exa search error:', error);
          yield {
            type: 'text',
            content: `   ⚠ Search failed: ${error.message}\n`,
            provider: this.name
          };
        }
      }

      yield {
        type: 'text',
        content: `\n**Processing ${allResults.length} results...**\n\n`,
        provider: this.name
      };

      // Step 3: Use Claude to structure the results into a list
      const structuringPrompt = `You are processing search results to create a structured list.

LIST TYPE: ${plan.listType}
REQUIRED COLUMNS: ${plan.columns.join(', ')}

SEARCH RESULTS:
${JSON.stringify(allResults.slice(0, 50), null, 2)}

Your task:
1. Extract relevant information from each search result
2. Structure it according to the required columns
3. Remove duplicates
4. Return a JSON array of objects, where each object has the required columns

Respond with ONLY a JSON array of objects. Each object should have these fields: ${plan.columns.join(', ')}.
Make sure the data is accurate and comes from the search results. If a field is not available, use "N/A".`;

      const structuringResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: structuringPrompt }]
      });

      const structuredText = structuringResponse.content[0].text;
      let listData;

      try {
        // Extract JSON array from response
        const jsonMatch = structuredText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          listData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (e) {
        console.error('Failed to parse structured response:', structuredText);
        yield {
          type: 'error',
          content: 'Failed to structure the results. Please try again.',
          provider: this.name
        };
        return;
      }

      // Store the generated list in session
      this.addToSession(chatId, {
        role: 'assistant',
        content: `Generated a list of ${listData.length} items.`
      });

      // Yield the structured list
      yield {
        type: 'list_generated',
        listType: plan.listType,
        columns: plan.columns,
        data: listData,
        provider: this.name
      };

      yield {
        type: 'text',
        content: `\n✅ **List generated successfully!** Found ${listData.length} items.\n\nYou can now export this list to Excel, CSV, Airtable, or Google Sheets.`,
        provider: this.name
      };

      yield {
        type: 'done',
        provider: this.name
      };

    } catch (error) {
      console.error('Query execution error:', error);
      yield {
        type: 'error',
        content: `Error: ${error.message}`,
        provider: this.name
      };
    }
  }

  /**
   * Clear session history
   */
  clearSession(chatId) {
    this.sessions.delete(chatId);
  }
}
