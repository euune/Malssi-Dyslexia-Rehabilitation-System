/*
 * 말씨 – 읽기 · 문장 훈련
 *
 * 흐름
 *   이야기 지도(7장) → 장 선택(앞 장을 완성해야 열림)
 *   → 동화 문장을 한 문장씩 씨앗에게 소리 내어 읽어 주기(음성 인식)
 *   → 세 문장이 모이면 동화 한 장 완성 → 씨앗의 이해 확인 질문
 *   → 기대 응답이면 장 완성(다음 장 열림) / 아니면 관련 문장을 크게 보여 주고 다시 읽기
 *
 * 간접 피드백 (같은 문장에서의 재시도 횟수에 따라 단계적으로 지원)
 *   L1 재요청          : "어? 잘 못 알아들었어. 한 번 더 들려줄래?"
 *   L2 강조 + 자간 확대 : 잘 전달되지 않은 단어를 굵게, 글자 크기·자간 확대
 *   L3 함께 읽기        : 씨앗이 모델 음성을 먼저 들려주며 단어를 하나씩 비춤
 *   L4 잠시 보류        : "씨앗이 꼭 기억해 둘게" → 진행 상황 저장 후 쉬기(다음에 강조된 상태로 이어서)
 *   무응답              : 씨앗이 먼저 시범을 들려준 뒤 참여를 요청
 *   ※ "정답/오답/틀렸어/실패/점수" 같은 평가 표현, 붉은색·경고음은 쓰지 않습니다.
 *
 * 처음 화면과 연결
 *   씨앗 그림·반응은 ../js/seed.js, 경험치·성장 단계는 ../js/growth.js 를 함께 씀.
 *   읽기 시도 +1, 다시 시도 +1, 문장 도달 +2, 질문 응답 +1, 질문 도달 +2 → 같은 씨앗이 자란다.
 */
(function () {
  'use strict';

  // ───────────────────────── 설정 ─────────────────────────
  const CFG = {
    passScore: 0.8, // 문장 전체 자소 유사도가 이 이상이면 "씨앗이 알아들음"
    wordOkScore: 0.75, // 단어 유사도가 이보다 낮으면 L2에서 강조
    silenceEndMs: 1800, // 말이 끊긴 뒤 이 시간이 지나면 듣기 종료
    noInputMs: 8000, // 이 시간 동안 아무 말이 없으면 무응답
    maxRetry: 4, // 같은 문장 재시도가 이 횟수 이상이면 L4(보류)
    sentenceTimeLimitMs: 120000, // 같은 문장에 이 시간 이상 머물면 L4(보류)
    ttsRate: 0.85, // 말하기 속도 (0.5 느림 ~ 1 보통 ~ 2 빠름)
  };
  const STORAGE_KEY = 'malssi.reading.v1';
  const SENTENCES_PER_CHAPTER = 3;

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const params = new URLSearchParams(location.search);
  const DEV = params.has('dev') || !Rec; // 음성 인식 미지원 브라우저·테스트용 텍스트 입력

  const app = document.getElementById('app');

  // ───────────────────────── 대사 ─────────────────────────
  const LINES = {
    firstSentence: ['새로운 이야기야! 첫 문장을 들려줄래?', '어떤 이야기일까? 첫 문장을 읽어 줘!'],
    nextSentence: ['다음 문장도 들려줄래?', '그 다음은 어떻게 돼? 읽어 줘!'],
    listening: '듣고 있어… 🌱',
    acquired: ['이제 알겠어. 고마워!', '와, 이 문장 꼭 기억할게!', '네 목소리 덕분에 또 하나 배웠어!'],
    reacquired: ['아, 이제 기억났어! 고마워.'],
    L1: ['어? 잘 못 알아들었어. 한 번 더 들려줄래?', '음… 처음 듣는 소리야. 한 번 더 들려줄래?'],
    L2: '이 부분이 잘 안 들렸어. 굵게 보이는 곳을 천천히 들려줄래?',
    L2none: '조금 더 천천히 들려줄래? 글자를 크게 해 둘게.',
    L3: '내가 먼저 읽어 볼게. 잘 듣고 같이 읽어 줄래?',
    after3: '이제 너도 들려줄래?',
    L4: '이 문장은 씨앗이 꼭 기억해 둘게. 다음에 또 알려줘!',
    noInput: '내가 먼저 들려줄게. 잘 들어 봐!',
    afterDemo: '이제 너도 들려줄래?',
    resumeHeld: '지난번에 알려준 문장이야. 크게 보여 줄게, 천천히 들려줄래?',
    storyDone: '우리가 만든 이야기야! 이야기에 대해 하나 물어봐도 될까?',
    quizYes: '맞아, 나도 그렇게 기억해! 고마워.',
    quizAgain: '음… 이 부분을 한 번 더 읽어 줄래?',
    reread: '이 부분을 다시 들려주면 기억이 날 것 같아.',
    micDenied: '마이크를 쓸 수 없어요. 브라우저 설정에서 마이크 권한을 허용해 주세요.',
  };
  const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);

  // ───────────────────────── 저장 ─────────────────────────
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (p && typeof p.cleared === 'number') return p;
    } catch (e) { /* 저장소 사용 불가 */ }
    return { cleared: 0, resume: null };
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) { /* 무시 */ }
  }
  let progress = loadProgress();

  const isCleared = (n) => n <= progress.cleared;
  const isUnlocked = (n) => n <= progress.cleared + 1;

  // ───────────────────────── 유틸 ─────────────────────────
  const $ = (sel) => app.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function setWorld(alive) {
    document.body.classList.toggle('alive', !!alive);
  }

  // ───────────────────────── 씨앗 (처음 화면과 같은 씨앗) ─────────────────────────
  const SEED_SVG = '<svg id="seed" viewBox="0 0 200 200" role="img" aria-label="씨앗"></svg>';
  const ANIM = { nod: 'nod', tilt: 'tilt', cheer: 'happy', listen: 'listen' };
  function drawSeed() { SG.growth.update(true); }
  function seedAnim(name) { SG.seed.react(name ? ANIM[name] || name : null); }

  // 처음 화면 설정의 '자간 넓히기'를 동화 읽기에도 적용
  document.body.classList.toggle('wide-spacing', !!SG.store.get().settings.wideSpacing);

  // 경험치 (engine.js CONFIG.exp 정책)
  const EXP = SG.engine.CONFIG.exp;
  const addExp = (n, fx) => SG.growth.addExp(n, fx);
  const short = (t) => (t.length > 16 ? t.slice(0, 15) + '…' : t);

  function say(text) {
    const b = $('#bubble');
    if (!b) return;
    b.classList.remove('show');
    void b.offsetWidth;
    b.textContent = text;
    b.classList.add('show');
  }

  // ───────────────────────── 음성 출력 (모델 음성) ─────────────────────────
  // 기본 한국어 목소리 사용 (브라우저가 기본으로 정한 한국어 목소리 → 없으면 첫 한국어 목소리)
  const PACE_KEY = 'malssi.pace.v1'; // 목소리별 실제 말하기 속도(글자당 ms) 학습값
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const list = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('ko'));
    return list.find((v) => v.default) || list[0] || null;
  }
  let pace = (() => {
    try { return JSON.parse(localStorage.getItem(PACE_KEY)) || {}; } catch (e) { return {}; }
  })();
  function savePace() {
    try { localStorage.setItem(PACE_KEY, JSON.stringify(pace)); } catch (e) { /* 무시 */ }
  }

  function speak(text, { onWord, onEnd } = {}) {
    const words = text.split(/\s+/).filter(Boolean);
    const lens = words.map((w) => Math.max(1, w.replace(/[^가-힣A-Za-z0-9]/g, '').length));
    const total = lens.reduce((a, b) => a + b, 0);
    const units = total + words.length * 0.5; // 띄어쓰기마다 짧은 쉼
    // 각 단어가 원문에서 시작하는 글자 위치(onboundary의 charIndex와 맞추기 위함)
    const starts = [];
    { let from = 0; words.forEach((w) => { const at = text.indexOf(w, from); starts.push(at); from = at + w.length; }); }
    const wordAt = (charIndex) => {
      let i = 0;
      while (i + 1 < starts.length && starts[i + 1] <= charIndex) i++;
      return i;
    };

    const voice = pickVoice();
    const voiceKey = voice ? voice.name : 'none';
    const msPerUnit = pace[voiceKey] || 230 / CFG.ttsRate;
    const estMs = units * msPerUnit;

    let done = false;
    let boundaryWorks = false;
    let startedAt = 0;
    let fallback = [];
    let current = -1;
    const show = (i) => {
      if (done || i === current) return;
      current = i;
      if (onWord) onWord(i);
    };
    const finish = (natural) => {
      if (done) return;
      // 실제로 끝까지 읽은 시간으로 이 목소리의 속도를 학습 → 다음 문장부터 추정이 정확해짐
      if (natural && startedAt && !boundaryWorks) {
        const real = (performance.now() - startedAt) / units;
        if (real > 60 && real < 1200) {
          pace[voiceKey] = pace[voiceKey] ? pace[voiceKey] * 0.5 + real * 0.5 : real;
          savePace();
        }
      }
      done = true;
      fallback.forEach(clearTimeout);
      if (onWord) onWord(-1);
      if (onEnd) onEnd();
    };
    const runFallback = () => {
      // 단어 경계 이벤트(onboundary)가 오지 않는 목소리용: 글자 수 비례 타이머
      let acc = 0;
      words.forEach((_, i) => {
        fallback.push(later(() => { if (!boundaryWorks) show(i); }, (acc / units) * estMs));
        acc += lens[i] + 0.5;
      });
    };

    if (!('speechSynthesis' in window)) {
      runFallback();
      later(() => finish(false), estMs + 300);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = CFG.ttsRate;
    if (voice) u.voice = voice;
    u.onstart = () => {
      startedAt = performance.now();
      show(0);
      runFallback();
    };
    // 브라우저가 "지금 이 단어를 읽는 중"이라고 알려 주면 그 위치를 그대로 비춤 (가장 정확)
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      if (!boundaryWorks) {
        boundaryWorks = true;
        fallback.forEach(clearTimeout);
      }
      show(wordAt(e.charIndex));
    };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    speechSynthesis.speak(u);
    // 한국어 음성이 없거나 onstart가 오지 않는 환경 대비
    later(() => { if (!startedAt && !done) { startedAt = performance.now(); runFallback(); later(() => finish(false), estMs); } }, 900);
    later(() => finish(false), estMs * 2 + 4000);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ───────────────────────── 음성 인식 ─────────────────────────
  let rec = null;
  let recToken = 0;
  let listening = false;

  function candidatesFrom(results) {
    const c = [results.map((r) => r.alts[0] || '').join(' ')];
    // 안드로이드 크롬은 결과가 누적되어 중복되는 경우가 있어 개별 결과도 후보로 둡니다.
    results.forEach((r) => r.alts.forEach((a) => c.push(a)));
    return c.filter((s) => s && s.trim());
  }

  function listen() {
    if (!Rec || listening || !S) return;
    stopSpeaking();
    const token = ++recToken;
    const r = new Rec();
    rec = r;
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;

    let results = [];
    let gotSpeech = false;
    let aborted = false;
    let silenceT = null;
    const stop = () => { try { r.stop(); } catch (e) { /* 이미 종료 */ } };
    let noInputT = setTimeout(stop, CFG.noInputMs);

    r.onresult = (e) => {
      gotSpeech = true;
      clearTimeout(noInputT);
      results = Array.from(e.results).map((res) => ({ alts: Array.from(res).map((a) => a.transcript), final: res.isFinal }));
      const cands = candidatesFrom(results);
      showHeard(cands[0] || '');
      clearTimeout(silenceT);
      const ok = Hangul.compareSentence(currentSentence(), cands).score >= CFG.passScore;
      silenceT = setTimeout(stop, ok ? 500 : CFG.silenceEndMs);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        aborted = true;
        micDenied();
      } else if (e.error === 'aborted') {
        aborted = true;
      }
      // 'no-speech' 등은 onend에서 무응답으로 처리
    };
    r.onend = () => {
      clearTimeout(silenceT);
      clearTimeout(noInputT);
      if (token !== recToken) return; // 화면 전환 등으로 취소된 듣기
      rec = null;
      setListening(false);
      if (aborted) return;
      evaluate(gotSpeech ? candidatesFrom(results) : []);
    };

    try {
      r.start();
      setListening(true);
    } catch (e) {
      setListening(false);
    }
  }

  function cancelListening() {
    recToken++;
    if (rec) { try { rec.abort(); } catch (e) { /* 무시 */ } }
    rec = null;
    setListening(false);
  }

  function setListening(on) {
    listening = on;
    const mic = $('#mic');
    if (mic) {
      mic.classList.toggle('on', on);
      mic.innerHTML = on ? '<span class="dot"></span> 다 읽었어요' : '🎤 읽어 주기';
    }
    if (on) {
      seedAnim('listen');
      say(LINES.listening);
      showHeard('');
    } else {
      const seed = $('#seed');
      if (seed) seed.classList.remove('listen');
    }
  }

  function micDenied() {
    say(LINES.micDenied);
    const dev = $('#dev');
    if (dev) dev.hidden = false;
  }

  function showHeard(text) {
    const el = $('#heard');
    if (el) el.textContent = text ? `씨앗이 들은 말: “${text}”` : '';
  }

  // ───────────────────────── 세션 상태 ─────────────────────────
  /**
   * S = {
   *   ch, data,
   *   phase: 'read' | 'quiz' | 'reread' | 'clear',
   *   idx: 현재 문장 번호,
   *   retries: 현재 문장 재시도 횟수, startedAt,
   *   support: 글자 확대 여부, held: 지난번 보류된 문장인지,
   *   totalRetries: 이 장에서 다시 들려준 횟수(과정 메시지용)
   * }
   */
  let S = null;

  const currentSentence = () => (S ? S.data.sentences[S.idx] : '');

  function stopAll() {
    cancelListening();
    stopSpeaking();
    clearTimers();
  }

  function saveResume() {
    if (!S || S.phase === 'clear') return;
    progress.resume = {
      chapter: S.ch,
      phase: S.phase === 'reread' ? 'quiz' : S.phase,
      idx: S.phase === 'read' ? S.idx : SENTENCES_PER_CHAPTER,
      held: S.phase === 'read' && !!S.held,
    };
    saveProgress();
  }

  // ───────────────────────── 이야기 지도 ─────────────────────────
  function renderMap() {
    stopAll();
    S = null;
    setWorld(progress.cleared >= 7);
    const nextCh = Math.min(progress.cleared + 1, 7);
    app.innerHTML = `
      <section class="screen map">
        <div class="act-head">
          <h2>동화 읽기</h2>
          <a class="btn ghost small" href="../index.html">정원으로 🏡</a>
        </div>
        <div class="seed-strip stage">
          <div class="seed-wrap">${SEED_SVG}</div>
          <div class="bubble" id="bubble" aria-live="polite"></div>
        </div>
        <div class="map-body">
        <header class="map-head">
          <h1>${progress.cleared >= 7 ? '다시 살아난 세상' : '말을 잃은 세상'}</h1>
        </header>
        <ol class="chapters">
          ${STORY.map((c) => {
            const n = c.id;
            const cleared = isCleared(n);
            const unlocked = isUnlocked(n);
            const resuming = progress.resume && progress.resume.chapter === n;
            const state = cleared ? 'cleared' : unlocked ? 'open' : 'locked';
            const action = cleared ? '다시 읽기' : unlocked ? (resuming ? '이어 읽기' : '읽으러 가기') : '앞 장을 먼저 완성해요';
            return `<li>
              <button class="chapter ${state} ${n === nextCh && !cleared ? 'next' : ''}" data-ch="${n}" ${unlocked ? '' : 'disabled aria-disabled="true"'}>
                <span class="num">${cleared ? '🌸' : unlocked ? n : '🔒'}</span>
                <span class="meta"><span class="t">${n}장 · ${esc(c.title)}</span><span class="a">${action}</span></span>
              </button></li>`;
          }).join('')}
        </ol>
        <button class="link" id="reset">처음부터 다시 시작하기</button>
        </div>
      </section>`;

    app.querySelectorAll('.chapter:not([disabled])').forEach((b) =>
      b.addEventListener('click', () => openChapter(Number(b.dataset.ch))),
    );
    $('#reset').addEventListener('click', () => {
      if (confirm('저장된 진행 상황을 지우고 1장부터 다시 시작할까요?')) {
        progress = { cleared: 0, resume: null };
        saveProgress();
        renderMap();
      }
    });
    drawSeed();
    seedAnim('nod');
    say(progress.cleared >= 7
      ? '네 목소리 덕분에 세상이 다시 살아났어! 좋아하는 장을 또 읽어 줄래?'
      : progress.resume
        ? '지난번 이야기가 궁금해! 이어서 읽어 줄래?'
        : '나에게 동화를 한 문장씩 소리 내어 읽어 줘! 한 장을 완성하면 다음 장이 열려.');
  }

  // ───────────────────────── 장 화면 ─────────────────────────
  function openChapter(n) {
    if (!isUnlocked(n)) return;
    stopAll();
    const r = progress.resume && progress.resume.chapter === n ? progress.resume : null;
    S = {
      ch: n,
      data: STORY[n - 1],
      phase: r ? r.phase : 'read',
      idx: r ? Math.min(r.idx, SENTENCES_PER_CHAPTER) : 0,
      held: r ? !!r.held : false,
      retries: 0,
      startedAt: Date.now(),
      support: false,
      totalRetries: 0,
    };
    if (S.phase === 'read' && S.idx >= SENTENCES_PER_CHAPTER) S.phase = 'quiz';
    setWorld(false);
    renderChapterShell();
    if (S.phase === 'quiz') storyComplete(true);
    else startSentence();
  }

  function renderChapterShell() {
    const d = S.data;
    app.innerHTML = `
      <section class="screen chapter-screen">
        <header class="ch-head">
          <button class="back" id="back" aria-label="이야기 지도로" title="이야기 지도">←</button>
          <div class="ch-title"><p class="eyebrow">${S.ch}장</p><h2>${esc(d.title)}</h2></div>
          <div class="dots" id="dots" aria-label="모은 문장"></div>
        </header>
        <div class="seed-strip stage">
          <div class="seed-wrap">${SEED_SVG}</div>
          <div class="bubble" id="bubble" aria-live="polite"></div>
        </div>
        <div class="book" id="book" aria-label="함께 만든 동화"></div>
        <div id="panel"></div>
      </section>`;
    $('#back').addEventListener('click', () => {
      saveResume();
      renderMap();
    });
    drawSeed();
  }

  function renderDots() {
    const got = S.phase === 'read' ? S.idx : SENTENCES_PER_CHAPTER;
    $('#dots').innerHTML = S.data.sentences.map((_, i) => `<span class="${i < got ? 'on' : ''}"></span>`).join('');
  }

  function renderBook(newIdx = -1, focusIdx = -1) {
    const got = S.phase === 'read' ? S.idx : SENTENCES_PER_CHAPTER;
    const lines = S.data.sentences.slice(0, got);
    const book = $('#book');
    book.innerHTML = lines.length
      ? lines.map((s, i) => `<p class="${i === newIdx ? 'new' : ''} ${i === focusIdx ? 'focus' : ''}">${esc(s)}</p>`).join('')
      : '<p class="empty">씨앗에게 읽어 준 문장이 여기에 모여 동화가 돼요.</p>';
    renderDots();
  }

  // ───────────────────────── 문장 읽기 ─────────────────────────
  function startSentence() {
    stopAll();
    S.retries = 0;
    S.attempts = 0;
    S.startedAt = Date.now();
    S.support = S.held || S.phase === 'reread'; // 보류했던 문장·다시 읽기는 크게 보여 주며 시작
    const wasHeld = S.held;
    S.held = false;

    renderBook(-1, S.phase === 'reread' ? S.idx : -1);
    const words = currentSentence().split(/\s+/).filter(Boolean);
    $('#panel').innerHTML = `
      <div class="card ${S.phase === 'reread' ? 'reread' : ''}">
        <p class="label">${S.phase === 'reread' ? '이 부분을 다시 읽어 주세요' : `씨앗에게 읽어 주세요 · ${S.idx + 1} / ${SENTENCES_PER_CHAPTER}`}</p>
        <p class="sentence ${S.support ? 'support' : ''}" id="sentence">${words.map((w, i) => `<span class="w" data-i="${i}">${esc(w)}</span>`).join(' ')}</p>
        <p class="heard" id="heard" aria-live="polite"></p>
        <div class="controls" id="controls">
          <button class="hint" id="hint">🔈 들어 보기</button>
          ${Rec ? '<button class="mic" id="mic">🎤 읽어 주기</button>' : ''}
        </div>
        ${!Rec ? '<p class="note">이 브라우저는 음성 인식을 지원하지 않아요. 휴대폰의 Chrome·Safari에서 열어 주세요. (아래 입력창으로 흐름을 확인할 수 있어요)</p>' : ''}
        <form class="dev" id="dev" ${DEV ? '' : 'hidden'}>
          <input id="devText" autocomplete="off" placeholder="(테스트) 읽은 문장을 입력" aria-label="테스트 입력">
          <button type="submit">들려주기</button>
          <button type="button" id="devSilent">무응답</button>
        </form>
      </div>`;
    bindReadControls();

    seedAnim('nod');
    if (S.phase === 'reread') say(LINES.reread);
    else if (wasHeld) say(LINES.resumeHeld);
    else say(pick(S.idx === 0 ? LINES.firstSentence : LINES.nextSentence));
  }

  function bindReadControls() {
    const mic = $('#mic');
    if (mic) mic.addEventListener('click', () => (listening ? rec && rec.stop() : listen()));
    $('#hint').addEventListener('click', () => {
      if (listening) cancelListening();
      modelRead();
    });
    $('#dev').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#devText').value;
      $('#devText').value = '';
      showHeard(v);
      evaluate(v.trim() ? [v] : []);
    });
    $('#devSilent').addEventListener('click', () => evaluate([]));
  }

  function setControlsEnabled(on) {
    app.querySelectorAll('#controls button, #dev button, #dev input').forEach((b) => (b.disabled = !on));
  }

  function highlightWord(i) {
    app.querySelectorAll('#sentence .w').forEach((el) => el.classList.toggle('reading', Number(el.dataset.i) === i));
  }

  /** 씨앗이 문장을 먼저 읽어 줌(모델 음성 + 단어 비추기) */
  function modelRead(onEnd) {
    setControlsEnabled(false);
    speak(currentSentence(), {
      onWord: highlightWord,
      onEnd: () => {
        setControlsEnabled(true);
        if (onEnd) onEnd();
      },
    });
  }

  /** 응답 판정 → 응답 유형(A: 도달, C: 잘 전달되지 않음, D: 무응답)에 따라 피드백 */
  function evaluate(candidates) {
    if (!S || (S.phase !== 'read' && S.phase !== 'reread')) return;
    const result = Hangul.compareSentence(currentSentence(), candidates);
    if (!result.empty) { S.attempts = (S.attempts || 0) + 1; addExp(S.attempts === 1 ? EXP.firstTry : EXP.retry, { text: '✨', from: $('#sentence') }); }
    if (!result.empty && result.score >= CFG.passScore) onReached();
    else onNotYet(result.empty ? 'D' : 'C', result);
  }

  function onReached() {
    setControlsEnabled(false);
    // 읽어 준 문장이 씨앗에게 쏙 들어감
    addExp(EXP.complete, { text: short(currentSentence()), from: $('#sentence'), big: true });
    seedAnim('cheer');
    highlightWord(-1);
    if (S.phase === 'reread') {
      say(pick(LINES.reacquired));
      later(() => {
        S.phase = 'quiz';
        showQuiz();
      }, 1600);
      return;
    }
    say(pick(LINES.acquired));
    const got = S.idx;
    S.idx++;
    saveResume();
    renderBook(got);
    later(() => (S.idx < SENTENCES_PER_CHAPTER ? startSentence() : storyComplete(false)), 1700);
  }

  function onNotYet(type, result) {
    S.retries++;
    S.totalRetries++;
    const elapsed = Date.now() - S.startedAt;
    let level = Math.min(S.retries, 3);
    if (S.retries >= CFG.maxRetry || elapsed > CFG.sentenceTimeLimitMs) level = 4;

    if (level === 4) return holdSentence();

    if (type === 'D') {
      // 무응답: 씨앗이 먼저 시범을 보이고 참여를 요청
      seedAnim('nod');
      say(LINES.noInput);
      later(() => modelRead(() => say(LINES.afterDemo)), 1200);
      return;
    }

    if (level === 1) {
      seedAnim('tilt');
      say(pick(LINES.L1));
      return;
    }

    // L2 이상: 잘 전달되지 않은 단어 강조 + 글자 크기·자간 확대
    S.support = true;
    const sentence = $('#sentence');
    sentence.classList.add('support');
    let marked = 0;
    sentence.querySelectorAll('.w').forEach((el) => {
      const weak = (result.words[Number(el.dataset.i)] ?? 0) < CFG.wordOkScore;
      el.classList.toggle('weak', weak);
      if (weak) marked++;
    });
    seedAnim('tilt');

    if (level === 2) {
      say(marked ? LINES.L2 : LINES.L2none);
      return;
    }
    // L3: 함께 읽기
    say(LINES.L3);
    later(() => modelRead(() => say(LINES.after3)), 1400);
  }

  /** L4: 보류. 실패로 끝내지 않고 진행 상황을 저장한 뒤 쉬거나 이어 갈 수 있게 함 */
  function holdSentence() {
    seedAnim('nod');
    say(LINES.L4);
    if (S.phase === 'read') S.held = true;
    saveResume();
    $('#controls').innerHTML = `
      <button class="ghost" id="rest">쉬었다 다음에 하기</button>
      <button class="mic" id="more">조금 더 읽어 줄래요</button>`;
    const dev = $('#dev');
    if (dev) dev.hidden = true;
    $('#rest').addEventListener('click', renderMap);
    $('#more').addEventListener('click', () => {
      // 이어 가기: 강조·확대된 상태에서 함께 읽기 단계부터 다시 시작
      S.held = false;
      saveResume();
      S.retries = 2;
      S.startedAt = Date.now();
      $('#controls').innerHTML = `
        <button class="hint" id="hint">🔈 들어 보기</button>
        ${Rec ? '<button class="mic" id="mic">🎤 읽어 주기</button>' : ''}`;
      if (dev) dev.hidden = !DEV;
      const mic = $('#mic');
      if (mic) mic.addEventListener('click', () => (listening ? rec && rec.stop() : listen()));
      $('#hint').addEventListener('click', () => {
        if (listening) cancelListening();
        modelRead();
      });
      say(LINES.L3);
      later(() => modelRead(() => say(LINES.after3)), 1200);
    });
  }

  // ───────────────────────── 동화 완성 · 이해 확인 ─────────────────────────
  function storyComplete(resumed) {
    stopAll();
    S.phase = 'quiz';
    saveResume();
    renderBook(resumed ? -1 : SENTENCES_PER_CHAPTER - 1);
    seedAnim('cheer');
    say(LINES.storyDone);
    $('#panel').innerHTML = `
      <div class="card done">
        <p class="label">동화 ${S.ch}장의 문장을 모두 모았어요</p>
        <button class="mic wide" id="toQuiz">좋아, 물어봐!</button>
      </div>`;
    $('#toQuiz').addEventListener('click', showQuiz);
  }

  function showQuiz() {
    stopAll();
    S.phase = 'quiz';
    renderBook();
    const q = S.data.quiz;
    const opts = q.options.map((text, i) => ({ text, expected: i === 0 }));
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    S.quizTries = S.quizTries || 0;
    seedAnim('nod');
    say(q.question);
    $('#panel').innerHTML = `
      <div class="card quiz">
        <p class="label">씨앗의 질문</p>
        <p class="question">${esc(q.question)}</p>
        <div class="options">
          ${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o.text)}</button>`).join('')}
        </div>
      </div>`;
    app.querySelectorAll('.opt').forEach((b) =>
      b.addEventListener('click', () => {
        const o = opts[Number(b.dataset.i)];
        app.querySelectorAll('.opt').forEach((x) => (x.disabled = true));
        b.classList.add('chosen');
        S.quizTries++;
        addExp(S.quizTries === 1 ? EXP.firstTry : EXP.retry, { text: '✨', from: b });
        if (o.expected) {
          addExp(EXP.complete, { text: short(o.text), from: b, big: true });
          seedAnim('cheer');
          say(LINES.quizYes);
          later(chapterClear, 1600);
        } else {
          // 오답 표시 없이, 관련 문장을 다시 읽어 달라고 요청
          seedAnim('tilt');
          say(LINES.quizAgain);
          later(() => {
            S.phase = 'reread';
            S.idx = q.related;
            startSentence();
          }, 1600);
        }
      }),
    );
  }

  function processMessage() {
    if (S.totalRetries >= 4) return '어려운 문장도 끝까지 여러 번 들려주었어요.';
    if (S.totalRetries >= 1) return '천천히 끝까지 알려 줬어요. 씨앗도 한 걸음씩 배우고 있어요!';
    return '또박또박 들려준 덕분에 씨앗이 이야기를 잘 기억했어요.';
  }

  function chapterClear() {
    stopAll();
    const firstTime = !isCleared(S.ch);
    progress.cleared = Math.max(progress.cleared, S.ch);
    progress.resume = null;
    saveProgress();
    S.phase = 'clear';

    const last = S.ch === 7;
    if (last) setWorld(true);
    seedAnim('cheer');
    say(last ? '고마워. 네 목소리 덕분에 세상이 다시 살아났어!' : `${S.ch}장 이야기를 함께 완성했어!`);
    renderBook();

    $('#panel').innerHTML = `
      <div class="card done">
        <p class="label">${last ? '🌳 모든 이야기를 완성했어요' : `🌱 ${S.ch}장 완성`}</p>
        <p class="process">${processMessage()}</p>
        ${!last && firstTime ? `<p class="unlock">${S.ch + 1}장 「${esc(STORY[S.ch].title)}」 이야기가 열렸어요!</p>` : ''}
        <div class="controls">
          <button class="ghost" id="toMap">이야기 지도</button>
          ${last ? '' : `<button class="mic" id="next">다음 장 읽기 →</button>`}
        </div>
      </div>`;
    $('#toMap').addEventListener('click', renderMap);
    const next = $('#next');
    if (next) next.addEventListener('click', () => openChapter(S.ch + 1));
  }

  // 음성 목록은 비동기로 로드되는 브라우저가 있어 미리 요청
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  renderMap();
})();
