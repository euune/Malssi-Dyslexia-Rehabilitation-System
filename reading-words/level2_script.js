
"use strict";

// ========================================
// 1. 학습 단어
// ========================================

const words = [
    {
        text: "야구공",
        image: "../images/baseball.jpg",
        emoji: "⚾"
    },
    {
        text: "소나무",
        image: "../images/pine_tree.jpg",
        emoji: "🌲"
    },
    {
        text: "눈사람",
        image: "../images/snowman.png",
        emoji: "⛄"
    }
];

// ========================================
// 2. 미리 등록한 간접 피드백 단어
// ========================================

const feedbackWords = {
    "야구공": {
        "야구장": {
            image: "../images/baseballground.jpg",
            emoji: "🏟️",
            meaning: "야구 경기를 하는 장소"
        },
        "야구": {
            image: "../images/baseballplay.jpg",
            emoji: "⚾",
            meaning: "공과 방망이로 하는 운동"
        }
    },

    "소나무": {
        "소나기": {
            image: "../images/rain_shower.jpg",
            emoji: "🌧️",
            meaning: "갑자기 내렸다가 그치는 비"
        },
        "나무": {
            image: "../images/tree.png",
            emoji: "🌳",
            meaning: "뿌리, 줄기, 가지가 있는 식물"
        }
    },

    "눈사람": {
        "눈": {
            image: "../images/snow.jpg",
            emoji: "❄️",
            meaning: "하늘에서 내리는 하얀 눈"
        },
        "사람": {
            image: "../images/person.jpg",
            emoji: "🧑",
            meaning: "우리처럼 말하고 생각하는 사람"
        }
    }
};

// ========================================
// 3. HTML 요소 가져오기
// ========================================

const $ = id => document.getElementById(id);

const wordText = $("wordText");
const wordImage = $("wordImage");
const wordEmoji = $("wordEmoji");

const micBtn = $("micBtn");
const listenBtn = $("listenBtn");
const nextBtn = $("nextBtn");
const prevBtn = $("prevBtn");

const result = $("result");

const feedbackCard = $("feedbackCard");
const feedbackImage = $("feedbackImage");
const feedbackEmoji = $("feedbackEmoji");
const feedbackWord = $("feedbackWord");
const feedbackExplanation = $("feedbackExplanation");

let currentIndex = 0;
let recognition = null;
let feedbackRequestId = 0;
let wordImageRequestId = 0;

const expState = {
    index: -1,
    tries: 0,
    done: false
};

// ========================================
// 4. 단어 정규화
// ========================================

function normalize(value) {
    return String(value).replace(
        /[^\p{L}\p{N}]/gu,
        ""
    );
}

// ========================================
// 5. 간접 피드백 초기화
// ========================================

function hideFeedback() {
    feedbackRequestId++;

    feedbackCard.hidden = true;
    feedbackImage.hidden = true;
    feedbackImage.removeAttribute("src");
    feedbackEmoji.hidden = false;
}

// ========================================
// 6. 간접 이미지 피드백
// ========================================

function showFeedback(target, spoken) {

    const info =
        feedbackWords[normalize(target)]?.[normalize(spoken)];

    if (!info) {
        hideFeedback();
        return false;
    }

    hideFeedback();

    const requestId = feedbackRequestId;

    feedbackCard.hidden = false;
    feedbackWord.textContent = normalize(spoken);
    feedbackExplanation.textContent = info.meaning;
    feedbackEmoji.textContent = info.emoji;

    const preload = new Image();

    preload.onload = () => {
        if (requestId !== feedbackRequestId) return;

        feedbackImage.src = info.image;
        feedbackImage.alt =
            normalize(spoken) + " 그림";

        feedbackImage.hidden = false;
        feedbackEmoji.hidden = true;
    };

    preload.onerror = () => {
        // 이미지가 없으면 이모지 유지
    };

    preload.src = info.image;

    return true;
}

// ========================================
// 7. 음성 인식 중단
// ========================================

function stopRecognition() {

    if (!recognition) return;

    const active = recognition;
    recognition = null;

    active.onresult = null;
    active.onerror = null;
    active.onend = null;

    try {
        active.abort();
    } catch (_) {
        // 이미 종료된 경우 무시
    }

    micBtn.disabled = false;
    listenBtn.disabled = false;
}

// ========================================
// 8. 씨앗 성장 EXP
// ========================================

function giveExp(matched, word) {

    if (!window.SG?.growth ||
        !window.SG?.engine) return;

    if (expState.index !== currentIndex) {
        expState.index = currentIndex;
        expState.tries = 0;
        expState.done = false;
    }

    if (expState.done) return;

    const EXP = SG.engine.CONFIG.exp;

    if (expState.tries < 2) {

        SG.growth.addExp(
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

        SG.growth.addExp(
            EXP.complete,
            {
                text: word,
                from: wordText,
                big: true
            }
        );
    }
}

// ========================================
// 9. 단어 화면 표시
// ========================================

function showWord() {

    hideFeedback();

    const word = words[currentIndex];
    const requestId = ++wordImageRequestId;

    wordText.textContent = word.text;

    wordImage.hidden = true;
    wordImage.removeAttribute("src");

    wordEmoji.textContent = word.emoji;
    wordEmoji.hidden = false;

    const preload = new Image();

    preload.onload = () => {

        if (requestId !== wordImageRequestId) return;

        wordImage.src = word.image;
        wordImage.alt = word.text + " 그림";

        wordImage.hidden = false;
        wordEmoji.hidden = true;
    };

    preload.onerror = () => {
        // 이미지가 없으면 이모지 표시
    };

    preload.src = word.image;

    // 학습 진행률
    $("progressText").textContent =
        `${currentIndex + 1}/${words.length}`;

    $("progressFill").style.width =
        `${(currentIndex + 1) / words.length * 100}%`;

    $("progressBar").setAttribute(
        "aria-valuemax",
        String(words.length)
    );

    $("progressBar").setAttribute(
        "aria-valuenow",
        String(currentIndex + 1)
    );

    prevBtn.disabled = currentIndex === 0;
    micBtn.disabled = false;
    listenBtn.disabled = false;

    nextBtn.textContent =
        currentIndex === words.length - 1
            ? "단어를 모두 획득했어! ✓"
            : "다음으로 넘어가볼까요? →";

    result.textContent =
        "이번엔 먼저 혼자 읽어볼까?";
}

// ========================================
// 10. 선택적 음성 힌트
// ========================================

function playHint() {

    if (!("speechSynthesis" in window)) {

        result.textContent =
            "이 브라우저에서는 음성 힌트를 사용할 수 없어요.";

        return;
    }

    stopRecognition();
    window.speechSynthesis.cancel();

    const index = currentIndex;

    const speech =
        new SpeechSynthesisUtterance(
            words[index].text
        );

    speech.lang = "ko-KR";
    speech.rate = 0.8;

    result.textContent =
        "씨앗의 목소리를 듣고 다시 읽어볼까?";

    listenBtn.disabled = true;

    speech.onend = () => {
        if (index === currentIndex) {
            listenBtn.disabled = false;
        }
    };

    speech.onerror = () => {

        if (index !== currentIndex) return;

        listenBtn.disabled = false;

        result.textContent =
            "힌트를 재생하지 못했어요. 다시 눌러볼까요?";
    };

    window.speechSynthesis.speak(speech);
}

// ========================================
// 11. 스스로 읽기 STT
// ========================================

function startReading() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        result.textContent =
            "이 브라우저에서는 음성 인식을 지원하지 않아요.";

        return;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
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

    result.textContent = "너의 소리를 듣고 있어!";

    micBtn.disabled = true;
    listenBtn.disabled = true;

    // 음성 인식 결과
    active.onresult = event => {

        if (
            recognition !== active ||
            index !== currentIndex
        ) return;

        const alternatives =
            Array.from(event.results[0]);

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
                `“${target}”라고 들렸어! 다음 단어도 읽어볼까?`;

        } else if (
            showFeedback(target, spoken)
        ) {

            result.textContent =
                `“${spoken}”라는 단어로 들렸어! 이런 뜻도 있구나. “${target}”도 다시 읽어줄래?`;

        } else {

            result.textContent =
                `“${spoken}”라고 들렸어. 다시 한 번 읽어볼까?`;
        }
    };

    // 음성 인식 오류
    active.onerror = event => {

        if (
            recognition !== active ||
            index !== currentIndex
        ) return;

        hideFeedback();

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            result.textContent =
                "마이크 사용을 허용해 주세요.";

        } else if (
            event.error === "no-speech"
        ) {

            result.textContent =
                "목소리가 잘 들리지 않았어요. 다시 읽어볼까요?";

        } else {

            result.textContent =
                "음성 인식이 원활하지 않아요. 다시 시도해 주세요.";
        }
    };

    active.onend = () => {

        if (recognition !== active) return;

        recognition = null;
        micBtn.disabled = false;
        listenBtn.disabled = false;
    };

    try {
        active.start();
    } catch (_) {

        recognition = null;
        micBtn.disabled = false;
        listenBtn.disabled = false;

        result.textContent =
            "마이크를 시작하지 못했어요. 다시 눌러주세요.";
    }
}

// ========================================
// 12. Level 2 학습 완료 화면
// ========================================

function showLevelComplete() {

    stopRecognition();
    hideFeedback();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    const page =
        document.querySelector(".rw-page");

    page.innerHTML = `
        <section class="rw-complete">

            <img
                src="../images/seed.png"
                alt="씨앗 캐릭터"
                class="rw-complete-seed"
            >

            <p class="rw-complete-label">
                🌿 단어 읽기 2단계 완료
            </p>

            <h1 class="rw-complete-title" tabindex="-1">
                단어를 모두 배웠어!
            </h1>

            <p class="rw-complete-message">
                씨앗이 2단계의 모든 단어를 배웠어요!
                <br>
                마지막 단계에도 도전해 볼까요?
            </p>

            <div class="rw-complete-actions">

                <a href="./level3.html"
                   class="rw-complete-home">
                    🌳 3단계로 넘어가기 →
                </a>

                <a href="./select-level.html"
                   class="rw-complete-select">
                    단계 다시 선택하기
                </a>

            </div>

        </section>
    `;

    page.querySelector(
        ".rw-complete-title"
    ).focus();
}

// ========================================
// 13. 다음 단어
// ========================================

function nextWord() {

    stopRecognition();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    currentIndex++;

    if (currentIndex >= words.length) {
        showLevelComplete();
    } else {
        showWord();
    }
}

// ========================================
// 14. 이전 단어
// ========================================

function previousWord() {

    if (currentIndex === 0) return;

    stopRecognition();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    currentIndex--;
    showWord();
}

// ========================================
// 15. 이벤트 연결 및 실행
// ========================================

micBtn.addEventListener("click", startReading);
listenBtn.addEventListener("click", playHint);
nextBtn.addEventListener("click", nextWord);
prevBtn.addEventListener("click", previousWord);

showWord();
