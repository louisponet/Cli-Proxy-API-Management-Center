/**
 * Ledger view model: provider states flattened into comparable windows, and
 * per-provider totals for the summary strip.
 */

import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  assignWindowRoles,
  buildLedgerCredential,
  buildProviderSummary,
  type LedgerCredential,
} from '@/features/quota/quotaLedgerModel';

/** Echo the key so assertions don't depend on any locale's wording. */
const t = ((key: string) => key) as unknown as TFunction;

const NOW = Date.UTC(2026, 9, 16, 12);
const HOUR = 60 * 60 * 1000;

const claudeQuota = (fable: number, fiveHour: number, sevenDay: number, resetAtMs: number) => ({
  status: 'success',
  planType: 'plan_max',
  windows: [
    {
      id: 'five-hour',
      label: '5-hour limit',
      labelKey: 'claude_quota.five_hour',
      usedPercent: fiveHour,
      resetLabel: '-',
      resetAtMs: null,
      periodHours: 5,
    },
    {
      id: 'seven-day',
      label: '7-day limit',
      labelKey: 'claude_quota.seven_day',
      usedPercent: sevenDay,
      resetLabel: '-',
      resetAtMs,
      periodHours: 168,
    },
    {
      id: 'seven-day-fable',
      label: '7-day Fable 5',
      labelKey: 'claude_quota.seven_day_fable',
      usedPercent: fable,
      resetLabel: '-',
      resetAtMs,
      periodHours: 168,
    },
  ],
});

describe('assignWindowRoles', () => {
  const raw = (id: string, periodHours: number | null) => ({
    id,
    label: id,
    remaining: 50,
    resetAtMs: null,
    periodHours,
  });

  test('leads with the provider-preferred window, then the shortest session window', () => {
    const roles = assignWindowRoles('claude', [
      raw('five-hour', 5),
      raw('seven-day', 168),
      raw('seven-day-fable', 168),
    ]);
    expect(roles.map((window) => [window.id, window.role])).toEqual([
      ['seven-day-fable', 'primary'],
      ['five-hour', 'session'],
      ['seven-day', 'secondary'],
    ]);
  });

  test('falls back to the longest window when no preferred id is present', () => {
    const roles = assignWindowRoles('kimi', [raw('5h', 5), raw('weekly', 168), raw('misc', null)]);
    expect(roles.map((window) => [window.id, window.role])).toEqual([
      ['weekly', 'primary'],
      ['5h', 'session'],
      ['misc', 'secondary'],
    ]);
  });

  test('a lone window without a period is still primary', () => {
    expect(assignWindowRoles('plugin', [raw('credits', null)])[0].role).toBe('primary');
    expect(assignWindowRoles('plugin', [])).toEqual([]);
  });
});

describe('buildLedgerCredential', () => {
  test('reads Claude windows as remaining percent with the plan label', () => {
    const credential = buildLedgerCredential('claude', claudeQuota(42, 0, 21, NOW + 39 * HOUR), t);
    expect(credential.planLabel).toBe('claude_quota.plan_max');
    expect(credential.windows.map((window) => [window.label, window.remaining])).toEqual([
      ['claude_quota.seven_day_fable', 58],
      ['claude_quota.five_hour', 100],
      ['claude_quota.seven_day', 79],
    ]);
  });

  test('keeps a retained Claude observation while loading, but nothing while idle', () => {
    const loading = { ...claudeQuota(10, 10, 10, NOW + HOUR), status: 'loading' };
    expect(buildLedgerCredential('claude', loading, t).windows).toHaveLength(3);
    expect(buildLedgerCredential('claude', { status: 'idle' }, t).windows).toEqual([]);
    expect(buildLedgerCredential('claude', undefined, t).windows).toEqual([]);
  });

  test('reads Kimi counts and xAI weekly billing into the same shape', () => {
    const kimi = buildLedgerCredential(
      'kimi',
      {
        status: 'success',
        rows: [
          {
            id: 'weekly',
            labelKey: 'kimi_quota.weekly_limit',
            used: 25,
            limit: 100,
            resetAtMs: NOW + 5 * 24 * HOUR,
            periodHours: 168,
          },
        ],
      },
      t
    );
    expect(kimi.windows).toEqual([
      {
        id: 'weekly',
        label: 'kimi_quota.weekly_limit',
        remaining: 75,
        resetAtMs: NOW + 5 * 24 * HOUR,
        periodHours: 168,
        role: 'primary',
      },
    ]);

    const xai = buildLedgerCredential(
      'xai',
      {
        status: 'success',
        billing: { periodType: 'weekly', usagePercent: null, resetAtMs: NOW + HOUR },
      },
      t
    );
    expect(xai.windows).toEqual([
      {
        id: 'weekly',
        label: 'xai_quota.weekly_limit',
        remaining: null,
        resetAtMs: NOW + HOUR,
        periodHours: 168,
        role: 'primary',
      },
    ]);
  });

  test('flattens bucket groups and labels Antigravity plans', () => {
    const credential = buildLedgerCredential(
      'antigravity',
      {
        status: 'success',
        subscription: { plan: 'ultra', tierName: null, tierId: null },
        groups: [
          {
            id: 'g',
            label: 'Gemini Models',
            buckets: [
              {
                id: 'b',
                label: 'Weekly Limit',
                remainingFraction: 0.4,
                resetAtMs: NOW,
                periodHours: 168,
              },
            ],
          },
        ],
      },
      t
    );
    expect(credential.planLabel).toBe('antigravity_subscription.plan_ultra');
    expect(credential.windows[0]).toMatchObject({
      label: 'antigravity_quota.weekly_limit',
      remaining: 40,
      role: 'primary',
    });
  });
});

describe('buildProviderSummary', () => {
  const credentials: [string, LedgerCredential][] = [
    ['a', buildLedgerCredential('claude', claudeQuota(42, 0, 21, NOW + 39 * HOUR), t)],
    ['b', buildLedgerCredential('claude', claudeQuota(0, 0, 0, NOW + 98 * HOUR), t)],
    ['c', buildLedgerCredential('claude', claudeQuota(49, 1, 25, NOW + 25 * HOUR), t)],
    ['d', { windows: [], planLabel: null }],
  ];
  const inputs = credentials.map(([key, credential]) => ({ key, credential }));

  test('totals the primary window across credentials against full capacity', () => {
    const summary = buildProviderSummary('claude', inputs, NOW);
    expect(summary.credentialCount).toBe(4);
    expect(summary.primary).toMatchObject({
      id: 'seven-day-fable',
      label: 'claude_quota.seven_day_fable',
      total: 58 + 100 + 51,
      capacity: 400,
      nextResetMs: NOW + 25 * HOUR,
    });
    expect(summary.primary?.segments).toEqual([
      { key: 'a', remaining: 58 },
      { key: 'b', remaining: 100 },
      { key: 'c', remaining: 51 },
      { key: 'd', remaining: null },
    ]);
  });

  test('lists other long windows as secondary metrics, leaving session windows to rows', () => {
    const summary = buildProviderSummary('claude', inputs, NOW);
    expect(summary.secondary.map((metric) => [metric.id, metric.total])).toEqual([
      ['seven-day', 79 + 100 + 75],
    ]);
  });

  test('reports nothing to total until a credential has loaded', () => {
    const summary = buildProviderSummary(
      'codex',
      [{ key: 'x', credential: { windows: [], planLabel: null } }],
      NOW
    );
    expect(summary.primary).toBeNull();
    expect(summary.secondary).toEqual([]);
  });

  test('ignores resets that have already passed when picking the next one', () => {
    const stale = buildLedgerCredential('claude', claudeQuota(0, 0, 0, NOW - HOUR), t);
    const summary = buildProviderSummary('claude', [{ key: 's', credential: stale }], NOW);
    expect(summary.primary?.nextResetMs).toBeNull();
  });
});
