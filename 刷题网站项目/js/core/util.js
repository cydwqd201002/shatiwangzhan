/* ==========================================================================
   util.js —— 基础工具：DOM 构建 / 图标 / 轻量 Markdown / 弹层 / 提示 / 剪贴板
   全局命名空间：window.HZQ
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.util = (function () {
  'use strict';

  /* ------------------------------ DOM ------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** el('div', {class:'x', html:'…'}, [child, 'text']) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) { children.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  }

  /** 把 HTML 字符串转成节点（只用于我们自己生成的、已转义的内容） */
  function frag(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content;
  }

  /* ------------------------------ 转义 / 富文本 ------------------------------ */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inlineMd(s) {
    return esc(s)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  /**
   * 题库原文里既有行内 `code`，也有 ``` 围栏代码块，还有 **强调**。
   * 这里做一个"够用就好"的渲染器：先按围栏切段，段内做行内替换。
   * 全程先转义再插入标签，不会引入 XSS。
   */
  function rich(s) {
    if (!s) return '';
    var parts = String(s).split('```');
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        var body = parts[i].replace(/^[A-Za-z0-9+#._-]*\r?\n/, '');
        out += '<pre class="code"><code>' + esc(body.replace(/\n+$/, '')) + '</code></pre>';
      } else {
        out += inlineMd(parts[i]);
      }
    }
    return out;
  }

  /** 题干的一行纯文本摘要（用于列表） */
  function plain(s) {
    return String(s || '')
      .replace(/```[\s\S]*?```/g, ' [代码] ')
      .replace(/[`*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------ 图标 ------------------------------ */
  var PATHS = {
    book:     '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    x:        '<path d="M18 6 6 18M6 6l12 12"/>',
    xCircle:  '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    left:     '<path d="m15 18-6-6 6-6"/>',
    right:    '<path d="m9 18 6-6-6-6"/>',
    star:     '<path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z"/>',
    moon:     '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    layers:   '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3.5 12.5 8.5 4.7 8.5-4.7"/>',
    shuffle:  '<path d="M16 4h4v4M20 4l-6.5 6.5M4 20l6-6M16 20h4v-4M20 20l-5-5M4 4l5 5"/>',
    list:     '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    history:  '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4h4"/><path d="M12 8v4.5l3 1.8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    trash:    '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16"/>',
    upload:   '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 20h16"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    grid:     '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    flag:     '<path d="M5 21V4M5 5h11l-1.5 3.5L16 12H5"/>',
    alert:    '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
    play:     '<path d="M7 4.5 19 12 7 19.5z"/>',
    refresh:  '<path d="M20 11a8 8 0 1 0-.6 4"/><path d="M20 4v7h-7"/>',
    copy:     '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    home:     '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    trophy:   '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4.5v2A3.5 3.5 0 0 0 8 10.5M17 5h2.5v2A3.5 3.5 0 0 1 16 10.5"/><path d="M12 14v3M9 20h6M10 17h4"/>',
    fire:     '<path d="M12 3s4.5 4 4.5 8.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 8 12 3 12 3z"/><path d="M12 21a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z"/>',
    bookmark: '<path d="M6 4h12v17l-6-4.5L6 21z"/>',
    filter:   '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    eye:      '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
    zap:      '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    lightbulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
    chart:    '<path d="M4 20h16"/><rect x="6" y="10" width="3" height="7" rx="1"/><rect x="11" y="6" width="3" height="11" rx="1"/><rect x="16" y="13" width="3" height="4" rx="1"/>',
    shield:   '<path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    pause:    '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
    user:     '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'
  };

  function icon(name, cls) {
    var p = PATHS[name];
    if (!p) return '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function iconEl(name, cls) {
    var span = el('span', { class: 'ic-' + name, html: icon(name, cls) });
    return span.firstElementChild || span;
  }

  /* ------------------------------ 格式化 ------------------------------ */
  function pct(n) { return Math.round(n * 100) + '%'; }

  function dur(ms) {
    if (!ms || ms < 0) ms = 0;
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s = s % 60; m = m % 60;
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return h > 0 ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
  }
  function durText(ms) {
    var s = Math.round((ms || 0) / 1000);
    if (s < 60) return s + ' 秒';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分 ' + (s % 60) + ' 秒';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }
  function dateText(ts) {
    var d = new Date(ts), n = new Date();
    var sameDay = d.toDateString() === n.toDateString();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if (sameDay) return '今天 ' + hm;
    var y = new Date(n.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function agoText(ts) {
    var d = Date.now() - ts;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
    if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
    return Math.floor(d / 86400000) + ' 天前';
  }

  /* ------------------------------ 提示 / 弹层 ------------------------------ */
  function toast(msg, kind) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var name = kind === 'ok' ? 'checkCircle' : (kind === 'bad' ? 'xCircle' : 'info');
    var node = el('div', { class: 'toast ' + (kind || ''), html: icon(name) + '<span>' + esc(msg) + '</span>' });
    root.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }, 2000);
  }

  var overlayRoot, escHandler = null;

  function closeOverlay() {
    if (!overlayRoot) return;
    var r = document.getElementById('overlay-root');
    r.innerHTML = '';
    overlayRoot = null;
    if (escHandler) { document.removeEventListener('keydown', escHandler, true); escHandler = null; }
  }

  /**
   * openSheet({title, body, actions:[{text, kind, onClick(close)}], wide, onClose})
   * 返回 close 函数。点遮罩 / 按 Esc 关闭。
   */
  function openSheet(opt) {
    closeOverlay();
    var root = document.getElementById('overlay-root');
    var body = opt.body;
    var sheet = el('div', { class: 'sheet' + (opt.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' });
    sheet.appendChild(el('div', { class: 'sh-head' }, [
      el('h3', { text: opt.title || '' }),
      el('button', { class: 'icon-btn', 'aria-label': '关闭', html: icon('x'), onclick: closeOverlay })
    ]));
    var bodyEl = el('div', { class: 'sh-body' });
    append(bodyEl, body);
    sheet.appendChild(bodyEl);
    if (opt.actions && opt.actions.length) {
      var foot = el('div', { class: 'sh-foot' });
      opt.actions.forEach(function (a) {
        foot.appendChild(el('button', {
          class: 'btn ' + (a.kind || ''), text: a.text,
          onclick: function () { a.onClick ? a.onClick(closeOverlay) : closeOverlay(); }
        }));
      });
      sheet.appendChild(foot);
    }
    var ov = el('div', { class: 'overlay' }, [sheet]);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeOverlay(); });
    root.appendChild(ov);

    escHandler = function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeOverlay(); if (opt.onClose) opt.onClose(); }
    };
    document.addEventListener('keydown', escHandler, true);
    overlayRoot = ov;
    var focusable = sheet.querySelector('.btn.primary, .btn, button, input');
    if (focusable) focusable.focus();
    return closeOverlay;
  }

  /** 确认框，返回 Promise<boolean> */
  function confirmBox(opt) {
    return new Promise(function (resolve) {
      var done = false;
      openSheet({
        title: opt.title || '确认',
        body: opt.body,
        actions: [
          { text: opt.cancelText || '取消', onClick: function (close) { done = true; close(); resolve(false); } },
          { text: opt.okText || '确定', kind: opt.danger ? 'danger' : 'primary',
            onClick: function (close) { done = true; close(); resolve(true); } }
        ],
        onClose: function () { if (!done) resolve(false); }
      });
    });
  }

  /* ------------------------------ 剪贴板 ------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ------------------------------ 其它 ------------------------------ */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  return {
    $: $, $$: $$, el: el, append: append, frag: frag,
    esc: esc, rich: rich, plain: plain,
    icon: icon, iconEl: iconEl,
    pct: pct, dur: dur, durText: durText, dateText: dateText, agoText: agoText,
    toast: toast, openSheet: openSheet, closeOverlay: closeOverlay, confirmBox: confirmBox,
    copyText: copyText, shuffle: shuffle, download: download, clamp: clamp
  };
})();
