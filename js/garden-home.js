/*
 * 말씨 정원 홈 — 처음 화면(index.html) 전용 (스타일: css/garden-home.css)
 *  1) 정원 꾸미기: 나무 · 흘러가는 구름 · 덤불 · 꽃무리
 *  2) 상단 구름의 단계 배지에 씨앗 캐릭터 그림 (images/seeds/)
 *  3) 배운 낱말이 새싹 이름표를 달고 풀밭을 걸어 다님
 *     - 낱말 출처: SG.store 의 learned (growth.js 가 목표 도달 낱말을 기억) + 단어 쓰기 과제 기록(target)
 *     - 누르면 깡충 뛰고 씨앗이 그 낱말을 읽어 줌
 *     - 지난번에 본 뒤 새로 배운 낱말은 씨앗에게서 톡 튀어나와 걸어감
 *  기기의 '동작 줄이기' 설정이면 움직이지 않고 제자리에 서 있음
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var garden = document.getElementById('garden');
  if (!garden) return;

  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SEEN_KEY = 'malssi.garden-seen';
  var LINES = ['‘{w}’! 기억나. 같이 읽어 볼까?', '‘{w}’는 네가 알려 준 말이야.', '‘{w}’, 이 말 정말 좋아!', '‘{w}’라고 들려줘서 고마워.'];

  function $(id) { return document.getElementById(id); }

  /* ---------------- 1) 정원 꾸미기 ---------------- */
  function treeSvg(kind) {
    var c1 = kind === 'b' ? '#6cbf5c' : '#5aaf4e';
    var dots = kind === 'c' ? '' : '<circle cx="34" cy="26" r="4" fill="#fff"/><circle cx="62" cy="34" r="4" fill="#f4a3be"/><circle cx="44" cy="50" r="4" fill="#f4a3be"/>';
    return '<svg viewBox="0 0 100 130" aria-hidden="true"><rect x="46" y="70" width="8" height="58" rx="4" fill="#7a4e2e"/>' +
      '<circle cx="50" cy="42" r="34" fill="' + c1 + '"/><circle cx="30" cy="56" r="22" fill="#7cc86a"/><circle cx="70" cy="56" r="22" fill="#57a84b"/>' + dots + '</svg>';
  }
  function bush(x, yb, w, c) {
    return '<svg class="gh-bush" style="left:' + x + '%;bottom:' + yb + '%;width:' + w + 'px" viewBox="0 0 80 40" aria-hidden="true">' +
      '<circle cx="20" cy="28" r="16" fill="' + c + '"/><circle cx="40" cy="20" r="20" fill="' + c + '"/><circle cx="60" cy="28" r="16" fill="' + c + '"/><rect x="4" y="28" width="72" height="12" fill="' + c + '"/></svg>';
  }
  function flowers(x, y, c) {
    var h = '<svg class="gh-fl" style="left:' + x + '%;top:' + y + '%" viewBox="0 0 30 20" aria-hidden="true">';
    [[6, 12], [15, 7], [24, 13]].forEach(function (p) {
      h += '<path d="M' + p[0] + ' 20 V' + (p[1] + 3) + '" stroke="#4f9a54" stroke-width="1.5"/>' +
        [0, 72, 144, 216, 288].map(function (a) { return '<ellipse cx="' + p[0] + '" cy="' + (p[1] - 3) + '" rx="2" ry="3" fill="' + c + '" transform="rotate(' + a + ' ' + p[0] + ' ' + p[1] + ')"/>'; }).join('') +
        '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="#f5c64b"/>';
    });
    return h + '</svg>';
  }
  var CLOUD = '<svg viewBox="0 0 120 50" aria-hidden="true"><path d="M20 44 Q4 44 6 32 Q8 22 22 24 Q24 8 42 10 Q54 0 70 8 Q86 4 92 18 Q112 16 114 32 Q116 44 100 44 Z" fill="#fff"/></svg>';

  function decorate() {
    var trees = $('gh-trees'), deco = $('gh-deco'), clouds = $('gh-cloudlets');
    [[6, 96, 'a'], [19, 80, 'b'], [31, 62, 'c'], [69, 70, 'b'], [82, 92, 'a'], [95, 78, 'c']].forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'gh-tree'; d.style.left = t[0] + '%';
      d.style.setProperty('--s', 'clamp(' + Math.round(t[1] * 0.62) + 'px, ' + (t[1] / 8) + 'vw, ' + t[1] + 'px)');
      d.innerHTML = treeSvg(t[2]);
      trees.appendChild(d);
    });
    [[62, 13, 95, -10], [44, 23, 120, -60], [80, 16, 140, -100]].forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'gh-cloudlet'; d.style.top = c[1] + '%';
      d.style.setProperty('--w', c[0] + 'px'); d.style.setProperty('--t', c[2] + 's'); d.style.setProperty('--d', c[3] + 's');
      d.innerHTML = CLOUD;
      clouds.appendChild(d);
    });
    var h = bush(12, 45, 74, '#6cb85d') + bush(27, 46, 52, '#79c169') + bush(74, 46, 60, '#6cb85d') + bush(90, 45, 70, '#79c169');
    [[8, 62, '#f7a8c8'], [30, 59, '#fff2a8'], [62, 60, '#cfe3ff'], [86, 62, '#f7a8c8'], [18, 91, '#fff2a8'], [40, 97, '#f7a8c8'], [78, 93, '#cfe3ff'], [95, 85, '#fff2a8']]
      .forEach(function (f) { h += flowers(f[0], f[1], f[2]); });
    deco.innerHTML = h;
    var setGW = function () { garden.style.setProperty('--gw', garden.clientWidth + 'px'); };
    setGW();
    root.addEventListener('resize', setGW);
  }

  /* ---------------- 2) 단계 배지의 씨앗 그림은 js/growth.js 가 모든 화면에 똑같이 넣음 ---------------- */

  /* ---------------- 3) 걸어 다니는 낱말 ---------------- */
  function learnedWords() {
    var st = SG.store ? SG.store.get() : {};
    var list = [];
    (Array.isArray(st.learned) ? st.learned : []).forEach(function (x) { if (x && x.w) list.push({ w: x.w, k: x.k === 'write' ? 'write' : 'read', at: x.at || 0 }); });
    (Array.isArray(st.history) ? st.history : []).forEach(function (h) {
      if (h && h.reached && h.activity === 'write-word' && typeof h.target === 'string' && /^[가-힣]{1,8}$/.test(h.target)) {
        list.push({ w: h.target, k: 'write', at: Date.parse(h.at) || 0 });
      }
    });
    var seen = {}, out = [];
    list.sort(function (a, b) { return b.at - a.at; }).forEach(function (x) { if (!seen[x.w]) { seen[x.w] = true; out.push(x); } });
    return out; // 최근에 배운 순서
  }
  function readSeen() { try { return JSON.parse(root.localStorage.getItem(SEEN_KEY)); } catch (e) { return null; } }
  function writeSeen(words) { try { root.localStorage.setItem(SEEN_KEY, JSON.stringify(words)); } catch (e) { /* 무시 */ } }

  var WALK = { y0: 70, y1: 95 };
  var words = [];
  var seedEl = null, bubbleEl = null;
  var paused = reduce;

  function maxWords() { return Math.max(4, Math.min(10, Math.floor(garden.clientWidth / 75))); }
  function rects() { return { g: garden.getBoundingClientRect(), s: seedEl.getBoundingClientRect() }; }
  function blocked(x, y, R) {
    var px = R.g.left + x / 100 * R.g.width, py = R.g.top + y / 100 * R.g.height, s = R.s, pad = 34;
    return px > s.left - pad && px < s.right + pad && py > s.top + s.height * 0.3;
  }
  function randomSpot(skip) {
    var R = rects(), best = null;
    for (var i = 0; i < 40; i++) {
      var x = 6 + Math.random() * 88, y = WALK.y0 + Math.random() * (WALK.y1 - WALK.y0);
      if (blocked(x, y, R)) continue;
      best = { x: x, y: y };
      if (!words.some(function (o) { return o !== skip && Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 10; })) return best;
    }
    return best || { x: 10, y: 90 };
  }
  var SPROUT = '<svg class="gh-sprout" viewBox="0 0 22 14" aria-hidden="true"><path d="M11 14 V6" stroke="#4f9a54" stroke-width="2" stroke-linecap="round"/><ellipse cx="6.5" cy="5" rx="5" ry="3" transform="rotate(-20 6.5 5)" fill="#7cc36d"/><ellipse cx="15.5" cy="5" rx="5" ry="3" transform="rotate(20 15.5 5)" fill="#7cc36d"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function makeWord(item, at, isNew) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'gh-word ' + item.k + (isNew ? ' new' : '');
    el.setAttribute('aria-label', item.w + ' 듣기');
    el.innerHTML = SPROUT + '<span class="gh-tag">' + esc(item.w) + '</span><span class="gh-feet" aria-hidden="true"><i></i><i></i></span>';
    $('gh-words').appendChild(el);
    var w = { el: el, text: item.w, x: at.x, y: at.y, target: null, speed: 2 + Math.random() * 1.6, wait: Math.random() * 2, bob: Math.random() * 6 };
    el.addEventListener('click', function () { tap(w); });
    words.push(w);
    w.target = randomSpot(w);
    if (isNew) setTimeout(function () { el.classList.remove('new'); }, 4000);
    return w;
  }
  function place(w, t) {
    var depth = 0.86 + (w.y - WALK.y0) / (WALK.y1 - WALK.y0) * 0.22;
    var moving = !paused && w.wait <= 0;
    var bob = moving ? Math.sin(t / 160 + w.bob) * 1.4 : 0;
    var px = w.x / 100 * garden.clientWidth, py = w.y / 100 * garden.clientHeight;
    w.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%,-100%) translateY(' + bob.toFixed(1) + 'px) scale(' + depth.toFixed(3) + ')';
    w.el.style.zIndex = String(20 + Math.round(w.y / 10));
    w.el.classList.toggle('walking', moving);
  }
  function separate() {
    var W = garden.clientWidth, H = garden.clientHeight, R = rects();
    for (var i = 0; i < words.length; i++) for (var j = i + 1; j < words.length; j++) {
      var a = words[i], b = words[j], needX = (a.el.offsetWidth + b.el.offsetWidth) / 2 + 8;
      var dxp = (a.x - b.x) / 100 * W, dyp = (a.y - b.y) / 100 * H;
      if (Math.abs(dxp) < needX && Math.abs(dyp) < 40) {
        var dir = dxp === 0 ? (Math.random() < 0.5 ? -1 : 1) : (dxp > 0 ? 1 : -1);
        var push = Math.min(5, (needX - Math.abs(dxp)) * 0.15) / W * 100;
        a.x += dir * push; b.x -= dir * push;
      }
    }
    words.forEach(function (w) {
      if (blocked(w.x, w.y, R)) w.x += (w.x < 50 ? -1 : 1) * 0.6;
      var half = (w.el.offsetWidth / 2 + 6) / W * 100; // 이름표가 정원 밖으로 잘리지 않게
      w.x = Math.max(half, Math.min(100 - half, w.x));
    });
  }
  var last = 0;
  function tick(t) {
    var dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    if (!paused && !document.hidden) {
      var R = rects();
      words.forEach(function (w) {
        if (w.wait > 0) { w.wait -= dt; return; }
        var dx = w.target.x - w.x, dy = w.target.y - w.y, d = Math.hypot(dx, dy * 2);
        if (d < 0.5) { w.target = randomSpot(w); w.wait = 1.5 + Math.random() * 3; return; }
        var step = Math.min(d, w.speed * dt), nx = w.x + dx / d * step, ny = w.y + dy * 2 / d * step / 2;
        if (blocked(nx, ny, R)) { w.target = randomSpot(w); return; }
        w.x = nx; w.y = ny;
      });
      separate();
    }
    words.forEach(function (w) { place(w, t); });
    root.requestAnimationFrame(tick);
  }

  function tap(w) {
    w.el.classList.remove('hop'); void w.el.offsetWidth; w.el.classList.add('hop');
    w.wait = Math.max(w.wait, 1.2);
    if (SG.seed) {
      SG.seed.react('happy');
      SG.seed.say(LINES[Math.floor(Math.random() * LINES.length)].replace('{w}', w.text), { intent: 'generic', voice: false });
    }
    if (SG.speech) SG.speech.speak(w.text, 'model');
  }
  function sparkleAtSeed() {
    if (reduce) return;
    var g = garden.getBoundingClientRect(), r = seedEl.getBoundingClientRect();
    var cx = r.left + r.width / 2 - g.left, cy = r.top + r.height * 0.45 - g.top;
    for (var i = 0; i < 6; i++) {
      var s = document.createElement('span');
      s.className = 'gh-spark'; s.textContent = i % 2 ? '✨' : '🌟';
      var a = i / 6 * Math.PI * 2;
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(a) * 60 + 'px'); s.style.setProperty('--dy', Math.sin(a) * 40 + 'px');
      garden.appendChild(s);
      setTimeout(function (el) { el.remove(); }.bind(null, s), 950);
    }
  }

  function startWords() {
    seedEl = document.querySelector('.gh-seed');
    bubbleEl = $('bubble');
    var all = learnedWords();
    var seen = readSeen();
    var fresh = Array.isArray(seen) ? all.filter(function (x) { return seen.indexOf(x.w) < 0; }) : [];
    var shown = all.slice(0, maxWords());
    // 새로 배운 낱말 중 최근 3개만 씨앗에게서 튀어나오고, 나머지는 바로 정원에 둠
    var newOnes = shown.filter(function (item) { return fresh.indexOf(item) >= 0; }).slice(0, 3);
    shown.forEach(function (item) { if (newOnes.indexOf(item) < 0) makeWord(item, randomSpot(), false); });
    for (var k = 0; k < 60; k++) separate();
    words.forEach(function (w) { place(w, 0); });
    writeSeen(all.map(function (x) { return x.w; }));

    // 새로 배운 낱말: 씨앗에게서 톡 튀어나와 걸어감 (홈 인사말 뒤에)
    newOnes.forEach(function (item, i) {
      setTimeout(function () {
        var side = i % 2 ? 1 : -1;
        // 씨앗 옆에서 나와 바깥쪽으로 걸어감 (씨앗 얼굴을 가리지 않게)
        var g = garden.getBoundingClientRect(), r = seedEl.getBoundingClientRect();
        var edge = ((side < 0 ? r.left - 8 : r.right + 8) - g.left) / g.width * 100;
        var w = makeWord(item, { x: edge, y: 93 }, true);
        w.target = { x: 50 + side * (18 + Math.random() * 8), y: 82 + Math.random() * 10 };
        w.wait = 0.3;
        place(w, 0);
        sparkleAtSeed();
        if (i === 0 && SG.seed) SG.seed.say('새로 배운 ‘' + item.w + '’도 정원에 놀러 왔어!', { intent: 'generic', voice: false });
      }, 1600 + i * 900);
    });

    root.addEventListener('resize', function () {
      while (words.length > maxWords()) words.pop().el.remove();
      words.forEach(function (w) { w.target = randomSpot(w); place(w, 0); });
    });
    root.requestAnimationFrame(tick);
  }

  decorate();
  // 씨앗 그림이 그려진 뒤(크기가 정해진 뒤)에 낱말을 배치
  function ready() {
    startWords();
  }
  if (document.readyState === 'complete') ready();
  else root.addEventListener('load', ready, { once: true });

  /* ---------------- 4) 땅속 게임 방: 활동 고르기 화면일 때만 아래 게임 보드를 땅속처럼 (정원은 그대로) ---------------- */
  function syncUnderground() {
    var panel = $('panel');
    var board = panel && panel.closest ? panel.closest('.board') : null;
    if (!panel || !board) return;
    var home = !!panel.querySelector('.home .act-grid');
    board.classList.toggle('gh-under', home);
  }
  (function watchPanel() {
    var panel = $('panel');
    if (!panel) return;
    syncUnderground();
    if (root.MutationObserver) new MutationObserver(syncUnderground).observe(panel, { childList: true });
  })();

  SG.gardenHome = { learnedWords: learnedWords };
})(typeof window !== 'undefined' ? window : globalThis);
