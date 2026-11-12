
/* ==========================================
   말씨 - 단어 읽기 LEVEL 3
   간접 이미지 피드백 + 버튼 오류 수정
========================================== */

(() => {
    "use strict";

    // ======================================
    // 1. 학습 단어
    // ======================================

    const words = [
        {
            text: "해바라기",
            image: "../images/sunflower.jpg",
            emoji: "🌻"
        },
        {
            text: "바람개비",
            image: "../images/pinwheel.jpg",
            emoji: "🌀"
        },
        {
            text: "고무장갑",
            image: "../images/rubber_gloves.jpg",
            emoji: "🧤"
        }
    ];

    // ======================================
    // 2. 간접 피드백 단어
    // ======================================

    const feedbackWords = {
        "해바라기": {
            "해": {
                image: "../images/sun.jpg",
                emoji: "☀️",
                meaning: "낮에 하늘을 밝게 비추는 태양"
            },
            "해바라기씨": {
                image: "../images/sunflower_seeds.jpg",
                emoji: "🌻",
                meaning: "해바라기 꽃에서 얻는 씨앗"
            }
        },

        "바람개비": {
            "바람": {
                image: "../images/wind.png",
                emoji: "💨",
                meaning: "공기가 움직이며 생기는 바람"
            }
        },

        "고무장갑": {
            "장갑": {
                image: "../images/gloves.jpg",
                emoji: "🧤",
                meaning: "손을 보호하거나 따뜻하게 하는 물건"
            },
            "고무": {
                image: "../images/rubber.jpg",
                emoji: "🛞",
                meaning: "잘 늘어나고 탄력이 있는 재료"
            }
        }
    };

    // ======================================
    // 3. HTML 요소 연결
    // ======================================

    const get = id => document.getElementById(id);

    const wordText = get("wordText");
    const wordImage = get("wordImage");
    const wordEmoji = get("wordEmoji");

    const meaningPanel = get("meaningPanel");
    const meaningText = get("meaningText");
    const guideText = get("guideText");

    const micBtn = get("micBtn");
    const revealBtn = get("revealBtn");
    const nextBtn = get("nextBtn");
    const prevBtn = get("prevBtn");

    const result = get("result");

    const progressText = get("progressText");
    const progressFill = get("progressFill");
    const progressBar = get("progressBar");

    // ======================================
    // 4. 피드백 카드 자동 생성
    // ======================================

    function ensureFeedbackCard() {

        let card = get("feedbackCard");

        if (card) return card;

        const wordArea =
            document.querySelector(
                ".rw-card .word-area"
            );

        if (!wordArea) return null;

        card = document.createElement("section");

        card.id = "feedbackCard";
        card.className = "rw-feedback-card";
        card.hidden = true;

        card.setAttribute(
            "aria-label",
            "새로운 단어 발견"
        );

        card.innerHTML = `
            <p class="rw-feedback-label">
                🌼 새로운 단어 발견!
            </p>

            <div class="rw-feedback-body">

                <div class="rw-feedback-visual">
                    <img id="feedbackImage"
                         alt=""
                         hidden>

                    <span id="feedbackEmoji"
                          aria-hidden="true"></span>
                </div>

                <div class="rw-feedback-info">

                    <strong id="feedbackWord"
                            class="rw-feedback-word">
                    </strong>

                    <p id="feedbackExplanation"
                       class="rw-feedback-explanation">
                    </p>

                </div>
            </div>

            <p class="rw-feedback-note">
                다른 단어도 발견했네!
                처음 단어를 다시 읽어볼까?
            </p>
        `;

        wordArea.insertAdjacentElement(
            "afterend",
            card
        );

        return card;
    }

    const feedbackCard = ensureFeedbackCard();
    const feedbackImage = get("feedbackImage");
    const feedbackEmoji = get("feedbackEmoji");
    const feedbackWord = get("feedbackWord");
    const feedbackExplanation =
        get("feedbackExplanation");

    // ======================================
    // 5. 상태 변수
    // ======================================

    let currentIndex = 0;
    let recognition = null;

    let imageRequestId = 0;
    let feedbackRequestId = 0;

    let isMeaningRevealed = false;

    const expState = {
        index: -1,
        tries: 0,
        done: false
    };

    // ======================================
    // 6. 단어 정규화
    // ======================================

    function normalize(text) {
        return String(text).replace(
            /[^\p{L}\p{N}]/gu,
            ""
        );
    }

    // ======================================
    // 7. 간접 피드백 숨기기
    // ======================================

    function hideFeedback() {

        feedbackRequestId++;

        // HTML 요소가 없어도 오류 방지
        if (!feedbackCard) return;

        feedbackCard.hidden = true;

        if (feedbackImage) {
            feedbackImage.hidden = true;
            feedbackImage.removeAttribute("src");
        }

        if (feedbackEmoji) {
            feedbackEmoji.hidden = false;
        }
    }

    // ======================================
    // 8. 간접 이미지 피드백 표시
    // ======================================

    function showFeedback(targetWord, spokenWord) {

        const word = normalize(targetWord);
        const recognized = normalize(spokenWord);

        const info =
            feedbackWords[word] &&
            feedbackWords[word][recognized];

        if (
            !info ||
            !feedbackCard ||
            !feedbackWord ||
            !feedbackExplanation
        ) {
            hideFeedback();
            return false;
        }

        hideFeedback();

        const requestId = feedbackRequestId;
        const index = currentIndex;

        feedbackWord.textContent = recognized;

        feedbackExplanation.textContent =
            info.meaning;

        if (feedbackEmoji) {
            feedbackEmoji.textContent = info.emoji;
            feedbackEmoji.hidden = false;
        }

        feedbackCard.hidden = false;

        // 이미지 로딩
        if (feedbackImage && info.image) {

            const preload = new Image();

            preload.onload = () => {

                if (
                    requestId !== feedbackRequestId ||
                    index !== currentIndex
                ) {
                    return;
                }

                feedbackImage.src = info.image;
                feedbackImage.alt =
                    recognized + " 그림";

                feedbackImage.hidden = false;

                if (feedbackEmoji) {
                    feedbackEmoji.hidden = true;
                }
            };

            preload.onerror = () => {
                // 이미지가 없으면 이모지 유지
            };

            preload.src = info.image;
        }

        return true;
    }

    // ======================================
    // 9. 음성 인식 종료
    // ======================================

    function stopRecognition() {

        if (!recognition) return;

        const active = recognition;

        recognition = null;

        active.onresult = null;
        active.onerror = null;
        active.onend = null;

        try {
            active.abort();
        } catch (error) {
            // 이미 종료된 경우 무시
        }

        micBtn.disabled = false;
    }

    // ======================================
    // 10. 씨앗 성장 EXP
    // ======================================

    function giveExp(matched, word) {

        if (
            !window.SG ||
            !window.SG.growth ||
            !window.SG.engine
        ) {
            return;
        }

        if (expState.index !== currentIndex) {

            expState.index = currentIndex;
            expState.tries = 0;
            expState.done = false;
        }

        if (expState.done) return;

        const EXP = window.SG.engine.CONFIG.exp;

        if (expState.tries < 2) {

            window.SG.growth.addExp(
                expState.tries === 0
                    ? EXP.firstTry
                    : EXP.retry,
                {
                    text: "✨",
                    from: wordText
                }
            );

            expState.tries++;
        }

        if (matched) {

            expState.done = true;

            window.SG.growth.addExp(
                EXP.complete,
                {
                    text: word,
                    from: wordText,
                    big: true
                }
            );
        }
    }

    // ======================================
    // 11. 학습 단어 표시
    // ======================================

    function showWord() {

        hideFeedback();

        imageRequestId++;
        isMeaningRevealed = false;

        const word = words[currentIndex];

        // 처음에는 단어만 표시
        wordText.textContent = word.text;

        wordImage.hidden = true;
        wordImage.removeAttribute("src");

        wordEmoji.hidden = true;
        wordEmoji.textContent = "";

        meaningPanel.hidden = true;
        meaningText.textContent = "";

        // 버튼 초기화
        micBtn.disabled = false;
        revealBtn.disabled = false;

        revealBtn.textContent =
            "🖼️ 그림으로 뜻 확인하기";

        // 그림 확인 전에는 다음 이동 불가
        nextBtn.disabled = true;

        nextBtn.textContent =
            currentIndex === words.length - 1
                ? "씨앗이 단어를 모두 배웠어요! ✓"
                : "다음으로 넘어가볼까요? →";

        result.textContent =
            "이번엔 그림 없이 혼자 읽어볼까?";

        guideText.textContent =
            "혼자 읽은 뒤 그림 확인 버튼을 눌러 뜻을 확인해 보세요.";

        // 진행률
        progressText.textContent =
            `${currentIndex + 1}/${words.length}`;

        progressFill.style.width =
            `${(currentIndex + 1) / words.length * 100}%`;

        progressBar.setAttribute(
            "aria-valuemax",
            String(words.length)
        );

        progressBar.setAttribute(
            "aria-valuenow",
            String(currentIndex + 1)
        );

        if (prevBtn) {
            prevBtn.disabled = currentIndex === 0;
        }
    }

    // ======================================
    // 12. 직접 읽기 STT
    // ======================================

    function startReading() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {

            result.textContent =
                "음성 인식을 지원하지 않아요. 직접 읽고 그림을 확인해 보세요!";

            return;
        }

        stopRecognition();
        hideFeedback();

        const active = new SpeechRecognition();

        recognition = active;

        active.lang = "ko-KR";
        active.interimResults = false;
        active.maxAlternatives = 3;

        const index = currentIndex;
        const target = words[index].text;

        result.textContent =
            "읽는 소리를 듣고 있어요!";

        micBtn.disabled = true;

        // 음성 인식 결과
        active.onresult = event => {

            if (
                recognition !== active ||
                index !== currentIndex
            ) {
                return;
            }

            const alternatives =
                Array.from(event.results[0]);

            if (alternatives.length === 0) {
                return;
            }

            const spoken =
                alternatives[0].transcript.trim();

            const matched = alternatives.some(
                item =>
                    normalize(item.transcript) ===
                    normalize(target)
            );

            giveExp(matched, target);

            if (matched) {

                hideFeedback();

                result.textContent =
                    `“${target}”라고 들렸어! 그림으로 뜻을 확인해 볼까?`;

            } else if (
                showFeedback(target, spoken)
            ) {

                result.textContent =
                    `“${spoken}”라는 단어로 들렸어! “${target}”도 다시 읽어볼까?`;

            } else {

                result.textContent =
                    `“${spoken}”라고 들렸어. 다시 읽거나 그림을 확인해 볼까?`;
            }
        };

        // 음성 인식 오류
        active.onerror = event => {

            if (
                recognition !== active ||
                index !== currentIndex
            ) {
                return;
            }

            hideFeedback();

            if (
                event.error === "not-allowed" ||
                event.error === "service-not-allowed"
            ) {

                result.textContent =
                    "마이크 사용을 허용해 주세요. 직접 읽어도 좋아요!";

            } else if (
                event.error === "no-speech"
            ) {

                result.textContent =
                    "소리가 잘 들리지 않았어. 다시 읽어볼까?";

            } else {

                result.textContent =
                    "음성 인식이 원활하지 않아요. 직접 읽고 그림을 확인해 보세요!";
            }
        };

        // 음성 인식 종료
        active.onend = () => {

            if (recognition !== active) return;

            recognition = null;
            micBtn.disabled = false;
        };

        try {
            active.start();

        } catch (error) {

            recognition = null;
            micBtn.disabled = false;

            result.textContent =
                "마이크를 시작하지 못했어요. 직접 읽어도 좋아요!";
        }
    }

    // ======================================
    // 13. 그림으로 뜻 확인하기
    // ======================================

    function revealMeaning() {

        if (isMeaningRevealed) return;

        stopRecognition();
        hideFeedback();

        isMeaningRevealed = true;

        const word = words[currentIndex];
        const index = currentIndex;
        const requestId = ++imageRequestId;

        // 목표 단어 이미지 영역 표시
        meaningPanel.hidden = false;

        meaningText.textContent =
            `“${word.text}”의 모습이에요.`;

        result.textContent =
            "그림을 보고 단어의 뜻을 생각해 볼까?";

        guideText.textContent =
            "단어와 그림을 비교해 보고 다음으로 넘어가 보세요.";

        // 버튼 변경
        revealBtn.disabled = true;
        revealBtn.textContent =
            "🖼️ 그림 확인 완료";

        nextBtn.disabled = false;

        // 이미지 기본값
        wordImage.hidden = true;

        wordEmoji.textContent = word.emoji;
        wordEmoji.hidden = false;

        const preload = new Image();

        preload.onload = () => {

            if (
                index !== currentIndex ||
                requestId !== imageRequestId
            ) {
                return;
            }

            wordImage.src = word.image;
            wordImage.alt =
                word.text + " 그림";

            wordImage.hidden = false;
            wordEmoji.hidden = true;
        };

        preload.onerror = () => {
            // 이미지가 없으면 이모지 표시
        };

        preload.src = word.image;
    }

    // ======================================
    // 14. 학습 완료 화면
    // ======================================

    function showLevelComplete() {

        stopRecognition();
        hideFeedback();

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        const page =
            document.querySelector(".rw-page");

        if (!page) return;

        page.innerHTML = `
            <section class="rw-complete">

                <img src="../images/seed.png"
                     alt="씨앗 캐릭터"
                     class="rw-complete-seed">

                <p class="rw-complete-label">
                    🌱 단어 읽기 3단계 완료
                </p>

                <h1 class="rw-complete-title"
                    tabindex="-1">
                    단어를 모두 배웠어!
                </h1>

                <p class="rw-complete-message">
                    씨앗이 모든 단어를 배웠어요!
                    <br>
                    함께 읽어 줘서 고마워요.
                </p>

                <div class="rw-complete-actions">

                    <a href="../index.html"
                       class="rw-complete-home">
                        🏡 정원으로 돌아가기
                    </a>

                    <a href="./select-level.html"
                       class="rw-complete-select">
                        단계 다시 선택하기
                    </a>

                </div>
            </section>
        `;

        const title =
            page.querySelector(".rw-complete-title");

        if (title) title.focus();
    }

    // ======================================
    // 15. 다음 문제
    // ======================================

    function nextWord() {

        if (!isMeaningRevealed) return;

        stopRecognition();

        currentIndex++;

        if (currentIndex >= words.length) {

            showLevelComplete();

        } else {

            showWord();
        }
    }

    // ======================================
    // 16. 이전 문제
    // ======================================

    function previousWord() {

        if (currentIndex <= 0) return;

        stopRecognition();

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        currentIndex--;

        showWord();
    }

    // ======================================
    // 17. 버튼 이벤트 연결
    // ======================================

    if (micBtn) {
        micBtn.addEventListener(
            "click",
            startReading
        );
    }

    if (revealBtn) {
        revealBtn.addEventListener(
            "click",
            revealMeaning
        );
    }

    if (nextBtn) {
        nextBtn.addEventListener(
            "click",
            nextWord
        );
    }

    if (prevBtn) {
        prevBtn.addEventListener(
            "click",
            previousWord
        );
    }

    // ======================================
    // 18. 초기 실행
    // ======================================

    if (
        wordText &&
        wordImage &&
        wordEmoji &&
        meaningPanel &&
        meaningText &&
        guideText &&
        micBtn &&
        revealBtn &&
        nextBtn &&
        result &&
        progressText &&
        progressFill &&
        progressBar
    ) {

        showWord();

    } else {

        console.error(
            "Level 3: HTML 요소가 누락되었습니다."
        );
    }

})();
