/* ==========================================================================
   views/home.js —— 首页：继续上次 / 总览 / 题库列表 / 快捷入口
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.home = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  function greet() {
    var h = new Date().getHours();
    if (h < 5) return '还没睡？';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  /* ------------------------------ 功能搜索 ------------------------------ */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s\u3000]/g, '').replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
  }
  function isSubsequence(q, text) {
    var i = 0;
    for (var j = 0; j < text.length && i < q.length; j++) if (text.charAt(j) === q.charAt(i)) i++;
    return i === q.length;
  }
  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function bestDistance(q, text) {
    if (!text) return 99;
    if (text.length <= q.length + 3) return editDistance(q, text);
    var best = 99;
    var min = Math.max(1, q.length - 2), max = Math.min(text.length, q.length + 2);
    for (var len = min; len <= max; len++) {
      for (var i = 0; i + len <= text.length && i < 80; i++) {
        best = Math.min(best, editDistance(q, text.substr(i, len)));
        if (best === 0) return 0;
      }
    }
    return best;
  }
  function featureScore(f, q) {
    var title = norm(f.title), desc = norm(f.desc), kw = norm(f.keywords);
    var all = title + desc + kw;
    if (title === q) return 1200;
    if (title.indexOf(q) >= 0) return 1000 - Math.min(title.indexOf(q), 40);
    if (kw.indexOf(q) >= 0) return 850 - Math.min(kw.indexOf(q), 40);
    if (all.indexOf(q) >= 0) return 700 - Math.min(all.indexOf(q), 40);
    if (isSubsequence(q, all)) return 560 + q.length * 4;
    var d = bestDistance(q, title + desc);
    var ratio = 1 - d / Math.max(q.length, 1);
    return ratio >= 0.5 ? 380 + ratio * 180 : 0;
  }
  function searchFeatures(q) {
    var list = featureList();
    var query = norm(q);
    if (!query) return list;
    return list.map(function (f) { return { f: f, s: featureScore(f, query) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.f; });
  }
  function featureList() {
    var settings = HZQ.store.settings();
    var last = HZQ.store.lastSession();
    var canResume = last && last.bankId && HZQ.store.resumable(last.bankId);
    return [
      { id: 'continue', title: '继续上次练习', desc: '回到上次停下的题号，保留进度', keywords: '继续 上次 断点 恢复 进度', icon: 'play', group: '学习', action: function () {
        if (canResume) HZQ.app.go('#/quiz/' + last.bankId);
        else M.toast('没有可以继续的练习', 'bad');
      } },
      { id: 'wrong', title: '错题本', desc: '按轮次重练错题，查看错题详情', keywords: '错题 错题本 重练 复习 加强', icon: 'refresh', group: '学习', href: '#/wrong' },
      { id: 'favorites', title: '重点收藏', desc: '查看收藏题目，按钮显示答案和解析', keywords: '收藏 重点 标星 答案 解析', icon: 'star', group: '学习', href: '#/favorites' },
      { id: 'java-bank', title: 'Java程序设计题库', desc: '219 道 Java 题，1 个原始章节 + 知识点分类', keywords: 'java 题库 程序设计 基础 面向对象', icon: 'book', group: '题库', href: '#/bank/java' },
      { id: 'web-bank', title: 'Web前端题库', desc: '120 道 HTML/CSS/JavaScript 题', keywords: 'web 前端 html css javascript 题库', icon: 'book', group: '题库', href: '#/bank/web' },
      { id: 'java-exam', title: '模拟考试 · Java', desc: '选范围、随机组卷、打乱顺序、限时交卷', keywords: '考试 模拟 试卷 限时 随机 java', icon: 'shield', group: '考试', href: '#/bank/java?mode=exam' },
      { id: 'web-exam', title: '模拟考试 · Web前端', desc: '从章节、错题、收藏中组卷考试', keywords: '考试 模拟 试卷 限时 随机 web 前端', icon: 'shield', group: '考试', href: '#/bank/web?mode=exam' },
      { id: 'java-chapter', title: '章节练习 · Java', desc: '按知识点筛选，每章独立进度和正确率', keywords: '章节 知识点 分类 难度 java', icon: 'layers', group: '学习', href: '#/bank/java?mode=chapter' },
      { id: 'web-chapter', title: '章节练习 · Web前端', desc: 'HTML、CSS、JavaScript 分章节练习', keywords: '章节 知识点 html css javascript web', icon: 'layers', group: '学习', href: '#/bank/web?mode=chapter' },
      { id: 'java-random', title: '随机练习 · Java', desc: '随机抽 10 道 Java 题', keywords: '随机 练习 java 十道', icon: 'shuffle', group: '学习', action: function () { HZQ.app.start({ bankId: 'java', mode: 'random', limit: 10 }); } },
      { id: 'web-random', title: '随机练习 · Web前端', desc: '随机抽 10 道 Web 前端题', keywords: '随机 练习 web 前端 十道', icon: 'shuffle', group: '学习', action: function () { HZQ.app.start({ bankId: 'web', mode: 'random', limit: 10 }); } },
      { id: 'search', title: '搜题', desc: '关键词、模糊匹配、历史记录、预览', keywords: '搜题 搜索 查找 题目 模糊 补全', icon: 'search', group: '工具', href: '#/search' },
      { id: 'history', title: '成绩记录', desc: '正确率曲线、薄弱知识点和建议', keywords: '成绩 记录 曲线 正确率 建议 历史', icon: 'chart', group: '记录', href: '#/history' },
      { id: 'compare', title: '成绩对比', desc: '上传其他用户成绩 JSON 做对比', keywords: '成绩 对比 其他用户 上传 排名', icon: 'chart', group: '记录', href: '#/history' },
      { id: 'quality', title: '数据体检', desc: '检查题库异常，查看原因和处理建议', keywords: '数据 体检 异常 题库 检查 修复', icon: 'shield', group: '工具', href: '#/quality' },
      { id: 'trial', title: '用户测试', desc: '按场景完成任务并填写体验建议', keywords: '测试 体验 反馈 建议 任务', icon: 'checkCircle', group: '工具', href: '#/trial' },
      { id: 'pomodoro', title: '番茄钟', desc: '开始专注计时，自动安排休息', keywords: '番茄 番茄钟 计时 专注 休息 pomodoro', icon: 'clock', group: '工具', action: function () { HZQ.app.startPomodoro('work'); } },
      { id: 'pomodoro-break', title: '开始番茄钟休息', desc: '进入短暂休息倒计时', keywords: '番茄 休息 放松 计时', icon: 'pause', group: '工具', action: function () { HZQ.app.startPomodoro('break'); } },
      { id: 'theme', title: '切换深色 / 浅色模式', desc: '一键切换当前主题', keywords: '深色 浅色 夜间 主题 模式 护眼', icon: 'moon', group: '外观', action: function () { HZQ.app.toggleTheme(); } },
      { id: 'theme-settings', title: '主题颜色设置', desc: '跟随系统、海盐蓝、森林绿、樱花粉等', keywords: '主题 颜色 风格 皮肤 樱花 森林 海洋', icon: 'settings', group: '外观', href: '#/settings' },
      { id: 'ui', title: '界面自定义', desc: '缩放、透明度、颜色、字体、间距和顺序', keywords: '界面 自定义 缩放 透明度 字体 间距 顺序 布局', icon: 'settings', group: '外观', href: '#/settings' },
      { id: 'audio', title: '背景音乐', desc: '静心音、细雨、森林、夜航等环境音', keywords: '背景 音乐 声音 环境 雨声 森林 放松 歌单', icon: 'bookmark', group: '外观', href: '#/settings' },
      { id: 'language', title: '界面语言', desc: '中文、English、日本語', keywords: '语言 中文 英文 英语 日语 english japanese', icon: 'settings', group: '外观', href: '#/settings' },
      { id: 'comfort', title: '防眩晕模式', desc: '关闭动画和渐变，适合车上或晃动场景', keywords: '防眩晕 眩晕 晃动 车 船 火车 动画', icon: 'shield', group: '外观', action: function () {
        var v = !HZQ.store.settings().antiDizzy;
        HZQ.store.setSetting('antiDizzy', v); HZQ.app.applyUI();
        M.toast(v ? '防眩晕模式已开启' : '防眩晕模式已关闭', 'ok');
      } },
      { id: 'dark-prompt', title: '日落后提醒深色模式', desc: '天黑时主动询问是否切换深色', keywords: '日落 天黑 傍晚 深色 提醒 夜间', icon: 'moon', group: '外观', action: function () {
        var v = !HZQ.store.settings().darkPrompt;
        HZQ.store.setSetting('darkPrompt', v);
        M.toast(v ? '日落后提醒已开启' : '日落后提醒已关闭', 'ok');
      } },
      { id: 'break', title: '连续做题休息提醒', desc: '连续 2 小时提醒休息，考试模式除外', keywords: '休息 提醒 两小时 连续 做题 健康', icon: 'clock', group: '健康', action: function () {
        var v = !HZQ.store.settings().breakReminder;
        HZQ.store.setSetting('breakReminder', v);
        M.toast(v ? '休息提醒已开启' : '休息提醒已关闭', 'ok');
      } },
      { id: 'account', title: '登录 / 注册本地账户', desc: '每个账户保存自己的进度、错题和成绩', keywords: '登录 注册 账户 用户 数据 密码', icon: 'user', group: '设置', action: function () {
        if (HZQ.profile && HZQ.profile.current()) HZQ.app.go('#/settings');
        else if (HZQ.profile) HZQ.profile.dialog('login', function () { location.reload(); });
      } },
      { id: 'export', title: '导出 / 备份数据', desc: '下载 JSON、系统分享或复制备份内容', keywords: '导出 备份 下载 分享 复制 数据', icon: 'download', group: '设置', href: '#/settings' },
      { id: 'clear', title: '清空数据', desc: '按时间、轮次、单条清理错题/收藏/成绩等', keywords: '清空 删除 清理 数据 历史 错题 收藏', icon: 'trash', group: '设置', href: '#/settings' },
      { id: 'settings', title: '设置与备份', desc: '主题、界面、音乐、账户、语言、导出和清理', keywords: '设置 备份 选项 配置', icon: 'settings', group: '设置', href: '#/settings' }
    ];
  }

  function featureSearch() {
    var wrap = el('div', { class: 'card pad feature-search' });
    var row = el('div', { class: 'feature-search-row' });
    var icon = el('span', { class: 'feature-search-icon', html: M.icon('search') });
    var input = el('input', {
      class: 'input feature-input', type: 'search',
      placeholder: '搜索功能：番茄钟、考试模式、错题本、深色模式…',
      'aria-label': '搜索功能',
      autocomplete: 'off'
    });
    var allBtn = U.btn('全部功能', {
      small: true, kind: 'ghost', icon: 'grid',
      onClick: function () { input.value = ''; paint(''); open(); input.focus(); }
    });
    row.appendChild(icon);
    row.appendChild(input);
    row.appendChild(allBtn);
    wrap.appendChild(row);
    var panel = el('div', { class: 'feature-results', hidden: 'hidden' });
    wrap.appendChild(panel);

    function open() { panel.removeAttribute('hidden'); }
    function close() { panel.setAttribute('hidden', 'hidden'); }
    function paint(query) {
      panel.innerHTML = '';
      var hits = searchFeatures(query);
      var head = el('div', { class: 'feature-results-head' });
      head.appendChild(el('span', { text: query ? '找到 ' + hits.length + ' 个功能' : '全部功能 · ' + hits.length }));
      head.appendChild(el('span', { class: 'tiny muted', text: '点击即可打开' }));
      panel.appendChild(head);
      if (!hits.length) {
        panel.appendChild(el('div', { class: 'feature-empty', text: '没有找到对应功能，换个说法试试，例如“考试”“休息”“深色”。' }));
        return;
      }
      var list = el('div', { class: 'feature-list' });
      hits.forEach(function (f) {
        var item = el('button', { class: 'feature-item', type: 'button' });
        var ic = el('span', { class: 'feature-ic', html: M.icon(f.icon || 'grid') });
        item.appendChild(ic);
        var body = el('div', { class: 'feature-body' });
        var title = el('div', { class: 'feature-title' });
        title.appendChild(el('span', { text: f.title }));
        if (f.group) title.appendChild(el('span', { class: 'tag line', text: f.group }));
        body.appendChild(title);
        body.appendChild(el('div', { class: 'feature-desc', text: f.desc }));
        item.appendChild(body);
        item.appendChild(el('span', { class: 'feature-go', html: M.icon('right') }));
        item.addEventListener('click', function () {
          close();
          if (f.action) f.action();
          else if (f.href) HZQ.app.go(f.href);
        });
        list.appendChild(item);
      });
      panel.appendChild(list);
    }
    input.addEventListener('focus', function () { paint(input.value); open(); });
    input.addEventListener('click', function () { paint(input.value); open(); });
    input.addEventListener('input', function () { paint(input.value); open(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var first = panel.querySelector('.feature-item');
        if (first) first.click();
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });
    paint('');
    return wrap;
  }

  function render() {
    var root = el('div');
    var g = HZQ.store.globalStats();
    var ov = HZQ.data.overview();
    root.appendChild(featureSearch());

    /* ---------- Hero ---------- */
    var hero = el('div', { class: 'hero' });
    var heroIn = el('div', { class: 'in' });
    heroIn.appendChild(el('h1', { text: greet() + '，今天也来刷几道？' }));
    heroIn.appendChild(el('p', {
      text: ov.banks + ' 个题库 · ' + ov.questions + ' 道题 · 数据来自《2026 网页部招新考核》题库'
    }));
    var nums = el('div', { class: 'nums' });
    [['累计作答', g.done], ['总正确率', g.done ? M.pct(g.accuracy) : '—'],
     ['错题本', g.wrongCount], ['练习次数', g.sessions]].forEach(function (p) {
      var d = el('div');
      d.appendChild(el('div', { class: 'v', text: String(p[1]) }));
      d.appendChild(el('div', { class: 'l', text: p[0] }));
      nums.appendChild(d);
    });
    heroIn.appendChild(nums);
    hero.appendChild(heroIn);
    root.appendChild(hero);

    if (!HZQ.store.storageUsable()) {
      var warn = el('div', { class: 'feedback na' });
      warn.innerHTML = M.icon('alert') + '<div class="fb-body">当前浏览器禁用了本地存储，进度不会被保存（不影响本次答题）。</div>';
      warn.style.marginTop = '0';
      warn.style.marginBottom = '14px';
      root.appendChild(warn);
    }

    /* ---------- 继续上次 ---------- */
    var resume = null;
    HZQ.data.banks.forEach(function (b) {
      var snap = HZQ.store.resumable(b.id);
      if (!snap) return;
      if (!resume || snap.id > resume.snap.id) resume = { bank: b, snap: snap };
    });
    if (resume) {
      var st = null;
      try {
        var s = HZQ.engine.restore(resume.snap);
        if (s) { HZQ.engine.pause(s); st = HZQ.engine.stats(s); }
      } catch (e) { st = null; }
      if (st) {
        var card = el('button', { class: 'resume', onclick: function () { HZQ.app.go('#/quiz/' + resume.bank.id); } });
        card.appendChild(U.ring(st.answered / Math.max(1, st.total), 46, Math.round(st.answered / Math.max(1, st.total) * 100) + '%'));
        var txt = el('div', { class: 'txt' });
        txt.appendChild(el('div', { class: 't1', text: '继续上次：' + resume.bank.title + ' · ' + resume.snap.modeName }));
        txt.appendChild(el('div', {
          class: 't2',
          text: '停在第 ' + (resume.snap.index + 1) + ' 题 · 已答 ' + st.answered + '/' + st.total + ' 题 · ' + M.agoText(resume.snap.startedAt || Date.now())
        }));
        card.appendChild(txt);
        var go = el('span', { class: 'tag pri' });
        go.innerHTML = M.icon('play') + '<span>接着做</span>';
        card.appendChild(go);
        root.appendChild(card);
      }
    }

    /* ---------- 题库列表 ---------- */
    root.appendChild(U.secTitle('题库'));
    var list = el('div');
    HZQ.data.banks.forEach(function (b) {
      list.appendChild(bankCard(b));
    });
    root.appendChild(list);

    /* ---------- 快捷入口 ---------- */
    root.appendChild(U.secTitle('我的'));
    var qg = el('div', { class: 'quickgrid' });
    var latest = HZQ.store.history()[0];
    var allClear = latest && latest.total > 0 && latest.wrong === 0 && latest.blank === 0 && g.wrongCount === 0;
    var issueCount = HZQ.views.quality ? HZQ.views.quality.count() : ov.issues;
    var quickDefs = [
      {
        key: 'wrong', icon: g.wrongCount ? 'refresh' : 'checkCircle', cls: g.wrongCount ? 'bad' : 'ok',
        title: '错题本',
        sub: g.wrongCount ? (g.wrongCount + ' 道待攻克') : (allClear ? '上一轮全对，保持住' : '还没有错题'),
        onClick: function () { HZQ.app.go('#/wrong'); }
      },
      { key: 'favorites', icon: 'star', cls: 'star', title: '重点收藏', sub: g.favCount + ' 道已标记', onClick: function () { HZQ.app.go('#/favorites'); } },
      { key: 'history', icon: 'chart', cls: 'ok', title: '成绩记录', sub: g.sessions + ' 次练习', onClick: function () { HZQ.app.go('#/history'); } },
      { key: 'search', icon: 'search', cls: '', title: '搜题', sub: '关键词 / 模糊匹配', onClick: function () { HZQ.app.openSearch(); } },
      {
        key: 'quality', icon: issueCount ? 'shield' : 'checkCircle', cls: issueCount ? '' : 'ok',
        title: '数据体检', sub: issueCount ? (issueCount + ' 道题异常') : '题库检查通过',
        onClick: function () { HZQ.app.go('#/quality'); }
      },
      { key: 'settings', icon: 'settings', cls: '', title: '设置与备份', sub: '主题 / 导出 / 清空', onClick: function () { HZQ.app.go('#/settings'); } }
    ];
    var order = HZQ.store.settings().uiQuickOrder || [];
    quickDefs.sort(function (a, b) {
      var ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      return ia - ib;
    });
    quickDefs.forEach(function (d) {
      qg.appendChild(quick(d.icon, d.cls, d.title, d.sub, d.onClick));
    });
    root.appendChild(qg);

    root.appendChild(el('p', {
      class: 'tiny muted',
      style: 'margin-top:26px;text-align:center;line-height:1.9',
      html: '题库题目与答案原样来自考核附件，未作任何修改。<br>练习进度只保存在你自己的浏览器里，不上传任何服务器。'
    }));

    return root;
  }

  function quick(icon, cls, title, sub, onClick) {
    var b = el('button', { class: 'quick', onclick: onClick });
    b.appendChild(el('span', { class: 'ic ' + (cls || ''), html: M.icon(icon) }));
    var t = el('div');
    t.appendChild(el('div', { class: 't', text: title }));
    t.appendChild(el('div', { class: 's', text: sub }));
    b.appendChild(t);
    return b;
  }

  function bankCard(b) {
    var p = HZQ.store.bankProgress(b.id);
    var card = el('button', { class: 'tile', style: 'margin-bottom:10px', onclick: function () { HZQ.app.go('#/bank/' + b.id); } });
    var inner = el('div', { class: 'bankcard' });

    var body = el('div', { class: 'body' });
    var name = el('div', { class: 'name' });
    name.appendChild(el('span', { text: b.title }));
    if (b.questionCount > b.scorableCount) {
      name.appendChild(el('span', { class: 'tag warn', text: (b.questionCount - b.scorableCount) + ' 题不计分' }));
    }
    body.appendChild(name);
    body.appendChild(el('div', { class: 'desc', text: b.desc }));

    var meta = el('div', { class: 'meta' });
    meta.appendChild(el('span', { class: 'tag', text: b.questionCount + ' 道题' }));
    meta.appendChild(el('span', { class: 'tag', text: (b.chapters || []).length + ' 个章节' }));
    var tc = b.typeCount || {};
    if (tc.single) meta.appendChild(el('span', { class: 'tag line', text: '单选 ' + tc.single }));
    if (tc.multiple) meta.appendChild(el('span', { class: 'tag line', text: '多选 ' + tc.multiple }));
    if (tc.judge) meta.appendChild(el('span', { class: 'tag line', text: '判断 ' + tc.judge }));
    body.appendChild(meta);

    var prog = el('div', { class: 'prog' });
    var cap = el('div', { class: 'cap' });
    cap.appendChild(el('span', { html: '已答 <b>' + p.done + '</b> / ' + p.total }));
    cap.appendChild(el('span', { text: p.done ? ('正确率 ' + M.pct(p.accuracy)) : '还没开始' }));
    prog.appendChild(cap);
    var bar = el('div', { class: 'bar' + (p.done && p.accuracy >= 0.8 ? ' ok' : '') });
    bar.appendChild(el('i', { style: 'width:' + (p.ratio * 100).toFixed(1) + '%' }));
    prog.appendChild(bar);
    body.appendChild(prog);

    var acts = el('div', { class: 'row-2', style: 'margin-top:12px' });
    var wrongN = b.questions.filter(function (q) { return HZQ.store.isWrong(q.id); }).length;
    if (wrongN) {
      var wb = U.btn('错题重练 ' + wrongN, { small: true, kind: 'ghost', icon: 'refresh', onClick: function (e) {
        e.stopPropagation();
        HZQ.app.start({ bankId: b.id, mode: 'wrong' });
      } });
      acts.appendChild(wb);
    }
    if (p.done) {
      acts.appendChild(U.btn(p.done >= p.total ? '再刷一遍' : '继续练习', { small: true, kind: 'primary', icon: 'play', onClick: function (e) {
        e.stopPropagation();
        HZQ.app.go('#/bank/' + b.id);
      } }));
    }
    body.appendChild(acts);

    inner.appendChild(body);
    inner.appendChild(U.ring(p.ratio, 64, p.done ? M.pct(p.ratio) : '0%'));
    card.appendChild(inner);
    return card;
  }

  return { render: render };
})();
