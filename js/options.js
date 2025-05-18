"use strict";

async function save_options(type, value) {
  console.log('type: ' + type + ', value: ' + value);
  if (type === 'popupCount') {
    await chrome.storage.local.set({ popupDisplayOption: value });
  } else if (type === 'tabDedupe') {
    await chrome.storage.local.set({ tabDedupe: value });
  } else if (type === 'tabJanitor') {
    await chrome.storage.local.set({ tabJanitor: value });
  } else if (type === 'tabJanitorDays') {
    await chrome.storage.local.set({ tabJanitorDays: value });
  } else {
    await chrome.storage.local.set({ badgeDisplayOption: value });
    chrome.runtime.reload();
  }
  const status = document.getElementById('status');
  status.innerHTML = 'Selection Saved...';
  setTimeout(() => {
    status.innerHTML = '';
  }, 750);
}

async function restore_options() {
  const data = await chrome.storage.local.get([
    'popupDisplayOption',
    'tabDedupe',
    'tabJanitor',
    'tabJanitorDays',
    'windowsCount',
    'allWindowsTabsCount'
  ]);

  const selection = data.popupDisplayOption;
  const radios = document.popupOptionsForm.tabCountRadios;
  if (!selection) {
    document.getElementById('defaultPopupSelection').checked = true;
  }
  for (const radio of radios) {
    if (radio.value === selection) {
      radio.checked = true;
    }
  }

  document.getElementById('tabDedupe').checked = Boolean(data.tabDedupe);
  document.getElementById('tabJanitor').checked = Boolean(data.tabJanitor);
  document.getElementById('tabJanitorDays').value = data.tabJanitorDays || 5;

  document.getElementById('windowsCount').innerHTML = data.windowsCount || 0;
  document.getElementById('tabsCount').innerHTML = data.allWindowsTabsCount || 0;
}

document.addEventListener('DOMContentLoaded', restore_options);

const radios = document.popupOptionsForm.tabCountRadios;
for (const radio of radios) {
  radio.addEventListener('click', () => save_options('popupCount', radio.value));
}

document.getElementById('tabDedupe').addEventListener('click', evt => {
  save_options('tabDedupe', evt.target.checked);
});

document.getElementById('tabJanitor').addEventListener('click', evt => {
  save_options('tabJanitor', evt.target.checked);
});

document.getElementById('tabJanitorDays').oninput = () => {
  save_options('tabJanitorDays', document.getElementById('tabJanitorDays').valueAsNumber);
};

document.getElementById('refreshButton').addEventListener('click', () => {
  location.reload();
});

