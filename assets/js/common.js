/* رفيق المعلم — أدوات مساعدة مشتركة لكل الصفحات */
(function () {
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('rafeeq:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('rafeeq:' + key, JSON.stringify(value)); } catch (e) { /* التخزين غير متاح */ }
    }
  };

  // أصوات بسيطة عبر WebAudio (تعمل بعد أول نقرة من المستخدم)
  let ctx = null;
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, type, volume) {
    play({ freq, dur: duration, type, vol: volume });
  }

  // نغمة واحدة بإعدادات مرنة: تغيّر في التردد، ومرشّح، وتوقيت مؤجل
  function play(o) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + (o.at || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t + o.dur);
    const vol = o.vol ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lowpass) {
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      node = osc.connect(filter);
    }
    node.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  const sound = {
    enabled: store.get('sound', true),
    tick() { if (this.enabled) tone(1400, 0.04, 'square', 0.05); },
    win() {
      if (!this.enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.18), i * 110));
    },
    alarm() { this.finish(); },
    beep() { if (this.enabled) tone(990, 0.12, 'sine', 0.15); },

    // آخر 10 ثوانٍ: دقة ساعة مع نبض قلب يعلو تدريجيًا كلما اقترب الوقت
    tension(secLeft) {
      if (!this.enabled) return;
      const k = Math.min(1, Math.max(0, (11 - secLeft) / 7)); // من 0 إلى 1
      const hi = secLeft % 2 === 0;
      play({ freq: hi ? 1500 : 1150, dur: 0.06, type: 'triangle', vol: 0.12 + k * 0.1 });
      play({ freq: 190, endFreq: 70, dur: 0.16, type: 'sine', vol: 0.35 + k * 0.3, at: 0.02 });
      play({ freq: 170, endFreq: 60, dur: 0.14, type: 'sine', vol: 0.25 + k * 0.25, at: 0.24 });
    },

    // آخر 3 ثوانٍ: نبضتان حادتان متصاعدتان في كل ثانية
    urgent(secLeft) {
      if (!this.enabled) return;
      const f = { 3: 880, 2: 1047, 1: 1245 }[secLeft] || 880;
      play({ freq: f, dur: 0.14, type: 'sawtooth', vol: 0.16, lowpass: 3200 });
      play({ freq: f, dur: 0.14, type: 'sawtooth', vol: 0.16, lowpass: 3200, at: 0.22 });
      play({ freq: 150, endFreq: 55, dur: 0.18, type: 'sine', vol: 0.6 });
    },

    // انتهاء الوقت: بوق هابط ثم جرس
    finish() {
      if (!this.enabled) return;
      [[392, 0], [330, 0.28], [262, 0.56]].forEach(([f, at], i) => {
        play({ freq: f, dur: i === 2 ? 1.1 : 0.26, type: 'sawtooth', vol: 0.22, lowpass: 1800, at, attack: 0.02 });
        play({ freq: f / 2, dur: i === 2 ? 1.1 : 0.26, type: 'square', vol: 0.08, lowpass: 900, at, attack: 0.02 });
      });
      [1568, 2093].forEach((f, i) => play({ freq: f, dur: 1.8, type: 'sine', vol: 0.12, at: 1.75 + i * 0.05 }));
    },

    toggle() { this.enabled = !this.enabled; store.set('sound', this.enabled); return this.enabled; }
  };

  // ملء الشاشة لعنصر محدد (لشاشات العرض والسبورة الذكية)
  function toggleFullscreen(el) {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => el.classList.toggle('pseudo-full'));
      } else {
        el.classList.toggle('pseudo-full');
      }
    } catch (e) {
      el.classList.toggle('pseudo-full');
    }
  }

  window.Rafeeq = { store, sound, toggleFullscreen };
})();
