//Save options to localstorage
function save_options(type, value) {
  if (type == "popupCount") {
    localStorage["popupDisplayOption"] = value;
  } else {
    localStorage["badgeDisplayOption"] = value;
    chrome.runtime.reload();
  }
  //Update selection status
  var status = document.getElementById("status");
  status.innerHTML = "Selection Saved...";
  setTimeout(function() {
    status.innerHTML = "";
  }, 750);
}

//Restore selection from localstorage
function restore_options() {
  // restore options for popupDisplay
  var selection = localStorage["popupDisplayOption"];
  var radios = document.popupOptionsForm.tabCountRadios;
  if (!selection) {
    document.getElementById("defaultPopupSelection").checked = true;
  }
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].value == selection) {
      radios[i].checked = true;
    }
  }
  // restore options for badgeDisplay
  var selection = localStorage["badgeDisplayOption"];
  var radios = document.badgeOptionsForm.badgeCountRadios;
  if (!selection) {
    document.getElementById("defaultBadgeSelection").checked = true;
  }
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].value == selection) {
      radios[i].checked = true;
    }
  }
}

document.addEventListener("DOMContentLoaded", restore_options);

//Add eventlisteners to the radio buttons
var radios = document.popupOptionsForm.tabCountRadios;
for (var i = 0; i < radios.length; i++) {
  radios[i].addEventListener("click", (function(value) {
    return function() {
      save_options("popupCount", value);
    }
  })(radios[i].value));
}

var radios = document.badgeOptionsForm.badgeCountRadios;
for (var i = 0; i < radios.length; i++) {
  radios[i].addEventListener("click", (function(value) {
    return function() {
      save_options("badgeCount", value);
    }
  })(radios[i].value));
}

document.getElementById("refreshButton").addEventListener("click", function() {
  location.reload();
});

document.getElementById("windowsCount").innerHTML = localStorage["windowsCount"];
document.getElementById("tabsCount").innerHTML = localStorage["AllWindowsTabsCount"];