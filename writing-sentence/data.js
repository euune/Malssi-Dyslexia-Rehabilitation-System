/*
 * 말씨 – 쓰기 · 문장 (320 문장 쓰기 훈련) 과제 데이터
 *
 *   321 1단계  문장 틀 + 낱말 선택   (mode: 'frame')
 *   322 2단계  단어 카드 순서 배열   (mode: 'order')
 *   323 3단계  그림 기반 단어 조합   (mode: 'compose')
 *
 * 그림은 단어 쓰기(writing-word/assets)에 이미 출처·이용 조건을 기록해 둔 공개 그림을 그대로 씁니다.
 *   → 출처: writing-word/assets/credits.json, writing-word/image-credits.html
 * 새 그림을 만들지 않습니다. 낱말을 추가할 때는 그 그림이 credits.json 에 있는지 먼저 확인하세요.
 *
 * vocab 에 있는 낱말이 문장 속에 들어오면(조사를 떼어 찾음) SG.engine 이
 * '다른 뜻의 낱말'로 알아보고, 그 낱말의 그림을 피드백으로 보여 줍니다. (예: 벌 → 발)
 *
 * scene: 다른 낱말이 들어갔을 때 그 낱말 그림으로 꾸밀 '엉뚱한 문장' 장면 (play.js 의 SCENES)
 *   fly 날아요 · eat 먹어요 · fall 내려요 · pour 따라요 · shine 빛나요 · sing 노래해요 · float 떠가요
 *   새 그림을 만들지 않고, 그 낱말의 기존 그림을 움직임·효과로 꾸밉니다.
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var IMG = '../writing-word/assets/';

  var vocab = {
    '벌':     { src: IMG + 'beol.svg',      alt: '윙윙 날며 꽃에서 꿀을 모으는 곤충' },
    '발':     { src: IMG + 'bal.svg',       alt: '걷고 뛸 때 땅을 딛는 몸의 부분' },
    '불':     { src: IMG + 'bul.svg',       alt: '뜨겁고 밝게 타올라요' },
    '밥':     { src: IMG + 'bap.svg',       alt: '쌀을 익혀서 먹는 음식' },
    '밤':     { src: IMG + 'bam.svg',       alt: '단단한 껍질 속 갈색 열매' },
    '눈':     { src: IMG + 'nun.svg',       alt: '겨울 하늘에서 하얗게 내려요' },
    '문':     { src: IMG + 'mun.svg',       alt: '방에 들어갈 때 열고 닫아요' },
    '물':     { src: IMG + 'mul.svg',       alt: '목이 마를 때 마셔요' },
    '개':     { src: IMG + 'gae.svg',       alt: '멍멍 하고 짖는 동물' },
    '비행기': { src: IMG + 'bihaenggi.svg', alt: '날개로 하늘을 나는 탈것' },
    '소방차': { src: IMG + 'sobangcha.svg', alt: '불을 끄러 가는 큰 차' },
    '눈사람': { src: IMG + 'nunsaram.svg',  alt: '눈을 뭉쳐서 만든 사람 모양' },
    '해':     { src: IMG + 'hae.svg',       alt: '낮 하늘을 밝게 비추어요' },
    '새':     { src: IMG + 'sae.svg',       alt: '깃털과 날개가 있는 동물' },
    '소':     { src: IMG + 'so.svg',        alt: '음매 하고 우는 큰 동물' },
    '사탕':   { src: IMG + 'satang.svg',    alt: '달콤하게 먹는 작은 간식' },
    '가방':   { src: IMG + 'gabang.svg',    alt: '물건을 넣어 들고 다녀요' },
    '구름':   { src: IMG + 'gureum.svg',    alt: '하늘에 떠 있는 작은 물방울 무리' },
    '그림':   { src: IMG + 'geurim.svg',    alt: '선과 색으로 그린 모습' }
  };

  var levels = [
    {
      number: 1,
      code: '321',
      mode: 'frame',
      title: '빈칸 채우기',
      description: '그림을 보고, 문장의 빈칸에 알맞은 낱말 카드를 골라요.',
      detail: '빈칸에 들어갈 낱말을 함께 찾아볼까?',
      guide: '그림을 보고 빈칸에 들어갈 낱말을 골라 볼까요?',
      items: [
        { id: 'ws-1-1', picture: '벌', before: '',          after: '이 윙윙 날아요.',   choices: ['발', '벌', '불'], scene: 'fly' },
        { id: 'ws-1-2', picture: '밥', before: '',          after: '을 맛있게 먹어요.', choices: ['밥', '밤'], scene: 'eat' },
        { id: 'ws-1-3', picture: '눈', before: '하늘에서 ', after: '이 내려요.',       choices: ['문', '눈'], scene: 'fall' },
        { id: 'ws-1-4', picture: '물', before: '컵에 ',     after: '을 따라요.',       choices: ['불', '물'], scene: 'pour' }
      ]
    },
    {
      number: 2,
      code: '322',
      mode: 'order',
      title: '카드 순서 맞추기',
      description: '그림을 보고, 섞인 낱말 카드를 차례대로 놓아 문장을 만들어요.',
      detail: '카드를 차례차례 놓아서 문장을 만들어 볼까?',
      guide: '낱말 카드를 차례대로 눌러 문장을 만들어 볼까요?',
      items: [
        { id: 'ws-2-1', picture: '개',     cards: ['개가', '멍멍', '짖어요'],              accept: ['멍멍 개가 짖어요'] },
        { id: 'ws-2-2', picture: '비행기', cards: ['비행기가', '하늘을', '날아요'],        accept: ['하늘을 비행기가 날아요'] },
        { id: 'ws-2-3', picture: '눈사람', cards: ['눈사람이', '활짝', '웃어요'],          accept: ['활짝 눈사람이 웃어요'] },
        { id: 'ws-2-4', picture: '소방차', cards: ['소방차가', '불을', '끄러', '가요'],    accept: [] }
      ]
    },
    {
      number: 3,
      code: '323',
      mode: 'compose',
      title: '그림 보고 만들기',
      description: '문장 틀 없이 그림만 보고, 낱말 카드를 골라 문장을 만들어요.',
      detail: '이번엔 그림만 보고 문장을 만들어 볼까?',
      guide: '그림에 어울리는 낱말 카드를 골라 문장을 만들어 볼까요?',
      items: [
        { id: 'ws-3-1', picture: '해',   cards: ['해가', '밝게', '빛나요'],           extra: ['개가'],   accept: ['밝게 해가 빛나요'], scene: 'shine' },
        { id: 'ws-3-2', picture: '새',   cards: ['새가', '짹짹', '노래해요'],         extra: ['소가'],   accept: ['짹짹 새가 노래해요'], scene: 'sing' },
        { id: 'ws-3-3', picture: '사탕', cards: ['달콤한', '사탕을', '먹어요'],       extra: ['가방을'], accept: [], scene: 'eat' },
        { id: 'ws-3-4', picture: '구름', cards: ['하얀', '구름이', '둥둥', '떠가요'], extra: ['그림이'], accept: ['둥둥 하얀 구름이 떠가요'], scene: 'float' }
      ]
    }
  ];

  SG.writingSentence = SG.writingSentence || {};
  SG.writingSentence.data = { vocab: vocab, levels: levels };
})(typeof window !== 'undefined' ? window : globalThis);
