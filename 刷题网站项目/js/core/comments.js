/* ==========================================================================
   comments.js —— 题目评论区（纯静态本地版）
   说明：评论保存在当前设备的 localStorage 中，多个本地账户共用。
   真正的跨设备共享需要服务器；这里不伪装成在线数据。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.comments = (function () {
  'use strict';
  var KEY = 'hqz.comments.v1';
  var NAME_KEY = 'hqz.commentName.v1';
  var memory = {};

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      memory = raw ? JSON.parse(raw) : {};
      if (!memory || typeof memory !== 'object') memory = {};
    } catch (e) { memory = {}; }
    return memory;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); }
    catch (e) { /* 存储不可用时只保留内存 */ }
  }
  function list(qid) {
    var db = load();
    return (db[qid] || []).slice().sort(function (a, b) { return b.at - a.at; });
  }
  function count(qid) { return list(qid).length; }
  function add(qid, user, text) {
    text = String(text || '').trim();
    if (!qid || !text) return null;
    var db = load();
    if (!db[qid]) db[qid] = [];
    var item = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      user: String(user || '匿名').trim().slice(0, 24) || '匿名',
      text: text.slice(0, 500),
      at: Date.now()
    };
    db[qid].unshift(item);
    if (db[qid].length > 200) db[qid].length = 200;
    persist();
    return item;
  }
  function remove(qid, id) {
    var db = load();
    db[qid] = (db[qid] || []).filter(function (c) { return c.id !== id; });
    persist();
  }
  function savedName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(name) {
    try { localStorage.setItem(NAME_KEY, String(name || '').slice(0, 24)); } catch (e) {}
  }
  function exportAll() {
    return JSON.stringify({ app: 'henu-quiz-comments', exportedAt: Date.now(), comments: load() }, null, 2);
  }
  return { list: list, count: count, add: add, remove: remove, savedName: savedName, saveName: saveName, exportAll: exportAll };
})();
