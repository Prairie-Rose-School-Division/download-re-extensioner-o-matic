// Stand-in for chrome.storage so the real options page can be rendered with
// demo data for store screenshots. Used only by tools/render-assets.js.
(() => {
  const params = new URLSearchParams(location.search);
  const listeners = [];
  let sync = {
    rules: [
      { id: 'a', domain: 'grades.example.com', sourceExtension: 'dat', targetExtension: 'tsv', enabled: true, label: 'Gradebook export' },
      { id: 'b', domain: 'reports.example.net', sourceExtension: 'bin', targetExtension: 'pdf', enabled: false, label: 'Report server' },
    ],
  };
  const managed = {
    managedRules: [
      { domain: 'ps.example.org', sourceExtension: 'text', targetExtension: 'csv', label: 'PowerSchool Quick Export' },
    ],
    allowUserRules: true,
  };
  const pick = (obj, keys) =>
    Object.fromEntries([].concat(keys).filter((k) => k in obj).map((k) => [k, structuredClone(obj[k])]));

  window.chrome = {
    storage: {
      sync: {
        get: async (keys) => pick(sync, keys),
        set: async (items) => {
          sync = { ...sync, ...structuredClone(items) };
          setTimeout(() => listeners.forEach((l) => l({}, 'sync')), 0);
        },
      },
      managed: { get: async (keys) => pick(managed, keys) },
      onChanged: { addListener: (l) => listeners.push(l) },
    },
  };

  if (params.get('demo') === 'test') {
    window.addEventListener('load', () => setTimeout(() => {
      document.getElementById('test-url').value = 'https://ps.example.org/admin/quickexport';
      document.getElementById('test-filename').value = 'student_export.text';
      document.getElementById('test-form').requestSubmit();
      // Scroll only this frame; scrollIntoView would also scroll the parent page.
      document.scrollingElement.scrollTop = document.getElementById('test-section').offsetTop - 16;
      document.activeElement.blur();
    }, 100));
  }
})();
