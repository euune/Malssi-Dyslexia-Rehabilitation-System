/* 쓰기-단어 화면·진행. 공통 SG API와 기존 저장 형식에 연결한다. */
(function () {
  'use strict';
  var WW = SG.writingWord, DATA = WW.data, E = SG.engine, H = SG.hangul;
  var panel = document.getElementById('activity-panel');
  var textButton = document.getElementById('btn-text'), soundButton = document.getElementById('btn-sound');
  var pauseDialog = document.getElementById('pause-dialog');
  var storage;
  try { storage = window.sessionStorage; } catch (error) { storage = null; }
  var checkpoints = WW.session.create(storage, DATA.tasks);
  var run = null, queue = [], cursor = 0, selection = [], phase = 'welcome', lastResult = null;
  var changed = false, summary, learned;
  var selectedLevel = null, selectedStage = null;
  var labels = { cho: '첫소리', jung: '가운뎃소리', jong: '끝소리' };
  function resetSummary() {
    summary = { attempts: 0, retries: 0, completed: 0, held: 0, quitEarly: false, totalReachMs: 0, reachCount: 0, bloomed: 0 };
    learned = [];
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action, primary) {
    var b = el('button', 'btn' + (primary ? ' primary' : ' ghost'), text);
    b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function focusPanel() {
    panel.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  // This activity speaks only after an explicit listen-button click.
  function say(text, intent) {
    SG.speech.stopSpeaking();
    SG.seed.say(E.verifyText(text, intent || 'generic'), { intent: intent || 'generic', voice: false });
  }
  function modelVoice(word) {
    if (run && run.noteListen(word, Date.now())) saveCheckpoint();
    SG.speech.speak(word, 'model');
  }
  function levelInfo() { return DATA.levels.find(function (level) { return level.id === selectedLevel; }); }
  function art(word, small) {
    var entry = DATA.vocab[word], wrap = el('div', 'ww-art' + (small ? ' small' : ''));
    var media = DATA.mediaEnabled && entry && entry.media && entry.media[0];
    function unavailable() {
      var placeholder = el('div', 'ww-image-unavailable', '그림이 잘 보이지 않네요. 소리로 만나 볼까요?');
      wrap.replaceChildren(placeholder);
    }
    if (media) {
      var img = el('img', 'ww-image'); img.src = media.src;
      img.alt = media.alt || entry.meaning; img.width = 176; img.height = 176;
      img.addEventListener('error', unavailable, { once: true }); wrap.appendChild(img);
      if (media.badgeSrc) {
        var badge = el('img', 'ww-image-badge'); badge.src = media.badgeSrc; badge.alt = media.badgeAlt || ''; badge.setAttribute('aria-hidden', 'true');
        badge.addEventListener('error', function () { badge.remove(); }, { once: true }); wrap.appendChild(badge);
      }
    } else unavailable();
    return wrap;
  }
  function responseSounds(target, heard) {
    var groups = WW.logic.responseParts(target, heard), wrap = el('div', 'ww-response-sounds');
    wrap.setAttribute('aria-label', '만든 낱말의 소리');
    groups.forEach(function (parts, index) {
      var group = el('div', 'ww-jamo'); group.setAttribute('aria-label', (index + 1) + '번째 글자의 소리');
      parts.forEach(function (part) {
        var item = el(part.changed ? 'strong' : 'span', part.changed ? 'ww-hit' : '', part.value || '없음');
        item.setAttribute('aria-label', labels[part.pos] + ' ' + (part.value || '없음') + (part.changed ? ' · 그림 속 낱말과 다른 소리' : ''));
        group.appendChild(item);
      });
      wrap.appendChild(group);
    });
    if (groups.some(function (parts) { return parts.some(function (part) { return part.changed; }); })) {
      wrap.appendChild(el('p', 'ww-difference-note', '파란 글자는 그림 속 낱말과 다른 소리예요.'));
    }
    return wrap;
  }
  function comparison(target, heard, response) {
    var wrap = el('div', 'ww-compare'); wrap.setAttribute('aria-label', '비슷한 말 비교');
    [target, heard].forEach(function (word, side) {
      var card = el('div', 'ww-word-card');
      card.appendChild(el('p', 'ww-caption', response ? (side ? '내가 만든 낱말' : '그림 속 낱말') : (side ? '비슷한 낱말' : '완성한 낱말')));
      card.appendChild(art(word, true));
      if (response && side === 0) {
        card.appendChild(button('🔊 소리 듣기', function () { modelVoice(word); }));
        wrap.appendChild(card); return;
      }
      card.appendChild(el('div', 'ww-word', word));
      if (response) card.appendChild(responseSounds(target, word));
      card.appendChild(button('🔊 소리 듣기', function () { modelVoice(word); }));
      wrap.appendChild(card);
    });
    return wrap;
  }
  function applySettings() {
    var settings = SG.store.get().settings;
    document.body.classList.toggle('big-text', !!settings.bigText);
    document.body.classList.toggle('wide-spacing', !!settings.wideSpacing);
    textButton.setAttribute('aria-pressed', String(!!settings.bigText));
    soundButton.removeAttribute('aria-pressed');
    soundButton.setAttribute('aria-label', '소리 듣기');
    soundButton.title = '그림 속 낱말 소리 듣기'; soundButton.textContent = '🔊';
    soundButton.disabled = !run || phase === 'welcome' || phase === 'summary';
  }
  function heading(text, help) {
    panel.replaceChildren(el('h1', 'ww-title', text));
    if (help) panel.appendChild(el('p', 'ww-help', help));
  }
  function saveCheckpoint() {
    if (!run || phase === 'welcome' || phase === 'summary') return;
    var next = run.finished && run.reason !== 'leave' ? cursor + 1 : cursor;
    if (next >= queue.length) { checkpoints.clear(); return; }
    var record = run.finished ? run.record() : run.interruptedRecord(Date.now());
    record.runId = run.runId;
    record.levelId = selectedLevel;
    var saved = checkpoints.save({
      version: 2, levelId: selectedLevel, at: Date.now(), queue: queue.map(function (task) { return task.id; }), cursor: next,
      summary: summary, learned: learned,
      draft: next === cursor ? { selection: selection, choices: run.choices, record: record } : null
    });
    var notice = document.getElementById('resume-storage-note');
    if (!saved) {
      checkpoints.clear();
      if (!notice) {
        notice = el('p', 'ww-choice-guide', '지금은 고른 조각을 저장하기 어려워요. 창을 닫기 전까지는 함께 놀 수 있어요.');
        notice.id = 'resume-storage-note'; notice.setAttribute('role', 'status'); panel.appendChild(notice);
      }
    } else if (notice) notice.remove();
  }
  function welcome() {
    phase = 'welcome'; run = null; applySettings();
    heading('씨앗의 낱말 정원', '만나 보고 싶은 단계와 숫자를 골라 볼까요?');
    var levelCards = el('div', 'ww-level-grid');
    levelCards.setAttribute('role', 'group'); levelCards.setAttribute('aria-label', '놀이 단계');
    DATA.levels.forEach(function (level) {
      var progress = WW.curriculum.progressForLevel(SG.store.get(), level.id);
      var card = button('', function () {
        selectedLevel = level.id; selectedStage = null; welcome(); document.getElementById('choose-' + level.id).focus({ preventScroll: true });
      });
      card.id = 'choose-' + level.id; card.className = 'ww-level-card';
      card.setAttribute('aria-pressed', String(selectedLevel === level.id));
      card.setAttribute('aria-expanded', String(selectedLevel === level.id)); card.setAttribute('aria-controls', 'stage-picker');
      card.appendChild(el('span', 'ww-level-number', level.number + '단계'));
      card.appendChild(el('strong', '', level.title));
      card.appendChild(el('span', 'ww-level-progress', '완료 ' + progress.completed.length + ' / ' + progress.total));
      levelCards.appendChild(card);
    });
    panel.appendChild(levelCards);
    var picker = el('section', 'ww-stage-picker'); picker.id = 'stage-picker'; picker.setAttribute('aria-label', '세부 스테이지');
    if (selectedLevel) {
      var progress = WW.curriculum.progressForLevel(SG.store.get(), selectedLevel);
      picker.appendChild(el('h2', 'ww-stage-title', levelInfo().number + '단계 · 어디서 시작할까요?'));
      var stages = el('div', 'ww-stage-numbers'); stages.setAttribute('role', 'group'); stages.setAttribute('aria-label', '스테이지 번호');
      WW.curriculum.tasksForLevel(selectedLevel).forEach(function (task) {
        var completed = progress.completed.indexOf(task.id) >= 0;
        var stage = button(String(task.stage), function () { selectedStage = task.id; welcome(); document.getElementById('stage-' + task.stage).focus({ preventScroll: true }); });
        stage.id = 'stage-' + task.stage; stage.className = 'ww-stage-button' + (completed ? ' completed' : '');
        stage.setAttribute('aria-pressed', String(selectedStage === task.id));
        stage.setAttribute('aria-label', task.stage + '스테이지' + (completed ? ' · 완료' : ''));
        stage.title = stage.getAttribute('aria-label'); stages.appendChild(stage);
      });
      picker.appendChild(stages);
    }
    panel.appendChild(picker);
    var actions = el('div', 'ww-entry-actions');
    var restart = button('처음부터 시작하기', function () { selectedLevel = DATA.levels[0].id; startSession(0, true); }); restart.classList.add('ww-restart'); actions.appendChild(restart);
    var start = button('여기부터 시작하기', function () {
      var task = DATA.tasks.find(function (item) { return item.id === selectedStage && item.levelId === selectedLevel; });
      if (task) startSession(task.stage - 1);
    }, true);
    start.id = 'btn-start-stage'; start.disabled = !selectedStage; actions.appendChild(start); panel.appendChild(actions);
    say('어디서 함께 시작해 볼까? 마음 가는 단계와 숫자를 골라 줘.');
  }
  function startSession(start, fresh) {
    if (phase !== 'welcome' && phase !== 'summary') return;
    if (!Number.isInteger(start)) start = 0;
    var saved = checkpoints.load(Date.now());
    var list = WW.curriculum.tasksForLevel(selectedLevel), task = list[start];
    if (!task) return;
    var canResume = !fresh && saved && saved.levelId === selectedLevel && saved.queue[saved.cursor] === task.id;
    var recovered = WW.session.recoverRecord(SG.store, saved); resetSummary();
    queue = list; cursor = start;
    if (canResume) {
      // A stage is an absolute curriculum position, even with older hold-first queues.
      Object.keys(summary).forEach(function (key) { if (typeof summary[key] === 'number') summary[key] = saved.summary[key]; });
      if (recovered) summary.held++;
      learned = saved.learned.slice(); beginTask(saved.draft);
    } else { checkpoints.clear(); beginTask(); }
  }
  function shuffledChoices(task) {
    return task.slots.map(function (slot) {
      var choices = {};
      Object.keys(labels).forEach(function (pos) {
        choices[pos] = slot[pos].slice();
        for (var i = choices[pos].length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var old = choices[pos][i]; choices[pos][i] = choices[pos][j]; choices[pos][j] = old;
        }
      });
      return choices;
    });
  }
  function beginTask(draft) {
    if (cursor >= queue.length) {
      var state = SG.store.get();
      state.writingWordVisits = Object.assign({}, state.writingWordVisits || {});
      state.writingWordVisits[selectedLevel] = true; SG.store.save();
      endSession(false); return;
    }
    SG.speech.stopSpeaking();
    WW.curriculum.rememberStage(SG.store.get(), queue[cursor], false); SG.store.save();
    run = new WW.logic.Run(queue[cursor], DATA.vocab, SG.store.get().confusion, Date.now());
    run.runId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    run.choices = draft ? draft.choices : shuffledChoices(run.task);
    lastResult = null; phase = 'editing'; changed = true;
    selection = draft ? draft.selection : WW.curriculum.initialSelection(run.task);
    run.selection = selection;
    if (draft) run.resumedFrom = draft.record.runId;
    if (draft && selection.some(function (slot, index) { return Object.keys(labels).some(function (pos) { return run.task.slots[index][pos].length > 1 && slot[pos] !== null; }); })) run.touch();
    drawTask(); saveCheckpoint(); applySettings();
    say(run.task.prompt);
    focusPanel();
  }
  function word() {
    if (!selection.every(function (slot) { return Object.keys(labels).every(function (pos) { return slot[pos] !== null; }); })) return '';
    return selection.map(function (slot) { return H.compose(slot.cho, slot.jung, slot.jong); }).join('');
  }
  function guide() {
    if (!changed) return '고른 조각은 그대로 있어요. 다른 조각도 골라 볼까요?';
    for (var i = 0; i < selection.length; i++) {
      for (var pos of Object.keys(labels)) {
        if (selection[i][pos] === null) return (selection.length > 1 ? (i + 1) + '번째 글자의 ' : '') + labels[pos] + '를 골라 볼까요?';
      }
    }
    return '조각을 다 골랐어요. 씨앗에게 알려줄까요?';
  }
  function updatePreview() {
    var submit = document.getElementById('btn-submit');
    if (submit) submit.disabled = phase !== 'editing' || !word() || !changed;
    var hint = document.getElementById('choice-guide'); if (hint) hint.textContent = guide();
  }
  function tileGroups() {
    var tiles = el('div', 'ww-tiles'); tiles.id = 'tiles';
    run.choices.forEach(function (options, index) {
      var field = el('fieldset', 'ww-syllable');
      field.appendChild(el('legend', '', run.task.slots.length > 1 ? (index + 1) + '번째 글자' : '글자 조각'));
      if (Object.keys(labels).every(function (pos) { return options[pos].length === 1; })) {
        field.classList.add('ww-fixed-syllable');
        field.appendChild(el('span', 'ww-fixed-word', H.compose(options.cho[0], options.jung[0], options.jong[0])));
        field.appendChild(el('span', 'ww-caption', '놓여 있는 글자'));
        tiles.appendChild(field); return;
      }
      Object.keys(labels).forEach(function (pos) {
        if (pos === 'jong' && options[pos].length === 1 && options[pos][0] === '') return;
        var row = el('div', 'ww-tile-row'); row.setAttribute('role', options[pos].length === 1 ? 'group' : 'radiogroup');
        row.setAttribute('aria-label', (index + 1) + '번째 글자 ' + labels[pos]);
        row.appendChild(el('span', 'tile-label', labels[pos]));
        if (options[pos].length === 1) {
          row.appendChild(el('span', 'ww-fixed-jamo', options[pos][0] || '없음'));
          field.appendChild(row); return;
        }
        options[pos].forEach(function (jamo, optionIndex) {
          var selected = selection[index][pos] === jamo;
          var b = el('button', 'tile' + (!jamo ? ' txt' : '') + (selected ? ' sel' : ''), jamo || '없음');
          b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(selected));
          b.tabIndex = selected || selection[index][pos] === null && optionIndex === 0 ? 0 : -1;
          b.addEventListener('click', function () {
            if (phase !== 'editing' || run.finished || run.pausedAt !== null) return;
            if (selection[index][pos] !== jamo) changed = true;
            if (!run.choose(index, pos, jamo, Date.now())) return;
            Array.prototype.forEach.call(row.querySelectorAll('button'), function (other) {
              other.classList.toggle('sel', other === b); other.setAttribute('aria-checked', String(other === b)); other.tabIndex = other === b ? 0 : -1;
            });
            updatePreview(); saveCheckpoint();
          });
          b.addEventListener('keydown', function (event) {
            var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (keys.indexOf(event.key) < 0) return;
            event.preventDefault();
            var buttons = Array.prototype.slice.call(row.querySelectorAll('button')), at = buttons.indexOf(b);
            var next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
            buttons[next].focus(); buttons[next].click();
          });
          row.appendChild(b);
        });
        field.appendChild(row);
      });
      tiles.appendChild(field);
    });
    return tiles;
  }
  function progressPath() {
    var progress = el('ol', 'ww-path'); progress.setAttribute('aria-label', '스테이지 진행');
    var completed = WW.curriculum.progressForLevel(SG.store.get(), selectedLevel).completed;
    queue.forEach(function (task, index) {
      var done = completed.indexOf(task.id) >= 0;
      var mark = el('li', (index === cursor ? 'current ' : '') + (done ? 'done' : ''), String(task.stage));
      mark.setAttribute('aria-label', task.stage + '스테이지' + (index === cursor ? ' · 현재' : '') + (done ? ' · 완료' : ''));
      if (index === cursor) mark.setAttribute('aria-current', 'step'); progress.appendChild(mark);
    });
    return progress;
  }
  function sessionTools() {
    var tools = el('div', 'ww-session-tools');
    if (run && !run.finished) tools.appendChild(button('잠깐 쉬기', pause));
    tools.appendChild(button('오늘은 여기까지', function () { endSession(true); }));
    tools.appendChild(button('단계 고르기', function () {
      abandon(); saveCheckpoint(); SG.speech.stopSpeaking(); selectedStage = null; welcome(); focusPanel();
    }));
    return tools;
  }
  function drawTask() {
    if (phase === 'feedback') { drawFeedback(); return; }
    heading('그림 속 낱말을 만들어 볼까요?'); panel.appendChild(progressPath());
    panel.appendChild(el('p', 'ww-level-label', levelInfo().number + '단계 · ' + run.task.stage + '스테이지'));
    var goal = el('section', 'ww-goal'); goal.setAttribute('aria-label', '그림 속 낱말');
    var goalText = el('div', 'ww-goal-text');
    goalText.appendChild(el('p', 'ww-caption', '그림 속 낱말'));
    goalText.appendChild(button('🔊 소리 듣기', function () { modelVoice(run.task.target); }));
    goal.appendChild(goalText); goal.appendChild(art(run.task.target)); panel.appendChild(goal);
    var hint = el('p', 'ww-choice-guide'); hint.id = 'choice-guide'; hint.setAttribute('role', 'status'); panel.appendChild(hint);
    var workspace = el('div', 'ww-workspace');
    var input = el('div', 'ww-input'); input.appendChild(tileGroups()); workspace.appendChild(input); panel.appendChild(workspace);
    var actions = el('div', 'ww-actions ww-submit-actions');
    var submit = button('씨앗에게 알려주기', submitWord, true); submit.id = 'btn-submit'; actions.appendChild(submit);
    panel.appendChild(actions); panel.appendChild(sessionTools()); updatePreview();
  }
  function feedbackText(result) {
    return WW.logic.feedbackMessage(result, run.task.target);
  }
  function drawFeedback() {
    heading(lastResult.reached ? '씨앗이 말을 배웠어요' : lastResult.held ? '씨앗이 기억해 둘게요' : '어떤 말이 피어났을까?');
    panel.appendChild(progressPath());
    var card = el('section', 'ww-feedback'); card.setAttribute('aria-label', '만든 낱말 살펴보기');
    if (lastResult.type === E.TYPE.MEANINGFUL) card.appendChild(comparison(run.task.target, lastResult.heard, true));
    else if (lastResult.type === E.TYPE.NONSENSE) {
      card.appendChild(el('p', 'ww-caption', '내가 만든 낱말'));
      card.appendChild(el('div', 'ww-unfamiliar-word', lastResult.heard));
      card.appendChild(responseSounds(run.task.target, lastResult.heard));

    }
    else {
      card.appendChild(art(run.task.target));
      if (lastResult.reached) card.appendChild(el('p', 'ww-word', run.task.target));
    }
    panel.appendChild(card);
    if (lastResult.reached) {
      var examples = el('details', 'ww-examples'); examples.appendChild(el('summary', '', '비슷한 말 살펴보기'));
      examples.appendChild(comparison(run.task.target, run.task.compare, false)); panel.appendChild(examples);
    }
    panel.appendChild(button(run.finished ? cursor === queue.length - 1 ? '씨앗의 정원 보기' : '다른 말 만나기' : '조각 바꿔 보기', function () {
      if (phase !== 'feedback') return;
      if (run.finished) { cursor++; beginTask(); }
      else if (run.retry(Date.now())) {
        phase = 'editing'; changed = false; drawTask(); saveCheckpoint();
        say(WW.logic.encouragement(lastResult.retries)); focusPanel();
      }
    }, true));
    panel.appendChild(sessionTools());
  }
  function saveFinished() {
    if (!run || !run.finished || run.recorded) return;
    run.recorded = true;
    var record = run.record(); record.runId = run.runId; record.levelId = selectedLevel; record.stage = run.task.stage;
    WW.curriculum.rememberStage(SG.store.get(), run.task, record.reached); SG.store.save();
    if (record.reached) {
      SG.store.removeHold('write-word', run.task.id); summary.completed++; summary.reachCount++; summary.totalReachMs += record.ms;
      if (learned.indexOf(run.task.target) < 0) learned.push(run.task.target);
    } else { SG.store.addHold('write-word', run.task.id); summary.held++; }
    SG.store.addHistory(record);
  }
  function applyResult(result, silent) {
    if (!result) return;
    if (result.exp) SG.growth.addExp(result.exp);
    if (typeof result.retries === 'number') { summary.attempts++; if (result.retries > 0) summary.retries++; }
    if (result.diffs.length) SG.store.recordConfusion(result.diffs);
    if (result.type === E.TYPE.MEANINGFUL) summary.bloomed++;
    saveFinished();
    if (silent) { saveCheckpoint(); return; }
    lastResult = result; phase = 'feedback'; drawTask(); saveCheckpoint(); focusPanel();
    var fb = E.buildFeedback({ type: result.type, level: result.level, target: run.task.target, heard: result.heard, attempt: run.attempts });
    SG.seed.react(fb.anim); say(feedbackText(result), fb.intent);
  }
  function submitWord() {
    if (phase !== 'editing' || !word() || !changed) return;
    applyResult(run.submit(word(), Date.now()));
  }
  function pause() {
    if (!run || !run.pause(Date.now())) return;
    SG.speech.stopSpeaking(); saveCheckpoint();
    document.getElementById('pause-picture').replaceChildren(art(run.task.target));
    if (!pauseDialog.open) pauseDialog.showModal();
  }
  function resumePause() {
    if (pauseDialog.open) pauseDialog.close();
    if (run) run.resume(Date.now());
    saveCheckpoint();
  }
  function abandon() {
    if (run && !run.finished) { summary.quitEarly = true; applyResult(run.hold('leave', Date.now()), true); }
  }
  function endSession(early) {
    if (phase === 'summary') return;
    if (pauseDialog.open) pauseDialog.close();
    if (early) abandon();
    phase = 'summary'; checkpoints.clear(); SG.speech.stopSpeaking(); applySettings();
    heading(learned.length ? '함께 피운 낱말을 모아 봤어요' : '함께해 줘서 고마워요');
    var garden = el('div', 'ww-garden');
    learned.forEach(function (value) { var item = el('div', 'ww-word-card'); item.appendChild(art(value, true)); item.appendChild(el('span', '', value)); garden.appendChild(item); });
    if (!learned.length) garden.appendChild(el('span', 'ww-empty-garden', '🌱'));
    panel.appendChild(garden);
    WW.logic.sessionMessages(summary).forEach(function (message) { panel.appendChild(el('p', 'ww-help', message)); });
    var nextLevel = DATA.levels.find(function (level) { return level.number === levelInfo().number + 1; });
    if (!early && nextLevel) panel.appendChild(button('다음 단계 만나기', function () { selectedLevel = nextLevel.id; startSession(0); }, true));
    panel.appendChild(button('이 단계 처음부터 하기', function () { startSession(0, true); }, early || !nextLevel));
    panel.appendChild(button('다른 단계 고르기', function () { selectedStage = null; welcome(); focusPanel(); }));
    var home = el('a', 'btn ghost', '정원으로'); home.href = '../index.html'; panel.appendChild(home);
    say(summary.attempts ? '함께 골라 준 조각은 내가 기억할게. 다음에 또 만나!' : '함께해 줘서 고마워. 편할 때 또 놀러 와!', 'session'); focusPanel();
  }
  SG.store.load(); resetSummary(); SG.growth.update(); applySettings();
  var topbar = document.querySelector('.topbar');
  function updateTopbarOffset() { document.documentElement.style.setProperty('--ww-topbar-height', topbar.getBoundingClientRect().height + 'px'); }
  updateTopbarOffset(); if (window.ResizeObserver) new ResizeObserver(updateTopbarOffset).observe(topbar);
  textButton.addEventListener('click', function () { var state = SG.store.get(); state.settings.bigText = !state.settings.bigText; SG.store.save(); applySettings(); });
  soundButton.addEventListener('click', function () { if (run && !soundButton.disabled) modelVoice(run.task.target); });
  document.getElementById('btn-resume').addEventListener('click', resumePause);
  document.getElementById('btn-finish').addEventListener('click', function () { endSession(true); });
  pauseDialog.addEventListener('cancel', function (event) { event.preventDefault(); resumePause(); });
  var hiddenPausedRun = null;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      SG.speech.stopSpeaking();
      if (run && run.pause(Date.now())) { hiddenPausedRun = run; saveCheckpoint(); }
    } else {
      if (hiddenPausedRun && hiddenPausedRun === run) run.resume(Date.now());
      hiddenPausedRun = null;
    }
  });
  document.getElementById('home-link').addEventListener('click', function () { abandon(); saveCheckpoint(); });
  window.addEventListener('pagehide', function () { abandon(); saveCheckpoint(); SG.speech.stopSpeaking(); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) window.location.reload(); });
  window.addEventListener('storage', function (event) {
    if (event.key === 'seed-garden-v1' || event.key === null) { SG.store.load(); SG.growth.update(); applySettings(); }
  });
  // Add keyboard focus and clock handling to the shared growth overlay on this page.
  var growthOverlay = document.getElementById('overlay'), growthOpen = false, growthPausedRun = null;
  new MutationObserver(function () {
    var open = !growthOverlay.classList.contains('hidden');
    if (open === growthOpen) return;
    growthOpen = open;
    if (open) {
      growthOverlay.setAttribute('role', 'dialog');
      growthOverlay.setAttribute('aria-modal', 'true');
      growthOverlay.setAttribute('aria-label', '씨앗의 성장');
      if (run && run.pause(Date.now())) { growthPausedRun = run; saveCheckpoint(); }
      SG.speech.stopSpeaking();
      var accept = growthOverlay.querySelector('button'); if (accept) accept.focus();
    } else {
      if (growthPausedRun && growthPausedRun === run) run.resume(Date.now());
      growthPausedRun = null; saveCheckpoint(); focusPanel();
    }
  }).observe(growthOverlay, { attributes: true, attributeFilter: ['class'], childList: true });
  growthOverlay.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { event.preventDefault(); growthOverlay.classList.add('hidden'); }
    if (event.key === 'Tab') { event.preventDefault(); var accept = growthOverlay.querySelector('button'); if (accept) accept.focus(); }
  });
  welcome();
})();
