// Pure matching and renaming logic. No chrome.* calls, so this module can be
// unit tested in Node and shared by the service worker and the options page.

const EXTENSION_PATTERN = /^[a-z0-9_-]+$/;
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_EXTENSION_LENGTH = 32;
const MAX_LABEL_LENGTH = 100;

/**
 * Normalize an extension: trim, strip leading dots, lowercase.
 * ".TEXT" -> "text", "csv" -> "csv".
 */
export function normalizeExtension(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/^\.+/, '').toLowerCase();
}

export function isValidExtension(ext) {
  return (
    typeof ext === 'string' &&
    ext.length > 0 &&
    ext.length <= MAX_EXTENSION_LENGTH &&
    EXTENSION_PATTERN.test(ext)
  );
}

/**
 * Normalize user input for a domain to a bare lowercase hostname.
 * Accepts "Example.com", "https://www.example.com/path?q=1", "example.com:8080",
 * "*.example.com" and ".example.com". Returns '' if nothing usable remains.
 */
export function normalizeDomain(input) {
  if (typeof input !== 'string') return '';
  let value = input.trim().toLowerCase();
  if (!value) return '';

  value = value.replace(/^\*\./, '').replace(/^\.+/, '');

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(value);
  if (hasScheme || /[/:?#@]/.test(value)) {
    try {
      const url = new URL(hasScheme ? value : `http://${value}`);
      value = url.hostname;
    } catch {
      return value.replace(/\.+$/, '');
    }
  }

  return value.replace(/\.+$/, '');
}

export function isValidHostname(host) {
  if (typeof host !== 'string' || host.length === 0 || host.length > 253) return false;
  return host.split('.').every((label) => HOSTNAME_LABEL_PATTERN.test(label));
}

/**
 * Return a rule with every field normalized. Unknown fields are dropped.
 */
export function normalizeRule(raw) {
  const rule = raw && typeof raw === 'object' ? raw : {};
  const normalized = {
    domain: normalizeDomain(rule.domain),
    sourceExtension: normalizeExtension(rule.sourceExtension),
    targetExtension: normalizeExtension(rule.targetExtension),
    enabled: rule.enabled !== false,
    label: typeof rule.label === 'string' ? rule.label.trim().slice(0, MAX_LABEL_LENGTH) : '',
  };
  if (typeof rule.id === 'string' && rule.id) normalized.id = rule.id;
  return normalized;
}

/**
 * Validate a rule. Returns { valid, errors, rule } where rule is normalized and
 * errors maps field names to human-readable messages.
 *
 * Pass existingRules to reject a duplicate domain + source extension pair
 * (a rule with the same id is treated as the one being edited).
 */
export function validateRule(raw, existingRules = []) {
  const rule = normalizeRule(raw);
  const errors = {};

  if (!rule.domain) {
    errors.domain = 'Enter a domain, such as example.com.';
  } else if (!isValidHostname(rule.domain)) {
    errors.domain = 'Enter a valid domain, such as example.com.';
  }

  if (!rule.sourceExtension) {
    errors.sourceExtension = 'Enter the extension to replace.';
  } else if (!isValidExtension(rule.sourceExtension)) {
    errors.sourceExtension = 'Use only letters, numbers, hyphens, or underscores.';
  }

  if (!rule.targetExtension) {
    errors.targetExtension = 'Enter the new extension.';
  } else if (!isValidExtension(rule.targetExtension)) {
    errors.targetExtension = 'Use only letters, numbers, hyphens, or underscores.';
  } else if (rule.targetExtension === rule.sourceExtension) {
    errors.targetExtension = 'The new extension must be different from the one it replaces.';
  }

  if (!errors.domain && !errors.sourceExtension) {
    const duplicate = existingRules.some((other) => {
      if (!other || (rule.id && other.id === rule.id)) return false;
      const o = normalizeRule(other);
      return o.domain === rule.domain && o.sourceExtension === rule.sourceExtension;
    });
    if (duplicate) {
      errors.domain = `A rule for ${rule.domain} and .${rule.sourceExtension} already exists.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, rule };
}

/**
 * Extract a lowercase hostname from a URL, or null if it has none.
 * blob: and filesystem: URLs use the embedded origin; data: URLs have no host.
 */
export function hostFromUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === 'blob:' || parsed.protocol === 'filesystem:') {
    return hostFromUrl(url.slice(parsed.protocol.length));
  }
  if (parsed.protocol === 'data:') return null;

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  return host || null;
}

/**
 * Hosts to check for a download, in priority order, without duplicates.
 */
export function candidateHosts(download) {
  const item = download || {};
  const hosts = [];
  for (const url of [item.finalUrl, item.url, item.referrer]) {
    const host = hostFromUrl(url);
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/** True if host equals domain or is a subdomain of it. */
export function domainMatches(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Split a filename (optionally with a directory) into { dir, stem, ext }.
 * Only the final extension counts. Dotfiles (".bashrc") and names ending in a
 * dot have no extension.
 */
export function splitFilename(filename) {
  const name = typeof filename === 'string' ? filename : '';
  const sep = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const dir = name.slice(0, sep + 1);
  const base = name.slice(sep + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return { dir, stem: base, ext: '' };
  }
  return { dir, stem: base.slice(0, dot), ext: base.slice(dot + 1) };
}

/** Replace only the final extension; the rest of the filename is untouched. */
export function replaceExtension(filename, newExtension) {
  const { dir, stem, ext } = splitFilename(filename);
  if (!ext) return filename;
  return `${dir}${stem}.${newExtension}`;
}

/**
 * Find the first enabled rule that matches the download.
 * Managed rules are checked before user rules; user rules are skipped when
 * allowUserRules is false. Invalid rules are ignored.
 *
 * Returns { rule, source: 'managed' | 'user', host } or null.
 */
export function findMatchingRule(download, config = {}) {
  const { ext } = splitFilename(download && download.filename);
  if (!ext) return null;
  const extension = ext.toLowerCase();

  const hosts = candidateHosts(download);
  if (hosts.length === 0) return null;

  const groups = [['managed', config.managedRules]];
  if (config.allowUserRules !== false) groups.push(['user', config.userRules]);

  for (const [source, rules] of groups) {
    if (!Array.isArray(rules)) continue;
    for (const raw of rules) {
      const { valid, rule } = validateRule(raw);
      if (!valid || !rule.enabled || rule.sourceExtension !== extension) continue;
      const host = hosts.find((h) => domainMatches(h, rule.domain));
      if (host) return { rule, source, host };
    }
  }
  return null;
}

/**
 * Work out the new filename for a download.
 * Returns { filename, match } when a rule applies, otherwise null.
 */
export function computeRename(download, config) {
  const match = findMatchingRule(download, config);
  if (!match) return null;
  return {
    filename: replaceExtension(download.filename, match.rule.targetExtension),
    match,
  };
}

/** Last path component of a filename, handling both separator styles. */
export function basename(filename) {
  const name = typeof filename === 'string' ? filename : '';
  return name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
}
