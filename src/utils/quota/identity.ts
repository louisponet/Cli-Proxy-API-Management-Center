import type { AuthFileItem } from '@/types';
import { normalizeRecentRequestAuthIndex } from '@/utils/recentRequests';
import { isDevinFile, isPluginQuotaFile } from './validators';

const QUOTA_IDENTITY_SEPARATOR = '\0';

/**
 * Devin and backend quota providers can expose multiple credential identities
 * from one physical file, distinguished by auth_index.
 */
export function getQuotaCacheKey(file: AuthFileItem): string {
  if (!isDevinFile(file) && !isPluginQuotaFile(file)) return file.name;
  const authIndex = normalizeRecentRequestAuthIndex(file.authIndex);
  return `${file.name}${QUOTA_IDENTITY_SEPARATOR}${authIndex ?? ''}`;
}

/** Disambiguate same-name cards without ever falling back to account (a secret). */
export function getQuotaDisplayName(file: AuthFileItem): string {
  if (!isDevinFile(file) && !isPluginQuotaFile(file)) return file.name;
  const identity = file.email?.trim() || normalizeRecentRequestAuthIndex(file.authIndex);
  return identity ? `${file.name} · ${identity}` : file.name;
}

/** Resolve a cache identity back to the physical filename used by file mutations. */
export function getQuotaCacheFileName(key: string): string {
  const separatorIndex = key.indexOf(QUOTA_IDENTITY_SEPARATOR);
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex);
}

const MASK = '•••';
const EMAIL_PATTERN = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)/g;
const FILE_EXTENSIONS = new Set(['json', 'yaml', 'yml', 'toml', 'txt']);

const maskEmailMatch = (local: string, domain: string, keepLocalPrefix: boolean): string => {
  // `claude-tom@…` keeps its `claude-` provider prefix so rows stay scannable.
  const prefixEnd = keepLocalPrefix ? local.indexOf('-') + 1 : 0;
  const prefix = local.slice(0, prefixEnd);
  const user = local.slice(prefixEnd);
  const labels = domain.split('.');
  // A credential filename runs straight on from the domain: `@lumen.dev.json`.
  const extension =
    labels.length > 2 && FILE_EXTENSIONS.has(labels[labels.length - 1].toLowerCase())
      ? `.${labels.pop()}`
      : '';
  const tld = labels.length > 1 ? `.${labels[labels.length - 1]}` : '';
  return `${prefix}${user.slice(0, 1)}${MASK}@${domain.slice(0, 1)}${MASK}${tld}${extension}`;
};

/**
 * Mask every email inside a display string, e.g. a credential filename:
 * `claude-tom@lumen.dev.json` → `claude-t•••@l•••.dev.json`.
 *
 * Purely cosmetic (screen sharing, screenshots) — the real identity is still in
 * the DOM's data and every API call.
 */
export function maskEmailsInText(text: string, knownEmails: readonly unknown[] = []): string {
  let masked = text.replace(
    EMAIL_PATTERN,
    (_match, local: string, domain: string, offset: number) =>
      maskEmailMatch(local, domain, offset === 0)
  );
  // Some providers flatten the address into the filename (`ada_example.com`),
  // which no pattern can recognise; the credential's own email can.
  for (const email of knownEmails) {
    if (typeof email !== 'string') continue;
    const [local, domain] = email.trim().split('@');
    if (!local || !domain) continue;
    const replacement = maskEmailMatch(local, domain, false);
    for (const variant of [`${local}_${domain}`, `${local}-${domain}`]) {
      masked = masked.split(variant).join(replacement.replace('@', variant.charAt(local.length)));
    }
  }
  return masked;
}
