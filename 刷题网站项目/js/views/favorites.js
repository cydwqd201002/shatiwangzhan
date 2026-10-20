/* ==========================================================================
   views/favorites.js —— 重点收藏：先看题，点按钮才揭示答案和解析
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.favorites = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  function render() {
    var list = HZQ.store.favList();
    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('重点收藏', '答案默认收起来，先自己回忆一遍，再点开核对。', []));

    if (!list.length) {
      root.appendChild(U.empty('star', '还没有收藏题目',
        '答题时点右上角的「收藏」，或者在题目回顾里加入收藏，题目就会出现在这里。',
        U.btn('去刷题', { kind: 'primary', icon: 'play', onClick: function () { HZQ.app.go('#/'); } })));
      return root;
    }

    var stats = el('div', { class: 'stats', style: 'margin-bottom:18px' });
    stats.appendChild(U.statCard(list.length, '收藏题目', 'pri'));
    var banks = {};
    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (q) banks[q.bankId] = 1;
    });
    stats.appendChild(U.statCard(Object.keys(banks).length, '涉及题库'));
    stats.appendChild(U.statCard(HZQ.store.wrongList().length, '错题本', 'bad'));
    root.appendChild(stats);

    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (q) root.appendChild(favCard(q, it.info));
    });
    return root;
  }

  function favCard(q, info) {
    var bank = HZQ.data.bank(q.bankId) || {};
    var chapter = (bank.chapterById || {})[q.chapterId] || null;
    var card = el('div', { class: 'card pad fav-card' });

    var top = el('div', { class: 'qtop' });
    top.appendChild(el('span', { class: 'no', text: '第 ' + q.no + ' 题' }));
    top.appendChild(U.typeTag(q));
    top.appendChild(el('span', { class: 'tag', text: bank.title || q.bankId }));
    if (chapter) top.appendChild(el('span', { class: 'tag line', text: chapter.title }));
    top.appendChild(el('span', { class: 'grow' }));
    top.appendChild(el('span', { class: 'tag star', text: '收藏于 ' + M.dateText(info.at) }));
    card.appendChild(top);

    card.appendChild(el('div', { class: 'stem', style: 'font-size:15.5px', html: M.rich(q.stem) }));

    var opts = el('div', { style: 'margin-top:13px' });
    q.options.forEach(function (o) {
      var row = el('div', { class: 'opt locked' });
      row.appendChild(el('span', { class: 'k', text: o.key }));
      row.appendChild(el('span', { class: 't', html: M.rich(o.text) }));
      opts.appendChild(row);
    });
    if (!q.options.length) {
      opts.appendChild(el('div', {
        class: 'feedback na',
        html: M.icon('alert') + '<div class="fb-body">' + M.esc(HZQ.grading.anomalyText(q)) + '</div>'
      }));
    }
    card.appendChild(opts);

    var actions = el('div', { class: 'row-2', style: 'margin-top:14px' });
    var detail = el('div', { class: 'fav-detail', hidden: 'hidden' });
    var toggle = U.btn('显示答案和解析', {
      icon: 'eye', kind: 'primary', small: true,
      onClick: function () {
        var open = !detail.hasAttribute('hidden');
        if (open) {
          detail.setAttribute('hidden', 'hidden');
          detail.innerHTML = '';
          setBtn(toggle, '显示答案和解析', 'eye');
        } else {
          detail.innerHTML = '';
          detail.appendChild(HZQ.views.review.answerPanel(q, []));
          detail.removeAttribute('hidden');
          setBtn(toggle, '收起答案', 'left');
        }
      }
    });
    actions.appendChild(toggle);
    actions.appendChild(U.btn('取消收藏', {
      small: true, kind: 'ghost', icon: 'star',
      onClick: function () {
        HZQ.store.removeFav(q.id);
        M.toast('已取消收藏', 'ok');
        HZQ.app.go('#/favorites');
      }
    }));
    actions.appendChild(el('span', {
      class: 'tiny muted',
      text: '先自己想一想，再核对答案，记忆会更牢。'
    }));
    card.appendChild(actions);
    card.appendChild(detail);
    return card;
  }

  function setBtn(btn, text, icon) {
    btn.innerHTML = M.icon(icon) + '<span>' + M.esc(text) + '</span>';
  }

  return { render: render };
})();
