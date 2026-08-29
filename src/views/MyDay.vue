<template>
  <div class="my-day-page">
    <section class="hero-panel">
      <div>
        <div class="eyebrow">SEESEEYOU · MY DAY</div>
        <h2>{{ greeting }}</h2>
        <p>{{ formattedDate }} · {{ copy.subtitle }}</p>
      </div>
      <div class="hero-actions">
        <label v-if="authenticated && teams.length > 1" class="team-picker">
          <span>{{ copy.currentTeam }}</span>
          <select
            v-model="selectedTeamId"
            :disabled="loading || teamLoading || syncState === 'connecting'"
            @change="changeTeam"
          >
            <option disabled value="">{{ copy.chooseTeam }}</option>
            <option v-for="team in teams" :key="team.team_id" :value="team.team_id">
              {{ team.name }}
            </option>
          </select>
        </label>
        <span v-else-if="authenticated && selectedTeam" class="connection-pill team-pill">
          {{ selectedTeam.name }}
        </span>
        <span
          v-if="authenticated"
          class="connection-pill sync-pill"
          :class="{ offline: syncState === 'error' }"
        >
          <span class="status-dot"></span>
          {{ syncStatusLabel }}
        </span>
        <button
          v-if="authenticated"
          class="quiet-button"
          type="button"
          :disabled="loading || teamLoading || syncState === 'connecting'"
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
      <p v-if="error || teamNotice" class="error-banner">{{ error || teamNotice }}</p>

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
  getDesktopSyncBinding,
  getDesktopSyncStatus,
  getSelectedSeeSeeYouTeamId,
  getSeeSeeYouApiBase,
  getSeeSeeYouEnrollmentContext,
  getSeeSeeYouToken,
  loginToSeeSeeYou,
  logoutFromSeeSeeYou,
  resolveSeeSeeYouTeamSelection,
  seeSeeYouRequest,
  SeeSeeYouApiError,
  setSelectedSeeSeeYouTeamId,
  type SeeSeeYouTeam,
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

const COPY = {
  zh: {
    subtitle: '把今天真正重要的事情放在一个地方',
    workspace: '个人工作台',
    loginTitle: '连接你的 SeeSeeYou 账号',
    loginBody: '使用数据只在本机安全处理，My Day 仅同步任务和已授权的工作摘要。',
    featureLocal: '✓ 使用数据在本机安全处理',
    featureTasks: '✓ 团队任务与个人计划统一',
    featureFocus: '✓ 今日重点和执行状态实时同步',
    account: '账号或邮箱',
    password: '密码',
    remember: '在这台电脑保持登录',
    signingIn: '正在连接…',
    signIn: '登录 SeeSeeYou',
    loginNote: '首次登录会自动连接这台电脑并同步在线状态，无需设备码。',
    autoSyncing: '正在同步',
    autoSyncActive: '同步已开启',
    autoSyncPending: '准备同步',
    autoSyncFailed: '同步暂时不可用',
    autoSyncSelectTeam: '请选择团队',
    autoSyncUnavailable: '没有可用团队',
    currentTeam: '数据同步团队',
    chooseTeam: '选择同步团队',
    teamRequired: '请选择数据同步团队；任务仍可查看，活动数据会暂停同步。',
    teamLoadFailed: '暂时无法加载团队，请稍后重试。',
    teamForbidden: '你没有访问该团队的权限，请重新选择。',
    noActiveTeams: '你的账号当前没有可用团队，请联系管理员。',
    employeeInactive: '你的成员账号已停用，请联系管理员。',
    refresh: '刷新',
    logout: '退出',
    todayFocus: '今日重点',
    noFocus: '还没有设置今日重点',
    focusFallback: '专注完成这项工作，SeeSeeYou 会记录你的执行状态。',
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
    loginTitle: 'Connect your SeeSeeYou account',
    loginBody:
      'Usage data is processed securely on this computer. My Day only syncs tasks and approved work summaries.',
    featureLocal: '✓ Local activity stays on this computer',
    featureTasks: '✓ Team tasks and personal plans together',
    featureFocus: '✓ Focus and execution status stay in sync',
    account: 'Account or email',
    password: 'Password',
    remember: 'Keep me signed in on this computer',
    signingIn: 'Connecting…',
    signIn: 'Sign in to SeeSeeYou',
    loginNote:
      'Signing in registers this computer and syncs online status automatically. No device code is required.',
    autoSyncing: 'Syncing',
    autoSyncActive: 'Sync enabled',
    autoSyncPending: 'Preparing sync',
    autoSyncFailed: 'Sync temporarily unavailable',
    autoSyncSelectTeam: 'Select a team',
    autoSyncUnavailable: 'No active team',
    currentTeam: 'Activity sync team',
    chooseTeam: 'Select a sync team',
    teamRequired:
      'Select an activity sync team. Tasks remain available while activity sync is paused.',
    teamLoadFailed: 'Unable to load your teams right now. Please try again.',
    teamForbidden: 'You no longer have access to that team. Select another team.',
    noActiveTeams: 'Your account has no active team. Contact an administrator.',
    employeeInactive: 'Your member account is inactive. Contact an administrator.',
    refresh: 'Refresh',
    logout: 'Sign out',
    todayFocus: "Today's focus",
    noFocus: 'No focus selected yet',
    focusFallback: 'Stay with this task while SeeSeeYou records its execution status.',
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
      syncGeneration: 0,
      syncQueue: Promise.resolve() as Promise<void>,
      loading: false,
      teamLoading: false,
      teamContextLoaded: false,
      error: '',
      teamNotice: '',
      busyTaskId: null as number | null,
      workData: null as WorkData | null,
      teams: [] as SeeSeeYouTeam[],
      employeeId: '',
      selectedTeamId: '',
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
      if (this.teams.length > 1 && !this.selectedTeamId) return this.copy.autoSyncSelectTeam;
      if (this.teamContextLoaded && this.teams.length === 0) {
        return this.copy.autoSyncUnavailable;
      }
      return this.copy.autoSyncPending;
    },
    selectedTeam(): SeeSeeYouTeam | null {
      return this.teams.find(team => team.team_id === this.selectedTeamId) || null;
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
      await this.initializeWorkspace();
    }
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
      if (error.code === 'team_selection_required') return this.copy.teamRequired;
      if (error.code === 'team_forbidden') return this.copy.teamForbidden;
      if (error.code === 'no_active_team') return this.copy.noActiveTeams;
      if (error.code === 'employee_inactive') return this.copy.employeeInactive;
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
        this.authenticated = true;
        this.credentials.password = '';
        await this.initializeWorkspace();
      } catch (error) {
        this.error = this.friendlyError(error, this.copy.loginFailed, true);
      } finally {
        this.loading = false;
      }
    },
    async initializeWorkspace() {
      const contextLoaded = await this.loadTeams();
      if (!contextLoaded) {
        this.workData = null;
        return;
      }
      await Promise.all([this.loadWork(), this.ensureAutomaticSync()]);
    },
    async loadTeams(): Promise<boolean> {
      this.syncGeneration += 1;
      const generation = this.syncGeneration;
      this.teamLoading = true;
      this.teamContextLoaded = false;
      this.error = '';
      this.teamNotice = '';
      try {
        const context = await getSeeSeeYouEnrollmentContext();
        if (generation !== this.syncGeneration || !this.authenticated) return false;
        this.teamContextLoaded = true;
        this.employeeId = context.employee_id;
        this.teams = context.teams;
        const selected = resolveSeeSeeYouTeamSelection(
          this.teams,
          getSelectedSeeSeeYouTeamId(this.employeeId)
        );
        this.selectedTeamId = selected;
        setSelectedSeeSeeYouTeamId(this.employeeId, selected);

        if (this.teams.length === 0) {
          this.teamNotice = this.copy.noActiveTeams;
        } else if (!selected) {
          this.teamNotice = this.copy.teamRequired;
        }
        return true;
      } catch (error) {
        if (generation !== this.syncGeneration) return false;
        if (error instanceof SeeSeeYouApiError && error.status === 401) {
          logoutFromSeeSeeYou();
          this.authenticated = false;
        }
        this.teams = [];
        this.employeeId = '';
        this.selectedTeamId = '';
        this.error = this.friendlyError(error, this.copy.teamLoadFailed);
        return false;
      } finally {
        if (generation === this.syncGeneration) this.teamLoading = false;
      }
    },
    async loadWork() {
      const generation = this.syncGeneration;
      const employeeId = this.employeeId;
      const teamId = this.selectedTeamId;
      this.loading = true;
      this.error = '';
      try {
        const headers = teamId ? { 'X-Team-ID': teamId } : {};
        const workData = await seeSeeYouRequest<WorkData>('/my-work', {
          headers,
        });
        if (!this.authenticated || !this.syncOperationIsCurrent(generation, employeeId, teamId)) {
          return;
        }
        this.workData = workData;
      } catch (error) {
        if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
        if (error instanceof SeeSeeYouApiError && error.status === 401) {
          logoutFromSeeSeeYou();
          this.authenticated = false;
          this.workData = null;
        }
        this.error = this.friendlyError(error, this.copy.loadFailed);
      } finally {
        if (this.syncOperationIsCurrent(generation, employeeId, teamId)) this.loading = false;
      }
    },
    async logout() {
      logoutFromSeeSeeYou();
      this.syncGeneration += 1;
      this.authenticated = false;
      this.workData = null;
      this.teams = [];
      this.employeeId = '';
      this.selectedTeamId = '';
      this.error = '';
      this.teamNotice = '';
      this.teamContextLoaded = false;
      this.loading = false;
      this.teamLoading = false;
      this.syncState = 'pending';
      const cleanup = this.syncQueue.then(() => clearDesktopSync());
      this.syncQueue = cleanup.catch(error => {
        console.warn('Unable to clear automatic SeeSeeYou sync:', error);
      });
      await this.syncQueue;
    },
    async ensureAutomaticSync() {
      const generation = this.syncGeneration;
      const employeeId = this.employeeId;
      const teamId = this.selectedTeamId;
      const operation = this.syncQueue.then(() =>
        this.runAutomaticSync(generation, employeeId, teamId)
      );
      this.syncQueue = operation.catch(() => undefined);
      await operation;
    },
    syncOperationIsCurrent(generation: number, employeeId: string, teamId: string): boolean {
      return (
        generation === this.syncGeneration &&
        employeeId === this.employeeId &&
        teamId === this.selectedTeamId
      );
    },
    async runAutomaticSync(generation: number, employeeId: string, teamId: string) {
      if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
      this.syncState = 'connecting';
      try {
        const configured = await getDesktopSyncStatus();
        if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
        if (configured === null) {
          this.syncState = 'pending';
          return;
        }
        if (!this.authenticated || !employeeId || !teamId) {
          if (configured) {
            await clearDesktopSync();
            if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
          }
          this.syncState = 'pending';
          return;
        }
        const binding = configured ? await getDesktopSyncBinding() : null;
        if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
        const bindingMatches = binding?.employee_id === employeeId && binding?.team_id === teamId;
        if (!configured || !bindingMatches) {
          if (configured) {
            await clearDesktopSync();
            if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
          }
          const enrollment = await autoEnrollDesktop(teamId);
          if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
          if (
            enrollment.device.employee_id !== employeeId ||
            enrollment.device.team_id !== teamId
          ) {
            throw new SeeSeeYouApiError('Desktop enrollment returned a different binding.', 409);
          }
          const saved = await configureDesktopSync({
            server_url: apiBaseToServerUrl(getSeeSeeYouApiBase()),
            local_api_url: `${window.location.origin.replace(/\/+$/, '')}/api/0`,
            device_id: enrollment.device.device_id,
            employee_id: enrollment.device.employee_id,
            team_id: enrollment.device.team_id,
            device_key: enrollment.credentials.device_token,
            hmac_secret: enrollment.credentials.hmac_secret,
          });
          if (!saved) throw new SeeSeeYouApiError('Desktop sync is unavailable.');
          if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
        }
        this.syncState = 'active';
      } catch (error) {
        if (!this.syncOperationIsCurrent(generation, employeeId, teamId)) return;
        this.syncState = 'error';
        if (!this.error) this.error = this.friendlyError(error, this.copy.autoSyncFailed);
        console.warn('Unable to configure automatic SeeSeeYou sync:', error);
      }
    },
    async changeTeam() {
      this.syncGeneration += 1;
      if (!this.teams.some(team => team.team_id === this.selectedTeamId)) {
        this.selectedTeamId = '';
        setSelectedSeeSeeYouTeamId(this.employeeId, '');
        this.teamNotice = this.copy.teamRequired;
        this.syncState = 'pending';
        await this.ensureAutomaticSync();
        return;
      }
      setSelectedSeeSeeYouTeamId(this.employeeId, this.selectedTeamId);
      this.error = '';
      this.teamNotice = '';
      this.workData = null;
      await Promise.all([this.loadWork(), this.ensureAutomaticSync()]);
    },
    async refresh() {
      await this.initializeWorkspace();
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
.team-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 8px 0 11px;
  border: 1px solid #bde1dc;
  border-radius: 9px;
  background: #effaf7;
  color: var(--mint-dark);
  font-size: 11px;
  font-weight: 700;
}
.team-picker select {
  max-width: 190px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
.team-picker select:focus {
  outline: 2px solid rgba(13, 143, 131, 0.18);
  outline-offset: 1px;
}
.team-picker select:disabled {
  cursor: wait;
  opacity: 0.65;
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
.team-pill {
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.quiet-button:disabled {
  cursor: wait;
  opacity: 0.6;
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
}
</style>
