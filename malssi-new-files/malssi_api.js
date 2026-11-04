/*
 * 말씨 서버 연결 (두 페이지 공통)
 * - 서버(npm start)로 열면: 별명으로 학습자를 정하고 기록을 MySQL에 저장
 * - 파일을 더블클릭해서 열거나 서버가 꺼져 있으면: 저장 없이 그대로 동작 (기존처럼 브라우저에만 저장)
 */
(function (root) {
  'use strict';
  const USER_KEY = 'malssi.user.v1';
  let user = null;
  let online = false;

  function loadUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function storeUser(u) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) { /* 무시 */ }
  }

  async function call(method, url, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // 별명 입력 화면 (서버에 처음 접속했을 때 한 번만)
  function askNickname() {
    return new Promise((resolve) => {
      const box = document.createElement('div');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', '별명 입력');
      box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(60,50,30,.35)';
      box.innerHTML = `
        <form style="width:100%;max-width:340px;padding:22px 18px;border-radius:20px;background:#fffaf0;box-shadow:0 10px 30px rgba(0,0,0,.15);font:inherit;text-align:center">
          <p style="margin:0 0 6px;font-size:20px">🌱 안녕! 너는 누구야?</p>
          <p style="margin:0 0 14px;font-size:14px;color:#7a6f5c">별명을 쓰면 읽은 기록이 저장돼요.</p>
          <input name="n" maxlength="30" autocomplete="off" required placeholder="예: 새싹이"
            style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:2px solid #e4d9c3;font:inherit;font-size:17px;text-align:center">
          <button style="width:100%;margin-top:12px;padding:12px;border:0;border-radius:12px;background:#6aa85a;color:#fff;font:inherit;font-size:17px;cursor:pointer">시작하기</button>
          <p class="err" style="min-height:18px;margin:8px 0 0;font-size:13px;color:#9a6b2f"></p>
        </form>`;
      document.body.appendChild(box);
      const form = box.querySelector('form');
      form.n.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const u = await call('POST', '/api/users', { nickname: form.n.value });
          box.remove();
          resolve(u);
        } catch (err) {
          form.querySelector('.err').textContent = '저장 서버에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요.';
        }
      });
    });
  }

  /** 페이지 시작 시 한 번 호출: 서버가 있으면 학습자를 정해 둠 */
  async function ready() {
    if (location.protocol === 'file:') return null;
    try {
      await call('GET', '/api/health');
      online = true;
    } catch (e) {
      return null;
    }
    user = loadUser();
    if (!user) {
      user = await askNickname();
      storeUser(user);
    }
    return user;
  }

  /**
   * 진행 상황 불러오기
   * @returns {Promise<{cleared:number,state:object|null}|null|undefined>}
   *   객체: 저장된 진행 상황 / null: 서버에 아직 기록 없음 / undefined: 서버 없음(브라우저 저장만 사용)
   */
  async function loadProgress(activity) {
    if (!online || !user) return undefined;
    try { return await call('GET', `/api/users/${user.id}/progress/${encodeURIComponent(activity)}`); } catch (e) { return undefined; }
  }

  /** 진행 상황 저장: saveProgress('writing_word', { cleared: 3, state: { idx: 2 } }) */
  function saveProgress(activity, { cleared = 0, state = null } = {}) {
    if (!online || !user) return;
    call('PUT', `/api/users/${user.id}/progress/${encodeURIComponent(activity)}`, { cleared, state }).catch(onFail);
  }

  /**
   * 시도 한 번 기록
   * logAttempt({
   *   activity: 'writing_word',   // 필수: activities 테이블의 code
   *   target:   '사과',            // 필수: 읽거나 써야 했던 것
   *   outcome:  'reached',        // 필수: 'reached'(도달) | 'not_yet'(아직) | 'no_input'(무응답)
   *   answer:   '사가',            // 아이가 읽은 말 / 쓴 글
   *   score:    0.5,              // 0~1
   *   stage:    1,                // 장·단계·문제 번호
   *   retries:  0,                // 같은 문제에서 몇 번째 재시도인지
   *   detail:   { ms: 4200 },     // 게임마다 다른 추가 정보 (객체, 4KB 이하)
   * })
   */
  function logAttempt(a) {
    if (!online || !user) return;
    call('POST', `/api/users/${user.id}/attempts`, a).catch(onFail);
  }

  function onFail(e) {
    if (e && e.message === '404') forgetUser(); // DB에서 지워진 학습자
    else if (e && e.message === '400') console.warn('[말씨] 서버가 값을 거절했어요. activity 이름과 필수 값을 확인하세요.');
  }

  function forgetUser() {
    user = null;
    try { localStorage.removeItem(USER_KEY); } catch (e) { /* 무시 */ }
  }

  root.MalssiAPI = { ready, loadProgress, saveProgress, logAttempt, forgetUser, get user() { return user; } };
})(window);
