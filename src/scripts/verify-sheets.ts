import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';

loadEnv({ path: '.env.local' });

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as {
  client_email: string;
  private_key: string;
};
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
const id = process.env.GOOGLE_SHEET_ID!;

// Check All Issues tab
const allRes = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'All Issues'!A1:L4" });
const allRows = allRes.data.values ?? [];
console.log("All Issues headers:", allRows[0]);
console.log("All Issues row 1:", allRows[1]);
console.log();

// Check P0 columns + first data row
const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'P0!A1:K3' });
const rows = res.data.values ?? [];
console.log('P0 headers:', rows[0]);
console.log('P0 row 1: ', rows[1]?.[0]?.slice(0, 90));
console.log('P0 row 2: ', rows[2]?.[0]?.slice(0, 90));
console.log();

// Check data validation on Verdict column for P0 + Conflicts
const meta = await sheets.spreadsheets.get({
  spreadsheetId: id,
  ranges: ['P0!J1:J5', 'Conflicts!I1:I5'],
  includeGridData: true,
});
for (const sheet of meta.data.sheets ?? []) {
  const title = sheet.properties?.title ?? '?';
  const rd = sheet.data?.[0]?.rowData ?? [];
  console.log(`Tab: ${title}`);
  rd.forEach((r, i) => {
    const v = r.values?.[0];
    const vlist =
      v?.dataValidation?.condition?.values?.map((x) => x.userEnteredValue).filter(Boolean) ?? [];
    console.log(
      `  row ${i}: value=${JSON.stringify(v?.formattedValue ?? '')} validation=${
        v?.dataValidation?.condition?.type ?? 'NONE'
      } options=[${vlist.join(', ')}]`,
    );
  });
}
