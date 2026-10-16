import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const tabsStyles = readFileSync(
  'src/features/authFiles/components/ProviderTabs.module.scss',
  'utf8'
);
const quotaStyles = readFileSync('src/features/quota/QuotaPage.module.scss', 'utf8');

describe('provider filter overflow', () => {
  test('constrains the strip and preserves native horizontal scrolling', () => {
    expect(tabsStyles).toMatch(/\.tabs\s*\{[^}]*min-width: 0;/);
    expect(tabsStyles).toMatch(/\.tabs\s*\{[^}]*max-width: 100%;/);
    expect(tabsStyles).toMatch(/\.tabs\s*\{[^}]*overflow-x: auto;/);
    expect(tabsStyles).toMatch(/\.tab\s*\{[^}]*flex-shrink: 0;/);
  });

  test('hides the scrollbar while using a cancellable local wheel listener', () => {
    expect(tabsStyles).toContain('scrollbar-width: none;');
    expect(tabsStyles).toMatch(/&::-webkit-scrollbar\s*\{[^}]*display: none/);
    const source = readFileSync('src/features/authFiles/components/ProviderTabs.tsx', 'utf8');
    expect(source).toContain("strip.addEventListener('wheel', onWheel, { passive: false })");
    expect(source).toContain("strip.removeEventListener('wheel', onWheel)");
  });

  test('lets the strip shrink to scroll while the view controls keep their width', () => {
    // The strip hugs its tabs (its underline ends at the last one) and only
    // shrinks into horizontal scrolling when the controls need the room.
    expect(quotaStyles).toMatch(/> :first-child\s*\{\s*flex: 0 1 auto;\s*min-width: 0;/);
    expect(quotaStyles).toMatch(/\.controls\s*\{[^}]*flex: 0 0 auto;[^}]*margin-left: auto;/);
    expect(quotaStyles).toMatch(/\.sort\s*\{\s*flex: 0 0 auto;/);
  });
});
