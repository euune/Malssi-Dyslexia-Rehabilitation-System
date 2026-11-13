'use strict';
const assert = require('node:assert/strict');
require('../js/hangul.js');
require('../js/engine.js');
require('./logic.js');
const { Run, classify } = globalThis.SG.writingWord.logic;
const task = { id: 'test-bal', target: '발' };
const vocab = { 발: {}, 벌: {} };
const make = () => new Run(task, vocab, {}, 0);

assert.equal(classify('발', '발', vocab).type, 'A');
assert.equal(classify('벌', '발', vocab).type, 'B');
assert.equal(classify('뱔', '발', vocab).type, 'C');
assert.equal(classify('발이요', '발', vocab).type, 'C', 'writing never accepts reading suffixes');
assert.equal(classify('사과나무', '사과', { 사과: {} }).type, 'C', 'no substring acceptance');
assert.equal(classify('toString', '발', vocab).type, 'C');
assert.equal(classify('발', '발', vocab).type, 'A', 'NFC normalization');

let run = make();
assert.equal(run.record(), null, 'unfinished tasks cannot create a terminal record');
assert.equal(run.elapsed(3600000), 3600000);
assert.equal(run.events.length, 0, 'waiting never creates unsolicited feedback');
assert.equal(run.finished, false, 'waiting never ends a task');
assert.equal(run.submit('발', 3600000).reached, true, 'an hour of waiting never blocks submission');
assert.equal(run.hold('leave', 3600001), null, 'terminal transitions are idempotent');

run = make();
let exp = 0;
for (let i = 0; i < 5; i++) {
  const result = run.submit('벌', 1000 + i * 1000);
  exp += result.exp;
  assert.equal(result.retries, i);
  assert.equal(result.level, [1, 2, 3, 3, 4][i]);
  assert.equal(result.held, i === 4);
  assert.equal(run.submit('벌', 1100 + i * 1000), null, 'duplicate click cannot count twice');
  if (i < 4) assert.equal(run.retry(1500 + i * 1000), true);
}
assert.equal(exp, 5, 'participation EXP remains after misses');
assert.equal(run.record().attempts, 5);
assert.equal(run.record().retries, 4);
assert.equal(run.record().reason, 'retry-limit');

run = make();
assert.equal(run.submit('벌', 100).exp, 1);
run.retry(200);
assert.equal(run.submit('발', 300).exp, 3, 'retry and completion awarded once');
assert.equal(run.submit('발', 301), null);
assert.equal(run.record().reached, true);

run = make();
assert.equal(run.submit('발', 60000).reached, true, 'no former deadline on submission');
run = make();
assert.equal(run.submit('발', 59999).reached, true);
run = new Run(task, vocab, { 'ㅏ': 3 }, 0);
assert.equal(run.submit('벌', 100).level, 2, 'known confusion gets earlier visual support');
run = make();
assert.equal(run.hold('leave', 500).exp, 0);
assert.equal(run.record().attempts, 0);
assert.equal(run.record().held, true);

// Content must have real targets/contrasts and every target must be constructible.
require('./data.js');
require('./media.js');
const fs = require('node:fs');
const path = require('node:path');
const data = globalThis.SG.writingWord.data;
const ids = new Set();
for (const item of data.tasks) {
  assert.ok(!ids.has(item.id)); ids.add(item.id);
  assert.ok(data.vocab[item.target]); assert.ok(data.vocab[item.compare]);
  assert.equal(item.slots.length, item.target.length);
  [...item.target].forEach((ch, i) => {
    const parts = globalThis.SG.hangul.decompose(ch);
    for (const pos of ['cho', 'jung', 'jong']) assert.ok(item.slots[i][pos].includes(parts[pos]), `${item.id}: missing target tile`);
  });
}
assert.equal(data.levels.length, 4);
assert.equal(data.tasks.length, 16);
assert.equal(Object.keys(data.vocab).length, 89);
assert.equal(data.mediaEnabled, true, 'picture prompts are enabled');
const keys = new Set();
for (const entry of Object.values(data.vocab)) {
  assert.ok(entry.meaning); assert.ok(entry.imageKey); assert.ok(!keys.has(entry.imageKey)); keys.add(entry.imageKey);
  for (const media of entry.media) {
    assert.ok(media.sourceUrl && media.creator && media.license && media.licenseUrl);
    assert.ok(fs.existsSync(path.resolve(__dirname, media.src)), 'every connected image exists locally');
    if(media.badgeSrc) assert.ok(fs.existsSync(path.resolve(__dirname,media.badgeSrc)),'context badges exist locally');
  }
}
for (const level of data.levels) {
  const levelTasks = globalThis.SG.writingWord.curriculum.tasksForLevel(level.id);
  assert.equal(levelTasks.length, 4);
  const ordered = globalThis.SG.writingWord.curriculum.queueForLevel(level.id, [levelTasks[3].id, 'different-level']);
  assert.equal(ordered[0].id, levelTasks[3].id);
  assert.ok(ordered.every(item => item.levelId === level.id));
  for (const item of levelTasks) {
    const defaults = globalThis.SG.writingWord.curriculum.initialSelection(item);
    let editable = 0;
    [...item.compare].forEach((ch, index) => {
      const parts = globalThis.SG.hangul.decompose(ch);
      for (const pos of ['cho', 'jung', 'jong']) {
        if (pos !== 'jong' || globalThis.SG.hangul.decompose(item.target[index]).jong) assert.ok(item.slots[index][pos].includes(parts[pos]), `${item.id}: visible comparison parts remain constructible`);
        if (item.slots[index][pos].length === 1) assert.equal(defaults[index][pos], item.slots[index][pos][0]);
        else { assert.equal(defaults[index][pos], null); editable++; }
      }
    });
    assert.ok(editable > 0, 'no task starts already solved');
    if (level.number === 1) { assert.equal(item.target.length, 1); assert.equal(editable, 2); assert.ok(!globalThis.SG.hangul.hasJong(item.target)); }
    if (level.number === 2) { assert.equal(item.target.length, 1); assert.equal(editable, 3); }
    if (level.number === 3) assert.equal(item.target.length, 2);
    if (level.number >= 2) assert.ok([...item.target].some(ch => globalThis.SG.hangul.hasJong(ch)), 'later stages include a final consonant');
    if (level.number === 4) assert.ok(item.target.length >= 3 && item.target.length <= 4);
    const taskRun = new Run(item, data.vocab, {}, 0);
    assert.equal(taskRun.submit(item.compare, 100).type, 'B');
    taskRun.retry(200);
    assert.equal(taskRun.submit(item.target, 300).type, 'A');
  }
}
console.log('Writing-word policy: all assertions passed.');

run = make();
assert.equal(run.pause(5000), true);
assert.equal(run.pause(6000), false, 'nested pauses cannot move the start');
assert.equal(run.elapsed(100000), 5000, 'duration stops while paused');
assert.equal(run.submit('발', 100000), null, 'paused tasks cannot submit');
assert.equal(run.resume(100000), true);
assert.equal(run.resume(100001), false);
assert.equal(run.elapsed(155000), 60000, 'active time excludes pauses');
assert.equal(run.events.length, 0, 'resuming never creates unsolicited feedback');
assert.equal(run.submit('발', 155000).reached, true);
assert.equal(run.record().ms, 60000, 'task duration excludes paused time');
run = make(); run.pause(5000); run.hold('leave', 999999);
assert.equal(run.record().ms, 5000, 'leaving while paused records only active time');
assert.equal(run.resume(1000000), false, 'terminal task cannot resume');
run = make(); run.runId = 'recover-me'; run.submit('벌', 1000);
const recovery = run.interruptedRecord(1500);
assert.equal(recovery.attempts, 1);
assert.equal(recovery.runId, 'recover-me');
assert.equal(recovery.reason, 'interrupted');
assert.equal(run.finished, false, 'snapshot does not terminate the live task');

require('./session.js');
const memory = new Map();
const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const sessions = globalThis.SG.writingWord.session.create(storage, data.tasks);
const fixtureTasks = data.tasks.filter(item => item.levelId === 'level-2');
const draftRun = new Run(fixtureTasks[1], data.vocab, {}, 0); draftRun.runId = 'resume-one';
draftRun.choose(0, 'cho', 'ㅂ', 500);
const checkpoint = {
  version: 2, levelId: 'level-2', at: 1000, queue: fixtureTasks.map(item => item.id), cursor: 1,
  summary: { attempts: 1, retries: 0, completed: 1, held: 0, totalReachMs: 900, reachCount: 1, bloomed: 0 },
  learned: ['발'], draft: {
    selection: [{ cho: 'ㅂ', jung: null, jong: null }], choices: fixtureTasks[1].slots,
    record: draftRun.interruptedRecord(1000)
  }
};
assert.equal(sessions.save(checkpoint), true);
assert.deepEqual(sessions.load(2000), checkpoint);
assert.equal(sessions.load(86401001), null, 'expired sessions are not resumed');
assert.equal(memory.size, 0);
for (const corrupt of [
  value => { value.queue[0] = value.queue[1]; },
  value => { value.cursor = 99; },
  value => { value.levelId = 'level-4'; },
  value => { value.version = 1; },
  value => { value.draft.selection[0].jung = 'A'; },
  value => { value.draft.choices[0].cho = ['ㅂ', 'ㅂ']; },
  value => { value.summary.attempts = -1; },
  value => { value.draft.record.runId = ''; },
  value => { value.draft.record.reached = true; },
  value => { value.draft.record.held = false; },
  value => { value.draft.record.reason = 'reached'; },
  value => { value.draft.record.retries = 4; },
  value => { value.draft.record.at = 'broken'; },
  value => { value.draft.record.events = [{ type: 'A', ms: 10 }]; },
  value => { value.draft.record.inputs[0].pos = 'other'; },
  value => { value.draft.record.inputs[0].ms = 999999; },
  value => { value.draft.record.inputs[0].at = -1; },
  value => { value.draft.record.inputCount = 10; },
  value => { value.draft.record.noInputMs = -1; },
  value => { value.draft.record.selection[0].cho = null; },
  value => { value.learned = ['미등록']; }
]) {
  const copy = JSON.parse(JSON.stringify(checkpoint)); corrupt(copy); sessions.save(copy);
  assert.equal(sessions.load(2000), null, 'invalid saved content is discarded safely');
}
memory.set('malssi.write-word.session.v1', '{broken');
assert.equal(sessions.load(2000), null);
const blocked = globalThis.SG.writingWord.session.create(null, data.tasks);
assert.equal(blocked.load(2000), null);
assert.equal(blocked.save(checkpoint), false, 'storage denial does not stop play');
const recoveredHistory = [], recoveredHolds = [];
const recoveryStore = {
  get: () => ({ history: recoveredHistory }),
  addHold: (activity, id) => recoveredHolds.push({ activity, id }),
  addHistory: record => recoveredHistory.push(record)
};
assert.equal(globalThis.SG.writingWord.session.recoverRecord(recoveryStore, checkpoint), true);
assert.equal(globalThis.SG.writingWord.session.recoverRecord(recoveryStore, checkpoint), false);
assert.equal(recoveredHistory.length, 1, 'recovery is idempotent across repeated reloads');
assert.equal(recoveredHolds.length, 1);
const falseCompletion = JSON.parse(JSON.stringify(checkpoint));
falseCompletion.draft.record.reached = true;
assert.equal(globalThis.SG.writingWord.session.recoverRecord(recoveryStore, falseCompletion), false, 'recovery cannot introduce a completed record');
assert.equal(recoveredHistory[0].levelId, 'level-2');
assert.equal(globalThis.SG.writingWord.session.recoverRecord(recoveryStore, null), false);
const guidedTasks = data.tasks.filter(item => item.levelId === 'level-1');
const guidedRun = new Run(guidedTasks[0], data.vocab, {}, 0); guidedRun.runId = 'fixed-draft';
const guidedCheckpoint = {
  ...checkpoint, levelId: 'level-1', queue: guidedTasks.map(item => item.id), cursor: 0, learned: [],
  draft: { selection: globalThis.SG.writingWord.curriculum.initialSelection(guidedTasks[0]), choices: guidedTasks[0].slots, record: guidedRun.interruptedRecord(1000) }
};
sessions.save(guidedCheckpoint);
assert.ok(sessions.load(2000), 'new tasks restore unselected parts');
guidedCheckpoint.draft.selection[0].jong = 'ㅍ';
sessions.save(guidedCheckpoint);
assert.equal(sessions.load(2000), null, 'a foreign jamo cannot enter a restored task');
memory.set('unrelated-key', 'keep');
memory.set('malssi.write-word.session.v1', '{bad');
sessions.load(2000);
assert.equal(memory.get('unrelated-key'), 'keep', 'discarding a checkpoint never clears other records');
for (const [target, id] of [['발','ww-bal-01'],['밤','ww-bam-01'],['물','ww-mul-01'],['눈','ww-nun-01']]) {
  assert.equal(data.tasks.find(item => item.target === target).id, id, 'existing history IDs stay compatible');
}
console.log('Pause and session recovery: all assertions passed.');

// The final opportunity preserves the response category instead of replacing its meaning with the target.
const { feedbackMessage } = globalThis.SG.writingWord.logic;
for (const response of ['벌', '뱔']) {
  run = make();
  let last;
  for (let i = 0; i < 5; i++) {
    last = run.submit(response, 100 + i * 100);
    if (i < 4) run.retry(150 + i * 100);
  }
  const message = feedbackMessage(last, task.target);
  assert.ok(last.held);
  assert.ok(message.includes(response === '벌' ? '‘벌’이 피어났네!' : '내가 아직 잘 모르는 말이네.'));
  assert.ok(message.includes('다른 그림도 만나 볼까?'));
  assert.equal(globalThis.SG.engine.verifyText(message, 'generic'), message, 'final messages pass the shared language filter');
}

// Input trace uses active time, keeps real timestamps, and never counts a fixed ending or listening as a tile choice.
const traceTask = data.tasks.find(item => item.target === '코');
run = new Run(traceTask, data.vocab, {}, 1000); run.runId = 'trace';
assert.equal(run.selection[0].jong, '');
assert.equal(run.choose(0, 'jong', '', 1100), false);
assert.equal(run.choose(0, 'cho', 'X', 1100), false);
assert.equal(run.choose(-1, 'cho', 'ㅋ', 1100), false);
assert.equal(run.noteListen('코', 1200), true);
assert.equal(run.interruptedRecord(1300).inputCount, 0);
assert.equal(run.interruptedRecord(1300).noInputMs, 300);
run.pause(1500);
assert.equal(run.choose(0, 'cho', 'ㅋ', 2000), false);
assert.equal(run.noteListen('코', 2000), false);
run.resume(11500);
assert.equal(run.choose(0, 'cho', 'ㅋ', 12000), true);
assert.equal(run.choose(0, 'jung', 'ㅗ', 12100), true);
const trace = run.interruptedRecord(12500);
assert.equal(trace.startedAt, new Date(1000).toISOString());
assert.equal(trace.firstInputAt, new Date(12000).toISOString());
assert.equal(trace.firstInputMs, 1000, 'initial no-input duration excludes pause');
assert.equal(trace.ms, 1500);
assert.equal(trace.inputCount, 2);
assert.equal(trace.listenCount, 1);
trace.selection[0].cho = 'ㅅ'; trace.inputs[0].value = 'ㅅ';
assert.equal(run.selection[0].cho, 'ㅋ', 'snapshots do not mutate live selection');
assert.equal(run.inputs[0].value, 'ㅋ');
run.submit('소', 12600);
assert.equal(run.choose(0, 'cho', 'ㅅ', 12610), false, 'feedback is not editable');
run.retry(12700);
run.choose(0, 'cho', 'ㅅ', 12800);
run.hold('leave', 13000);
assert.equal(run.record().inputCount, 3);
assert.equal(run.choose(0, 'cho', 'ㅋ', 13100), false);

const traceSessions = globalThis.SG.writingWord.session.create(storage, data.tasks);
const traceCheckpoint = { ...checkpoint, levelId: 'level-1', queue: guidedTasks.map(item => item.id), cursor: 0, learned: [],
  draft: { selection: run.selection, choices: traceTask.slots, record: { ...run.record(), runId: run.runId } }, at: 13000 };
traceSessions.save(traceCheckpoint);
assert.ok(traceSessions.load(14000), 'leaving after feedback and a partial edit remains recoverable');
const legacyCheckpoint = JSON.parse(JSON.stringify(checkpoint));
for (const key of ['startedAt','firstInputAt','lastInputAt','firstInputMs','noInputMs','inputCount','inputs','inputHistoryTruncated','selection','listenCount','listens','resumedFrom']) delete legacyCheckpoint.draft.record[key];
sessions.save(legacyCheckpoint);
assert.ok(sessions.load(2000), 'valid checkpoints made before trace support remain usable');

run = new Run(traceTask, data.vocab, {}, 0);
for (let i = 0; i < 70; i++) { run.choose(0, 'cho', i % 2 ? 'ㅋ' : 'ㅅ', i + 1); run.noteListen('코', i + 1); }
const boundedTrace = run.interruptedRecord(100);
assert.equal(boundedTrace.inputCount, 70);
assert.equal(boundedTrace.inputs.length, 64);
assert.equal(boundedTrace.inputHistoryTruncated, true);
assert.equal(boundedTrace.firstInputMs, 1, 'truncating later records preserves the first input time');
assert.equal(boundedTrace.listenCount, 70);
assert.equal(boundedTrace.listens.length, 8);
boundedTrace.runId = 'bounded-trace';
traceSessions.save({ ...traceCheckpoint, at: 100, draft: { selection: run.selection, choices: traceTask.slots, record: boundedTrace } });
assert.ok(traceSessions.load(200), 'bounded traces can be restored after many inputs');
const untouchedRun = new Run(traceTask, data.vocab, {}, 0); untouchedRun.runId = 'untouched';
untouchedRun.noteListen('코', 100);
traceSessions.save({ ...traceCheckpoint, at: 500, draft: { selection: untouchedRun.selection, choices: traceTask.slots, record: untouchedRun.interruptedRecord(500) } });
assert.ok(traceSessions.load(600), 'listen-only and no tile input is a valid unfinished task');
for (const key of ['정답', '오답', '틀렸어', '실패', '점수', '훈련', '치료', '다시 해']) {
  assert.ok(!globalThis.SG.engine.verifyText(key, 'generic').includes(key), 'specification evaluation terms are filtered');
}
assert.deepEqual(globalThis.SG.engine.CONFIG.stageThresholds, [10,20,30,40,50,60]);
console.log('Specification feedback and input trace: all assertions passed.');

// Closing messages describe actual participation and stay short even when many conditions apply.
const { sessionMessages } = globalThis.SG.writingWord.logic;
const closingSummary = { attempts: 0, retries: 0, reachCount: 0, totalReachMs: 0, bloomed: 0, held: 1, quitEarly: true };
const beforeSubmission = sessionMessages(closingSummary);
assert.equal(beforeSubmission.length, 1, 'exiting before a submission does not add a hold/retry message');
assert.ok(!beforeSubmission.join('').includes('알려준 말') && !beforeSubmission.join('').includes('피운'), 'no invented learning result before a submission');
for (const summary of [
  { ...closingSummary, attempts: 1 },
  { ...closingSummary, attempts: 4, retries: 3, reachCount: 1, totalReachMs: 40000, bloomed: 2, quitEarly: false },
  { ...closingSummary, attempts: 2, reachCount: 1, totalReachMs: 40000, held: 0, quitEarly: false },
  { ...closingSummary, attempts: 2, bloomed: 1, held: 0, quitEarly: false }
]) {
  const messages = sessionMessages(summary);
  assert.ok(messages.length > 0 && messages.length <= 2, 'closing messages never pile up');
  assert.ok(messages.every(text => globalThis.SG.engine.verifyText(text, 'session') === text));
  assert.ok(!messages.join('').includes('들려'), 'touch activity does not claim spoken input');
}
console.log('Participation-aware closing messages: all assertions passed.');

const curriculum = globalThis.SG.writingWord.curriculum;
assert.deepEqual(data.levels.map(level => level.title), ['받침 없는 한 글자', '받침 있는 한 글자', '받침 있는 두 글자', '받침 있는 여러글자']);
assert.ok(data.levels.every(level => !level.examples && !level.description), 'level chooser has no word spoilers or descriptions');
assert.equal(curriculum.resumeLevel({}), null, 'first visit has no invented progress');
assert.equal(curriculum.resumeLevel({ writingWordProgress: { levelId: 'level-3' } }), 'level-3');
assert.equal(curriculum.resumeLevel({ history: [{ activity: 'read-word', levelId: 'level-4' }, { activity: 'write-word', levelId: 'level-2' }] }), 'level-2');
assert.equal(curriculum.resumeLevel({ writingWordProgress: { levelId: 'unknown' }, history: [{ activity: 'write-word', levelId: 'level-1' }] }), 'level-1', 'older records remain usable');
console.log('Unhurried play and stage bookmarks: all assertions passed.');

// A chosen stage is independent of previously completed stages; records never lock it.
const progressState = { history: [
  {activity:'write-word', id:data.tasks[0].id, target:data.tasks[0].target, reached:true},
  {activity:'read-word', id:data.tasks[1].id, target:data.tasks[1].target, reached:true}
] };
const firstProgress = curriculum.progressForLevel(progressState, 'level-1');
assert.deepEqual(firstProgress.completed, [data.tasks[0].id]);
assert.equal(firstProgress.lastStage, 1);
const jumpTask = data.tasks.find(task => task.levelId === 'level-4' && task.stage === 3);
curriculum.rememberStage(progressState, jumpTask, false);
assert.equal(curriculum.progressForLevel(progressState,'level-4').lastStage,3);
assert.equal(curriculum.progressForLevel(progressState,'level-4').completed.length,0,'jumping never marks skipped stages complete');
curriculum.rememberStage(progressState,jumpTask,true);
curriculum.rememberStage(progressState,jumpTask,true);
assert.deepEqual(curriculum.progressForLevel(progressState,'level-4').completed,[jumpTask.id],'completion is idempotent');
progressState.history=[];
assert.deepEqual(curriculum.progressForLevel(progressState,'level-4').completed,[jumpTask.id],'completion survives common history truncation');
assert.equal(curriculum.progressForLevel(progressState,'level-1').lastStage,null);
assert.equal(curriculum.tasksForLevel('level-1').length,4,'all stages remain available');
progressState.writingWordStages['level-3']={completed:['invalid',jumpTask.id],lastTaskId:jumpTask.id};
assert.equal(curriculum.progressForLevel(progressState,'level-3').completed.length,0,'foreign task IDs never contaminate progress');
for(const level of data.levels){
  const list=curriculum.tasksForLevel(level.id);
  assert.deepEqual(list.map(task=>task.stage),[1,2,3,4]);
  assert.equal(new Set(list.map(task=>task.prompt)).size,4,'each stage gets a varied picture-based prompt');
  for(const task of list){
    assert.ok(!task.prompt.includes('‘'+task.target+'’'),'prompts never explicitly name the target');
    assert.ok(data.vocab[task.target].media.length && data.vocab[task.compare].media.length);
    task.slots.forEach((slot,index)=>{
      for(const pos of ['cho','jung','jong']) {
        const hiddenEnd=pos==='jong' && !globalThis.SG.hangul.decompose(task.target[index]).jong;
        assert.equal(slot[pos].length,hiddenEnd?1:2,'only necessary jamo groups have two choices');
        assert.equal(new Set(slot[pos]).size,slot[pos].length,'choices are distinct');
        assert.equal(curriculum.initialSelection(task)[index][pos],hiddenEnd?'':null,'only absent endings are filled without input');

      }
    });
    // Every registered alternative reachable through the tiles has its actual picture.
    const parts=task.slots.map(slot=>slot.cho.flatMap(c=>slot.jung.flatMap(v=>slot.jong.map(f=>globalThis.SG.hangul.compose(c,v,f)))));
    let words=[''];for(const choices of parts)words=words.flatMap(prefix=>choices.map(c=>prefix+c));
    for(const word of words)if(data.vocab[word])assert.ok(data.vocab[word].media.length, task.id+': missing meaningful response picture '+word);
  }
}
console.log('Free stage selection, progress migration, prompts and picture coverage: all assertions passed.');

const scheduledPictures = new Set();
const pictureHashes = new Set();
for (const task of data.tasks) {
  for (const word of [task.target,task.compare]) {
    const src=data.vocab[word].media[0].src;
    assert.ok(!scheduledPictures.has(src), 'a picture never appears in a later target/contrast pair');
    scheduledPictures.add(src);
    const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,src))).digest('hex');
    assert.ok(!pictureHashes.has(hash),'identical image files cannot recur under different names');
    pictureHashes.add(hash);
  }
}
assert.equal(scheduledPictures.size,32,'16 stages have disjoint target and comparison pictures');
const migrated = {history:[{activity:'write-word',id:'ww-bam-01',target:'밤',reached:true}],writingWordStages:{'level-2':{completed:['ww-bam-01','ww-beol-01'],lastTaskId:'ww-bam-01'}}};
assert.deepEqual(curriculum.progressForLevel(migrated,'level-2').completed,['ww-bam-01']);
assert.equal(curriculum.progressForLevel(migrated,'level-2').lastStage,2,'progress follows task IDs when stages are renumbered');
const obsoleteCheckpoint=JSON.parse(JSON.stringify(checkpoint));
obsoleteCheckpoint.queue=['ww-bal-01','ww-beol-01','ww-bam-01','ww-bap-01','ww-mul-01','ww-bul-01','ww-nun-01','ww-mun-01'];
sessions.save(obsoleteCheckpoint);
assert.equal(sessions.load(2000),null,'old eight-stage checkpoints are rejected without resetting common progress');
assert.equal(memory.get('unrelated-key'),'keep');
console.log('Four stages, unique picture pairs and two choices for every jamo: all assertions passed.');

const {responseParts,encouragement}=globalThis.SG.writingWord.logic;
assert.deepEqual(responseParts('발','벌')[0].filter(p=>p.changed).map(p=>[p.pos,p.value]),[['jung','ㅓ']]);
assert.deepEqual(responseParts('가방','나방').flatMap((ps,i)=>ps.filter(p=>p.changed).map(p=>[i,p.pos,p.value])),[[0,'cho','ㄴ']]);
assert.deepEqual(responseParts('발','널')[0].filter(p=>p.changed).map(p=>p.pos),['cho','jung']);
assert.deepEqual(responseParts('발','바')[0].filter(p=>p.changed).map(p=>[p.pos,p.value]),[['jong','']],'missing final consonant is shown explicitly as absent');
assert.ok(responseParts('발','발').flat().every(p=>!p.changed));
assert.equal(responseParts('코','소')[0].length,2,'irrelevant empty endings do not appear even in feedback');
assert.equal(new Set([0,1,2,3].map(encouragement)).size,4,'repeat attempts receive distinct encouragement');
for(const r of [0,1,2,3,999])assert.ok(!/정답|오답|실패|틀렸|파란/.test(encouragement(r)));
const fixed=JSON.parse(JSON.stringify(guidedCheckpoint));
fixed.draft.selection[0]=globalThis.SG.writingWord.curriculum.initialSelection(guidedTasks[0])[0];
fixed.draft.selection[0].jong=null;sessions.save(fixed);
assert.equal(sessions.load(2000),null,'a hidden ending can never restore as an unselectable null');
console.log('Optional endings, exact response differences and varied encouragement: all assertions passed.');

const vocabularyReview=require('./vocabulary-review.json');
const allCombinations=new Set();
for(const item of data.tasks){
  let combinations=[''];
  for(const slot of item.slots){
    const syllables=slot.cho.flatMap(c=>slot.jung.flatMap(v=>slot.jong.map(f=>globalThis.SG.hangul.compose(c,v,f))));
    combinations=combinations.flatMap(prefix=>syllables.map(ch=>prefix+ch));
  }
  combinations.forEach(w=>allCombinations.add(w));
}
const sorted=[...allCombinations].sort();
assert.equal(sorted.length,vocabularyReview.combinationCount);
assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(sorted)).digest('hex'),vocabularyReview.combinationSha256,'changed choices require a fresh vocabulary review');
assert.deepEqual(sorted.filter(w=>data.vocab[w]),vocabularyReview.approvedReachableWords);
for(const word of vocabularyReview.approvedReachableWords){
  assert.ok(data.vocab[word].media.length,'all accepted reachable words have a meaning picture: '+word);
  assert.equal(classify(word,'다른목표',data.vocab).type,'B');
}
for(const word of vocabularyReview.addedEverydayWords)assert.ok(allCombinations.has(word),'new response words are actually constructible');
assert.equal(classify('션폴넉나','연필깎이',data.vocab).type,'C');
console.log('Everyday vocabulary audit: all 2,765 combinations and 46 accepted response words checked.');
