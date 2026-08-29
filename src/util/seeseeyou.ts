const DEFAULT_API_BASE = process.env.VUE_APP_SEESEEYOU_API_BASE || 'https://watch.sding.me/api/v1';

const TOKEN_KEY = 'seeseeyou-myday-session';
const PERSISTENT_TOKEN_KEY = 'seeseeyou-myday-session-persistent';
const INSTALLATION_ID_KEY = 'seeseeyou-desktop-installation-id';

export class SeeSeeYouApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, statusCode = 0, code = '') {
    super(message);
    this.name = 'SeeSeeYouApiError';
    this.status = statusCode;
    this.code = code;
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
    const detailObject =
      detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null;
    const message =
      detailObject && typeof detailObject.message === 'string'
        ? detailObject.message
        : typeof detail === 'string'
        ? detail
        : '';
    const code = detailObject ? String(detailObject.code || '') : '';
    throw new SeeSeeYouApiError(
      message || `Request failed (${response.status})`,
      response.status,
      code
    );
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

export interface GoogleDesktopAuthStart {
  authorization_url: string;
  poll_token: string;
  expires_in: number;
}

export interface GoogleAuthStatus {
  ok: boolean;
  status: 'pending' | 'ready';
  mode?: 'LOGIN' | 'SIGNUP';
  email?: string;
}

export async function startGoogleDesktopAuth(): Promise<GoogleDesktopAuthStart> {
  return seeSeeYouRequest<GoogleDesktopAuthStart>('/auth/google/start?client=desktop');
}

export async function getGoogleDesktopAuthStatus(pollToken: string): Promise<GoogleAuthStatus> {
  return seeSeeYouRequest<GoogleAuthStatus>('/auth/google/status', {
    method: 'POST',
    body: JSON.stringify({ poll_token: pollToken }),
  });
}

export async function completeGoogleDesktopAuth(pollToken: string, remember = true): Promise<void> {
  const result = await seeSeeYouRequest<{ token: string }>('/auth/google/complete', {
    method: 'POST',
    body: JSON.stringify({ poll_token: pollToken }),
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

export interface DesktopTeam {
  team_id: string;
  name: string;
  role: string;
}

export interface DesktopTeams {
  employee_id: string;
  items: DesktopTeam[];
}

export interface DesktopSyncConfig {
  server_url: string;
  local_api_url: string;
  device_id: string;
  employee_id: string;
  team_id: string;
  device_key: string;
  hmac_secret: string;
}

export interface DesktopSyncStatus {
  configured: boolean;
  employee_id?: string | null;
  team_id?: string | null;
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

export async function getMyDesktopTeams(): Promise<DesktopTeams> {
  return seeSeeYouRequest<DesktopTeams>('/me/teams');
}

export async function autoEnrollDesktop(teamId: string): Promise<DesktopEnrollment> {
  const platform = detectDesktopPlatform();
  return seeSeeYouRequest<DesktopEnrollment>('/devices/auto-enroll', {
    method: 'POST',
    headers: { 'X-Team-ID': teamId },
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

export async function openGoogleAuthorizationUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (_error) {
    throw new Error('Invalid Google authorization URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'accounts.google.com') {
    throw new Error('Untrusted Google authorization URL');
  }

  const invoke = tauriInvoke();
  if (invoke) {
    await invoke('open_external', { url: parsed.toString() });
    return;
  }

  const opened = window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  if (!opened) throw new Error('Unable to open the system browser');
}

export async function getDesktopSyncStatus(): Promise<DesktopSyncStatus | null> {
  const invoke = tauriInvoke();
  if (!invoke) return null;
  const result = await invoke('get_sync_status');
  if (typeof result === 'boolean') return { configured: result };
  if (result && typeof result === 'object' && 'configured' in result) {
    return result as DesktopSyncStatus;
  }
  return { configured: false };
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
