# 문장 쓰기 (320 문장 쓰기 훈련)

홈의 ‘문장 쓰기’ 타일 → `writing-sentence/select-level.html` → 단계별 페이지. 단어 읽기(`reading-words/`)와 같은 화면 구성입니다.

| 코드 | 단계 | 페이지 | 하는 일 |
| --- | --- | --- | --- |
| 321 | 1단계 | `level1.html` | 그림과 문장 틀을 보고 빈칸에 들어갈 낱말 카드를 고름 (비슷한 소리 낱말 2~3개 중) |
| 322 | 2단계 | `level2.html` | 그림을 보고 섞인 낱말 카드를 차례대로 놓음 |
| 323 | 3단계 | `level3.html` | 문장 틀 없이 그림만 보고 카드를 골라 문장을 만듦 (비슷한 낱말 카드 1장이 섞임) |

## 파일

- `data.js`: 그림 낱말(vocab)과 단계별 문장 4개. 문장·카드·허용 어순(`accept`)은 여기서 고칩니다.
- `logic.js`: 문장 만들기·카드 섞기·힌트 수·응원 문구·진행 기록 (DOM 없음)
- `play.js`: 1~3단계 공통 놀이 화면 (`<body data-level>`로 단계 선택)
- `select-level.js`: 단계 선택, 단계마다 완성 수 표시
- `logic.test.cjs`: `node writing-sentence/logic.test.cjs` (`npm test`에 포함)

## 동작 원칙

- 응답 분류는 공통 엔진 `SG.engine.classifySentence`의 `exact` 모드를 씁니다. 목표 문장이나 `accept` 어순과 같으면 완성입니다.
- 문장에 vocab의 다른 낱말이 들어오면(예: 벌 → 발) 아이가 만든 문장 그대로의 장면을 보여 줍니다. 예를 들어 '발이 윙윙 날아요'면 발 그림이 하늘을 날아다닙니다. 장면 종류는 data.js 문제마다 `scene`(fly·eat·fall·pour·shine·sing·float)으로 정하고, 기존 그림에 CSS 움직임과 효과를 더해 만듭니다. 장면 아래 문장에서는 실제로 달라진 글자만 파랗게 표시합니다. 안내에는 아이가 쓴 자소만 말하고 목표 자소는 말하지 않습니다. 달라진 자소는 `SG.store.recordConfusion`으로 기록합니다.
- 2·3단계는 두 번째 재시도부터 씨앗이 앞쪽 카드를 한 장씩 놓아 줍니다(🌱 표시). 마지막 카드는 늘 아이가 놓습니다.
- 소리는 ‘문장 들어볼까요?’ 버튼을 누를 때만 납니다. 씨앗 대사도 자동 음성이 없고, 시간 제한·자동 전환은 없습니다.
- 경험치: 제출마다 첫 시도 +1 / 재시도 +1, 완성 +2 (`SG.engine.CONFIG.exp`).
- 진행(완성한 문장)은 공통 저장소 `seed-garden-v1`의 `writingSentence.done`에 두므로 학습 기록 코드로 다른 기기와 함께 맞춰집니다. 과제 이력은 `activity: 'write-sentence'`로 남습니다.

## 그림

새 그림을 만들지 않고 단어 쓰기에서 출처를 확인한 그림(`writing-word/assets`)을 그대로 씁니다. 출처는 `writing-word/assets/credits.json`과 `writing-word/image-credits.html`에 있습니다. 테스트에서 그림 파일이 있는지, 출처 기록에 올라 있는지, 대체 텍스트에 낱말이 드러나지 않는지 확인합니다.
