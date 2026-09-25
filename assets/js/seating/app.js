/* مخطط الجلوس — الواجهة والتفاعل */
(function () {
  const { store, sound } = window.Rafeeq;
  const T = window.SeatTemplates, E = window.SeatEngine, TR = window.SeatTransition, RD = window.SeatRender;
  const Classes = window.RafeeqClasses;
  const U = RD.U;
  const el = id => document.getElementById(id);
  const esc = RD.esc;
  const clone = o => JSON.parse(JSON.stringify(o));

  const DEMO_NAMES = ['عبدالله محمد', 'سارة أحمد', 'يوسف خالد', 'نورة سالم', 'فهد علي', 'مريم حسن', 'عمر ناصر', 'ريم عبدالعزيز', 'خالد إبراهيم', 'جود فيصل', 'سلطان حمد', 'هيا راشد', 'راشد سعيد', 'دانة يوسف', 'حمد عبدالله', 'لطيفة محمد', 'ناصر خليفة', 'شهد أحمد', 'تميم علي', 'العنود سالم', 'جاسم حسن', 'مها عبدالرحمن', 'بدر خالد', 'غلا فهد'];
  const DEMO = DEMO_NAMES.map((name, i) => ({ id: 'demo' + i, name }));
  const LEVELS = { 1: 'متقدم', 2: 'متوسط', 3: 'يحتاج دعمًا' };
  const FLAGS = [['vision', 'رؤية'], ['hearing', 'سمع'], ['support', 'دعم'], ['tall', 'طويل'], ['short', 'قصير'], ['lowPart', 'مشاركة أقل'], ['notBack', 'ليس في الخلف']];
  const GROUP_TYPES = ['quads', 'groups', 'stations'];

  const prefs = Object.assign({
    method: 'random', avoidPrev: true, front: false, height: true, roles: true,
    names: 'short', card: 'm', persp: 'students', colors: true, tags: true, grid: true, snap: true, nums: false,
    batch: 6, timer: 120
  }, store.get('seat:prefs', {}));

  const S = {
    classId: '', students: [], profiles: {}, rules: { separate: [], together: [] },
    doc: null, prevDoc: null, undo: [], redo: [],
    mode: 'students', sel: new Set(), zoom: 1,
    pendingType: 'rows', pendingSettings: null,
    report: [], trans: null, tview: 'steps', step: 0,
    timer: null, stations: null, anim: false
  };

  const key = () => S.classId || 'demo';
  const savePrefs = () => store.set('seat:prefs', prefs);
  const prof = id => Object.assign({ level: 2 }, S.profiles[id] || {});
  const present = () => S.students.filter(s => !prof(s.id).absent);
  const absentSet = () => new Set(S.students.filter(s => prof(s.id).absent).map(s => s.id));
  const snap = () => JSON.stringify(S.doc);

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'st-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------- الأسماء ----------
  function nameLabels() {
    const full = {}, short = {};
    const parts = {};
    S.students.forEach(s => {
      full[s.id] = s.name;
      const t = s.name.split(/\s+/).filter(Boolean);
      const merged = [];
      for (let i = 0; i < t.length; i++) {
        let w = t[i];
        while (/^(عبد|ابو|أبو|بو|بن|بنت|ابن|آل)$/.test(w.split(' ').pop()) && t[i + 1]) w += ' ' + t[++i];
        merged.push(w);
      }
      parts[s.id] = merged;
    });
    const level = {};
    S.students.forEach(s => { level[s.id] = 1; });
    for (let r = 0; r < 4; r++) {
      const seen = {};
      S.students.forEach(s => { const l = parts[s.id].slice(0, level[s.id]).join(' '); (seen[l] = seen[l] || []).push(s.id); });
      let changed = false;
      Object.values(seen).forEach(ids => { if (ids.length > 1) ids.forEach(id => { if (level[id] < parts[id].length) { level[id]++; changed = true; } }); });
      if (!changed) break;
    }
    S.students.forEach(s => { short[s.id] = parts[s.id].slice(0, level[s.id]).join(' ') || s.name; });
    return { full, short };
  }

  // ---------- المستند ----------
  function autoSettings(type, base) {
    const n = Math.max(1, present().length);
    const s = Object.assign({}, T.DEFAULT_SETTINGS, base || {});
    if (type === 'rows' || type === 'staggered') {
      s.perRow = s.pair === 'double' ? Math.min(8, Math.max(4, Math.ceil(Math.sqrt(n * 1.6) / 2) * 2)) : Math.min(8, Math.max(4, Math.ceil(Math.sqrt(n * 1.5))));
      s.rows = Math.ceil(n / s.perRow);
    }
    if (type === 'theater') {
      s.rows = Math.max(2, Math.min(6, Math.round(Math.sqrt(n / 1.6))));
      s.perRow = Math.max(3, Math.ceil((n - (s.rows * (s.rows - 1)) / 2) / s.rows));
    }
    if (type === 'stations') s.stationCap = Math.ceil(n / (s.stationCount || 4));
    return s;
  }

  function newDoc(type) {
    const settings = autoSettings(type);
    const built = T.build(type, settings, present().length);
    return {
      id: T.uid(), savedId: null, name: 'مخطط ' + (T.TYPES.find(t => t.id === type) || {}).name,
      category: 'المخطط الأساسي', classId: S.classId, type, settings,
      room: built.room, items: built.items, assign: {}, pins: {}, blocked: {}, subs: {}, roles: {},
      notes: '', created: Date.now(), lastUsed: Date.now()
    };
  }

  function saveDraft() { store.set('seat:draft:' + key(), S.doc); }

  function commit(before) {
    if (before !== undefined && before !== snap()) {
      S.undo.push(before);
      if (S.undo.length > 80) S.undo.shift();
      S.redo = [];
    }
    saveDraft();
    renderAll();
  }

  function undo() {
    if (!S.undo.length) return;
    S.redo.push(snap());
    S.doc = JSON.parse(S.undo.pop());
    S.sel.clear();
    saveDraft();
    renderAll();
  }

  function redo() {
    if (!S.redo.length) return;
    S.undo.push(snap());
    S.doc = JSON.parse(S.redo.pop());
    S.sel.clear();
    saveDraft();
    renderAll();
  }

  // ---------- التوزيع ----------
  function history() { return store.get('seat:history:' + key(), { pairs: [], seats: {} }); }

  function distributeInto(doc) {
    const res = E.distribute({
      layout: doc,
      students: S.students,
      profiles: S.profiles,
      method: prefs.method,
      rules: { separate: S.rules.separate, together: S.rules.together, avoidPrev: prefs.avoidPrev, heightAware: prefs.height, frontPriority: prefs.front || doc.type === 'staggered' && prefs.front },
      history: history()
    });
    doc.assign = res.assign;
    doc.roles = prefs.roles && GROUP_TYPES.includes(doc.type) ? E.assignRoles(doc, doc.roles) : {};
    S.report = res.report;
    if (prefs.method === 'manual') S.report.push({ type: 'info', text: 'التوزيع اليدوي: اسحب الأسماء من قائمة «بلا مقعد» إلى المقاعد، أو اضغط أي مقعد لاختيار طالب.' });
  }

  function makeTransition() {
    if (!S.prevDoc || !Object.keys(S.prevDoc.assign || {}).length) { S.trans = null; return; }
    S.trans = TR.plan(S.prevDoc, S.doc, { batchMax: prefs.batch, timerSec: prefs.timer });
    S.step = 0;
    stopTimer();
  }

  function buildLayout() {
    const before = snap();
    S.prevDoc = clone(S.doc);
    const type = S.pendingType;
    const settings = Object.assign({}, S.pendingSettings);
    const built = T.build(type, settings, present().length);
    Object.assign(S.doc, { type, settings, items: built.items, room: built.room, assign: {}, pins: {}, blocked: {}, subs: {}, roles: {} });
    if (S.doc.name.startsWith('مخطط ')) S.doc.name = 'مخطط ' + T.TYPES.find(t => t.id === type).name;
    stopStations();
    distributeInto(S.doc);
    S.sel.clear();
    makeTransition();
    commit(before);
    zoomFit();
    if (S.trans) toast('المخطط جاهز، وخطة الانتقال في الأسفل.');
  }

  function redistribute() {
    const before = snap();
    S.prevDoc = clone(S.doc);
    distributeInto(S.doc);
    makeTransition();
    commit(before);
  }

  // ---------- الرسم ----------
  function renderOpts(extra) {
    return Object.assign({
      flip: prefs.persp === 'teacher',
      grid: prefs.grid,
      nums: prefs.nums,
      fullNames: prefs.names === 'full',
      groupColors: prefs.colors,
      tags: prefs.tags,
      card: prefs.card,
      names: nameLabels(),
      profiles: S.profiles,
      absent: absentSet(),
      groupLabels: true,
      stationNow: stationNow()
    }, extra || {});
  }

  function transitionOverlay() {
    if (!S.trans) return {};
    const step = S.trans.steps[S.step];
    const highlight = {};
    const arrows = [];
    if (step && step.kind === 'move') step.movers.forEach(m => { highlight[m.id] = m.color; arrows.push({ from: m.from, to: m.to, color: m.color }); });
    if (step && step.kind === 'stay') step.stay.forEach(id => { highlight[id] = '#8FA39B'; });
    return { highlight, arrows: S.anim ? [] : arrows };
  }

  function renderCanvas() {
    const host = el('roomHost');
    const W = S.doc.room.w * U * S.zoom, H = S.doc.room.h * U * S.zoom;
    host.innerHTML = RD.roomSVG(S.doc, renderOpts(Object.assign({
      width: W, height: H, sel: S.sel, handles: S.mode === 'furniture'
    }, transitionOverlay())));
    el('zoomVal').textContent = Math.round(S.zoom * 100) + '%';
    el('seatApp').classList.toggle('mode-furniture', S.mode === 'furniture');
    el('seatApp').classList.toggle('mode-students', S.mode === 'students');
    // أدوات التحديد
    const n = S.sel.size;
    el('selTools').hidden = !n || S.mode !== 'furniture';
    el('selectAll').hidden = S.mode !== 'furniture';
    el('selCount').textContent = n ? `${n} محدد` : '';
    const one = n === 1 ? S.doc.items.find(i => S.sel.has(i.id)) : null;
    const capable = one && (one.kind === 'table' || one.kind === 'round');
    document.querySelector('[data-act="capPlus"]').hidden = !capable;
    document.querySelector('[data-act="capMinus"]').hidden = !capable;
    document.querySelector('[data-act="label"]').hidden = !(one && !T.KINDS[one.kind].seating);
  }

  function renderTop() {
    const p = present().length;
    el('presentCount').textContent = `${p} من ${S.students.length}`;
    if (document.activeElement !== el('docName')) el('docName').value = S.doc.name;
    el('undoBtn').disabled = !S.undo.length;
    el('redoBtn').disabled = !S.redo.length;
  }

  function unseatedIds() {
    const seated = new Set(Object.entries(S.doc.assign).filter(([seatId]) => !(S.doc.blocked || {})[seatId]).map(([, sid]) => sid));
    return present().filter(s => !seated.has(s.id)).map(s => s.id);
  }

  function renderUnseated() {
    const ids = unseatedIds();
    const names = nameLabels();
    el('unseatedBox').hidden = !ids.length;
    el('unseatedList').innerHTML = ids.map(id => `<span class="st-name-chip" draggable="true" data-stu="${id}">${esc(names.full[id])}</span>`).join('');
  }

  function renderReport() {
    const r = S.report || [];
    el('report').hidden = !r.length;
    el('report').innerHTML = r.map(x => `<p class="${x.type}">${esc(x.text)}</p>`).join('');
  }

  function renderAll() {
    renderTop();
    renderCanvas();
    renderUnseated();
    renderReport();
    renderTransition();
    renderRules();
    renderStudentView();
  }

  // ---------- التكبير ----------
  function zoomFit() {
    const wrap = el('canvasWrap');
    const W = S.doc.room.w * U, H = S.doc.room.h * U;
    S.zoom = Math.max(0.3, Math.min(1.6, Math.min((wrap.clientWidth - 40) / W, (wrap.clientHeight - 40) / H)));
    renderCanvas();
  }

  // ---------- تحويل الإحداثيات ----------
  function toRoom(e) {
    const g = el('roomHost').querySelector('.roomG');
    const svg = el('roomHost').querySelector('svg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(g.getScreenCTM().inverse());
    return { x: p.x / U, y: p.y / U };
  }
  const snapV = v => (prefs.snap ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100);

  function fitRoomToItems() {
    const r = T.fitRoom(S.doc.items, S.doc.room.w, S.doc.room.h);
    S.doc.room.w = Math.max(S.doc.room.w, r.w);
    S.doc.room.h = Math.max(S.doc.room.h, r.h);
  }

  // ---------- السحب على المخطط ----------
  let drag = null;
  let ghost = null;

  el('roomHost').addEventListener('pointerdown', e => {
    hidePop();
    const chipEl = e.target.closest('.chip');
    const itemEl = e.target.closest('.it');
    const handle = e.target.closest('.handle');
    if (S.mode === 'furniture') {
      const p = toRoom(e);
      if (handle) {
        const it = S.doc.items.find(i => i.id === handle.dataset.handle);
        drag = { type: 'resize', it, start: p, w0: it.w, h0: it.h, before: snap() };
      } else if (itemEl) {
        const id = itemEl.dataset.item;
        if (e.shiftKey || e.ctrlKey || e.metaKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); }
        else if (!S.sel.has(id)) { S.sel.clear(); S.sel.add(id); }
        const starts = {};
        S.doc.items.forEach(i => { if (S.sel.has(i.id)) starts[i.id] = { x: i.x, y: i.y }; });
        drag = { type: 'move', start: p, starts, before: snap(), moved: false };
      } else {
        if (!e.shiftKey) S.sel.clear();
      }
      renderCanvas();
    } else if (chipEl) {
      const seatId = chipEl.dataset.seat;
      drag = { type: 'chip', seatId, sx: e.clientX, sy: e.clientY, moved: false };
    }
    if (drag) el('roomHost').setPointerCapture(e.pointerId);
  });

  el('roomHost').addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.type === 'move') {
      const p = toRoom(e);
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) drag.moved = true;
      S.doc.items.forEach(i => {
        const s0 = drag.starts[i.id];
        if (s0) { i.x = Math.max(0, snapV(s0.x + dx)); i.y = Math.max(0, snapV(s0.y + dy)); }
      });
      requestRender();
    } else if (drag.type === 'resize') {
      const p = toRoom(e);
      const a = -(drag.it.rot || 0) * Math.PI / 180;
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      drag.it.w = Math.max(0.4, snapV(drag.w0 + lx));
      drag.it.h = Math.max(0.3, snapV(drag.h0 + ly));
      if (drag.it.kind === 'round') drag.it.h = drag.it.w;
      requestRender();
    } else if (drag.type === 'chip') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        const sid = S.doc.assign[drag.seatId];
        if (!sid) return;
        if (S.doc.pins[drag.seatId]) { toast('هذا المقعد مثبت. ألغِ التثبيت أولًا لنقله.'); drag = null; return; }
        drag.moved = true;
        ghost = document.createElement('div');
        ghost.className = 'st-ghost';
        ghost.textContent = nameLabels().full[sid];
        document.body.appendChild(ghost);
      }
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    }
  });

  let rafPending = false;
  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderCanvas(); });
  }

  el('roomHost').addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === 'move' || d.type === 'resize') {
      fitRoomToItems();
      commit(d.before);
    } else if (d.type === 'chip') {
      if (ghost) { ghost.remove(); ghost = null; }
      if (!d.moved) { openPop(d.seatId, e.clientX, e.clientY); return; }
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest('.chip');
      if (target && target.dataset.seat !== d.seatId) moveStudent(d.seatId, target.dataset.seat);
    }
  });

  function moveStudent(from, to) {
    const doc = S.doc;
    if (doc.blocked[to]) { toast('هذا المقعد ممنوع الاستخدام.'); return; }
    if (doc.pins[to] || doc.pins[from]) { toast('أحد المقعدين مثبت.'); return; }
    const before = snap();
    const a = doc.assign[from], b = doc.assign[to];
    if (a) doc.assign[to] = a; else delete doc.assign[to];
    if (b) doc.assign[from] = b; else delete doc.assign[from];
    commit(before);
  }

  function placeStudent(sid, seatId) {
    const doc = S.doc;
    if (doc.blocked[seatId]) { toast('هذا المقعد ممنوع الاستخدام.'); return; }
    if (doc.pins[seatId]) { toast('هذا المقعد مثبت.'); return; }
    const before = snap();
    const fromSeat = Object.keys(doc.assign).find(k => doc.assign[k] === sid);
    if (fromSeat && doc.pins[fromSeat]) { toast('الطالب مثبت في مقعد آخر.'); return; }
    const occupant = doc.assign[seatId];
    if (fromSeat) { if (occupant) doc.assign[fromSeat] = occupant; else delete doc.assign[fromSeat]; }
    doc.assign[seatId] = sid;
    commit(before);
  }

  // ---------- الإفلات من المكتبة وقائمة بلا مقعد ----------
  const wrap = el('canvasWrap');
  wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.classList.add('is-drop'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('is-drop'));
  wrap.addEventListener('drop', e => {
    e.preventDefault();
    wrap.classList.remove('is-drop');
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('kind:')) {
      const p = toRoom(e);
      addItem(data.slice(5), p.x, p.y);
    } else if (data.startsWith('stu:')) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest('.chip');
      if (target) placeStudent(data.slice(4), target.dataset.seat);
      else toast('أفلت الاسم فوق مقعد.');
    }
  });

  el('unseatedList').addEventListener('dragstart', e => {
    const c = e.target.closest('[data-stu]');
    if (c) e.dataTransfer.setData('text/plain', 'stu:' + c.dataset.stu);
  });

  function addItem(kind, cx, cy) {
    const before = snap();
    const k = T.KINDS[kind];
    const x = cx !== undefined ? cx - k.w / 2 : S.doc.room.w / 2 - k.w / 2;
    const y = cy !== undefined ? cy - k.h / 2 : S.doc.room.h / 2 - k.h / 2;
    const it = T.make(kind, Math.max(0, snapV(x)), Math.max(0, snapV(y)));
    S.doc.items.push(it);
    fitRoomToItems();
    S.mode = 'furniture';
    syncMode();
    S.sel.clear();
    S.sel.add(it.id);
    commit(before);
  }

  function renderLibrary() {
    const SW = { seat: '#E9DCC3', desk2: '#E9DCC3', table: '#DCC7A1', round: '#DCC7A1', board: '#1F4D3F', tdesk: '#8B6B4A', door: '#C9A27A', window: '#CBE8F7', screen: '#2B2F36', cabinet: '#B7A58A', aisle: '#EEF5F1', zone: '#FCEBC6', blocked: '#DDE2E0' };
    el('libList').innerHTML = Object.entries(T.KINDS).map(([k, v]) =>
      `<button type="button" class="st-lib-item" draggable="true" data-kind="${k}" style="--sw:${SW[k]}"><i></i>${v.name}</button>`).join('');
  }
  el('libList').addEventListener('dragstart', e => { const b = e.target.closest('[data-kind]'); if (b) e.dataTransfer.setData('text/plain', 'kind:' + b.dataset.kind); });
  el('libList').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b) addItem(b.dataset.kind); });

  // ---------- أدوات التحديد ----------
  el('selTools').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const sel = S.doc.items.filter(i => S.sel.has(i.id));
    if (!sel.length) return;
    const before = snap();
    if (act === 'rotL' || act === 'rotR' || act === 'rot90') {
      const d = act === 'rotL' ? -15 : act === 'rotR' ? 15 : 90;
      sel.forEach(i => { i.rot = ((i.rot || 0) + d + 360) % 360; });
    } else if (act === 'dup') {
      duplicateSel();
      return;
    } else if (act === 'del') {
      deleteSel();
      return;
    } else if (act === 'capPlus' || act === 'capMinus') {
      sel.forEach(i => { if (i.cap) i.cap = Math.max(2, Math.min(8, i.cap + (act === 'capPlus' ? 1 : -1))); });
    } else if (act === 'label') {
      const it = sel[0];
      const v = window.prompt ? window.prompt('اسم العنصر', it.label || T.KINDS[it.kind].name) : null;
      if (v === null || v === undefined) { renamePrompt(it); return; }
      it.label = v.trim();
    }
    commit(before);
  });

  // بديل عن prompt (قد لا يعمل في بعض المتصفحات المضمّنة)
  function renamePrompt(it) {
    openPopHTML(`<h4>تسمية العنصر</h4><input type="text" class="st-input" id="lblInput" value="${esc(it.label || T.KINDS[it.kind].name)}"><div class="st-pop-actions"><button data-a="lblOk">حفظ</button><button data-a="close">إلغاء</button></div>`, null, null, act => {
      if (act === 'lblOk') { const before = snap(); it.label = el('lblInput').value.trim(); commit(before); }
    });
  }

  function duplicateSel() {
    const before = snap();
    const copies = S.doc.items.filter(i => S.sel.has(i.id)).map(i => Object.assign(clone(i), { id: T.uid(), x: i.x + 1, y: i.y + 1 }));
    S.doc.items.push(...copies);
    S.sel = new Set(copies.map(c => c.id));
    fitRoomToItems();
    commit(before);
  }

  function deleteSel() {
    const before = snap();
    const ids = S.sel;
    S.doc.items = S.doc.items.filter(i => !ids.has(i.id));
    ['assign', 'pins', 'blocked', 'subs'].forEach(k => {
      Object.keys(S.doc[k] || {}).forEach(seatId => { if (ids.has(seatId.split(':')[0])) delete S.doc[k][seatId]; });
    });
    S.sel.clear();
    commit(before);
  }

  el('selectAll').addEventListener('click', () => { S.sel = new Set(S.doc.items.map(i => i.id)); renderCanvas(); });

  // ---------- نافذة المقعد ----------
  let popHandler = null;
  function openPopHTML(html, clientX, clientY, onAct) {
    const pop = el('seatPop');
    pop.innerHTML = html;
    pop.hidden = false;
    const r = wrap.getBoundingClientRect();
    const x = clientX !== null ? clientX - r.left + wrap.scrollLeft : wrap.scrollLeft + 20;
    const y = clientY !== null ? clientY - r.top + wrap.scrollTop : wrap.scrollTop + 20;
    pop.style.left = Math.max(wrap.scrollLeft + 8, Math.min(x - 135, wrap.scrollLeft + wrap.clientWidth - 280)) + 'px';
    pop.style.top = Math.max(wrap.scrollTop + 8, Math.min(y + 14, wrap.scrollTop + wrap.clientHeight - pop.offsetHeight - 8)) + 'px';
    popHandler = onAct;
  }
  function hidePop() { el('seatPop').hidden = true; popHandler = null; }

  el('seatPop').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const act = b.dataset.a;
    const h = popHandler;
    if (act === 'close') { hidePop(); return; }
    if (h) h(act);
  });
  el('seatPop').addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f && popHandler) popHandler('change:' + f, e.target.value);
  });

  function openPop(seatId, cx, cy) {
    const doc = S.doc;
    const seats = T.seatsOf(doc.items);
    const seat = seats.find(s => s.id === seatId);
    if (!seat) return;
    const nums = RD.seatNumbers(seats);
    const names = nameLabels();
    const sid = doc.assign[seatId];
    const pinned = !!doc.pins[seatId], blocked = !!doc.blocked[seatId];
    const seatOf = {};
    Object.entries(doc.assign).forEach(([k, v]) => { seatOf[v] = k; });
    const opts = ['<option value="">— مقعد فارغ —</option>'].concat(present().map(s => {
      const where = s.id === sid ? ' (هنا)' : seatOf[s.id] ? ` (مقعد ${nums[seatOf[s.id]]})` : ' (بلا مقعد)';
      return `<option value="${s.id}"${s.id === sid ? ' selected' : ''}>${esc(s.name + where)}</option>`;
    })).join('');
    const subOpts = ['<option value="">بدون بديل</option>'].concat(present().filter(s => s.id !== sid).map(s =>
      `<option value="${s.id}"${doc.subs[seatId] === s.id ? ' selected' : ''}>${esc(s.name)}</option>`)).join('');
    const p = sid ? prof(sid) : null;
    const html = `
      <h4>مقعد رقم ${nums[seatId]}</h4>
      ${sid ? `<div class="st-hint">${esc(names.full[sid])} · ${LEVELS[p.level]}${p.note ? ' · ' + esc(p.note) : ''}</div>` : ''}
      <label>الطالب في هذا المقعد<select class="st-select" data-f="stu"${pinned || blocked ? ' disabled' : ''}>${opts}</select></label>
      <div class="st-pop-actions">
        <button data-a="pin" class="${pinned ? 'is-on' : ''}"${!sid ? ' disabled' : ''}>${pinned ? 'إلغاء التثبيت' : 'تثبيت الطالب هنا'}</button>
        <button data-a="clear"${!sid || pinned ? ' disabled' : ''}>إخلاء المقعد</button>
        <button data-a="block" class="${blocked ? 'is-on' : ''}">${blocked ? 'السماح بالمقعد' : 'منع استخدام المقعد'}</button>
        ${seat.group ? `<button data-a="pinGroup">تثبيت المجموعة كاملة</button>` : '<span></span>'}
      </div>
      ${pinned ? `<label>البديل عند غياب الطالب<select class="st-select" data-f="sub">${subOpts}</select></label>` : ''}
      <button class="btn btn-ghost" data-a="close">إغلاق</button>`;
    openPopHTML(html, cx, cy, (act, val) => {
      const before = snap();
      if (act === 'pin') { if (doc.pins[seatId]) { delete doc.pins[seatId]; delete doc.subs[seatId]; } else doc.pins[seatId] = true; }
      else if (act === 'clear') delete doc.assign[seatId];
      else if (act === 'block') {
        if (doc.blocked[seatId]) delete doc.blocked[seatId];
        else { doc.blocked[seatId] = true; delete doc.pins[seatId]; delete doc.assign[seatId]; }
      } else if (act === 'pinGroup') {
        const all = seats.filter(s => s.group === seat.group);
        const allPinned = all.every(s => doc.pins[s.id] || !doc.assign[s.id]);
        all.forEach(s => { if (doc.assign[s.id]) { if (allPinned) delete doc.pins[s.id]; else doc.pins[s.id] = true; } });
      } else if (act === 'change:stu') {
        if (!val) delete doc.assign[seatId];
        else { hidePop(); placeStudent(val, seatId); return; }
      } else if (act === 'change:sub') {
        if (val) doc.subs[seatId] = val; else delete doc.subs[seatId];
      }
      commit(before);
      openPop(seatId, cx, cy);
    });
  }

  // ---------- الأوضاع وشريط الأدوات ----------
  function syncMode() {
    document.querySelectorAll('.st-toolbar .st-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
  }
  document.querySelectorAll('.st-toolbar .st-seg button').forEach(b => b.addEventListener('click', () => {
    S.mode = b.dataset.mode;
    if (S.mode === 'students') S.sel.clear();
    syncMode();
    hidePop();
    renderCanvas();
  }));
  el('zoomIn').addEventListener('click', () => { S.zoom = Math.min(2.5, S.zoom + 0.1); renderCanvas(); });
  el('zoomOut').addEventListener('click', () => { S.zoom = Math.max(0.3, S.zoom - 0.1); renderCanvas(); });
  el('zoomFit').addEventListener('click', zoomFit);
  [['tGrid', 'grid'], ['tSnap', 'snap'], ['tNums', 'nums']].forEach(([id, k]) => {
    const b = el(id);
    b.setAttribute('aria-pressed', String(prefs[k]));
    b.addEventListener('click', () => { prefs[k] = !prefs[k]; b.setAttribute('aria-pressed', String(prefs[k])); savePrefs(); renderCanvas(); });
  });
  el('undoBtn').addEventListener('click', undo);
  el('redoBtn').addEventListener('click', redo);
  el('docName').addEventListener('change', e => { const before = snap(); S.doc.name = e.target.value.trim() || 'مخطط بدون اسم'; commit(before); });
  el('fullBtn').addEventListener('click', () => {
    const app = el('seatApp');
    app.classList.toggle('is-full');
    try {
      if (app.classList.contains('is-full')) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen();
    } catch (e) { /* تجاهل */ }
    setTimeout(zoomFit, 150);
  });

  document.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === 'd' && S.sel.size) { e.preventDefault(); duplicateSel(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel.size && S.mode === 'furniture') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'Escape') { hidePop(); S.sel.clear(); renderCanvas(); if (!el('studentView').hidden) closeStudentView(); }
  });

  // ---------- التبويبات ----------
  document.querySelectorAll('.st-tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.st-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.st-tab').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
  }));

  // ---------- تبويب الشكل ----------
  function renderTypes() {
    el('typeList').innerHTML = T.TYPES.map(t =>
      `<button type="button" class="st-card" data-type="${t.id}" aria-pressed="${t.id === S.pendingType}"><b>${t.name}</b><span>${t.desc}</span></button>`).join('');
  }
  el('typeList').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    S.pendingType = b.dataset.type;
    S.pendingSettings = autoSettings(S.pendingType, S.pendingType === S.doc.type ? S.doc.settings : {});
    renderTypes();
    renderShapeForm();
  });

  function field(label, k, type, opts) {
    const v = S.pendingSettings[k];
    if (type === 'number') return `<label>${label}<input type="number" class="st-input" data-k="${k}" min="${opts[0]}" max="${opts[1]}" value="${v}"></label>`;
    if (type === 'select') return `<label>${label}<select class="st-select" data-k="${k}">${opts.map(([val, t]) => `<option value="${val}"${String(v) === String(val) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    if (type === 'check') return `<label class="st-check-inline"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}> ${label}</label>`;
    return '';
  }

  function renderShapeForm() {
    const t = S.pendingType;
    let h = '';
    if (t === 'rows' || t === 'staggered') {
      h += field('عدد الصفوف', 'rows', 'number', [1, 12]);
      h += field('عدد المقاعد في كل صف', 'perRow', 'number', [1, 16]);
      h += field('نوع المقعد', 'pair', 'select', [['single', 'مقعد منفرد'], ['double', 'طاولة لطالبين']]);
      h += field('الممر', 'aisle', 'select', [['none', 'بدون ممر'], ['center', 'ممر في المنتصف'], ['sides', 'ممران على الجانبين']]);
      h += `<label>اتجاه العرض<select class="st-select" data-pref="persp"><option value="students"${prefs.persp === 'students' ? ' selected' : ''}>من منظور الطلاب</option><option value="teacher"${prefs.persp === 'teacher' ? ' selected' : ''}>من منظور المعلم</option></select></label>`;
      if (t === 'staggered') h += `<label class="st-check-inline"><input type="checkbox" data-pref="front"${prefs.front ? ' checked' : ''}> أولوية المقاعد الأمامية لمن يحتاج رؤية أو متابعة أكبر</label>`;
    } else if (t === 'pairs') {
      h += `<label>طريقة تكوين الأزواج<select class="st-select" data-pref="method">
        ${[['random', 'عشوائي'], ['mentor', 'مرتفع الأداء مع من يحتاج دعمًا'], ['similar', 'مستويات متقاربة'], ['norepeat', 'عدم تكرار الشريك السابق']].map(([v, n]) => `<option value="${v}"${prefs.method === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
      h += `<p class="st-hint">لتثبيت أزواج محددة أضف قاعدة «جمع» في تبويب القواعد، أو ثبّت الطالبين من المخطط.</p>`;
    } else if (t === 'quads') {
      h += `<label class="st-check-inline"><input type="checkbox" data-pref="roles"${prefs.roles ? ' checked' : ''}> تعيين الأدوار تلقائيًا: قائد المجموعة، الكاتب، المتحدث، ضابط الوقت</label>`;
    } else if (t === 'groups') {
      h += field('حجم المجموعة', 'groupSize', 'select', [[3, '3 طلاب'], [4, '4 طلاب'], [5, '5 طلاب'], [6, '6 طلاب']]);
      h += field('الطلاب المتبقون', 'remainder', 'select', [['spread', 'يُوزَّعون على المجموعات'], ['separate', 'مجموعة مستقلة أصغر']]);
      h += `<label class="st-check-inline"><input type="checkbox" data-pref="roles"${prefs.roles ? ' checked' : ''}> تعيين الأدوار تلقائيًا</label>`;
    } else if (t === 'ushape') {
      h += field('الطبقات', 'uLayers', 'select', [['single', 'حرف U بطبقة واحدة'], ['double', 'حرف U مزدوج (للصفوف الكبيرة)']]);
      h += field('الفتحة', 'uOpen', 'select', [['front', 'من الأمام (نحو السبورة)'], ['back', 'من الخلف']]);
      h += field('المساحة الوسطى', 'uCenter', 'select', [['none', 'مفتوحة'], ['desk', 'مكتب المعلم'], ['zone', 'منطقة عرض ونقاش'], ['screen', 'شاشة عرض']]);
    } else if (t === 'theater') {
      h += field('عدد الصفوف', 'rows', 'number', [1, 10]);
      h += field('مقاعد الصف الأول', 'perRow', 'number', [2, 16]);
      h += field('شكل الصفوف', 'curve', 'select', [['straight', 'مستقيمة'], ['curved', 'منحنية نحو نقطة العرض']]);
      h += `<label class="st-check-inline"><input type="checkbox" data-pref="height"${prefs.height ? ' checked' : ''}> مراعاة الطول وخط النظر (الأقصر في الأمام)</label>`;
      h += `<p class="st-hint">حدّد الطلاب الطوال والقصار في تبويب الطلاب.</p>`;
    } else if (t === 'stations') {
      h += field('عدد المحطات', 'stationCount', 'number', [2, 6]);
      h += field('سعة كل محطة', 'stationCap', 'number', [2, 10]);
      const cnt = Math.max(2, Math.min(6, S.pendingSettings.stationCount || 4));
      for (let i = 0; i < cnt; i++) h += `<label>اسم المحطة ${i + 1}<input type="text" class="st-input" data-station="${i}" value="${esc((S.pendingSettings.stationNames || [])[i] || '')}"></label>`;
      h += field('زمن الجولة (دقائق)', 'stationMinutes', 'number', [1, 60]);
      h += field('عدد الجولات', 'stationRounds', 'number', [1, 12]);
      h += field('اتجاه الانتقال', 'stationDir', 'select', [[1, 'مع عقارب الساعة (المحطة التالية)'], [-1, 'عكس عقارب الساعة (المحطة السابقة)']]);
      h += `<button class="btn btn-gold st-wide" type="button" id="stationsStart">تشغيل جولات المحطات</button>`;
    } else if (t === 'custom') {
      h += `<p class="st-hint">يبدأ المخطط بسبورة ومكتب وباب. أضف العناصر من المكتبة بالسحب أو الضغط، وحرّكها ودوّرها وغيّر حجمها في وضع «تحرير المخطط».</p>`;
    }
    el('shapeForm').innerHTML = h;
    renderSummary();
  }

  el('shapeForm').addEventListener('input', e => {
    const k = e.target.dataset.k, st = e.target.dataset.station, pk = e.target.dataset.pref;
    if (k) {
      let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (e.target.type === 'number' || k === 'groupSize' || k === 'stationDir') v = Number(v);
      S.pendingSettings[k] = v;
      if (k === 'stationCount') { renderShapeForm(); return; }
    } else if (st !== undefined) {
      S.pendingSettings.stationNames = (S.pendingSettings.stationNames || []).slice();
      S.pendingSettings.stationNames[Number(st)] = e.target.value;
    } else if (pk) {
      prefs[pk] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      savePrefs();
      syncMethodPanel();
      if (pk === 'persp') { el('vPersp').value = prefs.persp; renderCanvas(); }
    }
    renderSummary();
  });
  el('shapeForm').addEventListener('click', e => { if (e.target.id === 'stationsStart') startStations(); });

  function renderSummary() {
    const box = el('groupSummary');
    const n = present().length;
    const t = S.pendingType;
    const built = T.build(t, S.pendingSettings, n);
    const seatCount = T.seatsOf(built.items).length;
    let h = `عدد المقاعد في هذا الشكل: <b>${seatCount}</b> · الحاضرون: <b>${n}</b>`;
    if (seatCount < n) h += `<br><span style="color:var(--danger)">المقاعد أقل من الحاضرين بـ ${n - seatCount}. زِد عدد الصفوف أو المقاعد.</span>`;
    if (t === 'groups') {
      const sizes = T.groupSizes(n, S.pendingSettings.groupSize, S.pendingSettings.remainder);
      const count = {};
      sizes.forEach(z => { count[z] = (count[z] || 0) + 1; });
      const desc = Object.entries(count).sort((a, b) => b[0] - a[0]).map(([z, c]) => `${c} ${c === 1 ? 'مجموعة' : 'مجموعات'} من ${z}`).join('، ');
      const rem = n % S.pendingSettings.groupSize;
      const uneven = Object.keys(count).length > 1;
      h += `<br>عدد المجموعات: <b>${sizes.length}</b><br>الطلاب في كل مجموعة: ${desc}`;
      h += `<br>مجموعات غير متساوية: <b>${uneven ? 'نعم' : 'لا'}</b>`;
      h += `<br>الطلاب المتبقون: <b>${rem}</b>${rem ? (S.pendingSettings.remainder === 'separate' ? ' — يشكّلون مجموعة مستقلة أصغر' : ' — يُضاف كل واحد منهم إلى مجموعة') : ''}`;
    }
    if (t === 'stations') {
      const sc = S.pendingSettings.stationCount, cap = S.pendingSettings.stationCap;
      h += `<br>${sc} محطات × ${cap} مقاعد، والجولة ${S.pendingSettings.stationMinutes} دقائق، ${S.pendingSettings.stationRounds} جولات.`;
    }
    box.innerHTML = h;
    box.hidden = false;
  }

  el('buildBtn').addEventListener('click', buildLayout);

  // ---------- تبويب التوزيع ----------
  function renderMethods() {
    el('methodList').innerHTML = E.METHODS.map(m =>
      `<button type="button" class="st-card" data-method="${m.id}" aria-pressed="${m.id === prefs.method}"><b>${m.name}</b><span>${m.desc}</span></button>`).join('');
  }
  function syncMethodPanel() {
    renderMethods();
    el('optAvoidPrev').checked = prefs.avoidPrev;
    el('optFront').checked = prefs.front;
    el('optHeight').checked = prefs.height;
    el('optRoles').checked = prefs.roles;
  }
  el('methodList').addEventListener('click', e => {
    const b = e.target.closest('[data-method]');
    if (!b) return;
    prefs.method = b.dataset.method;
    savePrefs();
    renderMethods();
  });
  [['optAvoidPrev', 'avoidPrev'], ['optFront', 'front'], ['optHeight', 'height'], ['optRoles', 'roles']].forEach(([id, k]) =>
    el(id).addEventListener('change', e => { prefs[k] = e.target.checked; savePrefs(); }));
  el('distBtn').addEventListener('click', redistribute);
  el('undoDistBtn').addEventListener('click', undo);
  el('compareBtn').addEventListener('click', () => openCompare(S.prevDoc, S.doc));
  el('transOpenBtn').addEventListener('click', () => {
    if (!S.trans) { S.prevDoc = S.prevDoc || null; makeTransition(); }
    if (!S.trans) toast('لا يوجد مخطط سابق للمقارنة بعد. أنشئ مخططًا أو أعد التوزيع أولًا.');
    renderTransition();
  });

  // ---------- تبويب القواعد ----------
  function renderRules() {
    const names = nameLabels();
    const opts = S.students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if (el('sepPick').options.length !== S.students.length) { el('sepPick').innerHTML = opts; el('togPick').innerHTML = opts; }
    const list = (sets, kind) => sets.map((set, i) => `<li><span>${set.map(id => esc(names.short[id] || '؟')).join(' · ')}</span><button type="button" data-rm="${kind}:${i}">حذف</button></li>`).join('') || '<li class="st-hint">لا توجد قواعد.</li>';
    el('sepList').innerHTML = list(S.rules.separate, 'separate');
    el('togList').innerHTML = list(S.rules.together, 'together');
    const seats = T.seatsOf(S.doc.items);
    const nums = RD.seatNumbers(seats);
    const pins = Object.keys(S.doc.pins || {}).filter(k => S.doc.assign[k]);
    el('pinList').innerHTML = pins.map(k => `<li><span>مقعد ${nums[k]}: ${esc(names.full[S.doc.assign[k]] || '')}${S.doc.subs[k] ? ' · البديل: ' + esc(names.short[S.doc.subs[k]]) : ''}</span><button type="button" data-unpin="${k}">إلغاء</button></li>`).join('') || '<li class="st-hint">لا توجد مقاعد مثبتة.</li>';
  }
  function addRule(kind, pickId) {
    const ids = [...el(pickId).selectedOptions].map(o => o.value);
    if (ids.length < 2) { toast('اختر طالبين أو أكثر (Ctrl أو Shift للاختيار المتعدد).'); return; }
    S.rules[kind].push(ids);
    store.set('seat:rules:' + key(), S.rules);
    [...el(pickId).options].forEach(o => { o.selected = false; });
    renderRules();
    toast('أُضيفت القاعدة. أعد التوزيع لتطبيقها.');
  }
  el('sepAdd').addEventListener('click', () => addRule('separate', 'sepPick'));
  el('togAdd').addEventListener('click', () => addRule('together', 'togPick'));
  el('seatApp').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const [kind, i] = rm.dataset.rm.split(':');
      S.rules[kind].splice(Number(i), 1);
      store.set('seat:rules:' + key(), S.rules);
      renderRules();
    }
    const up = e.target.closest('[data-unpin]');
    if (up) { const before = snap(); delete S.doc.pins[up.dataset.unpin]; delete S.doc.subs[up.dataset.unpin]; commit(before); }
  });

  // ---------- تبويب الطلاب ----------
  function renderStudents() {
    const q = el('stuSearch').value.trim();
    el('stuList').innerHTML = S.students.filter(s => !q || s.name.includes(q)).map(s => {
      const p = prof(s.id);
      return `<div class="st-stu${p.absent ? ' is-absent' : ''}" data-id="${s.id}">
        <div class="st-stu-row">
          <input type="checkbox" data-p="present"${p.absent ? '' : ' checked'} title="حاضر" aria-label="حضور ${esc(s.name)}">
          <b>${esc(s.name)}</b>
          <select data-p="level" aria-label="المستوى">${[1, 2, 3].map(l => `<option value="${l}"${p.level === l ? ' selected' : ''}>${LEVELS[l]}</option>`).join('')}</select>
        </div>
        <div class="st-flags">${FLAGS.map(([k, n]) => `<button type="button" data-flag="${k}" aria-pressed="${!!p[k]}">${n}</button>`).join('')}</div>
        <input type="text" data-p="note" placeholder="ملاحظة للمعلم" value="${esc(p.note || '')}">
      </div>`;
    }).join('');
  }
  function saveProfiles() { store.set('seat:profiles:' + key(), S.profiles); }
  function setProf(id, k, v) {
    S.profiles[id] = Object.assign({}, S.profiles[id] || {}, { [k]: v });
    if (k === 'tall' && v) S.profiles[id].short = false;
    if (k === 'short' && v) S.profiles[id].tall = false;
    saveProfiles();
  }
  el('stuList').addEventListener('change', e => {
    const card = e.target.closest('.st-stu');
    if (!card) return;
    const id = card.dataset.id, p = e.target.dataset.p;
    if (p === 'present') setProf(id, 'absent', !e.target.checked);
    else if (p === 'level') setProf(id, 'level', Number(e.target.value));
    else if (p === 'note') setProf(id, 'note', e.target.value);
    renderStudents();
    renderAll();
  });
  el('stuList').addEventListener('click', e => {
    const b = e.target.closest('[data-flag]');
    if (!b) return;
    const id = b.closest('.st-stu').dataset.id;
    setProf(id, b.dataset.flag, !prof(id)[b.dataset.flag]);
    renderStudents();
    renderCanvas();
  });
  el('stuSearch').addEventListener('input', renderStudents);
  el('allPresent').addEventListener('click', () => {
    S.students.forEach(s => setProf(s.id, 'absent', false));
    renderStudents();
    renderAll();
  });

  // ---------- تبويب العرض ----------
  function syncView() {
    el('vNames').value = prefs.names;
    el('vCard').value = prefs.card;
    el('vPersp').value = prefs.persp;
    el('vColors').checked = prefs.colors;
    el('vTags').checked = prefs.tags;
    el('vBatch').value = prefs.batch;
    el('vTimer').value = prefs.timer;
    el('roomW').value = S.doc.room.w;
    el('roomH').value = S.doc.room.h;
  }
  [['vNames', 'names'], ['vCard', 'card'], ['vPersp', 'persp']].forEach(([id, k]) => el(id).addEventListener('change', e => { prefs[k] = e.target.value; savePrefs(); renderAll(); }));
  [['vColors', 'colors'], ['vTags', 'tags']].forEach(([id, k]) => el(id).addEventListener('change', e => { prefs[k] = e.target.checked; savePrefs(); renderCanvas(); }));
  [['vBatch', 'batch'], ['vTimer', 'timer']].forEach(([id, k]) => el(id).addEventListener('change', e => {
    prefs[k] = Math.max(1, Number(e.target.value) || 1);
    savePrefs();
    if (S.trans) makeTransition();
    renderTransition();
  }));
  ['roomW', 'roomH'].forEach(id => el(id).addEventListener('change', () => {
    const before = snap();
    S.doc.room.w = Math.max(10, Number(el('roomW').value) || S.doc.room.w);
    S.doc.room.h = Math.max(8, Number(el('roomH').value) || S.doc.room.h);
    commit(before);
  }));

  // ---------- خطة الانتقال ----------
  function renderTransition() {
    const box = el('transBox');
    box.hidden = !S.trans;
    if (!S.trans) return;
    const t = S.trans;
    el('transSummary').textContent = `ينتقل ${TR.countStudents(t.movers.length)} على ${t.batches === 1 ? 'دفعة واحدة' : t.batches === 2 ? 'دفعتين' : t.batches + ' دفعات'}، ويبقى ${t.stay.length ? TR.countStudents(t.stay.length) : 'لا أحد'} في مكانه.`;
    el('transSteps').innerHTML = t.steps.map((s, i) => `<li data-step="${i}" class="${i === S.step ? 'is-current' : i < S.step ? 'is-done' : ''}">${esc(s.text)}${s.chips ? `<span class="dots">${s.chips.map(c => `<i style="background:${c.color}"></i>`).join('')}</span>` : ''}</li>`).join('');
    document.querySelectorAll('#transBox [data-tview]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tview === S.tview)));
    el('stepPrev').disabled = S.step === 0;
    el('stepNext').disabled = S.step >= t.steps.length - 1;
    el('animPlay').hidden = S.tview !== 'anim';
    const cur = t.steps[S.step];
    el('stepNext').textContent = cur && cur.kind === 'timer' && !S.timer ? 'ابدأ المؤقت' : 'التالي';
  }

  function goStep(i) {
    if (!S.trans) return;
    const cur = S.trans.steps[S.step];
    if (i > S.step && cur && cur.kind === 'timer' && !S.timer) { startTimer(cur.seconds); return; }
    S.step = Math.max(0, Math.min(S.trans.steps.length - 1, i));
    renderAll();
  }
  el('transSteps').addEventListener('click', e => { const li = e.target.closest('[data-step]'); if (li) { S.step = Number(li.dataset.step); renderAll(); } });
  el('stepPrev').addEventListener('click', () => goStep(S.step - 1));
  el('stepNext').addEventListener('click', () => goStep(S.step + 1));
  el('transClose').addEventListener('click', () => { S.trans = null; stopTimer(); renderAll(); });
  document.querySelectorAll('#transBox [data-tview]').forEach(b => b.addEventListener('click', () => {
    S.tview = b.dataset.tview;
    if (S.tview === 'compare') { openCompare(S.prevDoc, S.doc); S.tview = 'steps'; }
    renderTransition();
  }));
  el('animPlay').addEventListener('click', playAnimation);

  // حركة متتابعة: كل دفعة تتحرك على المخطط بدورها
  async function playAnimation() {
    if (!S.trans || S.anim) return;
    S.anim = true;
    const moves = S.trans.steps.map((s, i) => ({ s, i })).filter(x => x.s.kind === 'move');
    const names = nameLabels();
    for (const { s, i } of moves) {
      S.step = i;
      renderAll();
      const g = el('roomHost').querySelector('.anim');
      if (!g) break;
      const dots = s.movers.map(m => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        c.innerHTML = `<circle r="16" fill="${m.color}" stroke="#fff" stroke-width="3"/><text text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#fff" font-weight="700">${esc((names.short[m.id] || '').split(' ')[0].slice(0, 6))}</text>`;
        g.appendChild(c);
        return { c, m };
      });
      const dur = 1600;
      const t0 = performance.now();
      await new Promise(res => {
        (function frame(now) {
          const t = Math.min(1, (now - t0) / dur);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          dots.forEach(({ c, m }) => {
            const x = (m.from.x + (m.to.x - m.from.x) * e) * U, y = (m.from.y + (m.to.y - m.from.y) * e) * U;
            c.setAttribute('transform', `translate(${x} ${y})`);
          });
          if (t < 1) requestAnimationFrame(frame); else res();
        })(t0);
      });
      sound.pop();
      await new Promise(r => setTimeout(r, 450));
    }
    S.anim = false;
    renderAll();
  }

  function startTimer(sec) {
    stopTimer();
    const end = Date.now() + sec * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      const txt = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      el('transTimer').hidden = false;
      el('transTimer').textContent = txt;
      el('svTimer').hidden = false;
      el('svTimer').textContent = txt;
      if (left <= 0) {
        stopTimer(true);
        sound.finish();
        if (S.trans) { S.step = S.trans.steps.length - 1; renderAll(); }
      }
    };
    S.timer = setInterval(tick, 250);
    tick();
    renderTransition();
  }
  function stopTimer(keepText) {
    if (S.timer) clearInterval(S.timer);
    S.timer = null;
    if (!keepText) { el('transTimer').hidden = true; if (!S.stations) el('svTimer').hidden = true; }
  }

  // ---------- المقارنة ----------
  function openCompare(a, b) {
    if (!a) { toast('لا يوجد مخطط سابق للمقارنة بعد.'); return; }
    const o = renderOpts({ student: false, grid: false, nums: false, handles: false });
    el('cmpBefore').innerHTML = RD.roomSVG(a, Object.assign({}, o, { width: '100%', height: '100%' }));
    el('cmpAfter').innerHTML = RD.roomSVG(b, Object.assign({}, o, { width: '100%', height: '100%' }));
    const pa = E.seatPositions(a), pb = E.seatPositions(b);
    let moved = 0, stayed = 0;
    Object.keys(pb).forEach(id => { const x = pa[id], y = pb[id]; if (x && Math.hypot(x.x - y.x, x.y - y.y) < 0.6) stayed++; else moved++; });
    const newPairs = E.pairsOf(b).filter(p => !new Set(E.pairsOf(a)).has(p)).length;
    el('cmpStats').textContent = `انتقل ${moved}، وبقي ${stayed}، وتكوّنت ${newPairs} علاقة جوار جديدة.`;
    el('cmpModal').hidden = false;
  }

  // ---------- محطات التعلم ----------
  function stationTables() {
    return S.doc.items.filter(i => i.station !== undefined && T.KINDS[i.kind].seating).sort((a, b) => a.station - b.station);
  }
  function stationName(i) {
    const z = S.doc.items.find(it => it.kind === 'zone' && it.station === i);
    return (z && z.label) || 'المحطة ' + (i + 1);
  }
  function stationNow() {
    if (!S.stations) return null;
    const n = S.stations.count, r = S.stations.round;
    const map = {};
    for (let g = 0; g < n; g++) map[((g + r * S.stations.dir) % n + n) % n] = g;
    return map;
  }
  function startStations() {
    if (S.doc.type !== 'stations' || !stationTables().length) {
      toast('أنشئ مخطط «محطات التعلم» أولًا بالضغط على «إنشاء المخطط».');
      return;
    }
    const st = S.doc.settings;
    S.stations = { round: 0, total: st.stationRounds || 4, minutes: st.stationMinutes || 10, dir: Number(st.stationDir) || 1, count: stationTables().length, end: 0 };
    runRound();
  }
  function runRound() {
    const s = S.stations;
    s.end = Date.now() + s.minutes * 60000;
    clearInterval(s.iv);
    s.iv = setInterval(stationTick, 250);
    stationTick();
    renderAll();
  }
  function stationTick() {
    const s = S.stations;
    if (!s) return;
    const left = Math.max(0, Math.ceil((s.end - Date.now()) / 1000));
    const txt = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    const now = stationNow();
    const bar = el('stationsBar');
    bar.hidden = false;
    bar.innerHTML = `<b>الجولة ${s.round + 1} من ${s.total}</b><span class="t">${txt}</span>
      <div class="map">${Object.keys(now).sort((x, y) => now[x] - now[y]).map(st => `<span>المجموعة ${now[st] + 1} ← ${esc(stationName(Number(st)))}</span>`).join('')}</div>
      <button type="button" id="stationStop">إيقاف الجولات</button>`;
    el('svTimer').hidden = false;
    el('svTimer').textContent = txt;
    if (left <= 0) {
      clearInterval(s.iv);
      sound.finish();
      showStationMessage();
    }
  }
  function showStationMessage() {
    const s = S.stations;
    const last = s.round + 1 >= s.total;
    el('stationMsgTitle').textContent = last ? 'انتهت جميع الجولات' : `انتهى وقت الجولة ${s.round + 1}`;
    const n = s.count;
    const lines = [];
    if (!last) {
      for (let g = 0; g < n; g++) {
        const next = ((g + (s.round + 1) * s.dir) % n + n) % n;
        lines.push(`المجموعة ${g + 1} تنتقل إلى ${stationName(next)}`);
      }
    } else lines.push('أحسنتم! عودوا إلى مقاعدكم.');
    el('stationMsgList').innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join('');
    el('stationNext').hidden = last;
    el('stationMsg').hidden = false;
    renderStudentView(lines);
  }
  el('stationNext').addEventListener('click', () => {
    el('stationMsg').hidden = true;
    S.stations.round++;
    runRound();
  });
  document.addEventListener('click', e => { if (e.target.id === 'stationStop') stopStations(); });
  function stopStations() {
    if (S.stations) clearInterval(S.stations.iv);
    S.stations = null;
    el('stationsBar').hidden = true;
    el('svTimer').hidden = true;
    if (S.doc) renderCanvas();
  }

  // ---------- شاشة الطلاب ----------
  function openStudentView() {
    el('studentView').hidden = false;
    try { el('studentView').requestFullscreen && el('studentView').requestFullscreen().catch(() => {}); } catch (e) { /* تجاهل */ }
    renderStudentView();
  }
  function closeStudentView() {
    el('studentView').hidden = true;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* تجاهل */ }
  }
  function renderStudentView(announce) {
    if (el('studentView').hidden) return;
    const cls = S.classId ? Classes.get(S.classId) : null;
    el('svTitle').textContent = cls ? Classes.label(cls) : 'الصف';
    el('svSub').textContent = S.doc.name + (S.stations ? ` · الجولة ${S.stations.round + 1} من ${S.stations.total}` : '');
    const box = el('svRoom');
    const W = S.doc.room.w * U, H = S.doc.room.h * U;
    const scale = Math.min((box.clientWidth || 900) / W, (box.clientHeight || 600) / H) * 0.96;
    box.innerHTML = RD.roomSVG(S.doc, renderOpts(Object.assign({
      student: true, grid: false, nums: false, tags: false, width: W * scale, height: H * scale
    }, transitionOverlay())));
    const info = el('svInfo');
    const lines = announce || null;
    if (lines) {
      info.hidden = false;
      el('svStep').textContent = el('stationMsgTitle').textContent;
      el('svChips').innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join('');
      el('svPrev').hidden = el('svNext').hidden = true;
    } else if (S.trans) {
      info.hidden = false;
      const step = S.trans.steps[S.step];
      el('svStep').textContent = step ? step.text : '';
      el('svChips').innerHTML = step && step.chips ? step.chips.map(c => `<span><i style="background:${c.color}"></i>${esc(c.label)} (${c.count})</span>`).join('') : '';
      el('svPrev').hidden = el('svNext').hidden = false;
      el('svNext').textContent = step && step.kind === 'timer' && !S.timer ? 'ابدأ المؤقت' : 'التالي';
    } else info.hidden = true;
  }
  el('studentViewBtn').addEventListener('click', openStudentView);
  el('svExit').addEventListener('click', closeStudentView);
  el('svPrev').addEventListener('click', () => goStep(S.step - 1));
  el('svNext').addEventListener('click', () => goStep(S.step + 1));
  window.addEventListener('resize', () => renderStudentView());

  // ---------- الحفظ والمخططات المحفوظة ----------
  const savedAll = () => store.get('seat:saved', []);
  function thumbOf(doc) {
    return RD.roomSVG(doc, renderOpts({ student: true, grid: false, nums: false, tags: false, width: '100%', height: '100%' }));
  }
  el('saveBtn').addEventListener('click', () => {
    el('saveName').value = S.doc.name;
    el('saveCat').value = S.doc.category || 'المخطط الأساسي';
    el('saveNotes').value = S.doc.notes || '';
    el('saveModal').hidden = false;
    el('saveName').focus();
  });
  function doSave(asNew) {
    const name = el('saveName').value.trim() || 'مخطط بدون اسم';
    const before = snap();
    Object.assign(S.doc, { name, category: el('saveCat').value, notes: el('saveNotes').value.trim(), classId: S.classId, lastUsed: Date.now() });
    const list = savedAll();
    const entry = Object.assign(clone(S.doc), { thumb: thumbOf(S.doc), className: S.classId && Classes.get(S.classId) ? Classes.label(Classes.get(S.classId)) : 'صف تجريبي' });
    const idx = list.findIndex(x => x.savedId === S.doc.savedId);
    if (!asNew && S.doc.savedId && idx > -1) {
      entry.created = list[idx].created;
      list[idx] = entry;
    } else {
      S.doc.savedId = T.uid();
      entry.savedId = S.doc.savedId;
      entry.created = Date.now();
      S.doc.created = entry.created;
      list.unshift(entry);
    }
    store.set('seat:saved', list);
    // سجل الجيران والمقاعد لمنع التكرار في التوزيعات القادمة
    const pos = E.seatPositions(S.doc);
    const seatsHist = {};
    Object.entries(pos).forEach(([id, p]) => { seatsHist[id] = { x: p.x, y: p.y }; });
    store.set('seat:history:' + key(), { pairs: E.pairsOf(S.doc), seats: seatsHist });
    el('saveModal').hidden = true;
    commit(before);
    toast('حُفظ المخطط «' + name + '».');
  }
  el('saveForm').addEventListener('submit', e => { e.preventDefault(); doSave(false); });
  el('saveAsNew').addEventListener('click', () => doSave(true));

  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString('ar-u-nu-latn-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }
  function renderSaved() {
    const onlyThis = el('libThisClass').checked;
    const list = savedAll().filter(x => !onlyThis || (x.classId || '') === S.classId);
    el('savedGrid').innerHTML = list.map(x => `
      <div class="st-saved" data-sid="${x.savedId}">
        <div class="thumb">${x.thumb || ''}</div>
        <div class="meta">
          <b>${esc(x.name)}</b>
          <span class="cat">${esc(x.category || '')}</span>
          <span>${esc(x.className || '')}</span>
          <span>أُنشئ: ${fmtDate(x.created)} · آخر استخدام: ${fmtDate(x.lastUsed)}</span>
          ${x.notes ? `<span>${esc(x.notes)}</span>` : ''}
        </div>
        <div class="acts">
          <button type="button" data-sa="open">فتح</button>
          <button type="button" data-sa="copy">نسخ</button>
          <button type="button" data-sa="png">صورة</button>
          <button type="button" data-sa="print">طباعة</button>
          <button type="button" class="danger" data-sa="del">حذف</button>
        </div>
      </div>`).join('') || '<p class="st-hint">لا توجد مخططات محفوظة بعد. اضغط «حفظ» في الشريط العلوي.</p>';
  }
  el('libraryBtn').addEventListener('click', () => { renderSaved(); el('libModal').hidden = false; });
  el('libThisClass').addEventListener('change', renderSaved);
  el('savedGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-sa]');
    if (!b) return;
    const sid = b.closest('[data-sid]').dataset.sid;
    const list = savedAll();
    const x = list.find(i => i.savedId === sid);
    if (!x) return;
    const act = b.dataset.sa;
    if (act === 'open') {
      if ((x.classId || '') !== S.classId) { loadClass(x.classId || ''); el('classSel').value = x.classId || ''; }
      const before = snap();
      S.prevDoc = clone(S.doc);
      const d = clone(x);
      delete d.thumb; delete d.className;
      d.lastUsed = Date.now();
      S.doc = d;
      x.lastUsed = d.lastUsed;
      store.set('seat:saved', list);
      S.pendingType = d.type;
      S.pendingSettings = autoSettings(d.type, d.settings);
      makeTransition();
      el('libModal').hidden = true;
      commit(before);
      renderTypes();
      renderShapeForm();
      zoomFit();
      toast('فُتح المخطط «' + x.name + '»' + (S.trans ? '، وخطة الانتقال إليه جاهزة.' : '.'));
    } else if (act === 'copy') {
      const c = clone(x);
      c.savedId = T.uid();
      c.name = x.name + ' (نسخة)';
      c.created = c.lastUsed = Date.now();
      list.unshift(c);
      store.set('seat:saved', list);
      renderSaved();
    } else if (act === 'del') {
      if (!b.classList.contains('is-confirm')) { b.classList.add('is-confirm'); b.textContent = 'تأكيد الحذف'; setTimeout(() => { b.classList.remove('is-confirm'); b.textContent = 'حذف'; }, 3500); return; }
      store.set('seat:saved', list.filter(i => i.savedId !== sid));
      if (S.doc.savedId === sid) S.doc.savedId = null;
      renderSaved();
    } else if (act === 'png') exportPng(x);
    else if (act === 'print') printDoc(x);
  });

  // ---------- التصدير ----------
  function exportSvg(doc) {
    const W = doc.room.w * U, H = doc.room.h * U;
    return RD.roomSVG(doc, renderOpts({ student: true, grid: false, nums: false, tags: false, width: W * 2, height: H * 2 }));
  }
  function exportPng(doc) {
    const str = exportSvg(doc);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = (doc.name || 'مخطط') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('جُهّزت الصورة للتنزيل.');
    };
    img.onerror = () => toast('تعذّر إنشاء الصورة في هذا المتصفح.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  }
  function printDoc(doc) {
    el('printArea').innerHTML = `<h1>${esc(doc.name)}</h1>` + exportSvg(doc);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { /* تجاهل */ }
    setTimeout(done, 1500);
  }
  el('exportPng').addEventListener('click', () => exportPng(S.doc));
  el('exportPdf').addEventListener('click', () => printDoc(S.doc));

  // إغلاق النوافذ
  document.querySelectorAll('.st-modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) m.hidden = true;
  }));

  // ---------- تحميل الصف ----------
  function loadClass(id) {
    stopStations();
    stopTimer();
    S.classId = id || '';
    const cls = S.classId ? Classes.get(S.classId) : null;
    S.students = cls ? cls.students.map(s => ({ id: s.id, name: s.name })) : DEMO;
    S.profiles = store.get('seat:profiles:' + key(), null);
    if (!S.profiles) {
      S.profiles = {};
      if (!cls) {
        // بيانات نموذجية لتجربة القواعد
        [[0, { level: 1 }], [1, { level: 3, support: true }], [2, { vision: true }], [3, { level: 1, tall: true }], [5, { level: 3 }], [7, { short: true, hearing: true }], [9, { lowPart: true }], [12, { level: 1 }], [15, { level: 3, notBack: true }], [20, { tall: true }]].forEach(([i, p]) => { S.profiles[DEMO[i].id] = p; });
      }
    }
    S.rules = store.get('seat:rules:' + key(), { separate: [], together: [] });
    S.doc = store.get('seat:draft:' + key(), null);
    S.undo = []; S.redo = []; S.prevDoc = null; S.trans = null; S.report = []; S.sel.clear();
    if (!S.doc || !S.doc.items) {
      S.doc = newDoc('rows');
      distributeInto(S.doc);
      saveDraft();
    }
    S.pendingType = S.doc.type;
    S.pendingSettings = autoSettings(S.doc.type, S.doc.settings);
    el('sepPick').innerHTML = '';
    renderTypes();
    renderShapeForm();
    renderStudents();
    syncView();
    renderAll();
    requestAnimationFrame(zoomFit);
  }

  function initClassSelect() {
    const sel = el('classSel');
    const count = Classes.fillSelect(sel, { emptyLabel: 'صف تجريبي (أسماء نموذجية)' });
    if (!count) sel.innerHTML = '<option value="">صف تجريبي (أسماء نموذجية)</option>';
    sel.addEventListener('change', () => { Classes.setActive(sel.value); loadClass(sel.value); });
    return Classes.get(Classes.getActive()) ? Classes.getActive() : '';
  }

  renderLibrary();
  syncMethodPanel();
  syncMode();
  loadClass(initClassSelect());
})();
