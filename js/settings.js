"use strict";

const SETTINGS_DEFAULTS = Object.freeze({
  popupDisplayOption: "currentWindow",
  badgeDisplayOption: "allWindows",
  tabDedupe: false,
  tabJanitor: false,
  tabJanitorDays: 5
});

function normalizeSettings(data) {
  const days = Number(data.tabJanitorDays);
  return {
    popupDisplayOption: data.popupDisplayOption === "allWindows" ? "allWindows" : "currentWindow",
    badgeDisplayOption: data.badgeDisplayOption === "currentWindow" ? "currentWindow" : "allWindows",
    tabDedupe: data.tabDedupe === true || data.tabDedupe === "true",
    tabJanitor: data.tabJanitor === true || data.tabJanitor === "true",
    tabJanitorDays: Number.isInteger(days) && days >= 1 && days <= 30 ? days : 5
  };
}

async function getSettings() {
  return normalizeSettings(await chrome.storage.local.get(SETTINGS_DEFAULTS));
}

// Only extension pages can read the old MV2 localStorage. Preserve newer values
// in chrome.storage.local and never resurrect an old enabled auto-close setting.
async function migrateLegacySettings() {
  const stored = await chrome.storage.local.get(null);
  if (stored.settingsMigrated) return;
  const legacy = {};
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    const value = localStorage.getItem(key);
    if (stored[key] === undefined && value !== null) legacy[key] = value;
  }
  if (legacy.tabJanitor !== undefined) legacy.tabJanitor = false;
  const normalized = normalizeSettings(legacy);
  const update = { settingsMigrated: true };
  for (const key of Object.keys(legacy)) update[key] = normalized[key];
  await chrome.storage.local.set(update);
}
