"use strict";

importScripts("settings.js");

const JANITOR_ALARM = "tabJanitor";
const DEDUPE_PREFIX = "dedupe-";
const DAY_MS = 24 * 60 * 60 * 1000;

// Serialize event work so older badge queries and notification actions cannot
// overwrite newer results. Persistent state lives in Chrome, not this queue.
let pendingWork = Promise.resolve();
function run(task) {
  pendingWork = pendingWork.then(task).catch(error => {
    console.warn("Tab Count:", error.message);
  });
  return pendingWork;
}

async function refreshBadge() {
  const [windows, settings] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }),
    getSettings()
  ]);
  const allCount = windows.reduce((count, win) => count + win.tabs.length, 0);
  let count = allCount;
  if (settings.badgeDisplayOption === "currentWindow") {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true, windowType: "normal" });
    count = tabs.length;
  }
  await Promise.all([
    chrome.action.setBadgeText({ text: String(count) }),
    chrome.action.setTitle({ title: `${count} open ${count === 1 ? "tab" : "tabs"}` })
  ]);
}

async function syncJanitorAlarm() {
  const { tabJanitor } = await getSettings();
  if (!tabJanitor) {
    await chrome.alarms.clear(JANITOR_ALARM);
  } else if (!(await chrome.alarms.get(JANITOR_ALARM))) {
    await chrome.alarms.create(JANITOR_ALARM, { periodInMinutes: 60 });
  }
}

function isStale(tab, cutoff) {
  return !tab.active && !tab.pinned && !tab.audible && !tab.incognito &&
    !tab.pendingUrl && tab.status !== "loading" &&
    /^https?:\/\//.test(tab.url || "") &&
    Number.isFinite(tab.lastAccessed) && tab.lastAccessed > 0 &&
    tab.lastAccessed < cutoff;
}

async function closeStaleTabs() {
  const settings = await getSettings();
  if (!settings.tabJanitor) return;
  const cutoff = Date.now() - settings.tabJanitorDays * DAY_MS;
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  for (const tab of tabs) {
    if (!isStale(tab, cutoff)) continue;
    // Recheck immediately before removing: a queued tab may have become active.
    const latestSettings = await getSettings();
    if (!latestSettings.tabJanitor) return;
    try {
      const latest = await chrome.tabs.get(tab.id);
      if (isStale(latest, Date.now() - latestSettings.tabJanitorDays * DAY_MS)) {
        await chrome.tabs.remove(tab.id);
      }
    } catch {
      // A tab can disappear while Chrome is returning its details.
    }
  }
}

async function clearDuplicate(notificationId) {
  await chrome.storage.session.remove(notificationId);
  await chrome.notifications.clear(notificationId);
}

async function promptForDuplicate(tabId, url) {
  const notificationId = `${DEDUPE_PREFIX}${tabId}`;
  await clearDuplicate(notificationId);
  const settings = await getSettings();
  if (!settings.tabDedupe || !/^https?:\/\//.test(url || "")) return;
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  const newTab = tabs.find(tab => tab.id === tabId);
  if (!newTab || newTab.url !== url || newTab.incognito || newTab.pinned) return;
  const oldTab = tabs.find(tab => tab.id !== tabId && !tab.incognito && tab.url === url);
  if (!oldTab) return;

  // Session storage survives worker suspension and never leaves this browser.
  await chrome.storage.session.set({
    [notificationId]: { oldTabId: oldTab.id, newTabId: tabId, url }
  });
  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "images/icon128.png",
      title: "Duplicate tab detected",
      message: "This page is already open. Click to switch to the existing tab and close the duplicate.",
      buttons: [{ title: "Switch to existing" }, { title: "Keep both" }]
    });
  } catch (error) {
    await chrome.storage.session.remove(notificationId);
    throw error;
  }
}

async function resolveDuplicate(notificationId, switchToExisting) {
  if (!notificationId.startsWith(DEDUPE_PREFIX)) return;
  const stored = await chrome.storage.session.get(notificationId);
  const pending = stored[notificationId];
  await clearDuplicate(notificationId);
  if (!switchToExisting || !pending || !(await getSettings()).tabDedupe) return;
  try {
    const [oldTab, newTab] = await Promise.all([
      chrome.tabs.get(pending.oldTabId), chrome.tabs.get(pending.newTabId)
    ]);
    // Never close a tab that has navigated since the notification was shown.
    if (oldTab.url !== pending.url || newTab.url !== pending.url ||
        oldTab.pendingUrl || newTab.pendingUrl || newTab.pinned || newTab.incognito) return;
    await chrome.tabs.update(oldTab.id, { active: true });
    await chrome.windows.update(oldTab.windowId, { focused: true });
    // Re-read after focusing the other window as that operation is asynchronous.
    const latest = await chrome.tabs.get(newTab.id);
    if (latest.url === pending.url && !latest.pendingUrl && !latest.pinned) {
      await chrome.tabs.remove(newTab.id);
    }
  } catch {
    // If either tab was closed, keep any remaining tab intact.
  }
}

async function clearAllDuplicates() {
  const stored = await chrome.storage.session.get(null);
  for (const key of Object.keys(stored)) {
    if (key.startsWith(DEDUPE_PREFIX)) await clearDuplicate(key);
  }
}

async function initialize() {
  await syncJanitorAlarm();
  await refreshBadge();
}

// Register every event synchronously, before the first asynchronous read.
chrome.tabs.onCreated.addListener(tab => run(async () => {
  await refreshBadge();
  if (tab.url) await promptForDuplicate(tab.id, tab.url);
}));
chrome.tabs.onRemoved.addListener(tabId => run(async () => {
  await clearDuplicate(`${DEDUPE_PREFIX}${tabId}`);
  await refreshBadge();
}));
chrome.tabs.onAttached.addListener(() => run(refreshBadge));
chrome.tabs.onDetached.addListener(() => run(refreshBadge));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) run(() => promptForDuplicate(tabId, change.url));
});
chrome.windows.onCreated.addListener(() => run(refreshBadge));
chrome.windows.onRemoved.addListener(() => run(refreshBadge));
chrome.windows.onFocusChanged.addListener(() => run(refreshBadge));
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === JANITOR_ALARM) run(closeStaleTabs);
});
chrome.notifications.onClicked.addListener(id => run(() => resolveDuplicate(id, true)));
chrome.notifications.onButtonClicked.addListener((id, button) => {
  run(() => resolveDuplicate(id, button === 0));
});
chrome.notifications.onClosed.addListener(id => {
  if (id.startsWith(DEDUPE_PREFIX)) run(async () => {
    // A URL change can replace a prompt with the same ID before onClosed runs.
    const notifications = await chrome.notifications.getAll();
    if (!notifications[id]) await chrome.storage.session.remove(id);
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  run(async () => {
    if (changes.tabJanitor || changes.tabJanitorDays) await syncJanitorAlarm();
    if (changes.tabDedupe && !(await getSettings()).tabDedupe) await clearAllDuplicates();
    if (changes.badgeDisplayOption) await refreshBadge();
  });
});
chrome.runtime.onInstalled.addListener(() => run(initialize));
chrome.runtime.onStartup.addListener(() => run(initialize));
run(initialize);
