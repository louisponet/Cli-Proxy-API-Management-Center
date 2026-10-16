import type { QuotaProviderType } from './providers/types';

/** tab 顺序 = 旧页五分区的纵向顺序，'全部' tab 下卡片也按此分组排列。 */
export const QUOTA_TAB_ORDER: readonly QuotaProviderType[] = [
  'claude',
  'antigravity',
  'codex',
  'xai',
  'kimi',
  'devin',
  'meta',
  'plugin',
];

export type QuotaTabId = 'all' | QuotaProviderType;

/**
 * Providers whose tab only appears once a credential exists (or it is the
 * active tab), so the strip fits beside the view controls on common widths.
 */
export const QUOTA_ON_DEMAND_TABS: ReadonlySet<QuotaProviderType> = new Set([
  'devin',
  'meta',
  'plugin',
]);

/** 页级分页固定 20/页，同时把「刷新全部」的上游并发限制在 20。 */
export const QUOTA_PAGE_SIZE = 20;

/** 卡片排序：默认 = provider 分组序；soonest = 最快恢复优先。 */
export const QUOTA_SORT_MODES = ['default', 'soonest'] as const;

export type QuotaSortMode = (typeof QUOTA_SORT_MODES)[number];

/**
 * Page layouts. `ledger` = rows grouped by provider; `soonest` = the same rows,
 * ungrouped, ordered by recovery; `cards` = the full per-provider card grid.
 */
export const QUOTA_VIEW_MODES = ['ledger', 'soonest', 'cards'] as const;

export type QuotaViewMode = (typeof QUOTA_VIEW_MODES)[number];

export const sortModeForView = (view: QuotaViewMode): QuotaSortMode =>
  view === 'soonest' ? 'soonest' : 'default';

/** 与 useRevealGroup 的 GROUP_MAX_TOTAL 一致：卡片级联总预算 360ms。 */
export const CARD_ENTRANCE_BUDGET_MS = 360;
