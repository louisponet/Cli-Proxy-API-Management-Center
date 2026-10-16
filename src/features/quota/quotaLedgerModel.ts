/**
 * Ledger view model: every provider's quota flattened into one window shape.
 *
 * The cards render each provider on its own terms; the ledger instead lines
 * credentials up as rows of comparable columns and sums them per provider.
 * That only works once a window means the same thing everywhere — remaining
 * percent, a reset instant, a period — so this module does the per-provider
 * reading once and the components never look at raw state.
 *
 * Pure and React-free: `t` and `nowMs` are passed in, quota state is read
 * structurally, nothing here touches the store.
 */

import type { TFunction } from 'i18next';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  PluginQuotaState,
  XaiQuotaState,
} from '@/types';
import {
  resolveAntigravityBucketLabelKey,
  resolveAntigravityGroupLabelKey,
  resolveAntigravityPlanLabel,
} from './providers/antigravity/labels';
import { resolveCodexPlanLabel } from './providers/codex/planLabel';
import type { QuotaProviderType } from './providers/types';

/**
 * How a window is presented.
 *
 * - `primary`: the long window the provider is budgeted by; it leads the row
 *   and is what the summary strip totals.
 * - `session`: the short rolling window, kept at full emphasis because it is
 *   what blocks the next request.
 * - `secondary`: everything else — still shown, but de-emphasised so the two
 *   numbers that matter stay legible across a column of rows.
 */
export type LedgerWindowRole = 'primary' | 'session' | 'secondary';

export interface LedgerWindow {
  id: string;
  label: string;
  /** Remaining percent, 0..100; null when the provider reported no figure. */
  remaining: number | null;
  resetAtMs: number | null;
  periodHours: number | null;
  role: LedgerWindowRole;
}

export interface LedgerCredential {
  windows: LedgerWindow[];
  planLabel: string | null;
}

/** Windows at or under a day are "session" windows: they gate the next request. */
const SESSION_MAX_HOURS = 24;

/** Provider-preferred primary windows, most preferred first. */
const PRIMARY_WINDOW_PREFERENCE: Partial<Record<QuotaProviderType, readonly string[]>> = {
  // The model-scoped weekly limit binds before the account-wide one does.
  claude: ['seven-day-fable', 'seven-day'],
  codex: ['weekly', 'monthly'],
  xai: ['weekly', 'monthly'],
  devin: ['weekly'],
  meta: ['weekly'],
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const remainingFromUsed = (used: unknown): number | null => {
  const value = finiteOrNull(used);
  return value === null ? null : clampPercent(100 - value);
};

type RawWindow = Omit<LedgerWindow, 'role'>;

/* ---------------------------------------------------------- per provider */

const fromPercentUsedWindows = (
  windows:
    | {
        id: string;
        label: string;
        labelKey?: string;
        labelParams?: Record<string, string | number>;
        usedPercent: number | null;
        resetAtMs?: number | null;
        periodHours?: number | null;
      }[]
    | undefined,
  t: TFunction
): RawWindow[] =>
  (windows ?? []).map((window) => ({
    id: window.id,
    label: window.labelKey ? String(t(window.labelKey, window.labelParams ?? {})) : window.label,
    remaining: remainingFromUsed(window.usedPercent),
    resetAtMs: finiteOrNull(window.resetAtMs),
    periodHours: finiteOrNull(window.periodHours),
  }));

const fromBucketGroups = (
  groups: AntigravityQuotaState['groups'] | undefined,
  t: TFunction
): RawWindow[] => {
  const list = groups ?? [];
  const prefixGroups = list.length > 1;
  return list.flatMap((group) => {
    const groupKey = resolveAntigravityGroupLabelKey(group.label);
    const groupLabel = groupKey ? String(t(`antigravity_quota.${groupKey}`)) : group.label;
    return (group.buckets ?? []).map((bucket) => {
      const bucketKey = resolveAntigravityBucketLabelKey(bucket.label, bucket.window);
      const bucketLabel = bucketKey ? String(t(`antigravity_quota.${bucketKey}`)) : bucket.label;
      const fraction = finiteOrNull(bucket.remainingFraction);
      return {
        id: `${group.id}:${bucket.id}`,
        label: prefixGroups && groupLabel ? `${groupLabel} · ${bucketLabel}` : bucketLabel,
        remaining: fraction === null ? null : clampPercent(Math.round(fraction * 100)),
        resetAtMs: finiteOrNull(bucket.resetAtMs),
        periodHours: finiteOrNull(bucket.periodHours),
      };
    });
  });
};

const fromKimiRows = (rows: KimiQuotaState['rows'] | undefined, t: TFunction): RawWindow[] =>
  (rows ?? []).map((row) => ({
    id: row.id,
    label: row.labelKey
      ? String(t(row.labelKey, (row.labelParams ?? {}) as Record<string, string | number>))
      : (row.label ?? ''),
    remaining:
      row.limit > 0
        ? clampPercent(Math.round(((row.limit - row.used) / row.limit) * 100))
        : row.used > 0
          ? 0
          : null,
    resetAtMs: finiteOrNull(row.resetAtMs),
    periodHours: finiteOrNull(row.periodHours),
  }));

const fromXaiBilling = (billing: XaiQuotaState['billing'], t: TFunction): RawWindow[] => {
  if (!billing) return [];
  if (billing.periodType === 'weekly') {
    return [
      {
        id: 'weekly',
        label: String(t('xai_quota.weekly_limit')),
        remaining: remainingFromUsed(billing.usagePercent),
        resetAtMs: finiteOrNull(billing.resetAtMs),
        periodHours: finiteOrNull(billing.periodHours) ?? 24 * 7,
      },
    ];
  }
  if (billing.monthlyLimitCents !== null || billing.usedPercent !== null) {
    return [
      {
        id: 'monthly',
        label: String(t('xai_quota.monthly_credits')),
        remaining: remainingFromUsed(billing.usedPercent),
        resetAtMs: finiteOrNull(billing.resetAtMs),
        periodHours: finiteOrNull(billing.periodHours),
      },
    ];
  }
  return [];
};

const fromDevinWindows = (
  windows: DevinQuotaState['windows'] | undefined,
  t: TFunction
): RawWindow[] =>
  (windows ?? []).map((window) => ({
    id: window.id,
    label: window.label ?? String(t(`devin_quota.${window.id}`)),
    remaining: finiteOrNull(window.remainingPercent),
    resetAtMs: finiteOrNull(window.resetAtMs),
    periodHours: finiteOrNull(window.periodHours),
  }));

const fromMetaWindows = (data: MetaQuotaState['data'], t: TFunction): RawWindow[] =>
  (data?.windows ?? []).map((window) => {
    const resetAt = finiteOrNull(window.resetAt);
    const minutes = window.id === 'weekly' ? 7 * 24 * 60 : finiteOrNull(window.durationMinutes);
    return {
      id: window.id,
      label: String(t(`meta_quota.${window.id}`)),
      remaining: remainingFromUsed(window.usedPercent),
      // Meta reports Unix seconds.
      resetAtMs: resetAt === null ? null : resetAt * 1000,
      periodHours: minutes === null ? null : minutes / 60,
    };
  });

/* ---------------------------------------------------------------- roles */

/**
 * Order windows primary → session → secondary and tag each with its role.
 *
 * The primary is the provider's preferred id when present, otherwise the
 * longest window (first wins a tie, preserving the provider's own order).
 * Windows with no period at all can still be primary when nothing else is.
 */
export function assignWindowRoles(
  provider: QuotaProviderType,
  windows: readonly RawWindow[]
): LedgerWindow[] {
  if (windows.length === 0) return [];

  const preference = PRIMARY_WINDOW_PREFERENCE[provider] ?? [];
  const preferred = preference
    .map((id) => windows.find((window) => window.id === id))
    .find((window) => window !== undefined);
  const primary =
    preferred ??
    windows.reduce((best, window) =>
      (window.periodHours ?? 0) > (best.periodHours ?? 0) ? window : best
    );

  const session = windows
    .filter(
      (window) =>
        window !== primary &&
        window.periodHours !== null &&
        window.periodHours > 0 &&
        window.periodHours <= SESSION_MAX_HOURS
    )
    .reduce<RawWindow | null>(
      (best, window) =>
        best === null || (window.periodHours as number) < (best.periodHours as number)
          ? window
          : best,
      null
    );

  return [
    { ...primary, role: 'primary' as const },
    ...(session ? [{ ...session, role: 'session' as const }] : []),
    ...windows
      .filter((window) => window !== primary && window !== session)
      .map((window) => ({ ...window, role: 'secondary' as const })),
  ];
}

/* ------------------------------------------------------------ credential */

/**
 * Normalize one credential's quota.
 *
 * Read whatever the state carries rather than gating on `success`: the Claude
 * store keeps the last observation through a reload or a failed read, and the
 * row should keep showing it (beside the spinner or error) just like the card.
 * Every other provider's loading/error state is empty, so yields no windows.
 */
export function buildLedgerCredential(
  provider: QuotaProviderType,
  quota: { status?: string } | undefined,
  t: TFunction
): LedgerCredential {
  if (!quota || quota.status === 'idle') return { windows: [], planLabel: null };

  switch (provider) {
    case 'claude': {
      const state = quota as ClaudeQuotaState;
      return {
        windows: assignWindowRoles(provider, fromPercentUsedWindows(state.windows, t)),
        planLabel: state.planType ? String(t(`claude_quota.${state.planType}`)) : null,
      };
    }
    case 'codex': {
      const state = quota as CodexQuotaState;
      return {
        windows: assignWindowRoles(provider, fromPercentUsedWindows(state.windows, t)),
        planLabel: resolveCodexPlanLabel(state.planType, t),
      };
    }
    case 'antigravity': {
      const state = quota as AntigravityQuotaState;
      return {
        windows: assignWindowRoles(provider, fromBucketGroups(state.groups, t)),
        planLabel: resolveAntigravityPlanLabel(state.subscription, t),
      };
    }
    case 'plugin': {
      const state = quota as PluginQuotaState;
      return {
        windows: assignWindowRoles(provider, fromBucketGroups(state.groups, t)),
        planLabel: resolveAntigravityPlanLabel(state.subscription, t),
      };
    }
    case 'kimi': {
      const state = quota as KimiQuotaState;
      return { windows: assignWindowRoles(provider, fromKimiRows(state.rows, t)), planLabel: null };
    }
    case 'xai': {
      const state = quota as XaiQuotaState;
      return {
        windows: assignWindowRoles(provider, fromXaiBilling(state.billing, t)),
        planLabel: state.billing?.planLabel ?? null,
      };
    }
    case 'devin': {
      const state = quota as DevinQuotaState;
      return {
        windows: assignWindowRoles(provider, fromDevinWindows(state.windows, t)),
        planLabel: state.plan ?? null,
      };
    }
    case 'meta': {
      const state = quota as MetaQuotaState;
      return {
        windows: assignWindowRoles(provider, fromMetaWindows(state.data, t)),
        planLabel: state.data?.planName ?? null,
      };
    }
    default:
      return { windows: [], planLabel: null };
  }
}

/** `58%`, or `--` when the provider reported no figure. */
export const formatLedgerPercent = (value: number | null): string =>
  value === null ? '--' : `${Math.round(value)}%`;

/* --------------------------------------------------------------- summary */

export interface LedgerSummarySegment {
  key: string;
  /** Null when the credential isn't loaded or doesn't report this window. */
  remaining: number | null;
}

export interface LedgerSummaryMetric {
  id: string;
  label: string;
  /** One segment per credential, in row order. */
  segments: LedgerSummarySegment[];
  /** Sum of the known remaining percentages; null when none is known. */
  total: number | null;
  /** Credential count × 100 — the most the total can reach. */
  capacity: number;
  /** Earliest upcoming reset of this window across credentials. */
  nextResetMs: number | null;
}

export interface LedgerProviderSummary {
  provider: QuotaProviderType;
  credentialCount: number;
  primary: LedgerSummaryMetric | null;
  secondary: LedgerSummaryMetric[];
}

export interface LedgerSummaryInput {
  key: string;
  credential: LedgerCredential;
}

const buildMetric = (
  id: string,
  inputs: readonly LedgerSummaryInput[],
  nowMs: number
): LedgerSummaryMetric => {
  let label = '';
  let total: number | null = null;
  let nextResetMs: number | null = null;

  const segments = inputs.map(({ key, credential }) => {
    const window = credential.windows.find((candidate) => candidate.id === id);
    if (!window) return { key, remaining: null };
    if (!label) label = window.label;
    if (window.remaining !== null) total = (total ?? 0) + window.remaining;
    if (
      window.resetAtMs !== null &&
      window.resetAtMs > nowMs &&
      (nextResetMs === null || window.resetAtMs < nextResetMs)
    ) {
      nextResetMs = window.resetAtMs;
    }
    return { key, remaining: window.remaining };
  });

  return {
    id,
    label,
    segments,
    total: total === null ? null : Math.round(total),
    capacity: inputs.length * 100,
    nextResetMs,
  };
};

/**
 * Totals for one provider's credentials.
 *
 * The primary metric is whichever window id is primary for the most loaded
 * credentials (first seen wins a tie), so one odd account can't relabel the
 * whole provider. Secondary metrics are the remaining long windows in first-
 * seen order; session windows are left to the rows.
 */
export function buildProviderSummary(
  provider: QuotaProviderType,
  inputs: readonly LedgerSummaryInput[],
  nowMs: number
): LedgerProviderSummary {
  const primaryVotes = new Map<string, number>();
  const secondaryIds: string[] = [];

  inputs.forEach(({ credential }) => {
    credential.windows.forEach((window) => {
      if (window.role === 'primary') {
        primaryVotes.set(window.id, (primaryVotes.get(window.id) ?? 0) + 1);
      } else if (window.role === 'secondary' && !secondaryIds.includes(window.id)) {
        secondaryIds.push(window.id);
      }
    });
  });

  let primaryId: string | null = null;
  let bestVotes = 0;
  primaryVotes.forEach((votes, id) => {
    if (votes > bestVotes) {
      primaryId = id;
      bestVotes = votes;
    }
  });

  return {
    provider,
    credentialCount: inputs.length,
    primary: primaryId === null ? null : buildMetric(primaryId, inputs, nowMs),
    secondary: secondaryIds
      .filter((id) => id !== primaryId)
      .map((id) => buildMetric(id, inputs, nowMs)),
  };
}
