function saveOptions(type, value) {
  const update = {};
  if (type === "popupCount") {
    update.popupDisplayOption = value;
  } else if (type === "tabDedupe") {
    update.tabDedupe = Boolean(value);
  } else if (type === "tabJanitor") {
    update.tabJanitor = Boolean(value);
  } else if (type === "tabJanitorDays") {
    update.tabJanitorDays = value;
  } else {
    update.badgeDisplayOption = value;
  }

  chrome.storage.local.set(update).then(function () {
    const status = document.getElementById("status");
    status.textContent = "Selection Saved...";
    setTimeout(function () {
      status.textContent = "";
    }, 750);
  });
}

function restoreOptions() {
  return migrateLegacyLocalStorage().then(function () {
    return chrome.storage.local.get(STORAGE_DEFAULTS);
  }).then(function (settings) {
    const radios = document.popupOptionsForm.tabCountRadios;
    for (let i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === settings.popupDisplayOption;
    }

    document.getElementById("tabDedupe").checked = settings.tabDedupe === true;
    document.getElementById("tabJanitor").checked = settings.tabJanitor === true;
    document.getElementById("tabJanitorDays").value = settings.tabJanitorDays;
    document.getElementById("windowsCount").textContent = settings.windowsCount;
    document.getElementById("tabsCount").textContent = settings.allWindowsTabsCount;
  });
}

document.addEventListener("DOMContentLoaded", function () {
  restoreOptions().then(function () {
    const radios = document.popupOptionsForm.tabCountRadios;
    for (let i = 0; i < radios.length; i++) {
      radios[i].addEventListener("click", function () {
        saveOptions("popupCount", this.value);
      });
    }

    document.getElementById("tabDedupe").addEventListener("click", function () {
      saveOptions("tabDedupe", this.checked);
    });

    document.getElementById("tabJanitor").addEventListener("click", function () {
      saveOptions("tabJanitor", this.checked);
    });

    document.getElementById("tabJanitorDays").addEventListener("input", function () {
      if (!this.valueAsNumber) {
        return;
      }
      saveOptions("tabJanitorDays", this.valueAsNumber);
    });

    document.getElementById("refreshButton").addEventListener("click", function () {
      location.reload();
    });
  });
});
