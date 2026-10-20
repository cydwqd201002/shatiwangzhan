/* ==========================================================================
   views/review.js —— 题目回顾卡片
   结果页、错题本、收藏夹、搜索结果都用它，保证"同一道题在哪看都长一样、
   判对判错也只有一个口径（HZQ.grading）"。
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.review = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  /**
   * @param q      题目
   * @param picked 用户当时的选择（数组，可为空）
   * @param opts   { showAnswer:true, compact:false }
   */
  function card(q, picked, opts) {
    opts = opts || {};
    picked = HZQ.grading.normalize(picked || []);
    var g = HZQ.grading.grade(q, picked);
    var showAnswer = opts.showAnswer !== false;

    var wrap = el('div');
    var top = el('div', { class: 'qtop' });
    top.appendChild(el('span', { class: 'no', text: '第 ' + q.no + ' 题' }));
    top.appendChild(U.typeTag(q));
    var bank = HZQ.data.bank(q.bankId);
    if (bank) top.appendChild(el('span', { class: 'tag', text: bank.title }));
    var chap = (bank && bank.chapterById[q.chapterId]) || null;
    if (chap) top.appendChild(el('span', { class: 'tag line', text: chap.title }));
    var it = U.issueTag(q);
    if (it) top.appendChild(it);
    wrap.appendChild(top);

    wrap.appendChild(el('div', { class: 'stem', style: 'font-size:15.5px', html: M.rich(q.stem) }));

    var optsWrap = el('div', { style: 'margin-top:14px' });
    q.options.forEach(function (o) {
      var isPicked = picked.indexOf(o.key) >= 0;
      var isAnswer = q.answer.indexOf(o.key) >= 0;
      var cls = 'opt locked';
      if (showAnswer && isAnswer) cls += ' right';
      else if (isPicked) cls += ' wrong';
      else if (showAnswer) cls += ' dim';
      var node = el('div', { class: cls });
      node.appendChild(el('span', { class: 'k', text: o.key }));
      node.appendChild(el('span', { class: 't', html: M.rich(o.text) }));
      var mark = el('span', { class: 'mark' });
      mark.innerHTML = M.icon(isAnswer ? 'check' : 'x');
      node.appendChild(mark);
      optsWrap.appendChild(node);
    });
    if (!q.options.length) {
      optsWrap.appendChild(el('div', { class: 'feedback na', html: M.icon('alert') + '<div class="fb-body">' + M.esc(HZQ.grading.anomalyText(q)) + '</div>' }));
    }
    wrap.appendChild(optsWrap);

    if (showAnswer) {
      var box = el('div', { class: 'feedback ' + (g === 'correct' ? 'ok' : (g === 'wrong' ? 'no' : 'na')) });
      var body = el('div', { class: 'fb-body' });
      if (g === 'correct') body.innerHTML = '<b>回答正确</b>　你的答案：' + M.esc(HZQ.grading.pickedText(picked));
      else if (g === 'wrong') body.innerHTML = '回答错误　你的答案：' + M.esc(HZQ.grading.pickedText(picked)) +
        '　正确答案：<span class="ans">' + M.esc(HZQ.grading.answerText(q)) + '</span>';
      else if (g === 'empty') body.innerHTML = '当时没有作答　正确答案：<span class="ans">' + M.esc(HZQ.grading.answerText(q)) + '</span>';
      else body.innerHTML = M.esc(HZQ.grading.anomalyText(q));
      box.innerHTML = M.icon(g === 'correct' ? 'checkCircle' : (g === 'wrong' ? 'xCircle' : (g === 'empty' ? 'info' : 'alert')));
      box.appendChild(body);
      wrap.appendChild(box);
    }

    if (showAnswer && q.explanation) {
      var ex = el('div', { class: 'explain' });
      ex.appendChild(el('div', { class: 'hd', text: '解析' }));
      ex.appendChild(el('div', { html: M.rich(q.explanation) }));
      wrap.appendChild(ex);
    }
    return wrap;
  }

  function open(q, picked, opts) {
    opts = opts || {};
    var body = el('div');
    body.appendChild(card(q, picked, opts));
    var actions = [];
    if (opts.actions) opts.actions.forEach(function (a) { actions.push(a); });
    if (opts.favToggle !== false) {
      var on = HZQ.store.isFav(q.id);
      actions.push({
        text: on ? '取消收藏' : '加入收藏', kind: on ? '' : '',
        onClick: function (close) {
          var now = HZQ.store.toggleFav(q.id);
          M.toast(now ? '已加入重点收藏' : '已取消收藏', now ? 'ok' : '');
          close();
          if (opts.onFavChange) opts.onFavChange();
        }
      });
    }
    actions.push({ text: '关闭', kind: 'primary', onClick: function (close) { close(); } });
    M.openSheet({ title: opts.title || '题目回顾', body: body, wide: true, actions: actions });
  }

  /**
   * 单独的"答案 + 关键解题点 + 知识点"面板。
   * 收藏夹和搜题预览用它，避免把答案默认摊开在列表里。
   */
  function answerPanel(q, picked, opts) {
    opts = opts || {};
    picked = HZQ.grading.normalize(picked || []);
    var g = HZQ.grading.grade(q, picked);
    var box = el('div', { class: 'answer-panel' });

    var kind = g === 'wrong' ? 'no' : (g === 'na' ? 'na' : 'ok');
    var fb = el('div', { class: 'feedback ' + kind });
    var body = el('div', { class: 'fb-body' });
    if (g === 'correct') {
      body.innerHTML = '<b>回答正确</b>　你的答案是 ' + M.esc(HZQ.grading.pickedText(picked));
    } else if (g === 'wrong') {
      body.innerHTML = '回答错误　你的答案是 ' + M.esc(HZQ.grading.pickedText(picked)) +
        '　正确答案是 <span class="ans">' + M.esc(HZQ.grading.answerText(q)) + '</span>';
    } else if (g === 'empty') {
      body.innerHTML = '正确答案是 <span class="ans">' + M.esc(HZQ.grading.answerText(q)) + '</span>';
    } else {
      body.innerHTML = M.esc(HZQ.grading.anomalyText(q));
    }
    fb.innerHTML = M.icon(g === 'correct' ? 'checkCircle' : (g === 'wrong' ? 'xCircle' : (g === 'na' ? 'alert' : 'info')));
    fb.appendChild(body);
    box.appendChild(fb);

    if (q.explanation) {
      var ex = el('div', { class: 'explain' });
      ex.appendChild(el('div', { class: 'hd', text: '关键解题点' }));
      ex.appendChild(el('div', { html: M.rich(q.explanation) }));
      box.appendChild(ex);
    } else {
      var none = el('div', { class: 'explain' });
      none.appendChild(el('div', { class: 'hd', text: '关键解题点' }));
      none.appendChild(el('div', { class: 'tiny muted', text: '原题没有提供解析，建议结合对应章节的知识点再核对一遍。' }));
      box.appendChild(none);
    }

    var bank = HZQ.data.bank(q.bankId) || {};
    var chapter = (bank.chapterById || {})[q.chapterId] || null;
    var knowledge = el('div', { class: 'knowledge' });
    knowledge.appendChild(el('div', { class: 'hd', text: '对应知识点' }));
    [
      ['题库', bank.title || q.bankId],
      ['章节 / 知识点', chapter ? chapter.title : '未分章节'],
      ['题型', HZQ.grading.typeName(q)]
    ].forEach(function (row) {
      var line = el('div', { class: 'kp-row' });
      line.appendChild(el('span', { class: 'k', text: row[0] }));
      line.appendChild(el('span', { class: 'v', text: row[1] }));
      knowledge.appendChild(line);
    });
    box.appendChild(knowledge);

    if (opts.extra) box.appendChild(opts.extra);
    return box;
  }

  return { card: card, open: open, answerPanel: answerPanel };
})();
