import {
  validateRule,
  normalizeRule,
  computeRename,
  candidateHosts,
  splitFilename,
  basename,
} from '../lib/rules.js';
import { loadConfig, saveUserRules } from '../settings.js';

const state = {
  managedRules: [],
  userRules: [],
  allowUserRules: true,
  editingId: null,
  returnFocus: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  orgSection: $('org-section'),
  orgRules: $('org-rules'),
  addRule: $('add-rule'),
  userNotice: $('user-disabled-notice'),
  userRules: $('user-rules'),
  userEmpty: $('user-empty'),
  form: $('rule-form'),
  formHeading: $('rule-form-heading'),
  domain: $('rule-domain'),
  source: $('rule-source'),
  target: $('rule-target'),
  label: $('rule-label'),
  enabled: $('rule-enabled'),
  cancel: $('rule-cancel'),
  testForm: $('test-form'),
  testUrl: $('test-url'),
  testFilename: $('test-filename'),
  testReferrer: $('test-referrer'),
  testResult: $('test-result'),
  toast: $('toast'),
};

const formFields = {
  domain: els.domain,
  sourceExtension: els.source,
  targetExtension: els.target,
};

// ---------- helpers ----------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

function newId() {
  return crypto.randomUUID();
}

let toastTimer;
function toast(message, { error = false } = {}) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.toggle('error', error);
  toastTimer = setTimeout(() => { els.toast.textContent = ''; }, error ? 8000 : 3000);
}

function ruleTitle(rule) {
  return rule.label || rule.domain || '(no domain)';
}

function ruleDescription(rule) {
  return el('div', { className: 'rule-desc' }, [
    el('code', { text: `.${rule.sourceExtension || '?'}` }),
    ' → ',
    el('code', { text: `.${rule.targetExtension || '?'}` }),
    ' on ',
    el('strong', { text: rule.domain || '(no domain)' }),
    ' and its subdomains',
  ]);
}

// ---------- rendering ----------

function renderOrgRules() {
  const rules = state.managedRules;
  els.orgSection.hidden = rules.length === 0;
  els.orgRules.replaceChildren(
    ...rules.map((raw) => {
      const { valid, rule } = validateRule(raw);
      const status = !valid
        ? el('span', { className: 'badge off', text: 'Invalid, ignored' })
        : el('span', { className: rule.enabled ? 'badge' : 'badge off', text: rule.enabled ? 'On' : 'Off' });
      return el('li', { className: `rule${valid && rule.enabled ? '' : ' is-disabled'}` }, [
        el('div', { className: 'rule-main' }, [
          el('div', { className: 'rule-title', text: ruleTitle(rule) }),
          ruleDescription(rule),
        ]),
        el('div', { className: 'rule-actions' }, [
          el('span', { className: 'badge', text: 'Set by your organization' }),
          status,
        ]),
      ]);
    }),
  );
}

// Re-rendering replaces the list's nodes, so remember which control in which
// row had focus and put focus back on its replacement.
function captureFocus(list) {
  const active = document.activeElement;
  const row = active && list.contains(active) ? active.closest('[data-id]') : null;
  if (!row) return null;
  const controls = [...row.querySelectorAll('input, button')];
  return { id: row.dataset.id, index: controls.indexOf(active) };
}

function restoreFocus(list, saved) {
  if (!saved) return;
  const row = list.querySelector(`[data-id="${CSS.escape(saved.id)}"]`);
  const control = row && row.querySelectorAll('input, button')[saved.index];
  if (control) control.focus();
}

function renderUserRules() {
  const focus = captureFocus(els.userRules);
  const allowed = state.allowUserRules;
  els.userNotice.hidden = allowed;
  els.addRule.hidden = !allowed;
  if (!allowed) closeForm({ restoreFocus: false });

  els.userRules.hidden = !allowed;
  els.userEmpty.hidden = !allowed || state.userRules.length > 0;

  els.userRules.replaceChildren(
    ...state.userRules.map((rule) => {
      const title = ruleTitle(rule);
      const toggle = el('input', {
        type: 'checkbox',
        role: 'switch',
        'aria-label': `Enable rule: ${title}`,
        onchange: (event) => setEnabled(rule.id, event.target.checked),
      });
      toggle.checked = rule.enabled;

      return el('li', { className: `rule${rule.enabled ? '' : ' is-disabled'}`, 'data-id': rule.id }, [
        el('div', { className: 'rule-main' }, [
          el('div', { className: 'rule-title', text: title }),
          ruleDescription(rule),
        ]),
        el('div', { className: 'rule-actions' }, [
          el('label', { className: 'toggle' }, [toggle, rule.enabled ? 'On' : 'Off']),
          el('button', {
            type: 'button',
            className: 'button small',
            text: 'Edit',
            'aria-label': `Edit rule: ${title}`,
            onclick: (event) => openForm(rule, event.currentTarget),
          }),
          el('button', {
            type: 'button',
            className: 'button small danger',
            text: 'Delete',
            'aria-label': `Delete rule: ${title}`,
            onclick: () => deleteRule(rule.id),
          }),
        ]),
      ]);
    }),
  );
  restoreFocus(els.userRules, focus);
}

function render() {
  renderOrgRules();
  renderUserRules();
}

async function refresh() {
  try {
    const config = await loadConfig();
    state.managedRules = config.managedRules;
    state.allowUserRules = config.allowUserRules;
    state.userRules = config.userRules.map((raw) => {
      const rule = normalizeRule(raw);
      if (!rule.id) rule.id = newId();
      return rule;
    });
  } catch (err) {
    toast(`Couldn't load settings: ${err.message}`, { error: true });
  }
  render();
}

// ---------- persistence ----------

async function persist(rules, successMessage) {
  const previous = state.userRules;
  state.userRules = rules;
  render();
  try {
    await saveUserRules(rules);
    toast(successMessage);
    return true;
  } catch (err) {
    state.userRules = previous;
    render();
    const quota = /quota/i.test(String(err && err.message));
    toast(
      quota
        ? "Couldn't save: there are too many rules to sync. Remove some rules and try again."
        : `Couldn't save: ${err.message}`,
      { error: true },
    );
    return false;
  }
}

function setEnabled(id, enabled) {
  const rules = state.userRules.map((r) => (r.id === id ? { ...r, enabled } : r));
  persist(rules, enabled ? 'Rule turned on.' : 'Rule turned off.');
}

async function deleteRule(id) {
  const index = state.userRules.findIndex((r) => r.id === id);
  if (index === -1) return;
  const rule = state.userRules[index];
  if (!confirm(`Delete the rule "${ruleTitle(rule)}"?`)) return;

  if (state.editingId === id) closeForm({ restoreFocus: false });
  const rules = state.userRules.filter((r) => r.id !== id);
  if (await persist(rules, 'Rule deleted.')) {
    // Move focus somewhere sensible now that the row is gone.
    const next = els.userRules.children[Math.min(index, rules.length - 1)];
    (next ? next.querySelector('button') : els.addRule).focus();
  }
}

// ---------- rule form ----------

function clearErrors() {
  for (const input of Object.values(formFields)) {
    input.removeAttribute('aria-invalid');
    const error = $(`${input.id}-error`);
    error.textContent = '';
    error.hidden = true;
  }
}

function showErrors(errors) {
  clearErrors();
  let first = null;
  // Walk fields in form order so focus lands on the first invalid one.
  for (const [field, input] of Object.entries(formFields)) {
    const message = errors[field];
    if (!message) continue;
    input.setAttribute('aria-invalid', 'true');
    const error = $(`${input.id}-error`);
    error.textContent = message;
    error.hidden = false;
    first ??= input;
  }
  first?.focus();
}

function openForm(rule, trigger) {
  state.editingId = rule ? rule.id : null;
  state.returnFocus = trigger || els.addRule;
  els.formHeading.textContent = rule ? 'Edit rule' : 'Add rule';
  els.domain.value = rule ? rule.domain : '';
  els.source.value = rule ? rule.sourceExtension : '';
  els.target.value = rule ? rule.targetExtension : '';
  els.label.value = rule ? rule.label : '';
  els.enabled.checked = rule ? rule.enabled : true;
  clearErrors();
  els.form.hidden = false;
  els.addRule.disabled = true;
  els.domain.focus();
}

function closeForm({ restoreFocus = true } = {}) {
  if (els.form.hidden) return;
  els.form.hidden = true;
  els.addRule.disabled = false;
  clearErrors();
  const target = state.returnFocus;
  state.editingId = null;
  state.returnFocus = null;
  if (restoreFocus && target && target.isConnected) target.focus();
  else if (restoreFocus) els.addRule.focus();
}

async function submitForm(event) {
  event.preventDefault();
  const draft = {
    id: state.editingId || newId(),
    domain: els.domain.value,
    sourceExtension: els.source.value,
    targetExtension: els.target.value,
    label: els.label.value,
    enabled: els.enabled.checked,
  };

  const { valid, errors, rule } = validateRule(draft, state.userRules);
  if (!valid) {
    showErrors(errors);
    return;
  }

  const editing = state.editingId;
  const rules = editing
    ? state.userRules.map((r) => (r.id === editing ? rule : r))
    : [...state.userRules, rule];

  if (await persist(rules, editing ? 'Rule updated.' : 'Rule added.')) {
    // Return focus to the saved rule's Edit button.
    const row = els.userRules.querySelector(`[data-id="${CSS.escape(rule.id)}"]`);
    state.returnFocus = row ? row.querySelector('button') : els.addRule;
    closeForm();
  }
}

// ---------- test a download ----------

function setFieldError(input, message) {
  const error = $(`${input.id}-error`);
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  }
}

function runTest(event) {
  event.preventDefault();
  const url = els.testUrl.value.trim();
  const filename = basename(els.testFilename.value.trim());
  const referrer = els.testReferrer.value.trim();

  setFieldError(els.testUrl, url ? '' : 'Enter the URL the file downloads from.');
  setFieldError(els.testFilename, filename ? '' : 'Enter a filename, such as student_export.text.');
  if (!url || !filename) {
    els.testResult.replaceChildren();
    els.testResult.classList.remove('match');
    return (url ? els.testFilename : els.testUrl).focus();
  }

  const item = { url, finalUrl: url, referrer, filename };
  const config = {
    managedRules: state.managedRules,
    userRules: state.userRules,
    allowUserRules: state.allowUserRules,
  };
  const result = computeRename(item, config);

  els.testResult.classList.toggle('match', Boolean(result));
  if (result) {
    const { rule, source, host } = result.match;
    els.testResult.replaceChildren(
      el('p', {}, [el('strong', { text: 'New filename: ' }), el('code', { text: result.filename })]),
      el('p', {}, [
        `Matched ${source === 'managed' ? 'organization rule' : 'your rule'} “${ruleTitle(rule)}” `,
        `(.${rule.sourceExtension} → .${rule.targetExtension} on ${rule.domain}) via ${host}.`,
      ]),
    );
    return;
  }

  const hosts = candidateHosts(item);
  const { ext } = splitFilename(filename);
  let reason;
  if (hosts.length === 0) {
    reason = 'No website address was found in the URL or referring page, so no rule can match.';
  } else if (!ext) {
    reason = 'The filename has no extension, so it would be left unchanged.';
  } else {
    reason = `No enabled rule changes .${ext.toLowerCase()} files from ${hosts.join(' or ')}.`;
    if (!state.allowUserRules && state.userRules.length > 0) {
      reason += ' Your personal rules are turned off by your organization.';
    }
  }
  els.testResult.replaceChildren(
    el('p', {}, [el('strong', { text: 'No rule matches. ' }), `The file keeps its name: `, el('code', { text: filename })]),
    el('p', { text: reason }),
  );
}

// ---------- wiring ----------

els.addRule.addEventListener('click', (event) => openForm(null, event.currentTarget));
els.cancel.addEventListener('click', () => closeForm());
els.form.addEventListener('submit', submitForm);
els.form.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeForm();
});
els.testForm.addEventListener('submit', runTest);

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync' || area === 'managed') refresh();
});

refresh();
