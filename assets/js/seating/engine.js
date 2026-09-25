/* مخطط الجلوس — محرك التوزيع
   يوزّع الطلاب على المقاعد بتقليل «تكلفة» تجمع:
   قواعد إلزامية (الفصل، الجمع، منع الخلف، التثبيت) + تفضيلات طريقة التوزيع المختارة.
   الخوارزمية: توزيع عشوائي أولي ثم تحسين بتبديل المقاعد (تلدين محاكى). */
(function () {
  const T = window.SeatTemplates;

  const METHODS = [
    { id: 'random', name: 'عشوائي كامل', desc: 'توزيع جميع الطلاب عشوائيًا' },
    { id: 'norepeat', name: 'عشوائي دون تكرار', desc: 'يتجنب المقعد والجار في المخطط المحفوظ السابق' },
    { id: 'level', name: 'حسب المستوى', desc: 'مجموعات من المستوى نفسه، والأحوج للدعم في المقدمة' },
    { id: 'balanced', name: 'متوازن', desc: 'مستويات متنوعة داخل كل مجموعة' },
    { id: 'similar', name: 'مستويات متقاربة', desc: 'جمع الطلاب ذوي المستوى المتقارب' },
    { id: 'mentor', name: 'مرتفع الأداء مع من يحتاج دعمًا', desc: 'في كل زوج أو مجموعة طالب متقدم وطالب يحتاج دعمًا' },
    { id: 'support', name: 'حسب احتياجات الدعم', desc: 'تقريب من يحتاجون دعمًا من المعلم' },
    { id: 'senses', name: 'حسب الرؤية أو السمع', desc: 'مقاعد أمامية لحالات الرؤية والسمع' },
    { id: 'height', name: 'حسب الطول', desc: 'القصار في الأمام والطوال في الخلف لتقليل حجب الرؤية' },
    { id: 'participation', name: 'حسب المشاركة', desc: 'تقريب الأقل مشاركة وتوزيعهم على المجموعات' },
    { id: 'attendance', name: 'حسب الحضور', desc: 'توزيع الحاضرين فقط، وإخفاء الغائبين' },
    { id: 'manual', name: 'اختيار يدوي', desc: 'اسحب الأسماء إلى المقاعد بنفسك' }
  ];

  const ROLES = ['قائد المجموعة', 'الكاتب', 'المتحدث', 'ضابط الوقت', 'المراجع', 'مسؤول المواد'];

  const rnd = n => Math.floor(Math.random() * n);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  // الجيران: نفس الطاولة، أو مقعدان متجاوران في الصف نفسه
  function neighborPairs(seats) {
    const out = [];
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const a = seats[i], b = seats[j];
        if (a.group && a.group === b.group) { out.push([i, j]); continue; }
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 2.9 && Math.abs(a.y - b.y) < 1.2) out.push([i, j]);
      }
    }
    return out;
  }

  // موقع مقدمة الصف (السبورة أو الشاشة) وموقع مكتب المعلم
  function anchors(items) {
    const board = items.find(i => i.kind === 'board') || items.find(i => i.kind === 'screen');
    const desk = items.find(i => i.kind === 'tdesk');
    const c = it => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
    return { front: board ? c(board) : null, teacher: desk ? c(desk) : (board ? c(board) : null) };
  }

  function frontRanks(seats, point) {
    const d = seats.map(s => point ? Math.hypot(s.x - point.x, s.y - point.y) : s.y);
    const min = Math.min(...d), max = Math.max(...d);
    return d.map(v => (max - min < 0.01 ? 0 : (v - min) / (max - min)));
  }

  function profileOf(profiles, id) {
    return Object.assign({ level: 2 }, profiles[id] || {});
  }

  /* التوزيع
     opts: { layout, students, profiles, method, rules, history } */
  function distribute(opts) {
    const { layout, profiles } = opts;
    const method = opts.method || 'random';
    const rules = Object.assign({ separate: [], together: [], avoidPrev: true, heightAware: true }, opts.rules || {});
    const history = opts.history || { pairs: [], seats: {} };
    const allSeats = T.seatsOf(layout.items);
    const blocked = layout.blocked || {};
    const pins = layout.pins || {};
    const subs = layout.subs || {};
    const present = opts.students.filter(s => !profileOf(profiles, s.id).absent);
    const presentIds = new Set(present.map(s => s.id));
    const assign = {};
    const report = [];

    // المقاعد المثبتة (مع البديل عند الغياب)
    const fixed = new Map(); // seatIndex -> studentId
    const used = new Set();
    allSeats.forEach((s, i) => {
      if (!pins[s.id] || blocked[s.id]) return;
      let sid = (layout.assign || {})[s.id];
      if (sid && !presentIds.has(sid)) {
        const sub = subs[s.id];
        if (sub && presentIds.has(sub) && !used.has(sub)) {
          report.push({ type: 'info', text: `غاب طالب مثبت، فجلس البديل مكانه.` });
          sid = sub;
        } else sid = null;
      }
      if (sid && !used.has(sid)) { fixed.set(i, sid); used.add(sid); }
    });

    const freeSeats = [];
    allSeats.forEach((s, i) => { if (!blocked[s.id] && !fixed.has(i)) freeSeats.push(i); });
    const freeStudents = shuffle(present.filter(s => !used.has(s.id)).map(s => s.id));

    if (method === 'manual') {
      // نُبقي التوزيع الحالي للحاضرين فقط
      const keep = layout.assign || {};
      allSeats.forEach((s, i) => {
        if (fixed.has(i)) assign[s.id] = fixed.get(i);
        else if (!blocked[s.id] && keep[s.id] && presentIds.has(keep[s.id])) assign[s.id] = keep[s.id];
      });
      const seated = new Set(Object.values(assign));
      return { assign, unseated: present.filter(s => !seated.has(s.id)).map(s => s.id), report };
    }

    if (!allSeats.length) {
      report.push({ type: 'info', text: 'المخطط لا يحتوي مقاعد بعد. أضف مقاعد أو طاولات من مكتبة العناصر، ثم اضغط «إعادة توزيع المقاعد غير المثبتة».' });
      return { assign, unseated: freeStudents, report };
    }
    if (freeStudents.length > freeSeats.length) {
      report.push({ type: 'warn', text: `عدد الحاضرين أكبر من المقاعد المتاحة بـ ${freeStudents.length - freeSeats.length}. أضف مقاعد أو ألغِ منع بعض المقاعد.` });
    }

    // تجهيز البيانات
    const anc = anchors(layout.items);
    const f = frontRanks(allSeats, anc.front);
    const tDist = frontRanks(allSeats, anc.teacher);
    const neigh = neighborPairs(allSeats);
    const neighSet = new Set(neigh.map(([a, b]) => a + ',' + b));
    const isNeighbor = (a, b) => neighSet.has(Math.min(a, b) + ',' + Math.max(a, b));
    const groupOf = allSeats.map(s => s.group);
    const clusters = {};
    allSeats.forEach((s, i) => { if (s.group) (clusters[s.group] = clusters[s.group] || []).push(i); });
    const clusterList = Object.values(clusters);
    const hasClusters = clusterList.length > 0;
    // من يجلس خلف من (لحجب الرؤية)
    const behind = [];
    allSeats.forEach((a, i) => allSeats.forEach((b, j) => {
      if (i !== j && Math.abs(a.x - b.x) < 1.3 && f[j] > f[i] + 0.05 && Math.hypot(a.x - b.x, a.y - b.y) < 3.2) behind.push([i, j]);
    }));
    const prevPairs = new Set(history.pairs || []);
    const prevSeats = history.seats || {};
    const P = {};
    present.forEach(s => { P[s.id] = profileOf(profiles, s.id); });

    const sepSets = (rules.separate || []).map(set => new Set(set.filter(id => presentIds.has(id)))).filter(s => s.size > 1);
    const togSets = (rules.together || []).map(set => set.filter(id => presentIds.has(id))).filter(s => s.length > 1);

    const W = {
      front: method === 'senses' || rules.frontPriority ? 9 : 3,
      support: method === 'support' ? 9 : method === 'level' ? 3 : 1,
      height: method === 'height' || (rules.heightAware && layout.type === 'theater') ? 5 : 0,
      part: method === 'participation' ? 5 : 0,
      repeat: method === 'norepeat' ? 14 : rules.avoidPrev ? 6 : 0
    };

    // التكلفة الكاملة لتوزيع (seatIndex -> studentId)
    function cost(at) {
      let c = 0;
      for (let i = 0; i < at.length; i++) {
        const sid = at[i];
        if (!sid) continue;
        const p = P[sid];
        const fr = f[i];
        if (p.vision) c += W.front * 2 * fr;
        if (p.hearing) c += W.front * 1.5 * tDist[i];
        if (p.support || p.level === 3) c += W.support * tDist[i];
        if (p.lowPart) c += W.part * fr;
        if (p.notBack && fr > 0.55) c += 60;
        if (W.height) {
          if (p.tall) c += W.height * (1 - fr);
          if (p.short) c += W.height * fr;
        }
        if (method === 'norepeat' && prevSeats[sid]) {
          const ps = prevSeats[sid], s = allSeats[i];
          if (Math.hypot(ps.x - s.x, ps.y - s.y) < 1) c += 8;
        }
      }
      // أزواج الجيران
      for (const [i, j] of neigh) {
        const a = at[i], b = at[j];
        if (!a || !b) continue;
        for (const set of sepSets) if (set.has(a) && set.has(b)) c += 80;
        if (W.repeat && prevPairs.has(pairKey(a, b))) c += W.repeat;
        if (!hasClusters) {
          const la = P[a].level, lb = P[b].level;
          if (method === 'balanced' && la === lb) c += 3;
          if ((method === 'similar' || method === 'level') && la !== lb) c += 3 * Math.abs(la - lb);
          if (method === 'mentor' && !((la === 1 && lb === 3) || (la === 3 && lb === 1))) c += 4;
          if (method === 'participation' && P[a].lowPart && P[b].lowPart) c += 6;
        }
      }
      // الفصل داخل الطاولة نفسها حتى لو لم يكونا متجاورين مباشرة
      if (sepSets.length && hasClusters) {
        clusterList.forEach(cl => {
          const ids = cl.map(i => at[i]).filter(Boolean);
          sepSets.forEach(set => { const k = ids.filter(id => set.has(id)).length; if (k > 1) c += 60 * (k - 1); });
        });
      }
      // خط النظر
      if (W.height) {
        for (const [i, j] of behind) {
          const a = at[i], b = at[j];
          if (a && b && P[a].tall && P[b].short) c += W.height;
        }
      }
      // تكوين المجموعات
      if (hasClusters) {
        clusterList.forEach(cl => {
          const lv = cl.map(i => at[i]).filter(Boolean).map(id => P[id].level);
          if (lv.length < 2) return;
          const mean = lv.reduce((x, y) => x + y, 0) / lv.length;
          if (method === 'balanced') {
            const distinct = new Set(lv).size;
            c += (lv.length - distinct) * 2 + (3 - (Math.max(...lv) - Math.min(...lv))) * 2;
          } else if (method === 'similar' || method === 'level') {
            c += lv.reduce((x, v) => x + Math.abs(v - mean), 0) * 3;
          } else if (method === 'mentor') {
            if (!lv.includes(1)) c += 6;
            if (!lv.includes(3)) c += 6;
          }
          if (method === 'participation') {
            const low = cl.map(i => at[i]).filter(id => id && P[id].lowPart).length;
            if (low > 1) c += (low - 1) * 6;
          }
        });
      }
      // الجمع في مجموعة واحدة
      if (togSets.length) {
        const pos = {};
        at.forEach((sid, i) => { if (sid) pos[sid] = i; });
        togSets.forEach(set => {
          for (let x = 0; x < set.length; x++) for (let y = x + 1; y < set.length; y++) {
            const i = pos[set[x]], j = pos[set[y]];
            if (i === undefined || j === undefined) continue;
            const same = groupOf[i] && groupOf[i] === groupOf[j];
            if (!same && !isNeighbor(i, j)) c += 40;
          }
        });
      }
      return c;
    }

    // التوزيع الأولي
    const at = new Array(allSeats.length).fill(null);
    fixed.forEach((sid, i) => { at[i] = sid; });
    const order = shuffle(freeSeats.slice());
    freeStudents.forEach((sid, k) => { if (k < order.length) at[order[k]] = sid; });
    const unseated = freeStudents.slice(order.length);

    // التحسين بتبديل المقاعد الحرة
    if (method !== 'random' && method !== 'attendance' || sepSets.length || togSets.length || present.some(s => P[s.id].notBack || P[s.id].vision || P[s.id].hearing)) {
      let cur = cost(at);
      const iters = Math.min(9000, 1500 + freeSeats.length * 120);
      let temp = 4;
      for (let k = 0; k < iters && freeSeats.length > 1; k++) {
        const i = freeSeats[rnd(freeSeats.length)], j = freeSeats[rnd(freeSeats.length)];
        if (i === j || (!at[i] && !at[j])) continue;
        [at[i], at[j]] = [at[j], at[i]];
        const next = cost(at);
        if (next <= cur || Math.random() < Math.exp((cur - next) / temp)) cur = next;
        else [at[i], at[j]] = [at[j], at[i]];
        temp = Math.max(0.03, temp * 0.9993);
      }
    }

    at.forEach((sid, i) => { if (sid) assign[allSeats[i].id] = sid; });

    // تنبيهات القواعد التي لم تتحقق
    const posOf = {};
    at.forEach((sid, i) => { if (sid) posOf[sid] = i; });
    let sepBroken = 0, togBroken = 0;
    sepSets.forEach(set => {
      const ids = [...set];
      for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
        const i = posOf[ids[x]], j = posOf[ids[y]];
        if (i === undefined || j === undefined) continue;
        if ((groupOf[i] && groupOf[i] === groupOf[j]) || isNeighbor(i, j)) sepBroken++;
      }
    });
    togSets.forEach(set => {
      for (let x = 0; x < set.length; x++) for (let y = x + 1; y < set.length; y++) {
        const i = posOf[set[x]], j = posOf[set[y]];
        if (i === undefined || j === undefined) continue;
        if (!((groupOf[i] && groupOf[i] === groupOf[j]) || isNeighbor(i, j))) togBroken++;
      }
    });
    if (sepBroken) report.push({ type: 'warn', text: `تعذّر فصل ${sepBroken} من أزواج «منع التجاور» بسبب شكل المخطط أو التثبيت.` });
    if (togBroken) report.push({ type: 'warn', text: `تعذّر جمع ${togBroken} من أزواج «الجمع» في مجموعة واحدة؛ قد تكون المجموعات أصغر من العدد المطلوب.` });
    const notBackBroken = at.filter((sid, i) => sid && P[sid].notBack && f[i] > 0.55).length;
    if (notBackBroken) report.push({ type: 'warn', text: `${notBackBroken} من طلاب «ليس في الخلف» لم يحصلوا على مقعد أمامي كافٍ.` });
    if (unseated.length) report.push({ type: 'warn', text: `${unseated.length} طالب بلا مقعد.` });

    return { assign, unseated, report };
  }

  // الأدوار داخل المجموعات (3 طلاب فأكثر)، مع تجنب تكرار الدور السابق للطالب
  function assignRoles(layout, prevRoles) {
    const seats = T.seatsOf(layout.items);
    const groups = {};
    seats.forEach(s => {
      const sid = (layout.assign || {})[s.id];
      if (s.group && sid) (groups[s.group] = groups[s.group] || []).push(sid);
    });
    const roles = {};
    Object.values(groups).forEach(ids => {
      if (ids.length < 3) return;
      let best = null, bestScore = Infinity;
      for (let t = 0; t < 25; t++) {
        const order = shuffle(ids.slice());
        const score = order.filter((id, k) => prevRoles && prevRoles[id] === ROLES[k % ROLES.length]).length;
        if (score < bestScore) { best = order; bestScore = score; if (!score) break; }
      }
      best.forEach((id, k) => { if (k < ROLES.length) roles[id] = ROLES[k]; });
    });
    return roles;
  }

  // أزواج الجيران في توزيع (لحفظ السجل ومنع التكرار لاحقًا)
  function pairsOf(layout) {
    const seats = T.seatsOf(layout.items);
    const out = [];
    neighborPairs(seats).forEach(([i, j]) => {
      const a = (layout.assign || {})[seats[i].id], b = (layout.assign || {})[seats[j].id];
      if (a && b) out.push(pairKey(a, b));
    });
    return out;
  }

  function seatPositions(layout) {
    const pos = {};
    T.seatsOf(layout.items).forEach(s => {
      const sid = (layout.assign || {})[s.id];
      if (sid) pos[sid] = { x: s.x, y: s.y, group: s.group, seatId: s.id };
    });
    return pos;
  }

  window.SeatEngine = { METHODS, ROLES, distribute, assignRoles, pairsOf, seatPositions, neighborPairs, anchors };
})();
