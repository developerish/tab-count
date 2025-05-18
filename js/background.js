"use strict";

let allWindowsTabCount = 0;
let windowCount = 0;
const tab_activation_history = {};

function updateBadgeTitle(count) {
  const title = `You have ${count} open tab(s).`;
  chrome.action.setTitle({ title });
}

async function updateBadgeText() {
  const { badgeDisplayOption } = await chrome.storage.local.get('badgeDisplayOption');
  if (badgeDisplayOption === undefined || badgeDisplayOption === 'allWindows') {
    chrome.action.setBadgeText({ text: String(allWindowsTabCount) });
    updateBadgeTitle(allWindowsTabCount);
  } else {
    // Feature disabled but kept for compatibility
    getCurrentWindowTabs(updateCurrentWindowBadge);
  }
}

async function getAllStats() {
  const window_list = await chrome.windows.getAll({ populate: true });
  return window_list;
}

async function displayResults(window_list) {
  allWindowsTabCount = 0;
  windowCount = 0;
  for (const win of window_list) {
    allWindowsTabCount += win.tabs.length;
  }
  await chrome.storage.local.set({
    windowsCount: window_list.length,
    allWindowsTabsCount: allWindowsTabCount
  });
  updateBadgeText();
}

function registerTabDedupeHandler() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.url) {
      const tabs = await chrome.tabs.query({ url: changeInfo.url });
      if (tabs.length === 2) {
        const oldTab = tabs[0].id === tabId ? tabs[1] : tabs[0];
        const dedupe = confirm(
          "Duplicate tab detected. Switch to existing open tab?"
        );
        if (dedupe) {
          await chrome.tabs.update(oldTab.id, { active: true });
          await chrome.windows.update(oldTab.windowId, { focused: true });
          chrome.tabs.remove(tabId);
        }
      }
    }
  });
}

function registerTabJanitor(days) {
  setInterval(() => {
    const now = Date.now();
    const threshold = days * 86400000; // 24h in ms
    for (const tabId of Object.keys(tab_activation_history)) {
      const ts = tab_activation_history[tabId];
      if (now - ts > threshold) {
        chrome.tabs.remove(Number(tabId));
      }
    }
  }, 1000 * 60 * 60);
}

chrome.tabs.onActivated.addListener(activeInfo => {
  tab_activation_history[activeInfo.tabId] = Date.now();
});

async function init() {
  chrome.tabs.onCreated.addListener(() => {
    getAllStats().then(displayResults);
  });

  chrome.tabs.onRemoved.addListener(() => {
    getAllStats().then(displayResults);
  });

  chrome.windows.onCreated.addListener(() => {
    getAllStats().then(displayResults);
  });

  chrome.windows.onRemoved.addListener(() => {
    getAllStats().then(displayResults);
  });

  getAllStats().then(displayResults);

  const { tabDedupe, tabJanitor, tabJanitorDays } = await chrome.storage.local.get([
    'tabDedupe',
    'tabJanitor',
    'tabJanitorDays'
  ]);
  if (tabDedupe) {
    registerTabDedupeHandler();
  }
  if (tabJanitor) {
    registerTabJanitor(Number(tabJanitorDays) || 5);
  }
}

init();

