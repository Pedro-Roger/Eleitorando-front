const BASE = '/api';

export function getToken() {
  return localStorage.getItem('token');
}
export function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
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
}

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error(data.error || 'Sessão expirada.');
  }
  if (res.status === 423) {
    window.location.href = '/trocar-senha';
    throw new Error(data.error || 'Troque sua senha inicial.');
  }
  if (!res.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
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
