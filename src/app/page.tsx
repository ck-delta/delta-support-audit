import dashboardData from './dashboard-data.json';

export const metadata = {
  title: 'Delta Support Audit',
  description: 'Daily AI audit of delta.exchange support content vs guides + docs.',
};

interface Stats {
  generatedAt: string;
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

const styles = {
  body: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    background: '#0a0a0a',
    color: '#e5e5e5',
    margin: 0,
    minHeight: '100vh',
  } as const,
  container: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '64px 24px',
  } as const,
  hero: {
    paddingBottom: 48,
    borderBottom: '1px solid #1f1f1f',
  } as const,
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#1a3a1a',
    color: '#7fdf7f',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.4,
    marginBottom: 16,
  } as const,
  h1: {
    fontSize: 56,
    lineHeight: 1.05,
    fontWeight: 700,
    margin: '0 0 16px 0',
    color: '#f5f5f5',
    letterSpacing: -1,
  } as const,
  pitch: {
    fontSize: 21,
    lineHeight: 1.5,
    color: '#a0a0a0',
    margin: '0 0 32px 0',
    maxWidth: 720,
  } as const,
  ctaRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: '#fff',
    color: '#0a0a0a',
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: 15,
  } as const,
  ctaSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: 'transparent',
    color: '#e5e5e5',
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: 15,
    border: '1px solid #2a2a2a',
  } as const,
  section: {
    paddingTop: 64,
  } as const,
  sectionTitle: {
    fontSize: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: '#666',
    fontWeight: 600,
    marginBottom: 24,
  } as const,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  } as const,
  statCard: {
    background: '#121212',
    border: '1px solid #1f1f1f',
    borderRadius: 12,
    padding: 24,
  } as const,
  statValue: {
    fontSize: 36,
    fontWeight: 700,
    color: '#f5f5f5',
    margin: 0,
    lineHeight: 1,
  } as const,
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    margin: 0,
    paddingTop: 8,
  } as const,
  steps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  } as const,
  step: {
    background: '#121212',
    border: '1px solid #1f1f1f',
    borderRadius: 12,
    padding: 24,
  } as const,
  stepNum: {
    display: 'inline-block',
    width: 32,
    height: 32,
    lineHeight: '32px',
    textAlign: 'center' as const,
    background: '#1f1f1f',
    color: '#a0a0a0',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#f5f5f5',
    margin: '0 0 8px 0',
  } as const,
  stepBody: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 1.6,
    margin: 0,
  } as const,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
  } as const,
  panel: {
    background: '#121212',
    border: '1px solid #1f1f1f',
    borderRadius: 12,
    padding: 24,
  } as const,
  panelTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#f5f5f5',
    margin: '0 0 16px 0',
  } as const,
  rowList: {
    listStyle: 'none' as const,
    padding: 0,
    margin: 0,
  } as const,
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #1f1f1f',
    fontSize: 14,
  } as const,
  rowKey: { color: '#a0a0a0' } as const,
  rowVal: { color: '#f5f5f5', fontWeight: 600 } as const,
  example: {
    background: '#0e0e0e',
    border: '1px solid #1f1f1f',
    borderRadius: 12,
    padding: 24,
  } as const,
  severityP0: {
    display: 'inline-block',
    padding: '2px 10px',
    background: '#3a1a1a',
    color: '#ff8a8a',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    marginRight: 8,
  } as const,
  quote: {
    margin: '12px 0',
    padding: '12px 16px',
    background: '#121212',
    borderLeft: '2px solid #444',
    fontSize: 14,
    fontStyle: 'italic' as const,
    color: '#bbb',
    lineHeight: 1.5,
  } as const,
  quoteLabel: {
    fontStyle: 'normal' as const,
    color: '#888',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginRight: 8,
  } as const,
  techGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  } as const,
  techPill: {
    background: '#121212',
    border: '1px solid #1f1f1f',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#a0a0a0',
    textAlign: 'center' as const,
  } as const,
  footer: {
    paddingTop: 64,
    borderTop: '1px solid #1f1f1f',
    marginTop: 64,
    fontSize: 13,
    color: '#666',
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 12,
  } as const,
};

export default function Home() {
  const stats = dashboardData as Stats;
  const totalIssues = stats.totalP0 + stats.totalP1 + stats.totalP2;

  return (
    <main style={styles.body}>
      <div style={styles.container}>
        {/* Hero */}
        <section style={styles.hero}>
          <div style={styles.badge}>● LIVE · Cron @ 04:00 IST daily</div>
          <h1 style={styles.h1}>Delta Support Audit</h1>
          <p style={styles.pitch}>
            A daily AI auditor that reads delta.exchange&apos;s Freshdesk support center, compares each
            article to the official guides + developer docs, and surfaces real factual
            contradictions. Routes each finding to the right team — Support, Docs, Engineering, or
            Product. Self-heals when fixes ship.
          </p>
          <div style={styles.ctaRow}>
            <a
              href="https://github.com/ck-delta/delta-support-audit"
              style={styles.ctaPrimary}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source on GitHub →
            </a>
            <a
              href="https://docs.google.com/spreadsheets/d/1fjIVjhD5dJzbkdppYrBoOLq_HfNkUadccNH0TVo_huw/edit"
              style={styles.ctaSecondary}
              target="_blank"
              rel="noopener noreferrer"
            >
              Live findings (Google Sheets) →
            </a>
          </div>
        </section>

        {/* Stats */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Latest run · {stats.generatedAt}</div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.articlesAudited}</p>
              <p style={styles.statLabel}>articles audited</p>
            </div>
            <div style={styles.statCard}>
              <p style={{ ...styles.statValue, color: '#ff8a8a' }}>{stats.totalP0}</p>
              <p style={styles.statLabel}>P0 issues found</p>
            </div>
            <div style={styles.statCard}>
              <p style={{ ...styles.statValue, color: '#ffd57a' }}>{stats.totalP1}</p>
              <p style={styles.statLabel}>P1 issues found</p>
            </div>
            <div style={styles.statCard}>
              <p style={{ ...styles.statValue, color: '#8ad5ff' }}>{stats.totalP2}</p>
              <p style={styles.statLabel}>P2 issues found</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{stats.totalConflicts}</p>
              <p style={styles.statLabel}>guides ↔ docs conflicts</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>${stats.costUsd.toFixed(2)}</p>
              <p style={styles.statLabel}>full sweep cost</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>How it works</div>
          <div style={styles.steps}>
            <div style={styles.step}>
              <div style={styles.stepNum}>1</div>
              <h3 style={styles.stepTitle}>Vercel cron fires daily</h3>
              <p style={styles.stepBody}>
                04:00 IST. Hits <code>/api/audit</code> with a bearer-token-protected route.
              </p>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>2</div>
              <h3 style={styles.stepTitle}>Hash-check changed articles</h3>
              <p style={styles.stepBody}>
                SHA-256 of normalized article text vs Upstash Redis. Skip 99.5% of articles on
                quiet days — costs near-zero.
              </p>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>3</div>
              <h3 style={styles.stepTitle}>RAG retrieval, no manual mapping</h3>
              <p style={styles.stepBody}>
                For each changed article: top-5 from guides + top-5 from docs via Upstash Vector
                semantic search.
              </p>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>4</div>
              <h3 style={styles.stepTitle}>Sonnet 4.6 multi-task call</h3>
              <p style={styles.stepBody}>
                One LLM call returns both <em>support↔SoT contradictions</em> AND{' '}
                <em>guides↔docs conflicts</em>. Halves cost vs naive 2-call.
              </p>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>5</div>
              <h3 style={styles.stepTitle}>Self-healing dedup</h3>
              <p style={styles.stepBody}>
                <code>issueId = sha256(sotUrl + summary)</code>. New / still-open / resolved
                states roll automatically. Zero manual issue tracking.
              </p>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNum}>6</div>
              <h3 style={styles.stepTitle}>Slack + Notion + Sheets</h3>
              <p style={styles.stepBody}>
                P0s alert Slack. Notion gets the snapshot. Sheets is the human triage workspace
                with Verdict dropdowns.
              </p>
            </div>
          </div>
        </section>

        {/* Two-col: Issue routing + Tech */}
        <section style={styles.section}>
          <div style={styles.twoCol}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Issue routing (top owners)</h3>
              <ul style={styles.rowList}>
                {stats.topThemes.map((t) => (
                  <li key={t.label} style={styles.row}>
                    <span style={styles.rowKey}>{t.label}</span>
                    <span style={styles.rowVal}>{t.count} findings</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Run economics</h3>
              <ul style={styles.rowList}>
                <li style={styles.row}>
                  <span style={styles.rowKey}>Articles checked</span>
                  <span style={styles.rowVal}>{stats.articlesChecked}</span>
                </li>
                <li style={styles.row}>
                  <span style={styles.rowKey}>Total findings</span>
                  <span style={styles.rowVal}>{totalIssues + stats.totalConflicts}</span>
                </li>
                <li style={styles.row}>
                  <span style={styles.rowKey}>Sweep cost</span>
                  <span style={styles.rowVal}>${stats.costUsd.toFixed(2)}</span>
                </li>
                <li style={styles.row}>
                  <span style={styles.rowKey}>Sweep duration</span>
                  <span style={styles.rowVal}>{Math.round(stats.durationSeconds)}s</span>
                </li>
                <li style={styles.row}>
                  <span style={styles.rowKey}>Daily incremental</span>
                  <span style={styles.rowVal}>~$0–0.30</span>
                </li>
                <li style={styles.row}>
                  <span style={styles.rowKey}>FP rate (P0+P1)</span>
                  <span style={styles.rowVal}>5–9%</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Example finding */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>What a finding looks like</div>
          <div style={styles.example}>
            <div>
              <span style={styles.severityP0}>P0</span>
              <strong style={{ color: '#f5f5f5' }}>
                Support article claims funding is exchanged every minute, but guides state it&apos;s
                exchanged once every 8 hours
              </strong>
            </div>
            <div style={styles.quote}>
              <span style={styles.quoteLabel}>Support says</span>
              On Delta Exchange, this exchange of funding is a continuous process that happens
              once every minute.
            </div>
            <div style={styles.quote}>
              <span style={styles.quoteLabel}>SoT says</span>
              Funding is exchanged between longs and shorts once every 8 hours at 8am, 4pm, 12am
              UTC. The current method was made effective from 12pm UTC on 8-Sep-2025.
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#888',
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #1f1f1f',
              }}
            >
              <strong style={{ color: '#a0a0a0' }}>Confidence:</strong> 0.97 ·{' '}
              <strong style={{ color: '#a0a0a0' }}>Suggested owner:</strong> Support ·{' '}
              <strong style={{ color: '#a0a0a0' }}>First seen:</strong> {stats.generatedAt}
            </div>
          </div>
        </section>

        {/* Tech stack */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Stack</div>
          <div style={styles.techGrid}>
            <div style={styles.techPill}>Next.js 15</div>
            <div style={styles.techPill}>Vercel Cron</div>
            <div style={styles.techPill}>Sonnet 4.6 (OpenRouter)</div>
            <div style={styles.techPill}>Upstash Vector</div>
            <div style={styles.techPill}>Upstash Redis</div>
            <div style={styles.techPill}>Freshdesk API</div>
            <div style={styles.techPill}>Notion API</div>
            <div style={styles.techPill}>Slack Webhooks</div>
            <div style={styles.techPill}>Google Sheets API</div>
          </div>
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <span>Built by Charandeep Kapoor · Delta Exchange</span>
          <span>
            <a href="https://github.com/ck-delta/delta-support-audit" style={{ color: '#888' }}>
              GitHub
            </a>{' '}
            ·{' '}
            <a
              href="https://docs.google.com/spreadsheets/d/1fjIVjhD5dJzbkdppYrBoOLq_HfNkUadccNH0TVo_huw/edit"
              style={{ color: '#888' }}
            >
              Live findings
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}
