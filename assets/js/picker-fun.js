/* رفيق المعلم — أشكال اختيار الطالب التفاعلية المشوقة
   تُضاف إلى PickerModes (من picker-modes.js) بنفس الواجهة:
   render(view, ctx) و run(view, ctx) و reveals.
   كل الأشكال هنا تنتهي بكشف الاسم كاملًا مع احتفال (قصاصات ملونة). */
(function () {
  const PM = window.PickerModes;
  if (!PM) return;

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const COLORS = ['#F2B84B', '#E86A5B', '#4FB3D9', '#7BC67E', '#A78BDA', '#F29BC0', '#5CC8B5', '#F6D55C', '#FF9F68', '#6C9CF0'];
  const color = i => COLORS[i % COLORS.length];

  function sizeClass(n) {
    if (n <= 8) return 'sz-xl';
    if (n <= 16) return 'sz-l';
    if (n <= 28) return 'sz-m';
    return 'sz-s';
  }

  function slowingDelay(remaining, fast, slow, tail) {
    const t = Math.max(0, tail - remaining) / tail;
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

  // عيّنة من الأسماء تتضمن المختار
  function sampleWithTarget(n, k, target, randomInt) {
    const others = shuffled([...Array(n).keys()].filter(i => i !== target), randomInt).slice(0, k - 1);
    return shuffled(others.concat(target), randomInt);
  }

  function rectIn(elm, box) {
    const a = elm.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, cx: a.left - b.left + a.width / 2, cy: a.top - b.top + a.height / 2 };
  }

  function animate(duration, step) {
    return new Promise(resolve => {
      const t0 = performance.now();
      function frame(now) {
        const t = duration <= 0 ? 1 : Math.min(1, (now - t0) / duration);
        step(t);
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ---------- قصاصات ملونة ----------
  function confetti(host, reduced) {
    if (reduced) return;
    const c = document.createElement('canvas');
    c.className = 'fn-confetti';
    host.appendChild(c);
    const w = c.width = host.clientWidth;
    const h = c.height = host.clientHeight;
    const g = c.getContext('2d');
    const parts = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 900,
      vy: -300 - Math.random() * 700,
      r: 4 + Math.random() * 6,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 12,
      c: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
    let last = performance.now();
    const end = last + 2800;
    (function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, w, h);
      parts.forEach(p => {
        p.vy += 1300 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.c;
        g.globalAlpha = Math.max(0, Math.min(1, (end - now) / 700));
        g.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66);
        g.restore();
      });
      if (now < end) requestAnimationFrame(frame); else c.remove();
    })(last);
  }

  // ---------- كشف الاسم ----------
  async function reveal(view, ctx, label) {
    const wrap = view.querySelector('.fn-wrap') || view;
    const box = document.createElement('div');
    box.className = 'fn-reveal';
    box.innerHTML = `<div class="fn-reveal-card"><div class="fn-reveal-label">${esc(label || 'الطالب المختار')}</div><div class="fn-reveal-name">${esc(ctx.names[ctx.target])}</div></div>`;
    wrap.appendChild(box);
    confetti(wrap, ctx.reduced);
    await sleep(300);
  }

  const modes = {};

  /* ================= آلة الأسماء الدوارة ================= */
  modes.slot = {
    reveals: true,
    render(view) {
      view.innerHTML = `<div class="fn-wrap fn-slot">
        <div class="sl-machine">
          <div class="sl-title">آلة الأسماء</div>
          <div class="sl-reels">${[0, 1, 2].map(k => `<div class="sl-reel"><div class="sl-strip"><div class="sl-cell">?</div></div></div>`).join('')}</div>
          <div class="sl-lights">${Array.from({ length: 9 }, (_, i) => `<i style="--d:${i * 0.12}s"></i>`).join('')}</div>
          <div class="sl-lever"><span></span></div>
        </div>
      </div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-slot');
      const reels = [...view.querySelectorAll('.sl-reel')];
      const parts = ctx.parts;
      wrap.classList.add('is-running');
      view.querySelector('.sl-lever').classList.add('is-pulled');
      ctx.sound.clunk();
      await sleep(250);
      const H = reels[0].clientHeight;
      await Promise.all(reels.map(async (reel, k) => {
        const values = [...new Set(parts.map(p => p[k]).filter(Boolean))];
        if (!values.length) values.push('—');
        const final = parts[ctx.target][k] || '—';
        const count = ctx.reduced ? 1 : 16 + k * 7;
        const seq = [];
        for (let i = 0; i < count; i++) seq.push(values[ctx.randomInt(values.length)]);
        seq.push(final);
        const strip = reel.querySelector('.sl-strip');
        strip.innerHTML = seq.map(v => `<div class="sl-cell">${esc(v)}</div>`).join('');
        strip.style.transform = 'translateY(0)';
        const total = (seq.length - 1) * H;
        let lastI = 0;
        await animate(ctx.reduced ? 0 : 1500 + k * 900, t => {
          const e = 1 - Math.pow(1 - t, 3);
          const y = total * e;
          strip.style.transform = `translateY(${-y}px)`;
          const i = Math.floor(y / H);
          if (i !== lastI) { lastI = i; if (k === 0) ctx.sound.tick(); }
        });
        reel.classList.add('is-stopped');
        ctx.sound.clunk();
      }));
      await sleep(500);
      await reveal(view, ctx);
    }
  };

  /* ================= كرات السحب ================= */
  modes.balls = {
    reveals: true,
    render(view, ctx) {
      const n = ctx.names.length;
      view.innerHTML = `<div class="fn-wrap fn-balls"><div class="bl-bowl"></div><div class="bl-chute"></div></div>`;
      const bowl = view.querySelector('.bl-bowl');
      requestAnimationFrame(() => {
        const R = bowl.clientWidth / 2;
        const r = Math.max(20, Math.min(46, R * 0.78 / Math.sqrt(n)));
        view._balls = ctx.names.map((_, i) => {
          const b = document.createElement('div');
          b.className = 'bl-ball';
          b.style.setProperty('--c', color(i));
          b.style.width = b.style.height = r * 2 + 'px';
          b.style.fontSize = Math.max(10, r * 0.42) + 'px';
          b.innerHTML = `<span>${esc(ctx.parts[i][0] || ctx.labels[i])}</span>`;
          // مواقع ثابتة في الوعاء قبل البدء (أسفل الوعاء)
          const ang = (i * 2.399) % (Math.PI * 2);
          const rad = (R - r) * Math.sqrt((i + 0.5) / n) * 0.95;
          const o = { el: b, r, x: Math.cos(ang) * rad, y: Math.abs(Math.sin(ang)) * rad * 0.6 + (R - r) * 0.3, vx: 0, vy: 0 };
          bowl.appendChild(b);
          place(o, R);
          return o;
        });
      });
      function place(o, R) { o.el.style.transform = `translate(${R + o.x - o.r}px, ${R + o.y - o.r}px)`; }
      view._placeBall = place;
    },
    async run(view, ctx) {
      const bowl = view.querySelector('.bl-bowl');
      const wrap = view.querySelector('.fn-balls');
      const R = bowl.clientWidth / 2;
      const balls = view._balls || [];
      const place = view._placeBall;
      balls.forEach(b => { const a = Math.random() * Math.PI * 2; b.vx = Math.cos(a) * 260; b.vy = Math.sin(a) * 260; });
      wrap.classList.add('is-mixing');
      ctx.sound.whoosh();
      const dur = ctx.reduced ? 0 : 3400;
      let last = performance.now();
      let nextTick = 0;
      await animate(dur, t => {
        const now = performance.now();
        const dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        const stir = t < 0.7 ? 1 + t * 1.6 : Math.max(0.3, 2.1 - (t - 0.7) * 5);
        balls.forEach(b => {
          b.vx += (Math.random() - 0.5) * 900 * dt;
          b.vy += (Math.random() - 0.5) * 900 * dt + 220 * dt;
          b.x += b.vx * dt * stir;
          b.y += b.vy * dt * stir;
          const d = Math.hypot(b.x, b.y);
          const lim = R - b.r - 4;
          if (d > lim) {
            const nx = b.x / d, ny = b.y / d;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
            b.x = nx * lim;
            b.y = ny * lim;
          }
          place(b, R);
        });
        if (now > nextTick) { ctx.sound.tick(); nextTick = now + 90 + t * 200; }
      });
      // الكرة المختارة تخرج من فتحة الوعاء
      const win = balls[ctx.target];
      if (win) {
        win.el.classList.add('is-win');
        const sx = win.x, sy = win.y;
        const exitY = R - win.r - 4;
        await animate(ctx.reduced ? 0 : 500, t => { win.x = sx * (1 - t); win.y = sy + (exitY - sy) * t; place(win, R); });
        ctx.sound.pop();
        const chute = rectIn(view.querySelector('.bl-chute'), bowl);
        const fromY = win.y;
        const toY = chute.cy - R;
        await animate(ctx.reduced ? 0 : 600, t => { win.y = fromY + (toY - fromY) * t * t; place(win, R); win.el.style.scale = 1 + t * 0.6; });
        ctx.sound.thump();
      }
      await sleep(300);
      await reveal(view, ctx);
    }
  };

  /* ================= الكرة المرتدة ================= */
  modes.bounce = {
    reveals: true,
    render(view, ctx) {
      view.innerHTML = `<div class="fn-wrap fn-bounce"><div class="gd-grid bn-grid ${sizeClass(ctx.names.length)}">${ctx.labels.map((l, i) =>
        `<div class="pk-cell" style="--c:${color(i)}"><span>${esc(l)}</span></div>`).join('')}</div><div class="bn-ball"></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-bounce');
      const ball = view.querySelector('.bn-ball');
      const cells = [...view.querySelectorAll('.pk-cell')];
      const n = cells.length;
      const size = ball.offsetWidth;
      let x = wrap.clientWidth / 2, y = -size;
      const hops = ctx.reduced ? 1 : 9 + ctx.randomInt(3);
      let last = -1;
      ball.style.opacity = 1;
      for (let h = 1; h <= hops; h++) {
        let idx;
        if (h === hops) idx = ctx.target;
        else do { idx = ctx.randomInt(n); } while (idx === last || (h === hops - 1 && idx === ctx.target));
        last = idx;
        const c = rectIn(cells[idx], wrap);
        const tx = c.cx, ty = c.y - size / 2 + 6;
        const fx = x, fy = y;
        const dur = slowingDelay(hops - h, 360, 820, 5);
        const peak = 70 + Math.abs(tx - fx) * 0.25;
        ball.classList.remove('is-squash');
        await animate(ctx.reduced ? 0 : dur, t => {
          const px = fx + (tx - fx) * t;
          const py = fy + (ty - fy) * t - 4 * peak * t * (1 - t);
          ball.style.transform = `translate(${px - size / 2}px, ${py - size / 2}px)`;
        });
        x = tx; y = ty;
        ball.classList.add('is-squash');
        cells.forEach(cl => cl.classList.remove('is-hit'));
        cells[idx].classList.add('is-hit');
        ctx.sound.boing();
      }
      cells[ctx.target].classList.add('is-win');
      await sleep(700);
      await reveal(view, ctx);
    }
  };

  /* ================= مسار الضوء ================= */
  modes.lightpath = {
    reveals: true,
    render(view, ctx) {
      const n = ctx.names.length;
      const cols = n <= 6 ? 3 : n <= 12 ? 4 : n <= 24 ? 5 : 6;
      // ترتيب متعرج: صف من اليمين لليسار، والذي يليه بالعكس
      const cells = ctx.labels.map((l, i) => {
        const row = Math.floor(i / cols);
        let col = i % cols;
        if (row % 2 === 1) col = cols - 1 - col;
        return `<div class="pk-cell lp-cell" data-i="${i}" style="grid-row:${row + 1};grid-column:${col + 1}"><span>${esc(l)}</span></div>`;
      }).join('');
      view.innerHTML = `<div class="fn-wrap fn-path"><svg class="lp-svg"></svg><div class="lp-grid ${sizeClass(n)}" style="--cols:${cols}">${cells}</div><div class="lp-dot"></div></div>`;
      requestAnimationFrame(() => {
        const wrap = view.querySelector('.fn-path');
        if (!wrap) return;
        const pts = [...view.querySelectorAll('.lp-cell')].map(c => rectIn(c, wrap));
        const svg = view.querySelector('.lp-svg');
        svg.setAttribute('viewBox', `0 0 ${wrap.clientWidth} ${wrap.clientHeight}`);
        svg.innerHTML = `<polyline points="${pts.map(p => p.cx + ',' + p.cy).join(' ')}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round"/>`;
      });
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-path');
      const dot = view.querySelector('.lp-dot');
      const cells = [...view.querySelectorAll('.lp-cell')];
      const n = cells.length;
      const pts = cells.map(c => rectIn(c, wrap));
      // يسير على المسار ذهابًا وإيابًا ثم يتوقف عند المختار
      const route = [];
      const passes = n < 8 ? 3 : 2;
      for (let p = 0; p < passes; p++) {
        const seg = [...Array(n).keys()];
        route.push(...(p % 2 === 0 ? seg : seg.reverse()));
      }
      const tail = passes % 2 === 0 ? [...Array(ctx.target + 1).keys()] : [...Array(n).keys()].reverse().slice(0, n - ctx.target);
      route.push(...tail);
      const steps = ctx.reduced ? [ctx.target] : route;
      dot.style.opacity = 1;
      for (let s = 0; s < steps.length; s++) {
        const idx = steps[s];
        const p = pts[idx];
        const delay = slowingDelay(steps.length - 1 - s, 55, 560, 9);
        dot.style.transitionDuration = Math.round(delay * 0.9) + 'ms';
        dot.style.transform = `translate(${p.cx}px, ${p.cy}px)`;
        // أثر ضوئي يتلاشى
        const tr = document.createElement('i');
        tr.className = 'lp-trail';
        tr.style.transform = `translate(${p.cx}px, ${p.cy}px)`;
        wrap.appendChild(tr);
        setTimeout(() => tr.remove(), 900);
        cells.forEach(c => c.classList.remove('is-lit'));
        cells[idx].classList.add('is-lit');
        ctx.sound.tick();
        await sleep(delay);
      }
      cells.forEach(c => c.classList.remove('is-lit'));
      cells[ctx.target].classList.add('is-win');
      dot.classList.add('is-locked');
      await sleep(700);
      await reveal(view, ctx);
    }
  };

  /* ================= ناقل الأسماء ================= */
  modes.conveyor = {
    reveals: true,
    render(view, ctx) {
      view.innerHTML = `<div class="fn-wrap fn-conv">
        <div class="cv-zone"><b>منطقة الاختيار</b></div>
        <div class="cv-belt"><div class="cv-track"></div><div class="cv-strip">${ctx.labels.slice(0, 8).map((l, i) =>
          `<div class="cv-box" style="--c:${color(i)}"><span>${esc(l)}</span></div>`).join('')}</div></div>
        <div class="cv-rollers">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>
      </div>`;
    },
    async run(view, ctx) {
      const n = ctx.names.length;
      const wrap = view.querySelector('.fn-conv');
      const strip = view.querySelector('.cv-strip');
      const track = view.querySelector('.cv-track');
      const reps = Math.max(4, Math.ceil(50 / n));
      let html = '';
      for (let r = 0; r < reps; r++) html += ctx.labels.map((l, i) => `<div class="cv-box" style="--c:${color(i)}"><span>${esc(l)}</span></div>`).join('');
      strip.innerHTML = html;
      const boxes = [...strip.children];
      const centers = boxes.map(b => b.offsetLeft + b.offsetWidth / 2);
      const mid = strip.parentElement.clientWidth / 2;
      const endIdx = (reps - 1) * n + ctx.target;
      const from = mid - centers[ctx.randomInt(n)];
      const to = mid - centers[endIdx];
      wrap.classList.add('is-running');
      let last = -1;
      await animate(ctx.reduced ? 0 : 5600, t => {
        const e = 1 - Math.pow(1 - t, 3);
        const pos = from + (to - from) * e;
        strip.style.transform = `translateX(${pos}px)`;
        track.style.backgroundPositionX = pos + 'px';
        const k = Math.floor((mid - pos) / 60);
        if (k !== last) { last = k; if (t < 0.97) ctx.sound.tick(); }
      });
      wrap.classList.remove('is-running');
      boxes[endIdx].classList.add('is-win');
      wrap.classList.add('is-hit');
      ctx.sound.clunk();
      await sleep(900);
      await reveal(view, ctx);
    }
  };

  /* ================= الأبواب المغلقة ================= */
  modes.doors = {
    reveals: true,
    render(view, ctx) {
      const n = ctx.names.length;
      // كل باب يخفي اسمًا بترتيب عشوائي
      const perm = shuffled([...Array(n).keys()], ctx.randomInt);
      view._doorPerm = perm;
      view.innerHTML = `<div class="fn-wrap fn-doors"><div class="dr-grid ${sizeClass(n)}">${perm.map((ni, d) =>
        `<div class="dr-door" data-d="${d}"><div class="dr-back"><span>${esc(ctx.labels[ni])}</span></div><div class="dr-leaf" style="--c:${color(d)}"><b>${d + 1}</b><i></i></div></div>`).join('')}</div></div>`;
    },
    async run(view, ctx) {
      const perm = view._doorPerm;
      const doors = [...view.querySelectorAll('.dr-door')];
      const n = doors.length;
      const targetDoor = perm.indexOf(ctx.target);
      const steps = ctx.reduced ? 1 : 11 + ctx.randomInt(4);
      let last = -1;
      for (let s = 1; s <= steps; s++) {
        let d;
        if (s === steps) d = targetDoor;
        else do { d = ctx.randomInt(n); } while (d === last || (s === steps - 1 && d === targetDoor));
        last = d;
        doors.forEach(x => x.classList.remove('is-knock'));
        void doors[d].offsetWidth;
        doors[d].classList.add('is-knock');
        ctx.sound.clunk();
        await sleep(slowingDelay(steps - s, 150, 650, 6));
      }
      doors.forEach((x, i) => { if (i !== targetDoor) x.classList.add('is-dim'); });
      doors[targetDoor].classList.add('is-open');
      ctx.sound.creak();
      await sleep(1300);
      await reveal(view, ctx, `خلف الباب رقم ${targetDoor + 1}`);
    }
  };

  /* ================= الكبسولات ================= */
  modes.capsules = {
    reveals: true,
    render(view, ctx) {
      const n = ctx.names.length;
      view.innerHTML = `<div class="fn-wrap fn-caps"><div class="cp-field ${sizeClass(n)}">${ctx.labels.map((l, i) =>
        `<div class="cp-cap" data-i="${i}" style="--c:${color(i)};--d:${(i % 5) * 0.35}s"><i class="cp-top"></i><span>${esc(l)}</span></div>`).join('')}</div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-caps');
      const field = view.querySelector('.cp-field');
      let caps = [...field.children];
      wrap.classList.add('is-shaking');
      // خلط الكبسولات عدة مرات (تحريك سلس بين المواقع)
      const rounds = ctx.reduced ? 0 : 6;
      for (let r = 0; r < rounds; r++) {
        const before = new Map(caps.map(c => [c, c.getBoundingClientRect()]));
        shuffled(caps, ctx.randomInt).forEach(c => field.appendChild(c));
        caps = [...field.children];
        caps.forEach(c => {
          const a = before.get(c);
          const b = c.getBoundingClientRect();
          c.style.transition = 'none';
          c.style.translate = `${a.left - b.left}px ${a.top - b.top}px`;
          void c.offsetWidth;
          c.style.transition = 'translate .42s cubic-bezier(.5, 0, .2, 1)';
          c.style.translate = '0 0';
        });
        ctx.sound.whoosh();
        await sleep(480);
      }
      wrap.classList.remove('is-shaking');
      // الكبسولة المختارة تنتقل للمنتصف وتنفتح
      const win = field.querySelector(`.cp-cap[data-i="${ctx.target}"]`);
      caps.forEach(c => { if (c !== win) c.classList.add('is-dim'); });
      const a = rectIn(win, wrap);
      win.classList.add('is-chosen');
      win.style.transition = 'translate .7s cubic-bezier(.3, 1.3, .5, 1), scale .7s';
      win.style.translate = `${wrap.clientWidth / 2 - a.cx}px ${wrap.clientHeight / 2 - a.cy}px`;
      win.style.scale = '1.8';
      await sleep(ctx.reduced ? 0 : 800);
      win.classList.add('is-open');
      ctx.sound.pop();
      await sleep(700);
      await reveal(view, ctx);
    }
  };

  /* ================= الصندوق الغامض ================= */
  modes.mystery = {
    reveals: true,
    render(view) {
      view.innerHTML = `<div class="fn-wrap fn-mystery"><div class="my-box"><div class="my-lid"></div><div class="my-body"><b>؟</b></div></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-mystery');
      const box = view.querySelector('.my-box');
      const n = ctx.names.length;
      const b = rectIn(box, wrap);
      const picks = sampleWithTarget(n, Math.min(n, 12), ctx.target, ctx.randomInt);
      // الأسماء تطير إلى داخل الصندوق
      for (let k = 0; k < picks.length; k++) {
        const i = picks[k];
        const tag = document.createElement('div');
        tag.className = 'my-tag';
        tag.style.setProperty('--c', color(i));
        tag.textContent = ctx.labels[i];
        const side = k % 4;
        const sx = side === 0 ? -40 : side === 1 ? wrap.clientWidth + 40 : Math.random() * wrap.clientWidth;
        const sy = side < 2 ? Math.random() * wrap.clientHeight * 0.6 : -40;
        tag.style.left = sx + 'px';
        tag.style.top = sy + 'px';
        wrap.appendChild(tag);
        void tag.offsetWidth;
        tag.style.left = b.cx + 'px';
        tag.style.top = (b.y + 20) + 'px';
        tag.classList.add('is-in');
        ctx.sound.pop();
        setTimeout(() => tag.remove(), 800);
        await sleep(ctx.reduced ? 0 : 170);
      }
      await sleep(600);
      box.classList.add('is-shaking');
      ctx.sound.rumble(1.8);
      await sleep(ctx.reduced ? 0 : 1900);
      box.classList.remove('is-shaking');
      box.classList.add('is-open');
      ctx.sound.whoosh();
      const out = document.createElement('div');
      out.className = 'my-tag my-out';
      out.style.setProperty('--c', '#F2B84B');
      out.textContent = ctx.labels[ctx.target];
      out.style.left = b.cx + 'px';
      out.style.top = (b.y + 10) + 'px';
      wrap.appendChild(out);
      await sleep(1100);
      await reveal(view, ctx);
    }
  };

  /* ================= المظلات الهابطة ================= */
  modes.parachutes = {
    reveals: true,
    render(view, ctx) {
      view.innerHTML = `<div class="fn-wrap fn-para"><div class="pr-clouds"><i></i><i></i><i></i></div><div class="pr-pad"><b>منطقة الهبوط</b></div></div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-para');
      const pad = view.querySelector('.pr-pad');
      const W = wrap.clientWidth;
      const n = ctx.names.length;
      const k = Math.min(n, W < 600 ? 5 : 7);
      const picks = sampleWithTarget(n, k, ctx.target, ctx.randomInt);
      const landY = rectIn(pad, wrap).y;
      const chutes = picks.map((i, j) => {
        const el = document.createElement('div');
        el.className = 'pr-chute';
        el.style.setProperty('--c', color(i));
        el.innerHTML = `<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M5 45 Q60 -20 115 45 Q97 35 82 45 Q60 33 38 45 Q23 35 5 45z" fill="var(--c)"/><path d="M8 45 L60 92 M38 45 L60 92 M82 45 L60 92 M112 45 L60 92" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/></svg><div class="pr-tag">${esc(ctx.labels[i])}</div>`;
        wrap.appendChild(el);
        const x0 = ((j + 0.5) / k) * W;
        return { el, i, x0, y0: -170 - Math.random() * 120, phase: Math.random() * 6, speed: 0.8 + Math.random() * 0.5, gust: 0.38 + Math.random() * 0.2, dir: x0 < W / 2 ? -1 : 1 };
      });
      const T = ctx.reduced ? 0 : 5200;
      let gusted = false;
      await animate(T, t => {
        chutes.forEach(c => {
          const h = c.el.offsetHeight;
          const isWin = c.i === ctx.target;
          const yEnd = landY - h + 14;
          let x, y, rot = Math.sin(t * 9 + c.phase) * 6, op = 1;
          if (isWin) {
            const e = 1 - Math.pow(1 - t, 2);
            y = c.y0 + (yEnd - c.y0) * e;
            const toCenter = t * t * (3 - 2 * t);
            x = c.x0 + (W / 2 - c.x0) * toCenter + Math.sin(t * 7 + c.phase) * 22 * (1 - t);
            rot *= (1 - t);
          } else {
            const fall = Math.min(t, c.gust) * c.speed;
            y = c.y0 + (yEnd - c.y0) * fall;
            x = c.x0 + Math.sin(t * 6 + c.phase) * 20;
            if (t > c.gust) {
              const g = (t - c.gust) / (1 - c.gust);
              x += c.dir * g * g * W * 0.8;
              y -= g * 80;
              rot += c.dir * g * 50;
              op = Math.max(0, 1 - g * 1.4);
            }
          }
          c.el.style.transform = `translate(${x - c.el.offsetWidth / 2}px, ${y}px) rotate(${rot}deg)`;
          c.el.style.opacity = op;
        });
        if (!gusted && t > 0.4) { gusted = true; ctx.sound.whoosh(); }
      });
      chutes.forEach(c => { if (c.i !== ctx.target) c.el.remove(); else c.el.classList.add('is-landed'); });
      pad.classList.add('is-hit');
      ctx.sound.thump();
      await sleep(700);
      await reveal(view, ctx, 'هبط بسلام');
    }
  };

  /* ================= إطلاق الصاروخ ================= */
  modes.rocket = {
    reveals: true,
    render(view) {
      view.innerHTML = `<div class="fn-wrap fn-rocket">
        <div class="rk-stars">${Array.from({ length: 30 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 90}%;--d:${(i % 6) * 0.4}s"></i>`).join('')}</div>
        <div class="rk-count"></div>
        <div class="rk-rocket">
          <svg viewBox="0 0 80 170" aria-hidden="true">
            <path d="M40 4 C62 26 66 70 62 118 H18 C14 70 18 26 40 4z" fill="#EEF2F1"/>
            <path d="M40 4 C50 14 56 28 59 44 H21 C24 28 30 14 40 4z" fill="#E86A5B"/>
            <circle cx="40" cy="68" r="11" fill="#4FB3D9" stroke="#C0913F" stroke-width="4"/>
            <path d="M18 96 L2 132 L20 124z M62 96 L78 132 L60 124z" fill="#E86A5B"/>
            <rect x="26" y="118" width="28" height="10" rx="3" fill="#8A9A95"/>
          </svg>
          <div class="rk-flame"></div>
        </div>
        <div class="rk-pad"></div>
        <div class="rk-smoke"><i></i><i></i><i></i><i></i></div>
      </div>`;
    },
    async run(view, ctx) {
      const wrap = view.querySelector('.fn-rocket');
      const count = view.querySelector('.rk-count');
      const rocket = view.querySelector('.rk-rocket');
      for (const k of [5, 4, 3, 2, 1]) {
        count.textContent = k;
        count.classList.remove('is-pulse');
        void count.offsetWidth;
        count.classList.add('is-pulse');
        if (k <= 3) { ctx.sound.urgent(k); wrap.classList.add('is-igniting'); } else ctx.sound.beep();
        rocket.style.setProperty('--shake', (6 - k) * 0.8 + 'px');
        await sleep(ctx.reduced ? 100 : 850);
      }
      count.textContent = 'انطلق!';
      count.classList.remove('is-pulse');
      void count.offsetWidth;
      count.classList.add('is-pulse');
      wrap.classList.add('is-launch');
      ctx.sound.rumble(2.4);
      await sleep(ctx.reduced ? 100 : 1900);
      count.textContent = '';
      ctx.sound.pop();
      await reveal(view, ctx, 'وصل إلى القمة');
    }
  };

  // ---------- التسجيل في قائمة الطرق ----------
  const ICONS = {
    slot: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/><path d="M21 9h1.5v5"/>',
    balls: '<path d="M4 9a8 8 0 0 0 16 0"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="13" r="2"/><circle cx="12" cy="21" r="2" fill="currentColor"/>',
    bounce: '<circle cx="12" cy="6" r="3" fill="currentColor"/><path d="M4 20h16M7 17c1-4 3-7 5-8M17 17c-1-4-3-7-5-8" stroke-dasharray="2 2"/>',
    lightpath: '<path d="M4 6h14v6H6v6h14"/><circle cx="20" cy="18" r="2" fill="currentColor"/>',
    conveyor: '<rect x="2" y="15" width="20" height="5" rx="2.5"/><rect x="5" y="8" width="5" height="5" rx="1"/><rect x="13" y="8" width="5" height="5" rx="1"/>',
    doors: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18"/><circle cx="10" cy="12" r=".8" fill="currentColor"/><circle cx="14" cy="12" r=".8" fill="currentColor"/>',
    capsules: '<rect x="3" y="9" width="18" height="7" rx="3.5"/><path d="M12 9v7"/>',
    mystery: '<rect x="4" y="9" width="16" height="12" rx="1"/><path d="M3 6h18v3H3zM12 6v15"/><path d="M10 14.5a2 2 0 1 1 2.5 1.9"/>',
    parachutes: '<path d="M3 11a9 9 0 0 1 18 0"/><path d="M3 11l9 7 9-7M12 11v7"/><rect x="10" y="18" width="4" height="3" rx="1"/>',
    rocket: '<path d="M12 2c3 3 4 7 3.5 12h-7C8 9 9 5 12 2z"/><path d="M8.5 11 6 15l2.5-.5M15.5 11 18 15l-2.5-.5M10 18c.5 2 1 3 2 4 1-1 1.5-2 2-4"/>'
  };

  const FUN = [
    { id: 'slot', name: 'آلة الأسماء', desc: 'ثلاث بكرات تدور مثل آلة الأرقام ثم تكوّن اسم الطالب' },
    { id: 'balls', name: 'كرات السحب', desc: 'الأسماء في كرات تتحرك داخل الوعاء ثم تخرج كرة واحدة' },
    { id: 'bounce', name: 'الكرة المرتدة', desc: 'كرة تقفز بين الأسماء ثم تستقر فوق الاسم المختار' },
    { id: 'lightpath', name: 'مسار الضوء', desc: 'نقطة مضيئة تسير في مسار متعرج بين الأسماء ثم تتوقف' },
    { id: 'conveyor', name: 'ناقل الأسماء', desc: 'صناديق الأسماء على حزام متحرك يتوقف عند منطقة الاختيار' },
    { id: 'doors', name: 'الأبواب المغلقة', desc: 'أبواب مرقمة تُطرق ثم يُفتح باب واحد ليكشف الاسم' },
    { id: 'capsules', name: 'الكبسولات', desc: 'كبسولات شفافة تتبدل أماكنها ثم تُفتح واحدة' },
    { id: 'mystery', name: 'الصندوق الغامض', desc: 'تدخل الأسماء الصندوق، يهتز، ثم يخرج الاسم المختار' },
    { id: 'parachutes', name: 'المظلات الهابطة', desc: 'مظلات تهبط بالأسماء، والرياح تبعدها إلا واحدة تصل لمنطقة الهبوط' },
    { id: 'rocket', name: 'إطلاق الصاروخ', desc: 'عد تنازلي من 5 ثم ينطلق الصاروخ ليكشف اسم الطالب' }
  ];

  PM.list.forEach(m => { if (!m.group) m.group = 'calm'; });
  FUN.forEach(m => {
    PM.list.push(Object.assign({
      group: 'fun',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[m.id]}</svg>`
    }, m));
  });
  Object.assign(PM.impl, modes);
  PM.groups = [
    { id: 'calm', name: 'أشكال هادئة مهنية' },
    { id: 'fun', name: 'أشكال تفاعلية مشوقة' }
  ];
})();
