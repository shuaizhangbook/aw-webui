const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const html = fs.readFileSync(process.env.CLARITIDE_AGENT_HTML_PATH || path.join(__dirname, '../workbench/agent-workbench.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const plain = value => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const nodes = new Map(), calls = [], drawn = [], toasts = [], approvals = [], saved = [];
  function node() {
    return { value: '', _text: '', hidden: false, disabled: false, style: {}, children: [], listeners: {},
      get textContent() { return this._text; },
      set textContent(value) { this._text = value; this.children.forEach(child => { child.parentNode = null; }); this.children = []; },
      attributes: {}, classList: { add() {}, remove() {}, toggle() {} },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      addEventListener(kind, callback) { this.listeners[kind] = callback; }, setAttribute(key, value) { this.attributes[key] = String(value); }, removeAttribute(key) { delete this.attributes[key]; }, focus() {},
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
      querySelectorAll(selector) {
        const matches = child => selector[0] === '#' ? child.id === selector.slice(1) : String(child.className || '').split(/\s+/).includes(selector.slice(1));
        return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    };
  }
  let streamingBody = null;
  const document = {
    documentElement: {},
    querySelector(selector) {
      if (selector === '#conversationInner .message.agent:last-of-type .message-body') return streamingBody;
      if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector);
    }, querySelectorAll(selector) { return selector === '#modelSelect .model-option' ? this.querySelector('#modelSelect').children : []; }, addEventListener() {}, createElement: node,
    getElementById(id) { for (const item of nodes.values()) { const found = item.querySelector('#' + id); if (found) return found; } return null; },
  };
  const storage = new Map();
  const context = {
    document, TextEncoder, URLSearchParams, crypto: { randomUUID }, calls, drawn, toasts, approvals, saved,
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame() {},
    window: { location: { search: '?locale=en' }, addEventListener() {}, setTimeout(callback) { callback(); },
      __CLARITIDE_CCB__: {
        async listSessions() { if (options.listSessions) return options.listSessions(); return []; },
        async startSession(request) { calls.push(['start', request]); if (options.start) return options.start(request); return { model: request.model }; },
        async send(request) { calls.push(['send', request]); if (options.send) return options.send(request); },
        async close(request) { calls.push(['close', request]); if (options.close) return options.close(request); },
        async stop(request) { calls.push(['stop', request]); },
        async respondToApproval(request) { calls.push(['approval', request]); return options.respondToApproval(request); },
      },
    },
    drawMessage(role, text, time, persist, attachments) {
      const body = node(); body.textContent = text;
      drawn.push({ role, text }); if (role === 'agent') streamingBody = body;
      if (persist) context.window.testApi.activeSession().messages.push({ role, text, time, attachments });
      return body;
    },
  };
  vm.runInNewContext(script.replace('void init();', `
    renderProjects = renderAttachments = renderActivity = scrollConversation = removeRunIndicator = function () {};
    appendRunIndicator = updateRunIndicator = function (text) { drawn.push({ indicator: text }); };
    appendMessage = drawMessage;
    renderAnswer = function (body, text) { body._streaming = false; body.textContent = text; drawn.push({ final: text }); };
    appendResultCard = function (result) { drawn.push({ result: result }); };
    appendErrorCard = function (message) { drawn.push({ error: message }); };
    ${options.realApproval ? '' : 'renderApproval = function (approval) { approvals.push(approval.requestId); };'}
    showToast = function (text) { toasts.push(text); };
    save = function () { saved.push(currentEffort()); }; 
    window.testApi = { state, activeSession, send, stop, selectProject, selectSession, continueViewedSession, returnToRunningSession,
      handleEvent, runningSession, browsingHistory, historyProjects, syncControls, renderConversation, resetRunningView,
      bind, setEffort, allowedEffortLevels, requestEffort, unavailableSelectedEffort, beginEffortGesture, onEffortInput, toggleControlPopover, errorSummary };
  `), context);
  const api = context.window.testApi;
  const session = (id, time) => ({ id, name: id, model: 'gpt-test', effort: 'high', permission: 'controlled', messages: [], events: [], updatedAt: time });
  const a = session('chat-a', 100), b = session('chat-b', 300), c = session('chat-c', 200);
  api.state.projects = [
    { id: 'project-a', name: 'Alpha', path: '/a', nativeWorkspace: { id: 'workspace-a', path: '/a' }, sessions: [a, b] },
    { id: 'project-b', name: 'Beta', path: '/b', nativeWorkspace: { id: 'workspace-b', path: '/b' }, sessions: [c] },
  ];
  Object.assign(api.state, { activeProjectId: 'project-a', activeSessionId: 'chat-a', storageReady: true, accountScope: 'account-a', storageEpoch: 1,
    status: { available: true, allowedModels: ['gpt-test'], capabilities: { effort: true }, allowedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'], maxMessageBytes: 65536 } });
  function running() {
    Object.assign(api.state, { nativeSessionId: 'native-a', runningProjectId: 'project-a', runningSessionId: 'chat-a', runStorageEpoch: 1, turnActive: true });
  }
  api.bind(); api.syncControls();
  return { ...api, a, b, c, running, calls, drawn, approvals, toasts, saved, byId: id => document.getElementById(id), element: selector => document.querySelector(selector), prompt: document.querySelector('#prompt') };
}

test('authorized subsets define the actual slider indexes, reject unavailable setters, and reach native startup unchanged', async () => {
  const h = harness();
  h.state.status.allowedEfforts = ['max', 'low', 'low', 'future-level'];
  h.a.effort = 'low'; h.syncControls();
  const range = h.element('#effortRange');
  assert.deepEqual(Array.from(h.allowedEffortLevels()), ['low', 'max']);
  assert.equal(range.max, '1'); assert.equal(range.disabled, false); assert.equal(range.hidden, false);
  h.setEffort('medium'); assert.equal(h.a.effort, 'low'); assert.equal(h.saved.length, 0);
  range.listeners.pointerdown(); range.value = '1'; range.listeners.input({ target: range }); range.listeners.pointerup();
  assert.equal(h.a.effort, 'max'); assert.equal(h.saved.at(-1), 'max');
  assert.equal(range.attributes['aria-valuetext'], 'Maximum');
  h.prompt.value = 'Run with my selection'; await h.send();
  assert.equal(h.calls.find(([kind]) => kind === 'start')[1].effort, 'max');
  assert.equal(h.calls.filter(([kind]) => kind === 'send').length, 1);
});

test('service availability disables the control with a reason and restores dragging when ready', () => {
  const h = harness(); h.state.status.available = false; h.syncControls();
  const range = h.element('#effortRange');
  assert.equal(range.disabled, true);
  assert.equal(h.element('#modelEffortButton').disabled, false, 'the explanation remains reachable');
  assert.match(h.element('#effortNote').textContent, /authorization or the service is unavailable/);
  h.setEffort('low'); assert.equal(h.a.effort, 'high');
  h.state.status.available = true; h.syncControls();
  assert.equal(range.disabled, false); assert.match(h.element('#effortNote').textContent, /Drag/);
  range.value = '0'; range.listeners.input({ target: range }); assert.equal(h.a.effort, 'low');
});

test('missing or empty capabilities expose the service default without a dead slider or applied saved value', async () => {
  for (const variant of ['missing', 'disabled', 'empty', 'unknown']) {
    const h = harness(); h.a.effort = 'max';
    if (variant === 'missing') delete h.state.status.capabilities;
    if (variant === 'disabled') h.state.status.capabilities.effort = false;
    if (variant === 'empty') h.state.status.allowedEfforts = [];
    if (variant === 'unknown') h.state.status.allowedEfforts = ['future-only'];
    h.syncControls();
    assert.equal(h.element('#effortRange').hidden, true); assert.equal(h.element('#effortRange').disabled, true);
    assert.equal(h.element('#effortValue').textContent, 'Service default');
    assert.match(h.element('#effortNote').textContent, /not enabled.*not applied/);
    assert.equal(h.unavailableSelectedEffort(), false); assert.equal(h.requestEffort(), undefined);
    h.prompt.value = 'Use service defaults'; await h.send();
    assert.equal(h.a.effort, 'max', 'persisted choice is never silently rewritten');
    assert.equal(h.calls.find(([kind]) => kind === 'start')[1].effort, undefined);
  }
});

test('a single authorized level is shown as fixed instead of a draggable control', () => {
  const h = harness(); h.state.status.allowedEfforts = ['high']; h.syncControls();
  assert.equal(h.element('#effortRange').hidden, true); assert.equal(h.element('#effortRange').disabled, true);
  assert.equal(h.element('#effortValue').textContent, 'Deep'); assert.match(h.element('#effortNote').textContent, /only this fixed level/);
  assert.equal(h.element('#useAvailableEffort').hidden, true);
});

test('an expired saved depth retains the draft and blocks sending until explicit selection of an available level', async () => {
  const h = harness(); h.a.effort = 'max'; h.state.status.allowedEfforts = ['low', 'medium']; h.syncControls();
  const recover = h.element('#useAvailableEffort');
  assert.equal(recover.hidden, false); assert.equal(recover.disabled, false);
  assert.match(h.element('#effortValue').textContent, /Maximum.*unavailable/);
  assert.equal(h.element('#effortRange').hidden, true, 'no apparent fallback selection');
  h.prompt.value = 'Keep my request'; await h.send();
  assert.equal(h.calls.length, 0); assert.equal(h.a.effort, 'max'); assert.equal(h.prompt.value, 'Keep my request');
  assert.match(h.toasts.at(-1), /saved thinking depth/);
  recover.onclick(); assert.equal(h.a.effort, 'low'); assert.equal(h.saved.at(-1), 'low');
  await h.send(); assert.equal(h.calls.find(([kind]) => kind === 'start')[1].effort, 'low');
});

test('native and busy sessions keep their settings locked while the popover explains starting a new chat', () => {
  for (const flag of ['nativeSessionId', 'turnActive', 'starting', 'pendingSend']) {
    const h = harness(); h.state[flag] = flag === 'nativeSessionId' ? 'native-a' : true; h.syncControls();
    assert.equal(h.element('#modelEffortButton').disabled, false);
    assert.equal(h.element('#effortRange').disabled, true);
    assert.match(h.element('#effortNote').textContent, /settings are locked.*new chat/);
    assert.ok(h.element('#modelSelect').children.every(option => option.disabled));
    h.element('#modelEffortPopover').hidden = true;
    h.element('#modelEffortButton').listeners.click(); assert.equal(h.element('#modelEffortPopover').hidden, false);
    h.setEffort('low'); assert.equal(h.a.effort, 'high'); assert.equal(h.calls.length, 0);
  }
});

test('gestures and recovery actions captured before account, chat, or capability changes cannot mutate new settings', () => {
  for (const change of ['account', 'chat', 'capabilities']) {
    const h = harness(); const range = h.element('#effortRange');
    range.listeners.pointerdown();
    if (change === 'account') h.state.storageEpoch += 1;
    if (change === 'chat') h.state.activeSessionId = 'chat-b';
    if (change === 'capabilities') h.state.status.allowedEfforts = ['low', 'high'];
    h.syncControls(); range.value = '0'; range.listeners.input({ target: range });
    assert.equal(h.a.effort, 'high'); assert.equal(h.b.effort, 'high'); assert.equal(h.saved.length, 0);
  }
  const h = harness(); h.a.effort = 'max'; h.state.status.allowedEfforts = ['low']; h.syncControls();
  const staleRecovery = h.element('#useAvailableEffort').onclick;
  h.state.activeSessionId = 'chat-b'; h.syncControls(); staleRecovery();
  assert.equal(h.a.effort, 'max'); assert.equal(h.b.effort, 'high');
});

test('capabilities changing while native startup awaits session discovery block the stale request', async () => {
  let release; const h = harness({ listSessions: () => new Promise(resolve => { release = resolve; }) });
  h.a.effort = 'max'; h.prompt.value = 'Keep this draft'; const sending = h.send();
  for (let attempt = 0; attempt < 12 && !release; attempt += 1) await Promise.resolve();
  assert.ok(release); h.state.status.allowedEfforts = ['low', 'high']; release([]); await sending;
  assert.equal(h.calls.length, 0); assert.equal(h.prompt.value, 'Keep this draft'); assert.equal(h.a.effort, 'max');
  assert.match(h.drawn.find(item => item.error).error, /saved thinking depth/);
});

test('service defaults do not restart an already running native session because of an unapplied saved depth', async () => {
  const h = harness({ listSessions: async () => [{ sessionId: 'runtime-a', phase: 'running', permission: 'controlled', model: 'gpt-test', effort: 'high', workspaceId: 'workspace-a' }] });
  delete h.state.status.capabilities; h.a.effort = 'low'; h.a.runtimeSessionId = 'runtime-a'; h.state.nativeSessionId = 'runtime-a';
  h.prompt.value = 'Continue'; await h.send();
  assert.deepEqual(h.calls.map(([kind]) => kind), ['send']); assert.equal(h.calls[0][1].sessionId, 'runtime-a');
});

test('a depth revoked during native start cannot send and leaves the accepted child available for explicit recovery', async () => {
  let release; const h = harness({ start: () => new Promise(resolve => { release = resolve; }) });
  h.a.effort = 'max'; h.prompt.value = 'Keep this draft'; const sending = h.send();
  for (let attempt = 0; attempt < 12 && !release; attempt += 1) await Promise.resolve();
  assert.ok(release); h.state.status.allowedEfforts = ['low', 'high']; release({ model: 'gpt-test' }); await sending;
  assert.deepEqual(h.calls.map(([kind]) => kind), ['start']); assert.ok(h.state.nativeSessionId);
  assert.equal(h.prompt.value, 'Keep this draft'); assert.equal(h.a.effort, 'max');
  assert.match(h.element('#effortNote').textContent, /settings are locked.*new chat/);
});

test('native effort rejection is summarized clearly', () => {
  const h = harness(); assert.match(h.errorSummary('AI_EFFORT_UNAVAILABLE', 'Selected effort is not allowed'), /saved thinking depth is unavailable/);
});
