/*
 * 📖 단어 읽기 — 자리만 남겨 둔 파일 (팀원 게임 연결용)
 *
 * 지금은 홈 화면에 타일만 보이고, 누르면 "준비 중" 화면이 나옵니다.
 * 게임을 연결할 때는 아래 start 함수 안만 바꾸면 됩니다. 두 가지 방법 중 하나를 고르세요.
 *
 *  ① 별도 페이지로 만든 게임이면 (동화 읽기와 같은 방식)
 *       start: function () { window.location.href = 'reading-word/'; }
 *     → 이 폴더 옆에 reading-word/index.html 을 두면 됩니다.
 *       공통 씨앗·경험치를 쓰려면 reading-sentence/index.html 처럼 ../css/common.css 와
 *       ../js/hangul.js, engine.js, store.js, seed.js, growth.js 를 불러오고 SG.growth.addExp(...) 를 부르세요.
 *
 *  ② 이 홈 화면 안에서 그리는 게임이면
 *       SG.core 의 도구(panel, el, activityHeader, TaskRun, addExp ...)로 화면을 그리세요.
 *       (원본 저장소의 js/activities/read-word.js 가 이 방식의 예시입니다)
 *
 * 타일 이름·아이콘·설명·순서는 아래 registerActivity 의 icon, title, desc, order 를 고치세요.
 */
(function () {
  'use strict';
  SG.registerActivity({
    key: 'read-word', order: 1, icon: '📖', title: '단어 읽기', desc: '씨앗에게 낱말 소리를 들려줘요',
    start: function () {
      // TODO(팀원): 게임이 준비되면 아래 한 줄을 게임 시작 코드로 바꾸세요.
      SG.core.comingSoon('단어 읽기');
    }
  });
})();
