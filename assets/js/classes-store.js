/* رفيق المعلم — مخزن الصفوف والطلاب
   يحفظ البيانات حاليًا في متصفح المعلم (localStorage).
   عند تفعيل الحسابات ستنتقل هذه الدوال إلى الخادم بنفس الواجهة.

   شكل البيانات:
   { classes: [ { id, grade, section, students: [ { id, name } ], updatedAt } ] } */
(function () {
  const KEY = 'rafeeq:classes';
  const ACTIVE_KEY = 'rafeeq:activeClass';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.classes)) return data;
    } catch (e) { /* التخزين غير متاح */ }
    return { classes: [] };
  }

  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* التخزين غير متاح */ }
  }

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 9);
  }

  // توحيد النص للمقارنة: إزالة المسافات الزائدة وتوحيد الألف والتاء المربوطة والتشكيل
  function norm(s) {
    return String(s ?? '')
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function clean(s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  }

  function sameClass(c, grade, section) {
    return norm(c.grade) === norm(grade) && norm(c.section) === norm(section);
  }

  // ترتيب الصفوف: الرقمية أولًا بالترتيب ثم النصية أبجديًا
  const ORDINALS = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
  function gradeRank(g) {
    const n = norm(g);
    const digits = n.match(/\d+/);
    if (digits) return Number(digits[0]);
    // نبحث عن أطول تطابق أولًا حتى لا يُحسب "الحادي عشر" كـ"الاول"
    let best = -1, bestLen = 0;
    ORDINALS.forEach((o, i) => { if (n.includes(o) && o.length > bestLen) { best = i + 1; bestLen = o.length; } });
    return best > 0 ? best : 999;
  }

  function sortClasses(list) {
    return list.slice().sort((a, b) =>
      gradeRank(a.grade) - gradeRank(b.grade) ||
      norm(a.grade).localeCompare(norm(b.grade), 'ar') ||
      norm(a.section).localeCompare(norm(b.section), 'ar', { numeric: true })
    );
  }

  function gradeLabel(grade) {
    const g = clean(grade);
    if (!g) return 'بدون صف';
    return /^\d+$/.test(g) || !/^(ال)?صف/.test(g) ? 'الصف ' + g : g;
  }

  function classLabel(c) {
    return c.section ? `${gradeLabel(c.grade)} / ${clean(c.section)}` : gradeLabel(c.grade);
  }

  const api = {
    all() { return sortClasses(read().classes); },

    get(id) { return read().classes.find(c => c.id === id) || null; },

    label: classLabel,
    gradeLabel,
    gradeRank,

    addClass(grade, section) {
      const data = read();
      grade = clean(grade); section = clean(section);
      if (!grade) return { error: 'اكتب اسم الصف.' };
      if (data.classes.some(c => sameClass(c, grade, section))) return { error: 'هذا الصف والشعبة موجودان مسبقًا.' };
      const c = { id: uid('c'), grade, section, students: [], updatedAt: Date.now() };
      data.classes.push(c);
      write(data);
      return { cls: c };
    },

    updateClass(id, grade, section) {
      const data = read();
      grade = clean(grade); section = clean(section);
      if (!grade) return { error: 'اكتب اسم الصف.' };
      if (data.classes.some(c => c.id !== id && sameClass(c, grade, section))) return { error: 'يوجد صف آخر بنفس الاسم والشعبة.' };
      const c = data.classes.find(x => x.id === id);
      if (!c) return { error: 'الصف غير موجود.' };
      c.grade = grade; c.section = section; c.updatedAt = Date.now();
      write(data);
      return { cls: c };
    },

    removeClass(id) {
      const data = read();
      data.classes = data.classes.filter(c => c.id !== id);
      write(data);
      if (api.getActive() === id) api.setActive('');
    },

    addStudent(classId, name) {
      const data = read();
      const c = data.classes.find(x => x.id === classId);
      name = clean(name);
      if (!c || !name) return { error: 'اكتب اسم الطالب.' };
      if (c.students.some(s => norm(s.name) === norm(name))) return { error: 'هذا الاسم موجود في الصف.' };
      c.students.push({ id: uid('s'), name });
      c.updatedAt = Date.now();
      write(data);
      return { ok: true };
    },

    renameStudent(classId, studentId, name) {
      const data = read();
      const c = data.classes.find(x => x.id === classId);
      name = clean(name);
      if (!c || !name) return { error: 'اكتب اسم الطالب.' };
      const s = c.students.find(x => x.id === studentId);
      if (s) { s.name = name; c.updatedAt = Date.now(); write(data); }
      return { ok: true };
    },

    removeStudent(classId, studentId) {
      const data = read();
      const c = data.classes.find(x => x.id === classId);
      if (!c) return;
      c.students = c.students.filter(s => s.id !== studentId);
      c.updatedAt = Date.now();
      write(data);
    },

    /* استيراد صفوف من الإكسل.
       rows: [{ name, grade, section }]
       كل صف (صف + شعبة) موجود في الملف تُستبدل قائمة طلابه بما في الملف،
       والصفوف غير الموجودة في الملف تبقى كما هي. */
    importRows(rows) {
      const data = read();
      const groups = new Map();
      rows.forEach(r => {
        const name = clean(r.name), grade = clean(r.grade), section = clean(r.section);
        if (!name || !grade) return;
        const k = norm(grade) + '|' + norm(section);
        if (!groups.has(k)) groups.set(k, { grade, section, names: [] });
        const g = groups.get(k);
        if (!g.names.some(n => norm(n) === norm(name))) g.names.push(name);
      });

      const summary = { created: 0, updated: 0, students: 0 };
      groups.forEach(g => {
        let c = data.classes.find(x => sameClass(x, g.grade, g.section));
        if (c) {
          summary.updated++;
        } else {
          c = { id: uid('c'), grade: g.grade, section: g.section, students: [] };
          data.classes.push(c);
          summary.created++;
        }
        // الإبقاء على معرّف الطالب إن كان موجودًا مسبقًا
        const old = new Map(c.students.map(s => [norm(s.name), s.id]));
        c.students = g.names.map(n => ({ id: old.get(norm(n)) || uid('s'), name: n }));
        c.updatedAt = Date.now();
        summary.students += g.names.length;
      });
      write(data);
      return summary;
    },

    // نسخة كاملة من البيانات (للتراجع عن الاستيراد)
    snapshot() { return JSON.stringify(read()); },
    restore(json) { try { write(JSON.parse(json)); } catch (e) { /* تجاهل */ } },

    getActive() {
      try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; }
    },

    setActive(id) {
      try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch (e) { /* تجاهل */ }
    },

    norm
  };

  // تعبئة <select> بالصفوف مجمّعة حسب الصف
  api.fillSelect = function (select, opts) {
    const o = opts || {};
    const classes = api.all();
    const active = o.selected !== undefined ? o.selected : api.getActive();
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let html = o.emptyLabel ? `<option value="">${esc(o.emptyLabel)}</option>` : '';
    const groups = new Map();
    classes.forEach(c => {
      const k = gradeLabel(c.grade);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    });
    groups.forEach((items, label) => {
      html += `<optgroup label="${esc(label)}">` + items.map(c =>
        `<option value="${c.id}"${c.id === active ? ' selected' : ''}>${esc(classLabel(c))} (${c.students.length})</option>`
      ).join('') + '</optgroup>';
    });
    select.innerHTML = html;
    if (!classes.some(c => c.id === active)) select.value = '';
    return classes.length;
  };

  window.RafeeqClasses = api;
})();
