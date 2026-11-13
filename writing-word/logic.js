/* 쓰기 전용 정책. 공통 엔진의 읽기 허용·전역 설정을 변경하지 않는다. */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var WW = SG.writingWord = SG.writingWord || {};
  var T = SG.engine.TYPE;
  var POLICY = { maxRetries: 4 };

  function classify(word, target, vocab) {
    word = String(word || '').normalize('NFC');
    if (word === target) return { type: T.REACHED, heard: word, diffs: [] };
    return {
      type: Object.prototype.hasOwnProperty.call(vocab, word) ? T.MEANINGFUL : T.NONSENSE,
      heard: word, diffs: SG.hangul.diffJamo(target, word)
    };
  }
  // Only the submitted jamo that differ from the target are marked, never a whole row.
  function responseParts(target, heard) {
    var diffs = SG.hangul.diffJamo(target, heard);
    return String(heard).split('').map(function (ch, index) {
      var actual = SG.hangul.decompose(ch) || {}, expected = SG.hangul.decompose(target[index] || '') || {};
      return ['cho', 'jung', 'jong'].filter(function (pos) {
        return pos !== 'jong' || actual.jong || expected.jong;
      }).map(function (pos) {
        return { pos: pos, value: actual[pos] || '', changed: diffs.some(function (d) { return d.index === index && d.pos === pos; }) };
      });
    });
  }
  function encouragement(retries) {
    var messages = [
      '그림을 찬찬히 보고, 다른 조각도 골라 볼까?',
      '서두르지 않아도 괜찮아. 함께 살펴보자.',
      '여러 조각을 만나 보고 있구나. 천천히 골라도 좋아.',
      '함께 생각해 줘서 고마워. 마음 가는 조각을 골라 볼까?'
    ];
    return messages[Math.max(0, Math.min(messages.length - 1, Number(retries) || 0))];
  }
  function feedbackMessage(result, target) {
    if (result.reached) return '‘' + target + '’! 이제 알겠어. 알려줘서 고마워!';
    var message = result.type === T.MEANINGFUL
      ? '‘' + result.heard + '’' + (SG.hangul.hasJong(result.heard) ? '이' : '가') + ' 피어났네! '
      : '내가 아직 잘 모르는 말이네. ';
    return message + (result.held ? '함께 골라 준 조각은 내가 기억할게. 다른 그림도 만나 볼까?' : encouragement(result.retries));
  }
  // Writing-specific, short closing messages; no claim of learned words before a submission.
  function sessionMessages(summary) {
    if (!summary.attempts) return [SG.engine.verifyText('그림은 언제든 다시 만날 수 있어요. 편할 때 또 놀러 와요.', 'session')];
    var message = summary.quitEarly ? '오늘은 여기서 쉬어 가요. 함께해 줘서 고마워요.'
      : summary.retries >= 3 ? '여러 조각을 차근차근 살펴봤네요. 함께 생각해 줘서 고마워요.'
      : summary.reachCount && summary.totalReachMs / summary.reachCount > 20000 ? '천천히 골라도 괜찮아요. 씨앗과 함께 낱말을 만나 봤네요.'
      : '함께 고른 조각을 씨앗이 기억하고 있어요.';
    var messages = [message];
    if (summary.held > 0) messages.push('아직 살펴보는 낱말은 나중에 편할 때 또 만나 봐요.');
    else if (summary.bloomed > 0) messages.push('다른 낱말도 만나서 반가웠어요.');
    return messages.map(function (text) { return SG.engine.verifyText(text, 'session'); });
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function Run(task, vocab, confusion, now) {
    this.task = task;
    this.vocab = vocab;
    this.startedAt = now;
    this.presentedAt = now;
    this.selection = (task.slots || []).map(function (slot) {
      var selected = {};
      ['cho', 'jung', 'jong'].forEach(function (pos) { selected[pos] = slot[pos].length === 1 ? slot[pos][0] : null; });
      return selected;
    });
    this.inputs = [];
    this.inputCount = 0;
    this.firstInputAt = null;
    this.lastInputAt = null;
    this.firstInputMs = null;
    this.listens = [];
    this.listenCount = 0;
    this.attempts = 0;
    this.events = [];
    this.touched = false;
    this.finished = false;
    this.waiting = false;
    this.pausedAt = null;
    this.assist = SG.engine.confusedJamoIn(task.target, confusion || {});
  }
  Run.prototype.touch = function () { this.touched = true; };
  Run.prototype.choose = function (index, pos, value, now) {
    var slot = this.task.slots && this.task.slots[index];
    if (this.finished || this.waiting || this.pausedAt !== null || !Number.isInteger(index) || !slot || ['cho', 'jung', 'jong'].indexOf(pos) < 0 || slot[pos].length < 2 || slot[pos].indexOf(value) < 0) return false;
    this.selection[index][pos] = value;
    this.touched = true;
    this.inputCount++;
    var ms = this.elapsed(now);
    if (this.firstInputAt === null) { this.firstInputAt = now; this.firstInputMs = ms; }
    this.lastInputAt = now;
    this.inputs.push({ index: index, pos: pos, value: value, at: now, ms: ms });
    if (this.inputs.length > 64) this.inputs.shift();
    return true;
  };
  Run.prototype.noteListen = function (word, now) {
    if (this.finished || this.pausedAt !== null) return false;
    this.listenCount++;
    this.listens.push({ word: word, at: now, ms: this.elapsed(now) });
    if (this.listens.length > 8) this.listens.shift();
    return true;
  };
  Run.prototype.elapsed = function (now) {
    return Math.max(0, (this.pausedAt === null ? now : this.pausedAt) - this.startedAt);
  };
  Run.prototype.pause = function (now) {
    if (this.finished || this.pausedAt !== null) return false;
    this.pausedAt = now;
    return true;
  };
  Run.prototype.resume = function (now) {
    if (this.finished || this.pausedAt === null) return false;
    var duration = Math.max(0, now - this.pausedAt);
    this.startedAt += duration;
    this.pausedAt = null;
    return true;
  };
  Run.prototype.retry = function (now) {
    if (this.finished || this.pausedAt !== null || !this.waiting) return false;
    this.waiting = false;
    this.touched = false;
    return true;
  };
  Run.prototype.hold = function (reason, now) {
    if (this.finished) return null;
    this.finished = true;
    this.waiting = false;
    this.reason = reason;
    this.endedAt = now;
    this.durationMs = this.elapsed(now);
    var event = { type: T.NO_RESPONSE, heard: '', diffs: [], level: 4, exp: 0, held: true, reason: reason, ms: this.durationMs, at: now };
    this.events.push(event);
    return event;
  };
  Run.prototype.submit = function (word, now) {
    if (this.finished || this.pausedAt !== null || this.waiting) return null;
    this.attempts++;
    var event = classify(word, this.task.target, this.vocab);
    var retries = this.attempts - 1;
    event.retries = retries;
    event.ms = now - this.startedAt;
    event.at = now;
    event.exp = this.attempts === 1 ? SG.engine.CONFIG.exp.firstTry : SG.engine.CONFIG.exp.retry;
    event.level = event.type === T.REACHED ? 0 : Math.max(Math.min(retries + 1, 3), this.assist.length ? 2 : 1);
    event.reached = event.type === T.REACHED;
    event.held = !event.reached && retries >= POLICY.maxRetries;
    if (event.held) event.level = 4;
    if (event.reached) event.exp += SG.engine.CONFIG.exp.complete;
    this.finished = event.reached || event.held;
    this.waiting = !this.finished;
    if (this.finished) {
      this.reason = event.reached ? 'reached' : 'retry-limit';
      this.endedAt = now;
      this.durationMs = this.elapsed(now);
      event.reason = this.reason;
    }
    this.events.push(event);
    return event;
  };
  Run.prototype.record = function () {
    if (!this.finished) return null;
    return Object.assign({
      activity: 'write-word', id: this.task.id, target: this.task.target,
      attempts: this.attempts, retries: Math.max(0, this.attempts - 1),
      reached: this.reason === 'reached', held: this.finished && this.reason !== 'reached',
      ms: this.durationMs, at: new Date(this.endedAt).toISOString(),
      reason: this.reason, events: copy(this.events)
    }, this.inputRecord(this.endedAt));
  };
  Run.prototype.inputRecord = function (now) {
    return {
      startedAt: new Date(this.presentedAt).toISOString(),
      firstInputAt: this.firstInputAt === null ? null : new Date(this.firstInputAt).toISOString(),
      lastInputAt: this.lastInputAt === null ? null : new Date(this.lastInputAt).toISOString(),
      firstInputMs: this.firstInputMs, noInputMs: this.firstInputMs === null ? this.elapsed(now) : this.firstInputMs,
      inputCount: this.inputCount, inputs: copy(this.inputs), inputHistoryTruncated: this.inputCount > this.inputs.length,
      selection: copy(this.selection), listenCount: this.listenCount, listens: copy(this.listens),
      resumedFrom: this.resumedFrom || null
    };
  };
  Run.prototype.interruptedRecord = function (now) {
    return Object.assign({
      activity: 'write-word', id: this.task.id, target: this.task.target,
      attempts: this.attempts, retries: Math.max(0, this.attempts - 1), reached: false, held: true,
      ms: this.elapsed(now), at: new Date(now).toISOString(), reason: 'interrupted',
      events: copy(this.events), runId: this.runId
    }, this.inputRecord(now));
  };
  WW.logic = { POLICY: POLICY, classify: classify, Run: Run, responseParts: responseParts, encouragement: encouragement, feedbackMessage: feedbackMessage, sessionMessages: sessionMessages };
})(typeof window !== 'undefined' ? window : globalThis);
