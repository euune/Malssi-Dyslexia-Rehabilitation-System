/*
 * 데이터베이스(Supabase) 연결 설정
 * Supabase 대시보드 → Project Settings → API 에서 두 값을 복사해 넣으세요. (docs/SUPABASE.md 참고)
 *
 *  - url     : Project URL           예) https://abcdefghijkl.supabase.co
 *  - anonKey : anon public 키 (또는 publishable 키)
 *
 * anon(공개) 키는 웹페이지에 들어가도 괜찮도록 만든 키예요. db/supabase.sql 이 테이블을 막아 두어서
 * 이 키로는 정해진 함수만 부를 수 있어요.
 * ⚠️ service_role(비밀) 키는 절대 여기에 넣지 마세요.
 *
 * 두 값이 비어 있으면 예전처럼 이 기기(브라우저)에만 저장돼요.
 */
(function (root) {
  var SG = root.SG = root.SG || {};
  SG.DB_CONFIG = {
    url: 'https://ikzyjhkyrsydtubbcdqv.supabase.co/rest/v1/',
    anonKey: ''
  };
})(typeof window !== 'undefined' ? window : globalThis);
