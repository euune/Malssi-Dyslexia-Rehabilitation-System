
/*
 * 말씨 설명서
 * 씨앗 성장 과정 및 학습 활동 안내
 */

(function () {
  'use strict';

  const ICONS = [
    '🌰', '🌰', '🌱', '🌿', '🪴', '🌳', '🌸'
  ];

  const GUIDE_ID = 'malssi-guide-overlay';

  let lastFocused = null;
  let previousOverflow = '';

  // HTML 특수문자 처리
  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char])
    );
  }

  /* ========================================
     1. 실제 씨앗 성장 데이터 가져오기
  ======================================== */

  function getGrowthData() {
    const sg = window.SG;
    const engine = sg && sg.engine;
    const store = sg && sg.store;

    const state =
      store && typeof store.get === 'function'
        ? store.get()
        : {};

    const exp = Number(state && state.exp) || 0;

    // engine.js에 정의된 실제 성장 단계 이름
    const names =
      engine && Array.isArray(engine.STAGES)
        ? engine.STAGES
        : [];

    // 현재 씨앗 성장 단계
    const stage =
      engine && typeof engine.stageOf === 'function'
        ? engine.stageOf(exp)
        : -1;

    // 현재 단계의 성장 진행률
    const progress =
      engine &&
      typeof engine.stageProgress === 'function'
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(engine.stageProgress(exp) * 100)
            )
          )
        : 0;

    // 실제 경험치 설정값
    const config =
      engine && engine.CONFIG && engine.CONFIG.exp || {};

    const points = {
      first: config.firstTry ?? 1,
      retry: config.retry ?? 1,
      complete: config.complete ?? 2
    };

    return {
      exp,
      names,
      stage,
      progress,
      points
    };
  }

  /* ========================================
     2. 설명서 화면 생성
  ======================================== */

  function renderGuide() {
    const data = getGrowthData();

    // 실제 성장 단계 이름 사용
    const stages = data.names.length
      ? data.names
      : ICONS.map((_, i) => `${i + 1}단계`);

    // 성장 단계별 카드
    const stageHtml = stages.map((name, index) => {
      const cls =
        index === data.stage
          ? ' is-current'
          : index < data.stage
            ? ' is-past'
            : '';

      const stateText =
        index === data.stage
          ? '현재 단계'
          : index < data.stage
            ? '성장 완료'
            : '';

      return `
        <li class="guide-stage${cls}">

          <span
            class="guide-stage-icon"
            aria-hidden="true">
            ${ICONS[index] || '🌸'}
          </span>

          <span class="guide-stage-number">
            ${index + 1}단계
          </span>

          <strong class="guide-stage-name">
            ${escapeHtml(name)}
          </strong>

          ${
            stateText
              ? `<span class="guide-stage-state">
                   ${stateText}
                 </span>`
              : ''
          }

        </li>
      `;
    }).join('');

    const stageName =
      data.names[data.stage] || '성장 중';

    return `
      <div
        class="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabindex="-1">

        <!-- 설명서 상단 -->
        <div class="guide-header">

          <div>
            <p class="guide-eyebrow">
              🌱 말씨 이용 안내
            </p>

            <h2 id="guide-title">
              말씨 설명서
            </h2>
          </div>

          <button
            type="button"
            class="guide-close"
            aria-label="설명서 닫기">
            ✕
          </button>

        </div>

        <!-- 스크롤 영역 -->
        <div class="guide-scroll">

          <!-- 씨앗 성장 과정 -->
          <section class="guide-section">

            <h3>🌳 씨앗은 어떻게 자랄까요?</h3>

            <p>
              활동을 통해 말을 익힐 때마다
              경험치가 쌓이고,
              같은 씨앗이 조금씩 자라요.
            </p>

            <!-- 나의 성장 상태 -->
            <div class="guide-current">

              <strong>
                현재 씨앗:
                ${ICONS[data.stage] || '🌱'}
                ${escapeHtml(stageName)}
              </strong>

              <span>
                누적 경험치 ${data.exp}
                · 현재 성장 단계 ${data.progress}%
              </span>

              <div
                class="guide-progress"
                role="progressbar"
                aria-label="현재 성장 단계 진행률"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${data.progress}">

                <div style="width:${data.progress}%"></div>

              </div>

            </div>

            <!-- 전체 성장 단계 -->
            <ol class="guide-stages">
              ${stageHtml}
            </ol>

            <p class="guide-note">
              현재 성장 단계는 게임에서 저장한
              경험치를 기준으로 표시돼요.
            </p>

          </section>

          <!-- 경험치 설명 -->
          <section class="guide-section">

            <h3>✨ 경험치는 어떻게 쌓이나요?</h3>

            <div class="guide-exp-grid">

              <div>
                <strong>+${escapeHtml(data.points.first)}</strong>
                <span>처음 시도하기</span>
              </div>

              <div>
                <strong>+${escapeHtml(data.points.retry)}</strong>
                <span>다시 시도하기</span>
              </div>

              <div>
                <strong>+${escapeHtml(data.points.complete)}</strong>
                <span>목표에 도달하기</span>
              </div>

            </div>

            <p>
              말이나 반짝이가 씨앗에게 날아가면
              성장 막대가 채워져요.
              막대의 25%, 50%, 75% 지점에서는
              작은 꽃이 피어나요.
            </p>

            <p>
              성장 단계가 바뀌면
              새로운 모습의 씨앗과
              축하 메시지를 볼 수 있어요.
            </p>

            <p class="guide-note">
              경험치는 공통으로 저장돼요.
              실제 지급 시점은 각 게임의
              학습 동작에 따라 달라질 수 있어요.
            </p>

          </section>

          <!-- 학습 활동 안내 -->
          <section class="guide-section">

            <h3>📚 네 가지 학습 활동</h3>

            <div class="guide-activities">

              <!-- 단어 읽기 -->
              <article>

                <h4>📖 단어 읽기</h4>

                <p>
                  단어의 소리와 뜻을 연결하며
                  스스로 읽는 힘을 기르는 활동이에요.
                </p>

                <ul>
                  <li>
                    1단계: 그림과 단어를 보고
                    음성을 들은 뒤 따라 읽어요.
                  </li>

                  <li>
                    2단계: 그림과 단어를 스스로
                    읽고 필요할 때 힌트를 들어요.
                  </li>

                  <li>
                    3단계: 단어를 먼저 읽은 뒤
                    그림으로 의미를 확인해요.
                  </li>
                </ul>

              </article>

              <!-- 동화 읽기 -->
              <article>

                <h4>📚 동화 읽기</h4>

                <p>
                  문장을 하나씩 읽어 동화를 완성하고, 간단한 질문에 답하며 문장 읽기와 이야기 이해력을 길러요.
                </p>

                <p>
                  읽기 어려운 부분은 글자 강조,
                  글자 크기와 자간 조정,
                  함께 읽기로 도움받을 수 있어요.
                </p>

              </article>

              <!-- 단어 쓰기 -->
              <article>

                <h4>✏️ 단어 쓰기</h4>

                <p>
                  비슷한 소리의 단어를 비교하고 음소를 직접 바꾸어 보며 소리와 글자, 의미의 관계를 익혀요.
                </p>

                <p>
                  소리와 글자, 단어의 의미를
                  연결하는 연습을 할 수 있어요.
                </p>

              </article>

              <!-- 문장 쓰기 -->
              <article>

                <h4>🧩 문장 쓰기</h4>

                <p>
                  알맞은 단어를 선택하고 카드를 배열하거나 그림을 보고 문장을 구성하며 문장 구조와 표현 능력을 길러요.
                </p>

                <ul>
                  <li>1단계: 문장에 알맞은 단어 선택하기</li>
                  <li>2단계: 단어 카드를 순서대로 배열하기</li>
                  <li>3단계: 그림을 보고 문장 만들기</li>
                </ul>

              </article>

            </div>

          </section>

          <p class="guide-footer-note">
            조급해하지 않고 한 번씩 시도해 보세요.
            필요할 때 힌트를 사용해도 좋아요.
          </p>

        </div>

        <!-- 하단 닫기 버튼 -->
        <div class="guide-footer">

          <button
            type="button"
            class="guide-done">
            설명서 닫기
          </button>

        </div>

      </div>
    `;
  }

  /* ========================================
     3. 설명서 팝업 생성
  ======================================== */

  function getOverlay() {
    let overlay = document.getElementById(GUIDE_ID);

    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = GUIDE_ID;
    overlay.className = 'guide-overlay';
    overlay.hidden = true;

    document.body.appendChild(overlay);

    // 팝업 외부를 클릭하면 닫기
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeGuide();
      }
    });

    // ESC와 키보드 포커스 처리
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeGuide();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = [
        ...overlay.querySelectorAll('button, a[href]')
      ].filter((el) =>
        !el.disabled && el.offsetParent !== null
      );

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    });

    return overlay;
  }

  /* ========================================
     4. 설명서 열기 / 닫기
  ======================================== */

  function openGuide() {
    const overlay = getOverlay();

    lastFocused = document.activeElement;

    // 현재 경험치로 설명서 다시 생성
    overlay.innerHTML = renderGuide();
    overlay.hidden = false;

    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    overlay.querySelector('.guide-close')
      .addEventListener('click', closeGuide);

    overlay.querySelector('.guide-done')
      .addEventListener('click', closeGuide);

    overlay.querySelector('.guide-close').focus();
  }

  function closeGuide() {
    const overlay = document.getElementById(GUIDE_ID);

    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;

    document.body.style.overflow = previousOverflow;

    if (lastFocused && lastFocused.isConnected) {
      lastFocused.focus();
    }
  }

  /* ========================================
     5. 설정 버튼 찾기
  ======================================== */

  function isSettingsButton(el) {
    return [
      el.textContent,
      el.getAttribute('aria-label')
    ].some((value) => {
      const label = String(value || '')
        .replace(/[\u2699\uFE0F]/g, '')
        .replace(/\s+/g, '')
        .trim();

      return label === '설정' ||
             label === '설정열기';
    });
  }

  /* ========================================
     6. 설정 옆에 설명서 버튼 추가
  ======================================== */

  function addGuideButton() {
    const panel = document.getElementById('panel');

    if (!panel) return;

    // 기존 설정 버튼 찾기
    const settings = [
      ...panel.querySelectorAll(
        'button, a, [role="button"]'
      )
    ].find(isSettingsButton);

    if (!settings) return;

    // 버튼 중복 생성 방지
    if (panel.querySelector('.guide-trigger')) {
      return;
    }

    const button = document.createElement('button');

    button.type = 'button';

    // 설정 버튼과 같은 디자인 적용
    button.className = settings.className;
    button.classList.add('guide-trigger');

    button.textContent = '설명서 📖';

    button.setAttribute(
      'aria-haspopup',
      'dialog'
    );

    button.setAttribute(
      'aria-controls',
      GUIDE_ID
    );

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      openGuide();
    });

    // 설정 버튼 바로 오른쪽에 추가
    settings.insertAdjacentElement(
      'afterend',
      button
    );
  }

  /* ========================================
     7. 설명서 기능 실행
  ======================================== */

  function init() {
    const panel = document.getElementById('panel');

    if (!panel) return;

    getOverlay();
    addGuideButton();

    // 홈 화면이 다시 만들어져도 버튼 유지
    new MutationObserver(addGuideButton).observe(
      panel,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
