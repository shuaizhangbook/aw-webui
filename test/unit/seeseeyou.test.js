import {
  autoEnrollDesktop,
  getSeeSeeYouEnrollmentContext,
  getSelectedSeeSeeYouTeamId,
  resolveSeeSeeYouTeamSelection,
  seeSeeYouRequest,
  setSeeSeeYouToken,
  setSelectedSeeSeeYouTeamId,
} from '~/util/seeseeyou';

function jsonResponse(body, statusCode = 200) {
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    headers: { get: name => (name.toLowerCase() === 'content-type' ? 'application/json' : '') },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('SeeSeeYou API client', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = jest.fn();
    setSeeSeeYouToken('session-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('preserves structured backend error code and message', async () => {
    fetch.mockResolvedValue(
      jsonResponse(
        {
          detail: {
            code: 'team_selection_required',
            message: 'Select the current team before enrolling this device.',
          },
        },
        409
      )
    );

    await expect(seeSeeYouRequest('/devices/auto-enroll')).rejects.toMatchObject({
      status: 409,
      code: 'team_selection_required',
      message: 'Select the current team before enrolling this device.',
    });
  });

  test('sends the selected team when automatically enrolling', async () => {
    fetch.mockResolvedValue(
      jsonResponse({
        device: { device_id: 'device-1', employee_id: 'employee-1', team_id: 'team-b' },
        credentials: { device_token: 'token', hmac_secret: 'secret' },
      })
    );

    await autoEnrollDesktop(' team-b ');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/devices/auto-enroll');
    expect(options.headers.get('X-Team-ID')).toBe('team-b');
    expect(options.headers.get('Authorization')).toBe('Bearer session-token');
  });

  test('limits system administrators to teams where they are active members', async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse({
          user: {
            employee_id: 'employee-1',
            is_admin: true,
            team_roles: [{ team_id: 'team-b', role: 'MEMBER' }],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { team_id: 'team-a', name: 'A', is_active: true },
            { team_id: 'team-b', name: 'B', is_active: true },
            { team_id: 'team-c', name: 'C', is_active: false },
          ],
        })
      );

    await expect(getSeeSeeYouEnrollmentContext()).resolves.toEqual({
      employee_id: 'employee-1',
      teams: [{ team_id: 'team-b', name: 'B', is_active: true }],
    });
  });

  test('stores the selected team separately for each employee', () => {
    setSelectedSeeSeeYouTeamId('employee-1', 'team-a');
    setSelectedSeeSeeYouTeamId('employee-2', 'team-b');

    expect(getSelectedSeeSeeYouTeamId('employee-1')).toBe('team-a');
    expect(getSelectedSeeSeeYouTeamId('employee-2')).toBe('team-b');
  });

  test('only auto-selects when exactly one accessible team exists', () => {
    const oneTeam = [{ team_id: 'team-a', name: 'A' }];
    const twoTeams = [...oneTeam, { team_id: 'team-b', name: 'B' }];

    expect(resolveSeeSeeYouTeamSelection(oneTeam)).toBe('team-a');
    expect(resolveSeeSeeYouTeamSelection(twoTeams)).toBe('');
    expect(resolveSeeSeeYouTeamSelection(twoTeams, 'team-b')).toBe('team-b');
    expect(resolveSeeSeeYouTeamSelection(twoTeams, 'removed-team')).toBe('');
  });
});
