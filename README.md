# 말씨 · 씨앗의 말 정원

기존 HTML/CSS/JavaScript 정적 웹 앱입니다. Node.js는 로컬 개발 도구에만 사용하며 웹 실행·배포에 빌드나 패키지 설치가 필요하지 않습니다.

## 로컬 실행

Node.js 20 이상이 있는 터미널에서 **이 README가 있는 저장소 폴더**로 이동한 뒤 실행합니다.

```powershell
node scripts/dev-server.cjs
```

- 홈: <http://127.0.0.1:5500/>
- 쓰기-단어: <http://127.0.0.1:5500/writing-word/>
- 종료: 실행한 터미널에서 `Ctrl+C`
- 포트 변경: `$env:PORT = '5501'` 설정 후 같은 명령 실행
- 문법 검사: `node scripts/check.cjs`
- 쓰기-단어 정책·콘텐츠 검사: `node writing-word/logic.test.cjs`
- npm이 있다면 `npm run dev`, `npm run check`도 같습니다. `npm install`은 필요 없습니다.

로컬 서버는 `js/db-config.js` 요청에 빈 설정을 반환하여 **모든 로컬 화면의 Supabase 동기화를 끕니다**. 실제 설정 파일과 기존 배포 동작은 바꾸지 않습니다. 기록과 설정은 같은 주소의 브라우저 localStorage에서 공유됩니다. 브라우저/호스트/포트가 다르면 별도 저장소입니다. Live Server 등 다른 서버는 이 격리를 제공하지 않습니다.

## 앱 진입과 페이지 이동

GitHub main `013d51f`와 같은 방식으로 **공통 홈에서 별도 HTML로 이동**합니다.

- 시작 화면: `index.html`
- 읽기-단어: `reading-words/select-level.html`
- 읽기-문장: `reading-sentence/index.html`
- 쓰기-단어: `writing-word/index.html`

쓰기-단어의 진입 코드는 `js/activities/write-word.js`의 `window.location.href`입니다. 페이지를 오가며 공통 `SG.store`의 성장·설정을 공유합니다. `js/core.js`는 main과 동일하며, 쓰기 전용 스크립트·스타일은 쓰기 HTML에서만 불러옵니다.

## 폴더와 협업

| 경로 | 용도 |
| --- | --- |
| `index.html`, `js/core.js` | 공통 홈·설정·활동 등록 |
| `css/common.css`, `js/hangul.js`, `js/engine.js`, `js/store.js`, `js/growth.js` | 공통 UI·한글·피드백·저장·성장 |
| `reading-words/` | 기존 읽기-단어 |
| `reading-sentence/` | 기존 읽기-문장 |
| `writing-word/` | 담당 쓰기-단어 구현 |
| `js/activities/write-word.js` | 홈에서 쓰기-단어로 이동하는 연결부 |
| `js/activities/write-sentence.js` | 쓰기-문장 자리 파일 |

작업 브랜치는 `feature/write_word`입니다. 변경 전 `git status`와 현재 브랜치를 확인하고, 공유 파일 수정은 최소화합니다. 작업을 검토한 뒤 커밋하며, 푸시는 사용자 요청이 있을 때만 진행합니다.

현재 쓰기-단어는 **4단계·단계당 4개 숫자 스테이지와 89개 등록 어휘**를 제공합니다. 단계 박스 안에 완료 수와 초록 완료 스테이지를 표시하며, 과거 기록과 관계없이 스테이지를 자유롭게 고릅니다. 목표는 그림으로 제시하고 TTS는 수동 듣기 버튼으로만 재생합니다. 받침 없는 글자의 끝소리 선택은 생략합니다. 제출한 다른 단어의 그림과 달라진 자소를 확인하고, 목표 도달 후에 비슷한 말을 살펴봅니다. 무입력에 따른 자동 음성·화면 전환·시간 제한은 없습니다.

후속 그림 제시 요청에 따라 OpenMoji·Wikimedia Commons의 **낱말 49개의 기존 공개 이미지**를 로컬에 연결했습니다. 새 이미지는 생성하지 않았습니다. `writing-word/media.js`와 `writing-word/assets/credits.json`에서 연결·출처를 관리합니다. [단계별 콘텐츠](docs/WRITING_WORD_CONTENT.md)와 [개발 안내](docs/WRITING_WORD.md)를 참고하세요.

구현 기준과 다음 작업은 [쓰기-단어 개발 안내](docs/WRITING_WORD.md)를 참고하세요.

일상 낱말 검토는 `writing-word/vocabulary-review.json`에 기록했습니다. 현재 선택지 2,765가지 조합 중 승인한 46개 낱말은 모두 그림으로 반응합니다. 파란색은 제출한 글자의 다른 자소만 뜻하며, 재시도 시 조각 영역 강조 대신 씨앗의 응원 문구를 제공합니다.
