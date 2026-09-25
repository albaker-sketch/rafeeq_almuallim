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
    const ac = audio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime;
    gain.gain.setValueAtTime(volume ?? 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  const sound = {
    enabled: store.get('sound', true),
    tick() { if (this.enabled) tone(1400, 0.04, 'square', 0.05); },
    win() {
      if (!this.enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.18), i * 110));
    },
    alarm() {
      if (!this.enabled) return;
      for (let r = 0; r < 3; r++) {
        setTimeout(() => { tone(880, 0.18, 'square', 0.12); setTimeout(() => tone(660, 0.25, 'square', 0.12), 200); }, r * 650);
      }
    },
    beep() { if (this.enabled) tone(990, 0.12, 'sine', 0.15); },
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
