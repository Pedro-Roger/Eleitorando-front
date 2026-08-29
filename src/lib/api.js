// Em desenvolvimento, usamos "/api" (o Vite reescreve e encaminha para a API local).
// Em produção, defina VITE_API_URL com a URL completa da API (ex.: http://192.99.208.37:3333)
// antes de rodar "npm run build" — sem isso, o build de produção não sabe onde está a API.
const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
const BASE = API_ORIGIN || '/api';

function authDebug(event, payload = {}) {
  if (typeof window === 'undefined') return;
  const entry = { at: new Date().toISOString(), event, ...payload };
  window.__authDebug = [...(window.__authDebug || []), entry].slice(-50);
  try {
    sessionStorage.setItem('authDebugTrail', JSON.stringify(window.__authDebug));
  } catch {}
  console.log('[auth]', entry);
}

// Monta a URL completa de um arquivo servido pela API (ex.: foto de candidato em /uploads/...).
// Em dev, o caminho relativo já funciona graças ao proxy do Vite; em produção, precisa do domínio da API.
export function assetUrl(path) {
  if (!path) return path;
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

export function getToken() {
  const token = localStorage.getItem('token');
  authDebug('getToken', { hasToken: !!token, tokenLength: token?.length || 0, path: window.location.pathname });
  return token;
}
export function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  authDebug('setSession', { hasToken: !!token, tokenLength: token?.length || 0, username: user?.username || null, role: user?.role || null });
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}
export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  authDebug('clearSession', { path: window.location.pathname });
}

export async function api(path, options = {}) {
  const requestUrl = BASE + path;
  authDebug('api:request', { path, requestUrl, method: options.method || 'GET', hasToken: !!getToken() });
  const res = await fetch(requestUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  authDebug('api:response', { path, requestUrl, status: res.status, ok: res.ok, payloadError: data.error || null });
  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error(data.error || 'Sessão expirada.');
  }
  if (res.status === 423) {
    window.location.href = '/trocar-senha';
    throw new Error(data.error || 'Troque sua senha inicial.');
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Erro inesperado.');
    err.status = res.status;
    err.path = path;
    err.url = requestUrl;
    err.payload = data;
    throw err;
  }
  return data;
}

// Baixa um arquivo autenticado gerado pela API (exportações) e dispara o download no navegador.
export async function apiDownload(path) {
  const res = await fetch(BASE + path, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao gerar o arquivo.');
  }
  const blob = await res.blob();
  const match = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = match ? match[1] : 'exportacao';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// Envio multipart (usado no cadastro/edição de candidato com foto).
// Não define Content-Type manualmente: o navegador precisa gerar o boundary do FormData.
export async function apiUpload(path, formData, { method = 'POST' } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error(data.error || 'Sessão expirada.');
  }
  if (!res.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}
