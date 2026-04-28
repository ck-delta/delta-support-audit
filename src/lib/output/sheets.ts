import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import type { AuditReport, ConflictIssue, Issue } from '@/lib/types';

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

function getCreds(): ServiceAccountCreds {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');
  const parsed = JSON.parse(raw) as ServiceAccountCreds;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
  }
  return parsed;
}

function getAuth() {
  const creds = getCreds();
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

const ISSUE_HEADERS = [
  'Issue Summary',
  'Article URL',
  'SoT URL',
  'Support Quote',
  'SoT Quote',
  'Confidence',
  'Status',
  'First Seen',
  'Last Seen',
  'Verdict',
  'Notes',
];

const CONFLICT_HEADERS = [
  'Summary',
  'Guides URL',
  'Guides Quote',
  'Docs URL',
  'Docs Quote',
  'Confidence',
  'Status',
  'First Seen',
  'Verdict',
  'Notes',
];

const VERDICT_OPTIONS = ['True Positive', 'False Positive', 'Low Severity'];
const ISSUE_VERDICT_COL = 9; // 0-indexed column position in ISSUE_HEADERS
const CONFLICT_VERDICT_COL = 8; // 0-indexed column position in CONFLICT_HEADERS
const MAX_SUMMARY_CHARS = 90;

function shortSummary(s: string): string {
  // Strip the "Support article" boilerplate prefix that the LLM frequently leads with,
  // then truncate at a word boundary to keep the cell scannable.
  const cleaned = s
    .replace(/^The support article (states|claims|describes|implies|says|hardcodes|asserts|lists|omits|warns|declares|states that|notes that|indicates|hints|references|suggests|reports)\s+/i, '')
    .replace(/^Support article (states|claims|describes|implies|says|hardcodes|asserts|lists|omits|warns|declares|states that|notes that|indicates|hints|references|suggests|reports)\s+/i, '')
    .replace(/^The /, '')
    .trim();
  if (cleaned.length <= MAX_SUMMARY_CHARS) return cleaned;
  const slice = cleaned.slice(0, MAX_SUMMARY_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > MAX_SUMMARY_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice) + '…';
}

function issueRow(i: Issue): (string | number)[] {
  return [
    shortSummary(i.summary),
    i.supportUrl ?? '',
    i.sotUrl ?? '',
    i.supportQuote ?? '',
    i.sotQuote ?? '',
    Number(i.confidence.toFixed(2)),
    i.status,
    i.firstSeenAt.split('T')[0] ?? i.firstSeenAt,
    i.lastSeenAt.split('T')[0] ?? i.lastSeenAt,
    '',
    '',
  ];
}

function conflictRow(c: ConflictIssue): (string | number)[] {
  return [
    shortSummary(c.summary),
    c.guidesUrl,
    c.guidesQuote,
    c.docsUrl,
    c.docsQuote,
    Number(c.confidence.toFixed(2)),
    c.status,
    c.firstSeenAt.split('T')[0] ?? c.firstSeenAt,
    '',
    '',
  ];
}

export interface PublishOptions {
  spreadsheetId?: string;
  shareWithEmail?: string;
  title?: string;
}

export interface PublishResult {
  spreadsheetId: string;
  url: string;
  created: boolean;
}

export async function publishToSheet(
  report: AuditReport,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const tabs = ['P0', 'P1', 'P2', 'Conflicts', 'Run Metadata'] as const;
  let spreadsheetId = opts.spreadsheetId ?? process.env.GOOGLE_SHEET_ID ?? '';
  let created = false;

  if (!spreadsheetId) {
    const title = opts.title ?? `Delta Support Audit — ${new Date().toISOString().slice(0, 10)}`;
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: tabs.map((t) => ({ properties: { title: t } })),
      },
    });
    spreadsheetId = res.data.spreadsheetId!;
    created = true;
    if (opts.shareWithEmail) {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: opts.shareWithEmail,
        },
        sendNotificationEmail: false,
      });
    }
  } else {
    // Make sure all expected tabs exist
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''));
    const requests: sheets_v4.Schema$Request[] = [];
    for (const t of tabs) {
      if (!existing.has(t)) requests.push({ addSheet: { properties: { title: t } } });
    }
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }
  }

  // Write each tab
  const issueRowCounts: Record<string, number> = {
    P0: report.issuesBySeverity.P0.length,
    P1: report.issuesBySeverity.P1.length,
    P2: report.issuesBySeverity.P2.length,
    Conflicts: report.conflicts.length,
  };
  await writeTab(sheets, spreadsheetId, 'P0', [ISSUE_HEADERS, ...report.issuesBySeverity.P0.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'P1', [ISSUE_HEADERS, ...report.issuesBySeverity.P1.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'P2', [ISSUE_HEADERS, ...report.issuesBySeverity.P2.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'Conflicts', [
    CONFLICT_HEADERS,
    ...report.conflicts.map(conflictRow),
  ]);
  await writeTab(sheets, spreadsheetId, 'Run Metadata', metadataRows(report));

  // Format header rows (bold, frozen) + Verdict dropdowns + sensible column widths
  await applyFormatting(sheets, spreadsheetId, tabs, issueRowCounts);

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    created,
  };
}

async function writeTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
  rows: (string | number)[][],
): Promise<void> {
  // Clear first to avoid leftover rows from previous run
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A:Z` });
  if (rows.length === 0 || (rows.length === 1 && rows[0]!.length === 0)) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

function metadataRows(report: AuditReport): (string | number)[][] {
  const m = report.metadata;
  return [
    ['Field', 'Value'],
    ['Run Started', m.startedAt],
    ['Run Completed', m.completedAt],
    ['Model', m.model],
    ['Articles Checked', m.articlesChecked],
    ['Articles Changed', m.articlesChanged],
    ['Articles Audited', m.articlesAudited],
    ['Errors', m.errors],
    ['Total P0 Issues', report.issuesBySeverity.P0.length],
    ['Total P1 Issues', report.issuesBySeverity.P1.length],
    ['Total P2 Issues', report.issuesBySeverity.P2.length],
    ['Total Conflicts', report.conflicts.length],
    ['Total Coverage Gaps', report.coverageGaps.length],
    ['New Issues', m.newIssues],
    ['Still-Open Issues', m.stillOpenIssues],
    ['Resolved Issues', m.resolvedIssues],
    ['Prompt Tokens', m.promptTokens],
    ['Completion Tokens', m.completionTokens],
    ['Cost (USD)', Number(m.costEstimateUsd.toFixed(4))],
    ['Duration (seconds)', Number((m.durationMs / 1000).toFixed(1))],
    ['Truncated', m.truncated ? 'YES' : 'no'],
  ];
}

async function applyFormatting(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabs: readonly string[],
  rowCounts: Record<string, number>,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIdByTitle = new Map<string, number>();
  for (const s of meta.data.sheets ?? []) {
    if (s.properties?.title && s.properties.sheetId != null) {
      sheetIdByTitle.set(s.properties.title, s.properties.sheetId);
    }
  }
  const requests: sheets_v4.Schema$Request[] = [];

  for (const t of tabs) {
    const id = sheetIdByTitle.get(t);
    if (id === undefined) continue;

    // Bold + light-grey header row
    requests.push({
      repeatCell: {
        range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    });
    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Verdict dropdown — only for issue + conflict tabs (not Run Metadata)
    if (t === 'P0' || t === 'P1' || t === 'P2' || t === 'Conflicts') {
      const isConflicts = t === 'Conflicts';
      const colIndex = isConflicts ? CONFLICT_VERDICT_COL : ISSUE_VERDICT_COL;
      const dataRowCount = rowCounts[t] ?? 0;
      // Apply validation across data rows + a generous buffer for future additions
      const endRow = Math.max(dataRowCount + 1, 200);
      requests.push({
        setDataValidation: {
          range: {
            sheetId: id,
            startRowIndex: 1,
            endRowIndex: endRow,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: VERDICT_OPTIONS.map((v) => ({ userEnteredValue: v })),
            },
            inputMessage: 'Pick one: True Positive, False Positive, or Low Severity',
            strict: false,
            showCustomUi: true,
          },
        },
      });

      // Set sensible column widths so Issue Summary doesn't wrap to 5 lines
      const widths: Array<{ start: number; end: number; px: number }> = isConflicts
        ? [
            { start: 0, end: 1, px: 380 }, // Summary
            { start: 1, end: 2, px: 200 }, // Guides URL
            { start: 2, end: 3, px: 320 }, // Guides Quote
            { start: 3, end: 4, px: 200 }, // Docs URL
            { start: 4, end: 5, px: 320 }, // Docs Quote
            { start: 5, end: 6, px: 80 }, // Confidence
            { start: 6, end: 7, px: 80 }, // Status
            { start: 7, end: 8, px: 100 }, // First Seen
            { start: 8, end: 9, px: 140 }, // Verdict
            { start: 9, end: 10, px: 250 }, // Notes
          ]
        : [
            { start: 0, end: 1, px: 380 }, // Issue Summary
            { start: 1, end: 2, px: 220 }, // Article URL
            { start: 2, end: 3, px: 220 }, // SoT URL
            { start: 3, end: 4, px: 320 }, // Support Quote
            { start: 4, end: 5, px: 320 }, // SoT Quote
            { start: 5, end: 6, px: 80 }, // Confidence
            { start: 6, end: 7, px: 80 }, // Status
            { start: 7, end: 8, px: 100 }, // First Seen
            { start: 8, end: 9, px: 100 }, // Last Seen
            { start: 9, end: 10, px: 140 }, // Verdict
            { start: 10, end: 11, px: 250 }, // Notes
          ];
      for (const w of widths) {
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId: id,
              dimension: 'COLUMNS',
              startIndex: w.start,
              endIndex: w.end,
            },
            properties: { pixelSize: w.px },
            fields: 'pixelSize',
          },
        });
      }
    }
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}
