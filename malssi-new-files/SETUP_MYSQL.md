# 말씨 MySQL 저장 설정 방법

읽기 기록을 MySQL에 저장하려면 **MySQL**, **Node.js**, 그리고 이 폴더의 **서버(`server.js`)** 가 필요해요.

```
[브라우저: HTML/JS]  ──fetch──▶  [server.js (Node.js)]  ──SQL──▶  [MySQL]
```

> 서버 없이 HTML 파일을 더블클릭해서 열어도 앱은 예전처럼 동작해요. 다만 이때 기록은 브라우저에만 남아요.

## 1. 설치 (처음 한 번)
1. **MySQL Community Server** 설치: https://dev.mysql.com/downloads/installer/
   - 설치 중에 정한 `root` 비밀번호를 기억해 두세요.
2. **Node.js LTS** 설치: https://nodejs.org

## 2. 데이터베이스 만들기 (처음 한 번)
MySQL Workbench나 명령 프롬프트에서 실행해요.

```bash
mysql -u root -p < db/schema.sql
```

앱 전용 계정을 만들어요. 비밀번호는 원하는 값으로 바꾸세요.

```sql
CREATE USER 'malssi'@'localhost' IDENTIFIED BY '원하는비밀번호';
GRANT SELECT, INSERT, UPDATE, DELETE ON malssi.* TO 'malssi'@'localhost';
```

## 3. 서버 설정 (처음 한 번)
1. 이 폴더에서 패키지를 설치해요.
   ```bash
   npm install
   ```
2. `.env.example` 파일을 복사해 `.env` 로 이름을 바꾸고, `DB_PASSWORD` 에 위에서 정한 비밀번호를 써요.
   - `.env` 에는 비밀번호가 들어 있어서 `.gitignore` 로 GitHub에 올라가지 않게 해 두었어요.

## 4. 실행 (매번)
```bash
npm start
```
브라우저에서 아래 주소로 열어요.
- 단어 읽기: http://localhost:3000/level1.html
- 문장 읽기: http://localhost:3000/reading_sentence.html

처음 들어가면 **별명**을 물어봐요. 같은 별명으로 들어오면 다른 기기에서도 이어서 할 수 있어요.

## 저장되는 데이터
모든 게임이 **같은 테이블**을 같이 써요. 게임은 `activity` 칸으로 구분해요.

| 테이블 | 내용 |
|---|---|
| `users` | 학습자 별명 |
| `activities` | 게임 목록: `reading_word`, `reading_sentence`, `writing_word`, `writing_sentence` |
| `progress` | 학습자 × 게임마다 1줄: 완료한 단계 수(`cleared`), 이어 하기 정보(`state`, JSON) |
| `attempts` | 시도할 때마다 1줄: 해야 했던 것, 아이가 읽은 말이나 쓴 글, 점수, 결과(도달·아직·무응답), 재시도 횟수, 게임별 추가 정보(`detail`, JSON) |

녹음 원본은 저장하지 않고, 음성 인식 결과 텍스트만 저장해요.

새 게임을 연결하는 방법은 **[docs/NEW_GAME.md](docs/NEW_GAME.md)** 를 보세요.

## 기록 확인하기
```sql
USE malssi;

-- 최근 기록 50개
SELECT u.nickname, a.name AS game, t.target_text, t.answer_text, t.score, t.outcome, t.created_at
FROM attempts t
JOIN users u ON u.id = t.user_id
JOIN activities a ON a.code = t.activity
ORDER BY t.id DESC LIMIT 50;

-- 학습자별·게임별 요약
SELECT u.nickname, a.name AS game, COUNT(*) AS 시도, SUM(t.outcome = 'reached') AS 도달, ROUND(AVG(t.score), 2) AS 평균점수
FROM attempts t
JOIN users u ON u.id = t.user_id
JOIN activities a ON a.code = t.activity
GROUP BY u.nickname, a.name, a.sort_order
ORDER BY u.nickname, a.sort_order;
```
브라우저에서 보려면 아래 주소로 열면 돼요. 숫자 `1`은 학습자 번호예요.
- 게임별 요약: http://localhost:3000/api/users/1/summary
- 전체 기록: http://localhost:3000/api/users/1/attempts
- 한 게임만: http://localhost:3000/api/users/1/attempts?activity=reading_sentence

## API 목록
| 요청 | 하는 일 |
|---|---|
| `GET /api/health` | 서버·DB 연결 확인 |
| `GET /api/activities` | 게임 목록 |
| `POST /api/users` `{nickname}` | 별명으로 학습자 찾기/만들기 |
| `GET /api/users/:id/progress/:activity` | 진행 상황 불러오기 |
| `PUT /api/users/:id/progress/:activity` `{cleared, state}` | 진행 상황 저장 |
| `POST /api/users/:id/attempts` | 시도 기록 (형식은 docs/NEW_GAME.md) |
| `GET /api/users/:id/attempts?activity=&limit=100` | 시도 기록 조회 |
| `GET /api/users/:id/summary` | 게임별 시도 수·도달 수·평균 점수 |

## 예전 버전에서 바꾸는 경우
예전 버전의 `reading_progress`, `reading_attempts` 테이블을 만들어 둔 적이 있다면 `db/schema.sql` 맨 위의 `DROP TABLE` 두 줄 주석을 풀고 다시 실행하세요. 그 테이블의 데이터는 지워져요.

## 주의
- 난독증 아동의 읽기 기록은 민감한 개인정보예요. 실명 대신 별명을 쓰고, 보호자 동의를 받으세요.
- 지금은 별명만 알면 누구나 그 기록을 이어서 쓰고 볼 수 있어요. 여러 사람이 쓰는 곳에 공개하려면 로그인(비밀번호) 기능을 먼저 추가해야 해요.
