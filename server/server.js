import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ExaListProvider } from './providers/exa-list-provider.js';
import { ExportService } from './providers/export-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const listProvider = new ExaListProvider();
const exportService = new ExportService();

// Store generated lists temporarily
const generatedLists = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Chat endpoint for list generation
app.post('/api/chat', async (req, res) => {
  const {
    message,
    chatId,
  } = req.body;

  console.log('[CHAT] Request received:', message);
  console.log('[CHAT] Chat ID:', chatId);

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    // Stream responses from the Exa list provider
    for await (const chunk of listProvider.query({
      prompt: message,
      chatId
    })) {
      // If a list was generated, store it for export
      if (chunk.type === 'list_generated') {
        generatedLists.set(chatId, {
          listType: chunk.listType,
          columns: chunk.columns,
          data: chunk.data,
          timestamp: new Date().toISOString()
        });
      }

      // Send chunk as SSE
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();
    console.log('[CHAT] Stream completed');
  } catch (error) {
    console.error('[CHAT] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// Export to Excel endpoint
app.post('/api/export/excel', (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const listData = generatedLists.get(chatId);
  if (!listData) {
    return res.status(404).json({ error: 'No list found for this chat' });
  }

  try {
    const buffer = exportService.exportToExcel(
      listData.data,
      listData.columns,
      listData.listType
    );

    const filename = `${listData.listType.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('[EXPORT] Excel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to CSV endpoint
app.post('/api/export/csv', (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const listData = generatedLists.get(chatId);
  if (!listData) {
    return res.status(404).json({ error: 'No list found for this chat' });
  }

  try {
    const csv = exportService.exportToCSV(
      listData.data,
      listData.columns
    );

    const filename = `${listData.listType.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('[EXPORT] CSV error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to Airtable endpoint
app.post('/api/export/airtable', async (req, res) => {
  const { chatId, baseId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  if (!baseId) {
    return res.status(400).json({ error: 'baseId is required' });
  }

  const listData = generatedLists.get(chatId);
  if (!listData) {
    return res.status(404).json({ error: 'No list found for this chat' });
  }

  try {
    const result = await exportService.exportToAirtable(
      listData.data,
      listData.columns,
      listData.listType,
      baseId
    );

    res.json(result);
  } catch (error) {
    console.error('[EXPORT] Airtable error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to Google Sheets endpoint
app.post('/api/export/googlesheets', async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const listData = generatedLists.get(chatId);
  if (!listData) {
    return res.status(404).json({ error: 'No list found for this chat' });
  }

  try {
    const result = await exportService.exportToGoogleSheets(
      listData.data,
      listData.columns,
      listData.listType
    );

    res.json(result);
  } catch (error) {
    console.error('[EXPORT] Google Sheets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available export formats
app.get('/api/export/formats', (_req, res) => {
  res.json(exportService.getAvailableFormats());
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: 'exa-list'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n✓ Exa List Generator Backend running on http://localhost:${PORT}`);
  console.log(`✓ Chat endpoint: POST http://localhost:${PORT}/api/chat`);
  console.log(`✓ Export formats: GET http://localhost:${PORT}/api/export/formats`);
  console.log(`✓ Health check: GET http://localhost:${PORT}/api/health\n`);
});

// Keep the process alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
