/* ==========================================================================
   views/settings.js —— 主题 / 导出备份 / 按时间与轮次清理数据
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.settings = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var THEMES = [
    { id: 'auto', name: '跟随系统', desc: '自动使用系统的浅色 / 深色', colors: ['#f4f5f9', '#4f46e5'] },
    { id: 'light', name: '浅色', desc: '清爽的默认浅色主题', colors: ['#f4f5f9', '#4f46e5'] },
    { id: 'dark', name: '深色', desc: '夜间刷题不刺眼', colors: ['#0e1014', '#8b93f8'] },
    { id: 'ocean', name: '海盐蓝', desc: '冷静的蓝绿色调', colors: ['#eef8fb', '#0e7490'] },
    { id: 'forest', name: '森林绿', desc: '柔和的自然绿色', colors: ['#f1f8f3', '#15803d'] },
    { id: 'sakura', name: '樱花粉', desc: '轻快的暖粉色调', colors: ['#fff5f8', '#db2777'] },
    { id: 'midnight', name: '午夜紫', desc: '深色下的紫色氛围', colors: ['#101321', '#a78bfa'] },
    { id: 'contrast', name: '高对比', desc: '更强的文字和边框对比', colors: ['#ffffff', '#111827'] }
  ];

  function render() {
    var state = {
      range: 'all',
      wrongRound: 'all',
      expanded: {},
      sel: { wrong: {}, fav: {}, history: {}, historyQ: {}, search: {}, quality: {} }
    };

    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('设置与备份', '主题、界面、音乐、账户、语言、导出和本地数据清理。所有操作都只影响这台设备。', [
      U.btn('清空数据', {
        kind: 'danger', icon: 'trash',
        onClick: function () {
          var target = document.getElementById('data-clear');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      })
    ]));

    root.appendChild(accountSection());
    root.appendChild(themeSection());
    root.appendChild(uiSection());
    root.appendChild(audioSection());
    root.appendChild(preferencesSection());
    root.appendChild(exportSection());
    root.appendChild(clearSection(state));
    return root;
  }

  /* ------------------------------ 账户 ------------------------------ */
  function accountSection() {
    var wrap = el('div');
    if (!HZQ.profile) return wrap;
    wrap.appendChild(U.secTitle('账户（本地）'));
    var card = el('div', { class: 'card pad' });
    var user = HZQ.profile.current();
    if (user) {
      card.appendChild(el('div', { class: 'spread' }));
      var head = el('div');
      head.appendChild(el('div', { class: 'clear-title', text: '当前账户：' + user }));
      head.appendChild(el('div', { class: 'tiny muted', text: '数据只保存在这台设备；登录后看到的是这个账户自己的进度、错题、收藏和成绩。' }));
      card.appendChild(head);
      var actions = el('div', { class: 'row-2', style: 'margin-top:12px' });
      actions.appendChild(U.btn('退出登录', {
        kind: 'danger', icon: 'trash',
        onClick: function () {
          M.confirmBox({
            title: '退出登录？', danger: true, okText: '退出',
            body: el('p', { text: '退出后会切换到空白本地数据，账户数据仍保留在本机。' })
          }).then(function (ok) {
            if (!ok) return;
            HZQ.profile.logout();
            M.toast('已退出登录', 'ok');
            setTimeout(function () { location.reload(); }, 300);
          });
        }
      }));
      card.appendChild(actions);
    } else {
      card.appendChild(el('div', { class: 'tiny muted', text: '可以创建一个本地账户来区分不同使用者的数据，也可以先以游客身份使用。账户只保存在本机，跨设备不会同步。' }));
      var btns = el('div', { class: 'row-2', style: 'margin-top:12px' });
      btns.appendChild(U.btn('登录', {
        kind: 'primary', icon: 'user',
        onClick: function () { HZQ.profile.dialog('login', function () { location.reload(); }); }
      }));
      btns.appendChild(U.btn('注册本地账户', {
        icon: 'user',
        onClick: function () { HZQ.profile.dialog('register', function () { location.reload(); }); }
      }));
      card.appendChild(btns);
    }
    wrap.appendChild(card);
    return wrap;
  }

  /* ------------------------------ UI 自定义 ------------------------------ */
  function uiSection() {
    var s = HZQ.store.settings();
    var wrap = el('div');
    wrap.appendChild(U.secTitle('界面自定义'));
    var card = el('div', { class: 'card pad' });
    card.appendChild(el('div', { class: 'tiny muted', style: 'margin-bottom:12px', text: '调整界面大小、透明度、颜色、字体、按钮间距和快捷入口顺序；设置会立即生效。' }));

    var grid = el('div', { class: 'ui-grid' });
    grid.appendChild(rangeRow('界面缩放', (s.uiScale || 1) * 100, 85, 120, 5, '%', function (v) {
      HZQ.store.setSetting('uiScale', v / 100);
      HZQ.app.applyUI();
    }));
    grid.appendChild(rangeRow('内容透明度', (s.uiOpacity || 1) * 100, 55, 100, 5, '%', function (v) {
      HZQ.store.setSetting('uiOpacity', v / 100);
      HZQ.app.applyUI();
    }));
    grid.appendChild(rangeRow('按钮间距', s.uiGap || 10, 4, 24, 1, 'px', function (v) {
      HZQ.store.setSetting('uiGap', v);
      HZQ.app.applyUI();
    }));
    card.appendChild(grid);

    var colors = el('div', { class: 'ui-colors' });
    colors.appendChild(colorRow('主色', s.uiPrimary || '#4f46e5', function (v) {
      HZQ.store.setSetting('uiPrimary', v);
      HZQ.app.applyUI();
    }));
    colors.appendChild(colorRow('页面背景', s.uiBg || '#f4f5f9', function (v) {
      HZQ.store.setSetting('uiBg', v);
      HZQ.app.applyUI();
    }));
    card.appendChild(colors);

    var fontField = el('div', { class: 'field' });
    fontField.appendChild(el('label', { text: '字体' }));
    var font = el('select', { class: 'select' });
    [['system', '系统字体'], ['serif', '衬线 / 宋体'], ['rounded', '圆润字体'], ['mono', '等宽字体']].forEach(function (p) {
      var o = el('option', { value: p[0], text: p[1] });
      if ((s.uiFont || 'system') === p[0]) o.selected = true;
      font.appendChild(o);
    });
    font.addEventListener('change', function () {
      HZQ.store.setSetting('uiFont', font.value);
      HZQ.app.applyUI();
    });
    fontField.appendChild(font);
    card.appendChild(fontField);

    var bgField = el('div', { class: 'field' });
    bgField.appendChild(el('label', { text: '自定义背景图 / 小图片' }));
    var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    var bgBtns = el('div', { class: 'row-2' });
    bgBtns.appendChild(U.btn('上传图片', { icon: 'upload', small: true, onClick: function () { file.click(); } }));
    bgBtns.appendChild(U.btn('清除背景图', {
      small: true, kind: 'ghost', icon: 'trash',
      onClick: function () {
        HZQ.store.setSetting('uiBgImage', '');
        HZQ.app.applyUI();
        M.toast('已清除背景图', 'ok');
      }
    }));
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 1.5 * 1024 * 1024) { M.toast('图片请小于 1.5 MB', 'bad'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        HZQ.store.setSetting('uiBgImage', String(reader.result || ''));
        HZQ.app.applyUI();
        M.toast('背景图已应用', 'ok');
      };
      reader.readAsDataURL(f);
    });
    bgField.appendChild(bgBtns);
    bgField.appendChild(file);
    card.appendChild(bgField);

    card.appendChild(el('div', { class: 'sec-title', style: 'margin-top:18px', text: '按钮顺序' }));
    card.appendChild(orderEditor('首页快捷入口', 'uiQuickOrder', [
      { key: 'wrong', label: '错题本' }, { key: 'favorites', label: '重点收藏' },
      { key: 'history', label: '成绩记录' }, { key: 'search', label: '搜题' },
      { key: 'quality', label: '数据体检' }, { key: 'settings', label: '设置与备份' }
    ], false));
    card.appendChild(orderEditor('顶部导航', 'uiNavOrder', [
      { key: 'home', label: '首页' }, { key: 'wrong', label: '错题本' },
      { key: 'favorites', label: '收藏' }, { key: 'history', label: '记录' }
    ], true));

    var reset = U.btn('恢复默认界面', {
      kind: 'ghost', icon: 'refresh',
      onClick: function () {
        ['uiScale', 'uiOpacity', 'uiPrimary', 'uiBg', 'uiFont', 'uiGap', 'uiBgImage', 'uiQuickOrder', 'uiNavOrder'].forEach(function (k) {
          var def = { uiScale: 1, uiOpacity: 1, uiPrimary: '', uiBg: '', uiFont: 'system', uiGap: 10, uiBgImage: '', uiQuickOrder: [], uiNavOrder: [] }[k];
          HZQ.store.setSetting(k, def);
        });
        HZQ.app.applyUI();
        HZQ.app.refreshNav();
        M.toast('界面已恢复默认', 'ok');
        HZQ.app.go('#/settings');
      }
    });
    card.appendChild(reset);
    wrap.appendChild(card);
    return wrap;
  }

  function rangeRow(label, value, min, max, step, suffix, onInput) {
    var row = el('div', { class: 'ui-range' });
    var top = el('div', { class: 'spread' });
    top.appendChild(el('span', { text: label }));
    var out = el('b', { text: value + suffix });
    top.appendChild(out);
    row.appendChild(top);
    var input = el('input', { type: 'range', min: min, max: max, step: step, value: value });
    input.addEventListener('input', function () {
      var v = Number(input.value);
      out.textContent = v + suffix;
      onInput(v);
    });
    row.appendChild(input);
    return row;
  }

  function colorRow(label, value, onChange) {
    var row = el('label', { class: 'ui-color' });
    row.appendChild(el('span', { text: label }));
    var input = el('input', { type: 'color', value: value });
    input.addEventListener('input', function () { onChange(input.value); });
    row.appendChild(input);
    return row;
  }

  function orderEditor(title, key, defaults, refreshNav) {
    var wrap = el('div', { class: 'order-editor' });
    wrap.appendChild(el('div', { class: 'order-title', text: title }));
    var saved = HZQ.store.settings()[key] || [];
    var items = defaults.slice().sort(function (a, b) {
      var ia = saved.indexOf(a.key), ib = saved.indexOf(b.key);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      return ia - ib;
    });

    function persist() {
      HZQ.store.setSetting(key, items.map(function (x) { return x.key; }));
      if (refreshNav && HZQ.app.refreshNav) HZQ.app.refreshNav();
      M.toast('顺序已保存', 'ok');
      HZQ.app.go('#/settings');
    }

    items.forEach(function (item, index) {
      var row = el('div', { class: 'order-row' });
      row.appendChild(el('span', { class: 'order-name', text: item.label }));
      row.appendChild(el('span', { class: 'grow' }));
      var up = U.btn('上移', {
        small: true, kind: 'ghost', disabled: index === 0,
        onClick: function () {
          var t = items[index - 1]; items[index - 1] = items[index]; items[index] = t;
          persist();
        }
      });
      var down = U.btn('下移', {
        small: true, kind: 'ghost', disabled: index === items.length - 1,
        onClick: function () {
          var t = items[index + 1]; items[index + 1] = items[index]; items[index] = t;
          persist();
        }
      });
      row.appendChild(up);
      row.appendChild(down);
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ------------------------------ 背景音乐 ------------------------------ */
  function audioSection() {
    var wrap = el('div');
    if (!HZQ.audio) return wrap;
    wrap.appendChild(U.secTitle('背景音乐'));
    var card = el('div', { class: 'card pad' });
    card.appendChild(el('div', { class: 'tiny muted', style: 'margin-bottom:12px', text: '内置音轨由浏览器实时合成，不需要下载音频；也可以上传自己的音频文件（小文件会保存在本机）。' }));
    var tracks = HZQ.audio.list();
    var select = el('select', { class: 'select', style: 'max-width:280px' });
    tracks.forEach(function (t) {
      var o = el('option', { value: t.id, text: t.name + (t.custom ? ' · 我的音频' : '') });
      if (HZQ.store.settings().audioTrack === t.id) o.selected = true;
      select.appendChild(o);
    });
    card.appendChild(select);

    var controls = el('div', { class: 'row-2', style: 'margin-top:10px' });
    var playBtn = U.btn(HZQ.audio.current() ? '暂停' : '播放', {
      kind: 'primary', icon: 'play',
      onClick: function () {
        if (HZQ.audio.current()) {
          HZQ.audio.pause();
          playBtn.innerHTML = M.icon('play') + '<span>播放</span>';
          return;
        }
        HZQ.audio.play(select.value);
        HZQ.store.setSetting('audioTrack', select.value);
        playBtn.innerHTML = M.icon('pause') + '<span>暂停</span>';
        M.toast('背景音乐已开始', 'ok');
      }
    });
    controls.appendChild(playBtn);
    var upload = el('input', { type: 'file', accept: 'audio/*', style: 'display:none' });
    controls.appendChild(U.btn('上传音频', {
      icon: 'upload', small: true,
      onClick: function () { upload.click(); }
    }));
    upload.addEventListener('change', function () {
      var file = upload.files && upload.files[0];
      if (!file) return;
      HZQ.audio.addFile(file).then(function (track) {
        HZQ.store.setSetting('audioTrack', track.id);
        M.toast('音频已加入歌单', 'ok');
        HZQ.app.go('#/settings');
      }).catch(function (e) { M.toast(e.message || '音频读取失败', 'bad'); });
    });
    controls.appendChild(upload);
    var stop = U.btn('停止', {
      kind: 'ghost', small: true, icon: 'x',
      onClick: function () {
        HZQ.audio.pause();
        playBtn.innerHTML = M.icon('play') + '<span>播放</span>';
      }
    });
    controls.appendChild(stop);
    card.appendChild(controls);

    var vol = el('div', { class: 'ui-range', style: 'margin-top:12px' });
    var volTop = el('div', { class: 'spread' });
    volTop.appendChild(el('span', { text: '音量' }));
    var volOut = el('b', { text: Math.round((HZQ.store.settings().audioVolume || 0.2) * 100) + '%' });
    volTop.appendChild(volOut);
    vol.appendChild(volTop);
    var volInput = el('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round((HZQ.store.settings().audioVolume || 0.2) * 100) });
    volInput.addEventListener('input', function () {
      var v = Number(volInput.value);
      volOut.textContent = v + '%';
      HZQ.audio.setVolume(v / 100);
      HZQ.store.setSetting('audioVolume', v / 100);
    });
    vol.appendChild(volInput);
    card.appendChild(vol);
    card.appendChild(el('div', { class: 'tiny muted', style: 'margin-top:10px', text: '提示：浏览器通常要求先点击播放，不能自动播放；考试时建议关闭音乐。' }));
    wrap.appendChild(card);
    return wrap;
  }

  /* ------------------------------ 语言 / 舒适 / 计时 ------------------------------ */
  function preferencesSection() {
    var s = HZQ.store.settings();
    var wrap = el('div');
    wrap.appendChild(U.secTitle('阅读、语言与计时'));
    var card = el('div', { class: 'card' });

    if (HZQ.i18n) {
      var langRow = el('div', { class: 'setting' });
      var ll = el('div');
      ll.appendChild(el('div', { class: 'lbl', text: '界面语言' }));
      ll.appendChild(el('div', { class: 'hint', text: '切换导航、页面标题和系统提示；题库原文保持原始中文，不做改写。' }));
      langRow.appendChild(ll);
      var lc = el('div', { class: 'ctl' });
      var ls = el('select', { class: 'select', style: 'width:150px' });
      HZQ.i18n.languages().forEach(function (l) {
        var o = el('option', { value: l.id, text: l.name });
        if ((s.language || 'zh') === l.id) o.selected = true;
        ls.appendChild(o);
      });
      ls.addEventListener('change', function () { HZQ.app.setLanguage(ls.value); });
      lc.appendChild(ls);
      langRow.appendChild(lc);
      card.appendChild(langRow);
    }

    card.appendChild(actionRow('防眩晕模式', '关闭动画、渐变和阴影，适合车上、船上或容易眩晕时使用', !!s.antiDizzy, '已开启', '已关闭', function (v) {
      HZQ.store.setSetting('antiDizzy', v);
      HZQ.app.applyUI();
      M.toast(v ? '防眩晕模式已开启' : '防眩晕模式已关闭', 'ok');
    }));
    card.appendChild(actionRow('日落后提醒深色模式', '进入傍晚后主动询问是否切换深色', !!s.darkPrompt, '已开启', '已关闭', function (v) {
      HZQ.store.setSetting('darkPrompt', v);
      M.toast(v ? '日落后提醒已开启' : '日落后提醒已关闭', 'ok');
    }));
    card.appendChild(actionRow('连续做题 2 小时提醒休息', '考试模式不会触发', !!s.breakReminder, '已开启', '已关闭', function (v) {
      HZQ.store.setSetting('breakReminder', v);
      M.toast(v ? '休息提醒已开启' : '休息提醒已关闭', 'ok');
    }));

    var pomoRow = el('div', { class: 'setting' });
    var pl = el('div');
    pl.appendChild(el('div', { class: 'lbl', text: '番茄钟' }));
    pl.appendChild(el('div', { class: 'hint', text: '专注一段时间后自动进入休息；可在任意页面显示倒计时。' }));
    pomoRow.appendChild(pl);
    var pc = el('div', { class: 'ctl row-2' });
    var work = el('input', { class: 'input', type: 'number', min: '1', max: '120', value: s.pomoWork || 25, style: 'width:70px' });
    var brk = el('input', { class: 'input', type: 'number', min: '1', max: '60', value: s.pomoBreak || 5, style: 'width:70px' });
    work.title = '专注分钟';
    brk.title = '休息分钟';
    work.addEventListener('change', function () { HZQ.store.setSetting('pomoWork', Math.max(1, Number(work.value) || 25)); });
    brk.addEventListener('change', function () { HZQ.store.setSetting('pomoBreak', Math.max(1, Number(brk.value) || 5)); });
    pc.appendChild(el('span', { class: 'tiny muted', text: '专注' }));
    pc.appendChild(work);
    pc.appendChild(el('span', { class: 'tiny muted', text: '休息' }));
    pc.appendChild(brk);
    pomoRow.appendChild(pc);
    card.appendChild(pomoRow);

    var pomoBtns = el('div', { class: 'row-2', style: 'padding:12px 18px' });
    pomoBtns.appendChild(U.btn('开始专注', { kind: 'primary', icon: 'clock', small: true, onClick: function () { HZQ.app.startPomodoro('work'); } }));
    pomoBtns.appendChild(U.btn('开始休息', { icon: 'pause', small: true, onClick: function () { HZQ.app.startPomodoro('break'); } }));
    pomoBtns.appendChild(U.btn('停止番茄钟', { kind: 'ghost', small: true, icon: 'x', onClick: function () { HZQ.app.stopPomodoro(); } }));
    card.appendChild(pomoBtns);

    var trialRow = el('div', { class: 'setting' });
    var tl = el('div');
    tl.appendChild(el('div', { class: 'lbl', text: '用户测试与体验建议' }));
    tl.appendChild(el('div', { class: 'hint', text: '按真实场景完成几个任务，并留下你的建议。' }));
    trialRow.appendChild(tl);
    var tc = el('div', { class: 'ctl' });
    tc.appendChild(U.btn('打开用户测试', { kind: 'primary', small: true, icon: 'right', onClick: function () { HZQ.app.go('#/trial'); } }));
    trialRow.appendChild(tc);
    card.appendChild(trialRow);

    wrap.appendChild(card);
    return wrap;
  }

  function actionRow(label, hint, on, onText, offText, onChange) {
    var row = el('div', { class: 'setting action-setting' });
    var l = el('div');
    var line = el('div', { class: 'lbl-line' });
    line.appendChild(el('div', { class: 'lbl', text: label }));
    var status = el('span', { class: 'tag ' + (on ? 'ok' : ''), text: on ? onText : offText });
    line.appendChild(status);
    l.appendChild(line);
    if (hint) l.appendChild(el('div', { class: 'hint', text: hint }));
    row.appendChild(l);
    var ctl = el('div', { class: 'ctl' });
    var current = !!on;
    var btn = U.btn(current ? '关闭' : '开启', {
      small: true,
      kind: current ? 'ghost' : 'primary',
      icon: current ? 'x' : 'play',
      onClick: function () {
        current = !current;
        status.textContent = current ? onText : offText;
        status.className = 'tag ' + (current ? 'ok' : '');
        btn.innerHTML = M.icon(current ? 'x' : 'play') + '<span>' + (current ? '关闭' : '开启') + '</span>';
        btn.className = 'btn sm ' + (current ? 'ghost' : 'primary');
        btn.setAttribute('aria-pressed', current ? 'true' : 'false');
        btn.title = current ? '点击关闭' : '点击开启';
        onChange(current);
      }
    });
    btn.setAttribute('aria-pressed', current ? 'true' : 'false');
    btn.title = current ? '点击关闭' : '点击开启';
    ctl.appendChild(btn);
    row.appendChild(ctl);
    return row;
  }

  function toggleRow(label, hint, on, onChange) {
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

  /* ------------------------------ 主题 ------------------------------ */
  function themeSection() {
    var wrap = el('div');
    wrap.appendChild(U.secTitle('外观主题'));
    var card = el('div', { class: 'card pad' });
    card.appendChild(el('div', {
      class: 'tiny muted',
      style: 'margin-bottom:12px',
      text: '选一个顺眼的主题；主题会立即生效并保存在本地。'
    }));
    var grid = el('div', { class: 'theme-grid' });
    var current = HZQ.store.settings().theme || 'auto';

    THEMES.forEach(function (t) {
      var btn = el('button', { class: 'theme-card' + (t.id === current ? ' on' : ''), type: 'button' });
      var sw = el('span', {
        class: 'theme-swatch',
        style: 'background:linear-gradient(135deg,' + t.colors[0] + ' 0 52%,' + t.colors[1] + ' 52% 100%)'
      });
      btn.appendChild(sw);
      var body = el('span', { class: 'theme-body' });
      body.appendChild(el('span', { class: 't', text: t.name }));
      body.appendChild(el('span', { class: 'd', text: t.desc }));
      btn.appendChild(body);
      btn.addEventListener('click', function () {
        HZQ.app.setTheme(t.id);
        Array.prototype.forEach.call(grid.querySelectorAll('.theme-card'), function (x) {
          x.classList.toggle('on', x === btn);
        });
        M.toast('已切换到「' + t.name + '」', 'ok');
      });
      grid.appendChild(btn);
    });

    card.appendChild(grid);
    wrap.appendChild(card);
    return wrap;
  }

  /* ------------------------------ 导出 ------------------------------ */
  function exportSection() {
    var wrap = el('div');
    wrap.appendChild(U.secTitle('导出与备份'));
    var card = el('div', { class: 'card pad' });
    var g = HZQ.store.globalStats();
    card.appendChild(el('div', {
      class: 'tiny muted',
      style: 'margin-bottom:12px',
      text: '当前数据：已答 ' + g.done + ' 题 · 错题 ' + g.wrongCount + ' 道 · 收藏 ' + g.favCount +
        ' 道 · 成绩 ' + g.sessions + ' 轮。备份文件是 JSON，包含进度、错题、收藏、成绩和设置。'
    }));

    var actions = el('div', { class: 'row-2' });
    actions.appendChild(U.btn('下载备份文件', {
      kind: 'primary', icon: 'download',
      onClick: function () {
        M.download(backupName(), backupText());
        HZQ.store.markTrial('export');
        M.toast('备份文件已开始下载', 'ok');
      }
    }));
    actions.appendChild(U.btn('分享到微信 / QQ / 网盘等', {
      icon: 'upload',
      onClick: shareBackup
    }));
    actions.appendChild(U.btn('复制备份内容', {
      icon: 'copy',
      onClick: function () {
        M.copyText(backupText()).then(function (ok) {
          if (ok) HZQ.store.markTrial('export');
          M.toast(ok ? '备份内容已复制，可直接粘贴发送' : '复制失败，请改用下载', ok ? 'ok' : 'bad');
        });
      }
    }));
    card.appendChild(actions);

    card.appendChild(el('div', {
      class: 'tiny muted',
      style: 'margin-top:12px;line-height:1.8',
      text: '下载后可发送到微信、QQ、邮箱或任意网盘；如果浏览器支持系统分享，点击“分享到…”会直接打开系统分享面板，选择已安装的应用。'
    }));
    wrap.appendChild(card);
    return wrap;
  }

  function backupName() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'hqz-backup-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }

  function backupText() {
    var obj = JSON.parse(HZQ.store.exportAll());
    var user = HZQ.profile && HZQ.profile.current();
    if (user) obj.user = user;
    return JSON.stringify(obj, null, 2);
  }

  function shareBackup() {
    var text = backupText();
    var name = backupName();
    HZQ.store.markTrial('export');
    var file = null;
    try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }

    if (navigator.share) {
      var payload = { title: '刷题备份', text: '刷题题库备份（' + name + '）' };
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) payload.files = [file];
      } catch (e) { /* 某些浏览器 canShare 会抛异常，退化成文本分享 */ }
      navigator.share(payload).then(function () {
        M.toast('已打开系统分享', 'ok');
      }).catch(function (err) {
        if (err && err.name !== 'AbortError') {
          M.toast('系统分享不可用，请先下载备份文件', 'bad');
        }
      });
    } else {
      M.toast('当前浏览器不支持系统分享，请先下载备份文件，再发送到微信 / QQ / 网盘', 'bad');
    }
  }

  /* ------------------------------ 清理 ------------------------------ */
  function clearSection(state) {
    var wrap = el('div');
    wrap.appendChild(U.secTitle('数据清理'));

    var wrongAll = HZQ.store.wrongList();
    var rounds = [];
    var roundMap = {};
    wrongAll.forEach(function (it) {
      var key = (it.info && it.info.sessionId) || 'older';
      if (!roundMap[key]) {
        roundMap[key] = true;
        rounds.push(key);
      }
    });

    var card = el('div', { class: 'card pad clear-card', id: 'data-clear' });
    var controls = el('div', { class: 'filterbar' });
    var range = el('select', { class: 'select', 'aria-label': '时间范围' });
    [['all', '全部时间'], ['today', '今天'], ['7d', '近 7 天'], ['30d', '近 30 天']].forEach(function (p) {
      var o = el('option', { value: p[0], text: p[1] });
      range.appendChild(o);
    });
    controls.appendChild(range);

    var roundSel = el('select', { class: 'select', 'aria-label': '错题轮次' });
    var allRound = el('option', { value: 'all', text: '错题：全部轮次' });
    roundSel.appendChild(allRound);
    rounds.forEach(function (key) {
      var label = key === 'older' ? '更早的错题' : roundLabel(key);
      roundSel.appendChild(el('option', { value: key, text: label }));
    });
    controls.appendChild(roundSel);

    var hint = el('span', { class: 'tiny muted', text: '时间筛选会同时作用于下面所有数据类型。' });
    controls.appendChild(hint);
    card.appendChild(controls);

    var body = el('div');
    card.appendChild(body);

    range.addEventListener('change', function () {
      state.range = range.value;
      resetSel(state);
      paint();
    });
    roundSel.addEventListener('change', function () {
      state.wrongRound = roundSel.value;
      state.sel.wrong = {};
      paint();
    });

    function paint() {
      body.innerHTML = '';
      body.appendChild(buildWrong(state));
      body.appendChild(buildFav(state));
      body.appendChild(buildHistory(state));
      body.appendChild(buildSearch(state));
      body.appendChild(buildQuality(state));
    }
    state.repaint = paint;
    paint();
    wrap.appendChild(card);
    return wrap;
  }

  function resetSel(state) {
    state.sel = { wrong: {}, fav: {}, history: {}, historyQ: {}, search: {}, quality: {} };
  }

  function inRange(ts, range) {
    if (range === 'all') return true;
    ts = ts || 0;
    var now = new Date();
    if (range === 'today') {
      var d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    var days = range === '7d' ? 7 : 30;
    return Date.now() - ts <= days * 86400000;
  }

  /** 数据清理列表统一使用精确到秒的时间，避免同一天多条记录分不清先后 */
  function timeText(ts) {
    if (!ts) return '时间未知';
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function roundLabel(sessionId) {
    var rec = HZQ.store.historyOf(sessionId);
    if (rec) return (rec.bankTitle || rec.bankId) + ' · ' + (rec.modeName || rec.mode) + ' · ' + timeText(rec.finishedAt);
    var item = HZQ.store.wrongList().filter(function (it) { return it.info && it.info.sessionId === sessionId; })[0];
    if (item) {
      var bank = HZQ.data.bank(item.info.bankId) || {};
      return (bank.title || item.info.bankId || '错题') + ' · ' + (item.info.modeName || '练习') + ' · ' + timeText(item.info.at);
    }
    return '一轮错题';
  }

  function sectionHead(title, sub, keys, map, repaint) {
    var head = el('div', { class: 'clear-head' });
    var left = el('div', { class: 'grow' });
    left.appendChild(el('div', { class: 'clear-title', text: title }));
    if (sub) left.appendChild(el('div', { class: 'tiny muted', text: sub }));
    head.appendChild(left);

    var checkLabel = el('label', { class: 'check-inline' });
    var check = el('input', { type: 'checkbox' });
    check.checked = keys.length > 0 && keys.every(function (k) { return !!map[k]; });
    check.addEventListener('change', function () {
      if (check.checked) keys.forEach(function (k) { map[k] = 1; });
      else keys.forEach(function (k) { delete map[k]; });
      repaint();
    });
    checkLabel.appendChild(check);
    checkLabel.appendChild(el('span', { text: '全选' }));
    head.appendChild(checkLabel);

    var count = keys.filter(function (k) { return !!map[k]; }).length;
    var del = U.btn('删除选中' + (count ? '（' + count + '）' : ''), {
      small: true, kind: 'danger', icon: 'trash', disabled: count === 0,
      onClick: function () { /* 各数据区块会绑定自己的删除确认逻辑 */ }
    });
    head.appendChild(del);
    return head;
  }

  function checkItem(map, key, repaint) {
    var label = el('label', { class: 'check-box' });
    var input = el('input', { type: 'checkbox' });
    input.checked = !!map[key];
    input.addEventListener('change', function () {
      if (input.checked) map[key] = 1; else delete map[key];
      repaint();
    });
    label.appendChild(input);
    return label;
  }

  function itemRow(map, key, repaint, body, meta, actions) {
    var row = el('div', { class: 'clear-row' });
    row.appendChild(checkItem(map, key, repaint));
    var main = el('div', { class: 'body' });
    main.appendChild(el('div', { class: 'stem-1', text: M.plain(body) }));
    if (meta) main.appendChild(el('div', { class: 'meta tiny muted', text: meta }));
    row.appendChild(main);
    if (actions) row.appendChild(actions);
    return row;
  }

  function buildWrong(state) {
    var list = HZQ.store.wrongList().filter(function (it) {
      if (!inRange(it.info.at, state.range)) return false;
      var key = it.info.sessionId || 'older';
      return state.wrongRound === 'all' || key === state.wrongRound;
    });
    var map = state.sel.wrong;
    var wrap = el('div', { class: 'clear-block' });

    function paint() {
      // 重新绘制整个设置页，保持各区块状态一致
      state.repaint();
    }

    var head = sectionHead('错题本', '共 ' + list.length + ' 道 · 可单独选择或按轮次筛选', list.map(function (it) { return it.qid; }), map, paint);
    var del = head.querySelector('.btn.danger');
    if (del) {
      del.onclick = null;
      del.addEventListener('click', function () {
        var keys = Object.keys(map);
        if (!keys.length) return;
        M.confirmBox({
          title: '删除选中的错题？', danger: true, okText: '删除',
          body: el('p', { text: '只会从错题本移除，不会删除题库和成绩记录。' })
        }).then(function (ok) {
          if (!ok) return;
          HZQ.store.removeWrongMany(keys);
          HZQ.store.markTrial('clear');
          keys.forEach(function (k) { delete map[k]; });
          M.toast('已删除 ' + keys.length + ' 道错题', 'ok');
          state.repaint();
        });
      });
    }
    wrap.appendChild(head);
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'clear-empty', text: '这个范围内没有错题。' }));
      return wrap;
    }
    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (!q) return;
      var bank = HZQ.data.bank(q.bankId) || {};
      wrap.appendChild(itemRow(map, it.qid, paint, q.stem,
        (bank.title || q.bankId) + ' · ' + timeText(it.info.at) + ' · 错 ' + (it.info.times || 1) + ' 次', null));
    });
    return wrap;
  }

  function buildFav(state) {
    var list = HZQ.store.favList().filter(function (it) { return inRange(it.info.at, state.range); });
    var map = state.sel.fav;
    function paint() { state.repaint(); }
    var wrap = el('div', { class: 'clear-block' });
    var head = sectionHead('重点收藏', '共 ' + list.length + ' 道', list.map(function (it) { return it.qid; }), map, paint);
    var del = head.querySelector('.btn.danger');
    if (del) {
      del.onclick = null;
      del.addEventListener('click', function () {
        var keys = Object.keys(map);
        if (!keys.length) return;
        M.confirmBox({
          title: '删除选中的收藏？', danger: true, okText: '删除',
          body: el('p', { text: '只会取消收藏，不会删除题库和成绩记录。' })
        }).then(function (ok) {
          if (!ok) return;
          HZQ.store.removeFavMany(keys);
          HZQ.store.markTrial('clear');
          keys.forEach(function (k) { delete map[k]; });
          M.toast('已取消 ' + keys.length + ' 道收藏', 'ok');
          state.repaint();
        });
      });
    }
    wrap.appendChild(head);
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'clear-empty', text: '这个范围内没有收藏。' }));
      return wrap;
    }
    list.forEach(function (it) {
      var q = HZQ.data.question(it.qid);
      if (!q) return;
      var bank = HZQ.data.bank(q.bankId) || {};
      wrap.appendChild(itemRow(map, it.qid, paint, q.stem,
        (bank.title || q.bankId) + ' · 收藏于 ' + timeText(it.info.at), null));
    });
    return wrap;
  }

  function buildHistory(state) {
    var list = HZQ.store.history().filter(function (rec) { return inRange(rec.finishedAt, state.range); });
    var map = state.sel.history;
    var qMap = state.sel.historyQ;
    function paint() { state.repaint(); }
    var wrap = el('div', { class: 'clear-block' });
    var head = sectionHead('成绩记录', '共 ' + list.length + ' 轮 · 可整轮删除，也可展开删除某一轮的某道题',
      list.map(function (rec) { return rec.id; }), map, paint);
    var del = head.querySelector('.btn.danger');
    if (del) {
      var selectedQuestions = Object.keys(qMap).filter(function (key) {
        var sid = key.slice(0, key.indexOf('::'));
        return !map[sid];
      }).length;
      var selectedCount = Object.keys(map).length + selectedQuestions;
      del.disabled = selectedCount === 0;
      var delSpan = del.querySelector('span');
      if (delSpan) delSpan.textContent = '删除选中' + (selectedCount ? '（' + selectedCount + '）' : '');
      del.onclick = null;
      del.addEventListener('click', function () {
        var roundIds = Object.keys(map);
        var qKeys = Object.keys(qMap);
        if (!roundIds.length && !qKeys.length) return;
        M.confirmBox({
          title: '删除选中的成绩？', danger: true, okText: '删除',
          body: el('p', { text: '整轮删除会移除该轮所有题目记录；单题删除会按剩余题目重新计算该轮正确率。' })
        }).then(function (ok) {
          if (!ok) return;
          HZQ.store.removeHistoryMany(roundIds);
          var groups = {};
          qKeys.forEach(function (key) {
            var i = key.indexOf('::');
            var sid = key.slice(0, i);
            if (roundIds.indexOf(sid) >= 0) return;
            (groups[sid] = groups[sid] || []).push(key.slice(i + 2));
          });
          Object.keys(groups).forEach(function (sid) {
            HZQ.store.removeHistoryQuestions(sid, groups[sid]);
          });
          HZQ.store.markTrial('clear');
          Object.keys(map).forEach(function (k) { delete map[k]; });
          Object.keys(qMap).forEach(function (k) { delete qMap[k]; });
          M.toast('成绩记录已更新', 'ok');
          state.repaint();
        });
      });
    }
    wrap.appendChild(head);
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'clear-empty', text: '这个范围内没有成绩记录。' }));
      return wrap;
    }

    list.forEach(function (rec) {
      var row = el('div', { class: 'history-clear-row' });
      var top = el('div', { class: 'clear-row' });
      top.appendChild(checkItem(map, rec.id, paint));
      var body = el('div', { class: 'body' });
      body.appendChild(el('div', {
        class: 'stem-1',
        text: (rec.bankTitle || rec.bankId) + ' · ' + (rec.modeName || rec.mode)
      }));
      body.appendChild(el('div', {
        class: 'meta tiny muted',
        text: timeText(rec.finishedAt) + ' · 题量 ' + rec.total + ' · 正确率 ' + M.pct(rec.accuracy || 0)
      }));
      top.appendChild(body);
      var qBtn = U.btn('题目（' + (rec.questionIds || []).length + '）', {
        small: true, kind: 'ghost', icon: 'list',
        onClick: function () {
          state.expanded[rec.id] = !state.expanded[rec.id];
          state.repaint();
        }
      });
      top.appendChild(qBtn);
      row.appendChild(top);

      var detail = el('div', { class: 'history-questions' });
      if (!state.expanded[rec.id]) detail.setAttribute('hidden', 'hidden');
      (rec.questionIds || []).forEach(function (qid) {
        var q = HZQ.data.question(qid);
        if (!q) return;
        var ans = (rec.answers || {})[qid];
        var grade = ans ? HZQ.grading.grade(q, ans.picked || []) : 'empty';
        var status = grade === 'correct' ? '答对' : (grade === 'wrong' ? '答错' : (grade === 'na' ? '不计分' : '未答'));
        var qKey = rec.id + '::' + qid;
        var qRow = el('div', { class: 'clear-subrow' });
        qRow.appendChild(checkItem(qMap, qKey, paint));
        var qb = el('div', { class: 'body' });
        qb.appendChild(el('div', { class: 'tiny', text: M.plain(q.stem) }));
        qb.appendChild(el('div', {
          class: 'meta tiny muted',
          text: '第 ' + q.no + ' 题 · ' + status + ' · ' + timeText((ans && ans.at) || rec.finishedAt)
        }));
        qRow.appendChild(qb);
        detail.appendChild(qRow);
      });
      row.appendChild(detail);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildSearch(state) {
    var list = HZQ.store.searchHistory().filter(function (item) { return inRange(item.at, state.range); });
    var map = state.sel.search;
    function paint() { state.repaint(); }
    var wrap = el('div', { class: 'clear-block' });
    var head = sectionHead('搜题记录', '共 ' + list.length + ' 条 · 可在搜题页开启无痕模式', list.map(function (item) { return item.id; }), map, paint);
    var del = head.querySelector('.btn.danger');
    if (del) {
      del.onclick = null;
      del.addEventListener('click', function () {
        var keys = Object.keys(map);
        if (!keys.length) return;
        M.confirmBox({
          title: '删除选中的搜题记录？', danger: true, okText: '删除',
          body: el('p', { text: '只删除关键词历史，不影响题库和练习数据。' })
        }).then(function (ok) {
          if (!ok) return;
          HZQ.store.removeSearchHistory(keys);
          HZQ.store.markTrial('clear');
          keys.forEach(function (k) { delete map[k]; });
          M.toast('搜题记录已删除', 'ok');
          state.repaint();
        });
      });
    }
    wrap.appendChild(head);
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'clear-empty', text: '这个范围内没有搜题记录。' }));
      return wrap;
    }
    list.forEach(function (item) {
      var row = el('div', { class: 'clear-row' });
      row.appendChild(checkItem(map, item.id, paint));
      var body = el('div', { class: 'body' });
      body.appendChild(el('div', { class: 'stem-1', text: item.keyword }));
      body.appendChild(el('div', {
        class: 'meta tiny muted',
        text: timeText(item.at) + (item.count ? ' · ' + item.count + ' 条结果' : '')
      }));
      row.appendChild(body);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildQuality(state) {
    var all = HZQ.store.qualityFixes() || {};
    var list = Object.keys(all).map(function (key) {
      return { key: key, info: all[key] };
    }).filter(function (item) { return inRange(item.info.at, state.range); })
      .sort(function (a, b) { return b.info.at - a.info.at; });
    var map = state.sel.quality;
    function paint() { state.repaint(); }
    var wrap = el('div', { class: 'clear-block' });
    var head = sectionHead('数据体检', '共 ' + list.length + ' 条异常标记 · 删除后会恢复对应题目', list.map(function (item) { return item.key; }), map, paint);
    var del = head.querySelector('.btn.danger');
    if (del) {
      del.onclick = null;
      del.addEventListener('click', function () {
        var keys = Object.keys(map);
        if (!keys.length) return;
        M.confirmBox({
          title: '撤销选中的异常标记？', danger: true, okText: '撤销',
          body: el('p', { text: '撤销后，相关题目会恢复到标记前的状态，并重新出现在数据体检中。' })
        }).then(function (ok) {
          if (!ok) return;
          HZQ.store.removeQualityFixes(keys);
          HZQ.store.markTrial('clear');
          if (HZQ.views.quality && HZQ.views.quality.syncFixes) HZQ.views.quality.syncFixes();
          keys.forEach(function (k) { delete map[k]; });
          M.toast('已撤销 ' + keys.length + ' 条异常标记', 'ok');
          state.repaint();
        });
      });
    }
    wrap.appendChild(head);
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'clear-empty', text: '这个范围内没有异常标记。' }));
      return wrap;
    }
    list.forEach(function (item) {
      var q = item.info.questionId ? HZQ.data.question(item.info.questionId) : null;
      var row = el('div', { class: 'clear-row' });
      row.appendChild(checkItem(map, item.key, paint));
      var body = el('div', { class: 'body' });
      body.appendChild(el('div', { class: 'stem-1', text: item.info.label || item.key }));
      body.appendChild(el('div', {
        class: 'meta tiny muted',
        text: (q ? ('第 ' + q.no + ' 题 · ' + M.plain(q.stem).slice(0, 70)) : item.info.questionId) +
          ' · ' + timeText(item.info.at)
      }));
      row.appendChild(body);
      wrap.appendChild(row);
    });
    return wrap;
  }

  return { render: render };
})();
