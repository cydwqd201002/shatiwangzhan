/* ==========================================================================
   i18n.js —— 界面语言（导航 / 页面标题 / 系统提示）
   题库题干、选项、答案来自原始题库，保持原文，不做机器翻译或改写。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.i18n = (function () {
  'use strict';
  var DICT = {
    zh: {
      'app.title': '刷题',
      'nav.home': '首页',
      'nav.wrong': '错题本',
      'nav.favorites': '收藏',
      'nav.history': '记录',
      'page.home': '首页',
      'page.bank': '题库',
      'page.quiz': '答题',
      'page.result': '练习结果',
      'page.wrong': '错题本',
      'page.favorites': '重点收藏',
      'page.history': '成绩记录',
      'page.search': '搜题',
      'page.quality': '数据体检',
      'page.settings': '设置与备份',
      'page.trial': '用户测试',
      'theme.title': '要切换到深色模式吗？',
      'theme.body': '你所在的时区已经进入傍晚，深色背景会更适合阅读。',
      'theme.dark': '开启深色',
      'theme.midnight': '午夜紫',
      'theme.light': '保持浅色',
      'theme.settings': '去设置选择颜色',
      'theme.disable': '以后不再提醒',
      'account.login': '登录',
      'account.register': '注册',
      'account.logout': '退出登录'
    },
    en: {
      'app.title': 'Quiz',
      'nav.home': 'Home',
      'nav.wrong': 'Mistakes',
      'nav.favorites': 'Saved',
      'nav.history': 'History',
      'page.home': 'Home',
      'page.bank': 'Banks',
      'page.quiz': 'Quiz',
      'page.result': 'Result',
      'page.wrong': 'Mistake Book',
      'page.favorites': 'Saved Questions',
      'page.history': 'Score History',
      'page.search': 'Search',
      'page.quality': 'Data Check',
      'page.settings': 'Settings & Backup',
      'page.trial': 'User Test',
      'theme.title': 'Switch to dark mode?',
      'theme.body': 'It is getting dark in your time zone. A dark background may be easier to read.',
      'theme.dark': 'Use dark',
      'theme.midnight': 'Midnight',
      'theme.light': 'Stay light',
      'theme.settings': 'Choose a color',
      'theme.disable': 'Do not remind me again',
      'account.login': 'Log in',
      'account.register': 'Register',
      'account.logout': 'Log out'
    },
    ja: {
      'app.title': 'クイズ',
      'nav.home': 'ホーム',
      'nav.wrong': '間違い',
      'nav.favorites': '保存',
      'nav.history': '記録',
      'page.home': 'ホーム',
      'page.bank': '問題集',
      'page.quiz': '回答',
      'page.result': '結果',
      'page.wrong': '間違いノート',
      'page.favorites': '保存した問題',
      'page.history': '成績記録',
      'page.search': '検索',
      'page.quality': 'データ診断',
      'page.settings': '設定とバックアップ',
      'page.trial': 'ユーザーテスト',
      'theme.title': 'ダークモードに切り替えますか？',
      'theme.body': 'お住まいのタイムゾーンは夕方になりました。暗い背景の方が読みやすい場合があります。',
      'theme.dark': 'ダークにする',
      'theme.midnight': 'ミッドナイト',
      'theme.light': 'ライトのまま',
      'theme.settings': '色を選ぶ',
      'theme.disable': '今後表示しない',
      'account.login': 'ログイン',
      'account.register': '登録',
      'account.logout': 'ログアウト'
    }
  };

  function lang() {
    var l = HZQ.store && HZQ.store.settings ? HZQ.store.settings().language : 'zh';
    return DICT[l] ? l : 'zh';
  }
  function setLang(l) {
    if (DICT[l] && HZQ.store) HZQ.store.setSetting('language', l);
  }
  function t(key, fallback) {
    var d = DICT[lang()] || DICT.zh;
    return d[key] || (fallback !== undefined ? fallback : key);
  }
  function languages() {
    return [
      { id: 'zh', name: '中文' },
      { id: 'en', name: 'English' },
      { id: 'ja', name: '日本語' }
    ];
  }
  return { lang: lang, setLang: setLang, t: t, languages: languages };
})();
