const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const bridgePath = process.env.SEESEEYOU_BRIDGE_PATH;
if (!bridgePath) {
  throw new Error('SEESEEYOU_BRIDGE_PATH must point to the patched seeseeyou_bridge.js');
}

const source = fs.readFileSync(bridgePath, 'utf8');

function loadEntry(documentLanguage) {
  const calls = [];
  let button = null;
  const nav = {
    appendChild(element) { button = element; },
  };
  const document = {
    documentElement: { lang: documentLanguage },
    title: '',
    querySelector(selector) { return selector === '.global-nav' ? nav : null; },
    getElementById(id) { return id === 'navAgentWorkbench' ? button : null; },
    createElement() {
      const listeners = new Map();
      return {
        style: {},
        addEventListener(name, listener) { listeners.set(name, listener); },
        setAttribute() {},
        click(event) { return listeners.get('click')(event); },
      };
    },
    addEventListener() {},
  };
  const window = {
    __SEESEEYOU_BRIDGE_TEST_MODE__: true,
    __TAURI_INTERNALS__: {
      invoke(command, args) {
        calls.push([command, args]);
        return Promise.resolve();
      },
    },
    location: {
      origin: 'https://watch.sding.me',
      href: 'https://watch.sding.me/admin/my-day/?desktop=1',
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    navigator: { platform: 'Win32' },
    fetch: async () => ({ ok: true, async json() { return {}; } }),
    confirm() { return true; },
    alert() {},
    addEventListener() {},
    setTimeout() { return 1; },
    setInterval() { return 1; },
  };

  vm.runInNewContext(source, {
    window,
    document,
    Headers,
    FormData,
    URL,
    encodeURIComponent,
    console,
  }, { filename: bridgePath });
  window.__SEESEEYOU_BRIDGE_TEST__.ensureAgentWorkbenchEntry();
  return { button, calls };
}

test('visible AI Workbench entry invokes the native opener with the active locale', async () => {
  for (const [language, expectedLabel, expectedLocale] of [
    ['zh-CN', 'AI 工作台', 'zh-CN'],
    ['en', 'AI Workbench', 'en'],
  ]) {
    const harness = loadEntry(language);
    harness.button.click({
      preventDefault() {},
      stopPropagation() {},
    });
    await Promise.resolve();

    assert.equal(harness.button.textContent, expectedLabel);
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0][0], 'open_agent_workbench');
    assert.equal(harness.calls[0][1].locale, expectedLocale);
  }
});

test('AI Workbench entry survives initial render and language changes', () => {
  assert.match(
    source,
    /DOMContentLoaded'[\s\S]*brandDesktopWorkspace\(\);\s*ensureAgentWorkbenchEntry\(\);/,
  );
  assert.match(
    source,
    /work-i18n-change'[\s\S]*ensureAgentWorkbenchEntry\(\);\s*ensureDesktopSync\(true\);/,
  );
});
