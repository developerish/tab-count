"use strict";

function showStatus(message) {
  document.getElementById("status").textContent = message;
}

async function saveSetting(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    showStatus("Settings saved.");
  } catch {
    showStatus("Couldn't save settings. Please try again.");
  }
}

async function refreshStats() {
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  document.getElementById("windowsCount").textContent = windows.length;
  document.getElementById("tabsCount").textContent = windows.reduce((total, win) => total + win.tabs.length, 0);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await migrateLegacySettings();
    const settings = await getSettings();
    for (const radio of document.querySelectorAll('input[type="radio"]')) {
      radio.checked = radio.value === settings[radio.name];
      radio.addEventListener("change", () => saveSetting(radio.name, radio.value));
    }
    for (const key of ["tabDedupe", "tabJanitor"]) {
      const input = document.getElementById(key);
      input.checked = settings[key];
      input.addEventListener("change", () => saveSetting(key, input.checked));
    }
    const days = document.getElementById("tabJanitorDays");
    days.value = settings.tabJanitorDays;
    days.addEventListener("change", () => {
      if (!days.validity.valid || !Number.isInteger(days.valueAsNumber)) {
        days.reportValidity();
        showStatus("Choose a whole number of days between 1 and 30. Your previous setting is unchanged.");
        return;
      }
      saveSetting("tabJanitorDays", days.valueAsNumber);
    });
    document.getElementById("refreshButton").addEventListener("click", () => {
      refreshStats().catch(() => showStatus("Couldn't refresh tab counts."));
    });
    await refreshStats();
  } catch {
    showStatus("Couldn't load settings. Reload this page to try again.");
  }
});
