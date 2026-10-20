/* ==========================================================================
   profile.js —— 本地多用户账户
   纯静态版：账户、密码摘要和各用户数据都保存在本机 localStorage。
   不提供跨设备同步；这不是服务器账号系统。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.profile = (function () {
  'use strict';
  var KEY = 'hqz.profiles.v1';
  var M = HZQ.util;
  var memory = null;
  var saveTimer = null;

  function load() {
    if (memory) return memory;
    try {
      var raw = localStorage.getItem(KEY);
      memory = raw ? JSON.parse(raw) : null;
    } catch (e) { memory = null; }
    if (!memory || typeof memory !== 'object') memory = { active: null, users: {} };
    if (!memory.users) memory.users = {};
    return memory;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {}
  }
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveActive();
    }, 250);
  }
  function saveActive() {
    var db = load();
    if (!db.active || !db.users[db.active]) return;
    db.users[db.active].db = HZQ.store.data();
    persist();
  }
  function current() {
    var db = load();
    return db.active && db.users[db.active] ? db.active : null;
  }
  function list() {
    var db = load();
    return Object.keys(db.users).map(function (name) {
      return { name: name, createdAt: db.users[name].createdAt };
    }).sort(function (a, b) { return a.createdAt - b.createdAt; });
  }
  function randomSalt() {
    var arr = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(arr, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function fallbackHash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return 'fnv-' + h.toString(16);
  }
  function hashPassword(password, salt) {
    var text = salt + ':' + password;
    if (window.crypto && crypto.subtle && crypto.subtle.digest && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) {
          return ('0' + x.toString(16)).slice(-2);
        }).join('');
      }).catch(function () { return fallbackHash(text); });
    }
    return Promise.resolve(fallbackHash(text));
  }
  function register(name, password) {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_\u4e00-\u9fa5]{2,24}$/.test(name)) {
      return Promise.reject(new Error('用户名需要 2-24 位，可用中文、字母、数字、下划线'));
    }
    if (String(password || '').length < 4) return Promise.reject(new Error('密码至少 4 位'));
    var db = load();
    if (db.users[name]) return Promise.reject(new Error('这个用户名已经存在'));
    var salt = randomSalt();
    return hashPassword(password, salt).then(function (hash) {
      if (db.active) saveActive();
      db.users[name] = {
        name: name, salt: salt, hash: hash, createdAt: Date.now(),
        db: HZQ.store.data()
      };
      db.active = name;
      persist();
      return name;
    });
  }
  function login(name, password) {
    var db = load();
    var user = db.users[name];
    if (!user) return Promise.reject(new Error('用户名或密码不正确'));
    return hashPassword(password, user.salt).then(function (hash) {
      if (hash !== user.hash) throw new Error('用户名或密码不正确');
      if (db.active && db.active !== name) saveActive();
      db.active = name;
      persist();
      if (user.db) HZQ.store.importAll(JSON.stringify({ db: user.db }));
      return name;
    });
  }
  function logout() {
    saveActive();
    var db = load();
    db.active = null;
    persist();
    HZQ.store.clearAll();
  }
  function init() {
    var db = load();
    if (db.active && db.users[db.active] && db.users[db.active].db) {
      HZQ.store.importAll(JSON.stringify({ db: db.users[db.active].db }));
    }
    HZQ.store.onChange(scheduleSave);
    window.addEventListener('pagehide', saveActive);
  }
  function dialog(mode, onDone) {
    mode = mode === 'register' ? 'register' : 'login';
    var body = M.el('div');
    var user = M.el('input', { class: 'input', placeholder: '用户名', autocomplete: 'username' });
    var pass = M.el('input', { class: 'input', type: 'password', placeholder: '密码', autocomplete: mode === 'register' ? 'new-password' : 'current-password' });
    body.appendChild(M.el('div', { class: 'field' }, [M.el('label', { text: '用户名' }), user]));
    body.appendChild(M.el('div', { class: 'field' }, [M.el('label', { text: '密码' }), pass]));
    var tip = M.el('div', { class: 'tiny muted', text: '账户和密码只保存在本机，不会上传服务器；换设备不会同步。' });
    body.appendChild(tip);
    var err = M.el('div', { class: 'feedback na', style: 'display:none;margin-top:12px' });
    body.appendChild(err);

    function submit(close) {
      err.style.display = 'none';
      var fn = mode === 'register' ? register : login;
      fn(user.value, pass.value).then(function (name) {
        close();
        M.toast((mode === 'register' ? '已创建并登录：' : '已登录：') + name, 'ok');
        if (onDone) onDone(name);
        else setTimeout(function () { location.reload(); }, 250);
      }).catch(function (e) {
        err.style.display = '';
        err.innerHTML = M.icon('alert') + '<div class="fb-body">' + M.esc(e && e.message || e) + '</div>';
      });
    }

    M.openSheet({
      title: mode === 'register' ? '注册本地账户' : '登录本地账户',
      body: body,
      actions: [
        { text: '取消', onClick: function (close) { close(); } },
        { text: mode === 'register' ? '注册并登录' : '登录', kind: 'primary', onClick: function (close) { submit(close); } }
      ]
    });
    setTimeout(function () { user.focus(); }, 0);
  }
  return {
    init: init, current: current, list: list,
    register: register, login: login, logout: logout,
    saveActive: saveActive, dialog: dialog
  };
})();
