// Reads the most recent docs/M*-final-*.json and writes
// src/app/dashboard-data.json with aggregate stats ONLY (no quotes, no URLs,
// no support content). Page.tsx imports this file at build time so the public
// dashboard ships only safe aggregates — full audit content stays out of the
// public JS bundle.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditReport } from '@/lib/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', '..', 'docs');
const targetFile = join(__dirname, '..', 'app', 'dashboard-data.json');

interface DashboardStats {
  generatedAt: string;
  sourceFile: string;
  articlesAudited: number;
  articlesChecked: number;
  totalP0: number;
  totalP1: number;
  totalP2: number;
  totalConflicts: number;
  totalCoverageGaps: number;
  costUsd: number;
  durationSeconds: number;
  topThemes: { label: string; count: number }[];
}

function findLatestReport(): { path: string; report: AuditReport } | null {
  const files = readdirSync(docsDir)
    .filter((f) => /^M\d-final-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  for (const f of files) {
    try {
      const r = JSON.parse(readFileSync(join(docsDir, f), 'utf8')) as AuditReport;
      // Skip empty/failed reports — they zero-out the public dashboard.
      if (r?.metadata && r?.issuesBySeverity && r.metadata.articlesAudited > 0) {
        return { path: f, report: r };
      }
    } catch {
      // try next
    }
  }
  return null;
}

function deriveTopThemes(r: AuditReport): { label: string; count: number }[] {
  const byOwner: Record<string, number> = {};
  for (const sev of ['P0', 'P1', 'P2'] as const) {
    for (const i of r.issuesBySeverity[sev]) {
      const o = i.suggestedOwner ?? 'Unassigned';
      byOwner[o] = (byOwner[o] ?? 0) + 1;
    }
  }
  return Object.entries(byOwner)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function main(): void {
  const found = findLatestReport();
  if (!found) {
    console.error('No M*-final-*.json reports found. Writing empty dashboard data.');
    const empty: DashboardStats = {
      generatedAt: new Date().toISOString().slice(0, 10),
      sourceFile: '(none)',
      articlesAudited: 0,
      articlesChecked: 0,
      totalP0: 0,
      totalP1: 0,
      totalP2: 0,
      totalConflicts: 0,
      totalCoverageGaps: 0,
      costUsd: 0,
      durationSeconds: 0,
      topThemes: [],
    };
    writeFileSync(targetFile, JSON.stringify(empty, null, 2), 'utf8');
    return;
  }
  const { path, report } = found;
  const m = report.metadata;
  const data: DashboardStats = {
    generatedAt: m.completedAt.split('T')[0] ?? m.completedAt,
    sourceFile: path,
    articlesAudited: m.articlesAudited,
    articlesChecked: m.articlesChecked,
    totalP0: report.issuesBySeverity.P0.length,
    totalP1: report.issuesBySeverity.P1.length,
    totalP2: report.issuesBySeverity.P2.length,
    totalConflicts: report.conflicts.length,
    totalCoverageGaps: report.coverageGaps.length,
    costUsd: Number(m.costEstimateUsd.toFixed(2)),
    durationSeconds: Math.round(m.durationMs / 1000),
    topThemes: deriveTopThemes(report),
  };
  writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${targetFile} from ${path}`);
}

main();
