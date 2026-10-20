/* ==========================================================================
   data.js —— 题库访问层
   把 window.QUIZ_DATA（由 tools/build_data.pl 生成）包装成带索引的只读接口。
   页面里任何地方都只通过这里取题，保证"同一道题在任何页面都是同一份数据"。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.data = (function () {
  'use strict';

  var raw = window.QUIZ_DATA || { banks: [], issues: [] };

  var banks = raw.banks || [];
  var issues = raw.issues || [];

  var bankById = {};
  var qById = {};
  var qIndex = {};      // qid -> 在所属题库中的序号（0 基）

  banks.forEach(function (b) {
    bankById[b.id] = b;
    b.questions.forEach(function (q, i) {
      qById[q.id] = q;
      qIndex[q.id] = i;
      q._bank = b;                 // 反向引用，避免到处传 bank
    });
    b.chapterById = {};
    (b.chapters || []).forEach(function (c) { b.chapterById[c.id] = c; });
  });

  /* ---------- 知识点章节：Web 用原始章节，Java 按题干关键词细分 ---------- */
  var JAVA_RULES = [
    { id: 'java-collection', title: '集合与泛型', order: 2, re: /集合|List|Map|Set|ArrayList|HashMap|LinkedList|Iterator|泛型|Queue|entrySet|keySet/ },
    { id: 'java-exception', title: '异常处理', order: 3, re: /异常|try|catch|throw|finally|Exception|RuntimeException/ },
    { id: 'java-io-thread', title: 'IO 与多线程', order: 4, re: /文件|File|输入流|输出流|InputStream|OutputStream|线程|Thread|Runnable|同步|synchronized|IO/ },
    { id: 'java-array-string', title: '数组与字符串', order: 5, re: /数组|String|字符串|charAt|StringBuilder|length|indexOf|substring|equals|split/ },
    { id: 'java-control', title: '流程控制', order: 6, re: /循环|for|while|switch|if|break|continue|条件|判断/ },
    { id: 'java-oop', title: '面向对象', order: 1, re: /面向对象|类和对象|构造方法|构造器|继承|多态|重写|重载|接口|抽象|封装|super|this|static|final|访问权限|package|import|成员变量|成员方法|父类|子类|对象/ },
    { id: 'java-basic', title: '基础语法', order: 7, re: /环境变量|JDK|JRE|JVM|编译|main|关键字|标识符|数据类型|基本类型|类型转换|变量|常量|运算符|注释/ }
  ];

  function difficultyOf(q) {
    var d = q.type === 'judge' ? 1 : (q.type === 'multiple' ? 3 : 2);
    var stem = String(q.stem || '');
    if (stem.length > 60) d++;
    if (stem.length > 120) d++;
    if ((q.answer || []).length > 1) d++;
    if (q.explanation && String(q.explanation).length > 120) d++;
    if (stem.indexOf('```') >= 0) d++;
    return Math.max(1, Math.min(5, d));
  }

  banks.forEach(function (b) {
    var groups = {};
    var order = [];
    if (b.id !== 'java' && (b.chapters || []).length > 1) {
      b.chapters.forEach(function (c) {
        groups[c.id] = { id: c.id, title: c.title, order: c.order || order.length + 1, questionIds: [] };
        order.push(groups[c.id]);
      });
    } else {
      JAVA_RULES.forEach(function (r) {
        groups[r.id] = { id: r.id, title: r.title, order: r.order, questionIds: [] };
        order.push(groups[r.id]);
      });
      groups['java-misc'] = { id: 'java-misc', title: '综合练习', order: 99, questionIds: [] };
      order.push(groups['java-misc']);
    }

    b.questions.forEach(function (q) {
      q.difficulty = difficultyOf(q);
      if (b.id === 'java') {
        var text = [q.stem, (q.options || []).map(function (o) { return o.text; }).join(' '), q.explanation].join(' ');
        var matched = null;
        for (var i = 0; i < JAVA_RULES.length; i++) {
          if (JAVA_RULES[i].re.test(text)) { matched = JAVA_RULES[i]; break; }
        }
        q.knowledgeId = matched ? matched.id : 'java-misc';
        q.knowledgeTitle = matched ? matched.title : '综合练习';
      } else {
        var ch = (b.chapterById || {})[q.chapterId];
        q.knowledgeId = q.chapterId || 'misc';
        q.knowledgeTitle = ch ? ch.title : '综合练习';
      }
      if (!groups[q.knowledgeId]) {
        groups[q.knowledgeId] = { id: q.knowledgeId, title: q.knowledgeTitle, order: 999, questionIds: [] };
        order.push(groups[q.knowledgeId]);
      }
      groups[q.knowledgeId].questionIds.push(q.id);
    });

    b.knowledgeChapters = order.filter(function (g) { return g.questionIds.length; })
      .sort(function (a, b2) { return a.order - b2.order; });
  });

  var issuesByBank = {};
  var issuesByQuestion = {};
  issues.forEach(function (it) {
    if (it.bankId) (issuesByBank[it.bankId] = issuesByBank[it.bankId] || []).push(it);
    if (it.questionId) (issuesByQuestion[it.questionId] = issuesByQuestion[it.questionId] || []).push(it);
  });

  function bank(id) { return bankById[id] || null; }
  function question(id) { return qById[id] || null; }
  function indexOf(qid) { return qIndex[qid]; }

  /** 取某题库的题目列表，可按章节过滤；order='random' 时打乱 */
  function questions(bankId, opts) {
    opts = opts || {};
    var b = bank(bankId);
    if (!b) return [];
    var list = b.questions.filter(function (q) { return !q.hidden; });
    if (opts.knowledgeIds && opts.knowledgeIds.length) {
      var kset = {};
      opts.knowledgeIds.forEach(function (k) { kset[k] = 1; });
      list = list.filter(function (q) { return kset[q.knowledgeId]; });
    }
    if (opts.chapterIds && opts.chapterIds.length) {
      var set = {};
      opts.chapterIds.forEach(function (c) { set[c] = 1; });
      list = list.filter(function (q) { return set[q.chapterId]; });
    }
    if (opts.onlyScorable) list = list.filter(function (q) { return q.scorable; });
    if (opts.order === 'random') return HZQ.util.shuffle(list);
    return list.slice();
  }

  /** 全部题目（含被数据体检隐藏的题，供搜题和体检使用） */
  function allQuestions() {
    var out = [];
    banks.forEach(function (b) {
      b.questions.forEach(function (q) { out.push(q); });
    });
    return out;
  }

  function chapterQuestions(bankId, chapterId) {
    return questions(bankId, { chapterIds: [chapterId] });
  }

  function knowledgeChapters(bankId) {
    var b = bank(bankId);
    return b && b.knowledgeChapters ? b.knowledgeChapters.slice() : [];
  }

  function knowledgeQuestions(bankId, knowledgeIds) {
    return questions(bankId, { knowledgeIds: knowledgeIds || [] });
  }

  function sortByDifficulty(list) {
    return (list || []).slice().sort(function (a, b) {
      return (a.difficulty || 0) - (b.difficulty || 0) || (a.no || 0) - (b.no || 0);
    });
  }

  function difficultyLabel(q) {
    var d = q.difficulty || 1;
    return d <= 1 ? '入门' : (d === 2 ? '基础' : (d === 3 ? '进阶' : (d === 4 ? '较难' : '挑战')));
  }

  /** 跨题库搜索题干（也支持按选项文本搜） */
  function search(kw, limit) {
    kw = String(kw || '').trim().toLowerCase();
    if (!kw) return [];
    var out = [];
    for (var i = 0; i < banks.length; i++) {
      var b = banks[i];
      for (var j = 0; j < b.questions.length; j++) {
        var q = b.questions[j];
        if (q.stem.toLowerCase().indexOf(kw) >= 0 ||
            (q.explanation || '').toLowerCase().indexOf(kw) >= 0 ||
            q.options.some(function (o) { return o.text.toLowerCase().indexOf(kw) >= 0; })) {
          out.push({ bank: b, question: q });
          if (limit && out.length >= limit) return out;
        }
      }
    }
    return out;
  }

  function issuesOfBank(bankId) { return issuesByBank[bankId] || []; }
  function issuesOfQuestion(qid) { return issuesByQuestion[qid] || []; }

  /** 全站总览，首页用 */
  function overview() {
    var total = 0, scorable = 0, chapters = 0;
    banks.forEach(function (b) {
      total += b.questions.length;
      scorable += b.questions.filter(function (q) { return q.scorable; }).length;
      chapters += (b.chapters || []).length;
    });
    return { banks: banks.length, questions: total, scorable: scorable, chapters: chapters, issues: issues.length };
  }

  return {
    raw: raw,
    banks: banks,
    issues: issues,
    bank: bank,
    question: question,
    indexOf: indexOf,
    questions: questions,
    allQuestions: allQuestions,
    chapterQuestions: chapterQuestions,
    knowledgeChapters: knowledgeChapters,
    knowledgeQuestions: knowledgeQuestions,
    sortByDifficulty: sortByDifficulty,
    difficultyLabel: difficultyLabel,
    search: search,
    issuesOfBank: issuesOfBank,
    issuesOfQuestion: issuesOfQuestion,
    overview: overview
  };
})();
