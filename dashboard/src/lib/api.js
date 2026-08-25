// Fotolio API client. Access token in memory (+ localStorage for reloads);
// refresh token is an httpOnly cookie handled by the browser.

let accessToken = localStorage.getItem('fotolio_at') || null;
let refreshing = null;

export function setToken(token) {
  accessToken = token || null;
  if (token) localStorage.setItem('fotolio_at', token);
  else localStorage.removeItem('fotolio_at');
}
export function getToken() {
  return accessToken;
}

async function raw(method, path, { body, isForm, auth = true, signal } = {}) {
  const headers = {};
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    signal,
  });
  return res;
}

async function tryRefresh() {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('refresh failed');
        const data = await r.json();
        setToken(data.access_token);
        return data.access_token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(method, path, opts = {}) {
  let res = await raw(method, path, opts);

  if (res.status === 401 && opts.auth !== false && !opts._retried) {
    try {
      await tryRefresh();
      return request(method, path, { ...opts, _retried: true });
    } catch {
      setToken(null);
      throw new ApiError('Your session has expired. Please sign in again.', 401, {});
    }
  }

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.message || 'Something went wrong.', res.status, data?.errors || {}, data);
  }
  return data;
}

function safeParse(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, status, errors = {}, data = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

export const api = {
  get: (p, opts) => request('GET', p, opts),
  post: (p, body, opts) => request('POST', p, { body, ...opts }),
  put: (p, body, opts) => request('PUT', p, { body, ...opts }),
  patch: (p, body, opts) => request('PATCH', p, { body, ...opts }),
  del: (p, opts) => request('DELETE', p, opts),
  upload: (p, formData, opts) => request('POST', p, { body: formData, isForm: true, ...opts }),
  raw,
};
