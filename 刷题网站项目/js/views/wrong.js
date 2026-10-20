/* ==========================================================================
   views/wrong.js —— 错题本：按轮次重练 / 全部错题 / 全对状态
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.wrong = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  function render() {
    var list = HZQ.store.wrongList();
    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('错题本', '把错题重新练会，比一味刷新题更有用。', []));

    var latest = HZQ.store.history()[0];
    if (latest && latest.total > 0 && latest.wrong === 0 && latest.blank === 0) {
      var banner = el('div', { class: 'feedback ok', style: 'margin-bottom:16px' });
      banner.innerHTML = M.icon('checkCircle') +
        '<div class="fb-body"><b>上一轮全对！</b>　' + M.esc(latest.bankTitle + ' · ' + latest.modeName) +
        '　正确率 ' + M.pct(latest.accuracy) + '，保持这个手感。</div>';
      root.appendChild(banner);
    }

    if (!list.length) {
      var allCorrect = latest && latest.total > 0 && latest.wrong === 0 && latest.blank === 0;
      var empty = U.empty('checkCircle', allCorrect ? '全对！错题本已经清空' : '错题本还是空的',
        allCorrect ? '最近没有新的错题。继续保持，或者去刷一轮新题。' : '答题时做错的题会自动收集到这里，答对后会自动移出。',
        (function () {
          var b = U.btn('去刷题', {
            kind: 'primary', icon: 'play',
            onClick: function () { HZQ.app.go('#/'); }
          });
          if (allCorrect) b.classList.add('ok');
          return b;
        })());
      if (allCorrect) empty.classList.add('all-clear');
      root.appendChild(empty);
      return root;
    }

    var stats = el('div', { class: 'stats', style: 'margin-bottom:18px' });
    stats.appendChild(U.statCard(list.length, '待攻克', 'bad'));
    stats.appendChild(U.statCard(HZQ.store.history().length, '练习轮次'));
    stats.appendChild(U.statCard(HZQ.store.favList().length, '重点收藏', 'pri'));
    root.appendChild(stats);

    var rounds = groupRounds(list);
    root.appendChild(U.secTitle('按轮次重练'));
    rounds.forEach(function (round) {
      var card = el('div', { class: 'card pad round-card' });
      var head = el('div', { class: 'spread' });
      var info = el('div', { class: 'grow' });
      info.appendChild(el('div', { class: 'round-title', text: roundTitle(round) }));
      info.appendChild(el('div', {
        class: 'tiny muted',
        text: round.qids.length + ' 道错题 · ' + M.dateText(round.at)
      }));
      head.appendChild(info);
      head.appendChild(U.btn('重练本轮', {
        kind: 'primary', small: true, icon: 'refresh',
        onClick: function () { startRound(round); }
      }));
      card.appendChild(head);
      root.appendChild(card);
    });

    root.appendChild(U.secTitle('全部错题'));
    var toolbar = el('div', { class: 'row-2', style: 'margin-bottom:12px' });
    toolbar.appendChild(U.btn('重练全部错题', {
      kind: 'primary', icon: 'refresh',
      onClick: function () {
        startCustom(list.map(function (it) { return it.qid; }), list[0] && HZQ.data.question(list[0].qid).bankId);
      }
    }));
    toolbar.appendChild(el('span', {
      class: 'tiny muted',
      text: '新开的练习会使用同一套答题 / 判题界面，原轮成绩和进度不会被清空。'
    }));
    root.appendChild(toolbar);

    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (!q) return;
      root.appendChild(questionRow(q, it.info));
    });
    return root;
  }

  function questionRow(q, info) {
    var bank = HZQ.data.bank(q.bankId) || {};
    var chapter = (bank.chapterById || {})[q.chapterId] || null;
    var row = el('div', { class: 'qitem', tabindex: '0', role: 'button' });
    var body = el('div', { class: 'body' });
    body.appendChild(el('div', { class: 'stem-1', text: M.plain(q.stem) }));
    var meta = el('div', { class: 'meta' });
    meta.appendChild(el('span', { class: 'tag', text: bank.title || q.bankId }));
    if (chapter) meta.appendChild(el('span', { class: 'tag line', text: chapter.title }));
    meta.appendChild(U.typeTag(q));
    meta.appendChild(el('span', { class: 'tag bad', text: '错 ' + (info.times || 1) + ' 次' }));
    body.appendChild(meta);
    row.appendChild(body);

    var acts = el('div', { class: 'acts' });
    acts.appendChild(U.btn('回顾', {
      small: true, kind: 'ghost', icon: 'eye',
      onClick: function (e) {
        e.stopPropagation();
        HZQ.views.review.open(q, (HZQ.store.progressOf(q.id) || {}).picked || [], {
          title: '错题回顾', onFavChange: function () { HZQ.app.go('#/wrong'); }
        });
      }
    }));
    acts.appendChild(U.btn('移出', {
      small: true, kind: 'ghost', icon: 'check',
      onClick: function (e) {
        e.stopPropagation();
        HZQ.store.removeWrong(q.id);
        M.toast('已移出错题本', 'ok');
        HZQ.app.go('#/wrong');
      }
    }));
    row.appendChild(acts);

    row.addEventListener('click', function () {
      HZQ.views.review.open(q, (HZQ.store.progressOf(q.id) || {}).picked || [], {
        title: '错题回顾', onFavChange: function () { HZQ.app.go('#/wrong'); }
      });
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
    });
    return row;
  }

  function groupRounds(list) {
    var map = {};
    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (!q) return;
      var info = it.info || {};
      var key = info.sessionId || 'older';
      if (!map[key]) {
        map[key] = {
          id: key,
          qids: [],
          at: info.at || 0,
          bankId: info.bankId || q.bankId,
          modeName: info.modeName || '错题重练'
        };
      }
      map[key].qids.push(it.qid);
      map[key].at = Math.max(map[key].at, info.at || 0);
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.at - a.at; });
  }

  function roundTitle(round) {
    if (round.id === 'older') return '更早的错题';
    var bank = HZQ.data.bank(round.bankId) || {};
    return (bank.title || '错题') + ' · ' + (round.modeName || '练习');
  }

  function startRound(round) {
    startCustom(round.qids, round.bankId);
  }

  function startCustom(qids, bankId) {
    if (!qids || !qids.length) return;
    HZQ.store.markTrial('wrong');
    HZQ.app.start({
      bankId: bankId || HZQ.data.question(qids[0]).bankId,
      mode: 'wrong',
      questionIds: qids.slice(),
      instant: true
    });
  }

  return { render: render };
})();
