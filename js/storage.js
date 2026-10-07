const STORAGE_DEFAULTS = {
  popupDisplayOption: "currentWindow",
  badgeDisplayOption: "allWindows",
  tabDedupe: false,
  tabJanitor: false,
  tabJanitorDays: 5,
  windowsCount: 0,
  allWindowsTabsCount: 0
};

function coerceLegacyBoolean(value) {
  return value === true || value === "true";
}

// Popup and options pages can still read the MV2 extension origin localStorage.
// The service worker cannot, so those pages copy settings across once.
async function migrateLegacyLocalStorage() {
  if (typeof localStorage === "undefined") {
    return;
  }
  const { mv3Migrated } = await chrome.storage.local.get({ mv3Migrated: false });
  if (mv3Migrated) {
    return;
  }

  const migrated = { mv3Migrated: true };
  if (localStorage.popupDisplayOption) {
    migrated.popupDisplayOption = localStorage.popupDisplayOption;
  }
  if (localStorage.badgeDisplayOption) {
    migrated.badgeDisplayOption = localStorage.badgeDisplayOption;
  }
  if (typeof localStorage.tabDedupe === "string") {
    migrated.tabDedupe = coerceLegacyBoolean(localStorage.tabDedupe);
  }
  if (typeof localStorage.tabJanitor === "string") {
    migrated.tabJanitor = coerceLegacyBoolean(localStorage.tabJanitor);
  }
  if (localStorage.tabJanitorDays) {
    const days = Number(localStorage.tabJanitorDays);
    if (days >= 1 && days <= 30) {
      migrated.tabJanitorDays = days;
    }
  }
  await chrome.storage.local.set(migrated);
}
