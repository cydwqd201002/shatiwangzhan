/* ==========================================================================
   views/setup.js —— 题库详情 / 开始练习前的设置
   把"一套两百多题，今天只想刷第一章""考前只想看几道重点题"这些场景
   变成几个开关，而不是让用户从第一题开始硬刷。
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.setup = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var LIMITS = [
    { v: 0, label: '全部' },
    { v: 20, label: '20 题' },
    { v: 50, label: '50 题' },
    { v: 100, label: '100 题' }
  ];

  function render(params) {
    var bank = HZQ.data.bank(params.bankId);
    if (!bank) return U.empty('alert', '题库不存在', '可能链接过期了', U.btn('回首页', { kind: 'primary', onClick: function () { HZQ.app.go('#/'); } }));

    var s = HZQ.store.settings();
    var chapters = HZQ.data.knowledgeChapters(bank.id);
    var st = {
      mode: params.mode && HZQ.engine.MODES[params.mode] ? params.mode : 'sequence',
      chapterIds: [],
      knowledgeIds: [],
      limit: 0,
      shuffle: false,
      instant: !!s.instant,
      timed: false,
      timeLimitMin: 30,
      autoNext: !!s.autoNext,
      examBank: true,
      examChapter: false,
      examWrong: false,
      examFav: false
    };

    var root = el('div');
    root.appendChild(U.crumb('返回题库列表', function () { HZQ.app.go('#/'); }));

    var p = HZQ.store.bankProgress(bank.id);
    root.appendChild(U.pageHead(bank.title, M.esc(bank.desc), [
      U.btn('随机来 10 题', { icon: 'shuffle', small: true, onClick: function () {
        HZQ.app.start({ bankId: bank.id, mode: 'random', limit: 10 });
      } })
    ]));

    /* ---------- 概览 ---------- */
    var stats = el('div', { class: 'stats', style: 'margin-bottom:20px' });
    stats.appendChild(U.statCard(bank.questionCount, '总题数'));
    stats.appendChild(U.statCard(p.done, '已作答', 'pri'));
    stats.appendChild(U.statCard(p.done ? M.pct(p.accuracy) : '—', '正确率', 'ok'));
    stats.appendChild(U.statCard(bank.questions.filter(function (q) { return HZQ.store.isWrong(q.id); }).length, '错题', 'bad'));
    stats.appendChild(U.statCard(bank.questions.filter(function (q) { return HZQ.store.isFav(q.id); }).length, '收藏'));
    root.appendChild(stats);

    /* ---------- 数据质量提示 ---------- */
    if (bank.questionCount > bank.scorableCount) {
      var n = bank.questionCount - bank.scorableCount;
      var tip = el('div', { class: 'issue err', style: 'margin-bottom:20px' });
      tip.appendChild(el('span', { class: 'tag bad', text: n + ' 题不计分' }));
      var msg = el('div', { class: 'msg' });
      msg.innerHTML = '原始题库中有 ' + n + ' 道题缺少答案或选项，这些题仍可查看和作答，但不计入成绩。' +
        ' <a href="#/quality/' + bank.id + '">查看详情</a>';
      tip.appendChild(msg);
      root.appendChild(tip);
    }

    /* ---------- 练习模式 ---------- */
    var modeWrap = el('div');
    root.appendChild(U.secTitle('练习方式'));
    var modeGrid = el('div', { class: 'setup-grid' });
    var modeOrder = ['sequence', 'random', 'chapter', 'fresh', 'wrong', 'fav', 'exam'];
    modeOrder.forEach(function (k) {
      var def = HZQ.engine.MODES[k];
      var count = 0;
      try {
        count = HZQ.engine.buildList({ bankId: bank.id, mode: k, knowledgeIds: st.knowledgeIds, shuffle: false, limit: 0 }).length;
      } catch (e) { count = 0; }
      var disabled = count === 0;
      var b = el('button', {
        class: 'tile' + (disabled ? '' : ''), style: 'margin-bottom:8px' + (disabled ? ';opacity:.5;cursor:not-allowed' : ''),
        onclick: function () { if (disabled) return; st.mode = k; paint(); }
      });
      var row = el('div', { class: 'optrow' });
      row.appendChild(el('span', { class: 'ic', html: M.icon(def.icon) }));
      var t = el('div', { class: 'grow' });
      t.appendChild(el('div', { class: 't', text: def.name + (k === 'exam' ? '（计时）' : '') }));
      t.appendChild(el('div', { class: 'd', text: def.desc }));
      row.appendChild(t);
      row.appendChild(el('span', { class: 'tag' + (st.mode === k ? ' pri' : ''), text: disabled ? '暂无题目' : count + ' 题' }));
      b.appendChild(row);
      modeGrid.appendChild(b);
    });
    modeWrap.appendChild(modeGrid);
    root.appendChild(modeWrap);

    /* ---------- 章节选择 ---------- */
    var chapterWrap = el('div');
    root.appendChild(chapterWrap);

    /* ---------- 题量与开关 ---------- */
    var optWrap = el('div');
    root.appendChild(optWrap);

    /* ---------- 底部开始条 ---------- */
    var startbar = el('div', { class: 'startbar' });
    root.appendChild(startbar);

    function currentList() {
      if (st.mode === 'exam') return examList();
      return HZQ.engine.buildList({
        bankId: bank.id, mode: st.mode, knowledgeIds: st.knowledgeIds,
        shuffle: st.shuffle, limit: st.limit, difficulty: st.mode === 'chapter'
      });
    }

    function examList() {
      var out = [], seen = {};
      function add(list) {
        list.forEach(function (q) {
          if (!q || q.hidden || seen[q.id]) return;
          seen[q.id] = 1;
          out.push(q);
        });
      }
      if (st.examBank) add(HZQ.data.questions(bank.id));
      else {
        if (st.examChapter) add(HZQ.data.questions(bank.id, { knowledgeIds: st.knowledgeIds }));
        if (st.examWrong) add(HZQ.store.wrongList().map(function (it) { return HZQ.data.question(it.qid); }));
        if (st.examFav) add(HZQ.store.favList().map(function (it) { return HZQ.data.question(it.qid); }));
      }
      if (!out.length) out = HZQ.data.questions(bank.id);
      out = M.shuffle(out);
      return st.limit > 0 ? out.slice(0, st.limit) : out;
    }

    function chapterStats(ch) {
      var total = 0, done = 0, right = 0;
      (ch.questionIds || []).forEach(function (qid) {
        var q = HZQ.data.question(qid);
        if (!q || q.hidden) return;
        total++;
        var p = HZQ.store.progressOf(qid);
        if (p) { done++; if (p.correct) right++; }
      });
      return { total: total, done: done, right: right, accuracy: done ? right / done : 0, ratio: total ? done / total : 0 };
    }

    function chapterDifficulty(ch) {
      var min = 5, max = 1;
      (ch.questionIds || []).forEach(function (qid) {
        var q = HZQ.data.question(qid);
        if (!q || q.hidden) return;
        min = Math.min(min, q.difficulty || 1);
        max = Math.max(max, q.difficulty || 1);
      });
      return HZQ.data.difficultyLabel({ difficulty: min }) + ' → ' + HZQ.data.difficultyLabel({ difficulty: max });
    }

    function paint() {
      /* 章节 / 知识点 */
      chapterWrap.innerHTML = '';
      if (chapters.length && st.mode !== 'wrong' && st.mode !== 'fav') {
        var cHead = el('div', { class: 'spread', style: 'align-items:flex-end' });
        cHead.appendChild(U.secTitle('章节 / 知识点'));
        cHead.appendChild(U.btn('全部章节', {
          small: true, kind: st.knowledgeIds.length ? 'ghost' : 'primary',
          onClick: function () { st.knowledgeIds = []; paint(); }
        }));
        chapterWrap.appendChild(cHead);
        var grid = el('div', { class: 'chapter-grid' });
        chapters.forEach(function (ch) {
          var p = chapterStats(ch);
          var on = st.knowledgeIds.indexOf(ch.id) >= 0;
          var card = el('button', {
            class: 'chapter-card' + (on ? ' on' : ''), type: 'button',
            onclick: function () {
              var i = st.knowledgeIds.indexOf(ch.id);
              if (i >= 0) st.knowledgeIds.splice(i, 1);
              else {
                st.knowledgeIds.push(ch.id);
                if (st.mode !== 'wrong' && st.mode !== 'fav' && st.mode !== 'exam') st.mode = 'chapter';
              }
              paint();
            }
          });
          var top = el('div', { class: 'chapter-top' });
          top.appendChild(el('span', { class: 'chapter-name', text: ch.title }));
          top.appendChild(el('span', { class: 'tag line', text: chapterDifficulty(ch) }));
          card.appendChild(top);
          card.appendChild(el('div', { class: 'tiny muted', text: p.total + ' 题 · 已答 ' + p.done + ' / ' + p.total }));
          var bar = el('div', { class: 'bar thin' + (p.ratio >= 0.8 ? ' ok' : '') });
          bar.appendChild(el('i', { style: 'width:' + (p.ratio * 100).toFixed(1) + '%' }));
          card.appendChild(bar);
          card.appendChild(el('div', {
            class: 'chapter-meta',
            text: '本章正确率 ' + (p.done ? M.pct(p.accuracy) : '—')
          }));
          grid.appendChild(card);
        });
        chapterWrap.appendChild(grid);
      }

      /* 题量 / 选项 */
      optWrap.innerHTML = '';
      optWrap.appendChild(U.secTitle('这一轮做多少'));
      var seg = el('div', { class: 'seg' });
      LIMITS.forEach(function (l) {
        seg.appendChild(el('button', { class: st.limit === l.v ? 'on' : '', text: l.label, onclick: function () { st.limit = l.v; paint(); } }));
      });
      optWrap.appendChild(seg);

      var avail = st.mode === 'exam'
        ? examList().length
        : HZQ.engine.buildList({ bankId: bank.id, mode: st.mode, knowledgeIds: st.knowledgeIds, shuffle: false, limit: 0, difficulty: st.mode === 'chapter' }).length;
      if (st.limit > avail) {
        optWrap.appendChild(el('div', { class: 'tiny muted', style: 'margin-top:8px', text: '当前范围只有 ' + avail + ' 题，将全部出题。' }));
      }

      var settingsCard = el('div', { class: 'card', style: 'margin-top:14px' });
      settingsCard.appendChild(switchRow('打乱顺序', '每次出题顺序都不一样，避免靠题号记答案', st.shuffle, function (v) { st.shuffle = v; paint(); }));
      if (st.mode !== 'exam') {
        settingsCard.appendChild(switchRow('边做边判', '提交后立刻看到对错和解析；关掉则交卷后统一判分', st.instant, function (v) { st.instant = v; paint(); }));
        settingsCard.appendChild(switchRow('答对自动下一题', '连续刷题时少点一次鼠标', st.autoNext, function (v) { st.autoNext = v; paint(); }));
      }
      settingsCard.appendChild(switchRow('限时交卷', '时间到自动交卷，可设置时长', st.timed, function (v) { st.timed = v; paint(); }));
      if (st.timed) {
        var row = el('div', { class: 'setting' });
        var l = el('div');
        l.appendChild(el('div', { class: 'lbl', text: '限时时长' }));
        l.appendChild(el('div', { class: 'hint', text: '建议按每道题 30 秒估算' }));
        row.appendChild(l);
        var ctl = el('div', { class: 'ctl' });
        var sel = el('select', { class: 'select', style: 'width:110px' });
        [5, 10, 20, 30, 45, 60, 90, 120].forEach(function (m) {
          var o = el('option', { value: m, text: m + ' 分钟' });
          if (m === st.timeLimitMin) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () { st.timeLimitMin = parseInt(sel.value, 10); });
        ctl.appendChild(sel);
        row.appendChild(ctl);
        settingsCard.appendChild(row);
      }
      if (st.mode === 'exam') {
        settingsCard.appendChild(el('div', { class: 'setting' }, [
          el('div', {}, [
            el('div', { class: 'lbl', text: '考试范围' }),
            el('div', { class: 'hint', text: '可组合题库章节、错题本、收藏本；从选中范围随机抽题并打乱顺序。' })
          ])
        ]));
        settingsCard.appendChild(switchRow('整个题库', '包含当前题库所有可练习题目', st.examBank, function (v) {
          st.examBank = v;
          if (v) { st.examChapter = false; st.examWrong = false; st.examFav = false; }
          paint();
        }));
        settingsCard.appendChild(switchRow('选中的章节', st.knowledgeIds.length ? '当前选中的章节' : '未选章节时等于全部章节', st.examChapter, function (v) {
          st.examChapter = v;
          if (v) st.examBank = false;
          paint();
        }));
        settingsCard.appendChild(switchRow('错题本', '只从当前题库的错题里抽题', st.examWrong, function (v) {
          st.examWrong = v;
          if (v) st.examBank = false;
          paint();
        }));
        settingsCard.appendChild(switchRow('收藏本', '只从当前题库的收藏里抽题', st.examFav, function (v) {
          st.examFav = v;
          if (v) st.examBank = false;
          paint();
        }));
      }
      optWrap.appendChild(settingsCard);

      /* 开始条 */
      startbar.innerHTML = '';
      var list = currentList();
      var info = el('div', { class: 'info' });
      info.innerHTML = '将开始 <b>' + list.length + '</b> 题 · ' + HZQ.engine.MODES[st.mode].name +
        (st.timed ? ' · 限时 ' + st.timeLimitMin + ' 分钟' : '') +
        (st.mode === 'chapter' && st.knowledgeIds.length ? ' · 按章节由易至难' : '');
      startbar.appendChild(info);
      startbar.appendChild(U.btn('开始答题', {
        kind: 'primary', icon: 'play', disabled: list.length === 0,
        onClick: function () {
          if (st.mode === 'exam') {
            HZQ.app.start({
              bankId: bank.id, mode: 'exam', questionIds: list.map(function (q) { return q.id; }),
              shuffle: false, instant: false, timed: st.timed, timeLimitMin: st.timeLimitMin,
              autoNext: false, knowledgeIds: st.knowledgeIds
            });
            return;
          }
          HZQ.app.start({
            bankId: bank.id, mode: st.mode, knowledgeIds: st.knowledgeIds, shuffle: st.shuffle,
            limit: st.limit, instant: st.instant, timed: st.timed, timeLimitMin: st.timeLimitMin,
            autoNext: st.autoNext, difficulty: st.mode === 'chapter'
          });
        }
      }));
    }

    function chip(label, count, on, onClick) {
      var c = el('button', { class: 'chip' + (on ? ' on' : ''), onclick: onClick });
      c.appendChild(el('span', { text: label }));
      c.appendChild(el('span', { class: 'n', text: String(count) }));
      return c;
    }

    function switchRow(label, hint, on, onChange) {
      var row = el('div', { class: 'setting' });
      var l = el('div');
      l.appendChild(el('div', { class: 'lbl', text: label }));
      if (hint) l.appendChild(el('div', { class: 'hint', text: hint }));
      row.appendChild(l);
      var ctl = el('div', { class: 'ctl' });
      var sw = el('label', { class: 'switch' });
      var input = el('input', { type: 'checkbox' });
      input.checked = !!on;
      input.addEventListener('change', function () { onChange(input.checked); });
      sw.appendChild(input);
      sw.appendChild(el('span', { class: 'track' }));
      ctl.appendChild(sw);
      row.appendChild(ctl);
      return row;
    }

    paint();
    return root;
  }

  return { render: render };
})();
