const DEFAULT_API_BASE = process.env.VUE_APP_SEESEEYOU_API_BASE || 'https://watch.sding.me/api/v1';

const TOKEN_KEY = 'seeseeyou-myday-session';
const PERSISTENT_TOKEN_KEY = 'seeseeyou-myday-session-persistent';
const INSTALLATION_ID_KEY = 'seeseeyou-desktop-installation-id';
const SELECTED_TEAM_ID_PREFIX = 'seeseeyou-current-team-id';

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
    const responseBody =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const detail = responseBody?.detail ?? responseBody?.message ?? body;
    const structuredDetail =
      detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null;
    const code = structuredDetail?.code ? String(structuredDetail.code) : '';
    const message = structuredDetail?.message
      ? String(structuredDetail.message)
      : typeof detail === 'string'
      ? detail
      : `Request failed (${response.status})`;
    throw new SeeSeeYouApiError(message, response.status, code);
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

export interface SeeSeeYouTeam {
  team_id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  member_count?: number;
  my_role?: string | null;
}

export interface SeeSeeYouEnrollmentContext {
  employee_id: string;
  teams: SeeSeeYouTeam[];
}

interface SeeSeeYouSessionUser {
  employee_id?: string | null;
  team_roles?: { team_id: string; role?: string }[];
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

export interface DesktopSyncBinding {
  employee_id: string;
  team_id: string;
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

function selectedTeamStorageKey(employeeId: string): string {
  return `${SELECTED_TEAM_ID_PREFIX}:${employeeId.trim()}`;
}

export function getSelectedSeeSeeYouTeamId(employeeId: string): string {
  const normalizedEmployeeId = employeeId.trim();
  if (!normalizedEmployeeId) return '';
  return persistentStorage()?.getItem(selectedTeamStorageKey(normalizedEmployeeId))?.trim() || '';
}

export function setSelectedSeeSeeYouTeamId(employeeId: string, teamId: string): void {
  const normalizedEmployeeId = employeeId.trim();
  if (!normalizedEmployeeId) return;
  const normalized = teamId.trim();
  const key = selectedTeamStorageKey(normalizedEmployeeId);
  if (normalized) persistentStorage()?.setItem(key, normalized);
  else persistentStorage()?.removeItem(key);
}

export function resolveSeeSeeYouTeamSelection(
  teams: SeeSeeYouTeam[],
  preferredTeamId = ''
): string {
  const normalized = preferredTeamId.trim();
  if (normalized && teams.some(team => team.team_id === normalized)) return normalized;
  return teams.length === 1 ? teams[0].team_id : '';
}

export async function getSeeSeeYouEnrollmentContext(): Promise<SeeSeeYouEnrollmentContext> {
  const [session, result] = await Promise.all([
    seeSeeYouRequest<{ user: SeeSeeYouSessionUser }>('/auth/me'),
    seeSeeYouRequest<{ items: SeeSeeYouTeam[] }>('/admin/teams'),
  ]);
  const employeeId = String(session.user?.employee_id || '').trim();
  const memberTeamIds = new Set(
    (Array.isArray(session.user?.team_roles) ? session.user.team_roles : []).map(role =>
      String(role.team_id)
    )
  );
  const teams = (Array.isArray(result.items) ? result.items : []).filter(
    team => team.is_active !== false && memberTeamIds.has(String(team.team_id))
  );
  return { employee_id: employeeId, teams };
}

export function detectDesktopPlatform(): string {
  const source = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (source.includes('win')) return 'Windows';
  if (source.includes('mac')) return 'macOS';
  if (source.includes('linux')) return 'Linux';
  return 'Desktop';
}

export async function autoEnrollDesktop(teamId = ''): Promise<DesktopEnrollment> {
  const platform = detectDesktopPlatform();
  const headers = new Headers();
  const normalizedTeamId = teamId.trim();
  if (normalizedTeamId) headers.set('X-Team-ID', normalizedTeamId);
  return seeSeeYouRequest<DesktopEnrollment>('/devices/auto-enroll', {
    method: 'POST',
    headers,
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

export async function getDesktopSyncBinding(): Promise<DesktopSyncBinding | null> {
  const invoke = tauriInvoke();
  if (!invoke) return null;
  try {
    const value = (await invoke('get_sync_binding')) as DesktopSyncBinding | null;
    if (!value || !value.employee_id || !value.team_id) return null;
    return {
      employee_id: String(value.employee_id),
      team_id: String(value.team_id),
    };
  } catch {
    return null;
  }
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
