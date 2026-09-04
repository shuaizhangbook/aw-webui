const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const htmlPath = process.env.CLARITIDE_AGENT_HTML_PATH;
if (!htmlPath) {
  throw new Error('CLARITIDE_AGENT_HTML_PATH must point to agent-workbench.html');
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

test('workbench is a bilingual, deny-by-default local document', () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /Content-Security-Policy[^>]+default-src 'none'/);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'agent-workbench-inline.js' }));
  assert.doesNotMatch(html, /https:\/\/(fonts\.googleapis|cdn\.jsdelivr)/);
  assert.match(html, /locale=new URLSearchParams\(window\.location\.search\)/);
  assert.match(html, /'AI 工作台':'AI Workbench'/);
  assert.match(html, /document\.documentElement\.lang=locale/);
  assert.match(html, /locale:locale/);
});

test('approved project and session hierarchy is present', () => {
  assert.match(html, /id="newProject"[^>]*>新建项目/);
  assert.match(html, /id="newSession"[^>]*>新建会话/);
  assert.match(html, /id="projectList"/);
  assert.match(html, /id="sessionProject"/);
  assert.match(html, /会话会保存在对应项目中/);
  assert.match(html, /bridge\.selectWorkspace\(\)/);
  assert.match(html, /bridge\.startSession/);
});

test('same-window navigation and return are explicit', () => {
  assert.match(html, /返回工作空间/);
  assert.match(html, /window\.location\.assign\(WORKSPACE_URL\)/);
  assert.match(html, /await bridge\.close/);
  assert.doesNotMatch(html, /window\.open\(/);
});

test('model and permission controls enable guarded session-scoped full access', () => {
  assert.match(html, /id="topModel"/);
  assert.match(html, /id="bottomModel"/);
  assert.match(html, /value="controlled">受控访问/);
  assert.match(html, /value="readonly">只读访问/);
  assert.match(html, /value="full">完全访问/);
  assert.match(html, /id="fullAccessModal"/);
  assert.match(html, /真实权限绕过模式/);
  assert.match(html, /仅本会话授权/);
  assert.match(html, /permission:session\.permission/);
  assert.match(html, /if\(session\.permission==='full'\)session\.permission='controlled'/);
  assert.match(html, /fullAccessGrants/);
});

test('runtime-controlled and user-controlled values use textContent', () => {
  assert.match(html, /body\.textContent=safeText\(text\)/);
  assert.match(html, /copy\.textContent=safeText\(detail\)/);
  assert.match(html, /name\.textContent=project\.name/);
  assert.match(html, /title\.textContent=session\.name/);
  assert.doesNotMatch(html, /innerHTML\s*=\s*safeText/);
});

test('core production-agent controls are wired', () => {
  for (const id of ['prompt', 'send', 'stop', 'runtimeStatus', 'activityPanel', 'eventLog']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /bridge\.send/);
  assert.match(html, /bridge\.stop/);
  assert.match(html, /bridge\.onEvent\(handleEvent\)/);
  assert.match(html, /Ctrl \+ Enter 发送/);
});
