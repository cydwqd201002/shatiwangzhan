/* ==========================================================================
   store.js —— 本地持久化（localStorage）
   --------------------------------------------------------------------------
   全站只有这一个数据出口：进度、错题本、收藏、历史成绩、设置、断点续答。
   数据整体存成一份 JSON（hqz.v1.db），导出/导入/清空都很直接。
   localStorage 在个别环境（隐私模式 / file:// 受限）会抛异常，这里做了内存兜底，
   保证功能不会因为存储不可用而整站崩掉。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.store = (function () {
  'use strict';

  var KEY = 'hqz.v1.db';
  var HISTORY_MAX = 100;

  var memory = null;          // localStorage 不可用时的兜底
  var usable = true;

  function defaults() {
    return {
      v: 1,
      settings: {
        theme: 'auto',        // auto | light | dark | ocean | forest | sakura | midnight | contrast
        font: 'm',            // s | m | l
        instant: true,        // 练习模式：提交后立即判题
        autoNext: false,      // 答对后自动跳下一题
        showExplain: true,    // 提交后显示解析
        keyboard: true,       // 键盘快捷键
        searchIncognito: false, // 搜题无痕：不写入搜索历史
        darkPrompt: true,     // 日落后提醒切换深色
        breakReminder: true,  // 连续做题 2 小时提醒休息
        antiDizzy: false,     // 防眩晕模式
        language: 'zh',       // zh | en | ja
        pomoWork: 25,         // 番茄钟工作时长（分钟）
        pomoBreak: 5,         // 番茄钟休息时长（分钟）
        uiScale: 1,           // 界面缩放
        uiOpacity: 1,         // 内容透明度
        uiPrimary: '',        // 自定义主色
        uiBg: '',             // 自定义页面背景色
        uiFont: 'system',     // system | serif | rounded | mono
        uiGap: 10,            // 按钮/卡片间距
        uiBgImage: '',        // 自定义背景图（Data URL）
        uiQuickOrder: [],     // 首页快捷入口顺序
        uiNavOrder: [],       // 顶部导航顺序
        audioTrack: '',       // 背景音乐
        audioVolume: 0.2
      },
      progress: {},           // qid -> { picked, correct, at, times }
      wrong: {},              // qid -> { times, at, sessionId, bankId, modeName }
      fav: {},                // qid -> ts
      history: [],            // 最近在前
      searchHistory: [],      // [{ id, keyword, count, at }]
      qualityFixes: {},       // issueKey -> { at, questionId, code, label }
      trialDone: {},          // 用户测试任务完成状态
      trialFeedback: [],      // 用户测试反馈
      session: {},            // bankId -> 断点续答快照
      lastSession: null       // 最近一次会话（首页"继续上次"用）
    };
  }

  function load() {
    if (memory) return memory;
    var db;
    try {
      var txt = window.localStorage.getItem(KEY);
      db = txt ? JSON.parse(txt) : null;
    } catch (e) {
      usable = false;
      db = null;
    }
    if (!db || typeof db !== 'object') db = defaults();
    // 补齐缺失字段（版本升级时不让老数据炸掉）
    var d = defaults();
    Object.keys(d).forEach(function (k) {
      if (db[k] === undefined || db[k] === null) db[k] = d[k];
    });
    Object.keys(d.settings).forEach(function (k) {
      if (db.settings[k] === undefined) db.settings[k] = d.settings[k];
    });
    memory = db;
    return db;
  }

  var listeners = [];

  function persist() {
    if (!usable) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(memory));
    } catch (e) {
      usable = false;
      HZQ.util.toast('浏览器存储不可用，本次进度只保留在内存中', 'bad');
    }
  }

  function commit() {
    persist();
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  /* --------------------------- 设置 --------------------------- */
  function settings() { return load().settings; }
  function setSetting(k, v) { load().settings[k] = v; commit(); }

  /* --------------------------- 单题进度 --------------------------- */
  function progressOf(qid) { return load().progress[qid] || null; }
  function recordAnswer(qid, picked, correct) {
    var db = load();
    var prev = db.progress[qid];
    db.progress[qid] = {
      picked: HZQ.grading.normalize(picked),
      correct: !!correct,
      at: Date.now(),
      times: (prev ? prev.times : 0) + 1
    };
    commit();
  }
  function resetProgress(qid) { delete load().progress[qid]; commit(); }

  /** 某题库的完成情况：答过多少、答对多少 */
  function bankProgress(bankId) {
    var db = load();
    var b = HZQ.data.bank(bankId);
    var done = 0, right = 0;
    if (!b) return { done: 0, right: 0, total: 0, accuracy: 0 };
    b.questions.forEach(function (q) {
      var p = db.progress[q.id];
      if (p) { done++; if (p.correct) right++; }
    });
    return {
      done: done, right: right, total: b.questions.length,
      accuracy: done ? right / done : 0,
      ratio: b.questions.length ? done / b.questions.length : 0
    };
  }

  function globalStats() {
    var db = load();
    var done = 0, right = 0;
    Object.keys(db.progress).forEach(function (qid) {
      if (!HZQ.data.question(qid)) return;
      done++;
      if (db.progress[qid].correct) right++;
    });
    var sessions = db.history.length;
    return {
      done: done, right: right, wrong: done - right,
      accuracy: done ? right / done : 0,
      sessions: sessions,
      wrongCount: wrongList().length,
      favCount: favList().length
    };
  }

  /* --------------------------- 错题本 --------------------------- */
  function addWrong(qid, meta) {
    var db = load();
    var prev = db.wrong[qid] || {};
    var item = {
      times: (prev.times || 0) + 1,
      at: Date.now(),
      sessionId: prev.sessionId || null,
      bankId: prev.bankId || null,
      modeName: prev.modeName || null
    };
    if (typeof meta === 'string') item.sessionId = meta;
    else if (meta && typeof meta === 'object') {
      if (meta.sessionId) item.sessionId = meta.sessionId;
      if (meta.bankId) item.bankId = meta.bankId;
      if (meta.modeName) item.modeName = meta.modeName;
    }
    db.wrong[qid] = item;
    commit();
  }
  function removeWrong(qid) { delete load().wrong[qid]; commit(); }
  function removeWrongMany(qids) {
    var db = load();
    (qids || []).forEach(function (qid) { delete db.wrong[qid]; });
    commit();
  }
  function isWrong(qid) { return !!load().wrong[qid]; }
  function wrongList() {
    var db = load();
    return Object.keys(db.wrong)
      .filter(function (qid) { return !!HZQ.data.question(qid); })
      .map(function (qid) { return { qid: qid, info: db.wrong[qid] }; })
      .sort(function (a, b) { return b.info.at - a.info.at; });
  }
  function clearWrong() { load().wrong = {}; commit(); }

  /* --------------------------- 收藏 --------------------------- */
  function toggleFav(qid) {
    var db = load();
    if (db.fav[qid]) { delete db.fav[qid]; commit(); return false; }
    db.fav[qid] = Date.now(); commit(); return true;
  }
  function removeFav(qid) { delete load().fav[qid]; commit(); }
  function removeFavMany(qids) {
    var db = load();
    (qids || []).forEach(function (qid) { delete db.fav[qid]; });
    commit();
  }
  function isFav(qid) { return !!load().fav[qid]; }
  function favList() {
    var db = load();
    return Object.keys(db.fav)
      .filter(function (qid) { return !!HZQ.data.question(qid); })
      .map(function (qid) { return { qid: qid, info: { at: db.fav[qid] } }; })
      .sort(function (a, b) { return b.info.at - a.info.at; });
  }
  function clearFav() { load().fav = {}; commit(); }

  /* --------------------------- 历史成绩 --------------------------- */
  function addHistory(rec) {
    var db = load();
    db.history.unshift(rec);
    if (db.history.length > HISTORY_MAX) db.history.length = HISTORY_MAX;
    commit();
    return rec;
  }
  function history() { return load().history.slice(); }
  function historyOf(id) {
    return load().history.filter(function (h) { return h.id === id; })[0] || null;
  }
  function clearHistory() { load().history = []; commit(); }

  function removeHistoryMany(ids) {
    var db = load();
    var drop = {};
    (ids || []).forEach(function (id) { drop[id] = 1; });
    db.history = db.history.filter(function (rec) { return !drop[rec.id]; });
    commit();
  }

  /** 从某一轮成绩里删除指定题目，并按剩余题目重新计算这一轮的成绩 */
  function removeHistoryQuestions(sessionId, qids) {
    var db = load();
    var rec = db.history.filter(function (h) { return h.id === sessionId; })[0];
    if (!rec) return;
    var drop = {};
    (qids || []).forEach(function (qid) { drop[qid] = 1; });
    rec.questionIds = (rec.questionIds || []).filter(function (qid) { return !drop[qid]; });
    Object.keys(drop).forEach(function (qid) { if (rec.answers) delete rec.answers[qid]; });
    if (!rec.questionIds.length) {
      db.history = db.history.filter(function (h) { return h.id !== sessionId; });
      commit();
      return;
    }
    var st = HZQ.engine.statsFrom(rec.questionIds, rec.answers || {}, rec.durationMs || 0);
    rec.total = st.total;
    rec.scorable = st.scorable;
    rec.naCount = st.naCount;
    rec.answered = st.answered;
    rec.correct = st.correct;
    rec.wrong = st.wrong;
    rec.blank = st.blank;
    rec.accuracy = st.accuracy;
    commit();
  }

  /* --------------------------- 搜题历史 --------------------------- */
  function searchHistory() {
    return load().searchHistory.slice().sort(function (a, b) { return b.at - a.at; });
  }
  function addSearchRecord(keyword, count) {
    keyword = String(keyword || '').trim();
    if (!keyword) return null;
    var db = load();
    // 同一关键词只保留最近一次，历史按时间倒序展示
    db.searchHistory = db.searchHistory.filter(function (item) {
      return String(item.keyword || '').toLowerCase() !== keyword.toLowerCase();
    });
    var item = {
      id: 'sh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      keyword: keyword,
      count: count || 0,
      at: Date.now()
    };
    db.searchHistory.unshift(item);
    if (db.searchHistory.length > 100) db.searchHistory.length = 100;
    commit();
    return item;
  }
  function removeSearchHistory(ids) {
    var db = load();
    var drop = {};
    (ids || []).forEach(function (id) { drop[id] = 1; });
    db.searchHistory = db.searchHistory.filter(function (item) { return !drop[item.id]; });
    commit();
  }
  function clearSearchHistory() { load().searchHistory = []; commit(); }

  /* --------------------------- 数据体检修复记录 --------------------------- */
  function qualityFixes() { return load().qualityFixes; }
  function addQualityFixes(items) {
    var db = load();
    Object.keys(items || {}).forEach(function (key) {
      var it = items[key] || {};
      db.qualityFixes[key] = {
        at: Date.now(),
        questionId: it.questionId || '',
        code: it.code || '',
        label: it.label || it.code || key
      };
    });
    commit();
  }
  function removeQualityFixes(keys) {
    var db = load();
    (keys || []).forEach(function (key) { delete db.qualityFixes[key]; });
    commit();
  }
  function clearQualityFixes() { load().qualityFixes = {}; commit(); }

  /* --------------------------- 用户测试 --------------------------- */
  function trialDone() { return load().trialDone || {}; }
  function markTrial(key) {
    if (!key) return;
    var db = load();
    if (db.trialDone[key]) return;
    db.trialDone[key] = Date.now();
    commit();
  }
  function addTrialFeedback(item) {
    var db = load();
    db.trialFeedback.unshift(item || {});
    if (db.trialFeedback.length > 100) db.trialFeedback.length = 100;
    commit();
  }
  function trialFeedback() { return load().trialFeedback.slice(); }
  function clearTrialFeedback() { load().trialFeedback = []; commit(); }

  /* --------------------------- 断点续答 --------------------------- */
  function saveSession(session) {
    var db = load();
    var snap = {
      id: session.id, bankId: session.bankId, mode: session.mode, modeName: session.modeName,
      instant: session.instant, timed: session.timed, autoNext: session.autoNext,
      timeLimitMin: session.timeLimitMin,
      chapterIds: session.chapterIds, knowledgeIds: session.knowledgeIds, questionIds: session.questionIds,
      index: session.index, answers: session.answers,
      startedAt: session.startedAt, questionStartedAt: session.questionStartedAt,
      elapsedMs: session.elapsedMs, finished: session.finished
    };
    db.session[session.bankId] = snap;
    db.lastSession = { bankId: session.bankId, at: Date.now() };
    commit();
    return snap;
  }
  function loadSession(bankId) { return load().session[bankId] || null; }
  function clearSession(bankId) {
    var db = load();
    delete db.session[bankId];
    if (db.lastSession && db.lastSession.bankId === bankId) db.lastSession = null;
    commit();
  }
  function lastSession() { return load().lastSession; }

  /** 断点续答快照是否还值得恢复（没做完、且有作答记录） */
  function resumable(bankId) {
    var s = loadSession(bankId);
    if (!s || s.finished) return null;
    var answered = Object.keys(s.answers || {}).length;
    if (!answered && s.index === 0) return null;
    return s;
  }

  /* --------------------------- 导入 / 导出 / 清空 --------------------------- */
  function data() { return load(); }
  function exportAll() {
    return JSON.stringify({ app: 'henu-quiz', exportedAt: Date.now(), db: load() }, null, 2);
  }
  function importAll(text) {
    var obj = JSON.parse(text);
    var db = obj && obj.db ? obj.db : obj;
    if (!db || typeof db !== 'object' || !db.settings) throw new Error('文件格式不对');
    var d = defaults();
    memory = {
      v: 1,
      settings: Object.assign(d.settings, db.settings || {}),
      progress: db.progress || {},
      wrong: db.wrong || {},
      fav: db.fav || {},
      history: Array.isArray(db.history) ? db.history : [],
      searchHistory: Array.isArray(db.searchHistory) ? db.searchHistory : [],
      qualityFixes: db.qualityFixes || {},
      trialDone: db.trialDone || {},
      trialFeedback: Array.isArray(db.trialFeedback) ? db.trialFeedback : [],
      session: db.session || {},
      lastSession: db.lastSession || null
    };
    commit();
    return {
      progress: Object.keys(memory.progress).length,
      wrong: Object.keys(memory.wrong).length,
      fav: Object.keys(memory.fav).length,
      history: memory.history.length
    };
  }
  function clearAll(scope) {
    var db = load();
    if (scope === 'progress') { db.progress = {}; db.session = {}; db.lastSession = null; }
    else if (scope === 'wrong') { db.wrong = {}; }
    else if (scope === 'fav') { db.fav = {}; }
    else if (scope === 'history') { db.history = []; }
    else if (scope === 'search') { db.searchHistory = []; }
    else if (scope === 'quality') { db.qualityFixes = {}; }
    else { memory = defaults(); }
    commit();
  }

  function storageUsable() { load(); return usable; }

  return {
    settings: settings, setSetting: setSetting, onChange: onChange,
    progressOf: progressOf, recordAnswer: recordAnswer, resetProgress: resetProgress,
    bankProgress: bankProgress, globalStats: globalStats,
    addWrong: addWrong, removeWrong: removeWrong, removeWrongMany: removeWrongMany,
    isWrong: isWrong, wrongList: wrongList, clearWrong: clearWrong,
    toggleFav: toggleFav, removeFav: removeFav, removeFavMany: removeFavMany,
    isFav: isFav, favList: favList, clearFav: clearFav,
    addHistory: addHistory, history: history, historyOf: historyOf, clearHistory: clearHistory,
    removeHistoryMany: removeHistoryMany, removeHistoryQuestions: removeHistoryQuestions,
    searchHistory: searchHistory, addSearchRecord: addSearchRecord,
    removeSearchHistory: removeSearchHistory, clearSearchHistory: clearSearchHistory,
    qualityFixes: qualityFixes, addQualityFixes: addQualityFixes,
    removeQualityFixes: removeQualityFixes, clearQualityFixes: clearQualityFixes,
    trialDone: trialDone, markTrial: markTrial,
    addTrialFeedback: addTrialFeedback, trialFeedback: trialFeedback, clearTrialFeedback: clearTrialFeedback,
    saveSession: saveSession, loadSession: loadSession, clearSession: clearSession,
    lastSession: lastSession, resumable: resumable,
    data: data, exportAll: exportAll, importAll: importAll, clearAll: clearAll, storageUsable: storageUsable
  };
})();
