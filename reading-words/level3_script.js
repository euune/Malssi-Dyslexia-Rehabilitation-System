
"use strict";

// ========================================
// 1. 학습 단어 데이터
// ========================================

const words = [
    {
        text: "해바라기",
        image: "../images/sunflower.jpg",
    },
    {
        text: "바람개비",
        image: "../images/pinwheel.jpg",
    },
    {
        text: "고무장갑",
        image: "../images/rubber_gloves.jpg",
        emoji: "⛄"
    }
];

let currentIndex = 0;
let recognition = null;
let imageRequestId = 0;
let isMeaningRevealed = false;


// ========================================
// 2. HTML 요소 가져오기
// ========================================

const wordText = document.getElementById("wordText");
const wordImage = document.getElementById("wordImage");
const wordEmoji = document.getElementById("wordEmoji");

const meaningPanel = document.getElementById("meaningPanel");
const meaningText = document.getElementById("meaningText");
const guideText = document.getElementById("guideText");

const micBtn = document.getElementById("micBtn");
const revealBtn = document.getElementById("revealBtn");
const nextBtn = document.getElementById("nextBtn");

const result = document.getElementById("result");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const progressBar = document.getElementById("progressBar");


// 음성 인식 결과 비교를 위한 정규화
function normalize(text) {
    return text.replace(/[^\p{L}\p{N}]/gu, "");
}


// ========================================
// 3. 음성 인식 중단
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
// 4. 새로운 단어 표시
// ========================================

function showWord() {

    const word = words[currentIndex];

    // 이전 이미지 요청 무효화
    imageRequestId++;
    isMeaningRevealed = false;

    // 단어만 표시
    wordText.textContent = word.text;

    // 이미지 숨김
    wordImage.hidden = true;
    wordImage.removeAttribute("src");
    wordImage.alt = word.text + " 그림";

    wordEmoji.hidden = true;
    wordEmoji.textContent = "";

    meaningPanel.hidden = true;
    meaningText.textContent = "";

    // 버튼 초기화
    micBtn.disabled = false;
    revealBtn.disabled = false;
    revealBtn.textContent = "🖼️ 그림으로 뜻 확인해보자!";

    // 이미지를 보기 전에는 다음으로 이동 불가
    nextBtn.disabled = true;

    // 씨앗 말풍선
    result.textContent =
        "이번엔 그림 없이 혼자 읽어볼까?";

    guideText.textContent =
        "혼자 읽은 뒤 그림 확인 버튼을 눌러 뜻을 확인해보자 우리!.";

    // 진행률
    progressText.textContent =
        `${currentIndex + 1}/${words.length}`;

    progressFill.style.width =
        `${((currentIndex + 1) / words.length) * 100}%`;

    progressBar.setAttribute(
        "aria-valuemax",
        String(words.length)
    );

    progressBar.setAttribute(
        "aria-valuenow",
        String(currentIndex + 1)
    );

    // 마지막 단어의 버튼 문구 변경
    nextBtn.textContent =
        currentIndex === words.length - 1
            ? "씨앗이 단어를 모두 배웠어요! ✓"
            : "다음 단어로 넘어가볼까요? →";
}


// ========================================
// 5. 스스로 읽기 (STT)
// ========================================

function startReading() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    // 음성 인식 지원 확인
    if (!SpeechRecognition) {

        result.textContent =
            "음성 인식이 없는 브라우저예요. 직접 읽고 그림을 확인해 보세요!";

        return;
    }

    stopRecognition();

    // 음성 인식 객체 생성
    const active = new SpeechRecognition();
    recognition = active;

    active.lang = "ko-KR";
    active.interimResults = false;
    active.maxAlternatives = 3;

    const targetIndex = currentIndex;
    const targetWord = words[currentIndex].text;

    result.textContent = "읽는 소리를 듣고 있어요!";
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

        const alternatives =
            Array.from(event.results[0]);

        const spokenWord =
            alternatives[0].transcript.trim();

        const matched = alternatives.some(
            candidate =>
                normalize(candidate.transcript) ===
                normalize(targetWord)
        );

        // 간접적인 피드백 제공
        if (matched) {

            result.textContent =
                `“${targetWord}”라고 들렸어! 그림으로 뜻을 확인해 볼까?`;

        } else {

            result.textContent =
                `“${spokenWord}”라고 들렸어. 다시 읽거나 그림을 확인해 볼까?`;
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

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            result.textContent =
                "마이크 사용을 허용해 주세요. 직접 읽어도 좋아요!";

        } else if (event.error === "no-speech") {

            result.textContent =
                "소리가 잘 들리지 않았어. 다시 읽어볼까?";

        } else {

            result.textContent =
                "음성 인식이 원활하지 않아요. 직접 읽고 그림을 확인해 보세요!";
        }
    };

    // ====================================
    // 음성 인식 종료
    // ====================================

    active.onend = function () {

        if (recognition !== active) return;

        recognition = null;
        micBtn.disabled = false;
    };

    // ====================================
    // 마이크 시작
    // ====================================

    try {

        active.start();

    } catch (error) {

        recognition = null;
        micBtn.disabled = false;

        result.textContent =
            "마이크를 시작하지 못했어요. 직접 읽어도 좋아요!";
    }
}


// ========================================
// 6. 이미지로 의미 확인하기
// ========================================

function revealMeaning() {

    // 이미 확인한 경우 중복 실행 방지
    if (isMeaningRevealed) return;

    // 음성 인식 중단
    stopRecognition();

    isMeaningRevealed = true;

    const word = words[currentIndex];
    const targetIndex = currentIndex;
    const requestId = ++imageRequestId;

    // 숨겨진 그림 영역 표시
    meaningPanel.hidden = false;

    meaningText.textContent =
        `“${word.text}”의 모습이에요.`;

    // 씨앗 반응
    result.textContent =
        "그림을 보고 단어의 뜻을 생각해 볼까?";

    guideText.textContent =
        "단어와 그림을 비교해 보고 다음으로 넘어가 보세요.";

    // 버튼 상태 변경
    revealBtn.disabled = true;
    revealBtn.textContent = "🖼️ 그림 확인 완료";

    nextBtn.disabled = false;

    // 기본 이모지 표시
    wordEmoji.textContent = word.emoji;
    wordEmoji.hidden = false;
    wordImage.hidden = true;

    // 이미지 불러오기
    const preload = new Image();

    preload.onload = function () {

        // 다른 단어로 이동했다면 무시
        if (
            targetIndex !== currentIndex ||
            requestId !== imageRequestId
        ) {
            return;
        }

        wordImage.src = word.image;
        wordImage.hidden = false;
        wordEmoji.hidden = true;
    };

    // 이미지가 없는 경우 이모지 표시
    preload.onerror = function () {

        if (
            targetIndex !== currentIndex ||
            requestId !== imageRequestId
        ) {
            return;
        }

        wordImage.hidden = true;
        wordEmoji.hidden = false;
    };

    preload.src = word.image;
}


// ========================================
// 7. 다음 단어로 이동
// ========================================

function nextWord() {

    // 이미지를 확인하지 않았다면 이동 불가
    if (!isMeaningRevealed) return;

    stopRecognition();

    currentIndex++;

    // 모든 단어 학습 완료
    if (currentIndex >= words.length) {

        alert("3단계 단어를 씨앗이 모두 배웠어!");

        // 처음 단어부터 다시 시작
        currentIndex = 0;
    }

    showWord();
}


// ========================================
// 8. 버튼 이벤트 연결
// ========================================

// 사용자가 직접 읽기
micBtn.addEventListener("click", startReading);

// 이미지로 의미 확인
revealBtn.addEventListener("click", revealMeaning);

// 다음 단어
nextBtn.addEventListener("click", nextWord);


// ========================================
// 9. 첫 화면 실행
// ========================================

showWord();
