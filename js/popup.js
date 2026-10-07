function getCurrentWindowTabCount() {
  chrome.tabs.query({ currentWindow: true }).then(function (tabs) {
    const el = document.getElementById("windowTabs");
    el.replaceChildren();
    el.append("Number of tabs on this window: ");
    const strong = document.createElement("strong");
    strong.textContent = String(tabs.length);
    el.append(strong);
  });
}

function displayResults(tabs) {
  getCurrentWindowTabCount();
  const table = document.getElementById("tabsTable");
  table.replaceChildren();

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const row = table.insertRow();
    const iconCell = row.insertCell();
    const closeCell = row.insertCell();
    const titleCell = row.insertCell();

    if (tab.favIconUrl) {
      const img = document.createElement("img");
      img.src = tab.favIconUrl;
      img.width = 16;
      img.height = 16;
      img.alt = "";
      iconCell.appendChild(img);
    }

    const close = document.createElement("span");
    close.textContent = "X";
    close.style.cursor = "pointer";
    close.style.color = "red";
    close.addEventListener("click", function () {
      closeTab(tab.id);
    });
    closeCell.appendChild(close);

    const title = document.createElement("span");
    title.textContent = tab.title || tab.url || "";
    title.title = tab.url || "";
    title.style.cursor = "pointer";
    title.addEventListener("click", function () {
      openTab(tab.id, tab.windowId);
    });
    titleCell.appendChild(title);
  }
}

function openTab(tabId, windowId) {
  chrome.windows.update(windowId, { focused: true });
  chrome.tabs.update(tabId, { active: true });
}

function closeTab(tabId) {
  chrome.tabs.remove(tabId).then(function () {
    window.location.reload();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  migrateLegacyLocalStorage().then(function () {
    return chrome.storage.local.get(STORAGE_DEFAULTS);
  }).then(function (settings) {
    const query = settings.popupDisplayOption === "allWindows" ? {} : { currentWindow: true };
    return chrome.tabs.query(query);
  }).then(displayResults);
});
