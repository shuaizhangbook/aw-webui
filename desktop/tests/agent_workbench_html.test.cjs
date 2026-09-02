const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const htmlPath = process.env.CLARITIDE_AGENT_HTML_PATH;
if (!htmlPath) {
  throw new Error('CLARITIDE_AGENT_HTML_PATH must point to agent-workbench.html');
}

const html = fs.readFileSync(htmlPath, 'utf8');
const inlineScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];

function makeElement(id) {
  return {
    id,
    disabled: false,
    textContent: '',
    value: '',
    title: '',
    className: '',
    childNodes: [],
    firstChild: null,
    scrollHeight: 0,
    scrollTop: 0,
    handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    appendChild(child) {
      this.childNodes.push(child);
      this.firstChild = this.childNodes[0] || null;
      this.scrollHeight = this.childNodes.length;
      return child;
    },
    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index >= 0) this.childNodes.splice(index, 1);
      this.firstChild = this.childNodes[0] || null;
      return child;
    },
  };
}

async function runWorkbench() {
  const ids = ['status', 'workspace', 'model', 'prompt', 'answer', 'events', 'send', 'stop', 'close', 'choose'];
  const elements = Object.fromEntries(ids.map(id => [id, makeElement(id)]));
  elements.answer.textContent = 'Agent output will appear here.';
  elements.send.disabled = true;
  elements.stop.disabled = true;
  elements.close.disabled = true;
  let eventHandler;
  const calls = [];
  const bridge = {
    getStatus: async () => ({ available: true, toolsMode: 'disabled', allowedModels: ['default'] }),
    selectWorkspace: async () => ({ id: 'workspace-opaque', path: '/selected/workspace' }),
    startSession: async request => { calls.push(['start', request]); },
    send: async request => { calls.push(['send', request]); },
    stop: async request => { calls.push(['stop', request]); },
    close: async request => { calls.push(['close', request]); },
    onEvent: handler => { eventHandler = handler; return () => {}; },
  };
  const document = {
    documentElement: { lang: 'en' },
    getElementById: id => elements[id],
    querySelectorAll: () => Object.values(elements),
    createElement: tag => makeElement(tag),
  };
  const context = vm.createContext({
    window: { __CLARITIDE_CCB__: bridge },
    document,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    Array,
    Boolean,
    Promise,
    String,
  });
  new vm.Script(inlineScript, { filename: 'agent-workbench-inline.js' }).runInContext(context);
  await Promise.resolve();
  await Promise.resolve();
  return { calls, elements, emit: event => eventHandler(event) };
}

test('workbench HTML has a deny-by-default CSP and syntactically valid inline code', () => {
  assert.match(html, /Content-Security-Policy[^>]+default-src 'none'/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'agent-workbench-inline.js' }));
});

test('missing native bridge disables controls before subscription', () => {
  const guard = html.indexOf('if (!bridge)');
  const disable = html.indexOf('control.disabled = true', guard);
  const subscription = html.indexOf('bridge.onEvent');
  assert.ok(guard >= 0);
  assert.ok(disable > guard);
  assert.ok(subscription > disable);
});

test('runtime-controlled values only reach the DOM through textContent', () => {
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.match(html, /item\.textContent\s*=/);
  assert.match(html, /answerNode\.textContent\s*=/);
  assert.match(html, /option\.textContent\s*=/);
  assert.match(html, /workspaceNode\.textContent\s*=/);
});

test('send remains disabled until a turn-terminal event', async () => {
  const workbench = await runWorkbench();
  await workbench.elements.choose.handlers.click();
  workbench.elements.prompt.value = 'Inspect the workspace';
  await workbench.elements.send.handlers.click();

  assert.equal(workbench.elements.send.disabled, true);
  assert.equal(workbench.elements.stop.disabled, false);
  assert.equal(workbench.elements.choose.disabled, true);
  assert.equal(workbench.elements.model.disabled, true);

  workbench.emit({
    type: 'error',
    sessionId: '00000000-0000-4000-8000-000000000001',
    payload: { code: 'tool_approval_unsupported', terminal: false },
  });
  assert.equal(workbench.elements.send.disabled, true);
  assert.equal(workbench.elements.stop.disabled, false);

  workbench.emit({
    type: 'stopped',
    sessionId: '00000000-0000-4000-8000-000000000001',
    payload: { settling: true },
  });
  assert.equal(workbench.elements.send.disabled, true);
  assert.equal(workbench.elements.stop.disabled, true);

  workbench.emit({
    type: 'turn_completed',
    sessionId: '00000000-0000-4000-8000-000000000001',
    payload: {},
  });
  assert.equal(workbench.elements.send.disabled, false);
  assert.equal(workbench.elements.stop.disabled, true);

  await workbench.elements.close.handlers.click();
  assert.equal(workbench.elements.choose.disabled, false);
  assert.equal(workbench.elements.model.disabled, false);
});
