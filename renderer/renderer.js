// Backend API URL
const API_URL = 'http://localhost:3001';

// State
let currentChatId = null;
let chats = {};
let isStreaming = false;
let currentListData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadChats();
  setupEventListeners();

  // Auto-resize textareas
  document.querySelectorAll('.message-input').forEach(textarea => {
    textarea.addEventListener('input', autoResize);
  });
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('homeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('homeInput');
    sendMessage(input.value.trim());
    input.value = '';
    autoResize.call(input);
  });

  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    sendMessage(input.value.trim());
    input.value = '';
    autoResize.call(input);
  });
}

// Auto-resize textarea
function autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
}

// Fill prompt from example
function fillPrompt(text) {
  const input = document.getElementById('homeInput');
  input.value = text;
  input.focus();
  autoResize.call(input);
}

// Start new chat
function startNewChat() {
  currentChatId = `chat_${Date.now()}`;
  currentListData = null;

  chats[currentChatId] = {
    id: currentChatId,
    title: 'New List',
    messages: [],
    timestamp: Date.now()
  };

  saveChats();
  showChatView();
  updateChatHistory();
}

// Load chats from localStorage
function loadChats() {
  const saved = localStorage.getItem('exa_chats');
  if (saved) {
    chats = JSON.parse(saved);

    // Load most recent chat
    const chatIds = Object.keys(chats);
    if (chatIds.length > 0) {
      const mostRecent = chatIds.reduce((a, b) =>
        chats[a].timestamp > chats[b].timestamp ? a : b
      );
      loadChat(mostRecent);
    }
  }
  updateChatHistory();
}

// Save chats to localStorage
function saveChats() {
  localStorage.setItem('exa_chats', JSON.stringify(chats));
}

// Update chat history sidebar
function updateChatHistory() {
  const historyList = document.getElementById('chatHistoryList');
  historyList.innerHTML = '';

  const sortedChats = Object.values(chats).sort((a, b) => b.timestamp - a.timestamp);

  sortedChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-history-item' + (chat.id === currentChatId ? ' active' : '');
    item.innerHTML = `
      <div class="chat-title">${escapeHtml(chat.title)}</div>
      <div class="chat-preview">${chat.messages.length} messages</div>
    `;
    item.onclick = () => loadChat(chat.id);
    historyList.appendChild(item);
  });
}

// Load a chat
function loadChat(chatId) {
  currentChatId = chatId;
  currentListData = null;

  const chat = chats[chatId];
  if (!chat) return;

  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  chat.messages.forEach(msg => {
    if (msg.role === 'user') {
      addUserMessage(msg.content, false);
    } else {
      addAssistantMessage(msg.content, false);
      if (msg.listData) {
        currentListData = msg.listData;
        displayTable(msg.listData);
      }
    }
  });

  showChatView();
  updateChatHistory();
  scrollToBottom();
}

// Show chat view
function showChatView() {
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';
}

// Send message
async function sendMessage(message) {
  if (!message || isStreaming) return;

  if (!currentChatId) {
    startNewChat();
  }

  // Add user message
  addUserMessage(message);

  // Save to chat history
  chats[currentChatId].messages.push({
    role: 'user',
    content: message
  });

  // Update title if first message
  if (chats[currentChatId].messages.length === 1) {
    chats[currentChatId].title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
  }

  saveChats();
  updateChatHistory();

  // Stream response
  await streamResponse(message);
}

// Add user message to UI
function addUserMessage(content, scroll = true) {
  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-text">${escapeHtml(content)}</div>
    </div>
  `;
  container.appendChild(messageDiv);

  if (scroll) scrollToBottom();
}

// Add assistant message to UI
function addAssistantMessage(content, scroll = true) {
  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-text">${marked.parse(content)}</div>
    </div>
  `;
  container.appendChild(messageDiv);

  if (scroll) scrollToBottom();
  return messageDiv;
}

// Display table
function displayTable(listData) {
  const container = document.getElementById('messagesContainer');

  // Create table container
  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';

  // Create table
  const table = document.createElement('table');
  table.className = 'data-table';

  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  listData.columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement('tbody');
  listData.data.forEach(row => {
    const tr = document.createElement('tr');
    listData.columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = row[col] || 'N/A';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.appendChild(table);

  // Create export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'export-btn';
  exportBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    Export List
  `;
  exportBtn.onclick = openExportModal;
  tableContainer.appendChild(exportBtn);

  container.appendChild(tableContainer);
  scrollToBottom();
}

// Stream response from backend
async function streamResponse(message) {
  isStreaming = true;

  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-text"></div>
    </div>
  `;
  container.appendChild(messageDiv);

  const textDiv = messageDiv.querySelector('.message-text');
  let accumulatedText = '';

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        chatId: currentChatId
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'text') {
            accumulatedText += data.content;
            textDiv.innerHTML = marked.parse(accumulatedText);
            scrollToBottom();
          } else if (data.type === 'list_generated') {
            currentListData = data;
            displayTable(data);

            // Save list data to chat
            const lastMsg = chats[currentChatId].messages[chats[currentChatId].messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.listData = data;
            }
            saveChats();
          } else if (data.type === 'error') {
            textDiv.innerHTML += `<div class="error-message">${escapeHtml(data.content)}</div>`;
            scrollToBottom();
          }
        }
      }
    }

    // Save assistant message
    chats[currentChatId].messages.push({
      role: 'assistant',
      content: accumulatedText,
      listData: currentListData
    });
    saveChats();

  } catch (error) {
    console.error('Stream error:', error);
    textDiv.innerHTML = `<div class="error-message">Error: ${escapeHtml(error.message)}</div>`;
  } finally {
    isStreaming = false;
  }
}

// Export modal
function openExportModal() {
  if (!currentListData) {
    alert('No list data available to export');
    return;
  }
  document.getElementById('exportModal').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('exportModal').style.display = 'none';
}

// Export list
async function exportList(format) {
  if (!currentListData) {
    alert('No list data available to export');
    return;
  }

  try {
    if (format === 'excel' || format === 'csv') {
      const response = await fetch(`${API_URL}/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `list.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);

      closeExportModal();

    } else if (format === 'airtable') {
      const baseId = prompt('Enter your Airtable Base ID:');
      if (!baseId) return;

      const response = await fetch(`${API_URL}/api/export/airtable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId, baseId })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const result = await response.json();
      alert(`Successfully exported to Airtable! URL: ${result.tableUrl}`);
      closeExportModal();

    } else if (format === 'googlesheets') {
      const response = await fetch(`${API_URL}/api/export/googlesheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const result = await response.json();
      alert(`Successfully exported to Google Sheets! URL: ${result.url}`);
      window.open(result.url, '_blank');
      closeExportModal();
    }
  } catch (error) {
    alert(`Export error: ${error.message}`);
  }
}

// Utility functions
function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal on outside click
window.onclick = (event) => {
  const modal = document.getElementById('exportModal');
  if (event.target === modal) {
    closeExportModal();
  }
};
