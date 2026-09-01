<template>
  <div class="my-day-page">
    <section class="hero-panel">
      <div>
        <div class="eyebrow">CLARITIDE · MY DAY</div>
        <h2>{{ greeting }}</h2>
        <p>{{ formattedDate }} · {{ copy.subtitle }}</p>
      </div>
      <div class="hero-actions">
        <span
          v-if="authenticated"
          class="connection-pill sync-pill"
          :class="{ offline: syncState === 'error' }"
        >
          <span class="status-dot"></span>
          {{ syncStatusLabel }}
        </span>
        <button
          v-if="workData"
          class="quiet-button"
          type="button"
          :disabled="loading"
          @click="refresh"
        >
          {{ copy.refresh }}
        </button>
        <button v-if="authenticated" class="quiet-button" type="button" @click="logout">
          {{ copy.logout }}
        </button>
      </div>
    </section>

    <section v-if="!authenticated" class="login-shell">
      <div class="login-copy">
        <span class="section-kicker">{{ copy.workspace }}</span>
        <h3>{{ copy.loginTitle }}</h3>
        <p>{{ copy.loginBody }}</p>
        <div class="feature-list">
          <span>{{ copy.featureLocal }}</span>
          <span>{{ copy.featureTasks }}</span>
          <span>{{ copy.featureFocus }}</span>
        </div>
      </div>
      <form class="login-card" @submit.prevent="login">
        <button
          class="google-button"
          type="button"
          :disabled="loading || googleLoading"
          @click="loginWithGoogle"
        >
          <span class="google-mark" aria-hidden="true">G</span>
          <span>{{ googleLoading ? copy.googleWaiting : copy.googleSignIn }}</span>
        </button>
        <div class="auth-divider">
          <span>{{ copy.orPassword }}</span>
        </div>
        <label>
          <span>{{ copy.account }}</span>
          <input v-model.trim="credentials.username" autocomplete="username" required />
        </label>
        <label>
          <span>{{ copy.password }}</span>
          <input
            v-model="credentials.password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <label class="remember-row">
          <input v-model="rememberLogin" type="checkbox" />
          <span>{{ copy.remember }}</span>
        </label>
        <p v-if="error" class="error-message">{{ error }}</p>
        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? copy.signingIn : copy.signIn }}
        </button>
        <small>{{ copy.loginNote }}</small>
      </form>
    </section>

    <template v-else>
      <p v-if="error" class="error-banner">{{ error }}</p>
      <p v-if="syncError" class="error-banner">{{ syncError }}</p>

      <section v-if="teamSelectionRequired" class="team-picker">
        <div>
          <span class="section-kicker">{{ copy.syncWorkspace }}</span>
          <h3>{{ copy.chooseTeam }}</h3>
          <p>{{ copy.chooseTeamBody }}</p>
        </div>
        <div class="team-options">
          <button
            v-for="team in availableTeams"
            :key="team.team_id"
            type="button"
            :disabled="syncState === 'connecting'"
            @click="selectSyncTeam(team)"
          >
            <strong>{{ team.name || team.team_id }}</strong>
            <span>{{ team.team_id }}</span>
          </button>
        </div>
      </section>

      <section class="summary-grid">
        <article v-for="card in summaryCards" :key="card.key" class="summary-card">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.note }}</small>
        </article>
      </section>

      <section class="focus-grid">
        <article class="focus-card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">{{ copy.todayFocus }}</span>
              <h3>{{ focusTask ? focusTask.title || focusTask.content : copy.noFocus }}</h3>
            </div>
            <span class="focus-mark">◎</span>
          </div>
          <p v-if="focusTask" class="focus-description">
            {{ focusTask.description || focusTask.note || copy.focusFallback }}
          </p>
          <p v-else class="focus-description">{{ copy.noFocusBody }}</p>
          <div v-if="focusTask" class="task-meta">
            <span>{{ priorityLabel(focusTask.priority) }}</span>
            <span v-if="focusTask.team_name">{{ focusTask.team_name }}</span>
            <span v-if="focusTask.due_date">{{ copy.due }} {{ focusTask.due_date }}</span>
          </div>
        </article>
      </section>

      <section class="board-section">
        <div class="board-heading">
          <div>
            <span class="section-kicker">{{ copy.executionBoard }}</span>
            <h3>{{ copy.todayTasks }}</h3>
          </div>
          <span class="board-count">{{ totalTasks }} {{ copy.items }}</span>
        </div>

        <div class="task-board">
          <article v-for="column in columns" :key="column.key" class="task-column">
            <header>
              <span class="column-dot" :style="{ backgroundColor: column.color }"></span>
              <strong>{{ column.label }}</strong>
              <span>{{ tasksFor(column.key).length }}</span>
            </header>
            <div class="task-list">
              <div v-for="task in tasksFor(column.key)" :key="task.id" class="task-card">
                <div class="task-card-top">
                  <span class="priority" :class="String(task.priority || 'medium').toLowerCase()">
                    {{ priorityLabel(task.priority) }}
                  </span>
                  <button
                    v-if="column.key !== 'done' && !task.is_today_focus"
                    class="star-button"
                    type="button"
                    :title="copy.setFocus"
                    :disabled="busyTaskId === task.id"
                    @click="performAction(task, 'focus')"
                  >
                    ☆
                  </button>
                  <span v-else-if="task.is_today_focus" class="focused-star">★</span>
                </div>
                <h4>{{ task.title || task.content }}</h4>
                <p v-if="task.description || task.note">{{ task.description || task.note }}</p>
                <div class="task-meta compact">
                  <span v-if="task.team_name">{{ task.team_name }}</span>
                  <span v-if="task.due_date">{{ task.due_date }}</span>
                  <span v-if="task.actual_hours">{{ task.actual_hours }}h</span>
                </div>
                <div
                  v-if="column.key === 'todo' || column.key === 'in_progress'"
                  class="task-actions"
                >
                  <button
                    v-if="column.key === 'todo'"
                    type="button"
                    :disabled="busyTaskId === task.id"
                    @click="performAction(task, 'start')"
                  >
                    {{ copy.start }}
                  </button>
                  <button
                    v-else
                    type="button"
                    :disabled="busyTaskId === task.id"
                    @click="performAction(task, 'complete')"
                  >
                    {{ copy.complete }}
                  </button>
                </div>
              </div>
              <div v-if="tasksFor(column.key).length === 0" class="empty-column">
                {{ copy.empty }}
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import {
  apiBaseToServerUrl,
  autoEnrollDesktop,
  clearDesktopSync,
  configureDesktopSync,
  completeGoogleDesktopAuth,
  DesktopTeam,
  getDesktopSyncStatus,
  getGoogleDesktopAuthStatus,
  getMyDesktopTeams,
  getSeeSeeYouApiBase,
  getSeeSeeYouToken,
  loginToSeeSeeYou,
  logoutFromSeeSeeYou,
  openGoogleAuthorizationUrl,
  seeSeeYouRequest,
  SeeSeeYouApiError,
  startGoogleDesktopAuth,
} from '~/util/seeseeyou';

interface WorkTask {
  id: number;
  title?: string;
  content?: string;
  description?: string;
  note?: string;
  status: string;
  priority?: string;
  due_date?: string | null;
  team_name?: string | null;
  actual_hours?: number | null;
  is_today_focus?: boolean;
}

interface WorkData {
  date: string;
  employee_name: string;
  focus: WorkTask | null;
  summary: Record<string, number>;
  tasks: Record<string, WorkTask[]>;
  backlog_count?: number;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

const COPY = {
  zh: {
    subtitle: '把今天真正重要的事情放在一个地方',
    workspace: '个人工作台',
    loginTitle: '连接你的 Claritide 账号',
    loginBody: '使用数据只在本机安全处理，My Day 仅同步任务和已授权的工作摘要。',
    featureLocal: '✓ 使用数据在本机安全处理',
    featureTasks: '✓ 团队任务与个人计划统一',
    featureFocus: '✓ 今日重点和执行状态实时同步',
    account: '账号或邮箱',
    password: '密码',
    remember: '在这台电脑保持登录',
    googleSignIn: '使用 Google 账号登录',
    googleWaiting: '请在浏览器完成 Google 登录…',
    orPassword: '或使用账号密码',
    signingIn: '正在连接…',
    signIn: '登录 Claritide',
    loginNote: '首次登录会自动连接这台电脑并同步在线状态，无需设备码。',
    autoSyncing: '正在同步',
    autoSyncActive: '同步已开启',
    autoSyncPending: '准备同步',
    autoSyncFailed: '同步暂时不可用',
    syncWorkspace: '本机同步空间',
    chooseTeam: '选择这台电脑所属的团队',
    chooseTeamBody: '这项选择只用于本机活动同步；团队之间的数据不会混在一起。',
    noActiveTeam: '当前账号没有可用于同步的有效团队。',
    syncAccountMismatch: '本机同步仍绑定另一个账号。请先退出登录，再使用当前账号重新登录。',
    syncTeamUnavailable: '这台电脑原来绑定的团队已不可用，请联系管理员。',
    syncTeamConflict: '这台电脑已绑定其他团队。为保护历史数据，不能直接切换团队。',
    refresh: '刷新',
    logout: '退出',
    todayFocus: '今日重点',
    noFocus: '还没有设置今日重点',
    focusFallback: '专注完成这项工作，Claritide 会记录你的执行状态。',
    noFocusBody: '从下面的任务中选择一项作为今天最重要的工作。',
    due: '截止',
    executionBoard: '执行看板',
    todayTasks: '今天的任务',
    items: '项',
    setFocus: '设为今日重点',
    start: '开始任务',
    complete: '完成任务',
    empty: '这里暂时没有任务',
    hoursPrompt: '请输入实际用时（小时，按 0.25 递增）',
    invalidHours: '请输入 0.25 到 999.99 之间、按 0.25 递增的数字。',
    loginFailed: '暂时无法登录，请稍后重试。',
    googleLoginFailed: 'Google 登录未完成，请重试。',
    googleLoginTimeout: 'Google 登录等待超时，请重新开始。',
    loadFailed: '暂时无法加载 My Day，请稍后重试。',
    actionFailed: '暂时无法更新任务，请稍后重试。',
    networkError: '暂时无法连接服务，请检查网络后重试。',
    invalidCredentials: '账号或密码错误，请重新输入。',
    serviceUnavailable: '服务暂时不可用，请稍后重试。',
    sessionExpired: '登录已过期，请重新登录。',
    goodMorning: '早上好',
    goodAfternoon: '下午好',
    goodEvening: '晚上好',
    todo: '待开始',
    inProgress: '进行中',
    review: '待验收',
    done: '已完成',
    today: '今日任务',
    backlog: '待安排',
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  },
  en: {
    subtitle: 'Keep what matters today in one place',
    workspace: 'Personal workspace',
    loginTitle: 'Connect your Claritide account',
    loginBody:
      'Usage data is processed securely on this computer. My Day only syncs tasks and approved work summaries.',
    featureLocal: '✓ Local activity stays on this computer',
    featureTasks: '✓ Team tasks and personal plans together',
    featureFocus: '✓ Focus and execution status stay in sync',
    account: 'Account or email',
    password: 'Password',
    remember: 'Keep me signed in on this computer',
    googleSignIn: 'Continue with Google',
    googleWaiting: 'Finish signing in with Google in your browser…',
    orPassword: 'or use your account password',
    signingIn: 'Connecting…',
    signIn: 'Sign in to Claritide',
    loginNote:
      'Signing in registers this computer and syncs online status automatically. No device code is required.',
    autoSyncing: 'Syncing',
    autoSyncActive: 'Sync enabled',
    autoSyncPending: 'Preparing sync',
    autoSyncFailed: 'Sync temporarily unavailable',
    syncWorkspace: 'Local sync workspace',
    chooseTeam: 'Choose this computer’s team',
    chooseTeamBody:
      'This selection is only for local activity sync. Data is never mixed between teams.',
    noActiveTeam: 'This account has no active team available for sync.',
    syncAccountMismatch:
      'Local sync is still connected to another account. Sign out, then sign in with this account again.',
    syncTeamUnavailable: 'The team previously connected to this computer is no longer available.',
    syncTeamConflict:
      'This computer is already connected to another team and cannot be switched without a new device identity.',
    refresh: 'Refresh',
    logout: 'Sign out',
    todayFocus: "Today's focus",
    noFocus: 'No focus selected yet',
    focusFallback: 'Stay with this task while Claritide records its execution status.',
    noFocusBody: 'Choose one task below as the most important work for today.',
    due: 'Due',
    executionBoard: 'Execution board',
    todayTasks: "Today's tasks",
    items: 'items',
    setFocus: 'Set as today focus',
    start: 'Start task',
    complete: 'Complete task',
    empty: 'No tasks here',
    hoursPrompt: 'Actual hours (increments of 0.25)',
    invalidHours: 'Enter a number from 0.25 to 999.99 in increments of 0.25.',
    loginFailed: 'Unable to sign in right now. Please try again.',
    googleLoginFailed: 'Google sign-in was not completed. Please try again.',
    googleLoginTimeout: 'Google sign-in timed out. Please start again.',
    loadFailed: 'Unable to load My Day right now. Please try again.',
    actionFailed: 'Unable to update the task right now. Please try again.',
    networkError: 'Unable to reach the service. Check your connection and try again.',
    invalidCredentials: 'The account or password is incorrect.',
    serviceUnavailable: 'The service is temporarily unavailable. Please try again later.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    todo: 'To do',
    inProgress: 'In progress',
    review: 'Review',
    done: 'Done',
    today: 'Today',
    backlog: 'Backlog',
    high: 'High priority',
    medium: 'Medium priority',
    low: 'Low priority',
  },
};

export default {
  name: 'MyDay',
  data() {
    return {
      credentials: { username: '', password: '' },
      rememberLogin: true,
      authenticated: Boolean(getSeeSeeYouToken()),
      syncState: 'pending' as 'pending' | 'connecting' | 'active' | 'error',
      loading: false,
      googleLoading: false,
      googleAuthCancelled: false,
      availableTeams: [] as DesktopTeam[],
      currentEmployeeId: '',
      teamSelectionRequired: false,
      syncError: '',
      error: '',
      busyTaskId: null as number | null,
      workData: null as WorkData | null,
    };
  },
  computed: {
    copy(): typeof COPY.en {
      return String(this.$i18n.locale).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
    },
    greeting(): string {
      const hour = new Date().getHours();
      const greeting =
        hour < 12
          ? this.copy.goodMorning
          : hour < 18
          ? this.copy.goodAfternoon
          : this.copy.goodEvening;
      const name = this.workData?.employee_name || '';
      return name ? `${greeting}，${name}` : greeting;
    },
    formattedDate(): string {
      const value = this.workData?.date || new Date().toISOString().slice(0, 10);
      return new Intl.DateTimeFormat(this.$i18n.locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(`${value}T12:00:00`));
    },
    syncStatusLabel(): string {
      if (this.syncState === 'connecting') return this.copy.autoSyncing;
      if (this.syncState === 'active') return this.copy.autoSyncActive;
      if (this.syncState === 'error') return this.copy.autoSyncFailed;
      return this.copy.autoSyncPending;
    },
    focusTask(): WorkTask | null {
      return this.workData?.focus || null;
    },
    columns(): { key: string; label: string; color: string }[] {
      return [
        { key: 'todo', label: this.copy.todo, color: '#7a8798' },
        { key: 'in_progress', label: this.copy.inProgress, color: '#0d8f83' },
        { key: 'review', label: this.copy.review, color: '#b67814' },
        { key: 'done', label: this.copy.done, color: '#5c6bc0' },
      ];
    },
    summaryCards(): { key: string; label: string; value: number; note: string }[] {
      const summary = this.workData?.summary || {};
      return [
        {
          key: 'today',
          label: this.copy.today,
          value: summary.today || 0,
          note: `${this.workData?.backlog_count || 0} ${this.copy.backlog}`,
        },
        { key: 'todo', label: this.copy.todo, value: summary.todo || 0, note: this.copy.start },
        {
          key: 'in_progress',
          label: this.copy.inProgress,
          value: summary.in_progress || 0,
          note: this.copy.todayFocus,
        },
        {
          key: 'done',
          label: this.copy.done,
          value: summary.done || 0,
          note: summary.review ? `${summary.review} ${this.copy.review}` : this.copy.complete,
        },
      ];
    },
    totalTasks(): number {
      return this.columns.reduce((total, column) => total + this.tasksFor(column.key).length, 0);
    },
  },
  async mounted() {
    if (this.authenticated) {
      await this.loadWork();
      if (this.authenticated) await this.ensureAutomaticSync();
    }
  },
  beforeDestroy() {
    this.googleAuthCancelled = true;
  },
  methods: {
    tasksFor(column: string): WorkTask[] {
      return this.workData?.tasks?.[column] || [];
    },
    priorityLabel(priority?: string): string {
      const value = String(priority || 'medium').toLowerCase();
      return value === 'high' ? this.copy.high : value === 'low' ? this.copy.low : this.copy.medium;
    },
    friendlyError(error: unknown, fallback: string, isLogin = false): string {
      if (!(error instanceof SeeSeeYouApiError)) return fallback;
      if (error.status === 0) return this.copy.networkError;
      if (error.status === 401) {
        return isLogin ? this.copy.invalidCredentials : this.copy.sessionExpired;
      }
      if (error.status >= 500) return this.copy.serviceUnavailable;
      return fallback;
    },
    async login() {
      this.loading = true;
      this.error = '';
      try {
        await loginToSeeSeeYou(
          this.credentials.username,
          this.credentials.password,
          this.rememberLogin
        );
        this.credentials.password = '';
        await this.finishLogin();
      } catch (error) {
        this.error = this.friendlyError(error, this.copy.loginFailed, true);
      } finally {
        this.loading = false;
      }
    },
    async loginWithGoogle() {
      if (this.googleLoading) return;
      this.googleLoading = true;
      this.googleAuthCancelled = false;
      this.error = '';
      try {
        const auth = await startGoogleDesktopAuth();
        await openGoogleAuthorizationUrl(auth.authorization_url);
        const lifetimeSeconds = Math.max(30, Math.min(Number(auth.expires_in) || 600, 600));
        const deadline = Date.now() + lifetimeSeconds * 1000;
        while (!this.googleAuthCancelled && Date.now() < deadline) {
          const authStatus = await getGoogleDesktopAuthStatus(auth.poll_token);
          if (authStatus.status === 'ready') {
            await completeGoogleDesktopAuth(auth.poll_token, this.rememberLogin);
            await this.finishLogin();
            return;
          }
          await wait(1500);
        }
        if (!this.googleAuthCancelled) this.error = this.copy.googleLoginTimeout;
      } catch (error) {
        if (!this.googleAuthCancelled) {
          this.error = this.friendlyError(error, this.copy.googleLoginFailed, true);
        }
      } finally {
        this.googleLoading = false;
      }
    },
    async finishLogin() {
      this.authenticated = true;
      this.syncError = '';
      await this.loadWork();
      if (this.authenticated) await this.ensureAutomaticSync();
    },
    async loadWork() {
      this.loading = true;
      this.error = '';
      try {
        this.workData = await seeSeeYouRequest<WorkData>('/my-work');
      } catch (error) {
        if (error instanceof SeeSeeYouApiError && error.status === 401) {
          logoutFromSeeSeeYou();
          await clearDesktopSync().catch(() => undefined);
          this.authenticated = false;
          this.workData = null;
        }
        this.error = this.friendlyError(error, this.copy.loadFailed);
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      logoutFromSeeSeeYou();
      await clearDesktopSync().catch(() => undefined);
      this.authenticated = false;
      this.workData = null;
      this.error = '';
      this.syncError = '';
      this.syncState = 'pending';
      this.availableTeams = [];
      this.currentEmployeeId = '';
      this.teamSelectionRequired = false;
    },
    selectedTeamId(employeeId: string, teams: DesktopTeam[]): string {
      try {
        const selected = localStorage.getItem(`seeseeyou-desktop-team:${employeeId}`) || '';
        return teams.some(team => team.team_id === selected) ? selected : '';
      } catch (_error) {
        return '';
      }
    },
    rememberTeam(employeeId: string, teamId: string) {
      try {
        localStorage.setItem(`seeseeyou-desktop-team:${employeeId}`, teamId);
      } catch (_error) {
        // Sync remains usable when storage is restricted; the user may need to
        // choose the team again on the next launch.
      }
    },
    syncErrorMessage(error: unknown): string {
      if (!(error instanceof SeeSeeYouApiError)) return this.copy.autoSyncFailed;
      if (error.code === 'no_active_team') return this.copy.noActiveTeam;
      if (error.code === 'device_team_change_forbidden') return this.copy.syncTeamConflict;
      if (error.code === 'team_forbidden' || error.code === 'team_selection_required') {
        return this.copy.chooseTeamBody;
      }
      return this.friendlyError(error, this.copy.autoSyncFailed);
    },
    async selectSyncTeam(team: DesktopTeam) {
      await this.ensureAutomaticSync(team.team_id);
    },
    async ensureAutomaticSync(requestedTeamId = '') {
      this.syncState = 'connecting';
      this.syncError = '';
      try {
        const syncStatus = await getDesktopSyncStatus();
        if (syncStatus === null) {
          this.syncState = 'pending';
          return;
        }
        const teamData = await getMyDesktopTeams();
        this.currentEmployeeId = teamData.employee_id;
        this.availableTeams = teamData.items || [];

        if (syncStatus.configured) {
          if (syncStatus.employee_id && syncStatus.employee_id !== teamData.employee_id) {
            this.syncState = 'error';
            this.syncError = this.copy.syncAccountMismatch;
            return;
          }
          if (
            syncStatus.team_id &&
            !this.availableTeams.some(team => team.team_id === syncStatus.team_id)
          ) {
            this.syncState = 'error';
            this.syncError = this.copy.syncTeamUnavailable;
            return;
          }
          this.syncState = 'active';
          return;
        }

        if (!this.availableTeams.length) {
          this.syncState = 'error';
          this.syncError = this.copy.noActiveTeam;
          return;
        }
        const cachedTeamId = this.selectedTeamId(teamData.employee_id, this.availableTeams);
        const teamId =
          requestedTeamId ||
          (this.availableTeams.length === 1 ? this.availableTeams[0].team_id : cachedTeamId);
        if (!teamId || !this.availableTeams.some(team => team.team_id === teamId)) {
          this.teamSelectionRequired = true;
          this.syncState = 'pending';
          return;
        }

        this.teamSelectionRequired = false;
        const enrollment = await autoEnrollDesktop(teamId);
        const enrolledTeamId = enrollment.device.team_id;
        this.rememberTeam(teamData.employee_id, enrolledTeamId);
        await configureDesktopSync({
          server_url: apiBaseToServerUrl(getSeeSeeYouApiBase()),
          local_api_url: `${window.location.origin.replace(/\/+$/, '')}/api/0`,
          device_id: enrollment.device.device_id,
          employee_id: enrollment.device.employee_id,
          team_id: enrolledTeamId,
          device_key: enrollment.credentials.device_token,
          hmac_secret: enrollment.credentials.hmac_secret,
        });
        this.syncState = 'active';
      } catch (error) {
        this.syncState = 'error';
        this.syncError = this.syncErrorMessage(error);
        console.warn('Unable to configure automatic Claritide sync:', error);
      }
    },
    async refresh() {
      await this.loadWork();
      if (this.authenticated) await this.ensureAutomaticSync();
    },
    async performAction(task: WorkTask, action: 'start' | 'complete' | 'focus') {
      this.busyTaskId = task.id;
      this.error = '';
      try {
        if (action === 'complete') {
          const raw = window.prompt(this.copy.hoursPrompt, '1');
          if (raw === null) return;
          const hours = Number(raw);
          if (
            hours < 0.25 ||
            hours > 999.99 ||
            Math.abs(hours * 4 - Math.round(hours * 4)) > 1e-9
          ) {
            this.error = this.copy.invalidHours;
            return;
          }
          const body = new FormData();
          body.append('actual_hours', String(hours));
          await seeSeeYouRequest(`/work-items/${task.id}/complete`, { method: 'POST', body });
        } else {
          await seeSeeYouRequest(`/work-items/${task.id}/${action}`, { method: 'POST' });
        }
        await this.loadWork();
      } catch (error) {
        this.error = this.friendlyError(error, this.copy.actionFailed);
      } finally {
        this.busyTaskId = null;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.my-day-page {
  --ink: #193536;
  --muted: #6d7d7e;
  --line: #dce9e6;
  --mint: #0d8f83;
  --mint-dark: #08675f;
  color: var(--ink);
  padding: 0 4px 28px;
}
.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 18px 4px 24px;
}
.eyebrow,
.section-kicker {
  display: block;
  color: var(--mint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.hero-panel h2 {
  margin: 5px 0 4px;
  font-size: 30px;
  letter-spacing: -0.03em;
}
.hero-panel p {
  margin: 0;
  color: var(--muted);
}
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid #bde1dc;
  border-radius: 999px;
  background: #effaf7;
  color: var(--mint-dark);
  font-size: 12px;
  font-weight: 700;
}
.connection-pill.offline {
  color: #8a6b32;
  border-color: #ead8b5;
  background: #fff9ee;
}
.sync-pill {
  border-color: #d8ddf6;
  background: #f4f5ff;
  color: #5364ad;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px rgba(13, 143, 131, 0.11);
}
button {
  font-family: inherit;
}
.quiet-button,
.text-button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.quiet-button {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.login-shell {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  min-height: 470px;
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(135deg, #f2fbf8 0%, #fff 56%);
  box-shadow: 0 18px 50px rgba(33, 67, 64, 0.08);
}
.login-copy {
  padding: 70px 60px;
}
.login-copy h3 {
  max-width: 500px;
  margin: 10px 0 16px;
  font-size: 34px;
  letter-spacing: -0.035em;
}
.login-copy p {
  max-width: 560px;
  color: var(--muted);
  line-height: 1.75;
}
.feature-list {
  display: grid;
  gap: 12px;
  margin-top: 28px;
  color: var(--mint-dark);
  font-size: 13px;
  font-weight: 700;
}
.login-card {
  align-self: center;
  display: grid;
  gap: 15px;
  margin: 30px 50px 30px 10px;
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 45px rgba(26, 58, 55, 0.1);
}
.login-card label {
  display: grid;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.google-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  border: 1px solid #cbd8d6;
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.google-button:hover:not(:disabled) {
  border-color: #99b5b1;
  box-shadow: 0 5px 14px rgba(32, 67, 63, 0.08);
  transform: translateY(-1px);
}
.google-button:disabled {
  cursor: wait;
  opacity: 0.66;
}
.google-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #d9e0e7;
  border-radius: 50%;
  color: #4285f4;
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: 800;
}
.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #879492;
  font-size: 11px;
  text-align: center;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e1e8e6;
}
.auth-divider span {
  white-space: nowrap;
}
.login-card .remember-row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--ink);
  cursor: pointer;
}
.login-card .remember-row input {
  width: 16px;
  height: 16px;
  accent-color: var(--mint);
}
.login-card input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #cddbd8;
  border-radius: 8px;
  background: #fbfdfc;
  color: var(--ink);
}
.login-card input:focus {
  outline: none;
  border-color: var(--mint);
  box-shadow: 0 0 0 3px rgba(13, 143, 131, 0.11);
}
.primary-button {
  min-height: 42px;
  border-radius: 8px;
  font-weight: 800;
  cursor: pointer;
}
.primary-button {
  border: 0;
  background: var(--mint);
  color: white;
}
.login-card small {
  color: #8c9998;
  line-height: 1.55;
}
.error-message,
.error-banner {
  color: #a53d3d;
  background: #fff2f2;
  border: 1px solid #f0cece;
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 12px;
}
.error-banner {
  margin: 0 0 14px;
}
.team-picker {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(320px, 1.2fr);
  gap: 28px;
  margin-bottom: 14px;
  padding: 24px;
  border: 1px solid #cfe0dd;
  border-radius: 14px;
  background: linear-gradient(135deg, #f2fbf8, #fff);
  box-shadow: 0 10px 30px rgba(31, 67, 63, 0.06);
}
.team-picker h3 {
  margin: 7px 0 8px;
  font-size: 21px;
}
.team-picker p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}
.team-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.team-options button {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid #cbdad7;
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.team-options button:hover:not(:disabled) {
  border-color: var(--mint);
  box-shadow: 0 5px 16px rgba(13, 143, 131, 0.1);
}
.team-options button span {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.summary-card {
  min-height: 112px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(36, 70, 66, 0.05);
}
.summary-card span,
.summary-card small {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.summary-card strong {
  display: block;
  margin: 5px 0 1px;
  font-size: 30px;
  letter-spacing: -0.04em;
}
.focus-grid {
  margin-bottom: 18px;
}
.focus-card {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
}
.focus-card {
  background: linear-gradient(135deg, #edf9f6 0%, #fff 74%);
  border-color: #cfe8e3;
}
.card-heading,
.board-heading {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}
.card-heading h3,
.board-heading h3 {
  margin: 5px 0 0;
  font-size: 19px;
  line-height: 1.35;
}
.focus-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--mint);
  color: #fff;
  font-size: 24px;
}
.focus-description {
  margin: 16px 0;
  color: var(--muted);
  line-height: 1.6;
}
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.task-meta span {
  padding: 4px 7px;
  border-radius: 6px;
  background: rgba(13, 143, 131, 0.08);
  color: var(--mint-dark);
  font-size: 11px;
  font-weight: 700;
}
.text-button {
  color: var(--mint);
  padding: 3px 0;
}
.board-section {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #f7faf9;
}
.board-count {
  padding: 7px 10px;
  border-radius: 999px;
  background: #e9f2f0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.task-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(190px, 1fr));
  gap: 12px;
  margin-top: 18px;
  overflow-x: auto;
}
.task-column {
  min-width: 0;
}
.task-column > header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 12px;
}
.task-column > header strong {
  color: var(--ink);
}
.task-column > header span:last-child {
  margin-left: auto;
}
.column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.task-list {
  display: grid;
  align-content: start;
  gap: 9px;
}
.task-card {
  padding: 14px;
  border: 1px solid #dce6e4;
  border-radius: 10px;
  background: white;
  box-shadow: 0 5px 15px rgba(42, 72, 69, 0.04);
}
.task-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.priority {
  color: #8b6d32;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.priority.high {
  color: #b2473f;
}
.priority.low {
  color: #71807f;
}
.star-button {
  border: 0;
  background: transparent;
  color: #9aa7a6;
  font-size: 20px;
  cursor: pointer;
}
.focused-star {
  color: #d29a27;
}
.task-card h4 {
  margin: 9px 0 7px;
  font-size: 13px;
  line-height: 1.45;
}
.task-card p {
  margin: 0 0 9px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.task-meta.compact span {
  padding: 3px 6px;
  background: #f1f5f4;
  color: #778584;
  font-size: 10px;
}
.task-actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #edf1f0;
}
.task-actions button {
  width: 100%;
  padding: 7px;
  border: 1px solid #b9ddd8;
  border-radius: 7px;
  background: #eff9f7;
  color: var(--mint-dark);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.empty-column {
  padding: 18px 10px;
  border: 1px dashed #d4dfdc;
  border-radius: 10px;
  color: #95a19f;
  font-size: 11px;
  text-align: center;
}
@media (max-width: 991px) {
  .login-shell {
    grid-template-columns: 1fr;
  }
  .login-copy {
    padding: 40px 34px 12px;
  }
  .login-card {
    margin: 20px 34px 40px;
  }
  .team-picker {
    grid-template-columns: 1fr;
  }
  .task-board {
    grid-template-columns: repeat(4, 250px);
  }
}
@media (max-width: 720px) {
  .hero-panel {
    flex-direction: column;
  }
  .hero-actions {
    justify-content: flex-start;
  }
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .login-copy {
    padding: 34px 22px 8px;
  }
  .login-card {
    margin: 18px 22px 30px;
    padding: 20px;
  }
  .team-options {
    grid-template-columns: 1fr;
  }
}
</style>
