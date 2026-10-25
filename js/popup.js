"use strict";

let rendering = Promise.resolve();
function refresh() {
  rendering = rendering.then(renderTabs).catch(() => {
    document.getElementById("status").textContent = "Couldn't update the tab list. Reopen the popup to try again.";
  });
  return rendering;
}

async function renderTabs() {
  const settings = await getSettings();
  const currentTabs = await chrome.tabs.query({ currentWindow: true });
  const tabs = settings.popupDisplayOption === "allWindows"
    ? await chrome.tabs.query({ windowType: "normal" }) : currentTabs;
  document.getElementById("windowTabs").textContent = `${currentTabs.length} ${currentTabs.length === 1 ? "tab" : "tabs"} in this window`;
  document.getElementById("listScope").textContent = settings.popupDisplayOption === "allWindows"
    ? `${tabs.length} tabs across all windows` : "Current window";
  const list = document.getElementById("tabsList");
  list.replaceChildren();
  document.getElementById("status").textContent = tabs.length ? "" : "No open tabs.";

  for (const tab of tabs) {
    const row = document.createElement("li");
    const title = tab.title || tab.url || "Untitled tab";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "tab-title";
    open.textContent = title;
    open.title = tab.url || title;
    open.addEventListener("click", async () => {
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        window.close();
      } catch {
        await refresh();
      }
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close-tab";
    close.textContent = "×";
    close.setAttribute("aria-label", `Close ${title}`);
    close.title = `Close ${title}`;
    close.addEventListener("click", async () => {
      close.disabled = true;
      try {
        await chrome.tabs.remove(tab.id);
      } catch {
        document.getElementById("status").textContent = "That tab is no longer available.";
      }
      await refresh();
    });
    row.append(open, close);
    list.append(row);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("optionsButton").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  try {
    await migrateLegacySettings();
    await refresh();
  } catch {
    document.getElementById("status").textContent = "Couldn't load settings. Reopen the popup to try again.";
  }
});

chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.title || change.url) refresh();
});
chrome.tabs.onAttached.addListener(refresh);
chrome.tabs.onDetached.addListener(refresh);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") refresh();
});
