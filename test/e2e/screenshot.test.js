/* global fixture */
/* eslint jest/no-test-callback: "off" */
/* eslint jest/expect-expect: "off" */

import { Selector } from 'testcafe';

const baseURL = 'http://127.0.0.1:27180';

const logJsErrorCode = `
  window.addEventListener('error', function (event) {
    console.error(event.message);
  });`;

fixture('My Day').page(`${baseURL}/#/my-day`);

test.clientScripts({ content: logJsErrorCode })('shows the SeeSeeYou sign-in surface', async t => {
  await t
    .expect(Selector('.my-day-page').exists)
    .ok()
    .expect(Selector('.login-shell').exists)
    .ok()
    .expect(Selector('.task-board').exists)
    .notOk();

  await t.takeScreenshot({
    path: 'my-day-login.png',
    fullPage: true,
  });
});

for (const legacyRoute of ['activity/fakedata', 'timeline', 'buckets', 'settings', 'stopwatch']) {
  test(`redirects the retired ${legacyRoute} route to My Day`, async t => {
    await t.navigateTo(`${baseURL}/#/${legacyRoute}`);
    await t.expect(Selector('.my-day-page').exists).ok();
    await t.expect(Selector('.login-shell').exists).ok();
  });
}
