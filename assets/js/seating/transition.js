/* مخطط الجلوس — خطة الانتقال بين مخططين
   تقسّم الطلاب المنتقلين إلى دفعات ملونة حسب وجهتهم (طاولة أو صف)،
   وتبدأ بالأقرب للمقدمة، ولا تتجاوز الدفعة الواحدة عددًا محددًا لتقليل الازدحام. */
(function () {
  const T = window.SeatTemplates;
  const E = window.SeatEngine;

  const BATCH_COLORS = [
    { name: 'بالأزرق', c: '#2F80ED' },
    { name: 'بالأخضر', c: '#27AE60' },
    { name: 'بالبرتقالي', c: '#F2994A' },
    { name: 'بالبنفسجي', c: '#9B51E0' },
    { name: 'بالوردي', c: '#EB5A9A' },
    { name: 'بالفيروزي', c: '#17A2B8' },
    { name: 'بالأصفر', c: '#D4A017' },
    { name: 'بالأحمر', c: '#E5484D' }
  ];
  const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];

  function countStudents(n) {
    if (n === 1) return 'طالب واحد';
    if (n === 2) return 'طالبان';
    if (n <= 10) return n + ' طلاب';
    return n + ' طالبًا';
  }
  function duration(sec) {
    if (sec < 60) return sec + ' ثانية';
    const m = Math.round(sec / 6) / 10;
    if (m === 1) return 'دقيقة واحدة';
    if (m === 2) return 'دقيقتان';
    return m + (m <= 10 ? ' دقائق' : ' دقيقة');
  }

  function itemSig(items) {
    return items.filter(i => T.KINDS[i.kind].seating)
      .map(i => [i.kind, Math.round(i.x * 2), Math.round(i.y * 2), Math.round(i.rot || 0), i.cap || 0].join(','))
      .sort().join(';');
  }

  // أسماء الطاولات مرتبة من الأمام للخلف ومن اليمين لليسار
  function tableNames(items) {
    const tables = items.filter(i => T.KINDS[i.kind].seating && T.seatSlots(i).length > 1)
      .sort((a, b) => (a.y - b.y) || (b.x - a.x));
    const names = {};
    tables.forEach((t, k) => { names[t.id] = t.station !== undefined ? null : 'الطاولة ' + (k + 1); });
    return names;
  }

  function rowBands(seats) {
    const ys = [...new Set(seats.map(s => Math.round(s.y)))].sort((a, b) => a - b);
    const band = y => ys.indexOf(Math.round(y));
    return band;
  }

  /* prev و next: مستندا مخطط { items, assign }
     opts: { batchMax, timerSec, names: {id: name} } */
  function plan(prev, next, opts) {
    const o = Object.assign({ batchMax: 6, timerSec: 120 }, opts || {});
    const from = E.seatPositions(prev);
    const to = E.seatPositions(next);
    const nextSeats = T.seatsOf(next.items);
    const band = rowBands(nextSeats);
    const tNames = tableNames(next.items);
    const zones = next.items.filter(i => i.kind === 'zone');
    const door = next.items.find(i => i.kind === 'door');
    const doorPos = door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : { x: 0, y: 0 };
    const structureChanged = itemSig(prev.items || []) !== itemSig(next.items || []);

    const stay = [], movers = [];
    Object.keys(to).forEach(id => {
      const t = to[id];
      const f = from[id];
      if (f && Math.hypot(f.x - t.x, f.y - t.y) < 0.6) stay.push(id);
      else movers.push({ id, from: f || doorPos, to: t, isNew: !f });
    });

    // تجميع المنتقلين حسب الوجهة
    const destKey = m => m.to.group || ('row' + band(m.to.y));
    const destLabel = m => {
      if (m.to.group) {
        const it = next.items.find(i => i.id === m.to.group);
        if (it && it.station !== undefined) {
          const z = zones.find(zz => zz.station === it.station);
          return z ? z.label : 'المحطة ' + (it.station + 1);
        }
        return tNames[m.to.group] || 'طاولتهم';
      }
      return 'الصف ' + (ORD[band(m.to.y)] || (band(m.to.y) + 1));
    };
    const groups = {};
    movers.forEach(m => { const k = destKey(m); (groups[k] = groups[k] || { key: k, label: destLabel(m), y: m.to.y, list: [] }).list.push(m); });
    const ordered = Object.values(groups).sort((a, b) => a.y - b.y);

    // دفعات: مجموعة وجهة أو أكثر، بحد أقصى batchMax طالبًا
    const batches = [];
    let cur = null;
    ordered.forEach(g => {
      if (!cur || cur.count + g.list.length > o.batchMax) {
        cur = { dests: [], count: 0 };
        batches.push(cur);
      }
      cur.dests.push(g);
      cur.count += g.list.length;
    });

    const steps = [];
    if (structureChanged) {
      const seating = next.items.filter(i => T.KINDS[i.kind].seating).length;
      steps.push({ kind: 'furniture', text: `رتّبوا الأثاث كما في المخطط الجديد (${seating} ${seating > 10 ? 'قطعة' : 'قطع'} جلوس)، وتبدأ الطاولات الأمامية أولًا.`, movers: [] });
    }
    if (stay.length) {
      steps.push({ kind: 'stay', text: stay.length === Object.keys(to).length ? 'يبقى جميع الطلاب في أماكنهم.' : `${stay.length === 1 ? 'يبقى' : 'يبقى'} ${countStudents(stay.length)} في ${stay.length === 1 ? 'مكانه' : 'أماكنهم'} دون حركة.`, movers: [], stay });
    }
    let colorIdx = 0;
    batches.forEach((b, k) => {
      const parts = b.dests.map(d => {
        const col = BATCH_COLORS[colorIdx++ % BATCH_COLORS.length];
        d.list.forEach(m => { m.color = col.c; });
        return { col, d };
      });
      const text = parts.map(({ col, d }) => `ينتقل الطلاب المميزون ${col.name} إلى ${d.label}`).join('، و');
      steps.push({
        kind: 'move',
        text: (batches.length > 1 ? `الدفعة ${k + 1}: ` : '') + text + '.',
        movers: [].concat(...b.dests.map(d => d.list)),
        chips: parts.map(({ col, d }) => ({ color: col.c, label: d.label, count: d.list.length }))
      });
    });
    if (movers.length) steps.push({ kind: 'timer', text: `يبدأ مؤقت الانتقال (${duration(o.timerSec)})، ويظهر تنبيه صوتي عند انتهائه.`, seconds: o.timerSec, movers: [] });
    steps.push({ kind: 'done', text: movers.length ? 'انتهى الانتقال: الجميع في أماكنهم الجديدة.' : 'لا توجد حركة مطلوبة.', movers: [] });

    return { steps, stay, movers, structureChanged, batches: batches.length };
  }

  window.SeatTransition = { plan, BATCH_COLORS, countStudents };
})();
