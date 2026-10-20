/* ==========================================================================
   grading.js —— 判题规则的唯一实现处
   --------------------------------------------------------------------------
   答题页的即时反馈、结果页统计、错题本、历史成绩……全部调用这里的函数。
   任何"判对判错"的逻辑都不允许在别处再写一遍 —— 否则同一道题在不同页面
   可能出现两种结果。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.grading = (function () {
  'use strict';

  /** 规范化用户选择：大写、去重、按字母排序 */
  function normalize(keys) {
    if (!keys) return [];
    var seen = {}, out = [];
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      var u = String(k).trim().toUpperCase();
      if (u && !seen[u]) { seen[u] = 1; out.push(u); }
    });
    return out.sort();
  }

  function sameSet(a, b) {
    var x = normalize(a), y = normalize(b);
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function isMultiple(q) { return q.type === 'multiple'; }

  /**
   * 判分。返回：
   *   'correct'  答对
   *   'wrong'    答错
   *   'na'       题目数据异常（原始题库缺答案 / 答案不在选项里），不计分
   *   'empty'    还没作答
   */
  function grade(q, picked) {
    var p = normalize(picked);
    if (!p.length) return 'empty';
    if (!q.scorable) return 'na';
    return sameSet(p, q.answer) ? 'correct' : 'wrong';
  }

  function isCorrect(q, picked) { return grade(q, picked) === 'correct'; }

  function keyText(keys) {
    var k = normalize(keys);
    return k.length ? k.join('、') : '';
  }

  function answerText(q) {
    if (!q.scorable && !(q.answer && q.answer.length)) return '（原始题库未提供答案）';
    return keyText(q.answer);
  }

  function pickedText(picked) {
    var t = keyText(picked);
    return t || '未作答';
  }

  /** 把选项 key 翻译成"B. unshift()"这种可读文本 */
  function optionText(q, key) {
    var o = q.options.filter(function (x) { return x.key === key; })[0];
    return o ? (key + '. ' + o.text) : key;
  }

  /** 结果页/错题本里展示的"你的答案 / 正确答案" */
  function compareText(q, picked) {
    return { yours: pickedText(picked), answer: answerText(q) };
  }

  function typeName(q) {
    return q.type === 'multiple' ? '多选题' : (q.type === 'judge' ? '判断题' : '单选题');
  }

  /** 数据异常的人话说明 */
  function anomalyText(q) {
    var flags = (q.flags || []).map(function (f) { return f.code; });
    if (flags.indexOf('no-options') >= 0) return '原始题库这一题缺少选项，无法作答，已按不计分处理';
    if (flags.indexOf('missing-answer') >= 0) return '原始题库这一题缺少答案，无法判分，已按不计分处理';
    if (flags.indexOf('answer-not-in-options') >= 0) {
      var bad = (q.flags.filter(function (f) { return f.code === 'answer-not-in-options'; })[0] || {}).detail;
      return '原始题库给出的答案是「' + (bad || '?') + '」，但选项里没有这一项，为避免误判已按不计分处理';
    }
    return '这一题的数据存在问题，已按不计分处理';
  }

  return {
    normalize: normalize,
    sameSet: sameSet,
    isMultiple: isMultiple,
    grade: grade,
    isCorrect: isCorrect,
    keyText: keyText,
    answerText: answerText,
    pickedText: pickedText,
    optionText: optionText,
    compareText: compareText,
    typeName: typeName,
    anomalyText: anomalyText
  };
})();
