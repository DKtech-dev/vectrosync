/**
 * Centralized API fetch helper with automatic `X-API-Key` injection.
 *
 * Resolution order:
 *   1. window.__CATENARY_API_KEY__        (runtime injection)
 *   2. import.meta.env.VITE_API_KEY       (build-time)
 *   3. localStorage 'catenary_api_key'    (operator-entered)
 *
 * The pre-rebrand `__VECTROSYNC_API_KEY__` / `vectrosync_api_key` names are
 * still read as a last-resort fallback so existing installs keep working, but
 * `setApiKey` only ever writes the `catenary_*` key.
 */

const STORAGE_KEY = 'catenary_api_key';
const LEGACY_STORAGE_KEY = 'vectrosync_api_key';

function readLocalStorage(key) {
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function readViteEnv() {
  try {
    return import.meta?.env?.VITE_API_KEY || null;
  } catch {
    return null;
  }
}

export function getApiKey() {
  if (typeof window === 'undefined') return null;
  return (
    window.__CATENARY_API_KEY__ ||
    window.__VECTROSYNC_API_KEY__ ||
    readViteEnv() ||
    readLocalStorage(STORAGE_KEY) ||
    readLocalStorage(LEGACY_STORAGE_KEY) ||
    null
  );
}

/** Persist an operator-entered key. Writes the current key name only. */
export function setApiKey(key) {
  if (typeof window === 'undefined') return;
  try {
    if (key) window.localStorage?.setItem(STORAGE_KEY, key);
    else window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  const apiKey = getApiKey();
  if (apiKey && !headers.has('X-API-Key')) {
    headers.set('X-API-Key', apiKey);
  }

  return fetch(url, { ...options, headers });
}

export default apiFetch;
