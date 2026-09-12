/**
 * Centralized API fetch helper with automatic X-API-Key injection.
 * Resolves API key from window.__CATENARY_API_KEY__, Vite env VITE_API_KEY,
 * or localStorage 'catenary_api_key'.
 */

export function getApiKey() {
  if (typeof window === 'undefined') return null;
  return (
    window.__CATENARY_API_KEY__ ||
    window.__VECTROSYNC_API_KEY__ ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_KEY : null) ||
    window.localStorage?.getItem('catenary_api_key') ||
    window.localStorage?.getItem('vectrosync_api_key') ||
    null
  );
}

export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  const apiKey = getApiKey();
  if (apiKey && !headers.has('X-API-Key')) {
    headers.set('X-API-Key', apiKey);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
