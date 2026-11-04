-- 말씨 데이터베이스 (MySQL 8 / MariaDB 10.5 이상)
-- 실행: mysql -u root -p < db/schema.sql
--
-- 모든 게임(읽기-단어, 읽기-문장, 쓰기-단어, 쓰기-문장 …)이 같은 테이블을 같이 씁니다.
-- 새 게임을 추가할 때는 아래 activities 에 한 줄만 추가하세요.
--
-- ※ 예전 버전(reading_progress, reading_attempts 테이블)을 만들어 둔 적이 있다면
--   안의 데이터가 필요 없을 때 아래 두 줄의 주석(--)을 지우고 실행해서 정리하세요.
-- DROP TABLE IF EXISTS malssi.reading_attempts;
-- DROP TABLE IF EXISTS malssi.reading_progress;

SET NAMES utf8mb4; -- 한글이 깨지지 않도록 (꼭 맨 앞에 두세요)

CREATE DATABASE IF NOT EXISTS malssi
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE malssi;

-- 학습자 (실명 대신 별명을 저장하세요)
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nickname   VARCHAR(30) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 게임(활동) 목록
CREATE TABLE IF NOT EXISTS activities (
  code       VARCHAR(30) PRIMARY KEY,   -- 코드에서 쓰는 이름
  name       VARCHAR(50) NOT NULL,      -- 화면·보고서에 보일 이름
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO activities (code, name, sort_order) VALUES
  ('reading_word',     '읽기 - 단어', 1),
  ('reading_sentence', '읽기 - 문장', 2),
  ('writing_word',     '쓰기 - 단어', 3),
  ('writing_sentence', '쓰기 - 문장', 4)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 진행 상황: 학습자 × 게임마다 1줄
CREATE TABLE IF NOT EXISTS progress (
  user_id    INT NOT NULL,
  activity   VARCHAR(30) NOT NULL,
  cleared    INT NOT NULL DEFAULT 0,   -- 완료한 단계(장) 수 – 모든 게임 공통
  state      JSON NULL,                -- 게임마다 다른 "이어 하기" 정보
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, activity),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_activity FOREIGN KEY (activity) REFERENCES activities(code)
);

-- 시도 기록: 모든 게임 공통, 시도할 때마다 1줄
CREATE TABLE IF NOT EXISTS attempts (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  activity    VARCHAR(30) NOT NULL,
  stage       INT NULL,                 -- 장·단계·문제 번호
  target_text VARCHAR(255) NOT NULL,    -- 읽거나 써야 했던 단어·문장
  answer_text VARCHAR(255) NULL,        -- 아이가 읽은 말(음성 인식 결과) 또는 쓴 글
  score       DECIMAL(4,3) NULL,        -- 0~1 (모르면 NULL)
  outcome     ENUM('reached', 'not_yet', 'no_input') NOT NULL,  -- 도달 / 아직 / 무응답
  retry_count INT NOT NULL DEFAULT 0,   -- 같은 문제에서 몇 번째 재시도였는지
  detail      JSON NULL,                -- 게임마다 다른 추가 정보 (예: 틀린 자모, 걸린 시간)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_activity FOREIGN KEY (activity) REFERENCES activities(code),
  INDEX idx_attempt_user_activity_time (user_id, activity, created_at)
);
