const DEFAULT_API_BASE = process.env.VUE_APP_SEESEEYOU_API_BASE || 'https://watch.sding.me/api/v1';

const TOKEN_KEY = 'seeseeyou-myday-session';
const API_BASE_KEY = 'seeseeyou-myday-api-base';

export class SeeSeeYouApiError extends Error {
  status: number;

  constructor(message: string, statusCode = 0) {
    super(message);
    this.name = 'SeeSeeYouApiError';
    this.status = statusCode;
  }
}

function storage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function persistentStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function getSeeSeeYouApiBase(): string {
  const configured = persistentStorage()?.getItem(API_BASE_KEY)?.trim();
  return (configured || DEFAULT_API_BASE).replace(/\/+$/, '');
}

export function setSeeSeeYouApiBase(value: string): void {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) {
    persistentStorage()?.removeItem(API_BASE_KEY);
    return;
  }
  persistentStorage()?.setItem(API_BASE_KEY, normalized);
}

export function getSeeSeeYouToken(): string {
  return storage()?.getItem(TOKEN_KEY) || '';
}

export function setSeeSeeYouToken(token: string): void {
  if (token) storage()?.setItem(TOKEN_KEY, token);
  else storage()?.removeItem(TOKEN_KEY);
}

export async function seeSeeYouRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSeeSeeYouToken();
  const headers = new Headers(options.headers || {});
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isForm && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Admin-Token', token);
  }

  let response: Response;
  try {
    response = await fetch(`${getSeeSeeYouApiBase()}${path}`, { ...options, headers });
  } catch (error) {
    throw new SeeSeeYouApiError(
      error instanceof Error ? error.message : 'Unable to reach the SeeSeeYou service'
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const detail = body && typeof body === 'object' ? body.detail || body.message : body;
    throw new SeeSeeYouApiError(detail || `Request failed (${response.status})`, response.status);
  }

  return body as T;
}

export async function loginToSeeSeeYou(username: string, password: string): Promise<void> {
  const result = await seeSeeYouRequest<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setSeeSeeYouToken(result.token);
}

export function logoutFromSeeSeeYou(): void {
  setSeeSeeYouToken('');
}
