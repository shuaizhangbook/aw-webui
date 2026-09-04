const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const bridgePath = process.env.SEESEEYOU_BRIDGE_PATH;
if (!bridgePath) {
  throw new Error('SEESEEYOU_BRIDGE_PATH must point to the patched seeseeyou_bridge.js');
}

const source = fs.readFileSync(bridgePath, 'utf8');

test('desktop bridge exposes a visible localized AI Workbench entry', () => {
  assert.match(source, /function ensureAgentWorkbenchEntry\(\)/);
  assert.match(source, /document\.querySelector\('\.global-nav'\)/);
  assert.match(source, /button\.id = 'navAgentWorkbench'/);
  assert.match(source, /copy\('AI 工作台', 'AI Workbench'\)/);
  assert.match(source, /invoke\('open_agent_workbench', \{ locale: isEnglish\(\) \? 'en' : 'zh-CN' \}\)/);
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
