<template>
  <div class="my-day-page">
    <section class="hero-panel">
      <div>
        <div class="eyebrow">SEESEEYOU · MY DAY</div>
        <h2>{{ greeting }}</h2>
        <p>{{ formattedDate }} · {{ copy.subtitle }}</p>
      </div>
      <div class="hero-actions">
        <span class="connection-pill" :class="{ offline: !localStatus.connected }">
          <span class="status-dot"></span>
          {{ localStatusLabel }}
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
        <button v-if="authenticated || demoMode" class="quiet-button" type="button" @click="logout">
          {{ copy.logout }}
        </button>
      </div>
    </section>

    <section v-if="!authenticated && !demoMode" class="login-shell">
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
        <label>
          <span>{{ copy.server }}</span>
          <input v-model.trim="apiBase" type="url" required />
        </label>
        <p v-if="error" class="error-message">{{ error }}</p>
        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? copy.signingIn : copy.signIn }}
        </button>
        <button class="preview-button" type="button" @click="showPreview">
          {{ copy.preview }}
        </button>
        <small>{{ copy.prototypeNote }}</small>
      </form>
    </section>

    <template v-else>
      <p v-if="error" class="error-banner">{{ error }}</p>

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

        <article class="local-card">
          <div class="card-heading">
            <div>
              <span class="section-kicker">ACTIVITYWATCH · LOCAL</span>
              <h3>{{ copy.localOverview }}</h3>
            </div>
            <button class="text-button" type="button" @click="openActivity">
              {{ copy.openActivity }}
            </button>
          </div>
          <div class="local-metrics">
            <div>
              <strong>{{ localStatus.hosts }}</strong
              ><span>{{ copy.devices }}</span>
            </div>
            <div>
              <strong>{{ localStatus.windowBuckets }}</strong
              ><span>{{ copy.appSources }}</span>
            </div>
            <div>
              <strong>{{ localStatus.browserBuckets }}</strong
              ><span>{{ copy.browserSources }}</span>
            </div>
          </div>
          <p>{{ localStatus.connected ? copy.localSafe : copy.localOffline }}</p>
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

      <div v-if="demoMode" class="demo-notice">{{ copy.demoNotice }}</div>
    </template>
  </div>
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { useServerStore } from '~/stores/server';
import {
  getSeeSeeYouApiBase,
  getSeeSeeYouToken,
  loginToSeeSeeYou,
  logoutFromSeeSeeYou,
  seeSeeYouRequest,
  setSeeSeeYouApiBase,
  SeeSeeYouApiError,
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

const DEMO_DATA: WorkData = {
  date: new Date().toISOString().slice(0, 10),
  employee_name: 'Shuai',
  focus: {
    id: 101,
    title: '完成 My Day 与 ActivityWatch 的第一版融合',
    description: '打通本地活动数据、个人任务与桌面端工作入口。',
    status: 'IN_PROGRESS',
    priority: 'high',
    team_name: 'SeeSeeYou',
    due_date: new Date().toISOString().slice(0, 10),
    is_today_focus: true,
  },
  summary: { today: 6, todo: 2, in_progress: 2, review: 1, done: 1 },
  tasks: {
    todo: [
      {
        id: 102,
        title: '确认桌面端导航与信息层级',
        status: 'TODO',
        priority: 'high',
        team_name: 'Product',
      },
      {
        id: 103,
        title: '整理 Windows 安装验证清单',
        status: 'TODO',
        priority: 'medium',
        team_name: 'Release',
      },
    ],
    in_progress: [
      {
        id: 101,
        title: '完成 My Day 与 ActivityWatch 的第一版融合',
        description: '打通本地活动数据、个人任务与桌面端工作入口。',
        status: 'IN_PROGRESS',
        priority: 'high',
        team_name: 'SeeSeeYou',
        is_today_focus: true,
      },
      {
        id: 104,
        title: '校对本地采集状态',
        status: 'IN_PROGRESS',
        priority: 'medium',
        team_name: 'Agent',
      },
    ],
    review: [
      {
        id: 105,
        title: 'Agent/MCP 冒烟测试',
        status: 'AWAITING_REVIEW',
        priority: 'medium',
        team_name: 'Agent',
      },
    ],
    done: [
      {
        id: 106,
        title: '梳理 ActivityWatch 架构',
        status: 'DONE',
        priority: 'low',
        actual_hours: 1.5,
      },
    ],
  },
  backlog_count: 4,
};

const COPY = {
  zh: {
    subtitle: '把今天真正重要的事情放在一个地方',
    workspace: '个人工作台',
    loginTitle: '连接你的 SeeSeeYou 账号',
    loginBody: 'ActivityWatch 保留本地隐私数据，My Day 只同步任务、状态和已授权的工作摘要。',
    featureLocal: '✓ 本地活动数据仍留在电脑',
    featureTasks: '✓ 团队任务与个人计划统一',
    featureFocus: '✓ 今日重点和执行状态实时同步',
    account: '账号或邮箱',
    password: '密码',
    server: 'SeeSeeYou 服务地址',
    signingIn: '正在连接…',
    signIn: '登录并打开 My Day',
    preview: '先看融合效果',
    prototypeNote: '当前为界面原型；正式打包时登录凭证将迁移到系统安全存储。',
    refresh: '刷新',
    logout: '退出',
    todayFocus: '今日重点',
    noFocus: '还没有设置今日重点',
    focusFallback: '专注完成这项工作，ActivityWatch 会在本机记录投入过程。',
    noFocusBody: '从下面的任务中选择一项作为今天最重要的工作。',
    due: '截止',
    localOverview: '本机活动概览',
    openActivity: '查看详细活动',
    devices: '设备',
    appSources: '应用数据源',
    browserSources: '浏览器数据源',
    localSafe: '活动详情直接来自本机 ActivityWatch，不需要先上传到云端。',
    localOffline: '暂时没有连接到本地 ActivityWatch Server，任务功能仍可单独使用。',
    executionBoard: '执行看板',
    todayTasks: '今天的任务',
    items: '项',
    setFocus: '设为今日重点',
    start: '开始任务',
    complete: '完成任务',
    empty: '这里暂时没有任务',
    previewName: '预览用户',
    demoNotice: '你正在查看示例数据。登录 SeeSeeYou 后会替换为真实任务。',
    hoursPrompt: '请输入实际用时（小时，按 0.25 递增）',
    invalidHours: '请输入 0.25 到 999.99 之间、按 0.25 递增的数字。',
    loginFailed: '登录失败，请检查账号、服务地址或网络。',
    loadFailed: 'My Day 数据加载失败。',
    actionFailed: '任务状态更新失败。',
    localConnected: '本机采集中',
    localDisconnected: '本机采集未连接',
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
      'ActivityWatch keeps private activity local while My Day syncs tasks, status, and approved work summaries.',
    featureLocal: '✓ Local activity stays on this computer',
    featureTasks: '✓ Team tasks and personal plans together',
    featureFocus: '✓ Focus and execution status stay in sync',
    account: 'Account or email',
    password: 'Password',
    server: 'SeeSeeYou server',
    signingIn: 'Connecting…',
    signIn: 'Sign in to My Day',
    preview: 'Preview the integration',
    prototypeNote:
      'This is a UI prototype. The packaged app will move credentials to secure OS storage.',
    refresh: 'Refresh',
    logout: 'Sign out',
    todayFocus: "Today's focus",
    noFocus: 'No focus selected yet',
    focusFallback: 'Stay with this task while ActivityWatch records the work locally.',
    noFocusBody: 'Choose one task below as the most important work for today.',
    due: 'Due',
    localOverview: 'Local activity overview',
    openActivity: 'Open activity',
    devices: 'Devices',
    appSources: 'App sources',
    browserSources: 'Browser sources',
    localSafe:
      'Activity details come directly from local ActivityWatch and do not need to be uploaded first.',
    localOffline:
      'Local ActivityWatch Server is unavailable. Cloud tasks can still work independently.',
    executionBoard: 'Execution board',
    todayTasks: "Today's tasks",
    items: 'items',
    setFocus: 'Set as today focus',
    start: 'Start task',
    complete: 'Complete task',
    empty: 'No tasks here',
    previewName: 'Preview user',
    demoNotice: 'You are viewing sample data. Sign in to replace it with your actual tasks.',
    hoursPrompt: 'Actual hours (increments of 0.25)',
    invalidHours: 'Enter a number from 0.25 to 999.99 in increments of 0.25.',
    loginFailed: 'Sign-in failed. Check the account, server address, or network.',
    loadFailed: 'Unable to load My Day.',
    actionFailed: 'Unable to update this task.',
    localConnected: 'Local tracking active',
    localDisconnected: 'Local tracking offline',
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
      apiBase: getSeeSeeYouApiBase(),
      credentials: { username: '', password: '' },
      authenticated: Boolean(getSeeSeeYouToken()),
      demoMode: false,
      loading: false,
      error: '',
      busyTaskId: null as number | null,
      workData: null as WorkData | null,
      localStatus: {
        connected: false,
        hosts: 0,
        windowBuckets: 0,
        browserBuckets: 0,
        hostname: '',
      },
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
      const name = this.workData?.employee_name || (this.demoMode ? this.copy.previewName : '');
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
    localStatusLabel(): string {
      return this.localStatus.connected ? this.copy.localConnected : this.copy.localDisconnected;
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
    await this.loadLocalStatus();
    if (this.authenticated) await this.loadWork();
  },
  methods: {
    tasksFor(column: string): WorkTask[] {
      return this.workData?.tasks?.[column] || [];
    },
    priorityLabel(priority?: string): string {
      const value = String(priority || 'medium').toLowerCase();
      return value === 'high' ? this.copy.high : value === 'low' ? this.copy.low : this.copy.medium;
    },
    async loadLocalStatus() {
      try {
        const bucketsStore = useBucketsStore();
        await bucketsStore.ensureLoaded();
        const buckets = bucketsStore.buckets || [];
        const hosts = new Set(buckets.map(bucket => bucket.hostname).filter(Boolean));
        const serverStore = useServerStore();
        this.localStatus = {
          connected: buckets.length > 0,
          hosts: hosts.size,
          windowBuckets: buckets.filter(bucket => bucket.type === 'currentwindow').length,
          browserBuckets: buckets.filter(bucket => bucket.type === 'web.tab.current').length,
          hostname: serverStore.info?.hostname || Array.from(hosts)[0] || '',
        };
      } catch {
        this.localStatus.connected = false;
      }
    },
    async login() {
      this.loading = true;
      this.error = '';
      setSeeSeeYouApiBase(this.apiBase);
      try {
        await loginToSeeSeeYou(this.credentials.username, this.credentials.password);
        this.authenticated = true;
        this.credentials.password = '';
        await this.loadWork();
      } catch (error) {
        this.error =
          error instanceof Error && error.message ? error.message : this.copy.loginFailed;
      } finally {
        this.loading = false;
      }
    },
    async loadWork() {
      this.loading = true;
      this.error = '';
      try {
        this.workData = await seeSeeYouRequest<WorkData>('/my-work');
      } catch (error) {
        if (error instanceof SeeSeeYouApiError && error.status === 401) {
          logoutFromSeeSeeYou();
          this.authenticated = false;
          this.workData = null;
        }
        this.error = error instanceof Error && error.message ? error.message : this.copy.loadFailed;
      } finally {
        this.loading = false;
      }
    },
    showPreview() {
      this.demoMode = true;
      this.workData = JSON.parse(JSON.stringify(DEMO_DATA));
    },
    logout() {
      logoutFromSeeSeeYou();
      this.authenticated = false;
      this.demoMode = false;
      this.workData = null;
      this.error = '';
    },
    async refresh() {
      await Promise.all([
        this.loadLocalStatus(),
        this.demoMode ? Promise.resolve() : this.loadWork(),
      ]);
    },
    openActivity() {
      if (this.localStatus.hostname) this.$router.push(`/activity/${this.localStatus.hostname}`);
      else this.$router.push('/timeline');
    },
    async performAction(task: WorkTask, action: 'start' | 'complete' | 'focus') {
      this.busyTaskId = task.id;
      this.error = '';
      try {
        if (this.demoMode) {
          this.applyDemoAction(task, action);
          return;
        }
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
        this.error =
          error instanceof Error && error.message ? error.message : this.copy.actionFailed;
      } finally {
        this.busyTaskId = null;
      }
    },
    applyDemoAction(task: WorkTask, action: 'start' | 'complete' | 'focus') {
      if (!this.workData) return;
      if (action === 'focus') {
        const taskLists = Object.values(this.workData.tasks) as WorkTask[][];
        for (const list of taskLists) {
          for (const item of list) item.is_today_focus = item.id === task.id;
        }
        task.is_today_focus = true;
        this.workData.focus = task;
        return;
      }
      const from = action === 'start' ? 'todo' : 'in_progress';
      const to =
        action === 'start'
          ? 'in_progress'
          : task.status === 'IN_PROGRESS' && task.team_name
          ? 'review'
          : 'done';
      this.workData.tasks[from] = this.workData.tasks[from].filter(item => item.id !== task.id);
      task.status =
        to === 'in_progress' ? 'IN_PROGRESS' : to === 'review' ? 'AWAITING_REVIEW' : 'DONE';
      this.workData.tasks[to].push(task);
      this.workData.summary[from] = this.workData.tasks[from].length;
      this.workData.summary[to] = this.workData.tasks[to].length;
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
.primary-button,
.preview-button {
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
.preview-button {
  border: 1px solid var(--line);
  background: white;
  color: var(--ink);
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
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 14px;
  margin-bottom: 18px;
}
.focus-card,
.local-card {
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
.local-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 19px 0 14px;
}
.local-metrics div {
  padding: 12px 8px;
  border-radius: 9px;
  background: #f4f7f6;
  text-align: center;
}
.local-metrics strong,
.local-metrics span {
  display: block;
}
.local-metrics strong {
  font-size: 22px;
}
.local-metrics span {
  color: var(--muted);
  font-size: 10px;
}
.local-card p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
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
.demo-notice {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e8;
  color: #846a35;
  font-size: 12px;
  text-align: center;
}
@media (max-width: 991px) {
  .login-shell,
  .focus-grid {
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
