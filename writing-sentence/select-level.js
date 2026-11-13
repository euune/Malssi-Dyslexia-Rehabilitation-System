/* ========================================
   말씨 – 쓰기 · 문장 단계 선택 (320 문장 쓰기 훈련)
   단어 읽기 단계 선택(reading-words/select-level.js)과 같은 화면 구성
     1단계(321) 문장 틀 + 낱말 선택 → level1.html
     2단계(322) 단어 카드 순서 배열 → level2.html
     3단계(323) 그림 기반 단어 조합 → level3.html
======================================== */
(function () {
  'use strict';

  var SG = window.SG;
  var WS = SG.writingSentence;
  var app = document.getElementById('app');
  if (!app || !WS) return;

  var state = SG.store.get();
  var DEFAULT_TEXT = '단계를 골라 줘!';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  app.innerHTML =
    '<section class="screen level-screen">' +
      '<div class="act-head">' +
        '<h1>문장 쓰기</h1>' +
        '<a class="garden-btn" href="../index.html">정원으로 🏡</a>' +
      '</div>' +
      '<div class="selection-shell">' +
        '<div class="seed-strip stage">' +
          '<div class="seed-wrap"><svg id="seed" viewBox="0 0 200 200" role="img" aria-label="씨앗"></svg></div>' +
          '<div class="bubble show" id="bubble" aria-live="polite">' + DEFAULT_TEXT + '</div>' +
        '</div>' +
        '<div class="level-body">' +
          '<nav class="level-list" aria-label="문장 쓰기 단계 선택">' +
            WS.data.levels.map(function (level) {
              var done = WS.logic.doneCount(state, level), total = level.items.length;
              // 완성 수는 글자 대신 점으로 (완성한 문장 = 초록 점)
              var dots = level.items.map(function (it) {
                return '<span class="done-dot' + (WS.logic.isDone(state, it.id) ? ' on' : '') + '"></span>';
              }).join('');
              return (
                '<a class="level-card' + (done === total ? ' all-done' : '') + '" href="level' + level.number + '.html" data-level="' + level.number + '"' +
                  ' aria-label="' + level.number + '단계, ' + esc(level.title) + '. ' + esc(level.description) + ' ' + total + '문장 중 ' + done + '문장 완성.">' +
                  '<span class="level-number" aria-hidden="true">' + level.number + '</span>' +
                  '<span class="level-meta" aria-hidden="true">' +
                    '<span class="level-title">' + esc(level.title) + '</span>' +
                    '<span class="done-dots">' + dots + '</span>' +
                  '</span>' +
                  '<span class="level-arrow" aria-hidden="true">→</span>' +
                '</a>'
              );
            }).join('') +
          '</nav>' +
        '</div>' +
      '</div>' +
    '</section>';

  /* 씨앗 캐릭터 및 성장 상태 */
  try {
    SG.growth.update(true);
    SG.seed.react('nod');
  } catch (e) {
    console.warn('씨앗 공통 모듈을 표시하지 못했습니다.', e);
  }

  /* 단계에 마우스를 올리거나 키보드로 고르면 씨앗 말풍선 변경 */
  var bubble = document.getElementById('bubble');
  Array.prototype.forEach.call(document.querySelectorAll('.level-card'), function (card) {
    var level = WS.data.levels.filter(function (l) { return l.number === Number(card.dataset.level); })[0];
    if (!level) return;
    function show() { bubble.textContent = level.detail; SG.seed.react('nod'); }
    function reset() { bubble.textContent = DEFAULT_TEXT; }
    card.addEventListener('mouseenter', show);
    card.addEventListener('focus', show);
    card.addEventListener('mouseleave', reset);
    card.addEventListener('blur', reset);
  });
})();
