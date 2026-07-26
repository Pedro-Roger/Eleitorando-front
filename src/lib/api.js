// Em desenvolvimento, usamos "/api" (o Vite reescreve e encaminha para a API local).
// Em produção, defina VITE_API_URL com a URL completa da API (ex.: http://192.99.208.37:3333)
// antes de rodar "npm run build" — sem isso, o build de produção não sabe onde está a API.
const API_ORIGIN = import.meta.env.VITE_API_URL || '';
const BASE = API_ORIGIN || '/api';

// Monta a URL completa de um arquivo servido pela API (ex.: foto de candidato em /uploads/...).
// Em dev, o caminho relativo já funciona graças ao proxy do Vite; em produção, precisa do domínio da API.
export function assetUrl(path) {
  if (!path) return path;
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

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
