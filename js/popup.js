"use strict";

async function getCurrentWindowTabCount() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const lenText = `Number of tabs on this window:<strong> ${tabs.length}</strong>`;
  document.getElementById('windowTabs').innerHTML = lenText;
}

async function getCurrentWindowTabs() {
  return await chrome.tabs.query({ currentWindow: true });
}

async function getAllTabs() {
  return await chrome.tabs.query({});
}

async function displayResults(tabs) {
  await getCurrentWindowTabCount();
  const table = document.getElementById('tabsTable');
  for (const tab of tabs) {
    const row = table.insertRow(-1);
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);

    if (tab.favIconUrl) {
      cell1.innerHTML = `<img src=${tab.favIconUrl} width='16' height='16'>`;
    }
    cell2.innerHTML = "<span style=cursor:pointer><font color=red>X</font></span>";
    cell3.innerHTML = `<span style=cursor:pointer title='${tab.url}'>${tab.title}</span>`;

    cell2.addEventListener('click', () => closeTab(tab.id));
    cell3.addEventListener('click', () => openTab(tab.id, tab.windowId));
  }
}

function openTab(tabID, windowID) {
  chrome.windows.update(windowID, { focused: true });
  chrome.tabs.update(tabID, { active: true });
}

function closeTab(tabID) {
  chrome.tabs.remove(tabID);
  window.location.reload();
}

(async () => {
  const { popupDisplayOption } = await chrome.storage.local.get('popupDisplayOption');
  if (popupDisplayOption === undefined || popupDisplayOption === 'currentWindow') {
    const tabs = await getCurrentWindowTabs();
    displayResults(tabs);
  } else {
    const tabs = await getAllTabs();
    displayResults(tabs);
  }
})();

