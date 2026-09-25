// Reads and writes extension settings in chrome.storage. Shared by the service
// worker and the options page.

export const USER_RULES_KEY = 'rules';
export const MANAGED_RULES_KEY = 'managedRules';
export const ALLOW_USER_RULES_KEY = 'allowUserRules';

async function readManaged() {
  try {
    return (await chrome.storage.managed.get([MANAGED_RULES_KEY, ALLOW_USER_RULES_KEY])) || {};
  } catch {
    // Managed storage is unavailable on some platforms when no policy is set.
    return {};
  }
}

async function readUserRules() {
  const stored = await chrome.storage.sync.get(USER_RULES_KEY);
  return Array.isArray(stored[USER_RULES_KEY]) ? stored[USER_RULES_KEY] : [];
}

/** Resolves to { managedRules, userRules, allowUserRules }. */
export async function loadConfig() {
  const [managed, userRules] = await Promise.all([readManaged(), readUserRules()]);
  return {
    managedRules: Array.isArray(managed[MANAGED_RULES_KEY]) ? managed[MANAGED_RULES_KEY] : [],
    userRules,
    allowUserRules: managed[ALLOW_USER_RULES_KEY] !== false,
  };
}

export async function saveUserRules(rules) {
  await chrome.storage.sync.set({ [USER_RULES_KEY]: rules });
}
