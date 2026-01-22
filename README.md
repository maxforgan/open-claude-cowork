# Exa List Generator

<p align="center">
  <img src="https://img.shields.io/badge/Exa-Search%20API-blue" alt="Exa Search">
  <img src="https://img.shields.io/badge/Claude-AI%20Powered-purple" alt="Claude AI">
  <img src="https://img.shields.io/badge/Export-Excel%20|%20Airtable%20|%20Sheets-green" alt="Export Options">
</p>

<p align="center">
  An AI-powered list generation tool that creates accurate, comprehensive lists using Exa search. Generate market maps, investor lists, company databases, and more with a simple chat interface.
</p>

---

## Features

- **AI-Powered List Generation** - Natural language queries to generate comprehensive lists
- **Exa Search Integration** - Leverages Exa's neural search for accurate, relevant results
- **Interactive Table View** - View generated lists in a clean, sortable table format
- **Multiple Export Options**:
  - Excel (.xlsx)
  - CSV
  - Airtable
  - Google Sheets
- **ChatGPT-Style Interface** - Simple, intuitive chat interface
- **Real-time Streaming** - Watch lists being generated in real-time
- **Desktop App** - Native Electron application for macOS, Windows, and Linux

---

## Use Cases

- **Market Maps** - Generate comprehensive lists of companies in specific markets
- **Investor Research** - Create lists of VCs, angels, or secondary investors
- **Competitive Analysis** - Build competitor databases with key information
- **Lead Generation** - Compile lists of potential customers or partners
- **Research** - Any structured list based on web search results

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Desktop Framework** | Electron.js |
| **Backend** | Node.js + Express |
| **AI** | Claude (Anthropic) |
| **Search** | Exa Neural Search API |
| **Export** | xlsx, Airtable API, Google Sheets API |
| **Styling** | Vanilla CSS |

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- API Keys:
  - Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
  - Exa API key ([exa.ai](https://exa.ai))
  - Airtable API key (optional, for Airtable export)
  - Google Cloud credentials (optional, for Google Sheets export)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/exa-list-generator.git
cd exa-list-generator
```

#### 2. Install Dependencies

```bash
# Install Electron app dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

#### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Required
ANTHROPIC_API_KEY=your-anthropic-api-key
EXA_API_KEY=your-exa-api-key

# Optional - for Airtable export
AIRTABLE_API_KEY=your-airtable-api-key

# Optional - for Google Sheets export
GOOGLE_SHEETS_CREDENTIALS=path/to/credentials.json
```

### Starting the Application

You need **two terminal windows**:

**Terminal 1 - Backend Server:**
```bash
cd server
npm start
```

**Terminal 2 - Electron App:**
```bash
npm start
```

---

## How to Use

1. **Start a conversation** - Type a natural language query describing the list you want

   Examples:
   - "Generate a list of top secondary market investors in tech"
   - "Create a market map of AI infrastructure companies"
   - "List Y Combinator companies from the last 3 batches"

2. **Review the results** - The AI will use Exa search to find and compile relevant results into a structured table

3. **Export your list** - Click the export button to download as:
   - Excel (.xlsx)
   - CSV
   - Direct to Airtable
   - Direct to Google Sheets

---

## Example Queries

```
"List the top 50 venture capital firms focused on climate tech"

"Generate a market map of B2B SaaS companies in the HR space"

"Create a list of Series A fintech companies founded in 2023"

"Find all companies that have raised from Sequoia Capital in the last year"

"List the top AI research labs and their key focus areas"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron App                        │
│  ┌──────────────────────────────────────────┐       │
│  │   Chat Interface + Table View            │       │
│  │   (Simple ChatGPT-style UI)              │       │
│  └───────────────┬──────────────────────────┘       │
└──────────────────┼──────────────────────────────────┘
                   │ HTTP + SSE
                   ▼
┌─────────────────────────────────────────────────────┐
│              Backend Server (Express)                │
│  ┌───────────────┐    ┌──────────────────┐         │
│  │  Claude AI    │───▶│   Exa Search     │         │
│  │  (Reasoning)  │    │   (Data Source)  │         │
│  └───────────────┘    └──────────────────┘         │
│         │                                            │
│         ▼                                            │
│  ┌──────────────────────────────────────┐          │
│  │   Export Services                    │          │
│  │   - Excel (xlsx)                     │          │
│  │   - CSV                              │          │
│  │   - Airtable API                     │          │
│  │   - Google Sheets API                │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## File Structure

```
exa-list-generator/
├── main.js                 # Electron main process
├── preload.js              # IPC security bridge
├── renderer/
│   ├── index.html          # Chat + Table UI
│   ├── renderer.js         # Frontend logic
│   └── style.css           # Styling
├── server/
│   ├── server.js           # Express server
│   ├── providers/
│   │   ├── exa-provider.js      # Exa search integration
│   │   └── export-service.js    # Export functionality
│   └── package.json
├── package.json
├── .env                    # API keys (not tracked)
└── .env.example            # Template
```

---

## Export Options

### Excel (.xlsx)
Download a formatted Excel spreadsheet with your list data.

### CSV
Download a CSV file compatible with any spreadsheet software.

### Airtable
Directly create a new Airtable base with your list data. Requires Airtable API key.

### Google Sheets
Create a new Google Sheet with your list data. Requires Google Cloud credentials.

---

## Troubleshooting

**"Failed to connect to backend"**
- Ensure backend server is running on port 3001
- Check Terminal 1 for error logs

**"Exa API error"**
- Verify `EXA_API_KEY` in `.env` is valid
- Check your Exa API quota at exa.ai

**"Export failed"**
- For Airtable: Verify `AIRTABLE_API_KEY` is configured
- For Google Sheets: Ensure credentials file is in the correct location

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Resources

- [Exa Search API Documentation](https://docs.exa.ai)
- [Claude API Documentation](https://docs.anthropic.com)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Airtable API](https://airtable.com/developers/web/api/introduction)
- [Google Sheets API](https://developers.google.com/sheets/api)

---

<p align="center">
  Built with Claude AI and Exa Search
</p>
