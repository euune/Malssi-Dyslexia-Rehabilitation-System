
"use strict";

// ========================================
// 1. 학습 단어 데이터
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

let currentIndex = 0;
let recognition = null;


// ========================================
// 2. HTML 요소 가져오기
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


// ========================================
// 3. 글자 비교용 정규화
// ========================================

function normalize(text) {

    return String(text).replace(
        /[^\p{L}\p{N}]/gu,
        ""
    );
}


// ========================================
// 4. 진행 중인 음성 인식 종료
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
// 5. 학습 단어 표시
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
    // 이전 문제 버튼 활성화 상태 갱신
    updatePrevButton();

    const word = words[currentIndex];
    const targetIndex = currentIndex;

    // 단어 텍스트 표시
    wordText.textContent = word.text;


    // ====================================
    // 단어 이미지 표시
    // ====================================

    // 이미지가 없는 경우 사용할 이모지 준비
    wordImage.hidden = true;
    wordImage.removeAttribute("src");

    wordImage.alt = word.text + " 그림";

    wordEmoji.textContent = word.emoji;
    wordEmoji.hidden = false;


    // 이미지 불러오기
    const preload = new Image();

    preload.onload = function () {

        // 다른 단어로 이동했다면 무시
        if (targetIndex !== currentIndex) {
            return;
        }

        wordImage.src = word.image;
        wordImage.hidden = false;

        wordEmoji.hidden = true;
    };


    // 이미지가 없는 경우 이모지 표시
    preload.onerror = function () {

        if (targetIndex !== currentIndex) {
            return;
        }

        wordImage.hidden = true;
        wordEmoji.hidden = false;
    };

    preload.src = word.image;


    // ====================================
    // 단어 진행률 업데이트
    // ====================================

    progressText.textContent =
        `${currentIndex + 1}/${words.length}`;

    const progressPercent =
        ((currentIndex + 1) / words.length) * 100;

    progressFill.style.width =
        `${progressPercent}%`;


    // 접근성 진행 상태 업데이트
    progressBar.setAttribute(
        "aria-valuemax",
        String(words.length)
    );

    progressBar.setAttribute(
        "aria-valuenow",
        String(currentIndex + 1)
    );


    // ====================================
    // 나비 위치 업데이트
    // ====================================

    // 단어가 바뀔 때 나비 이동
    // 1번째: 5%
    // 2번째: 50%
    // 3번째: 95%

    // 나비가 양 끝에서 잘리지 않도록
    // 5% ~ 95% 구간으로 설정

    const ratio =
        words.length > 1
            ? currentIndex / (words.length - 1)
            : 0;

    const butterflyPosition =
        5 + ratio * 90;

    if (gardenButterfly) gardenButterfly.style.left =
        `${butterflyPosition}%`;


    // ====================================
    // 씨앗 말풍선 초기화
    // ====================================

    result.textContent =
        "단어를 들려줘!!";

}


// ========================================
// 6. 단어 듣기 기능 (TTS)
// ========================================

function playSound() {

    // 브라우저 음성 합성 지원 확인
    if (!("speechSynthesis" in window)) {

        result.textContent =
            "음성 재생을 지원하지 않는 브라우저예요.";

        return;
    }

    // 음성 인식 중이면 중단
    stopRecognition();

    // 기존 음성 재생 종료
    window.speechSynthesis.cancel();


    // 현재 학습 단어 가져오기
    const word = words[currentIndex].text;


    // 음성 생성
    const speech =
        new SpeechSynthesisUtterance(word);

    speech.lang = "ko-KR";
    speech.rate = 0.8;


    // 음성 재생
    window.speechSynthesis.speak(speech);
}


// ========================================
// 7. 직접 읽기 기능 (STT)
// ========================================

function startReading() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    // 음성 인식 지원 확인
    if (!SpeechRecognition) {

        result.textContent =
            "음성 인식을 지원하지 않는 브라우저예요.";

        return;
    }


    // 기존 음성 재생 중단
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    // 이전 음성 인식 중단
    stopRecognition();


    // ====================================
    // 음성 인식 객체 생성
    // ====================================

    const active =
        new SpeechRecognition();

    recognition = active;

    active.lang = "ko-KR";
    active.interimResults = false;
    active.maxAlternatives = 1;


    // 현재 단어 저장
    const targetIndex = currentIndex;
    const targetWord = words[currentIndex].text;


    // 씨앗의 말풍선
    result.textContent =
        "말씀해 주세요!";

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


        // 목표 단어와 비교
        const matched =
            normalize(spokenWord) ===
            normalize(targetWord);

        giveExp(matched, targetWord);

        if (matched) {

            result.textContent =
                `“${spokenWord}”라고 들렸어! 다음 단어도 읽어볼까?`;

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


    // ====================================
    // 음성 인식 시작
    // ====================================

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
// 8. 다음 단어로 이동
// ========================================

function nextWord() {

    // 진행 중인 음성 인식 종료
    stopRecognition();


    // 재생 중인 음성 종료
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }


    // 다음 단어로 이동
    currentIndex++;


    // ====================================
    // Level 1 학습 완료
    // ====================================

    if (currentIndex >= words.length) {

        alert(
            "1단계 단어를 씨앗이 다 배웠어! 2단계 단어도 알려줘!"
        );

        // Level 2 화면으로 이동
        window.location.href = "./level2.html";

        return;
    }


    // 다음 단어 표시
    showWord();
}


// ========================================
// 9. 버튼 이벤트 연결
// ========================================

// 단어 음성 듣기
listenBtn.addEventListener(
    "click",
    playSound
);

// 직접 읽기
micBtn.addEventListener(
    "click",
    startReading
);

// 다음 단어
nextBtn.addEventListener(
    "click",
    nextWord
);


// ========================================
// 10. 첫 화면 실행
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
