/**
 * Ledger view: one row per credential, windows as aligned columns, grouped by
 * provider (or flat when ordered by recovery). The full per-provider detail —
 * reset credits, extra usage, plan badges — stays in the card view.
 */

import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import type { ResolvedTheme } from '@/types';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { getTypeLabel } from '@/features/authFiles/constants';
import { QUOTA_TAB_ORDER } from '../constants';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '../logic';
import { QUOTA_ADAPTERS, type QuotaCardState } from '../providers';
import type { QuotaProviderType } from '../providers/types';
import {
  formatLedgerPercent as formatPercent,
  type LedgerCredential,
  type LedgerWindow,
} from '../quotaLedgerModel';
import { QuotaProviderIcon } from './QuotaProviderIcon';
import { LedgerBar, LedgerResetText } from './QuotaLedgerParts';
import styles from './QuotaLedger.module.scss';

export interface QuotaLedgerProps {
  /** Rows in display order (the current page). */
  entries: QuotaFileEntry[];
  /** Group under provider headings; false renders one flat list. */
  grouped: boolean;
  /** Credentials per provider across the whole filtered set, for the headings. */
  groupCounts: Record<string, number>;
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  credentialFor: (entry: QuotaFileEntry) => LedgerCredential;
  nameFor: (entry: QuotaFileEntry) => string;
  resolvedTheme: ResolvedTheme;
  nowMs: number;
  canUseActions: boolean;
  resettingQuotaName: string | null;
  onRefresh: (entry: QuotaFileEntry) => void;
}

function WindowCell({ window, nowMs }: { window: LedgerWindow; nowMs: number }) {
  return (
    <div className={`${styles.cell} ${window.role === 'secondary' ? styles.cellMuted : ''}`}>
      <div className={styles.cellHead}>
        <span className={styles.cellLabel} title={window.label}>
          {window.label}
        </span>
        <span className={styles.cellPercent}>{formatPercent(window.remaining)}</span>
      </div>
      <LedgerBar percent={window.remaining} />
      <div className={styles.cellReset}>
        <LedgerResetText atMs={window.resetAtMs} nowMs={nowMs} />
      </div>
    </div>
  );
}

interface LedgerRowProps {
  entry: QuotaFileEntry;
  quota: QuotaCardState | undefined;
  credential: LedgerCredential;
  name: string;
  showProvider: boolean;
  resolvedTheme: ResolvedTheme;
  nowMs: number;
  canRefresh: boolean;
  resetting: boolean;
  onRefresh: () => void;
}

function LedgerRow(props: LedgerRowProps) {
  const {
    entry,
    quota,
    credential,
    name,
    showProvider,
    resolvedTheme,
    nowMs,
    canRefresh,
    resetting,
    onRefresh,
  } = props;
  const { t } = useTranslation();
  const adapter = QUOTA_ADAPTERS[entry.type];
  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  const hasWindows = credential.windows.length > 0;
  const providerLabel = getTypeLabel(t, entry.type);
  const subtitle = [showProvider ? providerLabel : null, credential.planLabel]
    .filter(Boolean)
    .join(' · ');

  let body;
  if (hasWindows) {
    body = credential.windows.map((window) => (
      <WindowCell key={window.id} window={window} nowMs={nowMs} />
    ));
  } else if (loading) {
    body = (
      <div className={styles.rowSkeleton} aria-busy="true">
        <span className={styles.srOnly}>{t(`${adapter.i18nPrefix}.loading`)}</span>
        {[0, 1, 2].map((index) => (
          <span key={index} className={styles.skeletonCell} aria-hidden="true" />
        ))}
      </div>
    );
  } else if (status === 'error') {
    body = null;
  } else if (status === 'success') {
    body = <span className={styles.rowHint}>{t('quota_management.ledger_no_windows')}</span>;
  } else {
    body = <span className={styles.rowHint}>{t('quota_management.ledger_idle')}</span>;
  }

  return (
    <li className={styles.row}>
      <div className={styles.identity}>
        {showProvider && (
          <QuotaProviderIcon
            provider={entry.type}
            resolvedTheme={resolvedTheme}
            className={styles.rowIcon}
            imageClassName={styles.rowIconImage}
          />
        )}
        <div className={styles.identityText}>
          <span className={styles.fileName} title={name}>
            {name}
          </span>
          {subtitle && <span className={styles.plan}>{subtitle}</span>}
        </div>
      </div>

      <div className={styles.windows}>
        {body}
        {status === 'error' && (
          <div className={styles.rowError} role="alert">
            {t(`${adapter.i18nPrefix}.load_failed`, {
              message: resolveQuotaErrorMessage(
                t,
                quota?.errorStatus,
                quota?.error || t('common.unknown_error')
              ),
            })}
          </div>
        )}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.rowRefresh}
          onClick={onRefresh}
          disabled={isQuotaRefreshDisabled(canRefresh, loading, resetting)}
          title={t('auth_files.quota_refresh_hint')}
        >
          <IconRefreshCw size={13} className={loading ? styles.spinning : undefined} />
          {t('auth_files.quota_refresh_single')}
        </button>
      </div>
    </li>
  );
}

export function QuotaLedger(props: QuotaLedgerProps) {
  const {
    entries,
    grouped,
    groupCounts,
    quotaFor,
    credentialFor,
    nameFor,
    resolvedTheme,
    nowMs,
    canUseActions,
    resettingQuotaName,
    onRefresh,
  } = props;
  const { t } = useTranslation();

  const renderRows = (rows: QuotaFileEntry[]) => (
    <ul className={styles.rows}>
      {rows.map((entry) => {
        const key = getQuotaCacheKey(entry.file);
        return (
          <LedgerRow
            key={`${entry.type}:${key}`}
            entry={entry}
            quota={quotaFor(entry)}
            credential={credentialFor(entry)}
            name={nameFor(entry)}
            showProvider={!grouped}
            resolvedTheme={resolvedTheme}
            nowMs={nowMs}
            canRefresh={canUseActions && !entry.file.disabled}
            resetting={resettingQuotaName === key}
            onRefresh={() => onRefresh(entry)}
          />
        );
      })}
    </ul>
  );

  if (!grouped) {
    return <div className={styles.ledger}>{renderRows(entries)}</div>;
  }

  const groups = QUOTA_TAB_ORDER.map((type): [QuotaProviderType, QuotaFileEntry[]] => [
    type,
    entries.filter((entry) => entry.type === type),
  ]).filter(([, rows]) => rows.length > 0);

  return (
    <div className={styles.ledger}>
      {groups.map(([type, rows]) => {
        const label = getTypeLabel(t, type);
        return (
          <section key={type} className={styles.group} aria-label={label}>
            <h2 className={styles.groupTitle}>
              {label}
              <span className={styles.groupCount}>{groupCounts[type] ?? rows.length}</span>
            </h2>
            {renderRows(rows)}
          </section>
        );
      })}
    </div>
  );
}
