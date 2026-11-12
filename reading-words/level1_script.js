
"use strict";

// ========================================
// 1. Level 1 학습 단어
// ========================================

const words = [
    {
        text: "발",
        image: "../images/foot.jpg",
        emoji: "🦶"
    },
    {
        text: "사과",
        image: "../images/apple.jpg",
        emoji: "🍎"
    },
    {
        text: "나비",
        image: "../images/butterfly.jpg",
        emoji: "🦋"
    }
];

// ========================================
// 2. 간접 시각 피드백 단어 사전
// ========================================
// 목표 단어 -> 다른 단어 -> 그림과 의미
// 이미지 파일이 없다면 이모지로 대체됩니다.

const feedbackWords = {
    "발": {
        "벌": {
            image: "../images/bee.jpg",
            emoji: "🐝",
            meaning: "꽃 사이를 날아다니는 곤충"
        },
        "밤": {
            image: "../images/chestnut.jpg",
            emoji: "🌰",
            meaning: "먹을 수 있는 나무 열매"
        },
        "밥": {
            image: "../images/rice.jpg",
            emoji: "🍚",
            meaning: "쌀을 익혀 만든 음식"
        }
    },

    "사과": {
        "사자": {
            image: "../images/lion.jpg",
            emoji: "🦁",
            meaning: "갈기가 있는 커다란 동물"
        }
    },

    "나비": {
        "나무": {
            image: "../images/tree.jpg",
            emoji: "🌳",
            meaning: "뿌리와 줄기, 가지가 있는 식물"
        }
    }
};

let currentIndex = 0;
let recognition = null;
let feedbackRequestId = 0;

// ========================================
// 3. HTML 요소
// ========================================

const wordText =
    document.getElementById("wordText");

const wordImage =
    document.getElementById("wordImage");

const wordEmoji =
    document.getElementById("wordEmoji");

const listenBtn =
    document.getElementById("listenBtn");

const micBtn =
    document.getElementById("micBtn");

const nextBtn =
    document.getElementById("nextBtn");

const result =
    document.getElementById("result");

const progressText =
    document.getElementById("progressText");

const progressFill =
    document.getElementById("progressFill");

const progressBar =
    document.getElementById("progressBar");

const gardenButterfly =
    document.getElementById("gardenButterfly");

const prevBtn =
    document.getElementById("prevBtn");

// 새 피드백 요소
const feedbackCard =
    document.getElementById("feedbackCard");

const feedbackImage =
    document.getElementById("feedbackImage");

const feedbackEmoji =
    document.getElementById("feedbackEmoji");

const feedbackWord =
    document.getElementById("feedbackWord");

const feedbackExplanation =
    document.getElementById("feedbackExplanation");

// ========================================
// 4. 단어 정규화
// ========================================

function normalize(text) {
    return String(text).replace(
        /[^\p{L}\p{N}]/gu,
        ""
    );
}

// ========================================
// 5. 간접 피드백 초기화
// ========================================

function hideFeedback() {
    feedbackRequestId += 1;

    feedbackCard.hidden = true;
    feedbackImage.hidden = true;
    feedbackImage.removeAttribute("src");
    feedbackEmoji.hidden = false;
}

// ========================================
// 6. 간접 이미지 피드백 표시
// ========================================

function showFeedback(targetWord, spokenWord) {
    const alternatives =
        feedbackWords[normalize(targetWord)];

    const info =
        alternatives &&
        alternatives[normalize(spokenWord)];

    // 등록되지 않은 단어는 표시하지 않음
    if (!info) {
        hideFeedback();
        return false;
    }

    hideFeedback();

    const requestId = feedbackRequestId;
    const wordIndex = currentIndex;

    // 단어와 설명 표시
    feedbackWord.textContent =
        normalize(spokenWord);

    feedbackExplanation.textContent =
        info.meaning;

    // 이미지가 없을 때 표시할 이모지
    feedbackEmoji.textContent = info.emoji;
    feedbackEmoji.hidden = false;

    feedbackCard.hidden = false;

    // 등록된 이미지 파일 확인
    if (info.image) {
        const preload = new Image();

        preload.onload = function () {
            // 이미 다음 단어로 넘어갔다면 무시
            if (
                requestId !== feedbackRequestId ||
                wordIndex !== currentIndex
            ) {
                return;
            }

            feedbackImage.src = info.image;
            feedbackImage.alt =
                normalize(spokenWord) + " 그림";

            feedbackImage.hidden = false;
            feedbackEmoji.hidden = true;
        };

        preload.onerror = function () {
            // 이미지가 없으면 이모지를 유지
        };

        preload.src = info.image;
    }

    return true;
}

// ========================================
// 7. 기존 음성 인식 중단
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
    } catch (error) {
        // 이미 종료된 경우 무시
    }

    micBtn.disabled = false;
}

// ========================================
// 8. 기존 씨앗 성장 EXP
// ========================================

const expState = {
    index: -1,
    tries: 0,
    done: false
};

function giveExp(matched, word) {
    if (
        !window.SG ||
        !SG.growth ||
        !SG.engine
    ) {
        return;
    }

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
// 9. 이전 문제 버튼 상태
// ========================================

function updatePrevButton() {
    if (!prevBtn) return;

    prevBtn.disabled = (currentIndex === 0);
}

// ========================================
// 10. 현재 학습 단어 표시
// ========================================

function showWord() {
    updatePrevButton();

    // 다른 문제로 이동하면 피드백 초기화
    hideFeedback();

    const word = words[currentIndex];
    const targetIndex = currentIndex;

    wordText.textContent = word.text;

    // 기존 단어 이미지
    wordImage.hidden = true;
    wordImage.removeAttribute("src");
    wordImage.alt = word.text + " 그림";

    wordEmoji.textContent = word.emoji;
    wordEmoji.hidden = false;

    const preload = new Image();

    preload.onload = function () {
        if (targetIndex !== currentIndex) {
            return;
        }

        wordImage.src = word.image;
        wordImage.hidden = false;
        wordEmoji.hidden = true;
    };

    preload.onerror = function () {
        if (targetIndex !== currentIndex) {
            return;
        }

        wordImage.hidden = true;
        wordEmoji.hidden = false;
    };

    preload.src = word.image;

    // 진행률 업데이트
    progressText.textContent =
        `${currentIndex + 1}/${words.length}`;

    const progressPercent =
        ((currentIndex + 1) / words.length) * 100;

    progressFill.style.width =
        `${progressPercent}%`;

    progressBar.setAttribute(
        "aria-valuemax",
        String(words.length)
    );

    progressBar.setAttribute(
        "aria-valuenow",
        String(currentIndex + 1)
    );

    // 나비 위치 업데이트
    const ratio =
        words.length > 1
            ? currentIndex / (words.length - 1)
            : 0;

    if (gardenButterfly) {
        gardenButterfly.style.left =
            `${5 + ratio * 90}%`;
    }

    result.textContent =
        "단어를 들려줘!!";
}

// ========================================
// 11. 단어 듣기 TTS
// ========================================

function playSound() {
    if (!("speechSynthesis" in window)) {
        result.textContent =
            "음성 재생을 지원하지 않는 브라우저예요.";
        return;
    }

    stopRecognition();

    window.speechSynthesis.cancel();

    const speech =
        new SpeechSynthesisUtterance(
            words[currentIndex].text
        );

    speech.lang = "ko-KR";
    speech.rate = 0.8;

    window.speechSynthesis.speak(speech);
}

// ========================================
// 12. 직접 읽기 STT
// ========================================

function startReading() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        result.textContent =
            "음성 인식을 지원하지 않는 브라우저예요.";
        return;
    }

    // 기존 음성 재생 종료
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    stopRecognition();
    hideFeedback();

    // 음성 인식 객체
    const active = new SpeechRecognition();

    recognition = active;

    active.lang = "ko-KR";
    active.interimResults = false;
    active.maxAlternatives = 1;

    const targetIndex = currentIndex;
    const targetWord = words[currentIndex].text;

    result.textContent = "말씀해 주세요!";
    micBtn.disabled = true;

    // ====================================
    // 음성 인식 결과
    // ====================================

    active.onresult = function (event) {
        if (
            recognition !== active ||
            targetIndex !== currentIndex
        ) {
            return;
        }

        const spokenWord =
            event.results[0][0].transcript.trim();

        const matched =
            normalize(spokenWord) ===
            normalize(targetWord);

        // 기존 EXP 지급
        giveExp(matched, targetWord);

        // 1. 목표 단어와 일치
        if (matched) {
            hideFeedback();

            result.textContent =
                `“${spokenWord}”라고 들렸어! 다음 단어도 읽어볼까?`;
        }

        // 2. 등록된 다른 단어 인식
        else if (
            showFeedback(targetWord, spokenWord)
        ) {
            result.textContent =
                `“${spokenWord}”라는 단어로 들렸어! 이런 뜻도 있구나. “${targetWord}”도 다시 읽어줄래?`;
        }

        // 3. 등록되지 않은 다른 단어
        else {
            hideFeedback();

            result.textContent =
                `“${spokenWord}”라고 들렸어. 다시 한 번 읽어볼까?`;
        }
    };

    // ====================================
    // 음성 인식 오류
    // ====================================

    active.onerror = function (event) {
        if (
            recognition !== active ||
            targetIndex !== currentIndex
        ) {
            return;
        }

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
                "목소리가 잘 들리지 않았어. 다시 읽어볼까?";
        } else {
            result.textContent =
                "음성 인식이 원활하지 않아요. 다시 시도해 주세요.";
        }
    };

    // ====================================
    // 음성 인식 종료
    // ====================================

    active.onend = function () {
        if (recognition !== active) {
            return;
        }

        recognition = null;
        micBtn.disabled = false;
    };

    try {
        active.start();
    } catch (error) {
        recognition = null;
        micBtn.disabled = false;

        result.textContent =
            "마이크를 시작할 수 없어요.";
    }
}

// ========================================
// 13. Level 1 학습 완료 화면
// ========================================

function showLevelComplete() {
    stopRecognition();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    const page =
        document.querySelector(".rw-page");

    if (!page) return;

    page.innerHTML = `
        <section class="rw-complete">

            <img
                src="../images/seed.png"
                alt="씨앗 캐릭터"
                class="rw-complete-seed"
            >

            <p class="rw-complete-label">
                🌱 단어 읽기 1단계 완료
            </p>

            <h1
                class="rw-complete-title"
                tabindex="-1">
                단어를 모두 배웠어!
            </h1>

            <p class="rw-complete-message">
                씨앗이 1단계의 모든 단어를 배웠어요!
                <br>
                이제 다음 단계로 넘어가 볼까요?
            </p>

            <div class="rw-complete-actions">

                <a
                    href="./level2.html"
                    class="rw-complete-home">
                    🌿 2단계로 넘어가기 →
                </a>

                <a
                    href="./select-level.html"
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
// 14. 다음 단어로 이동
// ========================================

function nextWord() {
    stopRecognition();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    currentIndex++;

    if (currentIndex >= words.length) {
        showLevelComplete();
        return;
    }

    showWord();
}

// ========================================
// 15. 이전 단어로 이동
// ========================================

function previousWord() {
    if (currentIndex <= 0) {
        return;
    }

    stopRecognition();

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    currentIndex--;

    showWord();

    micBtn.disabled = false;
    listenBtn.disabled = false;
}

// ========================================
// 16. 버튼 이벤트 연결
// ========================================

listenBtn.addEventListener(
    "click",
    playSound
);

micBtn.addEventListener(
    "click",
    startReading
);

nextBtn.addEventListener(
    "click",
    nextWord
);

if (prevBtn) {
    prevBtn.addEventListener(
        "click",
        previousWord
    );
}

// ========================================
// 17. 첫 화면 실행
// ========================================

showWord();
