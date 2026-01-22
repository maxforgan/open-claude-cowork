import XLSX from 'xlsx';
import Airtable from 'airtable';
import fs from 'fs';
import path from 'path';

/**
 * Export Service for list data
 * Supports Excel, CSV, Airtable, and Google Sheets
 */
export class ExportService {
  constructor(config = {}) {
    this.airtableApiKey = config.airtableApiKey || process.env.AIRTABLE_API_KEY;
    this.googleCredsPath = config.googleCredsPath || process.env.GOOGLE_SHEETS_CREDENTIALS;
  }

  /**
   * Export data to Excel (.xlsx)
   * Returns buffer of Excel file
   */
  exportToExcel(data, columns, listType) {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'List');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return buffer;
  }

  /**
   * Export data to CSV
   * Returns CSV string
   */
  exportToCSV(data, columns) {
    if (data.length === 0) return '';

    // Create header row
    const headers = columns.join(',');

    // Create data rows
    const rows = data.map(item => {
      return columns.map(col => {
        const value = item[col] || '';
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Export data to Airtable
   * Creates a new table in a base
   */
  async exportToAirtable(data, columns, listType, baseId) {
    if (!this.airtableApiKey) {
      throw new Error('Airtable API key not configured');
    }

    Airtable.configure({
      apiKey: this.airtableApiKey
    });

    const base = Airtable.base(baseId);

    try {
      // Create records in batches of 10 (Airtable limit)
      const batchSize = 10;
      const records = [];

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchRecords = batch.map(item => ({
          fields: item
        }));

        const created = await base(listType).create(batchRecords);
        records.push(...created);
      }

      return {
        success: true,
        recordCount: records.length,
        baseId,
        tableUrl: `https://airtable.com/${baseId}`
      };
    } catch (error) {
      throw new Error(`Airtable export failed: ${error.message}`);
    }
  }

  /**
   * Export data to Google Sheets
   * Creates a new spreadsheet
   */
  async exportToGoogleSheets(data, columns, listType) {
    if (!this.googleCredsPath) {
      throw new Error('Google Sheets credentials not configured');
    }

    try {
      // Import Google APIs
      const { google } = await import('googleapis');

      // Load credentials
      const credentials = JSON.parse(fs.readFileSync(this.googleCredsPath, 'utf8'));

      // Authenticate
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Create new spreadsheet
      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: listType
          },
          sheets: [{
            properties: {
              title: 'List'
            }
          }]
        }
      });

      const spreadsheetId = createResponse.data.spreadsheetId;

      // Prepare data for sheets (header + data rows)
      const values = [
        columns,
        ...data.map(item => columns.map(col => item[col] || ''))
      ];

      // Write data to sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'List!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values
        }
      });

      return {
        success: true,
        spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      };
    } catch (error) {
      throw new Error(`Google Sheets export failed: ${error.message}`);
    }
  }

  /**
   * Get export formats metadata
   */
  getAvailableFormats() {
    return {
      excel: { enabled: true, extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      csv: { enabled: true, extension: 'csv', mimeType: 'text/csv' },
      airtable: { enabled: !!this.airtableApiKey, requiresSetup: !this.airtableApiKey },
      googleSheets: { enabled: !!this.googleCredsPath, requiresSetup: !this.googleCredsPath }
    };
  }
}
