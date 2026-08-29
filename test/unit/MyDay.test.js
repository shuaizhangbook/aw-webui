import { shallowMount } from '@vue/test-utils';

jest.mock('~/util/seeseeyou', () => {
  class SeeSeeYouApiError extends Error {
    constructor(message, statusCode = 0, code = '') {
      super(message);
      this.name = 'SeeSeeYouApiError';
      this.status = statusCode;
      this.code = code;
    }
  }

  return {
    apiBaseToServerUrl: value => value.replace(/\/api\/v1\/?$/, ''),
    autoEnrollDesktop: jest.fn(),
    clearDesktopSync: jest.fn(),
    configureDesktopSync: jest.fn(),
    getDesktopSyncBinding: jest.fn(),
    getDesktopSyncStatus: jest.fn(),
    getSelectedSeeSeeYouTeamId: jest.fn(),
    getSeeSeeYouApiBase: () => 'https://watch.example/api/v1',
    getSeeSeeYouEnrollmentContext: jest.fn(),
    getSeeSeeYouToken: jest.fn(),
    loginToSeeSeeYou: jest.fn(),
    logoutFromSeeSeeYou: jest.fn(),
    resolveSeeSeeYouTeamSelection: (teams, preferred) => {
      if (preferred && teams.some(team => team.team_id === preferred)) return preferred;
      return teams.length === 1 ? teams[0].team_id : '';
    },
    seeSeeYouRequest: jest.fn(),
    SeeSeeYouApiError,
    setSelectedSeeSeeYouTeamId: jest.fn(),
  };
});

import MyDay from '~/views/MyDay.vue';
import * as seeseeyou from '~/util/seeseeyou';

const {
  autoEnrollDesktop: mockAutoEnrollDesktop,
  clearDesktopSync: mockClearDesktopSync,
  configureDesktopSync: mockConfigureDesktopSync,
  getDesktopSyncBinding: mockGetDesktopSyncBinding,
  getDesktopSyncStatus: mockGetDesktopSyncStatus,
  getSelectedSeeSeeYouTeamId: mockGetSelectedTeamId,
  getSeeSeeYouEnrollmentContext: mockGetEnrollmentContext,
  getSeeSeeYouToken: mockGetToken,
  seeSeeYouRequest: mockRequest,
  setSelectedSeeSeeYouTeamId: mockSetSelectedTeamId,
  SeeSeeYouApiError,
} = seeseeyou;

const emptyWork = {
  date: '2026-08-29',
  employee_name: 'Tester',
  focus: null,
  summary: {},
  tasks: { todo: [], in_progress: [], review: [], done: [] },
};

async function settle(wrapper) {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await wrapper.vm.$nextTick();
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, wrapper) {
  for (let index = 0; index < 30; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
    await wrapper.vm.$nextTick();
  }
  throw new Error('Timed out waiting for asynchronous test state');
}

function mountMyDay(locale = 'en') {
  return shallowMount(MyDay, {
    mocks: { $i18n: { locale } },
  });
}

describe('My Day desktop team enrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockReturnValue(true);
    mockGetSelectedTeamId.mockReturnValue('');
    mockGetDesktopSyncStatus.mockResolvedValue(false);
    mockGetDesktopSyncBinding.mockResolvedValue(null);
    mockClearDesktopSync.mockResolvedValue(undefined);
    mockConfigureDesktopSync.mockResolvedValue(true);
    mockRequest.mockResolvedValue(emptyWork);
    mockAutoEnrollDesktop.mockImplementation(teamId =>
      Promise.resolve({
        device: { device_id: 'device-1', employee_id: 'employee-1', team_id: teamId },
        credentials: { device_token: 'device-token', hmac_secret: 'hmac-secret' },
      })
    );
  });

  test('loads My Day but pauses activity sync until a multi-team user chooses', async () => {
    mockGetEnrollmentContext.mockResolvedValue({
      employee_id: 'employee-1',
      teams: [
        { team_id: 'team-a', name: 'Team A' },
        { team_id: 'team-b', name: 'Team B' },
      ],
    });
    const wrapper = mountMyDay();

    await settle(wrapper);

    expect(mockRequest).toHaveBeenCalledWith('/my-work', { headers: {} });
    expect(mockAutoEnrollDesktop).not.toHaveBeenCalled();
    expect(wrapper.find('.team-picker').exists()).toBe(true);
    expect(wrapper.text()).toContain('Select an activity sync team');

    await wrapper.find('.team-picker select').setValue('team-b');
    await settle(wrapper);

    expect(mockSetSelectedTeamId).toHaveBeenCalledWith('employee-1', 'team-b');
    expect(mockAutoEnrollDesktop).toHaveBeenCalledWith('team-b');
    expect(mockRequest).toHaveBeenLastCalledWith('/my-work', {
      headers: { 'X-Team-ID': 'team-b' },
    });
    expect(mockConfigureDesktopSync).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'employee-1', team_id: 'team-b' })
    );
  });

  test('re-enrolls when the configured desktop belongs to another employee', async () => {
    mockGetEnrollmentContext.mockResolvedValue({
      employee_id: 'employee-1',
      teams: [{ team_id: 'team-a', name: 'Team A' }],
    });
    mockGetDesktopSyncStatus.mockResolvedValue(true);
    mockGetDesktopSyncBinding.mockResolvedValue({
      employee_id: 'previous-employee',
      team_id: 'team-a',
    });
    const wrapper = mountMyDay();

    await settle(wrapper);

    expect(mockClearDesktopSync).toHaveBeenCalledTimes(1);
    expect(mockAutoEnrollDesktop).toHaveBeenCalledWith('team-a');
    expect(mockConfigureDesktopSync).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'employee-1', team_id: 'team-a' })
    );
  });

  test('serializes rapid team changes and only configures the latest selection', async () => {
    const firstEnrollment = deferred();
    mockGetEnrollmentContext.mockResolvedValue({
      employee_id: 'employee-1',
      teams: [
        { team_id: 'team-a', name: 'Team A' },
        { team_id: 'team-b', name: 'Team B' },
      ],
    });
    mockAutoEnrollDesktop.mockImplementation(teamId => {
      if (teamId === 'team-a') return firstEnrollment.promise;
      return Promise.resolve({
        device: { device_id: 'device-b', employee_id: 'employee-1', team_id: 'team-b' },
        credentials: { device_token: 'device-token-b', hmac_secret: 'hmac-secret-b' },
      });
    });
    const wrapper = mountMyDay();
    await settle(wrapper);

    wrapper.vm.selectedTeamId = 'team-a';
    const firstChange = wrapper.vm.changeTeam();
    await waitFor(() => mockAutoEnrollDesktop.mock.calls.length === 1, wrapper);

    wrapper.vm.selectedTeamId = 'team-b';
    const secondChange = wrapper.vm.changeTeam();
    firstEnrollment.resolve({
      device: { device_id: 'device-a', employee_id: 'employee-1', team_id: 'team-a' },
      credentials: { device_token: 'device-token-a', hmac_secret: 'hmac-secret-a' },
    });
    await Promise.all([firstChange, secondChange]);
    await settle(wrapper);

    expect(mockAutoEnrollDesktop.mock.calls.map(call => call[0])).toEqual(['team-a', 'team-b']);
    expect(mockConfigureDesktopSync).toHaveBeenCalledTimes(1);
    expect(mockConfigureDesktopSync).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: 'employee-1', team_id: 'team-b' })
    );
    expect(wrapper.vm.selectedTeamId).toBe('team-b');
  });

  test('does not recreate sync credentials when logout wins an in-flight enrollment', async () => {
    const enrollment = deferred();
    mockGetEnrollmentContext.mockResolvedValue({
      employee_id: 'employee-1',
      teams: [{ team_id: 'team-a', name: 'Team A' }],
    });
    mockAutoEnrollDesktop.mockReturnValue(enrollment.promise);
    const wrapper = mountMyDay();
    await waitFor(() => mockAutoEnrollDesktop.mock.calls.length === 1, wrapper);

    expect(wrapper.findAll('.quiet-button').at(1).attributes('disabled')).toBeUndefined();
    const logout = wrapper.vm.logout();
    enrollment.resolve({
      device: { device_id: 'device-a', employee_id: 'employee-1', team_id: 'team-a' },
      credentials: { device_token: 'device-token-a', hmac_secret: 'hmac-secret-a' },
    });
    await logout;
    await settle(wrapper);

    expect(mockConfigureDesktopSync).not.toHaveBeenCalled();
    expect(mockClearDesktopSync).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.authenticated).toBe(false);
    expect(wrapper.vm.syncState).toBe('pending');
  });

  test('preserves an existing desktop sync when team context loading temporarily fails', async () => {
    mockGetDesktopSyncStatus.mockResolvedValue(true);
    mockGetEnrollmentContext.mockRejectedValue(new Error('temporary failure'));
    const wrapper = mountMyDay();

    await settle(wrapper);

    expect(wrapper.text()).toContain('Unable to load your teams');
    expect(mockGetDesktopSyncStatus).not.toHaveBeenCalled();
    expect(mockClearDesktopSync).not.toHaveBeenCalled();
  });

  test('keeps a retry action when team context loading fails', async () => {
    mockGetEnrollmentContext
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        employee_id: 'employee-1',
        teams: [{ team_id: 'team-a', name: 'Team A' }],
      });
    const wrapper = mountMyDay();
    await settle(wrapper);

    expect(wrapper.text()).toContain('Unable to load your teams');
    expect(wrapper.find('.quiet-button').exists()).toBe(true);

    await wrapper.find('.quiet-button').trigger('click');
    await settle(wrapper);

    expect(mockGetEnrollmentContext).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledWith('/my-work', {
      headers: { 'X-Team-ID': 'team-a' },
    });
  });

  test('renders a stable backend error code in the active UI language', () => {
    mockGetToken.mockReturnValue(false);
    const wrapper = mountMyDay('en');
    const error = new SeeSeeYouApiError('后端中文消息', 409, 'team_selection_required');

    expect(wrapper.vm.friendlyError(error, 'fallback')).toContain('Select an activity sync team');
    expect(wrapper.vm.friendlyError(error, 'fallback')).not.toContain('中文');
  });
});
