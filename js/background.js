//This feature is currently disabled from options.html and options.js
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
    //This feature is currently disabled from options.html and options.js
    count = getCurrentWindowTabs(updateCurrentWindowBadge);
  }
}

//This feature is currently disabled from options.html and options.js
function updateCurrentWindowBadge(count) {
  chrome.browserAction.setBadgeText({text: String(count)});
  updateBadgeTitle(count);
}

//This feature is currently disabled from options.html and options.js
function getCurrentWindowTabs(callback) {
  chrome.tabs.query({currentWindow:true}, function(tabs) {
    callback(tabs.length);
  });
}

//action taken when a new tab is opened
chrome.tabs.onCreated.addListener(function(tab) {
  getAllStats(displayResults)});

//action taken when a tab is closed
chrome.tabs.onRemoved.addListener(function(tab) {
  getAllStats(displayResults)});

//action taken when a new window is opened
chrome.windows.onCreated.addListener(function(tab) {
  getAllStats(displayResults)});

//action taken when a windows is closed
chrome.windows.onRemoved.addListener(function(tab) {
  getAllStats(displayResults)});

//count all tabs in all windows 
function getAllStats(callback) {
  chrome.windows.getAll({populate: true}, function (window_list) {
    callback(window_list);
  });
}

function displayResults(window_list) {
  allWindowsTabCount = 0;
  windowCount = 0;
  for(var i=0; i<window_list.length; i++) { 
    allWindowsTabCount += window_list[i].tabs.length;
  } 
  localStorage["windowsCount"] = window_list.length;
  localStorage["allWindowsTabsCount"] = allWindowsTabCount;
  updateBadgeText();
}

getAllStats(displayResults);