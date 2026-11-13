/* main의 읽기 활동처럼 별도 HTML로 이동한다. */
(function () {
  'use strict';
  SG.registerActivity({
    key: 'write-word', order: 3, icon: '✏️', title: '단어 쓰기', desc: '소리 조각으로 낱말을 만들어요',
    start: function () {
      SG.speech.stopSpeaking();
      window.location.href = 'writing-word/index.html';
    }
  });
})();
