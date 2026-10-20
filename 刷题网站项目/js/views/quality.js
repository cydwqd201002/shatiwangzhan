/* ==========================================================================
   views/quality.js —— 数据体检：实时扫描 / 原因 / 建议 / 人工确认后标记
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.quality = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var DEFS = {
    'empty-stem': {
      level: 'error',
      reason: '题干为空，用户无法正常阅读和作答。',
      suggestion: '回到原始题库补全题干；无法补全时建议暂时从练习中隐藏。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'no-options': {
      level: 'error',
      reason: '题目没有解析出任何选项，无法作答。',
      suggestion: '检查原始 Markdown 的选项格式；如果原题确实没有选项，建议隐藏该题。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'too-few-options': {
      level: 'error',
      reason: '选项少于 2 个，单选题/多选题无法形成有效选择。',
      suggestion: '补齐缺失选项；无法补齐时建议隐藏该题。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'duplicate-option': {
      level: 'error',
      reason: '同一道题里出现了重复选项。',
      suggestion: '核对原始题库并删除重复项；无法确认时建议隐藏该题。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'missing-answer': {
      level: 'error',
      reason: '原始题库没有提供答案，系统无法判分。',
      suggestion: '从原始资料补齐答案；无法确认时建议隐藏该题，避免影响正确率。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'answer-not-in-options': {
      level: 'error',
      reason: '答案字母不在现有选项里，作答后不可能判对。',
      suggestion: '核对答案和选项是否缺项；无法确认时建议隐藏该题。',
      fix: 'hide', fixLabel: '从练习中隐藏'
    },
    'no-explanation': {
      level: 'info',
      reason: '题目没有提供解析，回顾时缺少解题思路。',
      suggestion: '建议在原始 Markdown 题库里人工补充解析；系统不会自动生成或改写题目内容。',
      fix: null, fixLabel: ''
    },
    'duplicate-stem': {
      level: 'info',
      reason: '题干与前面某道题重复，可能是导入时重复收录。',
      suggestion: '保留首次出现的题目即可；一键标记会隐藏后面的重复题。',
      fix: 'hide', fixLabel: '隐藏重复题'
    }
  };

  function stemKey(s) {
    return String(s || '').toLowerCase().replace(/[\s\u3000]/g, '').replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
  }

  function optionKey(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function scanIssues() {
    var issues = [];
    var seenStem = {};

    HZQ.data.allQuestions().forEach(function (q) {
      var bank = HZQ.data.bank(q.bankId) || {};
      var chapter = (bank.chapterById || {})[q.chapterId] || null;
      var added = {};

      function add(code) {
        var def = DEFS[code];
        if (!def || added[code]) return;
        added[code] = 1;
        issues.push({
          key: q.id + ':' + code,
          code: code,
          level: def.level,
          question: q,
          bank: bank,
          chapter: chapter,
          reason: def.reason,
          suggestion: def.suggestion,
          fix: def.fix,
          fixLabel: def.fixLabel
        });
      }

      if (!q.stem || !String(q.stem).trim()) add('empty-stem');

      var optionKeys = {};
      if (!q.options || !q.options.length) {
        add('no-options');
      } else {
        if (q.options.length < 2) add('too-few-options');
        var texts = {};
        q.options.forEach(function (o) {
          optionKeys[String(o.key || '').toUpperCase()] = 1;
          var t = optionKey(o.text);
          if (t && texts[t]) add('duplicate-option');
          texts[t] = 1;
        });
      }

      if (!q.answer || !q.answer.length) {
        add('missing-answer');
      } else if (q.options && q.options.length) {
        var invalid = q.answer.some(function (k) { return !optionKeys[String(k).toUpperCase()]; });
        if (invalid) add('answer-not-in-options');
      }

      if (!q.explanation) add('no-explanation');

      var key = stemKey(q.stem);
      if (key) {
        if (seenStem[key]) add('duplicate-stem');
        else seenStem[key] = q;
      }
    });

    return issues;
  }

  function ensureOriginals() {
    HZQ.data.allQuestions().forEach(function (q) {
      if (!q._hqzOrig) {
        q._hqzOrig = { scorable: q.scorable };
      }
      q.hidden = false;
      q.scorable = q._hqzOrig.scorable;
    });
  }

  /** 只应用用户之前主动点击过的异常标记；打开页面时不会自动改动任何题目。 */
  function syncFixes() {
    ensureOriginals();
    var fixes = HZQ.store.qualityFixes() || {};
    var byKey = {};
    scanIssues().forEach(function (it) { byKey[it.key] = it; });
    Object.keys(fixes).forEach(function (key) {
      var it = byKey[key];
      if (!it) return;
      // 只把异常题从练习范围中排除，不修改题干、选项、答案或解析等原始字段。
      if (it.fix === 'hide') {
        it.question.hidden = true;
      }
    });
  }

  function count() {
    var fixes = HZQ.store.qualityFixes() || {};
    var seen = {};
    scanIssues().forEach(function (it) {
      if (it.level === 'error' && !fixes[it.key]) seen[it.question.id] = 1;
    });
    return Object.keys(seen).length;
  }

  function render(params) {
    params = params || {};
    syncFixes();

    var all = scanIssues();
    var fixes = HZQ.store.qualityFixes() || {};
    if (params.bankId) {
      all = all.filter(function (it) { return it.question.bankId === params.bankId; });
    }

    var open = all.filter(function (it) { return !fixes[it.key]; });
    var done = all.filter(function (it) { return fixes[it.key]; });
    var known = {};
    all.forEach(function (it) { known[it.key] = 1; });
    Object.keys(fixes).forEach(function (key) {
      if (known[key]) return;
      var info = fixes[key] || {};
      var q = HZQ.data.question(info.questionId);
      if (!q) return;
      var bank = HZQ.data.bank(q.bankId) || {};
      done.push({
        key: key,
        code: info.code || '',
        level: 'info',
        question: q,
        bank: bank,
        chapter: (bank.chapterById || {})[q.chapterId] || null,
        reason: '该问题已经按你的操作处理，当前重新扫描时不再出现。',
        suggestion: '如需恢复原题，可以在「设置与备份 → 数据清理 → 数据体检」里撤销这条异常标记。',
        fix: null,
        fixLabel: ''
      });
    });
    var errorQuestions = {};
    open.forEach(function (it) { if (it.level === 'error') errorQuestions[it.question.id] = 1; });
    var infoCount = open.filter(function (it) { return it.level === 'info'; }).length;
    var fixable = open.filter(function (it) { return !!it.fix; });

    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('数据体检', '实时检查题库的答案、选项、解析和重复题；异常标记必须由你手动点击。', []));

    var stats = el('div', { class: 'stats', style: 'margin-bottom:18px' });
    stats.appendChild(U.statCard(Object.keys(errorQuestions).length, '异常题目', errorQuestions && Object.keys(errorQuestions).length ? 'bad' : 'ok'));
    stats.appendChild(U.statCard(open.length, '待处理问题', open.length ? 'pri' : 'ok'));
    stats.appendChild(U.statCard(infoCount, '提示项'));
    stats.appendChild(U.statCard(done.length, '已标记记录', 'ok'));
    root.appendChild(stats);

    var banner = el('div', { class: 'feedback ' + (Object.keys(errorQuestions).length ? 'na' : 'ok') });
    banner.innerHTML = M.icon(Object.keys(errorQuestions).length ? 'alert' : 'checkCircle') +
      '<div class="fb-body">' +
      (Object.keys(errorQuestions).length
        ? '发现 <b>' + Object.keys(errorQuestions).length + '</b> 道题存在影响作答/判分的问题。下面列出了原因和处理建议；在你点击标记按钮之前，系统不会改动任何题目。'
        : '当前没有影响作答或判分的异常题目。信息提示项可以按需处理。') +
      '</div>';
    banner.style.marginBottom = '16px';
    root.appendChild(banner);

    var actions = el('div', { class: 'row-2', style: 'margin-bottom:16px' });
    actions.appendChild(U.btn('重新检查', {
      icon: 'refresh',
      onClick: function () { HZQ.app.go('#/quality' + (params.bankId ? '/' + params.bankId : '')); }
    }));
    if (fixable.length) {
      var fixAll = U.btn('一键标记异常并移出练习（' + fixable.length + '）', {
        kind: 'primary', icon: 'zap',
        onClick: function () {
          M.confirmBox({
            title: '确认标记 ' + fixable.length + ' 个异常？',
            body: el('div', {}, [
              el('p', { text: '将执行以下操作：' }),
              el('p', { class: 'tiny muted', style: 'margin-top:6px', text: '· 只做本地异常标记，并把相关题目移出练习范围。' }),
              el('p', { class: 'tiny muted', text: '· 不会修改题干、选项、答案、解析等任何原始内容，也不会生成新题目。' }),
              el('p', { class: 'tiny muted', text: '· 异常标记会保存在本地，之后可以在「设置与备份 → 数据清理」里删除并恢复。' })
            ]),
            okText: '确认标记'
          }).then(function (ok) {
            if (!ok) return;
            var items = {};
            fixable.forEach(function (it) {
              items[it.key] = {
                questionId: it.question.id,
                code: it.code,
                label: it.fixLabel + ' · 第 ' + it.question.no + ' 题'
              };
            });
            HZQ.store.addQualityFixes(items);
            syncFixes();
            M.toast('已标记 ' + fixable.length + ' 个异常，并移出练习', 'ok');
            HZQ.app.go('#/quality' + (params.bankId ? '/' + params.bankId : ''));
          });
        }
      });
      actions.appendChild(fixAll);
    } else {
      var clean = U.btn('当前没有可标记项', { icon: 'checkCircle', disabled: true });
      actions.appendChild(clean);
    }
    actions.appendChild(el('span', {
      class: 'tiny muted',
      text: '提示：页面加载、切换筛选都不会自动标记；只有点击按钮才会写入异常标记。'
    }));
    root.appendChild(actions);

    if (!open.length) {
      root.appendChild(U.empty('checkCircle', '待处理项已经清空', '没有需要标记的问题。你仍然可以在下方查看已标记记录。'));
    } else {
      root.appendChild(U.secTitle('待处理'));
      open.forEach(function (it) {
        root.appendChild(issueCard(it, false, params));
      });
    }

    if (done.length) {
      root.appendChild(U.secTitle('已标记记录'));
      done.forEach(function (it) {
        root.appendChild(issueCard(it, true, params));
      });
    }
    return root;
  }

  function issueCard(it, fixed, params) {
    var q = it.question;
    var card = el('div', { class: 'quality-item ' + (fixed ? 'fixed' : '') });
    var top = el('div', { class: 'quality-top' });
    top.appendChild(el('span', { class: 'tag ' + (it.level === 'error' ? 'bad' : 'warn'), text: it.level === 'error' ? '错误' : '提示' }));
    top.appendChild(el('span', { class: 'tag line', text: it.bank.title || q.bankId }));
    if (it.chapter) top.appendChild(el('span', { class: 'tag line', text: it.chapter.title }));
    top.appendChild(el('span', { class: 'tag', text: '第 ' + q.no + ' 题' }));
    top.appendChild(el('span', { class: 'grow' }));
    top.appendChild(el('span', { class: 'tag ' + (fixed ? 'ok' : 'pri'), text: fixed ? '已标记' : '待处理' }));
    card.appendChild(top);

    card.appendChild(el('div', { class: 'quality-stem', text: M.plain(q.stem) }));
    card.appendChild(el('div', { class: 'quality-line', html: '<b>异常原因：</b>' + M.esc(it.reason) }));
    card.appendChild(el('div', { class: 'quality-line', html: '<b>处理建议：</b>' + M.esc(it.suggestion) }));

    var actions = el('div', { class: 'row-2', style: 'margin-top:11px' });
    actions.appendChild(U.btn('查看题目', {
      small: true, kind: 'ghost', icon: 'eye',
      onClick: function () {
        HZQ.views.review.open(q, (HZQ.store.progressOf(q.id) || {}).picked || [], { title: '数据体检 · 题目检查' });
      }
    }));
    if (fixed) {
      actions.appendChild(U.btn('撤销标记', {
        small: true, kind: 'ghost', icon: 'refresh',
        onClick: function () {
          HZQ.store.removeQualityFixes([it.key]);
          syncFixes();
          M.toast('已撤销标记，题目已恢复练习', 'ok');
          HZQ.app.go('#/quality' + (params && params.bankId ? '/' + params.bankId : ''));
        }
      }));
    } else if (it.fix) {
      actions.appendChild(U.btn(it.fixLabel, {
        small: true, kind: 'primary', icon: 'zap',
        onClick: function () {
          var items = {};
          items[it.key] = {
            questionId: q.id,
            code: it.code,
            label: it.fixLabel + ' · 第 ' + q.no + ' 题'
          };
          HZQ.store.addQualityFixes(items);
          syncFixes();
          M.toast('已标记：' + it.fixLabel, 'ok');
          HZQ.app.go('#/quality' + (params && params.bankId ? '/' + params.bankId : ''));
        }
      }));
    }
    card.appendChild(actions);
    return card;
  }

  return { render: render, syncFixes: syncFixes, count: count, scan: scanIssues };
})();
