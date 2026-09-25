// Service worker. Listeners are registered synchronously at the top level so
// Chrome can wake the worker for downloads.
//
// Privacy: only the download's URL, referrer, and suggested filename are
// inspected, in memory. File contents are never read, and nothing is logged,
// stored, or transmitted.

import { createDeterminingFilenameListener } from './lib/handler.js';
import { loadConfig } from './settings.js';

chrome.downloads.onDeterminingFilename.addListener(
  createDeterminingFilenameListener(loadConfig, {
    // Log the error type only; messages never include URLs or filenames.
    onError: (err) => console.warn('Download Re-Extensioner-o-Matic:', err && err.message),
  }),
);

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
