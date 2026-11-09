/*
 * 데이터베이스 연결부: 브라우저 저장(localStorage)을 Supabase 와 맞춰 둠
 *
 * - 게임 코드는 그대로 localStorage 에 저장하고, 이 파일이 그 내용을 서버에도 올려요.
 *     · 'seed-garden-v1'     : 씨앗 이름·경험치·보류·설정·이력 (js/store.js)
 *     · 'malssi.reading.v1'  : 동화 읽기 진행 (reading-sentence/app.js)
 * - 과제 기록(addHistory)과 헷갈린 자소(recordConfusion)는 따로 표로 쌓아서 선생님이 볼 수 있게 해요.
 * - 아이마다 8자리 "학습 기록 코드"가 생겨요. 다른 기기에서 코드를 넣으면 같은 기록으로 이어서 해요.
 * - 인터넷이 끊기거나 설정이 비어 있어도 게임은 그대로 동작해요 (나중에 다시 올림).
 *
 * 불러오는 순서: js/store.js → js/db-config.js → js/db.js
 */
(function (root) {
  'use strict';
  var SG = root.SG = root.SG || {};
  var CFG = SG.DB_CONFIG || {};
  var SYNC_KEYS = ['seed-garden-v1', 'malssi.reading.v1'];
  var CODE_KEY = 'malssi.learner-code';
  var META_KEY = 'malssi.db-meta';   // { dirty, serverAt, forcePull }
  var QUEUE_KEY = 'malssi.db-queue'; // { history: [], confusion: [] } 아직 못 올린 기록

  var ls = null;
  try { ls = root.localStorage; } catch (e) { ls = null; }
  var enabled = !!(CFG.url && CFG.anonKey && ls && root.fetch);
  var status = enabled ? 'connecting' : 'off'; // off | connecting | ok | offline | error
  var listeners = [];
  var rawSet = enabled ? root.Storage.prototype.setItem : null;
  var changeSeq = 0;
  var pushTimer = null;
  var pushing = null;

  function setStatus(s) { status = s; listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* 무시 */ } }); }
  function get(k) { try { return ls.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { rawSet.call(ls, k, v); } catch (e) { /* 무시 */ } }
  function del(k) { try { ls.removeItem(k); } catch (e) { /* 무시 */ } }
  function readJson(k, fallback) { try { return JSON.parse(get(k)) || fallback; } catch (e) { return fallback; } }
  function meta() { return readJson(META_KEY, {}); }
  function setMeta(patch) { var m = meta(); Object.keys(patch).forEach(function (k) { m[k] = patch[k]; }); put(META_KEY, JSON.stringify(m)); }
  function queue() { var q = readJson(QUEUE_KEY, {}); q.history = q.history || []; q.confusion = q.confusion || []; return q; }
  function setQueue(q) { put(QUEUE_KEY, JSON.stringify(q)); }

  /** 코드 모양 맞추기: "k7qm-3xpa" → "K7QM3XPA" */
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function prettyCode(c) { c = normCode(c); return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }
  function code() { return normCode(get(CODE_KEY)); }

  function rpc(fn, args, keepalive) {
    return root.fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      keepalive: !!keepalive,
      headers: { 'Content-Type': 'application/json', apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey },
      body: JSON.stringify(args)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { var e = new Error(t || ('HTTP ' + r.status)); e.status = r.status; throw e; });
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }
  /** 서버 시각 비교 (표기 방식이 조금 달라도 같은 시각이면 같다고 봄) */
  function sameTime(a, b) { return a === b || (!!a && !!b && Date.parse(a) === Date.parse(b)); }
  function isUnknownCode(e) { return e && /unknown learner code/.test(e.message); }
  function fail(e) {
    if (isUnknownCode(e)) { del(CODE_KEY); setStatus('error'); }
    else setStatus(e && e.status ? 'error' : 'offline');
    if (root.console) console.warn('[말씨 DB]', e && e.message);
  }

  function snapshot() {
    var d = {};
    SYNC_KEYS.forEach(function (k) { var v = get(k); if (v != null) { try { d[k] = JSON.parse(v); } catch (e) { /* 무시 */ } } });
    return d;
  }
  function apply(data) {
    SYNC_KEYS.forEach(function (k) {
      if (data && data[k] !== undefined) put(k, JSON.stringify(data[k]));
      else del(k);
    });
  }
  function reloadOnce() {
    var flag = 'malssi.db-reloaded';
    var last = 0;
    try { last = Number(root.sessionStorage.getItem(flag)) || 0; } catch (e) { /* 무시 */ }
    if (Date.now() - last < 10000) return; // 연달아 새로고침 방지
    try { root.sessionStorage.setItem(flag, String(Date.now())); } catch (e) { /* 무시 */ }
    root.location.reload();
  }

  /** 코드가 없으면 새 학습자를 만들어 코드 받기 */
  var registering = null; // 동시에 두 번 불려도 학습자는 하나만 만들기
  function ensureCode() {
    var c = code();
    if (c) return Promise.resolve(c);
    if (registering) return registering;
    var st = readJson('seed-garden-v1', {});
    registering = rpc('malssi_register', { p_seed_name: st.seedName || null }).then(function (newCode) {
      put(CODE_KEY, newCode);
      setMeta({ serverAt: null });
      registering = null;
      return newCode;
    }, function (e) { registering = null; throw e; });
    return registering;
  }

  /** 쌓인 과제 기록·헷갈린 자소 올리기 */
  function flushQueue(c, keepalive) {
    var q = queue();
    var h = q.history.slice(0, 200);
    var cf = q.confusion.slice(0, 200);
    var jobs = [];
    if (h.length) jobs.push(rpc('malssi_log_history', { p_code: c, p_rows: h }, keepalive).then(function () {
      var q2 = queue(); q2.history = q2.history.slice(h.length); setQueue(q2);
    }));
    if (cf.length) jobs.push(rpc('malssi_log_confusion', { p_code: c, p_rows: cf }, keepalive).then(function () {
      var q2 = queue(); q2.confusion = q2.confusion.slice(cf.length); setQueue(q2);
    }));
    return Promise.all(jobs);
  }

  /** 지금 상태를 서버에 올리기 */
  function push(keepalive) {
    if (!enabled) return Promise.resolve();
    if (pushing && !keepalive) return pushing.then(function () { return meta().dirty || queue().history.length ? push() : null; });
    var seq = changeSeq;
    var m = meta();
    var p = ensureCode().then(function (c) {
      return flushQueue(c, keepalive).then(function () {
        if (!m.dirty && m.serverAt) return null;
        return rpc('malssi_save', { p_code: c, p_data: snapshot() }, keepalive).then(function (at) {
          setMeta({ serverAt: at, dirty: seq !== changeSeq });
        });
      });
    }).then(function () { setStatus('ok'); }, fail);
    if (!keepalive) pushing = p.then(function () { pushing = null; });
    return p;
  }
  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(); }, 1500);
  }

  /** 시작할 때 서버와 맞추기 */
  function start() {
    var c = code();
    if (!c) { setStatus('ok'); if (meta().dirty) schedulePush(); return; } // 첫 저장 때 코드를 만듦
    rpc('malssi_load', { p_code: c }).then(function (res) {
      if (!res) { del(CODE_KEY); setMeta({ serverAt: null, forcePull: false }); setStatus('error'); return; }
      var m = meta();
      var serverChanged = !sameTime(res.updated_at, m.serverAt);
      var hasServerData = res.data && Object.keys(res.data).length > 0;
      if (m.forcePull || (serverChanged && !m.dirty && hasServerData)) {
        // 다른 기기에서 더 최근에 저장함 → 서버 내용으로 바꾸고 새로고침
        apply(res.data);
        setMeta({ serverAt: res.updated_at, dirty: false, forcePull: false });
        setStatus('ok');
        reloadOnce();
      } else if (m.dirty || !hasServerData) {
        push(); // 이 기기에 아직 안 올린 변경이 있음 (같은 때 두 기기에서 했다면 나중에 저장한 쪽이 남음)
      } else {
        setStatus('ok');
        if (queue().history.length || queue().confusion.length) push();
      }
    }, fail);
  }

  /** 다른 기기의 코드로 이어 하기 */
  function link(input) {
    var c = normCode(input);
    if (c.length !== 8) return Promise.reject(new Error('코드는 8자리예요.'));
    return rpc('malssi_load', { p_code: c }).then(function (res) {
      if (!res) throw new Error('그 코드를 찾을 수 없어요.');
      put(CODE_KEY, c);
      setQueue({ history: [], confusion: [] });
      setMeta({ forcePull: true, dirty: false, serverAt: null });
      apply(res.data);
      setMeta({ forcePull: false, serverAt: res.updated_at });
      root.location.reload();
    });
  }

  if (enabled) {
    // 1) 주소에 ?learner=코드 가 있으면 그 기록으로 이어 하기
    try {
      var params = new URLSearchParams(root.location.search);
      var fromUrl = normCode(params.get('learner'));
      if (fromUrl.length === 8 && fromUrl !== code()) {
        put(CODE_KEY, fromUrl);
        setQueue({ history: [], confusion: [] });
        setMeta({ forcePull: true, dirty: false, serverAt: null });
      }
      if (params.has('learner')) {
        params.delete('learner');
        var q = params.toString();
        root.history.replaceState(null, '', root.location.pathname + (q ? '?' + q : '') + root.location.hash);
      }
    } catch (e) { /* 무시 */ }

    // 2) 게임이 저장할 때마다 서버에도 올리기
    root.Storage.prototype.setItem = function (k, v) {
      rawSet.apply(this, arguments);
      if (this === ls && SYNC_KEYS.indexOf(k) >= 0) { changeSeq++; setMeta({ dirty: true }); schedulePush(); }
    };

    // 3) 과제 기록·헷갈린 자소를 표로 쌓기
    if (SG.store) {
      var addHistory = SG.store.addHistory;
      SG.store.addHistory = function (rec) {
        var q = queue(); q.history.push(rec); if (q.history.length > 1000) q.history.shift(); setQueue(q);
        return addHistory.apply(this, arguments);
      };
      var recordConfusion = SG.store.recordConfusion;
      SG.store.recordConfusion = function (diffs) {
        var q = queue();
        var at = new Date().toISOString();
        (diffs || []).forEach(function (d) { if (d && d.target) q.confusion.push({ target: d.target, heard: d.heard || null, at: at }); });
        if (q.confusion.length > 1000) q.confusion = q.confusion.slice(-1000);
        setQueue(q);
        return recordConfusion.apply(this, arguments);
      };
    }

    // 4) 페이지를 떠날 때 남은 것 올리기
    root.addEventListener('pagehide', function () { if (meta().dirty || queue().history.length || queue().confusion.length) push(true); });

    start();
  }

  /** 설정 화면에 넣을 "학습 기록" 칸 (js/core.js 의 showSettings 에서 사용) */
  function settingsBlock(el) {
    if (!enabled) {
      return el('div', { class: 'set-group' }, [
        el('b', { text: '학습 기록 저장' }),
        el('small', { class: 'muted', text: '서버 저장이 꺼져 있어요. 기록은 이 기기에만 남아요. (js/db-config.js 설정)' })
      ]);
    }
    var line = el('small', { class: 'muted' });
    function draw() {
      var c = code();
      var s = { connecting: '연결 중…', ok: '서버에 저장되고 있어요 ✅', offline: '인터넷이 끊겨 잠시 이 기기에만 저장 중이에요', error: '서버 저장에 문제가 있어요' }[status] || '';
      line.textContent = (c ? '학습 기록 코드: ' + prettyCode(c) + ' · ' : '첫 활동을 하면 학습 기록 코드가 생겨요 · ') + s;
    }
    draw();
    listeners.push(draw);
    var input = el('input', { type: 'text', placeholder: '예: K7QM-3XPA', maxlength: '9', 'aria-label': '학습 기록 코드', autocomplete: 'off' });
    var msg = el('small', { class: 'muted' });
    var btn = el('button', { class: 'btn ghost small', text: '이 코드로 이어 하기', onclick: function () {
      if (!input.value.trim()) { msg.textContent = '코드를 입력해 주세요.'; return; }
      if (!confirm('이 기기의 지금 기록 대신 그 코드의 기록으로 이어 할까요?')) return;
      btn.disabled = true; msg.textContent = '불러오는 중…';
      link(input.value).catch(function (e) { btn.disabled = false; msg.textContent = e.message; });
    } });
    return el('div', { class: 'set-group' }, [
      el('b', { text: '학습 기록 저장' }),
      line,
      el('div', { class: 'row db-link' }, [input, btn]),
      msg
    ]);
  }

  SG.db = {
    enabled: enabled,
    status: function () { return status; },
    code: function () { return prettyCode(code()); },
    onStatus: function (fn) { listeners.push(fn); },
    push: push,
    link: link,
    settingsBlock: settingsBlock
  };
})(typeof window !== 'undefined' ? window : globalThis);
