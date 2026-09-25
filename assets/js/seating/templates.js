/* مخطط الجلوس — العناصر والقوالب
   الوحدات: كل وحدة = خانة شبكة (تُرسم 40 بكسل عند التكبير 100%).
   العنصر: { id, kind, x, y, w, h, rot, cap?, label? } — (x, y) الزاوية العليا، والدوران حول المركز. */
(function () {
  const uid = () => 'i' + Math.random().toString(36).slice(2, 9);

  const KINDS = {
    seat:    { name: 'مقعد', w: 1.8, h: 1.5, seating: true },
    desk2:   { name: 'طاولة ثنائية', w: 3.6, h: 1.5, seating: true },
    table:   { name: 'طاولة جماعية', w: 3.2, h: 2.2, seating: true, cap: 4 },
    round:   { name: 'طاولة دائرية', w: 3, h: 3, seating: true, cap: 5 },
    board:   { name: 'سبورة', w: 8, h: 0.6 },
    tdesk:   { name: 'مكتب المعلم', w: 3.4, h: 1.6 },
    door:    { name: 'باب', w: 2.2, h: 0.5 },
    window:  { name: 'نافذة', w: 3.2, h: 0.35 },
    screen:  { name: 'شاشة عرض', w: 4, h: 0.45 },
    cabinet: { name: 'خزانة', w: 2.4, h: 1 },
    aisle:   { name: 'ممر', w: 1.8, h: 8 },
    zone:    { name: 'منطقة نشاط', w: 6, h: 5 },
    blocked: { name: 'غير قابل للاستخدام', w: 2.4, h: 2.4 }
  };

  // مواقع المقاعد داخل العنصر (نسبة إلى مركزه، قبل الدوران)
  function seatSlots(item) {
    const k = item.kind;
    if (k === 'seat') return [{ x: 0, y: 0 }];
    if (k === 'desk2') return [{ x: -item.w / 4, y: 0 }, { x: item.w / 4, y: 0 }];
    if (k === 'table') {
      const c = item.cap || 4;
      const top = Math.ceil(c / 2), bottom = c - top;
      const row = (count, y) => Array.from({ length: count }, (_, i) => ({ x: -item.w / 2 + item.w * (i + 0.5) / count, y }));
      return row(top, -item.h / 2 - 0.62).concat(row(bottom, item.h / 2 + 0.62));
    }
    if (k === 'round') {
      const c = item.cap || 5;
      const r = item.w / 2 + 0.7;
      return Array.from({ length: c }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / c;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
    }
    return [];
  }

  // المقاعد بإحداثيات الغرفة
  function seatsOf(items) {
    const out = [];
    items.forEach(it => {
      const slots = seatSlots(it);
      if (!slots.length) return;
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      const a = (it.rot || 0) * Math.PI / 180;
      slots.forEach((s, i) => {
        out.push({
          id: it.id + ':' + i,
          itemId: it.id,
          index: i,
          x: cx + s.x * Math.cos(a) - s.y * Math.sin(a),
          y: cy + s.x * Math.sin(a) + s.y * Math.cos(a),
          lx: s.x,
          ly: s.y,
          group: slots.length > 1 ? it.id : null
        });
      });
    });
    return out;
  }

  function make(kind, x, y, extra) {
    const k = KINDS[kind];
    return Object.assign({ id: uid(), kind, x, y, w: k.w, h: k.h, rot: 0 }, k.cap ? { cap: k.cap } : {}, extra || {});
  }

  // أبعاد الغرفة حسب العناصر
  function fitRoom(items, minW, minH) {
    let maxX = minW || 16, maxY = minH || 12;
    items.forEach(it => { maxX = Math.max(maxX, it.x + it.w + 1.5); maxY = Math.max(maxY, it.y + it.h + 1.5); });
    return { w: Math.ceil(maxX), h: Math.ceil(maxY) };
  }

  // عناصر ثابتة في مقدمة الصف: سبورة ومكتب المعلم وباب
  function frontItems(width) {
    return [
      make('board', width / 2 - 4, 0.4),
      make('tdesk', width - 4.6, 1.6),
      make('door', 0.6, 0.05)
    ];
  }

  /* ---------- القوالب ---------- */
  const T = {};

  // الصفوف التقليدية والمتبادلة
  function rowsLayout(s, staggered) {
    const R = Math.max(1, s.rows), P = Math.max(1, s.perRow);
    const pair = s.pair === 'double';
    const unitW = pair ? 3.6 : 1.8;
    const perItem = pair ? 2 : 1;
    const itemsPerRow = Math.ceil(P / perItem);
    const gapX = pair ? 1 : 0.7;
    const aisleW = 2;
    const rowGap = 2.6;
    const shift = staggered ? (unitW + gapX) / 2 : 0;
    const center = s.aisle === 'center' ? Math.ceil(itemsPerRow / 2) : -1;
    let rowWidth = itemsPerRow * unitW + (itemsPerRow - 1) * gapX + (s.aisle === 'center' ? aisleW - gapX : 0);
    const side = s.aisle === 'sides' ? aisleW : 0;
    const width = Math.max(18, rowWidth + side * 2 + 4 + shift);
    const items = frontItems(width);
    const startX = (width - rowWidth - shift) / 2;
    for (let r = 0; r < R; r++) {
      let x = startX + (staggered && r % 2 ? shift : 0);
      for (let c = 0; c < itemsPerRow; c++) {
        if (c === center) x += aisleW - gapX;
        items.push(make(pair ? 'desk2' : 'seat', x, 4.6 + r * rowGap));
        x += unitW + gapX;
      }
    }
    if (s.aisle === 'sides') {
      items.push(make('aisle', startX - side - 0.4, 4.2, { h: R * rowGap + 0.5 }));
      items.push(make('aisle', startX + rowWidth + shift + 0.4, 4.2, { h: R * rowGap + 0.5 }));
    } else if (s.aisle === 'center') {
      const ax = startX + center * (unitW + gapX) - gapX / 2 + (staggered ? shift / 2 : 0);
      items.push(make('aisle', ax, 4.2, { w: aisleW - 0.4, h: R * rowGap + 0.5 }));
    }
    return items;
  }
  T.rows = s => rowsLayout(s, false);
  T.staggered = s => rowsLayout(s, true);

  // شبكة من العناصر الجماعية
  function gridOf(list, cols, cellW, cellH, width) {
    const out = [];
    const totalW = cols * cellW;
    const startX = (width - totalW) / 2;
    list.forEach((mk, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      out.push(mk(startX + c * cellW, 5 + r * cellH));
    });
    return out;
  }

  T.pairs = (s, n) => {
    const count = Math.max(1, Math.ceil(n / 2));
    const cols = count > 9 ? 4 : 3;
    const width = Math.max(20, cols * 5.2 + 4);
    return frontItems(width).concat(gridOf(Array.from({ length: count }, () => (x, y) => make('desk2', x + 0.8, y)), cols, 5.2, 3, width));
  };

  T.quads = (s, n) => {
    const count = Math.max(1, Math.ceil(n / 4));
    const cols = count > 6 ? 4 : 3;
    const width = Math.max(20, cols * 6 + 4);
    return frontItems(width).concat(gridOf(Array.from({ length: count }, () => (x, y) => make('table', x + 1.4, y + 1, { cap: 4 })), cols, 6, 5.6, width));
  };

  // أحجام المجموعات مع التعامل مع المتبقين
  function groupSizes(n, size, policy) {
    size = Math.max(2, size);
    if (n <= 0) return [];
    const full = Math.floor(n / size);
    const rem = n % size;
    if (full === 0) return [n];
    const sizes = Array(full).fill(size);
    if (!rem) return sizes;
    if (policy === 'separate') { sizes.push(rem); return sizes; }
    // توزيع المتبقين على المجموعات (يزيد بعضها طالبًا)
    for (let i = 0; i < rem; i++) sizes[i % full]++;
    return sizes;
  }

  T.groups = (s, n) => {
    const sizes = groupSizes(n, s.groupSize || 4, s.remainder);
    const cols = sizes.length > 6 ? 4 : 3;
    const width = Math.max(20, cols * 6.4 + 4);
    return frontItems(width).concat(gridOf(sizes.map(c => (x, y) => c >= 5
      ? make('round', x + 1.7, y + 1, { cap: c, w: 3, h: 3 })
      : make('table', x + 1.6, y + 1, { cap: c })), cols, 6.4, 6, width));
  };

  // حرف U
  T.ushape = (s, n) => {
    const layers = s.uLayers === 'double' ? 2 : 1;
    const perLayer = layers === 2 ? [Math.ceil(n * 0.58), n - Math.ceil(n * 0.58)] : [n];
    const width = 26;
    const items = frontItems(width);
    const openFront = s.uOpen !== 'back';
    perLayer.forEach((count, L) => {
      if (count <= 0) return;
      const inset = L * 2.4;
      const left = 3 + inset, right = width - 3 - inset;
      const top = 4.2 + inset, bottom = 17 - inset;
      const sideCount = Math.max(1, Math.round(count * 0.3));
      const baseCount = Math.max(1, count - sideCount * 2);
      const sideLen = bottom - top;
      for (let i = 0; i < sideCount; i++) {
        const y = top + (sideLen * (i + 0.5)) / sideCount - 0.75;
        items.push(make('seat', left, y, { rot: 90 }));
        items.push(make('seat', right - 1.8, y, { rot: -90 }));
      }
      const baseY = openFront ? bottom + 0.3 : top - 2.2;
      const span = right - left - 3.6;
      for (let i = 0; i < baseCount; i++) {
        const x = left + 1.8 + (span * (i + 0.5)) / baseCount - 0.9;
        items.push(make('seat', x, baseY, openFront ? {} : { rot: 180 }));
      }
    });
    const mid = { x: width / 2, y: 11 };
    if (s.uCenter === 'desk') items.push(make('tdesk', mid.x - 1.7, mid.y - 0.8));
    else if (s.uCenter === 'zone') items.push(make('zone', mid.x - 3, mid.y - 2.5, { label: 'منطقة العرض والنقاش' }));
    else if (s.uCenter === 'screen') items.push(make('screen', mid.x - 2, mid.y));
    return items;
  };

  // قاعة المسرح
  T.theater = s => {
    const R = Math.max(1, s.rows);
    const base = Math.max(2, s.perRow);
    const width = Math.max(24, base * 2.4 + R * 2 + 6);
    const items = [make('screen', width / 2 - 2, 0.6), make('tdesk', width - 4.6, 1.6), make('door', 0.6, 0.05)];
    const focus = { x: width / 2, y: 0.8 };
    for (let r = 0; r < R; r++) {
      const count = base + r;
      if (s.curve === 'curved') {
        const radius = 6 + r * 2.5;
        const spread = Math.min(Math.PI * 0.72, (count * 2.3) / radius);
        for (let i = 0; i < count; i++) {
          const a = Math.PI / 2 - spread / 2 + (spread * (i + 0.5)) / count;
          const cx = focus.x + Math.cos(a) * radius, cy = focus.y + Math.sin(a) * radius;
          const rot = (a * 180) / Math.PI - 90;
          items.push(make('seat', cx - 0.9, cy - 0.75, { rot }));
        }
      } else {
        const rowW = count * 2.3;
        for (let i = 0; i < count; i++) items.push(make('seat', width / 2 - rowW / 2 + i * 2.3 + 0.25, 4.4 + r * 2.4));
      }
    }
    return items;
  };

  // محطات التعلم
  T.stations = (s, n) => {
    const S = Math.max(2, Math.min(6, s.stationCount || 4));
    const names = (s.stationNames || []).slice(0, S);
    const cap = Math.max(2, s.stationCap || Math.ceil(n / S));
    const cols = S > 4 ? 3 : 2;
    const cellW = 11, cellH = 8.5;
    const width = cols * cellW + 3;
    const items = frontItems(width);
    for (let i = 0; i < S; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const x = 1.5 + c * cellW, y = 3.8 + r * cellH;
      items.push(make('zone', x, y, { w: cellW - 1, h: cellH - 1, label: names[i] || ('محطة ' + (i + 1)), station: i }));
      items.push(cap >= 5
        ? make('round', x + (cellW - 1) / 2 - 1.5, y + 2.6, { cap, w: 3, h: 3, station: i })
        : make('table', x + (cellW - 1) / 2 - 1.6, y + 3, { cap, station: i }));
    }
    return items;
  };

  T.custom = () => {
    const width = 24;
    return frontItems(width);
  };

  const TYPES = [
    { id: 'rows', name: 'الصفوف التقليدية', desc: 'صفوف متوازية وجميع الطلاب يواجهون السبورة' },
    { id: 'staggered', name: 'الصفوف المتبادلة', desc: 'كل صف مُزاح قليلًا حتى لا يجلس طالب خلف آخر مباشرة' },
    { id: 'pairs', name: 'أزواج متجاورة', desc: 'كل طالبين على طاولة واحدة' },
    { id: 'quads', name: 'مجموعات رباعية', desc: 'أربعة طلاب متقابلون حول كل طاولة، مع أدوار تلقائية' },
    { id: 'groups', name: 'مجموعات متعددة الأحجام', desc: 'مجموعات من 3 إلى 6 حسب العدد وطبيعة المهمة' },
    { id: 'ushape', name: 'شكل حرف U', desc: 'مقاعد على ثلاثة جوانب والوسط مفتوح' },
    { id: 'theater', name: 'قاعة المسرح', desc: 'صفوف مستقيمة أو منحنية نحو نقطة عرض' },
    { id: 'stations', name: 'محطات التعلم', desc: 'مناطق بأنشطة مختلفة تتنقل بينها المجموعات' },
    { id: 'custom', name: 'مخطط مخصص', desc: 'ابنِ صفك بنفسك بالسحب والإفلات' }
  ];

  const DEFAULT_SETTINGS = {
    rows: 5, perRow: 6, pair: 'single', aisle: 'none',
    groupSize: 4, remainder: 'spread',
    uLayers: 'single', uOpen: 'front', uCenter: 'none',
    curve: 'straight',
    stationCount: 4, stationCap: 0, stationMinutes: 10, stationDir: 1, stationRounds: 4,
    stationNames: ['محطة القراءة', 'محطة التقنية', 'محطة حل المشكلات', 'محطة مع المعلم', 'محطة النشاط العملي', 'محطة الكتابة'],
    roles: true
  };

  window.SeatTemplates = {
    KINDS, TYPES, DEFAULT_SETTINGS, uid, make, seatSlots, seatsOf, fitRoom, groupSizes,
    build(type, settings, n) {
      const s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
      const items = (T[type] || T.custom)(s, n);
      const room = fitRoom(items, type === 'custom' ? 24 : 16, type === 'custom' ? 18 : 12);
      return { items, room };
    }
  };
})();
