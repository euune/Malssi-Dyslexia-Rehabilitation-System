/*
 * 성장 시각화부(180) — 모든 페이지가 함께 쓰는 씨앗 성장
 * 경험치는 js/store.js 저장소(localStorage) 하나에 모이므로, 단어 활동과 동화 읽기 어디서 얻어도 같은 씨앗이 자란다.
 * 페이지에 필요한 요소: #seed-name, #stage-name, #growth-fill (상단 바), svg#seed (씨앗), #overlay (자랄 때 축하 창)
 *
 * 경험치를 얻으면 배운 말(또는 반짝이)이 화면에서 씨앗 쪽으로 날아가 쏙 들어가고,
 * 씨앗이 꿀꺽 받아먹은 뒤 상단 성장 막대가 차오른다.
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var lastStage = -1;
  var flying = 0; // 동시에 날아가는 말 수 (차례로 출발시키기 위함)

  function $(id) { return document.getElementById(id); }

  /** 상단 바(이름·단계·막대)와 씨앗 모습을 저장된 경험치에 맞춤. force: 씨앗을 다시 그리기 */
  function update(force) {
    var st = SG.store.get(), E = SG.engine, stage = E.stageOf(st.exp);
    if ($('seed-name')) $('seed-name').textContent = st.seedName || '씨앗';
    if ($('stage-name')) $('stage-name').textContent = E.STAGES[stage];
    if ($('growth-fill')) $('growth-fill').style.width = Math.round(E.stageProgress(st.exp) * 100) + '%';
    if ($('seed') && (force || stage !== lastStage)) { SG.seed.render(stage); lastStage = stage; }
    return stage;
  }

  function celebrate(stage) {
    var ov = $('overlay');
    if (!ov) return;
    var name = SG.store.get().seedName || '씨앗';
    ov.innerHTML =
      '<div class="celebrate">' +
        '<div class="big-emoji">' + ['🌰', '🌰', '🌱', '🌿', '🪴', '🌳', '🌸'][stage] + '</div>' +
        '<p></p><p class="sub">여러 번 들려준 말들이 씨앗을 키웠어요.</p>' +
        '<button class="btn primary">좋아요</button>' +
      '</div>';
    ov.querySelector('p').textContent = SG.hangul.josa(name, '이/가') + ' ‘' + SG.engine.STAGES[stage] + '’ 모습으로 자랐어요!';
    ov.querySelector('button').addEventListener('click', function () { ov.classList.add('hidden'); });
    ov.classList.remove('hidden');
    SG.seed.react('happy');
  }

  function reducedMotion() {
    return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function centerOf(el, yRatio) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * (yRatio == null ? 0.5 : yRatio) };
  }

  /** 씨앗이 말을 받아먹는 반응: 몸이 꿀꺽, 주변에 반짝이 */
  function gulp(seed, big) {
    var body = seed.querySelector('.seed-body');
    if (body && body.animate) {
      body.animate([
        { transform: 'scale(1)' },
        { transform: big ? 'scale(1.16, .88)' : 'scale(1.07, .95)' },
        { transform: 'scale(.97, 1.04)' },
        { transform: 'scale(1)' }
      ], { duration: big ? 520 : 360, easing: 'ease-out' });
    }
    var c = centerOf(seed, 0.7);
    var n = big ? 6 : 3;
    for (var i = 0; i < n; i++) {
      var sp = document.createElement('span');
      sp.className = 'exp-spark';
      sp.textContent = i % 2 ? '✨' : '🌟';
      sp.style.left = c.x + 'px'; sp.style.top = c.y + 'px';
      document.body.appendChild(sp);
      var ang = (Math.PI * 2 * i) / n - Math.PI / 2, dist = big ? 64 : 40;
      var a = sp.animate([
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + Math.cos(ang) * dist + 'px), calc(-50% + ' + Math.sin(ang) * dist + 'px)) scale(1)', opacity: 0 }
      ], { duration: 650, easing: 'ease-out' });
      a.onfinish = (function (s) { return function () { s.remove(); }; })(sp);
    }
    var fill = $('growth-fill');
    if (fill) { fill.classList.remove('gain'); void fill.offsetWidth; fill.classList.add('gain'); }
  }

  /**
   * 배운 말을 씨앗 쪽으로 날려 보냄
   * @param {string} text  날아갈 말 (없으면 반짝이)
   * @param {Element} [from] 출발 위치 요소 (없으면 화면 아래쪽 가운데)
   * @param {boolean} big  목표에 도달한 말이면 크게
   * @returns {Promise} 씨앗에 닿으면 resolve
   */
  function flyToSeed(text, from, big) {
    var seed = $('seed');
    if (!seed || !document.body.animate || reducedMotion()) return Promise.resolve();
    var delay = flying * 160;
    flying++;
    return new Promise(function (resolve) {
      setTimeout(function () {
        var start = from && from.isConnected ? centerOf(from) : { x: root.innerWidth / 2, y: root.innerHeight * 0.78 };
        var end = centerOf(seed, 0.7);
        var chip = document.createElement('div');
        chip.className = 'exp-fly' + (big ? ' big' : '');
        chip.textContent = text || '✨';
        chip.style.left = start.x + 'px'; chip.style.top = start.y + 'px';
        document.body.appendChild(chip);
        var dx = end.x - start.x, dy = end.y - start.y;
        var lift = Math.min(140, Math.abs(dy) * 0.35 + 50); // 위로 살짝 떠올랐다가 씨앗으로
        var anim = chip.animate([
          { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 1, offset: 0.15 },
          { transform: 'translate(calc(-50% + ' + dx * 0.45 + 'px), calc(-50% + ' + (dy * 0.45 - lift) + 'px)) scale(1)', opacity: 1, offset: 0.55 },
          { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.15)', opacity: 0.2 }
        ], { duration: big ? 1100 : 750, easing: 'cubic-bezier(.45, 0, .55, 1)' });
        anim.onfinish = function () {
          chip.remove();
          flying = Math.max(0, flying - 1);
          gulp(seed, big);
          resolve();
        };
      }, delay);
    });
  }

  /**
   * 경험치 더하기 (최초 도전 +1, 재시도 +1, 완료 +2 — engine.js CONFIG.exp)
   * @param {number} n
   * @param {object} [fx] {text: 날아갈 말, from: 출발 요소, big: 목표 도달 여부}
   */
  function addExp(n, fx) {
    var st = SG.store.get(), E = SG.engine, before = E.stageOf(st.exp);
    st.exp += n; SG.store.save(); // 저장은 바로 (화면을 떠나도 잃지 않게)
    var land = fx ? flyToSeed(fx.text, fx.from, fx.big) : Promise.resolve();
    return land.then(function () {
      var after = update();
      if (after > before) celebrate(after);
    });
  }

  SG.growth = { update: update, addExp: addExp, celebrate: celebrate, flyToSeed: flyToSeed };
})(typeof window !== 'undefined' ? window : globalThis);
