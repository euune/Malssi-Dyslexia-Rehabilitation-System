/*
 * 공통 코어 — 처리 제어부(190)
 * 화면 도구, 성장, 과제 진행기(TaskRun: 응답 → 분류 → 지원 수준 → 피드백), 홈, 세션 종료, 설정.
 * 각 활동은 js/activities/ 의 파일에서 SG.core 도구를 써서 만들고 SG.registerActivity()로 홈에 등록한다.
 */
(function () {
  'use strict';
  var H = SG.hangul, D = SG.data, E = SG.engine, S = SG.speech, ST = SG.store, SEED = SG.seed;
  var T = E.TYPE;

  /* ---------------- 작은 도구들 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else if (k === 'html') n.innerHTML = props[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function img(word) { return D.VOCAB[word] || '🌱'; }
  var panel = $('#panel');

  function inputMode() {
    var m = ST.get().settings.inputMode;
    if (m === 'auto') return S.recognitionSupported() ? 'voice' : 'tap';
    return m;
  }

  /* ---------------- 세션 기록 (과정 메시지용) ---------------- */
  var session;
  function newSession() {
    session = { attempts: 0, retries: 0, completed: 0, held: 0, quitEarly: false, totalReachMs: 0, reachCount: 0, bloomed: 0 };
  }
  newSession();

  /* ---------------- 성장 시각화부 ---------------- */
  /* 성장: js/growth.js (동화 읽기 페이지와 함께 씀) */
  function updateGrowth(force) { return SG.growth.update(force); }
  function addExp(n, fx) { return SG.growth.addExp(n, fx); }

  /* 유의미 대체 응답의 의미 이미지가 씨앗 주변에 '피어나는' 연출 */
  function bloomAt(emoji) {
    var layer = $('#bloom-layer');
    var b = el('span', { class: 'bloom', text: emoji });
    layer.appendChild(b);
    setTimeout(function () { b.remove(); }, 2600);
  }

  /* ---------------- 목표 표현 표시 (적응형 지원부 160) ---------------- */
  function TargetDisplay(text, opt) {
    opt = opt || {};
    var wrap = el('div', { class: 'target' + (opt.sentence ? ' sentence' : '') });
    var line = el('div', { class: 'target-line' });
    var spans = text.split('').map(function (ch) {
      var s = el('span', { class: ch === ' ' ? 'sp' : 'syl', text: ch === ' ' ? ' ' : ch });
      line.appendChild(s);
      return s;
    });
    var jamoRow = el('div', { class: 'jamo-row' });
    wrap.appendChild(line); wrap.appendChild(jamoRow);
    return {
      el: wrap, text: text,
      emphasize: function (info, pointing) {
        wrap.classList.add('assist');
        spans.forEach(function (s) { s.classList.remove('emph', 'pointed'); });
        jamoRow.innerHTML = '';
        var idx = info.indexes && info.indexes.length ? info.indexes : spans.map(function (_, i) { return i; }).filter(function (i) { return H.isSyllable(text[i]); });
        idx.forEach(function (i) { if (spans[i]) spans[i].classList.add('emph'); });
        if (pointing && spans[idx[0]]) spans[idx[0]].classList.add('pointed');
        // 강조된 음절을 자소로 풀어서 다른 자소 하이라이트
        var uniq = idx.filter(function (v, k) { return idx.indexOf(v) === k; }).slice(0, 3);
        uniq.forEach(function (i) {
          var d = H.decompose(text[i]); if (!d) return;
          var box = el('span', { class: 'jamo-box' });
          ['cho', 'jung', 'jong'].forEach(function (pos) {
            if (!d[pos]) return;
            var hit = (info.jamo || []).some(function (j) { return j.index === i && j.pos === pos; });
            box.appendChild(el('span', { class: 'jamo' + (hit ? ' hit' : ''), text: d[pos] }));
          });
          jamoRow.appendChild(box);
        });
      },
      clear: function () {
        wrap.classList.remove('assist'); jamoRow.innerHTML = '';
        spans.forEach(function (s) { s.classList.remove('emph', 'pointed', 'karaoke'); });
      },
      karaoke: function (msPer) {
        var i = 0, syl = spans.filter(function (s) { return s.className.indexOf('syl') >= 0; });
        return new Promise(function (resolve) {
          (function step() {
            syl.forEach(function (s) { s.classList.remove('karaoke'); });
            if (i >= syl.length) { resolve(); return; }
            syl[i].classList.add('karaoke'); i++;
            setTimeout(step, msPer || 420);
          })();
        });
      }
    };
  }

  /** 모델 음성 + 글자 하이라이트 */
  function modelVoice(text, display) {
    var p1 = S.speak(text, 'model');
    var p2 = display ? display.karaoke(Math.max(300, 2600 / Math.max(1, H.normalize(text).length))) : Promise.resolve();
    return Promise.all([p1, p2]);
  }

  /* ---------------- 비교 카드 (유의미 대체 응답) ---------------- */
  function compareCard(targetWord, heardWord, heardImg, diffs) {
    function side(word, emoji, which) {
      var w = el('div', { class: 'cmp-word' });
      word.split('').forEach(function (ch, i) {
        var d = H.decompose(ch);
        var hit = diffs.some(function (x) { return x.index === i; });
        var syl = el('span', { class: 'cmp-syl' + (hit ? ' hit' : '') }, [el('b', { text: ch })]);
        if (d && hit) {
          var jr = el('small', { class: 'cmp-jamo' });
          ['cho', 'jung', 'jong'].forEach(function (pos) {
            if (!d[pos]) return;
            var jh = diffs.some(function (x) { return x.index === i && x.pos === pos; });
            jr.appendChild(el('span', { class: jh ? 'hit' : '', text: d[pos] }));
          });
          syl.appendChild(jr);
        }
        w.appendChild(syl);
      });
      return el('div', { class: 'cmp-side ' + which }, [
        el('div', { class: 'cmp-img', text: emoji }), w,
        el('button', { class: 'mini', text: '🔊', 'aria-label': word + ' 듣기', onclick: function () { S.speak(word, 'model'); } })
      ]);
    }
    return el('div', { class: 'compare' }, [
      side(heardWord, heardImg, 'heard'),
      el('div', { class: 'cmp-vs', text: '↔' }),
      side(targetWord, '❔', 'goal')
    ]);
  }

  /* ================= 과제 진행기 (S500~S560) ================= */
  /**
   * o: {activity, id, target, sentence:bool, display:TargetDisplay|null, fbSlot:Element,
   *     view:{emphasize(info,pointing), onReached(res), revealTarget()}, noRespMs, word(낱말 과제의 목표 낱말), onDone(outcome)}
   */
  function TaskRun(o) {
    this.o = o;
    this.attempts = 0; this.retries = 0;
    this.start = Date.now();
    this.finished = false; this.busy = false;
    this.noRespMs = o.noRespMs || (o.sentence ? E.CONFIG.noResponseSentenceMs : E.CONFIG.noResponseMs);
    this.confused = E.confusedJamoIn(o.target, ST.get().confusion);
    current = this;
    if (this.confused.length && o.view && o.view.emphasize) {
      // 혼동 음소 이력 → 처음부터 제2수준 강조 (도 6, [0047])
      o.view.emphasize({ indexes: this.confused.map(function (c) { return c.index; }), jamo: this.confused }, false);
    }
    this.arm();
  }
  var current = null;

  TaskRun.prototype.arm = function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.finished) return;
    this.timer = setTimeout(function () {
      if (!self.busy && !self.finished && current === self) self.respond({ type: T.NO_RESPONSE });
    }, this.noRespMs);
  };
  TaskRun.prototype.poke = function () { this.arm(); };
  TaskRun.prototype.stop = function () { this.finished = true; clearTimeout(this.timer); if (current === this) current = null; };

  /** 사용자 이탈: 과제를 보류 목록에 저장 */
  TaskRun.prototype.abandon = function () {
    if (this.finished) return;
    ST.addHold(this.o.activity, this.o.id);
    session.quitEarly = true;
    this.record(false, true);
    this.stop();
  };

  TaskRun.prototype.record = function (reached, held) {
    ST.addHistory({ activity: this.o.activity, id: this.o.id, attempts: this.attempts, retries: this.retries,
      reached: reached, held: held, ms: Date.now() - this.start, at: new Date().toISOString() });
  };

  TaskRun.prototype.respond = function (res) {
    if (this.finished || this.busy) return Promise.resolve();
    clearTimeout(this.timer);
    var self = this, o = this.o;
    var isD = res.type === T.NO_RESPONSE;
    if (!isD) {
      this.attempts++; session.attempts++;
      var spark = { text: '✨', from: fromEl(o) };
      if (this.attempts === 1) addExp(E.CONFIG.exp.firstTry, spark);
      else { addExp(E.CONFIG.exp.retry, spark); session.retries++; }
    }
    if (res.type !== T.REACHED && res.diffs && res.diffs.length) ST.recordConfusion(res.diffs);
    if (o.fbSlot) o.fbSlot.innerHTML = '';

    /* ----- 목표 도달 (A) ----- */
    if (res.type === T.REACHED) {
      this.busy = true;
      var ms = Date.now() - this.start;
      session.completed++; session.reachCount++; session.totalReachMs += ms;
      // 배운 말이 씨앗에게 쏙 들어감
      addExp(E.CONFIG.exp.complete, { text: learnedText(o), from: fromEl(o), big: true });
      ST.removeHold(o.activity, o.id);
      this.record(true, false);
      var fb = E.buildFeedback({ type: T.REACHED, target: o.word || o.target, attempt: o.sentence ? 0 : this.attempts });
      SEED.react(fb.anim);
      if (o.view && o.view.onReached) o.view.onReached(res);
      if (o.display) o.display.clear();
      return SEED.say(fb.text, { intent: fb.intent }).then(function () { return wait(500); }).then(function () {
        self.stop(); o.onDone('reached');
      });
    }

    /* ----- 목표 미도달 (B/C/D): 지원 수준 결정 후 간접 피드백 ----- */
    this.retries++;
    var level = E.decideLevel({ type: res.type, retries: this.retries, elapsedMs: Date.now() - this.start, confusedHit: this.confused.length > 0 });
    var fb2 = E.buildFeedback({ type: res.type, level: level, target: o.sayTarget || o.target, heard: res.heard, word: res.word,
      targetWord: res.targetWord, attempt: this.retries });
    this.busy = true;
    var acts = fb2.actions;
    var chain = Promise.resolve();

    if (acts.indexOf('hold') >= 0) {
      ST.addHold(o.activity, o.id); session.held++;
      this.record(false, true);
      SEED.react('hug');
      return SEED.say(fb2.text, { intent: 'hold' }).then(function () { return wait(400); }).then(function () {
        self.stop(); o.onDone('held');
      });
    }

    SEED.react(fb2.anim);
    if (acts.indexOf('bloom') >= 0 && res.image) {
      bloomAt(res.image);
      session.bloomed++;
    }
    if (acts.indexOf('compare') >= 0 && o.fbSlot) {
      var tw = res.targetWord || (o.sentence ? null : o.target);
      var hw = res.word || res.heard;
      if (tw && H.normalize(hw).length === H.normalize(tw).length) {
        o.fbSlot.appendChild(compareCard(tw, H.normalize(hw), res.image || img(hw), res.diffs || []));
      } else if (res.image) {
        o.fbSlot.appendChild(el('div', { class: 'scene-card' }, [el('div', { class: 'cmp-img', text: res.image }), el('p', { text: res.heard })]));
      }
    }
    if (acts.indexOf('emphasize') >= 0 && o.view && o.view.emphasize) {
      var info = emphasisInfo(o, res, this.confused);
      o.view.emphasize(info, acts.indexOf('point') >= 0);
      if (acts.indexOf('point') >= 0) SEED.react('point');
    }
    if (acts.indexOf('modelVoice') >= 0) {
      chain = chain.then(function () { return SEED.say('내가 먼저 들려줄게.', { intent: 'model' }); })
        .then(function () { if (o.view && o.view.revealTarget) o.view.revealTarget(); return modelVoice(o.target, o.display); })
        .then(function () { return SEED.say(fb2.text, { intent: fb2.intent }); });
    } else {
      chain = chain.then(function () { return SEED.say(fb2.text, { intent: fb2.intent }); });
    }
    return chain.then(function () {
      self.busy = false;
      if (isD) self.noRespMs = Math.min(self.noRespMs * 2, 30000); // 생각할 시간을 넉넉히
      self.arm();
    });
  };

  /** 날아갈 말이 출발할 위치: 목표 표현 → 피드백 칸이 들어 있는 카드 */
  function fromEl(o) {
    if (o.display && o.display.el && o.display.el.isConnected) return o.display.el;
    if (o.fbSlot && o.fbSlot.parentNode) return o.fbSlot.parentNode;
    return null;
  }
  /** 씨앗에게 들어갈 '배운 말' */
  function learnedText(o) {
    var t = o.word || o.target || '';
    return t.length > 16 ? t.slice(0, 15) + '…' : t;
  }

  function emphasisInfo(o, res, confused) {
    var diffs = res.diffs || [];
    if (diffs.length) {
      var off = 0;
      if (o.sentence && res.targetWord) off = Math.max(0, o.target.indexOf(res.targetWord));
      else if (o.sentence) off = -1;
      if (off >= 0) return { indexes: diffs.map(function (d) { return d.index + off; }), jamo: diffs.map(function (d) { return { index: d.index + off, pos: d.pos }; }), word: res.targetWord };
    }
    if (confused.length) return { indexes: confused.map(function (c) { return c.index; }), jamo: confused };
    return { indexes: [], jamo: [] };
  }

  /* ---------------- 공통 화면 조각 ---------------- */
  function activityHeader(title, onExit) {
    return el('div', { class: 'act-head' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn ghost small', text: '정원으로 🏡', onclick: function () { if (onExit) onExit(); goHome(); } })
    ]);
  }
  function exitCurrent() { if (current) current.abandon(); S.stopSpeaking(); S.stopListening(); }

  /** 음성 입력 버튼. onHeard(alternatives, error) */
  function micButton(label, onHeard, run) {
    var b = el('button', { class: 'btn mic', 'aria-label': label }, [el('span', { class: 'mic-ic', text: '🎤' }), el('span', { text: label })]);
    b.addEventListener('click', function () {
      if (b.disabled || (run && run.busy)) return;
      if (run) run.poke();
      b.disabled = true; b.classList.add('listening');
      SEED.react('listen');
      S.listen({ maxMs: 7000 }).then(function (r) {
        b.disabled = false; b.classList.remove('listening');
        SEED.react(null);
        if (r.error === 'not-allowed' || r.error === 'service-not-allowed' || r.error === 'network' || r.error === 'unsupported' || r.error === 'start-failed') {
          SEED.say('마이크 소리가 들리지 않아. 누르기 방법으로 알려줄래?', { intent: 'generic' });
          ST.get().settings.inputMode = 'tap'; ST.save();
          if (onHeard.fallback) onHeard.fallback();
          return;
        }
        onHeard(r.alternatives || [], r.error);
      });
    });
    return b;
  }

  function runQueue(list, runOne, onFinish) {
    var i = 0;
    (function next() {
      if (i >= list.length) { onFinish(); return; }
      var item = list[i++];
      runOne(item, next);
    })();
  }

  function heldFirst(activity, all, n) {
    var held = ST.heldIds(activity);
    var heldTasks = all.filter(function (t) { return held.indexOf(t.id) >= 0; });
    var rest = shuffle(all.filter(function (t) { return held.indexOf(t.id) < 0; }));
    return heldTasks.concat(rest).slice(0, Math.max(n, heldTasks.length));
  }
  function isHeld(activity, id) { return ST.heldIds(activity).indexOf(id) >= 0; }

  function roundDone(title, again) {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'card center' }, [
      el('div', { class: 'big-emoji', text: '🌼' }),
      el('h2', { text: title }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn primary', text: '한 번 더 할래요', onclick: again }),
        el('button', { class: 'btn', text: '정원으로 🏡', onclick: goHome })
      ])
    ]));
    SEED.react('happy');
    SEED.say('오늘 알려준 말, 잘 기억해 둘게!', { intent: 'generic' });
  }

  /* ================= 정원 (홈) ================= */
  function goHome() {
    exitCurrent();
    panel.innerHTML = '';
    var st = ST.get();
    var grid = el('div', { class: 'act-grid' }, activities.map(function (a) {
      return el('button', { class: 'act-tile', onclick: function () { exitCurrent(); a.start(); } },
        [el('span', { class: 'act-ic', text: a.icon }), el('b', { text: a.title }), el('small', { text: a.desc })]);
    }));
    panel.appendChild(el('div', { class: 'home' }, [
      grid,
      st.hold.length ? el('p', { class: 'muted center', text: '씨앗이 기억해 둔 말이 있어요. 다음에 먼저 다시 만나요.' }) : null,
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', text: '오늘은 여기까지 🌙', onclick: endSession }),
        el('button', { class: 'btn ghost small', text: '설정 ⚙️', onclick: showSettings })
      ])
    ]));
    SEED.react(null);
    SEED.say(pickHello(), { intent: 'generic', voice: false });
  }
  function pickHello() {
    var n = ST.get().seedName || '씨앗';
    return ['오늘은 어떤 말을 알려줄래?', '나 ' + n + '! 새로운 소리가 궁금해.', '같이 놀자! 무엇부터 할까?'][Math.floor(Math.random() * 3)];
  }

  /* ================= 세션 종료: 과정 메시지 ================= */
  function endSession() {
    exitCurrent();
    var msgs = E.processMessages(session);
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'card center' }, [
      el('div', { class: 'big-emoji', text: '🌙' }),
      el('h2', { text: '오늘의 정원 이야기' }),
      el('ul', { class: 'process' }, msgs.map(function (m) { return el('li', { text: m }); })),
      el('button', { class: 'btn primary', text: '정원으로 🏡', onclick: function () { newSession(); goHome(); } })
    ]));
    SEED.react('sing');
    SEED.say(msgs[0], { intent: 'session' });
  }

  function showSettings() {
    var st = ST.get();
    panel.innerHTML = '';
    function toggle(label, key, help) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = !!st.settings[key];
      cb.addEventListener('change', function () { st.settings[key] = cb.checked; ST.save(); applyText(); });
      return el('label', { class: 'toggle' }, [cb, el('span', {}, [el('b', { text: label }), help ? el('small', { class: 'muted', text: help }) : null])]);
    }
    // 답하는 방법: 말하기 / 누르기 (단어 읽기에 적용)
    var canVoice = S.recognitionSupported();
    var seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': '답하는 방법' });
    function drawSeg() {
      seg.innerHTML = '';
      [['voice', '🎤 말하기'], ['tap', '👆 누르기']].forEach(function (o) {
        var on = inputMode() === o[0];
        var b = el('button', { class: on ? 'on' : '', role: 'radio', 'aria-checked': on ? 'true' : 'false', text: o[1] });
        if (o[0] === 'voice' && !canVoice) b.disabled = true;
        b.addEventListener('click', function () { st.settings.inputMode = o[0]; ST.save(); drawSeg(); });
        seg.appendChild(b);
      });
    }
    drawSeg();
    panel.appendChild(el('div', { class: 'card settings' }, [
      el('h2', { text: '설정' }),
      el('div', { class: 'set-group' }, [
        el('b', { text: '답하는 방법' }),
        el('small', { class: 'muted', text: canVoice
          ? '말하기: 낱말을 소리 내어 읽어 씨앗에게 들려줘요. 누르기: 소리를 들어 보고 글자와 같은 소리를 골라요.'
          : '이 브라우저에서는 음성 인식을 쓸 수 없어 누르기로 진행해요 (크롬·엣지에서는 말하기를 쓸 수 있어요).' }),
        seg
      ]),
      toggle('씨앗 목소리로 말하기', 'seedVoice', '씨앗의 말풍선 대사를 소리로도 들려줘요.'),
      toggle('글자 크게 보기', 'bigText', '읽을 낱말과 글자를 더 크게 보여줘요.'),
      toggle('자간 넓히기', 'wideSpacing', '글자와 글자, 낱말과 낱말 사이를 넓혀 읽기 편하게 해요. 동화 읽기에도 적용돼요.'),
      SG.db ? SG.db.settingsBlock(el) : null, // 학습 기록 저장(서버) – js/db.js
      el('div', { class: 'row' }, [
        el('button', { class: 'btn primary', text: '돌아가기', onclick: goHome }),
        el('button', { class: 'btn ghost small', text: '처음부터 새로 시작', onclick: function () {
          if (confirm('씨앗과 정원을 모두 새로 시작할까요?')) { ST.reset(); newSession(); updateGrowth(true); applyText(); goHome(); }
        } })
      ])
    ]));
    SEED.say('나를 어떻게 도와줄지 골라 줘!', { intent: 'generic', voice: false });
  }

  /* ================= 준비 중인 활동 ================= */
  /** 아직 게임이 연결되지 않은 타일을 눌렀을 때 (js/activities/ 의 자리 파일에서 사용) */
  function comingSoon(title) {
    exitCurrent();
    panel.innerHTML = '';
    panel.appendChild(activityHeader(title));
    panel.appendChild(el('div', { class: 'card center' }, [
      el('div', { class: 'big-emoji', text: '🌱' }),
      el('h2', { text: '곧 열릴 놀이예요' }),
      el('p', { class: 'muted', text: '‘' + title + '’ 놀이는 지금 준비하고 있어요.' }),
      el('div', { class: 'row' }, [el('button', { class: 'btn primary', text: '정원으로 🏡', onclick: goHome })])
    ]));
    SEED.react('sing');
    SEED.say('이 놀이는 아직 준비 중이야. 조금만 기다려 줘!', { intent: 'generic' });
  }

  /* ================= 활동 등록 ================= */
  var activities = [];
  /** a: {key, order, icon, title, desc, start()} */
  SG.registerActivity = function (a) {
    activities.push(a);
    activities.sort(function (x, y) { return x.order - y.order; });
  };

  /* ================= 상단 버튼 · 화면 설정 ================= */
  /** 글자 크게 · 자간 넓히기를 화면에 반영 */
  function applyText() {
    var st = ST.get().settings;
    document.body.classList.toggle('big-text', !!st.bigText);
    document.body.classList.toggle('wide-spacing', !!st.wideSpacing);
  }
  if ($('#btn-text')) $('#btn-text').addEventListener('click', function () { var st = ST.get(); st.settings.bigText = !st.settings.bigText; ST.save(); applyText(); });
  if ($('#btn-home')) $('#btn-home').addEventListener('click', function () { goHome(); });
  if ($('#seed')) $('#seed').addEventListener('click', function () { SEED.react('happy'); });

  /* 활동 이탈(탭 닫기)도 보류로 기록 */
  window.addEventListener('pagehide', function () { if (current) current.abandon(); });

  /* 활동 파일에서 쓰는 공통 도구 */
  SG.core = {
    el: el, shuffle: shuffle, wait: wait, img: img, panel: panel, inputMode: inputMode,
    session: function () { return session; }, addExp: addExp,
    TargetDisplay: TargetDisplay, modelVoice: modelVoice, TaskRun: TaskRun,
    isCurrent: function (run) { return current === run; },
    activityHeader: activityHeader, exitCurrent: exitCurrent, micButton: micButton,
    runQueue: runQueue, heldFirst: heldFirst, isHeld: isHeld, roundDone: roundDone,
    goHome: goHome, endSession: endSession, comingSoon: comingSoon,
    start: function () {
      ST.load();
      updateGrowth(); applyText();
      goHome();
    }
  };
})();
