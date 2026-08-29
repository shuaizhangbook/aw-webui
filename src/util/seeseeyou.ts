const DEFAULT_API_BASE = process.env.VUE_APP_SEESEEYOU_API_BASE || 'https://watch.sding.me/api/v1';

const TOKEN_KEY = 'seeseeyou-myday-session';
const PERSISTENT_TOKEN_KEY = 'seeseeyou-myday-session-persistent';
const INSTALLATION_ID_KEY = 'seeseeyou-desktop-installation-id';

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
  return DEFAULT_API_BASE.replace(/\/+$/, '');
}

export function getSeeSeeYouToken(): string {
  return persistentStorage()?.getItem(PERSISTENT_TOKEN_KEY) || storage()?.getItem(TOKEN_KEY) || '';
}

export function setSeeSeeYouToken(token: string, remember = true): void {
  storage()?.removeItem(TOKEN_KEY);
  persistentStorage()?.removeItem(PERSISTENT_TOKEN_KEY);
  if (!token) return;
  if (remember) persistentStorage()?.setItem(PERSISTENT_TOKEN_KEY, token);
  else storage()?.setItem(TOKEN_KEY, token);
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
    throw new SeeSeeYouApiError('Unable to reach the SeeSeeYou service');
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

export async function loginToSeeSeeYou(
  username: string,
  password: string,
  remember = true
): Promise<void> {
  const result = await seeSeeYouRequest<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setSeeSeeYouToken(result.token, remember);
}

export function logoutFromSeeSeeYou(): void {
  setSeeSeeYouToken('');
}

export interface DesktopEnrollment {
  device: {
    device_id: string;
    employee_id: string;
    team_id: string;
    device_name?: string | null;
    platform?: string | null;
  };
  credentials: {
    device_token: string;
    hmac_secret: string;
  };
}

export interface DesktopSyncConfig {
  server_url: string;
  local_api_url: string;
  device_id: string;
  employee_id: string;
  device_key: string;
  hmac_secret: string;
}

function newInstallationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `desktop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDesktopInstallationId(): string {
  const existing = persistentStorage()?.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = newInstallationId();
  persistentStorage()?.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

export function detectDesktopPlatform(): string {
  const source = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (source.includes('win')) return 'Windows';
  if (source.includes('mac')) return 'macOS';
  if (source.includes('linux')) return 'Linux';
  return 'Desktop';
}

export async function autoEnrollDesktop(): Promise<DesktopEnrollment> {
  const platform = detectDesktopPlatform();
  return seeSeeYouRequest<DesktopEnrollment>('/devices/auto-enroll', {
    method: 'POST',
    body: JSON.stringify({
      installation_id: getDesktopInstallationId(),
      device_name: `SeeSeeYou ${platform}`,
      platform,
    }),
  });
}

function tauriInvoke():
  | ((command: string, args?: Record<string, unknown>) => Promise<unknown>)
  | null {
  const candidate = (window as any)?.__TAURI_INTERNALS__?.invoke;
  return typeof candidate === 'function' ? candidate : null;
}

export async function getDesktopSyncStatus(): Promise<boolean | null> {
  const invoke = tauriInvoke();
  if (!invoke) return null;
  return Boolean(await invoke('get_sync_status'));
}

export async function configureDesktopSync(config: DesktopSyncConfig): Promise<boolean> {
  const invoke = tauriInvoke();
  if (!invoke) return false;
  await invoke('configure_sync', { config });
  return true;
}

export async function clearDesktopSync(): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) await invoke('clear_sync');
}

export function apiBaseToServerUrl(apiBase = getSeeSeeYouApiBase()): string {
  return apiBase.replace(/\/api\/v1\/?$/, '');
}
