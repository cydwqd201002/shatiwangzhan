/* ==========================================================================
   ui.js —— 视图层共用的小积木（环形进度、统计块、空状态、题目标签……）
   只产出 DOM，不含业务规则。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.ui = (function () {
  'use strict';
  var M = HZQ.util, el = M.el;

  /** 环形进度条 */
  function ring(ratio, size, text, cls) {
    size = size || 62;
    var stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var off = c * (1 - M.clamp(ratio || 0, 0, 1));
    var wrap = el('div', { class: 'ring', style: 'width:' + size + 'px;height:' + size + 'px' });
    wrap.innerHTML =
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle class="track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"/>' +
      '<circle class="val ' + (cls || '') + '" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" ' +
      'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/></svg>' +
      '<div class="txt">' + M.esc(text || '') + '</div>';
    return wrap;
  }

  /** 正确 / 错误 / 未答 三段条 */
  function barSplit(correct, wrong, blank) {
    var t = Math.max(1, correct + wrong + blank);
    var w = function (n) { return (n / t * 100).toFixed(2) + '%'; };
    var node = el('div', { class: 'bar-split' });
    node.innerHTML = '<i class="ok" style="width:' + w(correct) + '"></i>' +
                     '<i class="bad" style="width:' + w(wrong + blank) + '"></i>';
    return node;
  }

  function statCard(v, l, cls) {
    var n = el('div', { class: 'stat ' + (cls || '') });
    n.appendChild(el('div', { class: 'v', text: String(v) }));
    n.appendChild(el('div', { class: 'l', text: l }));
    return n;
  }

  function pageHead(title, sub, actions) {
    var head = el('div', { class: 'page-head' });
    var row = el('div', { class: 'row' });
    var left = el('div');
    left.appendChild(el('h1', { text: title }));
    if (sub) left.appendChild(el('div', { class: 'sub', html: sub }));
    row.appendChild(left);
    if (actions) {
      var right = el('div', { class: 'row-2' });
      actions.forEach(function (a) { right.appendChild(a); });
      row.appendChild(right);
    }
    head.appendChild(row);
    return head;
  }

  function crumb(text, onClick) {
    var b = el('button', { class: 'crumb', onclick: onClick });
    b.innerHTML = M.icon('left') + '<span>' + M.esc(text) + '</span>';
    return b;
  }

  function empty(iconName, title, desc, action) {
    var n = el('div', { class: 'empty' });
    n.appendChild(el('div', { class: 'ico', html: M.icon(iconName) }));
    n.appendChild(el('h3', { text: title }));
    if (desc) n.appendChild(el('p', { text: desc }));
    if (action) {
      var wrap = el('div', { class: 'row-2', style: 'justify-content:center;margin-top:16px' });
      wrap.appendChild(action);
      n.appendChild(wrap);
    }
    return n;
  }

  function btn(text, opts) {
    opts = opts || {};
    var b = el('button', { class: 'btn ' + (opts.kind || '') + (opts.small ? ' sm' : '') + (opts.block ? ' block' : '') });
    if (opts.icon) b.innerHTML = M.icon(opts.icon);
    b.appendChild(el('span', { text: text }));
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    if (opts.disabled) b.disabled = true;
    if (opts.title) b.title = opts.title;
    return b;
  }

  function iconBtn(iconName, label, onClick, cls) {
    var b = el('button', { class: 'icon-btn ' + (cls || ''), 'aria-label': label, title: label, onclick: onClick });
    b.innerHTML = M.icon(iconName);
    return b;
  }

  /** 题型标签 */
  function typeTag(q) {
    var cls = q.type === 'multiple' ? 'pri' : (q.type === 'judge' ? 'line' : '');
    return el('span', { class: 'tag ' + cls, text: HZQ.grading.typeName(q) });
  }

  /** 数据异常标签（有则显示） */
  function issueTag(q) {
    if (q.scorable) return null;
    var t = el('span', { class: 'tag warn', title: HZQ.grading.anomalyText(q) });
    t.innerHTML = M.icon('alert') + '<span>数据异常 · 不计分</span>';
    return t;
  }

  function secTitle(text) {
    return el('div', { class: 'sec-title', text: text });
  }

  return {
    ring: ring, barSplit: barSplit, statCard: statCard, pageHead: pageHead, crumb: crumb,
    empty: empty, btn: btn, iconBtn: iconBtn, typeTag: typeTag, issueTag: issueTag, secTitle: secTitle
  };
})();
