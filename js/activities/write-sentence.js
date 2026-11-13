/*
 * 쓰기 — 문장 (320 문장 쓰기 훈련)
 * 단어 읽기처럼 단계 선택 화면을 거쳐 단계별 페이지로 이동합니다.
 *   writing-sentence/select-level.html  단계 선택 (완성 수 표시)
 *   writing-sentence/level1.html        321 1단계 문장 틀 + 낱말 선택
 *   writing-sentence/level2.html        322 2단계 단어 카드 순서 배열
 *   writing-sentence/level3.html        323 3단계 그림 기반 단어 조합
 *   writing-sentence/data.js            과제 문장·그림 (수정은 여기서)
 */
(function () {
  'use strict';
  SG.registerActivity({
    key: 'write-sentence', order: 4, icon: '🧩', title: '문장 쓰기', desc: '낱말 카드로 문장을 만들어요',
    start: function () {
      SG.speech.stopSpeaking();
      window.location.href = 'writing-sentence/select-level.html';
    }
  });
})();
