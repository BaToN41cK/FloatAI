const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { t } = require('./i18n');
const { writeChain, serializeWrite } = require('./constants');

const HISTORY_FILE = path.join(__dirname, '..', 'logs', 'history.json');
const MEMORY_LIMIT = 24;
const REPLY_CACHE_TTL = 30 * 60 * 1000; // 30 минут
const REPLY_CACHE_MAX = 50;

module.exports = class SessionManager {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      const j = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(j) && j.length) {
        return { activeId: 'legacy', sessions: [{ id: 'legacy', title: 'Диалог 1', history: j }] };
      }
      if (j && Array.isArray(j.sessions)) return j;
    } catch (_) {}
    return { activeId: null, sessions: [] };
  }

  saveData() {
    const snapshot = JSON.stringify(this.data, null, 2);
    serializeWrite(() => {
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      fs.writeFileSync(HISTORY_FILE, snapshot);
    });
  }

  get active() { return this.data.sessions.find(s => s.id === this.data.activeId); }

  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  newSession() {
    const s = { id: this.newId(), title: t('chat.newDialog'), history: [], summary: '' };
    this.data.sessions.unshift(s);
    this.data.activeId = s.id;
    this.saveData();
    return this.getSessions();
  }

  ensureActive() {
    let s = this.active;
    if (!s) {
      s = { id: this.newId(), title: t('chat.newDialog'), history: [] };
      this.data.sessions.unshift(s);
      this.data.activeId = s.id;
      this.saveData();
    }
    return s;
  }

  getHistory() { const a = this.active; return a ? a.history : []; }

  getSessions() {
    return this.data.sessions.map(s => ({ id: s.id, title: s.title, count: s.history.length, active: s.id === this.data.activeId }));
  }

  switchSession(id) {
    if (this.data.sessions.some(s => s.id === id)) {
      this.data.activeId = id;
      this.saveData();
    }
    return this.getSessions();
  }

  deleteSession(id) {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    if (this.data.activeId === id) this.data.activeId = this.data.sessions[0] ? this.data.sessions[0].id : null;
    this.ensureActive();
    this.saveData();
    return this.getSessions();
  }

  resetHistory() {
    const a = this.ensureActive();
    a.history = [];
    a.summary = '';
    a.title = t('chat.newDialog');
    this.saveData();
  }
};
