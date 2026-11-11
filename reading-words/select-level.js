
/* ========================================
   말씨 – 읽기 · 단어 단계 선택
======================================== */

(function () {
  'use strict';

  /* ========================================
     단계별 정보 및 이동 경로
  ======================================== */

 
const LEVELS = [
  {
    number: 1,
    title: '그림과 소리로 함께 읽기',
    description: '그림과 단어를 보고, 음성을 들은 뒤 따라 읽어요.',
    detail: '씨앗과 함께 차근차근 시작해 볼까?',
    href: './level1.html',
    icon: '🌱',
  },
  {
    number: 2,
    title: '스스로 읽고 힌트 받기',
    description: '그림과 단어를 먼저 읽고, 필요하면 음성 힌트를 들어요.',
    detail: '먼저 스스로 읽어 보고, 필요할 때 도움을 받아 봐!',
    href: './level2.html',
    icon: '🌿',
  },
  {
    number: 3,
    title: '단어를 읽고 그림 확인하기',
    description: '단어만 보고 읽은 뒤, 그림으로 의미를 확인해요.',
    detail: '이번엔 단어만 보고 읽는 데 도전해 볼까?',
    href: './level3.html',
    icon: '🌳',
  },
];



  /* ========================================
     기본 요소
  ======================================== */

  const app = document.getElementById('app');

  if (!app) return;


  /* ========================================
     단계 선택 화면 생성
  ======================================== */

  app.innerHTML = `

    <section class="screen level-screen">

      <!-- 상단 제목 -->

      <div class="act-head">

        <h1>단어 읽기</h1>

        <a class="garden-btn"
           href="../index.html">
          정원으로 🏡
        </a>

      </div>


      <div class="selection-shell">

        <!-- 씨앗 및 말풍선 -->

        <div class="seed-strip stage">

          <div class="seed-wrap">

            <svg
              id="seed"
              viewBox="0 0 200 200"
              role="img"
              aria-label="씨앗">
            </svg>

            <span
              id="seed-fallback"
              aria-hidden="true">
              🌱
            </span>

          </div>

          <div
            class="bubble show"
            id="bubble"
            aria-live="polite">

            어떤 방법으로 단어를 읽어 볼까?
            원하는 단계를 골라 줘!

          </div>

        </div>


        <!-- 단계 선택 영역 -->

        <div class="level-body">

          <h2>읽기 단계 선택</h2>

          <p class="intro">
            원하는 단계부터 시작할 수 있어요.
          </p>


          <nav
            class="level-list"
            aria-label="단어 읽기 단계 선택">

            ${LEVELS.map((level) => `

              <a
                class="level-card"

                href="${level.href}"

                data-level="${level.number}"

                aria-label="${level.number}단계,
                            ${level.title} 시작하기">


                <!-- 단계 번호 -->

                <span class="level-number">
                  ${level.number}
                </span>


                <!-- 단계 설명 -->

                <span class="level-meta">

                  <span class="level-title">
                    ${level.number}단계 · ${level.title}
                  </span>

                  <span class="level-description">
                    ${level.description}
                  </span>

                  <span class="level-action">
                    읽으러 가기
                  </span>

                </span>


                <!-- 화살표 -->

                <span
                  class="level-arrow"
                  aria-hidden="true">
                  →
                </span>

              </a>

            `).join('')}

          </nav>


          <!-- 하단 안내 -->

          <p class="footnote">
            단계를 바꾸고 싶을 땐
            이 화면으로 돌아오면 돼요.
          </p>

        </div>

      </div>

    </section>

  `;


  /* ========================================
     씨앗 캐릭터 및 성장 상태 연결
  ======================================== */

  const bubble = document.getElementById('bubble');

  const defaultText =
    '어떤 방법으로 단어를 읽어 볼까? 원하는 단계를 골라 줘!';

  const sg = window.SG;


  // 기존 공통 모듈이 있으면 씨앗과 성장 상태 표시

  if (
    sg &&
    sg.growth &&
    typeof sg.growth.update === 'function'
  ) {

    try {

      // 씨앗 성장 상태 업데이트
      sg.growth.update(true);

      // 대체 씨앗 숨기기
      document.getElementById(
        'seed-fallback'
      ).hidden = true;

      // 씨앗 애니메이션
      if (
        sg.seed &&
        typeof sg.seed.react === 'function'
      ) {

        sg.seed.react('nod');

      }

    } catch (error) {

      console.warn(
        '씨앗 공통 모듈을 표시하지 못했습니다.',
        error
      );

    }

  }


  /* ========================================
     각 단계에 마우스를 올렸을 때
     씨앗 말풍선 변경
  ======================================== */

  document.querySelectorAll(
    '.level-card'
  ).forEach((card) => {

    const level = LEVELS.find(
      (item) =>
        item.number === Number(card.dataset.level)
    );

    if (!level) return;


    // 해당 단계 설명 출력

    const showDetail = () => {

      bubble.textContent = level.detail;

      // 씨앗 반응
      if (
        sg &&
        sg.seed &&
        typeof sg.seed.react === 'function'
      ) {

        sg.seed.react('nod');

      }

    };


    // 기본 말풍선으로 복귀

    const resetDetail = () => {

      bubble.textContent = defaultText;

    };


    // 마우스 올렸을 때
    card.addEventListener(
      'mouseenter',
      showDetail
    );

    // 키보드로 선택했을 때
    card.addEventListener(
      'focus',
      showDetail
    );

    // 마우스가 벗어났을 때
    card.addEventListener(
      'mouseleave',
      resetDetail
    );

    // 선택 해제
    card.addEventListener(
      'blur',
      resetDetail
    );

  });

})();
