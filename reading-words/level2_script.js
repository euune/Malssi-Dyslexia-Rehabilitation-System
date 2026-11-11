
"use strict";

// ========================================
// 1. 학습 단어 데이터
// ========================================

const words = [
    {
        text: "야구공",
        image: "../images/baseball.jpg",
    },
    {
        text: "소나무",
        image: "../images/pine_tree.jpg",
    },
    {
        text: "눈사람",
        image: "../images/snowman.png",
    }
];

let currentIndex = 0;
let recognition = null;


// ========================================
// 2. HTML 요소 가져오기
// ========================================

const wordText = document.getElementById("wordText");
const wordImage = document.getElementById("wordImage");
const wordEmoji = document.getElementById("wordEmoji");

const listenBtn = document.getElementById("listenBtn");
const micBtn = document.getElementById("micBtn");
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
    listenBtn.disabled = false;
}


// ========================================
// 4. 단어 표시 함수
// ========================================

// ========================================
// 씨앗 성장 (공통 js/growth.js · 처음 화면·동화 읽기와 같은 경험치)
//  - 처음 읽어 보기 +1, 다시 읽기 +1 (낱말마다 2번까지), 맞게 읽으면 +2 (낱말마다 한 번)
//  - 경험치를 받으면 상단 씨앗 성장 게이지가 차오르고, 단계가 오르면 축하 창이 떠요
// ========================================

const expState = { index: -1, tries: 0, done: false };

function giveExp(matched, word) {
    if (!window.SG || !SG.growth || !SG.engine) return;
    if (expState.index !== currentIndex) {
        expState.index = currentIndex;
        expState.tries = 0;
        expState.done = false;
    }
    if (expState.done) return;
    const EXP = SG.engine.CONFIG.exp;
    if (expState.tries < 2) {
        SG.growth.addExp(expState.tries === 0 ? EXP.firstTry : EXP.retry, { text: "✨", from: wordText });
        expState.tries++;
    }
    if (matched) {
        expState.done = true;
        SG.growth.addExp(EXP.complete, { text: word, from: wordText, big: true });
    }
}


function showWord() {
    updatePrevButton();

    const word = words[currentIndex];
    const targetIndex = currentIndex;

    // 단어 표시
    wordText.textContent = word.text;

    // 이미지 초기화
    wordImage.hidden = true;
    wordImage.removeAttribute("src");
    wordImage.alt = word.text + " 그림";

    // 기본 이모지 표시
    wordEmoji.textContent = word.emoji;
    wordEmoji.hidden = false;

    // 이미지가 있으면 실제 이미지 표시
    const preload = new Image();

    preload.onload = function () {

        if (targetIndex !== currentIndex) return;

        wordImage.src = word.image;
        wordImage.hidden = false;
        wordEmoji.hidden = true;
    };

    // 이미지가 없으면 이모지 유지
    preload.onerror = function () {

        if (targetIndex !== currentIndex) return;

        wordImage.hidden = true;
        wordEmoji.hidden = false;
    };

    preload.src = word.image;


    // 진행률 업데이트
    progressText.textContent =
        `${currentIndex + 1}/${words.length}`;

    progressFill.style.width =
        `${(currentIndex + 1) / words.length * 100}%`;

    progressBar.setAttribute(
        "aria-valuemax",
        words.length
    );

    progressBar.setAttribute(
        "aria-valuenow",
        currentIndex + 1
    );


    // 말풍선 초기화
    result.textContent =
        "이번엔 먼저 혼자 읽어볼까?";


    // 마지막 단어에서 버튼 문구 변경
    nextBtn.textContent =
        currentIndex === words.length - 1
            ? "단어를 모두 획득했어! ✓"
            : "다음으로 넘어가볼까요? →";
}


// ========================================
// 5. 선택적 음성 힌트 (TTS)
// ========================================

function playHint() {

    // 브라우저 음성 합성 지원 확인
    if (!("speechSynthesis" in window)) {

        result.textContent =
            "이 브라우저에서는 음성 힌트를 사용할 수 없어요.";

        return;
    }

    // 마이크 음성 인식 중단
    stopRecognition();

    // 기존 음성 재생 중단
    window.speechSynthesis.cancel();

    const targetIndex = currentIndex;

    // 현재 단어 가져오기
    const word = words[currentIndex].text;

    // 음성 생성
    const speech = new SpeechSynthesisUtterance(word);

    speech.lang = "ko-KR";
    speech.rate = 0.8;

    // 씨앗 반응
    result.textContent =
        "씨앗의 목소리를 듣고 다시 읽어볼까?";

    listenBtn.disabled = true;


    // 음성 재생 종료
    speech.onend = function () {

        if (targetIndex === currentIndex) {
            listenBtn.disabled = false;
        }
    };


    // 음성 재생 오류
    speech.onerror = function () {

        if (targetIndex !== currentIndex) return;

        listenBtn.disabled = false;

        result.textContent =
            "힌트를 재생하지 못했어요. 다시 눌러볼까요?";
    };


    // 사용자가 힌트를 눌렀을 때만 재생
    window.speechSynthesis.speak(speech);
}


// ========================================
// 6. 스스로 읽기 기능 (STT)
// ========================================

function startReading() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    // 음성 인식 지원 확인
    if (!SpeechRecognition) {

        result.textContent =
            "이 브라우저에서는 음성 인식을 지원하지 않아요.";

        return;
    }


    // 음성 힌트 재생 중단
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    stopRecognition();


    // 음성 인식 객체 생성
    const active = new SpeechRecognition();
    recognition = active;

    active.lang = "ko-KR";
    active.interimResults = false;
    active.maxAlternatives = 3;


    // 현재 학습 단어 저장
    const targetIndex = currentIndex;
    const targetWord = words[currentIndex].text;


    // 마이크 시작 상태
    result.textContent =
        "너의 소리를 듣고 있어!";

    micBtn.disabled = true;
    listenBtn.disabled = true;


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

        // 음성 인식 후보 결과
        const alternatives =
            Array.from(event.results[0]);

        const spokenWord =
            alternatives[0].transcript.trim();


        // 목표 단어와 인식 결과 비교
        const matched = alternatives.some(
            candidate =>
                normalize(candidate.transcript) ===
                normalize(targetWord)
        );


        giveExp(matched, targetWord);

        // 씨앗의 간접 피드백
        if (matched) {

            result.textContent =
                `“${targetWord}”라고 들렸어! 다음 단어도 읽어볼까?`;

        } else {

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

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            result.textContent =
                "마이크 사용을 허용해 주세요.";

        } else if (event.error === "no-speech") {

            result.textContent =
                "목소리가 잘 들리지 않았어요. 다시 읽어볼까요?";

        } else {

            result.textContent =
                "음성 인식이 원활하지 않아요. 다시 시도해 주세요.";

        }
    };


    // ====================================
    // 음성 인식 종료
    // ====================================

    active.onend = function () {

        if (recognition !== active) return;

        recognition = null;

        micBtn.disabled = false;
        listenBtn.disabled = false;
    };


    // ====================================
    // 마이크 시작
    // ====================================

    try {

        active.start();

    } catch (error) {

        recognition = null;

        micBtn.disabled = false;
        listenBtn.disabled = false;

        result.textContent =
            "마이크를 시작하지 못했어요. 다시 눌러주세요.";
    }
}


// ========================================
// 7. 다음 단어로 이동
// ========================================

function nextWord() {

    // 음성 인식 중단
    stopRecognition();

    // 음성 재생 중단
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    listenBtn.disabled = false;

    // 다음 단어로 이동
    currentIndex++;

    // Level 2의 모든 단어를 학습한 경우
    if (currentIndex >= words.length) {

        alert("2단계 단어를 씨앗이 다 배웠어! 3단계 단어도 알려줘!");

        // Level 3 화면으로 이동
        window.location.href = "./level3.html";

        return;
    }

    // 다음 단어 표시
    showWord();
}



// ========================================
// 8. 버튼 이벤트 연결
// ========================================

// 스스로 읽기
micBtn.addEventListener("click", startReading);

// 선택적 음성 힌트
listenBtn.addEventListener("click", playHint);

// 다음 단어
nextBtn.addEventListener("click", nextWord);


// ========================================
// 9. 첫 화면 실행
// ========================================

/* ========================================
   이전 문제로 돌아가기
   Level 1 / Level 2 / Level 3 공통
======================================== */

// 이전 문제 버튼
const prevBtn = document.getElementById("prevBtn");


// 현재 문제 번호에 따라 버튼 활성화
function updatePrevButton() {

    if (!prevBtn) return;

    // 첫 번째 문제에서는 이전 버튼 비활성화
    prevBtn.disabled = (currentIndex === 0);

}


// 이전 문제로 이동
function previousWord() {

    // 첫 번째 문제라면 이동하지 않음
    if (currentIndex <= 0) {
        return;
    }

    // 음성 인식 중단
    stopRecognition();

    // 재생 중인 음성 종료
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    // 이전 문제 번호로 변경
    currentIndex--;

    // 이전 문제 화면 다시 표시
    showWord();

    // 마이크 버튼 활성화
    micBtn.disabled = false;

    // Level 1, Level 2의 음성 듣기 버튼 활성화
    if (
        typeof listenBtn !== "undefined" &&
        listenBtn
    ) {
        listenBtn.disabled = false;
    }

    // 이전 버튼 상태 갱신
    updatePrevButton();

}


// 이전 문제 버튼 클릭 이벤트
if (prevBtn) {
    prevBtn.addEventListener("click", previousWord);
}

showWord();
