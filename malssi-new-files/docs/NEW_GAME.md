# 새 게임을 말씨 DB에 연결하는 방법

쓰기-단어, 쓰기-문장처럼 새 게임을 만들 때 이 순서대로 하면, 별명 입력과 기록 저장이 다른 게임과 똑같이 동작해요.

## 1. HTML에 공통 스크립트 넣기
게임 스크립트보다 **먼저** 넣어요.

```html
<script src="malssi_api.js"></script>
<script src="writing_word_script.js"></script>
```

## 2. 게임 시작할 때 한 번 부르기
서버로 열었을 때 별명을 물어보고 학습자를 정해 둬요.

```js
const ACTIVITY = 'writing_word'; // db/schema.sql 의 activities 에 있는 code

if (window.MalssiAPI) MalssiAPI.ready();
```

서버 없이 파일을 더블클릭해서 열면 `MalssiAPI`는 조용히 아무것도 하지 않아요. 그래도 게임은 그대로 동작해요.

## 3. 시도할 때마다 기록하기
아이가 답을 낼 때마다 한 번 불러요.

```js
MalssiAPI.logAttempt({
  activity: ACTIVITY,     // 필수
  target:   '사과',        // 필수: 읽거나 써야 했던 것
  outcome:  'not_yet',    // 필수: 'reached'(도달) | 'not_yet'(아직) | 'no_input'(무응답)
  answer:   '사가',        // 아이가 쓴 글 / 읽은 말
  score:    0.5,          // 0~1, 모르면 빼기
  stage:    1,            // 단계·문제 번호
  retries:  0,            // 같은 문제에서 몇 번째 재시도인지 (0부터)
  detail:   {             // 게임마다 다른 추가 정보 (자유 형식, 4KB 이하)
    wrong_jamo: ['ㄱ'],
    ms: 4200,             // 걸린 시간
  },
});
```

### 공통 칸과 `detail`의 구분
- **공통 칸**(`target`, `answer`, `score`, `outcome`, `retries`, `stage`)은 모든 게임에서 같은 뜻으로 채워 주세요. 그래야 게임끼리 비교하고 요약할 수 있어요.
- 그 게임에만 있는 정보는 **`detail`**에 넣어요. 테이블을 고치지 않아도 돼요.

| 게임 | `detail` 예시 |
|---|---|
| 읽기 - 문장 | `{ sentence: 1, words: [1, 0.8, 0.4], support: true }` (단어별 점수, 도움 단계 사용 여부) |
| 쓰기 - 단어 | `{ wrong_jamo: ['ㄹ'], ms: 4200, input: 'keyboard' }` |
| 쓰기 - 문장 | `{ spacing_errors: 2, wrong_words: ['갔어요'], ms: 15000 }` |

### 평가 표현은 쓰지 않기
화면에 "정답/오답/틀렸어/점수" 같은 말은 쓰지 않는 게 이 프로젝트의 규칙이에요(`reading_sentence_app.js` 맨 위 설명 참고). DB의 `outcome` 값도 그래서 `correct/wrong` 대신 `reached/not_yet`이에요.

## 4. 진행 상황 저장·불러오기 (필요한 게임만)
단계가 있고 "이어 하기"가 필요한 게임에서 써요.

```js
// 저장: 완료한 단계 수 + 이어 하기 정보(자유 형식 객체)
MalssiAPI.saveProgress(ACTIVITY, { cleared: 3, state: { idx: 2 } });

// 불러오기 (게임 시작 시)
MalssiAPI.ready()
  .then((user) => (user ? MalssiAPI.loadProgress(ACTIVITY) : undefined))
  .then((saved) => {
    if (saved === undefined) return; // 서버 없음 → 브라우저 저장만 사용
    if (saved === null) return;      // 서버에 아직 기록 없음 → 처음부터
    startFrom(saved.cleared, saved.state);
  });
```

## 5. 새 게임 종류 추가하기
`writing_word`, `writing_sentence`는 이미 등록되어 있어요. 다른 게임을 더 만들면 `db/schema.sql`의 `INSERT INTO activities` 목록에 한 줄 추가하고 schema.sql을 다시 실행하세요. 다시 실행해도 기존 데이터는 지워지지 않아요.

```sql
('listening_word', '듣기 - 단어', 5),
```

목록에 없는 `activity`를 보내면 서버가 거절해요. 브라우저 개발자 도구 콘솔에 경고가 떠요.

## 6. 확인하기
1. 아래 명령으로 서버를 켜고 `http://localhost:3000/새게임.html`로 열어요.
   ```bash
   npm start
   ```
2. 몇 번 시도해 본 뒤 http://localhost:3000/api/users/1/attempts?activity=writing_word 를 열어서 기록이 들어갔는지 확인해요.
