const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function event() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) { listeners.push(listener); },
    async emit(...args) {
      await Promise.all(listeners.map(listener => listener(...args)));
      if (this.afterEmit) await this.afterEmit();
    }
  };
}

function area(data) {
  return {
    async get(keys) {
      if (keys === null) return structuredClone(data);
      if (typeof keys === "string") keys = [keys];
      if (Array.isArray(keys)) return structuredClone(Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])));
      return structuredClone({ ...keys, ...Object.fromEntries(Object.keys(keys).filter(key => key in data).map(key => [key, data[key]])) });
    },
    async set(update) { Object.assign(data, structuredClone(update)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; }
  };
}

function createWorker({ tabs = [], local = {}, session = {}, alarms = {}, notifications = {} } = {}) {
  const state = { tabs: structuredClone(tabs), local, session, alarms, notifications, removed: [], errors: [], focusedWindow: 1 };
  const chrome = {
    tabs: {
      onCreated: event(), onRemoved: event(), onUpdated: event(), onAttached: event(), onDetached: event(),
      async query(query = {}) {
        return structuredClone(state.tabs.filter(tab => !(query.currentWindow || query.lastFocusedWindow) || tab.windowId === state.focusedWindow));
      },
      async get(id) {
        const tab = state.tabs.find(tab => tab.id === id);
        if (!tab) throw Error("No such tab");
        return structuredClone(tab);
      },
      async update(id, update) {
        const tab = state.tabs.find(tab => tab.id === id);
        if (!tab) throw Error("No such tab");
        if (update.active) for (const other of state.tabs) if (other.windowId === tab.windowId) other.active = false;
        Object.assign(tab, update);
        return structuredClone(tab);
      },
      async remove(id) {
        if (!state.tabs.some(tab => tab.id === id)) throw Error("No such tab");
        state.removed.push(id);
        state.tabs = state.tabs.filter(tab => tab.id !== id);
      }
    },
    windows: {
      onCreated: event(), onRemoved: event(), onFocusChanged: event(),
      async getAll() {
        return [...new Set(state.tabs.map(tab => tab.windowId))].map(id => ({ id, tabs: structuredClone(state.tabs.filter(tab => tab.windowId === id)) }));
      },
      async update(id) { state.focusedWindow = id; }
    },
    storage: { local: area(local), session: area(session), onChanged: event() },
    alarms: {
      onAlarm: event(),
      async get(name) { return alarms[name]; },
      async create(name, alarm) { alarms[name] = { name, ...alarm }; },
      async clear(name) { delete alarms[name]; }
    },
    notifications: {
      onClicked: event(), onButtonClicked: event(), onClosed: event(),
      async create(id, details) { notifications[id] = details; },
      async clear(id) { delete notifications[id]; },
      async getAll() { return { ...notifications }; }
    },
    action: {
      async setBadgeText({ text }) { state.badge = text; },
      async setTitle({ title }) { state.title = title; }
    },
    runtime: { onInstalled: event(), onStartup: event() }
  };
  const context = vm.createContext({
    chrome,
    console: { warn(...args) { state.errors.push(args.join(" ")); } },
    importScripts(file) { vm.runInContext(readFileSync(resolve(__dirname, "../js", file), "utf8"), context); }
  });
  vm.runInContext(readFileSync(resolve(__dirname, "../js/background.js"), "utf8"), context);
  for (const api of Object.values(chrome)) {
    for (const value of Object.values(api)) {
      if (value?.listeners) value.afterEmit = () => vm.runInContext("pendingWork", context);
    }
  }
  return {
    chrome, state, context,
    async settle() { await vm.runInContext("pendingWork", context); },
    async call(source) { return await vm.runInContext(source, context); }
  };
}

function createSettings(local = {}, legacy = {}) {
  const context = vm.createContext({
    chrome: { storage: { local: area(local) } },
    localStorage: { getItem(key) { return legacy[key] ?? null; } }
  });
  vm.runInContext(readFileSync(resolve(__dirname, "../js/settings.js"), "utf8"), context);
  return { local, async call(source) {
    const result = await vm.runInContext(source, context);
    return result === undefined ? result : JSON.parse(JSON.stringify(result));
  } };
}

module.exports = { createWorker, createSettings };
