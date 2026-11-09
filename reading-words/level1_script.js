
// ========================================
// 1. 학습 단어 데이터
// ========================================

const words = [
    {
        text: "발",
        image: "../images/foot.jpg",
    },
    {
        text: "사과",
        image: "../images/apple.jpg",
    },
    {
        text: "나비",
        image: "../images/butterfly.jpg",
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


// ========================================
// 3. 단어 표시 함수
// ========================================

function showWord() {
    const word = words[currentIndex];

    wordText.textContent = word.text;

    // 기본적으로 이모지 표시
    wordImage.alt = word.text + " 그림";
    wordImage.src = word.image;
    wordImage.hidden = false;


    // 이미지 파일이 있으면 이미지 표시
    wordImage.onload = function () {
        wordImage.hidden = false;
        wordEmoji.hidden = true;
    };

    // 이미지가 없으면 이모지 유지
    wordImage.onerror = function () {
        wordImage.hidden = true;
        wordEmoji.hidden = false;
    };

    // 진행 상태 업데이트
    progressText.textContent =
        (currentIndex + 1) + "/" + words.length;

    progressFill.style.width =
        ((currentIndex + 1) / words.length * 100) + "%";

    document.getElementById("progressBar")
        ?.setAttribute("aria-valuenow", currentIndex + 1);

    // 결과 초기화
    result.textContent = "단어를 들려줘!!";
}


// ========================================
// 4. 단어 듣기 기능 (TTS)
// ========================================

function playSound() {
    if (!("speechSynthesis" in window)) {
        result.textContent =
            "음성 재생을 지원하지 않는 브라우저예요.";
        return;
    }

    const word = words[currentIndex].text;

    const speech = new SpeechSynthesisUtterance(word);

    speech.lang = "ko-KR";
    speech.rate = 0.8;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
}


// ========================================
// 5. 따라 읽기 기능 (STT)
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

    recognition = new SpeechRecognition();

    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // 현재 문제 기억
    const targetIndex = currentIndex;
    const targetWord = words[currentIndex].text;

    result.textContent = "말씀해 주세요!";
    micBtn.disabled = true;

    // 음성 인식 결과
    recognition.onresult = function (event) {
        if (targetIndex !== currentIndex) return;

        const spokenWord =
            event.results[0][0].transcript.trim();

        // 비교를 위해 공백과 문장부호 제거
        const normalize = (text) =>
            text.replace(/[^\p{L}\p{N}]/gu, "");

        
        if (normalize(spokenWord) === normalize(targetWord)) {

         result.textContent =
         `“${spokenWord}”라고 들렸어! 다음 단어도 읽어볼까?`;

        } else {

            result.textContent =
            `“${spokenWord}”라고 들렸어. 다시 한 번 읽어볼까?`;

        }

    };

    // 음성 인식 오류
    recognition.onerror = function (event) {
        if (targetIndex !== currentIndex) return;

        result.textContent =
            "음성 인식 오류: " + event.error;
    };

    // 음성 인식 종료
    recognition.onend = function () {
        micBtn.disabled = false;
        recognition = null;
    };

    try {
        recognition.start();
    } catch (error) {
        micBtn.disabled = false;
        result.textContent = "마이크를 시작할 수 없어요.";
    }
}


// ========================================
// 6. 다음 단어로 이동
// ========================================


/* ========================================
   6. 다음 단어로 이동
======================================== */

function nextWord() {

    // 음성 인식 중이면 종료
    if (recognition) {
        recognition.abort();
        recognition = null;
        micBtn.disabled = false;
    }

    // 재생 중인 음성 종료
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    // 다음 단어로 이동
    currentIndex++;

    // Level 1의 모든 단어를 학습한 경우
    if (currentIndex >= words.length) {

        alert("Level 1 학습을 마쳤어요! Level 2로 이동할게요.");

        // Level 2 화면으로 이동
        window.location.href = "./level2.html";

        return;
    }

    // 다음 단어 표시
    showWord();
}



// ========================================
// 7. 버튼 이벤트 연결
// ========================================

listenBtn.addEventListener("click", playSound);
micBtn.addEventListener("click", startReading);
nextBtn.addEventListener("click", nextWord);


// ========================================
// 8. 첫 화면 실행
// ========================================

showWord();
