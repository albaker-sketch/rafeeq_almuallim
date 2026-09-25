/* رفيق المعلم — طرق اختيار الطالب
   كل طريقة لها:
   - render(view, ctx): تعرض الحالة الساكنة (قبل الاختيار)
   - run(view, ctx): تشغّل الحركة وتنتهي عند الطالب المختار (ترجع Promise)
   - reveals: true إذا كانت الطريقة تعرض الاسم كاملًا بخط كبير بنفسها (فلا نحتاج بطاقة النتيجة)

   ctx = { names, labels, target, sound, randomInt, reduced, opts }
   names: الأسماء الكاملة، labels: الأسماء المختصرة للعرض، target: رقم الطالب المختار */
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // حجم الخط حسب عدد الأسماء
  function sizeClass(n) {
    if (n <= 8) return 'sz-xl';
    if (n <= 16) return 'sz-l';
    if (n <= 28) return 'sz-m';
    return 'sz-s';
  }

  // تأخير يبدأ سريعًا ويتباطأ في آخر الخطوات
  function slowingDelay(remaining, fast, slow, tail) {
    const t = Math.max(0, tail - remaining) / tail; // 0 بعيدًا عن النهاية، 1 عند النهاية
    return fast + (slow - fast) * t * t;
  }

  function shuffled(arr, randomInt) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // مركز عنصر بالنسبة لحاويته
  function centerOf(elm, box) {
    const a = elm.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height };
  }

  function nameCells(view, cls, labels, n) {
    return `<div class="${cls} ${sizeClass(n)}">${labels.map((l, i) =>
      `<div class="pk-cell" data-i="${i}"><span>${esc(l)}</span></div>`).join('')}</div>`;
  }

  const modes = {};

  /* ---------- الكشاف الضوئي ---------- */
  modes.spotlight = {
    render(view, ctx) {
      view.innerHTML = `<div class="pk-dark sp-wrap">${nameCells(view, 'sp-field', ctx.labels, ctx.names.length)}<div class="sp-light" hidden></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.sp-wrap');
      const light = view.querySelector('.sp-light');
      const cells = [...view.querySelectorAll('.pk-cell')];
      const n = cells.length;
      wrap.classList.add('is-dark');
      light.hidden = false;
      const steps = ctx.reduced ? 1 : 13 + ctx.randomInt(4);
      let last = -1;
      for (let s = 1; s <= steps; s++) {
        let idx;
        if (s === steps) idx = ctx.target;
        else do { idx = ctx.randomInt(n); } while (idx === last || (s === steps - 1 && idx === ctx.target));
        last = idx;
        const delay = slowingDelay(steps - s, 170, 780, 7);
        const c = centerOf(cells[idx], wrap);
        const size = Math.max(c.w + 46, c.h + 46, 120);
        light.style.transitionDuration = Math.round(delay * 0.85) + 'ms';
        light.style.width = light.style.height = size + 'px';
        light.style.left = (c.x - size / 2) + 'px';
        light.style.top = (c.y - size / 2) + 'px';
        await sleep(delay * 0.85);
        ctx.sound.tick();
        await sleep(delay * 0.15);
      }
      cells[ctx.target].classList.add('is-win');
      light.classList.add('is-locked');
    }
  };

  /* ---------- شريط الأسماء المتحرك ---------- */
  modes.ticker = {
    render(view, ctx) {
      const dir = ctx.opts.tickerDir === 'h' ? 'h' : 'v';
      view.innerHTML = `<div class="pk-dark tk tk-${dir}">
        <div class="tk-window"><div class="tk-strip">${ctx.names.map((nm, i) =>
          `<div class="tk-item" data-i="${i}"><span>${esc(dir === 'h' ? ctx.labels[i] : nm)}</span></div>`).join('')}</div></div>
        <div class="tk-marker"></div></div>`;
      // وضع أول اسم في المنتصف
      requestAnimationFrame(() => {
        const strip = view.querySelector('.tk-strip');
        const win = view.querySelector('.tk-window');
        const first = view.querySelector('.tk-item');
        if (!strip || !first) return;
        const horiz = dir === 'h';
        const winMid = horiz ? win.clientWidth / 2 : win.clientHeight / 2;
        const mid = horiz ? first.offsetLeft + first.offsetWidth / 2 : first.offsetTop + first.offsetHeight / 2;
        strip.style.transform = horiz ? `translateX(${winMid - mid}px)` : `translateY(${winMid - mid}px)`;
      });
    },
    async run(view, ctx) {
      const dir = ctx.opts.tickerDir === 'h' ? 'h' : 'v';
      const horiz = dir === 'h';
      const n = ctx.names.length;
      const reps = Math.max(5, Math.ceil(70 / n));
      const strip = view.querySelector('.tk-strip');
      const win = view.querySelector('.tk-window');
      let html = '';
      for (let r = 0; r < reps; r++) {
        html += ctx.names.map((nm, i) => `<div class="tk-item" data-i="${i}"><span>${esc(horiz ? ctx.labels[i] : nm)}</span></div>`).join('');
      }
      strip.style.transition = 'none';
      strip.innerHTML = html;
      const items = [...strip.children];
      const centers = items.map(it => horiz ? it.offsetLeft + it.offsetWidth / 2 : it.offsetTop + it.offsetHeight / 2);
      const winMid = horiz ? win.clientWidth / 2 : win.clientHeight / 2;
      const startIdx = ctx.randomInt(n);
      const endIdx = (reps - 2) * n + ctx.target;
      const from = winMid - centers[startIdx];
      const to = winMid - centers[endIdx];
      const setPos = p => { strip.style.transform = horiz ? `translateX(${p}px)` : `translateY(${p}px)`; };
      setPos(from);
      const duration = ctx.reduced ? 1 : 5200 + ctx.randomInt(1000);
      const t0 = performance.now();
      let lastIdx = startIdx;
      await new Promise(resolve => {
        function frame(now) {
          const t = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - t, 4);
          const pos = from + (to - from) * eased;
          setPos(pos);
          // الاسم الواقع تحت المؤشر
          const at = winMid - pos;
          while (lastIdx < centers.length - 1 && Math.abs(centers[lastIdx + 1] - at) < Math.abs(centers[lastIdx] - at)) {
            lastIdx++;
            ctx.sound.tick();
          }
          if (t < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      items[endIdx].classList.add('is-win');
    }
  };

  /* ---------- السحب الرقمي ---------- */
  modes.digital = {
    reveals: true,
    render(view, ctx) {
      view.innerHTML = `<div class="dg-screen">
        <div class="dg-label">جاهز للسحب</div>
        <div class="dg-name is-idle">؟</div>
        <div class="dg-sub">${ctx.names.length} اسم</div></div>`;
    },
    async run(view, ctx) {
      const screen = view.querySelector('.dg-screen');
      const nameEl = view.querySelector('.dg-name');
      const label = view.querySelector('.dg-label');
      const n = ctx.names.length;
      screen.classList.remove('is-win');
      nameEl.classList.remove('is-idle');
      label.textContent = 'جارٍ السحب…';
      view.querySelector('.dg-sub').textContent = '';
      const steps = ctx.reduced ? 1 : 26 + ctx.randomInt(6);
      let last = -1;
      for (let s = 1; s <= steps; s++) {
        let idx;
        if (s === steps) idx = ctx.target;
        else do { idx = ctx.randomInt(n); } while (idx === last && n > 1);
        last = idx;
        nameEl.textContent = ctx.names[idx];
        ctx.sound.tick();
        if (s < steps) await sleep(45 + Math.pow(s / steps, 3) * 480);
      }
      label.textContent = 'الطالب المشارك';
      screen.classList.add('is-win');
    }
  };

  /* ---------- شبكة الأسماء ---------- */
  modes.grid = {
    render(view, ctx) {
      view.innerHTML = nameCells(view, 'gd-grid', ctx.labels, ctx.names.length);
    },
    async run(view, ctx) {
      const cells = [...view.querySelectorAll('.pk-cell')];
      const n = cells.length;
      const start = ctx.randomInt(n);
      const offset = (ctx.target - start + n) % n;
      const steps = ctx.reduced ? 1 : n * (n < 8 ? 3 : 2) + offset;
      let cur = ctx.reduced ? ctx.target : start;
      for (let s = 0; s <= steps; s++) {
        cells.forEach(c => c.classList.remove('is-on'));
        cells[cur].classList.add('is-on');
        ctx.sound.tick();
        if (s === steps) break;
        await sleep(slowingDelay(steps - s, 55, 560, 10));
        cur = (cur + 1) % n;
      }
      cells[ctx.target].classList.remove('is-on');
      cells[ctx.target].classList.add('is-win');
    }
  };

  /* ---------- التلاشي التدريجي ---------- */
  modes.fade = {
    render(view, ctx) {
      view.innerHTML = nameCells(view, 'gd-grid fd-grid', ctx.labels, ctx.names.length);
    },
    async run(view, ctx) {
      const cells = [...view.querySelectorAll('.pk-cell')];
      const others = shuffled(cells.map((_, i) => i).filter(i => i !== ctx.target), ctx.randomInt);
      const per = ctx.reduced ? 0 : Math.max(80, Math.min(520, 5200 / others.length));
      for (let k = 0; k < others.length; k++) {
        const left = others.length - k;
        cells[others[k]].classList.add('is-out');
        ctx.sound.tick();
        if (per) await sleep(left <= 3 ? per * 2.2 : per);
      }
      await sleep(250);
      cells[ctx.target].classList.add('is-win');
    }
  };

  /* ---------- التركيز التدريجي ---------- */
  modes.focus = {
    reveals: true,
    render(view, ctx) {
      const n = ctx.names.length;
      view.innerHTML = `<div class="pk-dark fc-wrap">
        <div class="fc-cloud ${sizeClass(n)}">${ctx.labels.map((l, i) =>
          `<span style="--d:${(i % 7) * 0.6}s;--r:${((i * 37) % 11) - 5}deg">${esc(l)}</span>`).join('')}</div>
        <div class="fc-center" hidden></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fc-wrap');
      const center = view.querySelector('.fc-center');
      const n = ctx.names.length;
      wrap.classList.add('is-focusing');
      center.hidden = false;
      center.className = 'fc-center is-blur';
      // أسماء ضبابية تتبدل في المنتصف
      const spins = ctx.reduced ? 0 : 14;
      let last = -1;
      for (let s = 0; s < spins; s++) {
        let idx;
        do { idx = ctx.randomInt(n); } while (idx === last && n > 1);
        last = idx;
        center.textContent = ctx.names[idx];
        ctx.sound.tick();
        await sleep(90 + s * 12);
      }
      center.textContent = ctx.names[ctx.target];
      void center.offsetWidth;
      center.className = 'fc-center is-sharp';
      await sleep(ctx.reduced ? 0 : 2200);
      wrap.classList.add('is-win');
    }
  };

  /* ---------- مؤشر المسح ---------- */
  modes.scan = {
    render(view, ctx) {
      const n = ctx.names.length;
      const cols = n <= 6 ? 1 : n <= 16 ? 2 : 3;
      const rows = Math.ceil(n / cols);
      view.innerHTML = `<div class="sc-wrap"><div class="sc-list ${sizeClass(n)}" style="--rows:${rows};--cols:${cols}">
        ${ctx.labels.map((l, i) => `<div class="sc-row" data-i="${i}"><b>${i + 1}</b><span>${esc(l)}</span></div>`).join('')}
        </div><div class="sc-beam" hidden></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.sc-wrap');
      const beam = view.querySelector('.sc-beam');
      const rows = [...view.querySelectorAll('.sc-row')];
      const n = rows.length;
      beam.hidden = false;
      const passes = n < 8 ? 3 : 2;
      const steps = ctx.reduced ? 0 : passes * n + ctx.target;
      for (let s = 0; s <= steps; s++) {
        const idx = ctx.reduced ? ctx.target : s % n;
        const r = rows[idx];
        const delay = slowingDelay(steps - s, 40, 520, 9);
        beam.style.transitionDuration = (idx === 0 && s > 0 ? 0 : Math.round(delay * 0.8)) + 'ms';
        beam.style.top = r.offsetTop + 'px';
        beam.style.left = r.offsetLeft + 'px';
        beam.style.width = r.offsetWidth + 'px';
        beam.style.height = r.offsetHeight + 'px';
        ctx.sound.tick();
        if (s < steps) await sleep(delay);
      }
      rows[ctx.target].classList.add('is-win');
      beam.classList.add('is-locked');
    }
  };

  /* ---------- العد التنازلي والكشف ---------- */
  modes.countdown = {
    reveals: true,
    render(view, ctx) {
      view.innerHTML = `<div class="pk-dark cd-wrap"><div class="cd-num is-idle">3 · 2 · 1</div><div class="cd-sub">${ctx.names.length} اسم</div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.cd-wrap');
      wrap.innerHTML = '<div class="cd-num"></div>';
      const num = wrap.querySelector('.cd-num');
      for (const k of [3, 2, 1]) {
        num.textContent = k;
        num.classList.remove('is-pulse');
        void num.offsetWidth;
        num.classList.add('is-pulse');
        ctx.sound.urgent(k);
        await sleep(ctx.reduced ? 150 : 900);
      }
      wrap.innerHTML = `<div class="cd-label">الطالب المشارك</div><div class="cd-name">${esc(ctx.names[ctx.target])}</div>`;
    }
  };

  const ICONS = {
    wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4M12 12 5.6 18.4M12 12H3"/>',
    spotlight: '<path d="M9 3h6l-1 6h-4z"/><path d="M10 9 5 21h14L14 9"/>',
    ticker: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M8 7v10M16 7v10M1 12h2M21 12h2"/>',
    digital: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h2M11 12h2M15 12h2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>',
    fade: '<circle cx="6" cy="12" r="2.5" opacity=".35"/><circle cx="12" cy="12" r="2.5" opacity=".6"/><circle cx="18" cy="12" r="2.5" fill="currentColor"/>',
    focus: '<circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
    scan: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16" opacity=".4"/><path d="M2 12h20" stroke-width="2.6"/>',
    countdown: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9.5 2.5h5"/>'
  };

  const LIST = [
    { id: 'wheel', name: 'العجلة', desc: 'عجلة ملونة تدور ثم تتوقف عند المؤشر' },
    { id: 'spotlight', name: 'الكشاف الضوئي', desc: 'ضوء يتنقل بين الأسماء ثم يثبت على المختار' },
    { id: 'ticker', name: 'الشريط المتحرك', desc: 'تمر الأسماء في شريط ثم يبطؤ ويتوقف' },
    { id: 'digital', name: 'السحب الرقمي', desc: 'تتبدل الأسماء في شاشة رقمية ثم يظهر الاسم' },
    { id: 'grid', name: 'شبكة الأسماء', desc: 'تضيء الخانات تباعًا حتى يستقر الاختيار' },
    { id: 'fade', name: 'التلاشي التدريجي', desc: 'تختفي الأسماء واحدًا بعد آخر ويبقى المختار' },
    { id: 'focus', name: 'التركيز التدريجي', desc: 'أسماء ضبابية ثم يتضح اسم واحد في المنتصف' },
    { id: 'scan', name: 'مؤشر المسح', desc: 'خط مضيء يمر على القائمة ويتوقف عند الطالب' },
    { id: 'countdown', name: 'العد التنازلي', desc: 'عد 3، 2، 1 ثم يظهر الاسم مباشرة' }
  ];

  window.PickerModes = {
    list: LIST.map(m => Object.assign({ icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[m.id]}</svg>` }, m)),
    impl: modes
  };
})();
