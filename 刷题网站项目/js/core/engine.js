/* ==========================================================================
   engine.js —— 答题会话引擎
   --------------------------------------------------------------------------
   只负责"状态"和"规则"，不碰任何 DOM。答题页 / 结果页 / 首页都读同一份会话。
   两条硬约束写在这里：
     1) 判分只调用 HZQ.grading，本文件不重复实现任何判分逻辑。
     2) 得分永远是"算出来的"（stats() 遍历 answers 重新统计），不是"累加出来的"。
        所以同一题重复点提交，分数不可能变；重做本题分数也能自动回落。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.engine = (function () {
  'use strict';

  var M = HZQ.util;

  var MODES = {
    sequence: { key: 'sequence', name: '顺序练习', desc: '按题库原顺序从头到尾过一遍', instant: true,  icon: 'list' },
    random:   { key: 'random',   name: '随机练习', desc: '打乱顺序，避免靠题号背答案',   instant: true,  icon: 'shuffle' },
    chapter:  { key: 'chapter',  name: '章节练习', desc: '只刷选中的章节，适合分批推进', instant: true,  icon: 'layers' },
    fresh:    { key: 'fresh',    name: '只做未做', desc: '跳过已经答过的题',             instant: true,  icon: 'zap' },
    wrong:    { key: 'wrong',    name: '错题重练', desc: '只做错题本里的题，答对自动移出', instant: true, icon: 'refresh' },
    fav:      { key: 'fav',      name: '收藏重练', desc: '只做自己标了重点的题',         instant: true,  icon: 'star' },
    exam:     { key: 'exam',     name: '模拟考试', desc: '中途不给对错，交卷后统一判分', instant: false, icon: 'shield' }
  };

  function newId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 按选项挑出这一轮要做的题（create 与设置页的题量预览共用，避免两处规则不一致）
   * opts = { bankId, mode, chapterIds[], shuffle, limit }
   */
  function buildList(opts) {
    var mode = MODES[opts.mode] ? opts.mode : 'sequence';
    var chapterIds = opts.chapterIds && opts.chapterIds.length ? opts.chapterIds.slice() : [];
    var knowledgeIds = opts.knowledgeIds && opts.knowledgeIds.length ? opts.knowledgeIds.slice() : [];
    var list = HZQ.data.questions(opts.bankId, { chapterIds: chapterIds, knowledgeIds: knowledgeIds });

    if (mode === 'wrong') list = list.filter(function (q) { return HZQ.store.isWrong(q.id); });
    else if (mode === 'fav') list = list.filter(function (q) { return HZQ.store.isFav(q.id); });
    else if (mode === 'fresh') list = list.filter(function (q) { return !HZQ.store.progressOf(q.id); });

    // 错题 / 收藏模式按"最近错的、最近标的"优先，更贴近复习直觉
    if (mode === 'wrong' || mode === 'fav') {
      var rank = {};
      (mode === 'wrong' ? HZQ.store.wrongList() : HZQ.store.favList()).forEach(function (it, i) { rank[it.qid] = i; });
      list.sort(function (a, b) {
        return (rank[a.id] === undefined ? 1e9 : rank[a.id]) - (rank[b.id] === undefined ? 1e9 : rank[b.id]);
      });
    }
    if (opts.shuffle || mode === 'random') list = M.shuffle(list);
    if (opts.difficulty) list = HZQ.data.sortByDifficulty(list);

    var limit = opts.limit > 0 ? opts.limit : 0;
    if (limit) list = list.slice(0, limit);
    return list;
  }

  /**
   * 创建会话
   * opts = { bankId, mode, chapterIds[], shuffle, limit, instant, timed, timeLimitMin, autoNext }
   */
  function create(opts) {
    var mode = MODES[opts.mode] ? opts.mode : 'sequence';
    var def = MODES[mode];
    var bank = HZQ.data.bank(opts.bankId);
    if (!bank) throw new Error('题库不存在: ' + opts.bankId);

    var list = buildList(opts);
    if (opts.questionIds && opts.questionIds.length) {
      list = opts.questionIds.map(function (qid) { return HZQ.data.question(qid); })
        .filter(function (q) { return q && !q.hidden; });
    }
    var chapterIds = opts.chapterIds && opts.chapterIds.length ? opts.chapterIds.slice() : [];
    var knowledgeIds = opts.knowledgeIds && opts.knowledgeIds.length ? opts.knowledgeIds.slice() : [];

    var s = {
      id: newId(),
      bankId: opts.bankId,
      mode: mode,
      modeName: def.name,
      instant: opts.instant !== undefined ? !!opts.instant : def.instant,
      timed: !!opts.timed,
      timeLimitMin: opts.timeLimitMin > 0 ? opts.timeLimitMin : 0,
      autoNext: !!opts.autoNext,
      chapterIds: chapterIds,
      knowledgeIds: knowledgeIds,
      questionIds: list.map(function (q) { return q.id; }),
      index: 0,
      answers: {},
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      elapsedMs: 0,
      runningSince: Date.now(),
      finished: false,
      finishedAt: null
    };
    return s;
  }

  /** 从 localStorage 快照恢复（刷新页面 / 关掉再回来） */
  function restore(snap) {
    var s = {
      id: snap.id,
      bankId: snap.bankId,
      mode: snap.mode,
      modeName: (MODES[snap.mode] || {}).name || snap.modeName || '练习',
      instant: !!snap.instant,
      timed: !!snap.timed,
      timeLimitMin: snap.timeLimitMin || 0,
      autoNext: !!snap.autoNext,
      chapterIds: (snap.chapterIds || []).slice(),
      knowledgeIds: (snap.knowledgeIds || []).slice(),
      questionIds: (snap.questionIds || []).slice(),
      index: snap.index || 0,
      answers: snap.answers || {},
      startedAt: snap.startedAt || Date.now(),
      questionStartedAt: Date.now(),
      elapsedMs: snap.elapsedMs || 0,
      runningSince: Date.now(),
      finished: !!snap.finished,
      finishedAt: snap.finishedAt || null
    };
    // 题库更新后旧会话可能引用了不存在的题，过滤掉
    s.questionIds = s.questionIds.filter(function (id) { return !!HZQ.data.question(id); });
    if (!s.questionIds.length) return null;
    s.index = M.clamp(s.index, 0, s.questionIds.length - 1);
    return s;
  }

  function snapshot(s) {
    return {
      id: s.id, bankId: s.bankId, mode: s.mode, modeName: s.modeName,
      instant: s.instant, timed: s.timed, timeLimitMin: s.timeLimitMin, autoNext: s.autoNext,
      chapterIds: s.chapterIds, knowledgeIds: s.knowledgeIds, questionIds: s.questionIds, index: s.index,
      answers: s.answers, startedAt: s.startedAt, questionStartedAt: s.questionStartedAt, elapsedMs: elapsed(s),
      finished: s.finished, finishedAt: s.finishedAt
    };
  }

  /* ------------------------------ 时间 ------------------------------ */
  function elapsed(s) {
    return s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
  }
  function pause(s) { if (s.runningSince) { s.elapsedMs += Date.now() - s.runningSince; s.runningSince = null; } }
  function resume(s) { if (!s.runningSince && !s.finished) s.runningSince = Date.now(); }
  function timeLeft(s) {
    if (!s.timed || !s.timeLimitMin) return null;
    return Math.max(0, s.timeLimitMin * 60000 - elapsed(s));
  }

  /* ------------------------------ 取题 ------------------------------ */
  function current(s) { return HZQ.data.question(s.questionIds[s.index]) || null; }
  function questionAt(s, i) { return HZQ.data.question(s.questionIds[i]) || null; }
  function questions(s) { return s.questionIds.map(function (id) { return HZQ.data.question(id); }); }
  function total(s) { return s.questionIds.length; }

  function rec(s, qid) {
    if (!s.answers[qid]) s.answers[qid] = { picked: [], submitted: false, grade: null, attempts: 0, at: 0 };
    return s.answers[qid];
  }
  function record(s, qid) { return s.answers[qid || (current(s) || {}).id] || null; }

  /* ------------------------------ 选择 ------------------------------ */
  function pick(s, key) {
    var q = current(s);
    if (!q) return false;
    var r = rec(s, q.id);
    if (r.submitted && s.instant) return false;       // 已判题：锁定
    if (HZQ.grading.isMultiple(q)) {
      var i = r.picked.indexOf(key);
      if (i >= 0) r.picked.splice(i, 1); else r.picked.push(key);
    } else {
      r.picked = [key];
    }
    r.picked = HZQ.grading.normalize(r.picked);
    return true;
  }

  function setPicked(s, qid, keys) {
    var r = rec(s, qid);
    if (r.submitted && s.instant) return;
    r.picked = HZQ.grading.normalize(keys);
  }

  function clearPick(s, qid) {
    var q = HZQ.data.question(qid);
    if (!q) return;
    var r = rec(s, qid);
    if (r.submitted && s.instant) return;
    r.picked = [];
  }

  /**
   * 提交当前题。
   * 幂等：同一题第二次及以后调用只会累加 attempts，绝不重新判分、绝不改变得分。
   */
  function submit(s) {
    var q = current(s);
    if (!q) return { ok: false, reason: 'no-question' };
    var r = rec(s, q.id);
    if (!r.picked.length) return { ok: false, reason: 'empty' };
    if (r.submitted) {
      r.attempts += 1;
      return { ok: true, already: true, grade: r.grade, question: q };
    }
    var spent = s.questionStartedAt ? Math.max(0, Date.now() - s.questionStartedAt) : 0;
    r.spentMs = (r.spentMs || 0) + spent;
    s.questionStartedAt = Date.now();
    r.submitted = true;
    r.attempts += 1;
    r.at = Date.now();
    r.grade = HZQ.grading.grade(q, r.picked);

    // 落到全局进度（题库卡片进度、总统计都用它）
    HZQ.store.recordAnswer(q.id, r.picked, r.grade === 'correct');
    if (r.grade === 'wrong') {
      HZQ.store.addWrong(q.id, { sessionId: s.id, bankId: s.bankId, modeName: s.modeName });
    } else if (r.grade === 'correct' && HZQ.store.isWrong(q.id)) {
      HZQ.store.removeWrong(q.id);      // 错题答对 → 自动移出错题本
      r.removedFromWrong = true;
    }
    return { ok: true, already: false, grade: r.grade, question: q };
  }

  /** 重做本题：清空该题记录，得分会随之重新计算（不是"再加一次"） */
  function retry(s, qid) {
    qid = qid || (current(s) || {}).id;
    if (!qid) return;
    delete s.answers[qid];
  }

  /* ------------------------------ 导航 ------------------------------ */
  function goTo(s, i) {
    s.index = M.clamp(i, 0, total(s) - 1);
    s.questionStartedAt = Date.now();
    return current(s);
  }
  function next(s) { return s.index < total(s) - 1 ? goTo(s, s.index + 1) : null; }
  function prev(s) { return s.index > 0 ? goTo(s, s.index - 1) : null; }
  function hasNext(s) { return s.index < total(s) - 1; }
  function hasPrev(s) { return s.index > 0; }
  /** 第一道"还没提交"的题，交卷前跳转用 */
  function firstUnanswered(s) {
    for (var i = 0; i < s.questionIds.length; i++) {
      var r = s.answers[s.questionIds[i]];
      if (!r || !r.submitted) return i;
    }
    return -1;
  }

  /* ------------------------------ 统计 ------------------------------ */
  /**
   * 全部统计都由这里算出来。total / correct / wrong 都不会被"累加"修改，
   * 所以重复提交、重做本题都不会让分数失真。
   */
  function stats(s) {
    return statsFrom(s.questionIds, s.answers, elapsed(s));
  }

  /**
   * 全部统计都由这里算出来。total / correct / wrong 都不会被"累加"修改，
   * 所以重复提交、重做本题都不会让分数失真。
   * 对错一律现场调用 HZQ.grading.grade() 重新判定，不信任任何缓存的 grade 字段。
   */
  function statsFrom(questionIds, answers, durationMs) {
    var st = {
      total: questionIds.length, scorable: 0, naCount: 0,
      answered: 0, correct: 0, wrong: 0, blank: 0,
      accuracy: 0, durationMs: durationMs || 0
    };
    questionIds.forEach(function (qid) {
      var q = HZQ.data.question(qid);
      if (!q) return;
      if (q.scorable) st.scorable++; else st.naCount++;
      var r = answers[qid];
      if (!r || !r.submitted || !r.picked || !r.picked.length) { st.blank++; return; }
      var g = HZQ.grading.grade(q, r.picked);
      if (g === 'empty') { st.blank++; return; }
      st.answered++;
      if (g === 'correct') st.correct++;
      else if (g === 'wrong') st.wrong++;
    });
    var denom = st.correct + st.wrong;
    st.accuracy = denom ? st.correct / denom : 0;
    return st;
  }

  /** 按章节 / 题型拆分，结果页用 */
  function breakdown(s, key) {
    return breakdownFrom(s.questionIds, s.answers, key);
  }

  function breakdownFrom(questionIds, answers, key) {
    var map = {};
    questionIds.forEach(function (qid) {
      var q = HZQ.data.question(qid);
      if (!q) return;
      var k, label;
      if (key === 'chapter') {
        k = q.chapterId || 'none';
        label = (q._bank.chapterById[k] || {}).title || '未分章节';
      } else {
        k = q.type;
        label = HZQ.grading.typeName(q);
      }
      if (!map[k]) map[k] = { key: k, label: label, total: 0, correct: 0, wrong: 0, blank: 0 };
      var g = map[k];
      g.total++;
      var r = answers[qid];
      if (!r || !r.submitted || !r.picked || !r.picked.length) { g.blank++; return; }
      var gr = HZQ.grading.grade(q, r.picked);
      if (gr === 'correct') g.correct++;
      else if (gr === 'wrong') g.wrong++;
      else g.blank++;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  /** 交卷：把所有"选了但没提交"的题补判，然后结束计时 */
  function finish(s) {
    if (s.finished) return s;
    s.questionIds.forEach(function (qid) {
      var q = HZQ.data.question(qid);
      var r = s.answers[qid];
      if (!r || !r.picked.length || r.submitted) return;
      r.submitted = true;
      r.at = Date.now();
      r.late = true;
      r.grade = HZQ.grading.grade(q, r.picked);
      HZQ.store.recordAnswer(qid, r.picked, r.grade === 'correct');
      if (r.grade === 'wrong') HZQ.store.addWrong(qid, { sessionId: s.id, bankId: s.bankId, modeName: s.modeName });
      else if (r.grade === 'correct' && HZQ.store.isWrong(qid)) HZQ.store.removeWrong(qid);
    });
    pause(s);
    s.finished = true;
    s.finishedAt = Date.now();
    return s;
  }

  /** 交卷后写入历史成绩（只写一次，用 session.id 去重） */
  function saveHistory(s) {
    var exist = HZQ.store.historyOf(s.id);
    if (exist) return exist;
    var st = stats(s);
    return HZQ.store.addHistory({
      id: s.id,
      bankId: s.bankId,
      bankTitle: (HZQ.data.bank(s.bankId) || {}).title || s.bankId,
      mode: s.mode,
      modeName: s.modeName,
      chapterIds: s.chapterIds.slice(),
      knowledgeIds: (s.knowledgeIds || []).slice(),
      total: st.total,
      scorable: st.scorable,
      naCount: st.naCount,
      answered: st.answered,
      correct: st.correct,
      wrong: st.wrong,
      blank: st.blank,
      accuracy: st.accuracy,
      durationMs: st.durationMs,
      finishedAt: s.finishedAt || Date.now(),
      questionIds: s.questionIds.slice(),
      // 保留每题的选择，结果页/历史详情才能"回头看错在哪几道"
      answers: JSON.parse(JSON.stringify(s.answers))
    });
  }

  return {
    MODES: MODES,
    buildList: buildList,
    create: create, restore: restore, snapshot: snapshot,
    elapsed: elapsed, pause: pause, resume: resume, timeLeft: timeLeft,
    current: current, questionAt: questionAt, questions: questions, total: total,
    rec: rec, record: record, pick: pick, setPicked: setPicked, clearPick: clearPick,
    submit: submit, retry: retry,
    goTo: goTo, next: next, prev: prev, hasNext: hasNext, hasPrev: hasPrev, firstUnanswered: firstUnanswered,
    stats: stats, statsFrom: statsFrom, breakdown: breakdown, breakdownFrom: breakdownFrom,
    finish: finish, saveHistory: saveHistory
  };
})();
