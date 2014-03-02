allWindowsTabCount = null;
windowCount = null;
currentWindowTabCount = null;

// set icon's tooltip
function updateBadgeTitle(count) {
  iconTitle = 'You have ' + count + ' open tab(s).'
  chrome.browserAction.setTitle({title: iconTitle});
}

// set icon's text
function updateBadgeText() {
  var displayOption = localStorage["badgeDisplayOption"];
  if ( typeof displayOption == "undefined" || displayOption == "allWindows") {
    chrome.browserAction.setBadgeText({text: String(allWindowsTabCount)});
    updateBadgeTitle(allWindowsTabCount);
  } else {
    //Use callback
    count = getCurrentWindowTabs(updateCureentWindowBadge);
  }
}

function updateCureentWindowBadge(count) {
  chrome.browserAction.setBadgeText({text: String(count)});
  updateBadgeTitle(count);
}

function getCurrentWindowTabs(callback) {
  chrome.tabs.query({currentWindow:true}, function(tabs) {
    callback(tabs.length);
  });
}
// update badge text and title
function updateBadge(operation) {
  if (operation == 'add') {
    allWindowsTabCount += 1;
  }
  else if (operation == 'sub') {
    allWindowsTabCount -= 1;
  }
  updateBadgeText();
  localStorage["AllWindowsTabsCount"] = allWindowsTabCount;
}

function updateWindowsCount(operation) {
  if (operation == 'add') {
    windowCount += 1;
  }
  else if (operation == 'sub') {
    windowCount -= 1;
  }
  localStorage["windowsCount"] = windowCount;
}

// count all tabs in all windows when extension loads 
chrome.windows.getAll({populate: true}, function (window_list) {
  for(var i=0; i<window_list.length; i++) { 
    allWindowsTabCount += window_list[i].tabs.length;
  } 
  updateBadge(null);
  windowCount = window_list.length;
  localStorage["windowsCount"] = windowCount;
  localStorage["AllWindowsTabsCount"] = allWindowsTabCount;
}); 

 
// action taken when a new tab is opened
chrome.tabs.onCreated.addListener(function(tab) {
  updateBadge('add')}); 

// action taken when a tab is closed
chrome.tabs.onRemoved.addListener(function(tab) {
  updateBadge('sub')});

//action taken when a new window is opened
chrome.windows.onCreated.addListener(function(tab) {
  updateWindowsCount('add')}); 

// action taken when a windows is closed
chrome.windows.onRemoved.addListener(function(tab) {
  updateWindowsCount('sub')});