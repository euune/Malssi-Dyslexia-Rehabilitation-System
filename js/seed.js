/* 씨앗 캐릭터: 성장 단계별 SVG, 반응 애니메이션, 말풍선 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};

  function growthSvg(stage) {
    var g = '';
    if (stage >= 6) { // 꽃·열매
      g += '<circle cx="100" cy="52" r="46" fill="var(--leaf-dark)"/><circle cx="72" cy="62" r="26" fill="var(--leaf)"/><circle cx="128" cy="62" r="26" fill="var(--leaf)"/><circle cx="100" cy="40" r="28" fill="var(--leaf)"/>';
      [[70, 45], [125, 38], [100, 70], [140, 70], [60, 75]].forEach(function (p, i) {
        g += i % 2 ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="var(--fruit)"/>'
                   : '<g transform="translate(' + p[0] + ' ' + p[1] + ')"><circle r="5" cx="0" cy="-6" fill="var(--flower)"/><circle r="5" cx="6" cy="0" fill="var(--flower)"/><circle r="5" cx="0" cy="6" fill="var(--flower)"/><circle r="5" cx="-6" cy="0" fill="var(--flower)"/><circle r="4" fill="var(--sun)"/></g>';
      });
      g = '<rect x="93" y="80" width="14" height="32" rx="5" fill="var(--trunk)"/>' + g;
    } else if (stage === 5) { // 성목
      g = '<rect x="93" y="78" width="14" height="34" rx="5" fill="var(--trunk)"/><circle cx="100" cy="55" r="42" fill="var(--leaf-dark)"/><circle cx="76" cy="62" r="22" fill="var(--leaf)"/><circle cx="124" cy="62" r="22" fill="var(--leaf)"/><circle cx="100" cy="42" r="24" fill="var(--leaf)"/>';
    } else if (stage === 4) { // 묘목
      g = '<path d="M100 110 C100 90 100 70 100 48" stroke="var(--trunk)" stroke-width="6" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="80" cy="78" rx="18" ry="9" transform="rotate(-25 80 78)" fill="var(--leaf)"/><ellipse cx="120" cy="72" rx="18" ry="9" transform="rotate(25 120 72)" fill="var(--leaf)"/>' +
          '<ellipse cx="84" cy="52" rx="16" ry="8" transform="rotate(-30 84 52)" fill="var(--leaf-dark)"/><ellipse cx="116" cy="48" rx="16" ry="8" transform="rotate(30 116 48)" fill="var(--leaf-dark)"/>';
    } else if (stage === 3) { // 새싹
      g = '<path d="M100 110 C100 95 100 85 100 72" stroke="var(--leaf-dark)" stroke-width="5" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="84" cy="70" rx="17" ry="9" transform="rotate(-20 84 70)" fill="var(--leaf)"/><ellipse cx="116" cy="70" rx="17" ry="9" transform="rotate(20 116 70)" fill="var(--leaf)"/>';
    } else if (stage === 2) { // 발아
      g = '<path d="M100 110 C100 100 96 94 102 88 C108 82 112 90 106 92" stroke="var(--leaf)" stroke-width="5" fill="none" stroke-linecap="round"/>';
    }
    return g;
  }

  function render(stage) {
    var svg = document.getElementById('seed');
    svg.innerHTML =
      '<ellipse cx="100" cy="182" rx="80" ry="12" fill="var(--soil)"/>' +
      '<g class="growth-g">' + growthSvg(stage) + '</g>' +
      (stage === 1 ? '<circle cx="100" cy="140" r="56" fill="var(--sun)" opacity=".25" class="glow"/>' : '') +
      '<g class="seed-body">' +
        '<ellipse cx="100" cy="142" rx="44" ry="38" fill="var(--seed)"/>' +
        '<ellipse cx="86" cy="124" rx="12" ry="7" fill="#fff" opacity=".25"/>' +
        '<g class="eyes"><circle cx="85" cy="140" r="5" fill="var(--ink)"/><circle cx="115" cy="140" r="5" fill="var(--ink)"/>' +
        '<circle cx="86.5" cy="138.5" r="1.6" fill="#fff"/><circle cx="116.5" cy="138.5" r="1.6" fill="#fff"/></g>' +
        '<circle cx="74" cy="152" r="6" fill="var(--cheek)" opacity=".7"/><circle cx="126" cy="152" r="6" fill="var(--cheek)" opacity=".7"/>' +
        '<path class="mouth" d="M92 154 Q100 161 108 154" stroke="var(--ink)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</g>';
  }

  var animTimer = null;
  function react(anim) {
    var svg = document.getElementById('seed');
    svg.classList.remove('nod', 'tilt', 'surprise', 'sing', 'hug', 'listen', 'happy', 'point');
    void svg.getBoundingClientRect();
    if (!anim) return;
    svg.classList.add(anim);
    clearTimeout(animTimer);
    if (anim !== 'listen') animTimer = setTimeout(function () { svg.classList.remove(anim); }, 2200);
  }

  var bubbleToken = 0;
  /** 씨앗이 말하기 (말풍선 + 씨앗 목소리). 모든 문장은 평가어 검증을 거친다. */
  function say(text, opts) {
    opts = opts || {};
    text = SG.engine.verifyText(text, opts.intent || 'generic');
    var b = document.getElementById('bubble');
    b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    var token = ++bubbleToken;
    var st = SG.store.get().settings;
    if (opts.voice !== false && st.seedVoice) {
      return SG.speech.speak(text.replace(/[‘’…]/g, ' '), 'seed').then(function () { return token; });
    }
    return new Promise(function (r) { setTimeout(r, Math.min(2500, 600 + text.length * 50)); });
  }

  SG.seed = { render: render, react: react, say: say };
})(typeof window !== 'undefined' ? window : globalThis);
