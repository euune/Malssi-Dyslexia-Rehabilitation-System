/* 데이터 저장부(150): 브라우저 localStorage 에 수행 이력·경험치·보류 목록 저장 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var KEY = 'seed-garden-v1';

  function blank() {
    return {
      seedName: '',
      exp: 0,
      confusion: {},     // 목표 자소별 혼동 누적 빈도 {ㅏ: 3}
      confusionPairs: {},// 'ㅏ→ㅓ': 2
      hold: [],          // 보류 과제 [{activity, id}]
      history: [],       // 과제 이력 [{activity, id, attempts, reached, held, ms, at}]
      settings: { inputMode: 'auto', seedVoice: true, bigText: false, wideSpacing: false }
    };
  }

  var state;
  function load() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      state = raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
      state.settings = Object.assign(blank().settings, state.settings || {});
    } catch (e) { state = blank(); }
    return state;
  }
  function save() {
    try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function reset() { state = blank(); save(); return state; }

  SG.store = {
    load: load, save: save, reset: reset,
    get: function () { return state || load(); },
    recordConfusion: function (diffs) {
      diffs.forEach(function (d) {
        if (!d.target) return;
        state.confusion[d.target] = (state.confusion[d.target] || 0) + 1;
        var k = d.target + '→' + (d.heard || '∅');
        state.confusionPairs[k] = (state.confusionPairs[k] || 0) + 1;
      });
      save();
    },
    addHold: function (activity, id) {
      if (!state.hold.some(function (h) { return h.activity === activity && h.id === id; })) state.hold.push({ activity: activity, id: id });
      save();
    },
    removeHold: function (activity, id) {
      state.hold = state.hold.filter(function (h) { return !(h.activity === activity && h.id === id); });
      save();
    },
    heldIds: function (activity) {
      return state.hold.filter(function (h) { return h.activity === activity; }).map(function (h) { return h.id; });
    },
    addHistory: function (rec) { state.history.push(rec); if (state.history.length > 500) state.history.shift(); save(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
