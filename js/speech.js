/* 음성 출력(모델 음성·씨앗 목소리)과 음성 입력(사용자 입력 수신부 130) */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};

  var synth = root.speechSynthesis || null;
  var koVoice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices() || [];
    koVoice = vs.filter(function (v) { return /^ko/i.test(v.lang); })[0] || null;
  }
  if (synth) { pickVoice(); if ('onvoiceschanged' in synth) synth.onvoiceschanged = pickVoice; }

  /**
   * 말하기. who: 'model'(또박또박 모델 음성) | 'seed'(씨앗 목소리)
   * @returns Promise (끝나면 resolve)
   */
  function speak(text, who) {
    return new Promise(function (resolve) {
      if (!synth || !text) { setTimeout(resolve, 300); return; }
      try {
        synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        if (koVoice) u.voice = koVoice;
        u.rate = who === 'model' ? 0.7 : 0.95;
        u.pitch = who === 'seed' ? 1.5 : 1.0;
        var done = false;
        var finish = function () { if (!done) { done = true; resolve(); } };
        u.onend = finish; u.onerror = finish;
        setTimeout(finish, 1500 + text.length * 350); // 일부 브라우저에서 onend 누락 대비
        synth.speak(u);
      } catch (e) { resolve(); }
    });
  }
  function stopSpeaking() { try { synth && synth.cancel(); } catch (e) {} }

  var Rec = root.SpeechRecognition || root.webkitSpeechRecognition || null;

  function recognitionSupported() { return !!Rec; }

  /**
   * 한 번 듣기. resolve({alternatives:[...]}) | resolve({alternatives:[], error})
   */
  function listen(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!Rec) { resolve({ alternatives: [], error: 'unsupported' }); return; }
      stopSpeaking();
      var r = new Rec();
      r.lang = 'ko-KR';
      r.interimResults = false;
      r.maxAlternatives = 5;
      r.continuous = false;
      var settled = false, got = [];
      function finish(err) {
        if (settled) return; settled = true;
        resolve({ alternatives: got, error: err || null });
      }
      r.onresult = function (ev) {
        var res = ev.results[0];
        for (var i = 0; i < res.length; i++) got.push(res[i].transcript);
      };
      r.onerror = function (ev) { finish(ev.error || 'error'); };
      r.onend = function () { finish(null); };
      try { r.start(); } catch (e) { finish('start-failed'); }
      setTimeout(function () { try { r.stop(); } catch (e) {} }, opts.maxMs || 7000);
      SG.speech._active = r;
    });
  }
  function stopListening() { try { SG.speech._active && SG.speech._active.stop(); } catch (e) {} }

  SG.speech = {
    speak: speak, stopSpeaking: stopSpeaking, listen: listen, stopListening: stopListening,
    recognitionSupported: recognitionSupported, ttsSupported: function () { return !!synth; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
