/* ==========================================================================
   views/search.js —— 搜题：补全 / 模糊匹配 / 预览 / 搜索历史 / 无痕
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.search = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var indexCache = null;
  var timer = null;
  var lastRecorded = null;

  function normalize(s) {
    return String(s || '').toLowerCase()
      .replace(/[\s\u3000]/g, '')
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
  }

  function buildIndex() {
    if (indexCache) return indexCache;
    indexCache = HZQ.data.allQuestions().map(function (q) {
      var bank = HZQ.data.bank(q.bankId) || {};
      var chapter = (bank.chapterById || {})[q.chapterId] || null;
      var optText = (q.options || []).map(function (o) { return o.text; }).join(' ');
      return {
        q: q,
        bank: bank,
        chapter: chapter,
        stem: normalize(q.stem),
        opts: normalize(optText),
        exp: normalize(q.explanation),
        meta: normalize((bank.title || '') + ' ' + (chapter ? chapter.title : '') + ' ' + HZQ.grading.typeName(q) + ' ' + q.no)
      };
    });
    return indexCache;
  }

  function isSubsequence(q, text) {
    var i = 0;
    for (var j = 0; j < text.length && i < q.length; j++) {
      if (text.charAt(j) === q.charAt(i)) i++;
    }
    return i === q.length;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[b.length];
  }

  function bestDistance(q, text) {
    if (!text) return Infinity;
    if (text.length <= q.length + 4) return levenshtein(q, text);
    var minLen = Math.max(1, q.length - 2);
    var maxLen = Math.min(text.length, q.length + 2);
    var limit = Math.min(text.length, 150);
    var best = Infinity;
    for (var len = minLen; len <= maxLen; len++) {
      for (var i = 0; i + len <= limit; i++) {
        var d = levenshtein(q, text.substr(i, len));
        if (d < best) best = d;
        if (best === 0) return 0;
      }
    }
    return best;
  }

  function score(item, q) {
    var s = item.stem;
    var idx = s.indexOf(q);
    var best = 0;
    if (idx >= 0) {
      best = 1000 + Math.min(q.length, 20) * 4 - Math.min(idx, 50);
    } else {
      if (isSubsequence(q, s)) best = 700 + q.length * 4;
      if (q.length >= 2) {
        var d = bestDistance(q, s);
        var ratio = 1 - d / Math.max(q.length, 1);
        if (ratio >= 0.5) best = Math.max(best, 350 + ratio * 250);
      }
    }
    if (item.opts.indexOf(q) >= 0) best = Math.max(best, 650);
    if (item.exp.indexOf(q) >= 0) best = Math.max(best, 520);
    if (item.meta.indexOf(q) >= 0) best = Math.max(best, 430);
    return best;
  }

  function search(query) {
    var q = normalize(query);
    if (!q) return [];
    var hits = [];
    buildIndex().forEach(function (item) {
      var sc = score(item, q);
      if (sc > 0) hits.push({ item: item, score: sc });
    });
    hits.sort(function (a, b) {
      return b.score - a.score || a.item.q.no - b.item.q.no;
    });
    return hits.slice(0, 40).map(function (h) { return h.item; });
  }

  function highlight(text, query) {
    var raw = String(text || '');
    var q = String(query || '').trim();
    if (!q) return M.esc(raw);
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    var html = M.esc(raw), last = 0, out = '', m;
    while ((m = re.exec(raw)) !== null) {
      out += M.esc(raw.slice(last, m.index)) + '<mark>' + M.esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    out += M.esc(raw.slice(last));
    return out;
  }

  function render(params) {
    params = params || {};
    lastRecorded = null;
    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('搜题', '支持题目、选项、解析和章节关键词；输入不完整或有个别错字也能给出候选。', []));

    var box = el('div', { class: 'card pad search-box' });
    var row = el('div', { class: 'search-input-row' });
    var input = el('input', {
      class: 'input search-input', type: 'search',
      placeholder: '输入题目关键词，例如「安装Java」「网页布局」',
      'aria-label': '搜索题目',
      autocomplete: 'off'
    });
    if (params.q) input.value = params.q;
    var searchBtn = U.btn('搜索', { kind: 'primary', icon: 'search', onClick: function () { run(true); } });
    row.appendChild(input);
    row.appendChild(searchBtn);
    box.appendChild(row);

    var tools = el('div', { class: 'search-tools' });
    var incog = HZQ.store.settings().searchIncognito;
    var incogWrap = el('label', { class: 'switch-row' });
    var sw = el('label', { class: 'switch' });
    var swInput = el('input', { type: 'checkbox' });
    swInput.checked = !!incog;
    sw.appendChild(swInput);
    sw.appendChild(el('span', { class: 'track' }));
    incogWrap.appendChild(sw);
    incogWrap.appendChild(el('span', { text: '无痕搜索（不记录本次搜索历史）' }));
    tools.appendChild(incogWrap);
    tools.appendChild(el('span', { class: 'tiny muted', text: '按回车搜索，点击候选题目可直接预览。' }));
    box.appendChild(tools);
    root.appendChild(box);

    var panel = el('div', { class: 'search-panel' });
    root.appendChild(panel);

    function currentQuery() { return input.value.trim(); }

    function recordQuery(count) {
      if (!currentQuery() || swInput.checked || lastRecorded === currentQuery()) return;
      HZQ.store.addSearchRecord(currentQuery(), count);
      lastRecorded = currentQuery();
    }

    function run(fromAction) {
      if (timer) { clearTimeout(timer); timer = null; }
      paint();
      if (fromAction) {
        recordQuery(search(currentQuery()).length);
        paintHistoryOnly();
      }
    }

    function paint() {
      panel.innerHTML = '';
      var query = currentQuery();
      if (!query) {
        panel.appendChild(historyBlock());
        return;
      }
      var hits = search(query);
      panel.appendChild(suggestBlock(hits, query));
      panel.appendChild(resultBlock(hits, query));
    }

    function paintHistoryOnly() {
      // 搜索动作完成后，历史在输入框为空时自然展示；这里不强制打断结果。
    }

    function historyBlock() {
      var wrap = el('div', { class: 'search-history' });
      var head = el('div', { class: 'spread' });
      head.appendChild(U.secTitle('最近搜索'));
      var history = HZQ.store.searchHistory();
      if (history.length) {
        head.appendChild(U.btn('清空历史', {
          small: true, kind: 'ghost', icon: 'trash',
          onClick: function () {
            M.confirmBox({
              title: '清空搜索历史？',
              body: el('p', { text: '只会删除关键词记录，不会影响题库、错题和成绩。' }),
              danger: true, okText: '清空'
            }).then(function (ok) {
              if (!ok) return;
              HZQ.store.clearSearchHistory();
              M.toast('搜索历史已清空', 'ok');
              panel.innerHTML = '';
              panel.appendChild(historyBlock());
            });
          }
        }));
      }
      wrap.appendChild(head);
      if (!history.length) {
        wrap.appendChild(el('div', { class: 'tiny muted', text: '还没有搜索记录。输入关键词开始找题。' }));
      } else {
        history.forEach(function (item) {
          var row = el('button', { class: 'search-history-item', type: 'button' });
          row.appendChild(el('span', { class: 'k', text: item.keyword }));
          row.appendChild(el('span', {
            class: 'm',
            text: M.dateText(item.at) + (item.count ? ' · ' + item.count + ' 条结果' : '')
          }));
          row.addEventListener('click', function () {
            input.value = item.keyword;
            input.focus();
            lastRecorded = null;
            run(true);
          });
          wrap.appendChild(row);
        });
      }
      return wrap;
    }

    function suggestBlock(hits, query) {
      var wrap = el('div', { class: 'suggest-block' });
      if (!hits.length) return wrap;
      wrap.appendChild(el('div', { class: 'suggest-title', text: '可能的题目（点击预览）' }));
      hits.slice(0, 7).forEach(function (item) {
        var q = item.q;
        var row = el('button', { class: 'suggest-item', type: 'button' });
        var body = el('div', { class: 'body' });
        body.appendChild(el('div', { class: 'stem-1', html: highlight(M.plain(q.stem), query) }));
        var meta = el('div', { class: 'meta' });
        meta.appendChild(el('span', { class: 'tag', text: item.bank.title || q.bankId }));
        if (item.chapter) meta.appendChild(el('span', { class: 'tag line', text: item.chapter.title }));
        meta.appendChild(U.typeTag(q));
        body.appendChild(meta);
        row.appendChild(body);
        row.addEventListener('click', function () {
          recordQuery(hits.length);
          openPreview(item, false);
        });
        wrap.appendChild(row);
      });
      return wrap;
    }

    function resultBlock(hits, query) {
      var wrap = el('div', { class: 'search-results' });
      var head = el('div', { class: 'spread', style: 'margin-bottom:10px' });
      head.appendChild(el('div', {
        class: 'sec-title',
        style: 'margin:0',
        text: hits.length ? '搜索结果 · ' + hits.length + ' 道' : '没有找到相关题目'
      }));
      if (hits.length) {
        head.appendChild(el('span', { class: 'tiny muted', text: '已按相关度排序' }));
      }
      wrap.appendChild(head);

      if (!hits.length) {
        wrap.appendChild(el('div', {
          class: 'tiny muted',
          style: 'padding:14px 0',
          text: '换一个关键词试试；也可以只输入题干里的几个字，或输入章节名称。'
        }));
        return wrap;
      }

      hits.slice(0, 20).forEach(function (item) {
        var q = item.q;
        var card = el('div', { class: 'card pad search-result' });
        var top = el('div', { class: 'qtop' });
        top.appendChild(el('span', { class: 'no', text: '第 ' + q.no + ' 题' }));
        top.appendChild(U.typeTag(q));
        top.appendChild(el('span', { class: 'tag', text: item.bank.title || q.bankId }));
        if (item.chapter) top.appendChild(el('span', { class: 'tag line', text: item.chapter.title }));
        card.appendChild(top);
        card.appendChild(el('div', {
          class: 'stem', style: 'font-size:15px',
          html: highlight(q.stem, query)
        }));

        var preview = el('div', { class: 'search-preview' });
        (q.options || []).slice(0, 4).forEach(function (o) {
          var line = el('div', { class: 'pr' });
          line.appendChild(el('span', { class: 'k', text: o.key }));
          line.appendChild(el('span', { class: 't', text: M.plain(o.text) }));
          preview.appendChild(line);
        });
        if (!q.options || !q.options.length) {
          preview.appendChild(el('div', { class: 'tiny muted', text: '原题没有可用选项。' }));
        }
        card.appendChild(preview);

        var acts = el('div', { class: 'row-2', style: 'margin-top:12px' });
        acts.appendChild(U.btn('查看题目', {
          small: true, icon: 'eye',
          onClick: function () { recordQuery(hits.length); openPreview(item, false); }
        }));
        acts.appendChild(U.btn('答案与解析', {
          small: true, kind: 'primary', icon: 'lightbulb',
          onClick: function () { recordQuery(hits.length); openPreview(item, true); }
        }));
        card.appendChild(acts);
        wrap.appendChild(card);
      });

      if (hits.length > 20) {
        wrap.appendChild(el('div', {
          class: 'tiny muted', style: 'margin-top:10px;text-align:center',
          text: '还有 ' + (hits.length - 20) + ' 条结果，请输入更具体的关键词缩小范围。'
        }));
      }
      return wrap;
    }

    function openPreview(item, showAnswer) {
      var q = item.q;
      if (HZQ.store.markTrial) HZQ.store.markTrial('search');
      var body = el('div');
      body.appendChild(HZQ.views.review.card(q, [], { showAnswer: false }));
      if (showAnswer) {
        body.appendChild(HZQ.views.review.answerPanel(q, []));
      } else {
        var wrap = el('div', { style: 'margin-top:14px' });
        var btn = U.btn('显示答案和解析', {
          kind: 'primary', icon: 'lightbulb',
          onClick: function () {
            wrap.innerHTML = '';
            var panel = HZQ.views.review.answerPanel(q, []);
            wrap.appendChild(panel);
          }
        });
        wrap.appendChild(btn);
        body.appendChild(wrap);
      }
      M.openSheet({
        title: '题目预览', body: body, wide: true,
        actions: [{ text: '关闭', kind: 'primary', onClick: function (close) { close(); } }]
      });
    }

    swInput.addEventListener('change', function () {
      HZQ.store.setSetting('searchIncognito', swInput.checked);
      M.toast(swInput.checked ? '已开启无痕搜索' : '已关闭无痕搜索');
    });

    input.addEventListener('input', function () {
      lastRecorded = null;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        paint();
      }, 140);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        run(true);
      }
    });

    paint();
    if (params.q) recordQuery(search(params.q).length);
    return root;
  }

  function mount() {
    var input = document.querySelector('.search-input');
    if (input) {
      input.focus();
      if (input.value) input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function unmount() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  return { render: render, mount: mount, unmount: unmount };
})();
