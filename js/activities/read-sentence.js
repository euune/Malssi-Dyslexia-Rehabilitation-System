/*
 * 읽기 — 문장 (동화 문장 읽기 훈련 220)
 * 이 활동은 독립된 페이지 reading-sentence/ 에 있습니다.
 *   reading-sentence/story.js   동화 7장 (문장·이해 질문)
 *   reading-sentence/app.js     이야기 지도 → 문장 읽기 → 이해 질문 → 재읽기, 단계적 간접 피드백
 *   reading-sentence/hangul.js  자소 단위 문장·단어 유사도
 *   reading-sentence/style.css  화면 스타일
 * 홈 화면의 타일을 누르면 그 페이지로 이동합니다.
 */
(function () {
  'use strict';
  SG.registerActivity({
    key: 'read-sentence', order: 2, icon: '📚', title: '동화 읽기', desc: '문장을 읽어 동화를 완성해요',
    start: function () { SG.speech.stopSpeaking(); window.location.href = 'reading-sentence/'; }
  });
})();
