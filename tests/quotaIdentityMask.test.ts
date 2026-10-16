import { describe, expect, test } from 'bun:test';
import { maskEmailsInText } from '@/utils/quota/identity';

describe('maskEmailsInText', () => {
  test('masks the email inside a credential filename, keeping prefix, tld and extension', () => {
    expect(maskEmailsInText('claude-tom@lumen.dev.json')).toBe('claude-t•••@l•••.dev.json');
    expect(maskEmailsInText('codex-june@quill.io.json')).toBe('codex-j•••@q•••.io.json');
  });

  test('keeps only the provider prefix when the local part carries an id', () => {
    expect(maskEmailsInText('claude-1f2e3d4c-ada@example.com.json')).toBe(
      'claude-1•••@e•••.com.json'
    );
  });

  test('masks bare addresses and every address in a combined label', () => {
    expect(maskEmailsInText('tom@lumen.dev')).toBe('t•••@l•••.dev');
    expect(maskEmailsInText('devin.json · ada@example.co')).toBe('devin.json · a•••@e•••.co');
  });

  test('masks an address flattened into the filename when the credential email is known', () => {
    expect(
      maskEmailsInText('meta-ada_example.com-0123456789abcdef.json', ['ada@example.com'])
    ).toBe('meta-a•••_e•••.com-0123456789abcdef.json');
  });

  test('leaves text without an address untouched', () => {
    expect(maskEmailsInText('vertex-service-account.json')).toBe('vertex-service-account.json');
    expect(maskEmailsInText('plain.json', [undefined, '', 'not-an-email'])).toBe('plain.json');
  });
});
