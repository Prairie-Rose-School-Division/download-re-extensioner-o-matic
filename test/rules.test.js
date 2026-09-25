import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeExtension,
  isValidExtension,
  normalizeDomain,
  isValidHostname,
  normalizeRule,
  validateRule,
  hostFromUrl,
  candidateHosts,
  domainMatches,
  splitFilename,
  replaceExtension,
  findMatchingRule,
  computeRename,
  basename,
} from '../src/lib/rules.js';

const rule = (overrides = {}) => ({
  domain: 'example.com',
  sourceExtension: 'text',
  targetExtension: 'csv',
  enabled: true,
  ...overrides,
});

const download = (overrides = {}) => ({
  url: 'https://example.com/export',
  filename: 'student_export.text',
  ...overrides,
});

describe('normalizeExtension', () => {
  it('strips leading dots and lowercases', () => {
    assert.equal(normalizeExtension('.TEXT'), 'text');
    assert.equal(normalizeExtension('csv'), 'csv');
    assert.equal(normalizeExtension('  ..Csv '), 'csv');
  });

  it('returns empty string for non-strings', () => {
    assert.equal(normalizeExtension(undefined), '');
    assert.equal(normalizeExtension(42), '');
  });
});

describe('isValidExtension', () => {
  it('accepts letters, numbers, hyphens and underscores', () => {
    for (const ext of ['csv', 'mp4', 'tar-gz', 'my_ext', '7z']) {
      assert.ok(isValidExtension(ext), ext);
    }
  });

  it('rejects empty, dotted, spaced and symbol extensions', () => {
    for (const ext of ['', 'tar.gz', 'c sv', 'csv!', 'c/v', 'x'.repeat(33)]) {
      assert.ok(!isValidExtension(ext), ext);
    }
  });
});

describe('normalizeDomain', () => {
  it('lowercases a bare domain', () => {
    assert.equal(normalizeDomain('Example.COM'), 'example.com');
  });

  it('reduces a pasted full URL to its hostname', () => {
    assert.equal(normalizeDomain('https://Sub.Example.com/path/to?q=1#frag'), 'sub.example.com');
    assert.equal(normalizeDomain('http://example.com:8080/'), 'example.com');
  });

  it('handles host with path or port but no scheme', () => {
    assert.equal(normalizeDomain('example.com/admin/export'), 'example.com');
    assert.equal(normalizeDomain('example.com:443'), 'example.com');
  });

  it('strips wildcard prefix, leading and trailing dots, whitespace', () => {
    assert.equal(normalizeDomain('  *.example.com  '), 'example.com');
    assert.equal(normalizeDomain('.example.com.'), 'example.com');
  });

  it('returns empty string for empty input', () => {
    assert.equal(normalizeDomain('   '), '');
    assert.equal(normalizeDomain(null), '');
  });
});

describe('isValidHostname', () => {
  it('accepts normal hostnames', () => {
    for (const host of ['example.com', 'a.b.example.co.uk', 'localhost', 'xn--bcher-kva.example', '10.0.0.1']) {
      assert.ok(isValidHostname(host), host);
    }
  });

  it('rejects malformed hostnames', () => {
    for (const host of ['', 'exa mple.com', '-example.com', 'example-.com', 'example..com', 'exa_mple.com']) {
      assert.ok(!isValidHostname(host), host);
    }
  });
});

describe('normalizeRule', () => {
  it('normalizes every field and defaults enabled to true', () => {
    assert.deepEqual(
      normalizeRule({ domain: 'HTTPS://Example.com/x', sourceExtension: '.TEXT', targetExtension: '.CSV', label: '  PowerSchool  ', id: 'abc' }),
      { domain: 'example.com', sourceExtension: 'text', targetExtension: 'csv', enabled: true, label: 'PowerSchool', id: 'abc' },
    );
  });

  it('keeps enabled false', () => {
    assert.equal(normalizeRule(rule({ enabled: false })).enabled, false);
  });
});

describe('validateRule', () => {
  it('accepts a valid rule', () => {
    const result = validateRule(rule({ sourceExtension: '.text', targetExtension: 'CSV' }));
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
    assert.equal(result.rule.targetExtension, 'csv');
  });

  it('requires a domain', () => {
    const { valid, errors } = validateRule(rule({ domain: '' }));
    assert.equal(valid, false);
    assert.match(errors.domain, /Enter a domain/);
  });

  it('rejects an invalid hostname', () => {
    assert.ok(validateRule(rule({ domain: 'not a domain' })).errors.domain);
  });

  it('requires valid, non-empty extensions', () => {
    const { errors } = validateRule(rule({ sourceExtension: '', targetExtension: 'c$v' }));
    assert.ok(errors.sourceExtension);
    assert.ok(errors.targetExtension);
  });

  it('rejects identical source and target (case- and dot-insensitive)', () => {
    const { errors } = validateRule(rule({ sourceExtension: '.CSV', targetExtension: 'csv' }));
    assert.match(errors.targetExtension, /different/);
  });

  it('rejects a duplicate domain + source extension', () => {
    const existing = [rule({ id: '1' })];
    assert.ok(validateRule(rule({ domain: 'EXAMPLE.com', sourceExtension: '.TEXT' }), existing).errors.domain);
  });

  it('does not treat the rule being edited as a duplicate', () => {
    const existing = [rule({ id: '1' })];
    assert.equal(validateRule(rule({ id: '1', targetExtension: 'tsv' }), existing).valid, true);
  });
});

describe('hostFromUrl', () => {
  it('returns the lowercase hostname for http(s) URLs', () => {
    assert.equal(hostFromUrl('https://Sub.Example.COM/a/b.text'), 'sub.example.com');
  });

  it('uses the embedded origin for blob: URLs', () => {
    assert.equal(hostFromUrl('blob:https://ps.example.com/1b0e8f5c-3d2a-4c8e-9f1e-000000000000'), 'ps.example.com');
  });

  it('uses the embedded origin for filesystem: URLs', () => {
    assert.equal(hostFromUrl('filesystem:https://example.com/temporary/file.text'), 'example.com');
  });

  it('returns null for blob: URLs with an opaque origin', () => {
    assert.equal(hostFromUrl('blob:null/1b0e8f5c'), null);
  });

  it('returns null for data: URLs', () => {
    assert.equal(hostFromUrl('data:text/plain;base64,aGVsbG8='), null);
  });

  it('returns null for empty, invalid and host-less URLs', () => {
    assert.equal(hostFromUrl(''), null);
    assert.equal(hostFromUrl(undefined), null);
    assert.equal(hostFromUrl('not a url'), null);
    assert.equal(hostFromUrl('file:///Users/me/file.text'), null);
  });
});

describe('candidateHosts', () => {
  it('checks finalUrl, url and referrer in order, without duplicates', () => {
    assert.deepEqual(
      candidateHosts({
        finalUrl: 'https://cdn.example.net/x',
        url: 'https://example.com/x',
        referrer: 'https://example.com/page',
      }),
      ['cdn.example.net', 'example.com'],
    );
  });

  it('falls back to the referrer for data: URLs', () => {
    assert.deepEqual(
      candidateHosts({ url: 'data:text/plain,hi', finalUrl: 'data:text/plain,hi', referrer: 'https://example.com/' }),
      ['example.com'],
    );
  });
});

describe('domainMatches', () => {
  it('matches the exact domain and any subdomain', () => {
    assert.ok(domainMatches('example.com', 'example.com'));
    assert.ok(domainMatches('ps.example.com', 'example.com'));
    assert.ok(domainMatches('a.b.example.com', 'example.com'));
  });

  it('does not match lookalike or parent domains', () => {
    assert.ok(!domainMatches('badexample.com', 'example.com'));
    assert.ok(!domainMatches('example.com.evil.net', 'example.com'));
    assert.ok(!domainMatches('example.com', 'ps.example.com'));
  });
});

describe('splitFilename / replaceExtension', () => {
  it('replaces only the final extension', () => {
    assert.equal(replaceExtension('student_export.text', 'csv'), 'student_export.csv');
  });

  it('keeps earlier dots in filenames with multiple dots', () => {
    assert.equal(replaceExtension('report.2026.09.25.text', 'csv'), 'report.2026.09.25.csv');
    assert.deepEqual(splitFilename('a.b.c'), { dir: '', stem: 'a.b', ext: 'c' });
  });

  it('leaves files with no extension unchanged', () => {
    assert.equal(replaceExtension('README', 'csv'), 'README');
    assert.equal(replaceExtension('trailingdot.', 'csv'), 'trailingdot.');
    assert.equal(replaceExtension('.bashrc', 'csv'), '.bashrc');
  });

  it('preserves the directory portion and ignores dots in directories', () => {
    assert.equal(replaceExtension('exports/v1.2/students.text', 'csv'), 'exports/v1.2/students.csv');
    assert.equal(replaceExtension('C:\\Users\\me\\Downloads\\x.text', 'csv'), 'C:\\Users\\me\\Downloads\\x.csv');
    assert.equal(replaceExtension('v1.2/README', 'csv'), 'v1.2/README');
  });

  it('basename returns the last path component', () => {
    assert.equal(basename('/home/me/Downloads/x.text'), 'x.text');
    assert.equal(basename('C:\\x\\y.text'), 'y.text');
    assert.equal(basename('plain.text'), 'plain.text');
  });
});

describe('findMatchingRule / computeRename', () => {
  it('renames a matching download', () => {
    const result = computeRename(download(), { userRules: [rule()] });
    assert.equal(result.filename, 'student_export.csv');
    assert.equal(result.match.source, 'user');
    assert.equal(result.match.host, 'example.com');
  });

  it('matches subdomains of the rule domain', () => {
    const result = computeRename(download({ url: 'https://ps.district.example.com/admin/export' }), { userRules: [rule()] });
    assert.equal(result.filename, 'student_export.csv');
  });

  it('is case-insensitive for domain and extension', () => {
    const result = computeRename(
      download({ url: 'HTTPS://PS.EXAMPLE.COM/x', filename: 'Student_Export.TEXT' }),
      { userRules: [rule({ domain: 'Example.Com', sourceExtension: '.Text', targetExtension: '.CSV' })] },
    );
    assert.equal(result.filename, 'Student_Export.csv');
  });

  it('works with a rule whose domain was pasted as a full URL', () => {
    const result = computeRename(download(), { userRules: [rule({ domain: 'https://example.com/admin/home.html' })] });
    assert.equal(result.filename, 'student_export.csv');
  });

  it('matches blob: downloads by their embedded origin', () => {
    const result = computeRename(
      download({ url: 'blob:https://ps.example.com/0000-1111', finalUrl: 'blob:https://ps.example.com/0000-1111' }),
      { userRules: [rule()] },
    );
    assert.equal(result.filename, 'student_export.csv');
  });

  it('matches data: downloads using the referrer', () => {
    const result = computeRename(
      download({ url: 'data:text/plain;base64,aGk=', finalUrl: 'data:text/plain;base64,aGk=', referrer: 'https://ps.example.com/page' }),
      { userRules: [rule()] },
    );
    assert.equal(result.filename, 'student_export.csv');
  });

  it('does not match data: downloads with no referrer', () => {
    assert.equal(computeRename(download({ url: 'data:text/plain,hi', referrer: '' }), { userRules: [rule()] }), null);
  });

  it('matches when only the finalUrl (after redirect) is on the rule domain', () => {
    const result = computeRename(
      download({ url: 'https://short.link/abc', finalUrl: 'https://files.example.com/x' }),
      { userRules: [rule()] },
    );
    assert.equal(result.filename, 'student_export.csv');
  });

  it('keeps earlier dots when renaming', () => {
    const result = computeRename(download({ filename: 'grades.2026-09.v2.text' }), { userRules: [rule()] });
    assert.equal(result.filename, 'grades.2026-09.v2.csv');
  });

  it('does not match files with no extension', () => {
    assert.equal(computeRename(download({ filename: 'student_export' }), { userRules: [rule()] }), null);
  });

  it('does not match a different extension', () => {
    assert.equal(computeRename(download({ filename: 'student_export.txt' }), { userRules: [rule()] }), null);
  });

  it('does not match a different domain', () => {
    assert.equal(computeRename(download({ url: 'https://other.org/x' }), { userRules: [rule()] }), null);
  });

  it('skips disabled rules', () => {
    assert.equal(computeRename(download(), { userRules: [rule({ enabled: false })] }), null);
  });

  it('falls through a disabled rule to the next matching rule', () => {
    const result = computeRename(download(), {
      userRules: [rule({ enabled: false, targetExtension: 'tsv' }), rule({ targetExtension: 'csv' })],
    });
    assert.equal(result.filename, 'student_export.csv');
  });

  it('first matching enabled rule wins', () => {
    const result = computeRename(download({ url: 'https://ps.example.com/' }), {
      userRules: [rule({ domain: 'ps.example.com', targetExtension: 'tsv' }), rule({ targetExtension: 'csv' })],
    });
    assert.equal(result.filename, 'student_export.tsv');
  });

  it('checks managed rules before user rules', () => {
    const result = computeRename(download(), {
      managedRules: [rule({ targetExtension: 'tsv' })],
      userRules: [rule({ targetExtension: 'csv' })],
    });
    assert.equal(result.filename, 'student_export.tsv');
    assert.equal(result.match.source, 'managed');
  });

  it('uses a user rule when no managed rule matches', () => {
    const result = computeRename(download(), {
      managedRules: [rule({ domain: 'other.org', targetExtension: 'tsv' })],
      userRules: [rule()],
    });
    assert.equal(result.match.source, 'user');
    assert.equal(result.filename, 'student_export.csv');
  });

  it('a disabled managed rule does not block a user rule', () => {
    const result = computeRename(download(), {
      managedRules: [rule({ enabled: false, targetExtension: 'tsv' })],
      userRules: [rule()],
    });
    assert.equal(result.match.source, 'user');
  });

  it('ignores user rules when allowUserRules is false', () => {
    assert.equal(computeRename(download(), { userRules: [rule()], allowUserRules: false }), null);
    const result = computeRename(download(), {
      managedRules: [rule({ targetExtension: 'tsv' })],
      userRules: [rule()],
      allowUserRules: false,
    });
    assert.equal(result.filename, 'student_export.tsv');
  });

  it('ignores invalid or malformed rules instead of throwing', () => {
    const config = {
      managedRules: [null, 'junk', { domain: 'example.com' }, rule({ targetExtension: 'text' })],
      userRules: 'not an array',
    };
    assert.equal(computeRename(download(), config), null);
  });

  it('returns null with no rules or no config', () => {
    assert.equal(computeRename(download(), {}), null);
    assert.equal(computeRename(download()), null);
  });
});
