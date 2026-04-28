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
  'Severity',
  'Owner',
  'Issue Summary',
  'Article URL',
  'SoT URL',
  'Support Quote',
  'SoT Quote',
  'Confidence',
  'Status',
  'First Seen',
  'Last Seen',
  'Verdict (TP/FP/AMB)',
  'Notes',
];

const CONFLICT_HEADERS = [
  'Severity',
  'Summary',
  'Guides URL',
  'Guides Quote',
  'Docs URL',
  'Docs Quote',
  'Confidence',
  'Status',
  'First Seen',
  'Verdict (TP/FP/AMB)',
  'Notes',
];

function issueRow(i: Issue): (string | number)[] {
  return [
    i.severity,
    i.suggestedOwner ?? '',
    i.summary,
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
    c.severity,
    c.summary,
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
  await writeTab(sheets, spreadsheetId, 'P0', [ISSUE_HEADERS, ...report.issuesBySeverity.P0.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'P1', [ISSUE_HEADERS, ...report.issuesBySeverity.P1.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'P2', [ISSUE_HEADERS, ...report.issuesBySeverity.P2.map(issueRow)]);
  await writeTab(sheets, spreadsheetId, 'Conflicts', [
    CONFLICT_HEADERS,
    ...report.conflicts.map(conflictRow),
  ]);
  await writeTab(sheets, spreadsheetId, 'Run Metadata', metadataRows(report));

  // Format header rows (bold, frozen) on each tab
  await formatHeaders(sheets, spreadsheetId, tabs);

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

async function formatHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabs: readonly string[],
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
    // Bold row 1
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
    // Freeze row 1
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}
