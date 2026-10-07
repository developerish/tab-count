importScripts("js/storage.js");

const JANITOR_ALARM = "tabJanitor";
const DEDUPE_PREFIX = "dedupe:";

function updateBadge(count) {
  chrome.action.setBadgeText({ text: String(count) });
  chrome.action.setTitle({ title: "You have " + count + " open tab(s)." });
}

async function refreshStats() {
  const windowList = await chrome.windows.getAll({ populate: true });
  let allWindowsTabCount = 0;
  for (let i = 0; i < windowList.length; i++) {
    allWindowsTabCount += windowList[i].tabs.length;
  }

  await chrome.storage.local.set({
    windowsCount: windowList.length,
    allWindowsTabsCount: allWindowsTabCount
  });

  const { badgeDisplayOption } = await chrome.storage.local.get(STORAGE_DEFAULTS);
  let count = allWindowsTabCount;
  if (badgeDisplayOption !== "allWindows") {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    count = tabs.length;
  }
  updateBadge(count);
}

async function updateHistory(mutator) {
  const stored = await chrome.storage.session.get({ tabActivationHistory: {} });
  const history = stored.tabActivationHistory;
  if (mutator(history) === false) {
    return;
  }
  await chrome.storage.session.set({ tabActivationHistory: history });
}

function rememberTab(tabId) {
  return updateHistory(function (history) {
    if (history[tabId] != null) {
      return false;
    }
    history[tabId] = Date.now();
  });
}

async function noteExistingTabs() {
  const tabs = await chrome.tabs.query({});
  await updateHistory(function (history) {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < tabs.length; i++) {
      const id = tabs[i].id;
      if (history[id] == null) {
        history[id] = now;
        changed = true;
      }
    }
    return changed ? undefined : false;
  });
}

async function syncJanitorAlarm() {
  const { tabJanitor } = await chrome.storage.local.get(STORAGE_DEFAULTS);
  if (!tabJanitor) {
    await chrome.alarms.clear(JANITOR_ALARM);
    return;
  }
  const existing = await chrome.alarms.get(JANITOR_ALARM);
  if (!existing) {
    await chrome.alarms.create(JANITOR_ALARM, { periodInMinutes: 60 });
  }
}

async function closeStaleTabs() {
  const settings = await chrome.storage.local.get(STORAGE_DEFAULTS);
  if (!settings.tabJanitor) {
    return;
  }

  const days = Number(settings.tabJanitorDays) || 5;
  const maxAgeMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const stored = await chrome.storage.session.get({ tabActivationHistory: {} });
  const history = stored.tabActivationHistory;
  const staleIds = [];

  Object.keys(history).forEach(function (id) {
    if (now - Number(history[id]) > maxAgeMs) {
      staleIds.push(Number(id));
    }
  });

  for (let i = 0; i < staleIds.length; i++) {
    try {
      await chrome.tabs.remove(staleIds[i]);
    } catch (err) {
      // The tab may already have been closed.
    }
    delete history[staleIds[i]];
  }

  if (staleIds.length) {
    await chrome.storage.session.set({ tabActivationHistory: history });
  }
}

async function promptForDuplicate(tabId, url) {
  const { tabDedupe } = await chrome.storage.local.get(STORAGE_DEFAULTS);
  if (!tabDedupe || !url) {
    return;
  }

  const tabs = await chrome.tabs.query({});
  const matches = tabs.filter(function (tab) {
    return tab.url === url;
  });
  if (matches.length !== 2) {
    return;
  }

  const oldTab = matches[0].id === tabId ? matches[1] : matches[0];
  const notificationId = DEDUPE_PREFIX + tabId;
  const pending = await chrome.storage.session.get({ pendingDedupes: {} });
  const pendingDedupes = pending.pendingDedupes;
  pendingDedupes[notificationId] = {
    newTabId: tabId,
    oldTabId: oldTab.id,
    oldWindowId: oldTab.windowId
  };
  await chrome.storage.session.set({ pendingDedupes: pendingDedupes });

  const shownUrl = url.length > 120 ? url.slice(0, 117) + "..." : url;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("images/icon128.png"),
    title: "Duplicate tab",
    message: "Switch to the existing open tab?\n" + shownUrl,
    buttons: [
      { title: "Switch to existing" },
      { title: "Keep both" }
    ],
    requireInteraction: true
  });
}

const handledDedupes = {};

function takePendingDedupe(notificationId) {
  if (handledDedupes[notificationId]) {
    return Promise.resolve(null);
  }
  handledDedupes[notificationId] = true;
  return chrome.storage.session.get({ pendingDedupes: {} }).then(function (stored) {
    const pendingDedupes = stored.pendingDedupes;
    const pending = pendingDedupes[notificationId];
    delete pendingDedupes[notificationId];
    return chrome.storage.session.set({ pendingDedupes: pendingDedupes }).then(function () {
      return pending || null;
    });
  });
}

chrome.tabs.onCreated.addListener(function (tab) {
  rememberTab(tab.id);
  refreshStats();
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  updateHistory(function (history) {
    if (history[tabId] == null) {
      return false;
    }
    delete history[tabId];
  });
  refreshStats();
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  updateHistory(function (history) {
    history[activeInfo.tabId] = Date.now();
  });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (!changeInfo.url) {
    return;
  }
  promptForDuplicate(tabId, changeInfo.url);
});

chrome.windows.onCreated.addListener(function () {
  refreshStats();
});

chrome.windows.onRemoved.addListener(function () {
  refreshStats();
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === JANITOR_ALARM) {
    closeStaleTabs();
  }
});

chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
  if (notificationId.indexOf(DEDUPE_PREFIX) !== 0) {
    return;
  }
  takePendingDedupe(notificationId).then(function (pending) {
    chrome.notifications.clear(notificationId);
    if (!pending || buttonIndex !== 0) {
      return;
    }
    chrome.tabs.update(pending.oldTabId, { active: true }).then(function () {
      return chrome.windows.update(pending.oldWindowId, { focused: true });
    }).then(function () {
      return chrome.tabs.remove(pending.newTabId);
    });
  });
});

chrome.notifications.onClosed.addListener(function (notificationId) {
  if (notificationId.indexOf(DEDUPE_PREFIX) === 0) {
    takePendingDedupe(notificationId);
  }
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local") {
    return;
  }
  if (changes.tabJanitor || changes.tabJanitorDays) {
    syncJanitorAlarm();
  }
  if (changes.badgeDisplayOption) {
    refreshStats();
  }
});

chrome.runtime.onInstalled.addListener(function () {
  syncJanitorAlarm();
  noteExistingTabs();
  refreshStats();
});

chrome.runtime.onStartup.addListener(function () {
  syncJanitorAlarm();
  noteExistingTabs();
  refreshStats();
});

syncJanitorAlarm();
noteExistingTabs();
refreshStats();
