import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/features/quota/QuotaPage.tsx', 'utf8');
const styles = readFileSync('src/features/quota/QuotaPage.module.scss', 'utf8');

describe('quota toolbar presentation contracts', () => {
  test('uses a named, explicit clear action and restores input focus', () => {
    expect(source).toContain('type="search"');
    expect(source).toContain('ref={searchInputRef}');
    expect(source).toContain('{search && (');
    expect(source).toContain("aria-label={t('quota_management.search_clear')}");
    expect(source).toMatch(/handleSearchChange\(''\);\s*searchInputRef\.current\?\.focus\(\);/);
    expect(source).toContain('<IconX size={14} aria-hidden="true" />');
    expect(styles).toMatch(/&::-webkit-search-cancel-button,[\s\S]*?appearance: none;/);
  });

  test('collapses search behind a named toggle that Escape closes again', () => {
    expect(source).toContain('className={styles.searchToggle}');
    expect(source).toContain("aria-label={t('quota_management.search_label')}");
    expect(source).toMatch(/event\.key === 'Escape'[\s\S]*?setSearchOpen\(false\)/);
  });

  test('places search and the view picker after provider navigation, in that order', () => {
    const tabsStart = source.indexOf('<ProviderTabs');
    const controlsStart = source.indexOf('<div className={styles.controls}>');
    const searchStart = source.indexOf('<div className={styles.search}>');
    const sortStart = source.indexOf('<div className={styles.sort}>');
    expect(controlsStart).toBeGreaterThan(tabsStart);
    expect(searchStart).toBeGreaterThan(controlsStart);
    expect(sortStart).toBeGreaterThan(searchStart);
    expect(source).toContain("ariaLabel={t('quota_management.view_label')}");
    expect(styles).toContain('&:focus-within');
    expect(styles).toContain('&:focus-visible');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
