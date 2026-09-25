// Builds the onDeterminingFilename listener. Kept free of chrome.* calls so the
// "suggest() is called exactly once" guarantee can be unit tested in Node.

import { computeRename, basename } from './rules.js';

export const DEFAULT_TIMEOUT_MS = 3000;

/**
 * @param {() => Promise<object>} loadConfig resolves to
 *   { managedRules, userRules, allowUserRules }
 * @param {{ timeoutMs?: number, onError?: (err: unknown) => void }} [options]
 * @returns {(item: object, suggest: Function) => true}
 */
export function createDeterminingFilenameListener(loadConfig, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const onError = options.onError ?? (() => {});

  return function onDeterminingFilename(item, suggest) {
    let settled = false;
    let timer;

    const finish = (suggestion) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (suggestion) suggest(suggestion);
        else suggest();
      } catch (err) {
        onError(err);
      }
    };

    timer = setTimeout(() => {
      onError(new Error(`Rules did not load within ${timeoutMs} ms; download left unchanged.`));
      finish();
    }, timeoutMs);

    Promise.resolve()
      .then(() => loadConfig())
      .then((config) => {
        const result = computeRename(
          { ...item, filename: basename(item && item.filename) },
          config,
        );
        finish(result ? { filename: result.filename, conflictAction: 'uniquify' } : undefined);
      })
      .catch((err) => {
        onError(err);
        finish();
      });

    // Keep suggest() valid after this listener returns.
    return true;
  };
}
