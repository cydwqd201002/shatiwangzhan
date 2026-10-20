/* ==========================================================================
   views/quiz.js —— 答题页
   覆盖的场景：
     · 提交后立刻知道对错、错题给出正确答案与解析
     · 上一题 / 下一题 / 答题卡任意跳转，随时看到进度与已答对数量
     · 熄灯宿舍：深色模式；地铁上一只手：底部大按钮 + 左右滑动
     · 做到一半被叫走：每步自动存盘，回来能接着做
     · 考前重点题：随手收藏
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.quiz = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var root, s, headEl, bodyEl, footEl, mobileEl, timerId = null, keyHandler = null, touchStart = null;

  function render(params) {
    s = HZQ.app.session();
    if (!s || s.bankId !== params.bankId) {
      // 页面刷新 / 直接输入链接：尝试从本地快照恢复
      var snap = HZQ.store.loadSession(params.bankId);
      if (snap) {
        var restored = HZQ.engine.restore(snap);
        if (restored && !restored.finished) {
          s = restored;
          HZQ.app.setSession(s);
        }
      }
    }
    if (!s || !HZQ.engine.total(s)) {
      return U.empty('alert', '这一轮练习已经不在了',
        '可能是刷新后会话已结束，重新选一个方式开始吧',
        U.btn('返回题库', { kind: 'primary', onClick: function () { HZQ.app.go('#/bank/' + params.bankId); } }));
    }

    HZQ.engine.resume(s);
    root = el('div');
    headEl = el('div', { class: 'quiz-head' });
    bodyEl = el('div');
    footEl = el('div', { class: 'quiz-foot' });
    mobileEl = el('div', { class: 'mobile-bar' });
    root.appendChild(headEl);
    root.appendChild(bodyEl);
    root.appendChild(footEl);
    root.appendChild(mobileEl);
    document.body.appendChild(mobileEl);
    document.body.classList.add('has-mobile-bar');

    paint();
    bindSwipe(bodyEl);
    startTimer();
    return root;
  }

  function mount() {
    keyHandler = function (e) {
      if (!HZQ.store.settings().keyboard) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (document.querySelector('.overlay')) return;
      var q = HZQ.engine.current(s);
      if (!q) return;
      var k = e.key.toUpperCase();
      var letterIdx = 'ABCDEFGH'.indexOf(k);
      if (letterIdx >= 0 && letterIdx < q.options.length) {
        var r = HZQ.engine.record(s);
        if (r && r.submitted && s.instant) return;
        HZQ.engine.pick(s, q.options[letterIdx].key);
        paint();
        e.preventDefault();
        return;
      }
      if (/^[1-8]$/.test(e.key)) {
        var i = parseInt(e.key, 10) - 1;
        if (i < q.options.length) {
          var r2 = HZQ.engine.record(s);
          if (r2 && r2.submitted && s.instant) return;
          HZQ.engine.pick(s, q.options[i].key);
          paint();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Enter') { doSubmit(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault(); return; }
      if (k === 'S') { toggleFav(); e.preventDefault(); return; }
      if (k === 'M') { HZQ.app.toggleTheme(); return; }
    };
    document.addEventListener('keydown', keyHandler);
    window.addEventListener('pagehide', save);
  }

  function unmount() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    window.removeEventListener('pagehide', save);
    document.body.classList.remove('has-mobile-bar');
    if (mobileEl && mobileEl.parentNode) mobileEl.parentNode.removeChild(mobileEl);
  }

  function save() { HZQ.store.saveSession(HZQ.engine.snapshot(s)); }

  /* ------------------------------ 渲染 ------------------------------ */
  function paint() {
    var q = HZQ.engine.current(s);
    var st = HZQ.engine.stats(s);
    var total = HZQ.engine.total(s);
    var r = HZQ.engine.record(s) || { picked: [], submitted: false, grade: null };

    /* --- 顶部进度 --- */
    headEl.innerHTML = '';
    var l1 = el('div', { class: 'l1' });
    l1.appendChild(U.iconBtn('left', '返回', function () { leaveConfirm(); }));
    var title = el('div', { class: 'title', text: (HZQ.data.bank(s.bankId) || {}).title + ' · ' + s.modeName });
    l1.appendChild(title);
    var counter = el('div', { class: 'counter' });
    counter.innerHTML = '<b>' + (s.index + 1) + '</b> / ' + total + ' 题';
    l1.appendChild(counter);
    var timer = el('div', { class: 'timer', id: 'quiz-timer' });
    l1.appendChild(timer);
    headEl.appendChild(l1);

    var bar = el('div', { class: 'bar thin' });
    bar.appendChild(el('i', { style: 'width:' + ((s.index + 1) / total * 100).toFixed(2) + '%' }));
    headEl.appendChild(bar);

    var l2 = el('div', { class: 'row-2', style: 'margin-top:8px' });
    var prog = el('span', { class: 'tiny muted' });
    prog.innerHTML = '已答 <b>' + st.answered + '</b> · 答对 <b style="color:var(--ok)">' + st.correct +
      '</b> · 答错 <b style="color:var(--bad)">' + st.wrong + '</b>' + (st.naCount ? ' · 不计分 ' + st.naCount : '');
    l2.appendChild(prog);
    l2.appendChild(el('span', { class: 'grow' }));
    var jump = el('select', { class: 'select jump-select', 'aria-label': '跳到题目' });
    for (var ji = 0; ji < total; ji++) {
      var jo = el('option', { value: ji, text: '跳到第 ' + (ji + 1) + ' 题' });
      if (ji === s.index) jo.selected = true;
      jump.appendChild(jo);
    }
    jump.addEventListener('change', function () {
      HZQ.engine.goTo(s, parseInt(jump.value, 10) || 0);
      paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    l2.appendChild(jump);
    var sheetBtn = U.btn('题目列表', { small: true, kind: 'ghost', icon: 'grid', onClick: openSheetView });
    l2.appendChild(sheetBtn);
    headEl.appendChild(l2);

    updateTimerText();

    /* --- 题面 --- */
    bodyEl.innerHTML = '';
    if (!q) { bodyEl.appendChild(U.empty('alert', '题目丢失', '')); return; }
    var card = el('div', { class: 'card qcard' });

    var qtop = el('div', { class: 'qtop' });
    qtop.appendChild(el('span', { class: 'no', text: '第 ' + (s.index + 1) + ' 题' }));
    qtop.appendChild(U.typeTag(q));
    var it = U.issueTag(q);
    if (it) qtop.appendChild(it);
    if (r.late) qtop.appendChild(el('span', { class: 'tag', text: '交卷时自动判分' }));
    qtop.appendChild(el('span', { class: 'grow' }));
    var fav = HZQ.store.isFav(q.id);
    var favBtn = el('button', {
      class: 'btn sm star-btn' + (fav ? ' on' : ''),
      title: '收藏 / 取消收藏（快捷键 S）',
      onclick: toggleFav
    });
    favBtn.innerHTML = M.icon('star') + '<span>' + (fav ? '已收藏' : '收藏') + '</span>';
    qtop.appendChild(favBtn);
    card.appendChild(qtop);

    var stem = el('div', { class: 'stem', html: M.rich(q.stem) });
    card.appendChild(stem);

    if (HZQ.grading.isMultiple(q)) {
      card.appendChild(el('div', { class: 'qhint', text: '多选题：选出所有正确选项（可多选）' }));
    }

    /* --- 选项 --- */
    var optsWrap = el('div', { style: 'margin-top:16px' });
    if (!q.options.length) {
      optsWrap.appendChild(el('div', { class: 'feedback na', html: M.icon('alert') + '<div class="fb-body">' + M.esc(HZQ.grading.anomalyText(q)) + '</div>' }));
    }
    q.options.forEach(function (o) {
      var cls = 'opt';
      var isPicked = r.picked.indexOf(o.key) >= 0;
      var isAnswer = q.answer.indexOf(o.key) >= 0;
      var graded = r.submitted && s.instant;
      if (graded) {
        cls += ' locked';
        if (isAnswer) cls += ' right';
        else if (isPicked) cls += ' wrong';
        else cls += ' dim';
      } else if (isPicked) {
        cls += ' sel';
      }
      var node = el('button', {
        class: cls, type: 'button',
        'aria-pressed': isPicked ? 'true' : 'false',
        onclick: function () { onPick(o.key); }
      });
      node.appendChild(el('span', { class: 'k', text: o.key }));
      node.appendChild(el('span', { class: 't', html: M.rich(o.text) }));
      var mark = el('span', { class: 'mark' });
      mark.innerHTML = M.icon(isAnswer ? 'check' : 'x');
      node.appendChild(mark);
      optsWrap.appendChild(node);
    });
    card.appendChild(optsWrap);

    /* --- 判题反馈 + 解析 --- */
    if (r.submitted && s.instant) {
      card.appendChild(feedbackBlock(q, r));
      if (HZQ.store.settings().showExplain && q.explanation) card.appendChild(explainBlock(q));
    } else if (r.submitted && !s.instant) {
      card.appendChild(el('div', { class: 'feedback', html: M.icon('check') + '<div class="fb-body">已作答，交卷后统一判分。</div>' }));
    }

    bodyEl.appendChild(card);
    if (s.mode !== 'exam' && HZQ.comments) bodyEl.appendChild(commentsPanel(q));

    /* --- 页内操作区（桌面） --- */
    footEl.innerHTML = '';
    footEl.appendChild(desktopActions(q, r));

    /* --- 移动端底部条 --- */
    mobileEl.innerHTML = '';
    var min = el('div', { class: 'in' });
    var prevBtn = U.btn('', { kind: 'ghost', icon: 'left', onClick: function () { go(-1); } });
    prevBtn.classList.add('icon-only');
    prevBtn.disabled = !HZQ.engine.hasPrev(s);
    min.appendChild(prevBtn);

    if (s.instant) {
      if (r.submitted) {
        min.appendChild(U.btn('下一题', { kind: 'primary', icon: 'right', onClick: function () { go(1); } }));
      } else {
        min.appendChild(U.btn('提交答案', { kind: 'primary', onClick: doSubmit, disabled: !r.picked.length }));
      }
    } else {
      min.appendChild(U.btn('下一题', { kind: 'primary', icon: 'right', onClick: function () { go(1); } }));
    }
    min.appendChild(U.btn('交卷', { kind: 'ghost', onClick: openFinish }));
    var nextBtn = U.btn('', { kind: 'ghost', icon: 'right', onClick: function () { go(1); } });
    nextBtn.classList.add('icon-only');
    nextBtn.disabled = !HZQ.engine.hasNext(s);
    min.appendChild(nextBtn);
    mobileEl.appendChild(min);

    save();
  }

  function commentsPanel(q) {
    var wrap = el('div', { class: 'card pad comments-card' });
    var head = el('div', { class: 'spread' });
    head.appendChild(U.secTitle('评论 · ' + HZQ.comments.count(q.id)));
    head.appendChild(el('span', { class: 'tiny muted', text: '仅保存在本机，多个本地账户可见' }));
    wrap.appendChild(head);

    var list = el('div', { class: 'comment-list' });
    var comments = HZQ.comments.list(q.id).slice(0, 8);
    if (!comments.length) {
      list.appendChild(el('div', { class: 'tiny muted', text: '还没有人留言。说说你的思路或疑问吧。' }));
    } else {
      comments.forEach(function (item) {
        var row = el('div', { class: 'comment-item' });
        var top = el('div', { class: 'comment-head' });
        top.appendChild(el('span', { class: 'name', text: item.user || '匿名' }));
        top.appendChild(el('span', { class: 'time', text: M.dateText(item.at) }));
        row.appendChild(top);
        row.appendChild(el('div', { class: 'comment-text', text: item.text }));
        list.appendChild(row);
      });
    }
    wrap.appendChild(list);

    var form = el('div', { class: 'comment-form' });
    var name = HZQ.profile && HZQ.profile.current() || HZQ.comments.savedName() || '';
    var nameInput = el('input', { class: 'input', placeholder: '昵称（可匿名）', value: name, maxlength: '24' });
    var text = el('textarea', { class: 'input', rows: '2', placeholder: '写下你的结论、疑问或解题思路…', maxlength: '500' });
    var send = U.btn('发表评论', {
      small: true, kind: 'primary', icon: 'check',
      onClick: function () {
        var value = text.value.trim();
        if (!value) { M.toast('先写点内容再发表', 'bad'); return; }
        var user = HZQ.profile && HZQ.profile.current() || nameInput.value.trim() || '匿名';
        HZQ.comments.saveName(nameInput.value.trim());
        HZQ.comments.add(q.id, user, value);
        M.toast('评论已保存', 'ok');
        paint();
      }
    });
    form.appendChild(nameInput);
    form.appendChild(text);
    form.appendChild(send);
    wrap.appendChild(form);
    return wrap;
  }

  function desktopActions(q, r) {
    var acts = el('div', { class: 'acts' });
    var prevBtn = U.btn('上一题', { icon: 'left', onClick: function () { go(-1); }, disabled: !HZQ.engine.hasPrev(s) });
    acts.appendChild(prevBtn);

    if (s.instant) {
      if (r.submitted) {
        acts.appendChild(U.btn('重做本题', { icon: 'refresh', onClick: function () { doRetry(); } }));
        acts.appendChild(el('span', { class: 'spacer' }));
        acts.appendChild(U.btn('下一题', { kind: 'primary', icon: 'right', onClick: function () { go(1); } }));
      } else {
        acts.appendChild(U.btn('提交答案', { kind: 'primary', icon: 'check', onClick: doSubmit, disabled: !r.picked.length }));
        acts.appendChild(el('span', { class: 'spacer' }));
        acts.appendChild(U.btn('跳过这题', { icon: 'right', onClick: function () { go(1); } }));
      }
    } else {
      acts.appendChild(el('span', { class: 'spacer' }));
      acts.appendChild(U.btn('下一题', { kind: 'primary', icon: 'right', onClick: function () { go(1); } }));
    }

    var hint = el('div', { class: 'answer-hint', style: 'margin-top:12px' });
    if (HZQ.store.settings().keyboard) {
      hint.innerHTML = '<span class="kbd">A</span>~<span class="kbd">D</span> 选项 · ' +
        '<span class="kbd">Enter</span> 提交 · <span class="kbd">←</span><span class="kbd">→</span> 切题 · ' +
        '<span class="kbd">S</span> 收藏 · <span class="kbd">M</span> 换主题';
    }
    var wrap = el('div');
    wrap.appendChild(acts);
    wrap.appendChild(hint);
    return wrap;
  }

  function feedbackBlock(q, r) {
    var box = el('div', { class: 'feedback ' + (r.grade === 'correct' ? 'ok' : (r.grade === 'wrong' ? 'no' : 'na')) });
    var body = el('div', { class: 'fb-body' });
    if (r.grade === 'correct') {
      body.innerHTML = '<b>回答正确</b>' + (r.removedFromWrong ? ' · 已从错题本移出 🎉' : '');
      box.innerHTML = M.icon('checkCircle');
    } else if (r.grade === 'wrong') {
      body.innerHTML = '回答错误。正确答案是 <span class="ans">' + M.esc(HZQ.grading.answerText(q)) + '</span>' +
        (HZQ.grading.isMultiple(q) ? '' : '') +
        '<br><span class="tiny muted">你的答案：' + M.esc(HZQ.grading.pickedText(r.picked)) + '</span>';
      box.innerHTML = M.icon('xCircle');
    } else {
      body.innerHTML = M.esc(HZQ.grading.anomalyText(q));
      box.innerHTML = M.icon('alert');
    }
    box.appendChild(body);
    return box;
  }

  function explainBlock(q) {
    var box = el('div', { class: 'explain' });
    box.appendChild(el('div', { class: 'hd', text: '解析' }));
    box.appendChild(el('div', { html: M.rich(q.explanation) }));
    return box;
  }

  /* ------------------------------ 交互 ------------------------------ */
  function onPick(key) {
    var r = HZQ.engine.record(s);
    if (r && r.submitted && s.instant) {
      M.toast('本题已提交，点「重做本题」可以重新作答');
      return;
    }
    HZQ.engine.pick(s, key);
    paint();
  }

  function doSubmit() {
    var res = HZQ.engine.submit(s);
    if (!res.ok) {
      if (res.reason === 'empty') M.toast('先选一个答案再提交');
      return;
    }
    if (res.already) {
      // 幂等：重复提交不改变成绩，只提示一下
      M.toast('这道题已经提交过了，成绩不会重复计算');
      paint();
      return;
    }
    paint();
    if (res.grade === 'wrong') {
      M.toast('答错了，看看解析', 'bad');
    } else if (res.grade === 'correct') {
      if (s.autoNext && HZQ.engine.hasNext(s)) {
        setTimeout(function () { go(1); }, 420);
      }
    } else {
      M.toast('这道题数据异常，不计入成绩');
    }
  }

  function doRetry() {
    HZQ.engine.retry(s);
    paint();
    M.toast('已重置本题，得分会重新计算');
  }

  function go(step) {
    var ok = step > 0 ? HZQ.engine.next(s) : HZQ.engine.prev(s);
    if (!ok && step > 0) M.toast('已经是最后一题了');
    if (!ok && step < 0) M.toast('已经是第一题了');
    paint();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleFav() {
    var q = HZQ.engine.current(s);
    var on = HZQ.store.toggleFav(q.id);
    M.toast(on ? '已加入重点收藏' : '已取消收藏', on ? 'ok' : '');
    paint();
  }

  /* ------------------------------ 答题卡 ------------------------------ */
  function openSheetView() {
    var body = el('div');
    var legend = el('div', { class: 'qlegend', style: 'margin-bottom:14px' });
    legend.innerHTML = '<span><i style="background:var(--ok-soft);border:1.5px solid var(--ok-border)"></i>答对</span>' +
      '<span><i style="background:var(--bad-soft);border:1.5px solid var(--bad-border)"></i>答错</span>' +
      '<span><i style="background:var(--primary-soft);border:1.5px solid var(--primary)"></i>已答</span>' +
      '<span><i style="background:var(--surface-2);border:1.5px solid var(--border)"></i>未答</span>' +
      '<span><i style="background:var(--star);border-radius:50%"></i>已收藏</span>';
    body.appendChild(legend);

    var grid = el('div', { class: 'qgrid' });
    s.questionIds.forEach(function (qid, i) {
      var q = HZQ.data.question(qid);
      var r = s.answers[qid];
      var cls = '';
      if (r && r.submitted && r.picked.length) {
        if (r.grade === 'correct') cls = 'ok';
        else if (r.grade === 'wrong') cls = 'bad';
        else cls = 'done';
      } else if (r && r.picked.length) cls = 'done';
      if (i === s.index) cls += ' cur';
      var b = el('button', { class: cls, text: String(i + 1), title: M.plain(q.stem).slice(0, 60), onclick: function () {
        HZQ.engine.goTo(s, i);
        M.closeOverlay();
        paint();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } });
      if (HZQ.store.isFav(qid)) b.appendChild(el('span', { class: 'f', html: M.icon('star') }));
      grid.appendChild(b);
    });
    body.appendChild(grid);

    var st = HZQ.engine.stats(s);
    var foot = el('div', { class: 'tiny muted', style: 'margin-top:16px' });
    foot.innerHTML = '共 ' + st.total + ' 题 · 已答 ' + st.answered + ' · 未答 ' + st.blank +
      ' · 答对 ' + st.correct + ' · 答错 ' + st.wrong;
    body.appendChild(foot);

    M.openSheet({
      title: '题目列表', body: body, wide: true,
      actions: [{ text: '交卷', kind: 'primary', onClick: function (close) { close(); openFinish(); } },
                { text: '继续答题', onClick: function (close) { close(); } }]
    });
  }

  /* ------------------------------ 交卷 ------------------------------ */
  function openFinish() {
    var st = HZQ.engine.stats(s);
    var body = el('div');
    var list = el('div', { class: 'summary-list' });
    [['题目总数', st.total], ['已作答', st.answered], ['还没作答', st.blank], ['预计答对', s.instant ? st.correct : '交卷后才知道'],
     ['用时', M.dur(HZQ.engine.elapsed(s))]].forEach(function (p) {
      var row = el('div', { class: 'r' });
      row.appendChild(el('span', { class: 'muted', text: p[0] }));
      row.appendChild(el('b', { text: String(p[1]) }));
      list.appendChild(row);
    });
    body.appendChild(list);
    if (st.blank > 0) {
      var warn = el('div', { class: 'feedback na', style: 'margin-top:14px' });
      warn.innerHTML = M.icon('alert') + '<div class="fb-body">还有 <b>' + st.blank + '</b> 题没有作答，交卷后会算作答错。</div>';
      body.appendChild(warn);
      var jump = U.btn('跳到第一道没答的题', { small: true, onClick: function () {
        var i = HZQ.engine.firstUnanswered(s);
        M.closeOverlay();
        if (i >= 0) { HZQ.engine.goTo(s, i); paint(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      } });
      body.appendChild(el('div', { class: 'row-2', style: 'margin-top:10px' }, [jump]));
    }
    if (s.mode !== 'exam') {
      body.appendChild(el('div', { class: 'tiny muted', style: 'margin-top:14px', text: '交卷后本轮成绩会记入「成绩记录」。' }));
    }

    M.openSheet({
      title: '确认交卷？', body: body,
      actions: [
        { text: '再检查一下', onClick: function (close) { close(); } },
        { text: '交卷', kind: 'primary', onClick: function (close) { close(); doFinish(); } }
      ]
    });
  }

  function doFinish() {
    HZQ.engine.finish(s);
    HZQ.engine.saveHistory(s);
    HZQ.store.saveSession(HZQ.engine.snapshot(s));
    if (s.mode === 'exam') HZQ.store.markTrial('exam');
    var id = s.id;
    HZQ.app.setSession(null);
    HZQ.app.go('#/result/' + id);
  }

  function leaveConfirm() {
    var st = HZQ.engine.stats(s);
    if (st.answered === 0) { HZQ.app.setSession(null); HZQ.app.go('#/'); return; }
    var body = el('div');
    body.appendChild(el('p', { text: '进度已经自动保存在这台设备上，随时可以回来接着做。' }));
    var b2 = el('div', { class: 'tiny muted', style: 'margin-top:10px' });
    b2.textContent = '当前进度：已答 ' + st.answered + '/' + st.total + ' 题。';
    body.appendChild(b2);
    M.openSheet({
      title: '先离开一下？', body: body,
      actions: [
        { text: '继续答题', kind: 'primary', onClick: function (close) { close(); } },
        { text: '离开（保留进度）', onClick: function (close) { close(); save(); HZQ.app.go('#/'); } }
      ]
    });
  }

  /* ------------------------------ 计时 ------------------------------ */
  function startTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function () {
      if (!document.body.contains(headEl)) { clearInterval(timerId); timerId = null; return; }
      updateTimerText();
      var left = HZQ.engine.timeLeft(s);
      if (left !== null && left <= 0 && !s.finished) {
        clearInterval(timerId); timerId = null;
        M.toast('时间到，自动交卷', 'bad');
        doFinish();
      }
    }, 1000);
  }

  function updateTimerText() {
    var node = document.getElementById('quiz-timer');
    if (!node) return;
    var left = HZQ.engine.timeLeft(s);
    var txt, cls = 'timer';
    if (left !== null) {
      txt = M.dur(left) + ' 剩余';
      if (left < 60000) cls += ' run';
    } else {
      txt = M.dur(HZQ.engine.elapsed(s));
      if (s.instant) cls += ' run';
    }
    var cur = HZQ.engine.record(s);
    var qSpent = (cur && cur.spentMs || 0) + (s.questionStartedAt && (!cur || !cur.submitted) ? Date.now() - s.questionStartedAt : 0);
    txt += ' · 本题 ' + M.dur(qSpent);
    node.className = cls;
    node.innerHTML = M.icon('clock') + '<span>' + txt + '</span>';
  }

  /* ------------------------------ 滑动切题 ------------------------------ */
  function bindSwipe(node) {
    node.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { touchStart = null; return; }
      var t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, inCode: !!closest(e.target, '.code') };
    }, { passive: true });
    node.addEventListener('touchend', function (e) {
      if (!touchStart || touchStart.inCode) { touchStart = null; return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
      go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function closest(node, sel) {
    while (node && node !== document) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }

  return { render: render, mount: mount, unmount: unmount, bindSwipe: bindSwipe };
})();
