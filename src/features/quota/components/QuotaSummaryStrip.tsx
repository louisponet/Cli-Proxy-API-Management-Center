/**
 * Per-provider totals above the ledger: how much of each provider's budget is
 * left across every credential, one bar segment per credential.
 */

import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import { getTypeLabel } from '@/features/authFiles/constants';
import {
  formatLedgerPercent as formatPercent,
  type LedgerProviderSummary,
  type LedgerSummaryMetric,
} from '../quotaLedgerModel';
import { QuotaProviderIcon } from './QuotaProviderIcon';
import { LedgerFill, LedgerResetText } from './QuotaLedgerParts';
import styles from './QuotaLedger.module.scss';

const SUMMARY_MAX_COLUMNS = 4;

export interface QuotaSummaryStripProps {
  summaries: LedgerProviderSummary[];
  resolvedTheme: ResolvedTheme;
  nowMs: number;
  /** Display name for a segment's credential (already masked when emails are hidden). */
  nameFor: (key: string) => string;
}

function SegmentedBar({
  metric,
  nameFor,
}: {
  metric: LedgerSummaryMetric;
  nameFor: (key: string) => string;
}) {
  return (
    <span className={styles.segments} aria-hidden="true">
      {metric.segments.map((segment) => (
        <span
          key={segment.key}
          className={styles.segment}
          title={`${nameFor(segment.key)} · ${formatPercent(segment.remaining)}`}
        >
          <LedgerFill percent={segment.remaining} />
        </span>
      ))}
    </span>
  );
}

function SummaryCell({
  summary,
  resolvedTheme,
  nowMs,
  nameFor,
}: {
  summary: LedgerProviderSummary;
  resolvedTheme: ResolvedTheme;
  nowMs: number;
  nameFor: (key: string) => string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { primary, secondary, credentialCount, provider } = summary;
  const providerLabel = getTypeLabel(t, provider);
  const capacity = `${credentialCount * 100}%`;
  const [firstSecondary] = secondary;

  return (
    <section className={styles.summaryCell} aria-label={providerLabel}>
      <header className={styles.summaryHead}>
        <QuotaProviderIcon
          provider={provider}
          resolvedTheme={resolvedTheme}
          className={styles.summaryIcon}
          imageClassName={styles.summaryIconImage}
        />
        <span className={styles.summaryName}>{providerLabel}</span>
        <span className={styles.summaryCount}>
          {t('quota_management.summary_credentials', { count: credentialCount })}
        </span>
      </header>

      <div className={styles.summaryMetricLabel}>
        {primary?.label || t('quota_management.summary_not_loaded')}
      </div>
      <div
        className={styles.summaryFigure}
        role="img"
        aria-label={t('quota_management.summary_meter_label', {
          label: primary?.label || providerLabel,
          total: formatPercent(primary?.total ?? null),
          capacity,
        })}
      >
        <span className={styles.summaryTotal}>{formatPercent(primary?.total ?? null)}</span>
        <span className={styles.summaryCapacity}>
          {t('quota_management.summary_of', { capacity })}
        </span>
      </div>
      {primary ? (
        <SegmentedBar metric={primary} nameFor={nameFor} />
      ) : (
        <span className={styles.segments} aria-hidden="true">
          {Array.from({ length: credentialCount }, (_, index) => (
            <span key={index} className={styles.segment} />
          ))}
        </span>
      )}
      <div className={styles.summaryReset}>
        <LedgerResetText atMs={primary?.nextResetMs ?? null} nowMs={nowMs} />
      </div>

      {firstSecondary && (
        <div className={styles.summarySecondary}>
          <div className={styles.summarySecondaryHead}>
            <span className={styles.summarySecondaryLabel}>{firstSecondary.label}</span>
            <span className={styles.summarySecondaryValue}>
              {formatPercent(firstSecondary.total)}
            </span>
            {secondary.length > 1 && (
              <span className={styles.summarySecondaryMore}>
                {t('quota_management.summary_more', { count: secondary.length - 1 })}
              </span>
            )}
            <button
              type="button"
              className={styles.summaryToggle}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? t('quota_management.summary_hide') : t('quota_management.summary_show')}
            </button>
          </div>
          {expanded &&
            secondary.map((metric) => (
              <div key={metric.id} className={styles.summarySecondaryDetail}>
                {secondary.length > 1 && (
                  <div className={styles.summarySecondaryHead}>
                    <span className={styles.summarySecondaryLabel}>{metric.label}</span>
                    <span className={styles.summarySecondaryValue}>
                      {formatPercent(metric.total)}
                    </span>
                  </div>
                )}
                <SegmentedBar metric={metric} nameFor={nameFor} />
                <div className={styles.summaryReset}>
                  <LedgerResetText atMs={metric.nextResetMs} nowMs={nowMs} />
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

export function QuotaSummaryStrip({
  summaries,
  resolvedTheme,
  nowMs,
  nameFor,
}: QuotaSummaryStripProps) {
  const { t } = useTranslation();
  if (summaries.length === 0) return null;

  // Up to four per row; past that, balance the rows (5 → 3+2, 7 → 4+3).
  const count = summaries.length;
  const cols = count <= SUMMARY_MAX_COLUMNS ? count : Math.ceil(count / Math.ceil(count / 4));
  const layout = {
    '--summary-cols': cols,
    '--summary-span': count < SUMMARY_MAX_COLUMNS ? count / SUMMARY_MAX_COLUMNS : 1,
  } as CSSProperties;

  return (
    <div className={styles.summaryWrap}>
      <div
        className={styles.summaryStrip}
        style={layout}
        role="group"
        aria-label={t('quota_management.summary_label')}
      >
        {summaries.map((summary) => (
          <SummaryCell
            key={summary.provider}
            summary={summary}
            resolvedTheme={resolvedTheme}
            nowMs={nowMs}
            nameFor={nameFor}
          />
        ))}
      </div>
    </div>
  );
}
