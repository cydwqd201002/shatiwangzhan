/* ==========================================================================
   views/trial.js —— 用户测试任务 + 体验建议
   任务完成状态由对应操作自动写入（打开/使用某功能时标记）。
   ========================================================================== */
window.HZQ = window.HZQ || {};
HZQ.views = HZQ.views || {};

HZQ.views.trial = (function () {
  'use strict';
  var M = HZQ.util, U = HZQ.ui, el = M.el;

  var TASKS = [
    { key: 'wrong', title: '打开错题本并开始一轮错题重练', desc: '检查错题分组、重练和原成绩保留。', href: '#/wrong' },
    { key: 'compare', title: '上传一份其它用户成绩并完成对比', desc: '检查成绩记录里的本地上传对比。', href: '#/history' },
    { key: 'export', title: '导出自己的数据备份', desc: '下载或复制备份文件。', href: '#/settings' },
    { key: 'search', title: '搜索一道题目并打开预览', desc: '试试不完整输入或错字。', href: '#/search' },
    { key: 'theme', title: '切换一次主题', desc: '浅色、深色或自定义颜色都可以。', href: '#/settings' },
    { key: 'clear', title: '清空某个时间点的数据', desc: '在设置的数据清理里选一条删除。', href: '#/settings' },
    { key: 'exam', title: '完成一次考试模式', desc: '从章节、错题或收藏里组卷，交卷后自动打勾。', href: '#/bank/java' }
  ];

  function render() {
    var done = HZQ.store.trialDone();
    var completed = TASKS.filter(function (t) { return done[t.key]; }).length;
    var root = el('div');
    root.appendChild(U.crumb('返回首页', function () { HZQ.app.go('#/'); }));
    root.appendChild(U.pageHead('用户测试', '按真实使用场景走一遍；完成的操作会自动打勾。', []));

    var stats = el('div', { class: 'stats', style: 'margin-bottom:16px' });
    stats.appendChild(U.statCard(completed + ' / ' + TASKS.length, '已完成任务', completed === TASKS.length ? 'ok' : 'pri'));
    stats.appendChild(U.statCard(HZQ.store.trialFeedback().length, '反馈条数'));
    root.appendChild(stats);

    var bar = el('div', { class: 'bar', style: 'margin-bottom:18px' });
    bar.appendChild(el('i', { style: 'width:' + (completed / TASKS.length * 100).toFixed(1) + '%' }));
    root.appendChild(bar);

    var list = el('div', { class: 'rows' });
    TASKS.forEach(function (task) {
      var row = el('div', { class: 'trial-task' });
      var state = el('span', { class: 'trial-state ' + (done[task.key] ? 'done' : '') });
      state.innerHTML = done[task.key] ? M.icon('checkCircle') : M.icon('clock');
      row.appendChild(state);
      var body = el('div', { class: 'grow' });
      body.appendChild(el('div', { class: 't', text: task.title }));
      body.appendChild(el('div', { class: 'd', text: task.desc }));
      row.appendChild(body);
      row.appendChild(U.btn(done[task.key] ? '再看一次' : '去完成', {
        small: true, kind: done[task.key] ? 'ghost' : 'primary', icon: 'right',
        onClick: function () { HZQ.app.go(task.href); }
      }));
      list.appendChild(row);
    });
    root.appendChild(list);

    root.appendChild(U.secTitle('体验建议'));
    var card = el('div', { class: 'card pad' });
    card.appendChild(el('div', { class: 'tiny muted', style: 'margin-bottom:10px', text: '写下卡顿、看不懂、找不到入口的地方。反馈保存在本地，并会随数据备份一起导出。' }));
    var rating = el('select', { class: 'select', style: 'max-width:180px' });
    [5, 4, 3, 2, 1].forEach(function (n) {
      rating.appendChild(el('option', { value: n, text: n + ' 分 · ' + (n >= 5 ? '很顺手' : n >= 4 ? '不错' : n >= 3 ? '一般' : n >= 2 ? '有点卡' : '很难用') }));
    });
    card.appendChild(el('div', { class: 'field' }, [el('label', { text: '整体评分' }), rating]));
    var text = el('textarea', { class: 'input', rows: '4', placeholder: '例如：手机上看不清按钮、导出后不知道发到哪里、某道题评论加载慢……' });
    card.appendChild(el('div', { class: 'field' }, [el('label', { text: '具体建议' }), text]));
    var send = U.btn('提交反馈', {
      kind: 'primary', icon: 'check',
      onClick: function () {
        var value = text.value.trim();
        if (!value) { M.toast('先写一点具体建议吧', 'bad'); return; }
        HZQ.store.addTrialFeedback({
          at: Date.now(),
          rating: Number(rating.value) || 3,
          text: value,
          user: HZQ.profile && HZQ.profile.current() || '匿名'
        });
        text.value = '';
        M.toast('反馈已保存，感谢体验', 'ok');
        HZQ.app.go('#/trial');
      }
    });
    card.appendChild(send);
    root.appendChild(card);

    var feedback = HZQ.store.trialFeedback();
    if (feedback.length) {
      root.appendChild(U.secTitle('已记录的反馈'));
      var rows = el('div', { class: 'rows' });
      feedback.slice(0, 10).forEach(function (item) {
        var r = el('div', { class: 'rowitem static' });
        var b = el('div', { class: 'txt', style: 'white-space:normal' });
        b.textContent = (item.rating ? item.rating + ' 分 · ' : '') + item.text;
        r.appendChild(b);
        r.appendChild(el('span', { class: 'meta', text: (item.user || '匿名') + ' · ' + M.dateText(item.at) }));
        rows.appendChild(r);
      });
      root.appendChild(rows);
    }
    return root;
  }

  return { render: render };
})();
