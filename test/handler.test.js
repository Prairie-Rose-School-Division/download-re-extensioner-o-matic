import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { createDeterminingFilenameListener } from '../src/lib/handler.js';

const config = {
  managedRules: [],
  userRules: [{ domain: 'example.com', sourceExtension: 'text', targetExtension: 'csv', enabled: true }],
  allowUserRules: true,
};

const item = (overrides = {}) => ({
  url: 'https://ps.example.com/export',
  filename: 'student_export.text',
  ...overrides,
});

// Resolves once suggest has been called, then waits a tick to catch extra calls.
function run(listener, downloadItem) {
  return new Promise((resolve) => {
    const suggest = mock.fn(() => setTimeout(() => resolve({ suggest, returned }), 20));
    const returned = listener(downloadItem, suggest);
  });
}

describe('createDeterminingFilenameListener', () => {
  it('returns true and suggests the renamed file with uniquify', async () => {
    const { suggest, returned } = await run(createDeterminingFilenameListener(async () => config), item());
    assert.equal(returned, true);
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, [{ filename: 'student_export.csv', conflictAction: 'uniquify' }]);
  });

  it('suggests only the basename when filename includes a path', async () => {
    const { suggest } = await run(
      createDeterminingFilenameListener(async () => config),
      item({ filename: '/home/me/Downloads/v1.2/student_export.text' }),
    );
    assert.equal(suggest.mock.calls[0].arguments[0].filename, 'student_export.csv');
  });

  it('calls suggest() with no arguments when no rule matches', async () => {
    const { suggest } = await run(createDeterminingFilenameListener(async () => config), item({ url: 'https://other.org/x' }));
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, []);
  });

  it('calls suggest() with no arguments when loading rules rejects', async () => {
    const onError = mock.fn();
    const { suggest } = await run(
      createDeterminingFilenameListener(async () => { throw new Error('storage failed'); }, { onError }),
      item(),
    );
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, []);
    assert.equal(onError.mock.callCount(), 1);
  });

  it('calls suggest() with no arguments when loading rules throws synchronously', async () => {
    const { suggest } = await run(
      createDeterminingFilenameListener(() => { throw new Error('boom'); }),
      item(),
    );
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, []);
  });

  it('calls suggest() once on timeout, and ignores a late config', async () => {
    let resolveLate;
    const late = new Promise((r) => { resolveLate = r; });
    const listener = createDeterminingFilenameListener(() => late, { timeoutMs: 10 });
    const { suggest } = await run(listener, item());
    resolveLate(config);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, []);
  });

  it('calls suggest() once even if suggest itself throws', async () => {
    const onError = mock.fn();
    const listener = createDeterminingFilenameListener(async () => config, { onError });
    const suggest = mock.fn(() => { throw new Error('download gone'); });
    listener(item(), suggest);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(suggest.mock.callCount(), 1);
    assert.equal(onError.mock.callCount(), 1);
  });

  it('handles a malformed download item without hanging', async () => {
    const { suggest } = await run(createDeterminingFilenameListener(async () => config), undefined);
    assert.equal(suggest.mock.callCount(), 1);
    assert.deepEqual(suggest.mock.calls[0].arguments, []);
  });
});
