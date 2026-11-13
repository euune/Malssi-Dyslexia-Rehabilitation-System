/* 단계별 과제·어휘·진행 위치. 그림 출처는 media.js와 assets/credits.json에 보관한다. */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {}, WW = SG.writingWord = SG.writingWord || {}, H = SG.hangul;
  var definitions = [
    ['코','냄새를 맡는 얼굴의 부분'], ['소','음매 하고 우는 큰 동물'], ['차','바퀴로 도로를 달리는 탈것'], ['파','길쭉한 초록 잎이 있는 채소'],
    ['배','달고 아삭한 노란 과일'], ['새','깃털과 날개가 있는 동물'], ['개','멍멍 하고 짖는 동물'], ['해','낮 하늘을 밝게 비추어요'],
    ['게','집게발이 있고 옆으로 걸어요'], ['무','하얗고 길쭉한 뿌리채소'], ['비','구름에서 떨어지는 물방울'], ['귀','소리를 듣는 몸의 부분'],
    ['오리','꽥꽥 울며 물에서 헤엄쳐요'], ['우리','동물을 기르는 울타리 안 공간'], ['나무','줄기와 가지와 잎이 있어요'], ['나비','꽃 주변을 날아다니는 곤충'],
    ['발','걷고 뛸 때 땅을 딛어요'], ['벌','윙윙 날며 꽃에서 꿀을 모아요'], ['밤','단단한 껍질 속 갈색 열매'], ['밥','쌀을 익혀서 먹는 음식'],
    ['물','목이 마를 때 마셔요'], ['불','뜨겁고 밝게 타올라요'], ['눈','겨울 하늘에서 하얗게 내려요'], ['문','방에 들어갈 때 열고 닫아요'],
    ['달','밤하늘에서 빛나요'], ['말','갈기가 있고 달리기를 잘하는 동물'], ['돌','땅에서 볼 수 있는 단단한 조각'], ['공','발로 차거나 손으로 던져요'],
    ['감','가을에 익는 주황색 과일'], ['곰','몸집이 크고 털이 많은 동물'], ['산','땅이 높이 솟아 있는 곳'], ['손','물건을 잡고 만질 때 써요'],
    ['바다','넓고 짠물이 가득한 곳'], ['바지','두 다리에 나누어 입는 옷'], ['모자','머리에 쓰는 물건'], ['모기','가늘고 긴 다리가 있는 작은 곤충'],
    ['사과','빨갛고 아삭한 과일'], ['사자','갈기가 있는 큰 동물'], ['가방','물건을 넣어 들고 다녀요'], ['사탕','달콤하게 먹는 작은 간식'],
    ['우유','소에게서 얻는 하얀 음료'], ['아이','아직 자라고 있는 어린 사람'], ['우산','비가 올 때 펼쳐서 써요'], ['의자','앉아서 쉬는 가구'],
    ['구두','발에 신는 단단한 신발'], ['포도','작은 알이 송이로 달린 과일'], ['토끼','귀가 길고 깡충깡충 뛰어요'], ['도끼','나무를 벨 때 쓰는 도구'],
    ['바나나','길쭉하고 노란 과일'], ['바구니','물건을 담는 손잡이 달린 그릇'], ['고구마','땅속에서 자라는 달콤한 먹거리'], ['고등어','등에 줄무늬가 있는 바닷물고기'],
    ['소방차','불을 끄러 가는 큰 차'], ['소방관','불을 끄고 사람을 도와주는 사람'], ['해바라기','노란 꽃잎이 있는 큰 꽃'], ['허수아비','밭에서 새를 쫓도록 세워 두는 인형'],
    ['비행기','날개로 하늘을 나는 탈것'], ['비둘기','도시에서도 볼 수 있는 새'], ['눈사람','눈을 뭉쳐서 만든 사람 모양'], ['눈송이','하늘에서 내리는 작은 눈 조각'],
    ['강아지','어린 개를 부르는 말'], ['고양이','야옹 하고 우는 동물'], ['자동차','엔진이나 모터로 도로를 달려요'], ['자전거','페달을 밟아서 움직이는 탈것'],
    ['가면','얼굴에 쓰는 모양 있는 덮개'], ['설탕','음식을 달게 만드는 하얀 가루'], ['구름','하늘에 떠 있는 작은 물방울 무리'], ['그림','선과 색으로 그린 모습'],
    ['달걀','닭이 낳는 둥근 알'], ['달빛','달에서 비치는 은은한 빛'], ['연필깎이','연필 끝을 뾰족하게 깎는 도구'], ['손톱깎이','손톱을 짧게 자르는 도구'],
    ['가만','몸을 움직이지 않고 조용히 있는 모습'], ['거만','자신을 높이고 다른 사람을 낮추어 보는 태도'],
    ['나방','보통 밤에 활동하고 날개를 접어 쉬는 곤충'], ['날','하루하루 지나가는 하루의 시간'], ['남','남자를 가리키는 말'],
    ['널','길고 평평하게 켠 나무판'], ['누님','누나를 높여 부르는 말'], ['느림','움직임이나 일이 천천히 이루어지는 모습'],
    ['묵','도토리나 녹두의 가루를 쑤어 굳힌 음식'], ['밀','빵이나 국수의 재료가 되는 곡식'], ['박','바가지를 만들기도 하는 덩굴 식물의 열매'],
    ['범','호랑이를 부르는 다른 말'], ['법','사회에서 지키기로 정한 규칙'], ['북','두드려 소리를 내는 둥근 악기'],
    ['사','셋보다 하나 많은 수'], ['하','위아래에서 아래를 가리키는 말'], ['문소리','문을 여닫을 때 나는 소리']
  ];
  var vocab = {};
  definitions.forEach(function (row, index) {
    vocab[row[0]] = { meaning: row[1], imageKey: 'ww-word-' + String(index + 1).padStart(2, '0'), media: [] };
  });
  var levels = [
    { id: 'level-1', number: 1, title: '받침 없는 한 글자', mode: 'open-words' },
    { id: 'level-2', number: 2, title: '받침 있는 한 글자', mode: 'assemble' },
    { id: 'level-3', number: 3, title: '받침 있는 두 글자', mode: 'assemble' },
    { id: 'level-4', number: 4, title: '받침 있는 여러글자', mode: 'context' }
  ];
  function unique(values) { return values.filter(function (value, index) { return values.indexOf(value) === index; }); }
  function makeTask(level, id, target, compare) {
    var slots = target.split('').map(function (ch, index) {
      var t = H.decompose(ch), c = H.decompose(compare[index]), options = {};
      var alternatives = {
        cho: ['ㄴ', 'ㅁ', 'ㄱ'],
        jung: t.jung === 'ㅜ' ? ['ㅣ', 'ㅏ', 'ㅓ'] : ['ㅏ', 'ㅓ', 'ㅣ'],
        jong: ['ㄱ', 'ㄴ', 'ㄹ']
      };
      ['cho','jung','jong'].forEach(function (pos) {
        if (pos === 'jong' && !t.jong) { options[pos] = ['']; return; }
        options[pos] = unique([t[pos], c[pos]]);
        if (options[pos].length === 1) {
          options[pos].push(alternatives[pos].find(function (value) { return value !== t[pos]; }));
        }
      });
      return options;
    });
    return { id: id, levelId: level.id, target: target, compare: compare, slots: slots };
  }
  // Each picture occurs in just one target/contrast pair, never as the next target.
  var rows = [
    [['ko','코','소'],['cha','차','파'],['bae','배','새'],['gae','개','해']],
    [['bal','발','벌'],['bam','밤','밥'],['mul','물','불'],['nun','눈','문']],
    [['gabang','가방','가면'],['satang','사탕','설탕'],['gureum','구름','그림'],['dalgyal','달걀','달빛']],
    [['sobangcha','소방차','소방관'],['bihaenggi','비행기','비둘기'],['nunsaram','눈사람','눈송이'],['yeonpilkkakki','연필깎이','손톱깎이']]
  ];
  var prompts = [
    '이 그림은 글자로 어떻게 쓸까? 네가 알려줄래?',
    '그림을 보고 떠오른 낱말을 조각으로 모아 볼까?',
    '그림 속 낱말을 나에게도 알려줄래?',
    '이 그림의 이름을 글자 조각으로 만들어 볼까?',
    '그림을 찬찬히 보고, 어떤 글자가 어울릴지 골라 볼까?',
    '어떤 낱말이 떠올랐니? 조각으로 알려줄래?',
    '이 그림을 부르는 말을 조각으로 모아 줄래?',
    '그림 속 낱말을 글자로 만나 보고 싶어. 함께 만들어 줄래?'
  ];
  var tasks = [];
  levels.forEach(function (level, index) {
    rows[index].forEach(function (row, stage) {
      var task = makeTask(level, 'ww-' + row[0] + '-01', row[1], row[2]);
      task.stage = stage + 1; task.prompt = prompts[(stage + index * 2) % prompts.length]; tasks.push(task);
    });
  });
  WW.data = { activity: 'write-word', mediaEnabled: true, vocab: vocab, levels: levels, tasks: tasks };
  WW.curriculum = {
    progressForLevel: function (state, id) {
      var list = this.tasksForLevel(id), byId = {}, completed = {}, lastTaskId = null;
      list.forEach(function (task) { byId[task.id] = task; });
      (state.history || []).forEach(function (record) {
        if (record.activity !== 'write-word' || !byId[record.id] || record.target !== byId[record.id].target) return;
        if (record.reached) completed[record.id] = true;
        lastTaskId = record.id;
      });
      var saved = (state.writingWordStages || {})[id] || {};
      (Array.isArray(saved.completed) ? saved.completed : []).forEach(function (taskId) { if (byId[taskId]) completed[taskId] = true; });
      if (byId[saved.lastTaskId]) lastTaskId = saved.lastTaskId;
      var bookmark = state.writingWordProgress || {};
      if (bookmark.levelId === id && byId[bookmark.taskId]) lastTaskId = bookmark.taskId;
      return { total: list.length, completed: Object.keys(completed), lastTaskId: lastTaskId, lastStage: lastTaskId ? byId[lastTaskId].stage : null };
    },
    rememberStage: function (state, task, reached) {
      var progress = this.progressForLevel(state, task.levelId);
      if (reached && progress.completed.indexOf(task.id) < 0) progress.completed.push(task.id);
      state.writingWordStages = Object.assign({}, state.writingWordStages || {});
      state.writingWordStages[task.levelId] = { completed: progress.completed, lastTaskId: task.id };
      state.writingWordProgress = { levelId: task.levelId, taskId: task.id, stage: task.stage, at: Date.now() };
    },
    resumeLevel: function (state) {
      var valid = function (id) { return levels.some(function (level) { return level.id === id; }); };
      var bookmark = state.writingWordProgress;
      if (bookmark && valid(bookmark.levelId)) return bookmark.levelId;
      var history = state.history || [];
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].activity === 'write-word' && valid(history[i].levelId)) return history[i].levelId;
      }
      return null;
    },
    tasksForLevel: function (id) { return tasks.filter(function (task) { return task.levelId === id; }); },
    queueForLevel: function (id, held) {
      var list = this.tasksForLevel(id);
      return list.filter(function (task) { return held.indexOf(task.id) >= 0; }).concat(list.filter(function (task) { return held.indexOf(task.id) < 0; }));
    },
    initialSelection: function (task) {
      return task.slots.map(function (slot) {
        var selection = {};
        ['cho','jung','jong'].forEach(function (pos) { selection[pos] = slot[pos].length === 1 ? slot[pos][0] : null; });
        return selection;
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
