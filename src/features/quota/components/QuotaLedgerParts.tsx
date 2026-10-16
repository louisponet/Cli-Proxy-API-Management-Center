/**
 * Small pieces shared by the ledger rows and the summary strip.
 */

import { useTranslation } from 'react-i18next';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { QUOTA_PROGRESS_HIGH_THRESHOLD, QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './QuotaMeter';
import styles from './QuotaLedger.module.scss';

/** Same three bands as the card meter, so a colour means the same thing in both views. */
function levelClass(percent: number | null): string {
  if (percent === null) return '';
  if (percent >= QUOTA_PROGRESS_HIGH_THRESHOLD) return styles.levelHigh;
  if (percent >= QUOTA_PROGRESS_MEDIUM_THRESHOLD) return styles.levelMedium;
  return styles.levelLow;
}

/** `in 1 day · 09/13, 13:00`, or "No reset pending" when no window is counting down. */
export function LedgerResetText({ atMs, nowMs }: { atMs: number | null; nowMs: number }) {
  const { t, i18n } = useTranslation();
  if (atMs === null) {
    return <span className={styles.resetIdle}>{t('quota_management.no_reset_pending')}</span>;
  }
  return (
    <span className={styles.reset}>
      <span className={styles.resetRelative}>
        {formatRelativeInstant(atMs, nowMs, i18n.resolvedLanguage)}
      </span>
      <span className={styles.resetAbsolute}>{formatInstantShort(atMs)}</span>
    </span>
  );
}

/** Banded fill for a track or a summary segment; null renders an empty track. */
export function LedgerFill({ percent }: { percent: number | null }) {
  const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <span className={`${styles.fill} ${levelClass(percent)}`} style={{ width: `${width}%` }} />
  );
}

/** Thin track with a banded fill; decorative — the figure beside it carries the value. */
export function LedgerBar({ percent }: { percent: number | null }) {
  return (
    <span className={styles.track} aria-hidden="true">
      <LedgerFill percent={percent} />
    </span>
  );
}
