/* ==========================================================================
   audio.js —— 背景音乐 / 环境音（纯静态，无外部音频资源）
   内置音轨由 Web Audio 实时合成；用户也可以上传自己的音频文件。
   ========================================================================== */
window.HZQ = window.HZQ || {};

HZQ.audio = (function () {
  'use strict';
  var CUSTOM_KEY = 'hqz.audioCustom.v1';
  var BUILTIN = [
    { id: 'calm', name: '静心音', desc: '极轻的三音和弦' },
    { id: 'rain', name: '细雨', desc: '柔和低通雨声' },
    { id: 'forest', name: '森林气息', desc: '轻风声与远处虫鸣' },
    { id: 'night', name: '夜航', desc: '低音铺底，适合夜间' },
    { id: 'waves', name: '海浪', desc: '缓慢起伏的潮声' },
    { id: 'fire', name: '壁炉', desc: '温暖的低频噼啪声' },
    { id: 'breath', name: '呼吸', desc: '很慢的环境铺底' },
    { id: 'chime', name: '午后微光', desc: '极轻的铃声' }
  ];
  var ctx = null, master = null, nodes = [], noiseSource = null, audioEl = null;
  var current = '';
  var volume = 0.2;
  var custom = loadCustom();

  function loadCustom() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveCustom() {
    try {
      var small = custom.filter(function (t) { return !!t.dataUrl; });
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(small));
    } catch (e) {}
  }
  function list() {
    return BUILTIN.concat(custom.map(function (t) {
      return { id: t.id, name: t.name, desc: '我的音频', custom: true };
    }));
  }
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function stopNodes() {
    nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
    nodes = [];
    noiseSource = null;
    if (audioEl) { try { audioEl.pause(); } catch (e) {} audioEl = null; }
  }
  function noiseBuffer(seconds) {
    var len = ctx.sampleRate * seconds;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  function addOsc(c, dest, freq, gainValue, type, lfoFreq, lfoDepth) {
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.value = gainValue;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    nodes.push(osc);
    if (lfoFreq) {
      var lfo = c.createOscillator();
      var lg = c.createGain();
      lfo.frequency.value = lfoFreq;
      lg.gain.value = lfoDepth || gainValue * 0.35;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      nodes.push(lfo);
    }
  }

  function addNoise(c, dest, filterType, frequency, q, gainValue, lfoFreq, lfoDepth) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(4);
    src.loop = true;
    var filter = c.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = frequency || 800;
    filter.Q.value = q || 0.4;
    var g = c.createGain();
    g.gain.value = gainValue;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start();
    nodes.push(src);
    if (lfoFreq) {
      var lfo = c.createOscillator();
      var lg = c.createGain();
      lfo.frequency.value = lfoFreq;
      lg.gain.value = lfoDepth || gainValue * 0.4;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      nodes.push(lfo);
    }
    noiseSource = src;
  }

  function playBuiltin(id) {
    var c = ensureCtx();
    if (!c) return false;
    var bed = c.createGain();
    bed.gain.setValueAtTime(0.0001, c.currentTime);
    bed.gain.linearRampToValueAtTime(1, c.currentTime + 2.4);
    bed.connect(master);

    if (id === 'rain') {
      addNoise(c, bed, 'lowpass', 620, 0.25, 0.026, 0.035, 0.008);
      addNoise(c, bed, 'bandpass', 1200, 0.5, 0.006);
      return true;
    }

    if (id === 'forest') {
      addNoise(c, bed, 'bandpass', 480, 0.35, 0.018, 0.045, 0.008);
      addOsc(c, bed, 523.25, 0.0018, 'sine', 0.06, 0.0012);
      addOsc(c, bed, 659.25, 0.0012, 'sine', 0.08, 0.0009);
      return true;
    }

    if (id === 'night') {
      addOsc(c, bed, 110.00, 0.0060, 'sine', 0.035, 0.0022);
      addOsc(c, bed, 146.83, 0.0038, 'sine', 0.045, 0.0016);
      addOsc(c, bed, 220.00, 0.0022, 'sine', 0.030, 0.0012);
      addNoise(c, bed, 'lowpass', 360, 0.3, 0.007, 0.025, 0.003);
      return true;
    }

    if (id === 'waves') {
      addNoise(c, bed, 'lowpass', 430, 0.2, 0.032, 0.045, 0.016);
      addOsc(c, bed, 98.00, 0.0025, 'sine', 0.04, 0.0012);
      return true;
    }

    if (id === 'fire') {
      addNoise(c, bed, 'lowpass', 230, 0.25, 0.030, 0.18, 0.012);
      addNoise(c, bed, 'bandpass', 900, 0.5, 0.0045, 0.7, 0.0025);
      return true;
    }

    if (id === 'breath') {
      addOsc(c, bed, 98.00, 0.0048, 'sine', 0.025, 0.0020);
      addOsc(c, bed, 147.00, 0.0028, 'sine', 0.030, 0.0014);
      addNoise(c, bed, 'lowpass', 260, 0.3, 0.006, 0.03, 0.0022);
      return true;
    }

    if (id === 'chime') {
      addOsc(c, bed, 392.00, 0.0028, 'sine', 0.06, 0.0018);
      addOsc(c, bed, 523.25, 0.0020, 'sine', 0.05, 0.0014);
      addOsc(c, bed, 659.25, 0.0012, 'sine', 0.045, 0.0010);
      addNoise(c, bed, 'lowpass', 500, 0.3, 0.004, 0.02, 0.0014);
      return true;
    }

    // calm：默认的极轻持续和弦
    addOsc(c, bed, 174.61, 0.0048, 'sine', 0.035, 0.0018);
    addOsc(c, bed, 220.00, 0.0035, 'sine', 0.045, 0.0014);
    addOsc(c, bed, 261.63, 0.0024, 'sine', 0.055, 0.0010);
    return true;
  }
  function play(id) {
    id = id || current;
    var track = list().filter(function (t) { return t.id === id; })[0];
    if (!track) return false;
    stopNodes();
    current = id;
    if (track.custom) {
      var item = custom.filter(function (t) { return t.id === id; })[0];
      if (!item) return false;
      audioEl = new Audio(item.dataUrl || item.url);
      audioEl.loop = true;
      audioEl.volume = volume * 0.8;
      audioEl.play().catch(function () {});
      return true;
    }
    return playBuiltin(id);
  }
  function pause() {
    stopNodes();
    current = '';
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.value = volume;
    if (audioEl) audioEl.volume = volume * 0.8;
  }
  function addFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^audio\//i.test(file.type || '')) {
        reject(new Error('请选择音频文件'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var item = {
          id: 'file-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: file.name || '我的音频',
          dataUrl: file.size <= 2 * 1024 * 1024 ? dataUrl : '',
          url: file.size <= 2 * 1024 * 1024 ? '' : URL.createObjectURL(file)
        };
        custom.unshift(item);
        if (custom.length > 8) custom.length = 8;
        saveCustom();
        resolve({ id: item.id, name: item.name, desc: '我的音频', custom: true });
      };
      reader.onerror = function () { reject(new Error('读取音频失败')); };
      reader.readAsDataURL(file);
    });
  }
  function removeCustom(id) {
    custom = custom.filter(function (t) { return t.id !== id; });
    saveCustom();
    if (current === id) pause();
  }
  return {
    list: list, play: play, pause: pause, setVolume: setVolume,
    addFile: addFile, removeCustom: removeCustom,
    current: function () { return current; },
    setCurrent: function (id) { current = id || ''; }
  };
})();
