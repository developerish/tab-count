const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { createWorker, createSettings } = require("./helpers.cjs");
const manifest = require("../manifest.json");
const DAY = 86400000;
const tab = (id, overrides = {}) => ({
  id, windowId: 1, active: false, pinned: false, audible: false, incognito: false,
  url: "https://example.org/", status: "complete", lastAccessed: Date.now() - 10 * DAY,
  ...overrides
});

test("MV3 package references exist and only necessary permissions are requested", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, require("../package.json").version);
  assert.equal(manifest.minimum_chrome_version, "121");
  assert.deepEqual([...manifest.permissions].sort(), ["alarms", "notifications", "storage", "tabs"]);
  assert.equal(manifest.host_permissions, undefined);
  for (const path of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons)]) {
    assert.ok(existsSync(resolve(__dirname, "..", path)), path);
  }
  for (const file of ["popup.html", "options.html", "privacy.html"]) {
    const html = readFileSync(resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    for (const [, path] of html.matchAll(/(?:src|href)="([^":]+)"/g)) {
      assert.ok(existsSync(resolve(__dirname, "..", path)), `${file}: ${path}`);
    }
  }
  const popup = readFileSync(resolve(__dirname, "../js/popup.js"), "utf8");
  assert.doesNotMatch(popup, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(popup, /favIconUrl/); // Do not contact favicon servers with private URLs.
});

test("settings normalize legacy booleans and reject invalid auto-close thresholds", async () => {
  for (const days of [0, -1, 31, 1.5, "", "no", null]) {
    const settings = createSettings({ tabJanitorDays: days, tabJanitor: "false" });
    const actual = await settings.call("getSettings()");
    assert.equal(actual.tabJanitorDays, 5);
    assert.equal(actual.tabJanitor, false);
  }
  const settings = createSettings({ tabJanitorDays: "30", tabDedupe: "true" });
  assert.equal((await settings.call("getSettings()")).tabJanitorDays, 30);
  assert.equal((await settings.call("getSettings()")).tabDedupe, true);
});

test("legacy migration preserves newer preferences and does not re-enable old auto-close", async () => {
  const settings = createSettings({ popupDisplayOption: "currentWindow", tabDedupe: false }, {
    popupDisplayOption: "allWindows", badgeDisplayOption: "currentWindow",
    tabDedupe: "true", tabJanitor: "true", tabJanitorDays: "12"
  });
  await settings.call("migrateLegacySettings()");
  assert.equal(settings.local.popupDisplayOption, "currentWindow");
  assert.equal(settings.local.tabDedupe, false);
  assert.equal(settings.local.badgeDisplayOption, "currentWindow");
  assert.equal(settings.local.tabJanitor, false);
  assert.equal(settings.local.tabJanitorDays, 12);
  settings.local.badgeDisplayOption = "allWindows";
  await settings.call("migrateLegacySettings()");
  assert.equal(settings.local.badgeDisplayOption, "allWindows");
});

test("listeners register before async initialization; default badge counts every window", async () => {
  const worker = createWorker({ tabs: [tab(1), tab(2, { windowId: 2 }), tab(3)] });
  for (const events of [worker.chrome.tabs.onUpdated, worker.chrome.tabs.onRemoved, worker.chrome.windows.onFocusChanged,
    worker.chrome.alarms.onAlarm, worker.chrome.notifications.onClicked, worker.chrome.notifications.onButtonClicked,
    worker.chrome.storage.onChanged, worker.chrome.runtime.onStartup]) {
    assert.equal(events.listeners.length, 1);
  }
  await worker.settle();
  assert.equal(worker.state.badge, "3");
  assert.equal(worker.state.title, "3 open tabs");
  assert.deepEqual(worker.state.alarms, {});
  assert.deepEqual(worker.state.errors, []);
});

test("current-window badge follows focus and moved tabs", async () => {
  const worker = createWorker({ tabs: [tab(1), tab(2), tab(3, { windowId: 2 })], local: { badgeDisplayOption: "currentWindow" } });
  await worker.settle();
  assert.equal(worker.state.badge, "2");
  worker.state.focusedWindow = 2;
  await worker.chrome.windows.onFocusChanged.emit(2);
  assert.equal(worker.state.badge, "1");
  worker.state.tabs[0].windowId = 2;
  await worker.chrome.tabs.onAttached.emit(1, {});
  assert.equal(worker.state.badge, "2");
});

test("alarms respond to setting changes and are recreated after worker restart", async () => {
  const local = { tabJanitor: true };
  const alarms = {};
  const worker = createWorker({ local, alarms });
  await worker.settle();
  assert.equal(alarms.tabJanitor.periodInMinutes, 60);
  delete alarms.tabJanitor;
  const restarted = createWorker({ local, alarms });
  await restarted.settle();
  assert.equal(alarms.tabJanitor.periodInMinutes, 60);
  local.tabJanitor = false;
  await restarted.chrome.storage.onChanged.emit({ tabJanitor: { newValue: false } }, "local");
  assert.equal(alarms.tabJanitor, undefined);
});

test("auto-close only removes eligible old tabs and rechecks current state", async () => {
  const worker = createWorker({ local: { tabJanitor: true }, tabs: [
    tab(1), tab(2, { active: true }), tab(3, { pinned: true }), tab(4, { audible: true }),
    tab(5, { incognito: true }), tab(6, { url: "chrome://settings/" }),
    tab(7, { lastAccessed: Date.now() }), tab(8, { lastAccessed: undefined }),
    tab(9, { status: "loading" }), tab(10, { pendingUrl: "https://other.example/" }), tab(11)
  ] });
  await worker.settle();
  const originalGet = worker.chrome.tabs.get;
  worker.chrome.tabs.get = async id => id === 11 ? { ...await originalGet(id), active: true } : originalGet(id);
  await worker.chrome.alarms.onAlarm.emit({ name: "tabJanitor" });
  assert.deepEqual(worker.state.removed, [1]);
  assert.deepEqual(worker.state.errors, []);
});

test("disabled auto-close ignores a late alarm", async () => {
  const worker = createWorker({ tabs: [tab(1)], local: { tabJanitor: false } });
  await worker.settle();
  await worker.chrome.alarms.onAlarm.emit({ name: "tabJanitor" });
  assert.deepEqual(worker.state.removed, []);
});

test("duplicate detection is optional and matches exact URLs including wildcards", async () => {
  const url = "https://example.org/search?q=*#one";
  const worker = createWorker({ tabs: [tab(1, { url }), tab(2, { url }), tab(3, { url })] });
  await worker.settle();
  await worker.chrome.tabs.onUpdated.emit(3, { url });
  assert.deepEqual(worker.state.notifications, {});
  worker.state.local.tabDedupe = true;
  await worker.chrome.tabs.onUpdated.emit(3, { url });
  assert.ok(worker.state.notifications["dedupe-3"]);
  assert.equal(worker.state.session["dedupe-3"].oldTabId, 1);
  assert.ok(!worker.state.notifications["dedupe-3"].message.includes(url));
});

test("pending duplicate action survives worker restart and notification body clicks", async () => {
  const local = { tabDedupe: true };
  const session = {};
  const notifications = {};
  const tabs = [tab(1, { windowId: 2 }), tab(2)];
  const first = createWorker({ tabs, local, session, notifications });
  await first.settle();
  await first.chrome.tabs.onUpdated.emit(2, { url: tabs[1].url });
  const restarted = createWorker({ tabs, local, session, notifications });
  await restarted.settle();
  await restarted.chrome.notifications.onClicked.emit("dedupe-2");
  assert.deepEqual(restarted.state.removed, [2]);
  assert.equal(restarted.state.focusedWindow, 2);
  assert.deepEqual(session, {});
});

test("late notification close events cannot erase a replacement prompt", async () => {
  const worker = createWorker({ local: { tabDedupe: true }, tabs: [tab(1), tab(2)] });
  await worker.settle();
  await worker.chrome.tabs.onUpdated.emit(2, { url: "https://example.org/" });
  await worker.chrome.notifications.onClosed.emit("dedupe-2");
  assert.ok(worker.state.session["dedupe-2"]);
  delete worker.state.notifications["dedupe-2"];
  await worker.chrome.notifications.onClosed.emit("dedupe-2");
  assert.deepEqual(worker.state.session, {});
});

test("duplicate actions retain navigated, missing, or pinned tabs; Keep both is safe", async () => {
  for (const scenario of ["navigated", "pending", "missing", "pinned", "keep", "disabled"]) {
    const worker = createWorker({ local: { tabDedupe: true }, tabs: [tab(1), tab(2)] });
    await worker.settle();
    await worker.chrome.tabs.onUpdated.emit(2, { url: "https://example.org/" });
    if (scenario === "navigated") worker.state.tabs[1].url = "https://different.org/";
    if (scenario === "pending") worker.state.tabs[1].pendingUrl = "https://different.org/";
    if (scenario === "missing") worker.state.tabs.shift();
    if (scenario === "pinned") worker.state.tabs[1].pinned = true;
    if (scenario === "disabled") worker.state.local.tabDedupe = false;
    await worker.chrome.notifications.onButtonClicked.emit("dedupe-2", scenario === "keep" ? 1 : 0);
    assert.deepEqual(worker.state.removed, [], scenario);
    assert.deepEqual(worker.state.session, {}, scenario);
  }
});

test("incognito and internal pages do not generate duplicate prompts", async () => {
  for (const overrides of [{ incognito: true }, { url: "chrome://newtab/" }, { pinned: true }]) {
    const worker = createWorker({ local: { tabDedupe: true }, tabs: [tab(1, overrides), tab(2, overrides)] });
    await worker.settle();
    await worker.chrome.tabs.onUpdated.emit(2, { url: worker.state.tabs[1].url });
    assert.deepEqual(worker.state.notifications, {});
  }
});
