/*
 * 인트로 영상 (처음 화면)
 * - 처음 화면(index.html)을 열 때, 브라우저를 켤 때마다 한 번 보여 줌 (같은 세션에서 🏡 로 돌아올 땐 다시 안 나옴)
 * - 소리가 있는 영상은 브라우저가 자동 재생을 막으므로 "▶ 시작하기"를 눌러야 재생됨
 * - 끝나거나 "건너뛰기"(Esc)를 누르면 정원으로
 * - 주소에 ?intro 를 붙이면 항상 보여 주고, ?nointro 를 붙이면 보여 주지 않음
 * 파일: media/intro.mp4, media/intro-poster.jpg
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var SEEN_KEY = 'malssi.intro-seen';
  var VIDEO = 'media/intro.mp4';
  var POSTER = 'media/intro-poster.jpg';
  var box = null;

  function seen() { try { return root.sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { root.sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 무시 */ } }
  function reducedMotion() { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function close() {
    if (!box) return;
    var b = box;
    box = null;
    markSeen();
    var v = b.querySelector('video');
    if (v) { try { v.pause(); } catch (e) { /* 무시 */ } }
    root.removeEventListener('keydown', onKey);
    if (reducedMotion()) { b.remove(); return; }
    b.classList.add('leaving');
    setTimeout(function () { b.remove(); }, 600);
    var home = document.getElementById('btn-home');
    if (home) home.focus({ preventScroll: true });
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function show() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'intro';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '말씨 인트로 영상');
    box.innerHTML =
      '<div class="intro-stage">' +
        '<video class="intro-video" playsinline preload="auto" poster="' + POSTER + '">' +
          '<source src="' + VIDEO + '" type="video/mp4">' +
        '</video>' +
      '</div>' +
      '<button class="btn primary intro-play" type="button">▶ 시작하기</button>' +
      '<button class="btn ghost small intro-skip" type="button">건너뛰기 ▶\uFE0E</button>';
    document.body.appendChild(box);

    var video = box.querySelector('video');
    var play = box.querySelector('.intro-play');
    var skip = box.querySelector('.intro-skip');

    play.addEventListener('click', function () {
      box.classList.add('playing');
      video.muted = false;
      var p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          // 소리 재생이 막히면 소리 없이라도 재생
          video.muted = true;
          video.play().catch(function () { close(); });
        });
      }
    });
    video.addEventListener('ended', close);
    video.addEventListener('error', close, true); // 영상 파일이 없거나 열 수 없으면 바로 정원으로
    skip.addEventListener('click', close);
    root.addEventListener('keydown', onKey);
  }

  /** 설정 화면에 넣을 "인트로 다시 보기" 버튼 (js/core.js 의 showSettings 에서 사용) */
  function settingsButton(el) {
    return el('button', { class: 'btn ghost small', text: '인트로 다시 보기 🎬', onclick: show });
  }

  SG.intro = { show: show, close: close, settingsButton: settingsButton };

  var params = new URLSearchParams(root.location.search);
  if (params.has('nointro')) return;
  if (params.has('intro') || !seen()) show();
})(typeof window !== 'undefined' ? window : globalThis);
