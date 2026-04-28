import { NextResponse } from 'next/server';
import { runAudit } from '@/lib/audit/orchestrator';
import { postP0Summary } from '@/lib/output/slack';
import { upsertAuditPage } from '@/lib/output/notion';
import { publishToSheet } from '@/lib/output/sheets';
import { loadAllOpenIssues } from '@/lib/audit/dedupe';
import type { AuditReport, Issue } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface AuditQuery {
  dryRun: boolean;
  force: boolean;
  limit?: number;
  coverage: boolean;
  coverageLimit?: number;
}

function parseQuery(req: Request): AuditQuery {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const limit = sp.get('limit');
  const coverageLimit = sp.get('coverageLimit');
  return {
    dryRun: sp.get('dryRun') === 'true',
    force: sp.get('force') === 'true',
    limit: limit ? Number(limit) : undefined,
    coverage: sp.get('coverage') === 'true',
    coverageLimit: coverageLimit ? Number(coverageLimit) : undefined,
  };
}

function checkAuth(req: Request): { ok: true } | { ok: false; status: number; reason: string } {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, reason: 'CRON_SECRET not configured' };
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return { ok: false, status: 401, reason: 'missing Authorization header' };
  if (header !== `Bearer ${expected}`) return { ok: false, status: 401, reason: 'invalid bearer' };
  return { ok: true };
}

async function handleAudit(req: Request): Promise<Response> {
  const auth = checkAuth(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const query = parseQuery(req);
  const startedAt = new Date();

  try {
    const { report, newP0Count } = await runAudit({
      dryRun: query.dryRun,
      force: query.force,
      limit: query.limit,
      coverage: query.coverage,
      coverageLimit: query.coverageLimit,
      runTimestamp: startedAt.toISOString(),
    });

    if (!query.dryRun) {
      const slackTask = postP0Summary({
        newP0Issues: report.issuesBySeverity.P0.filter((i) => i.status === 'new'),
        metadata: report.metadata,
      }).catch((e: unknown) => {
        console.error('Slack post failed:', (e as Error).message);
      });
      const notionTask = upsertAuditPage(report).catch((e: unknown) => {
        console.error('Notion upsert failed:', (e as Error).message);
      });
      const sheetsConfigured =
        !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.GOOGLE_SHEET_ID;
      // For Sheets, publish the FULL open-issues backlog from Redis (not just this
      // run's findings). This way the spreadsheet is always the canonical triage
      // queue; daily cron runs on quiet days don't wipe yesterday's findings.
      const sheetsTask = sheetsConfigured
        ? buildBacklogReport(report).then((backlog) =>
            publishToSheet(backlog).catch((e: unknown) => {
              console.error('Sheets publish failed:', (e as Error).message);
            }),
          )
        : Promise.resolve();
      await Promise.all([slackTask, notionTask, sheetsTask]);
    }

    return NextResponse.json({
      ok: true,
      dryRun: query.dryRun,
      truncated: report.metadata.truncated,
      summary: {
        articlesChecked: report.metadata.articlesChecked,
        articlesChanged: report.metadata.articlesChanged,
        articlesAudited: report.metadata.articlesAudited,
        newIssues: report.metadata.newIssues,
        stillOpenIssues: report.metadata.stillOpenIssues,
        resolvedIssues: report.metadata.resolvedIssues,
        totalIssues: report.metadata.totalIssues,
        newP0Count,
        conflicts: report.conflicts.length,
        coverageGaps: report.coverageGaps.length,
        promptTokens: report.metadata.promptTokens,
        completionTokens: report.metadata.completionTokens,
        costEstimateUsd: report.metadata.costEstimateUsd,
        errors: report.metadata.errors,
        durationMs: report.metadata.durationMs,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, durationMs: Date.now() - startedAt.getTime() },
      { status: 500 },
    );
  }
}

/**
 * Read all currently-open issues from Redis and synthesize an AuditReport
 * for Sheets publishing. Conflicts come from the current run only (we don't
 * persist conflicts in Redis yet); P0/P1/P2 buckets are the full backlog.
 */
async function buildBacklogReport(currentRun: AuditReport): Promise<AuditReport> {
  let allOpen: Issue[] = [];
  try {
    allOpen = await loadAllOpenIssues();
  } catch (e) {
    console.error('loadAllOpenIssues failed, falling back to current run:', (e as Error).message);
    return currentRun;
  }
  return {
    ...currentRun,
    issuesBySeverity: {
      P0: allOpen.filter((i) => i.severity === 'P0'),
      P1: allOpen.filter((i) => i.severity === 'P1'),
      P2: allOpen.filter((i) => i.severity === 'P2'),
    },
    // Conflicts + coverageGaps stay as the current run's view for now.
  };
}

export async function POST(req: Request): Promise<Response> {
  return handleAudit(req);
}

export async function GET(req: Request): Promise<Response> {
  // GET supported for browser-friendly local testing AND Vercel cron (which uses GET).
  return handleAudit(req);
}
