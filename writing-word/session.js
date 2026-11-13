/* 이 탭의 진행 위치·선택 복원. 공통 학습 기록과 별도로 보관한다. */
(function (root) {
  'use strict';
  var WW = root.SG.writingWord;
  var KEY = 'malssi.write-word.session.v1';
  function isDate(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
  function unfinished(record) {
    return record && record.activity === 'write-word' && typeof record.runId === 'string' && record.runId.length > 0 && record.runId.length <= 128 &&
      record.reached === false && record.held === true && ['leave', 'interrupted'].indexOf(record.reason) >= 0 &&
      Number.isInteger(record.attempts) && record.attempts >= 0 && record.attempts <= 4 && record.retries === Math.max(0, record.attempts - 1) &&
      Number.isFinite(record.ms) && record.ms >= 0 && isDate(record.at) && Array.isArray(record.events) &&
      record.events.length === record.attempts + (record.reason === 'leave' ? 1 : 0) &&
      record.events.every(function (event, index) {
        return event && Number.isFinite(event.ms) && event.ms >= 0 && event.ms <= record.ms &&
          (index === 0 || event.ms >= record.events[index - 1].ms) &&
          (event.at === undefined || Number.isFinite(event.at) && event.at <= Date.parse(record.at)) &&
          (index < record.attempts
            ? ['B', 'C'].indexOf(event.type) >= 0 && event.reached === false && event.held === false && event.retries === index && typeof event.heard === 'string' && Array.isArray(event.diffs)
            : event.type === 'D' && event.reason === 'leave' && event.held === true && event.exp === 0);
      });
  }
  function validTrace(record, task, selection) {
    // Older checkpoints have no input trace. Their completed/held state is still checked above.
    if (record.inputs === undefined) return true;
    function activeMs(value) { return Number.isFinite(value) && value >= 0 && value <= record.ms; }
    function atTime(value) { return Number.isFinite(value) && value >= Date.parse(record.startedAt) && value <= Date.parse(record.at); }
    if (!isDate(record.startedAt) || Date.parse(record.startedAt) > Date.parse(record.at) ||
      !Number.isInteger(record.inputCount) || record.inputCount < 0 || !Array.isArray(record.inputs) || record.inputs.length !== Math.min(64, record.inputCount) ||
      record.inputHistoryTruncated !== (record.inputCount > 64) || !activeMs(record.noInputMs) ||
      !Array.isArray(record.selection) || record.selection.length !== selection.length || !record.selection.every(function (slot, index) {
        return slot && ['cho', 'jung', 'jong'].every(function (pos) { return slot[pos] === selection[index][pos]; });
      }) || !(record.resumedFrom === null || typeof record.resumedFrom === 'string' && record.resumedFrom.length > 0 && record.resumedFrom.length <= 128)) return false;
    if (record.inputCount === 0) {
      if (record.firstInputAt !== null || record.lastInputAt !== null || record.firstInputMs !== null || record.noInputMs !== record.ms) return false;
    } else if (!isDate(record.firstInputAt) || !isDate(record.lastInputAt) || !atTime(Date.parse(record.firstInputAt)) || !atTime(Date.parse(record.lastInputAt)) ||
      Date.parse(record.lastInputAt) < Date.parse(record.firstInputAt) || !activeMs(record.firstInputMs) || record.noInputMs !== record.firstInputMs) return false;
    if (!record.inputs.every(function (input, index) {
      var slot = input && task.slots[input.index];
      return input && Number.isInteger(input.index) && slot && ['cho', 'jung', 'jong'].indexOf(input.pos) >= 0 &&
        slot[input.pos].length > 1 && slot[input.pos].indexOf(input.value) >= 0 && atTime(input.at) && activeMs(input.ms) &&
        input.ms >= record.firstInputMs && (index === 0 || input.at >= record.inputs[index - 1].at && input.ms >= record.inputs[index - 1].ms);
    })) return false;
    if (record.inputCount > 0 && (record.inputs[record.inputs.length - 1].at !== Date.parse(record.lastInputAt) ||
      record.inputCount <= 64 && (record.inputs[0].at !== Date.parse(record.firstInputAt) || record.inputs[0].ms !== record.firstInputMs))) return false;
    return Number.isInteger(record.listenCount) && record.listenCount >= 0 && Array.isArray(record.listens) && record.listens.length === Math.min(8, record.listenCount) && record.listens.every(function (listen) {
      return listen && typeof listen.word === 'string' && listen.word.length > 0 && listen.word.length <= 32 && atTime(listen.at) && activeMs(listen.ms);
    });
  }
  function create(storage, tasks) {
    var byId = {}, groups = {};
    tasks.forEach(function (task) {
      byId[task.id] = task;
      var level = task.levelId || 'all';
      (groups[level] = groups[level] || []).push(task.id);
    });
    function clear() { try { storage.removeItem(KEY); } catch (error) { /* 메모리 진행은 계속 */ } }
    function load(now) {
      try {
        var value = JSON.parse(storage.getItem(KEY));
        if (!value) return null;
        if (value.version !== 2 || !Number.isFinite(value.at) || now - value.at > 86400000 || value.at > now + 60000) throw new Error('expired');
        var allowed = Object.prototype.hasOwnProperty.call(groups, value.levelId) && groups[value.levelId];
        if (!allowed || !Array.isArray(value.queue) || value.queue.length !== allowed.length || new Set(value.queue).size !== allowed.length || !value.queue.every(function (id) { return allowed.indexOf(id) >= 0; })) throw new Error('queue');
        if (!Number.isInteger(value.cursor) || value.cursor < 0 || value.cursor >= value.queue.length) throw new Error('cursor');
        if (!value.summary || !['attempts', 'retries', 'completed', 'held', 'totalReachMs', 'reachCount', 'bloomed'].every(function (key) { return Number.isFinite(value.summary[key]) && value.summary[key] >= 0; })) throw new Error('summary');
        if (!Array.isArray(value.learned) || !value.learned.every(function (word) { return allowed.some(function (id) { return byId[id].target === word; }); })) throw new Error('words');
        var task = byId[value.queue[value.cursor]];
        if (value.draft) {
          var draft = value.draft;
          if (!Array.isArray(draft.selection) || draft.selection.length !== task.slots.length || !Array.isArray(draft.choices) || draft.choices.length !== task.slots.length) throw new Error('draft');
          task.slots.forEach(function (slot, index) {
            ['cho', 'jung', 'jong'].forEach(function (pos) {
              var selected = draft.selection[index][pos], choices = draft.choices[index][pos];
              if (selected !== null && slot[pos].indexOf(selected) < 0) throw new Error('selection');
              if (slot[pos].length === 1 && selected !== slot[pos][0]) throw new Error('fixed-selection');
              if (!Array.isArray(choices) || choices.length !== slot[pos].length || new Set(choices).size !== choices.length || !choices.every(function (item) { return slot[pos].indexOf(item) >= 0; })) throw new Error('choices');
            });
          });
          var record = draft.record;
          if (!unfinished(record) || record.id !== task.id || record.target !== task.target || !validTrace(record, task, draft.selection)) throw new Error('record');
        }
        return value;
      } catch (error) { clear(); return null; }
    }
    return {
      load: load, clear: clear,
      save: function (value) { try { storage.setItem(KEY, JSON.stringify(value)); return true; } catch (error) { return false; } }
    };
  }
  function recoverRecord(store, saved) {
    if (!saved || !saved.draft) return false;
    var record = saved.draft.record;
    if (!unfinished(record) || !saved.queue || record.id !== saved.queue[saved.cursor]) return false;
    if (store.get().history.some(function (item) { return item.runId === record.runId; })) return false;
    store.addHold('write-word', record.id);
    store.addHistory(Object.assign({}, record, { levelId: saved.levelId }));
    return true;
  }
  WW.session = { create: create, recoverRecord: recoverRecord };
})(typeof window !== 'undefined' ? window : globalThis);
