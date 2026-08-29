import {
  autoEnrollDesktop,
  completeGoogleDesktopAuth,
  getDesktopSyncStatus,
  getGoogleDesktopAuthStatus,
  getSeeSeeYouToken,
  openGoogleAuthorizationUrl,
  startGoogleDesktopAuth,
} from '~/util/seeseeyou';

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('SeeSeeYou desktop Google authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.__TAURI_INTERNALS__;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('starts and polls the dedicated desktop flow', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=one-time',
          poll_token: 'desktop-poll-token-value',
          expires_in: 600,
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: 'pending' }, true, 202));

    const started = await startGoogleDesktopAuth();
    const status = await getGoogleDesktopAuthStatus(started.poll_token);

    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/google\/start\?client=desktop$/);
    expect(fetch.mock.calls[1][0]).toMatch(/\/auth\/google\/status$/);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      poll_token: 'desktop-poll-token-value',
    });
    expect(status).toEqual({ ok: true, status: 'pending' });
  });

  test('completes the one-time flow and stores the returned session', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ token: 'account-session-token' }));

    await completeGoogleDesktopAuth('desktop-poll-token-value', true);

    expect(getSeeSeeYouToken()).toBe('account-session-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      poll_token: 'desktop-poll-token-value',
    });
  });

  test('opens only the Google Accounts HTTPS host through Tauri', async () => {
    const invoke = jest.fn().mockResolvedValue(undefined);
    window.__TAURI_INTERNALS__ = { invoke };

    await openGoogleAuthorizationUrl(
      'https://accounts.google.com/o/oauth2/v2/auth?state=one-time'
    );

    expect(invoke).toHaveBeenCalledWith('open_external', {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=one-time',
    });
    await expect(openGoogleAuthorizationUrl('https://example.com/oauth')).rejects.toThrow(
      'Untrusted Google authorization URL'
    );
  });

  test('sends the selected team only on desktop enrollment', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        device: { device_id: 'device', employee_id: 'employee', team_id: 'team-a' },
        credentials: { device_token: 'token', hmac_secret: 'secret' },
      })
    );

    await autoEnrollDesktop('team-a');

    expect(fetch.mock.calls[0][1].headers.get('X-Team-ID')).toBe('team-a');
  });

  test('preserves structured API error codes and messages', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse(
        { detail: { code: 'team_selection_required', message: 'Choose a team.' } },
        false,
        409
      )
    );

    await expect(autoEnrollDesktop('')).rejects.toMatchObject({
      name: 'SeeSeeYouApiError',
      status: 409,
      code: 'team_selection_required',
      message: 'Choose a team.',
    });
  });

  test('reads sync identity without exposing native credentials', async () => {
    const invoke = jest.fn().mockResolvedValue({
      configured: true,
      employee_id: 'employee',
      team_id: 'team-a',
    });
    window.__TAURI_INTERNALS__ = { invoke };

    await expect(getDesktopSyncStatus()).resolves.toEqual({
      configured: true,
      employee_id: 'employee',
      team_id: 'team-a',
    });
  });
});
