/* ==========================================================================
   views/history.js —— 成绩记录：正确率曲线 / 薄弱知识点 / 针对性建议
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.history = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  function render() {
    var list = HZQ.store.history();
    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('成绩记录', '每一轮都算数：看曲线、找薄弱点，再决定下一轮练什么。', []));

    if (!list.length) {
      root.appendChild(U.empty('chart', '还没有成绩记录',
        '完成一轮练习并交卷后，这里会记录题量、正确率、用时和趋势。',
        U.btn('去刷题', { kind: 'primary', icon: 'play', onClick: function () { HZQ.app.go('#/'); } })));
      return root;
    }

    var avg = list.reduce(function (sum, rec) { return sum + (rec.accuracy || 0); }, 0) / list.length;
    var best = list.reduce(function (max, rec) { return Math.max(max, rec.accuracy || 0); }, 0);
    var stats = el('div', { class: 'stats', style: 'margin-bottom:18px' });
    stats.appendChild(U.statCard(list.length, '练习轮次'));
    stats.appendChild(U.statCard(M.pct(avg), '平均正确率', avg >= 0.8 ? 'ok' : 'pri'));
    stats.appendChild(U.statCard(M.pct(best), '最高正确率', 'ok'));
    stats.appendChild(U.statCard(list[0].total, '最近一轮题量'));
    root.appendChild(stats);

    root.appendChild(U.secTitle('正确率曲线'));
    root.appendChild(trendCard(list));

    root.appendChild(U.secTitle('学习建议'));
    var advice = el('div', { class: 'insight-grid' });
    buildAdvice(list).forEach(function (item) { advice.appendChild(insightCard(item)); });
    root.appendChild(advice);

    root.appendChild(compareSection());

    root.appendChild(U.secTitle('每轮记录'));
    var rows = el('div', { class: 'rows' });
    list.forEach(function (rec) {
      rows.appendChild(historyRow(rec));
    });
    root.appendChild(rows);
    return root;
  }

  function trendCard(list) {
    var recs = list.slice(0, 12).reverse();
    var card = el('div', { class: 'card pad trend-card' });
    var chart = el('div', { class: 'trend-chart' });

    if (recs.length > 1) {
      var W = 720, H = 190, pl = 38, pr = 18, pt = 20, pb = 34;
      var iw = W - pl - pr, ih = H - pt - pb;
      var pts = recs.map(function (rec, i) {
        var x = pl + (recs.length === 1 ? iw / 2 : i * iw / (recs.length - 1));
        var y = pt + (1 - (rec.accuracy || 0)) * ih;
        return { x: x, y: y, rec: rec };
      });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
      var area = line + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + (pt + ih) + ' L' + pts[0].x.toFixed(1) + ' ' + (pt + ih) + ' Z';

      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="正确率变化曲线">';
      [0, 0.5, 1].forEach(function (v) {
        var y = pt + (1 - v) * ih;
        svg += '<line x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '" class="guide"/>';
        svg += '<text x="' + (pl - 9) + '" y="' + (y + 4) + '" text-anchor="end" class="axis">' + Math.round(v * 100) + '%</text>';
      });
      svg += '<path d="' + area + '" class="area"/>';
      svg += '<path d="' + line + '" class="line"/>';
      pts.forEach(function (p, i) {
        svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" class="dot">' +
          '<title>' + M.esc(M.dateText(p.rec.finishedAt) + ' · ' + M.pct(p.rec.accuracy)) + '</title></circle>';
        if (i === 0 || i === pts.length - 1 || recs.length <= 6) {
          svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - 11) + '" text-anchor="middle" class="axis">' +
            M.esc((i + 1) + '') + '</text>';
        }
      });
      svg += '</svg>';
      chart.innerHTML = svg;
      card.appendChild(chart);
      card.appendChild(el('div', {
        class: 'tiny muted',
        style: 'margin-top:8px;text-align:center',
        text: '展示最近 ' + recs.length + ' 轮，横轴为轮次，纵轴为正确率。'
      }));
    } else {
      chart.appendChild(el('div', {
        class: 'tiny muted',
        style: 'padding:26px 0;text-align:center',
        text: '再完成一轮练习，就能看到正确率曲线的变化。'
      }));
      card.appendChild(chart);
    }
    return card;
  }

  function buildAdvice(list) {
    var out = [];
    var latest = list[0];
    var prev = list[1] || null;
    var diff = prev ? latest.accuracy - prev.accuracy : 0;

    if (latest.accuracy >= 0.85) {
      out.push({
        kind: 'ok', icon: 'trophy', title: '最近一轮很稳',
        text: '正确率 ' + M.pct(latest.accuracy) + '，说明这一轮的知识点掌握得不错。可以尝试提高题量或切到模拟考试，保持手感。'
      });
    } else if (prev && diff > 0.05) {
      out.push({
        kind: 'ok', icon: 'chart', title: '正在进步',
        text: '比上一轮提高了 ' + M.pct(diff) + '。继续保持现在的复习节奏，下一轮可以重点回看本轮错题。'
      });
    } else if (prev && diff < -0.05) {
      out.push({
        kind: 'bad', icon: 'alert', title: '最近一轮有回落',
        text: '比上一轮下降了 ' + M.pct(Math.abs(diff)) + '。别急，先回看错题和解析，把薄弱章节补上，再开新一轮。'
      });
    } else {
      out.push({
        kind: 'pri', icon: 'lightbulb', title: '继续积累样本',
        text: '目前正确率比较平稳。多做几轮、把错题重练一遍，曲线会更有参考价值。'
      });
    }

    var weak = weakChapters(list.slice(0, 8));
    if (weak.length) {
      out.push({
        kind: 'warn', icon: 'target', title: '建议优先加强：' + weak[0].label,
        text: '最近 ' + weak[0].rounds + ' 轮涉及这个章节，错误/未答 ' + weak[0].missed + ' 道，正确率 ' +
          M.pct(weak[0].accuracy) + '。建议先看解析，再用「错题重练」集中做一小轮。'
      });
      if (weak.length > 1) {
        out.push({
          kind: 'warn', icon: 'layers', title: '其它需要留意的知识点',
          text: weak.slice(1, 3).map(function (w) {
            return w.label + '（正确率 ' + M.pct(w.accuracy) + '）';
          }).join('、') + '。可以在题库设置页按章节单独练习。'
        });
      }
    } else {
      out.push({
        kind: 'ok', icon: 'checkCircle', title: '暂时没有明显薄弱章节',
        text: '最近几轮各章节表现比较均衡。可以尝试随机练习或模拟考试，检验真实掌握程度。'
      });
    }

    var totalMissed = list.slice(0, 5).reduce(function (sum, rec) { return sum + (rec.wrong || 0) + (rec.blank || 0); }, 0);
    if (totalMissed > 0) {
      out.push({
        kind: 'pri', icon: 'refresh', title: '错题是最好的入口',
        text: '最近 5 轮还有 ' + totalMissed + ' 道错题/未答题。去错题本按轮次重练，比重刷整本题库更省时间。'
      });
    }
    return out;
  }

  function weakChapters(list) {
    var map = {};
    list.forEach(function (rec) {
      if (!rec.questionIds || !rec.answers) return;
      HZQ.engine.breakdownFrom(rec.questionIds, rec.answers, 'chapter').forEach(function (row) {
        if (!row.total) return;
        if (!map[row.label]) map[row.label] = { label: row.label, total: 0, missed: 0, rounds: 0 };
        var item = map[row.label];
        item.total += row.total;
        item.missed += row.wrong + row.blank;
        item.rounds++;
      });
    });
    return Object.keys(map).map(function (k) {
      var item = map[k];
      item.accuracy = item.total ? (item.total - item.missed) / item.total : 0;
      return item;
    }).filter(function (item) { return item.missed > 0; })
      .sort(function (a, b) { return (a.accuracy - b.accuracy) || (b.missed - a.missed); });
  }

  /* ------------------------------ 成绩对比 ------------------------------ */
  function compareSection() {
    var wrap = el('div');
    wrap.appendChild(U.secTitle('成绩对比'));
    var users = [];
    var card = el('div', { class: 'card pad compare-card' });
    var note = el('div', { class: 'tiny muted', style: 'margin-bottom:12px', text: '上传另一个用户导出的 JSON 备份，在本机做成绩对比。文件不会上传到服务器。' });
    card.appendChild(note);
    var actions = el('div', { class: 'row-2' });
    var file = el('input', { type: 'file', accept: '.json,application/json', multiple: 'multiple', style: 'display:none' });
    actions.appendChild(U.btn('上传其他用户成绩', { kind: 'primary', icon: 'upload', onClick: function () { file.click(); } }));
    var clear = U.btn('清空对比', {
      kind: 'ghost', icon: 'trash',
      onClick: function () { users = []; paint(); }
    });
    actions.appendChild(clear);
    card.appendChild(actions);
    card.appendChild(file);
    var output = el('div', { style: 'margin-top:14px' });
    card.appendChild(output);
    wrap.appendChild(card);

    function readOne(f) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(String(reader.result || ''));
            var db = obj && obj.db ? obj.db : obj;
            var history = db && Array.isArray(db.history) ? db.history : (Array.isArray(obj.history) ? obj.history : null);
            if (!history) throw new Error('文件里没有成绩记录');
            resolve({ name: (obj.user || f.name.replace(/\.json$/i, '')).slice(0, 24), history: history });
          } catch (e) {
            M.toast(f.name + '：' + (e.message || '不是有效的备份文件'), 'bad');
            resolve(null);
          }
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsText(f);
      });
    }

    file.addEventListener('change', function () {
      var files = Array.prototype.slice.call(file.files || []);
      if (!files.length) return;
      Promise.all(files.map(readOne)).then(function (loaded) {
        loaded.filter(Boolean).forEach(function (u) { users.push(u); });
        if (users.length) {
          HZQ.store.markTrial('compare');
          M.toast('已载入 ' + loaded.filter(Boolean).length + ' 份成绩', 'ok');
        }
        file.value = '';
        paint();
      });
    });

    function metrics(history) {
      var rounds = history.length;
      var total = 0, answered = 0, correct = 0, accSum = 0, best = 0;
      history.forEach(function (rec) {
        total += rec.total || 0;
        answered += rec.answered || 0;
        correct += rec.correct || 0;
        accSum += rec.accuracy || 0;
        best = Math.max(best, rec.accuracy || 0);
      });
      return {
        rounds: rounds, total: total, answered: answered, correct: correct,
        avg: rounds ? accSum / rounds : 0, best: best,
        recent: history[0] ? history[0].accuracy || 0 : 0
      };
    }

    function paint() {
      output.innerHTML = '';
      if (!users.length) {
        output.appendChild(el('div', { class: 'tiny muted', text: '还没有导入其他用户。成绩记录会从上传文件的 history 字段读取。' }));
        clear.disabled = true;
        return;
      }
      clear.disabled = false;
      var me = metrics(HZQ.store.history());
      var cols = [{ name: '我', m: me, mine: true }].concat(users.map(function (u) {
        return { name: u.name, m: metrics(u.history), mine: false };
      }));
      var table = el('table', { class: 'compare-table' });
      var thead = el('tr');
      ['指标'].concat(cols.map(function (c) { return c.name; })).forEach(function (text) {
        thead.appendChild(el('th', { text: text }));
      });
      table.appendChild(thead);
      [
        ['练习轮次', 'rounds'],
        ['总题量', 'total'],
        ['已作答', 'answered'],
        ['答对', 'correct'],
        ['平均正确率', 'avg', true],
        ['最高正确率', 'best', true],
        ['最近一轮', 'recent', true]
      ].forEach(function (row) {
        var tr = el('tr');
        tr.appendChild(el('th', { text: row[0] }));
        cols.forEach(function (c) {
          var v = c.m[row[1]];
          tr.appendChild(el('td', { text: row[2] ? M.pct(v) : String(v) }));
        });
        table.appendChild(tr);
      });
      output.appendChild(table);

      var bars = el('div', { class: 'compare-bars' });
      cols.forEach(function (c) {
        var line = el('div', { class: 'compare-bar-row' });
        line.appendChild(el('span', { class: 'name', text: c.name }));
        var b = el('div', { class: 'bar' + (c.m.avg >= 0.8 ? ' ok' : (c.m.avg < 0.6 ? ' bad' : '')) });
        b.appendChild(el('i', { style: 'width:' + (c.m.avg * 100).toFixed(1) + '%' }));
        line.appendChild(b);
        line.appendChild(el('b', { text: M.pct(c.m.avg) }));
        bars.appendChild(line);
      });
      output.appendChild(bars);
      output.appendChild(el('div', { class: 'tiny muted', style: 'margin-top:10px', text: '对比只读取各文件的轮次、题量和正确率，不读取或修改对方的题库答案。' }));
    }
    paint();
    return wrap;
  }

  function insightCard(item) {
    var box = el('div', { class: 'insight ' + (item.kind || '') });
    box.appendChild(el('span', { class: 'ic', html: M.icon(item.icon || 'info') }));
    var body = el('div', { class: 'body' });
    body.appendChild(el('div', { class: 't', text: item.title }));
    body.appendChild(el('div', { class: 'd', text: item.text }));
    box.appendChild(body);
    return box;
  }

  function historyRow(rec) {
    var row = el('button', { class: 'hist-item', type: 'button' });
    var body = el('div', { class: 'body' });
    var title = el('div', { class: 't1' });
    title.appendChild(el('span', { text: rec.bankTitle || rec.bankId }));
    title.appendChild(el('span', { class: 'tag line', text: rec.modeName || rec.mode }));
    if ((rec.wrong || 0) === 0 && (rec.blank || 0) === 0) {
      title.appendChild(el('span', { class: 'tag ok', text: '全对' }));
    }
    body.appendChild(title);
    body.appendChild(el('div', {
      class: 't2',
      text: M.dateText(rec.finishedAt) + ' · 题量 ' + rec.total + ' · 已答 ' + rec.answered +
        ' · 用时 ' + M.dur(rec.durationMs)
    }));
    var bar = el('div', { class: 'bar thin' + ((rec.accuracy || 0) < 0.8 ? ' bad' : ''), style: 'margin-top:8px' });
    bar.appendChild(el('i', {
      style: 'width:' + ((rec.accuracy || 0) * 100).toFixed(1) + '%'
    }));
    body.appendChild(bar);
    row.appendChild(body);

    var score = el('div', { class: 'score' });
    var val = el('div', {
      class: 'v ' + ((rec.accuracy || 0) >= 0.8 ? 'ok' : ((rec.accuracy || 0) >= 0.6 ? 'mid' : 'bad')),
      text: M.pct(rec.accuracy || 0)
    });
    score.appendChild(val);
    score.appendChild(el('div', { class: 'l', text: rec.correct + ' / ' + rec.total + ' 答对' }));
    row.appendChild(score);

    row.addEventListener('click', function () { openDetail(rec); });
    return row;
  }

  function openDetail(rec) {
    var body = el('div');
    var summary = el('div', { class: 'summary-list' });
    [
      ['题库', rec.bankTitle || rec.bankId],
      ['模式', rec.modeName || rec.mode],
      ['完成时间', M.dateText(rec.finishedAt)],
      ['题量 / 已答', rec.total + ' / ' + rec.answered],
      ['答对 / 答错 / 未答', rec.correct + ' / ' + rec.wrong + ' / ' + rec.blank],
      ['正确率', M.pct(rec.accuracy || 0)],
      ['用时', M.dur(rec.durationMs)]
    ].forEach(function (p) {
      var r = el('div', { class: 'r' });
      r.appendChild(el('span', { class: 'muted', text: p[0] }));
      r.appendChild(el('b', { text: String(p[1]) }));
      summary.appendChild(r);
    });
    body.appendChild(summary);

    var rows = HZQ.engine.breakdownFrom(rec.questionIds || [], rec.answers || {}, 'chapter');
    if (rows.length) {
      body.appendChild(U.secTitle('章节表现'));
      var box = el('div', { class: 'breakdown' });
      rows.forEach(function (r) {
        var wrap = el('div', { class: 'bd-row' });
        var cap = el('div', { class: 'cap' });
        cap.appendChild(el('span', { class: 'nm', text: r.label }));
        cap.appendChild(el('span', { class: 'vl', text: r.correct + ' / ' + r.total }));
        wrap.appendChild(cap);
        var ratio = r.total ? r.correct / r.total : 0;
        var bar = el('div', { class: 'bar' + (ratio >= 0.8 ? ' ok' : (ratio < 0.6 ? ' bad' : '')) });
        bar.appendChild(el('i', { style: 'width:' + (ratio * 100).toFixed(1) + '%' }));
        wrap.appendChild(bar);
        box.appendChild(wrap);
      });
      body.appendChild(box);
    }

    var wrong = (rec.questionIds || []).map(function (qid) {
      var q = HZQ.data.question(qid);
      var ans = (rec.answers || {})[qid];
      if (!q || !ans) return null;
      var g = HZQ.grading.grade(q, ans.picked || []);
      return g === 'correct' ? null : { q: q, picked: ans.picked || [] };
    }).filter(Boolean);
    if (wrong.length) {
      body.appendChild(U.secTitle('本轮错题 / 未答'));
      wrong.forEach(function (item) {
        var row = el('div', { class: 'qitem' });
        var b = el('div', { class: 'body' });
        b.appendChild(el('div', { class: 'stem-1', text: M.plain(item.q.stem) }));
        var meta = el('div', { class: 'meta' });
        meta.appendChild(el('span', { class: 'tag', text: (HZQ.data.bank(item.q.bankId) || {}).title || item.q.bankId }));
        meta.appendChild(U.typeTag(item.q));
        b.appendChild(meta);
        row.appendChild(b);
        row.addEventListener('click', function () {
          HZQ.views.review.open(item.q, item.picked, { title: '题目回顾' });
        });
        body.appendChild(row);
      });
    }

    M.openSheet({ title: '本轮成绩详情', body: body, wide: true, actions: [{ text: '关闭', kind: 'primary', onClick: function (close) { close(); } }] });
  }

  return { render: render };
})();
