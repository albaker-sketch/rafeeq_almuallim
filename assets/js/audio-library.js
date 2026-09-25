/* رفيق المعلم — مكتبة أصوات مؤقت الأنشطة
   - مقاطع جاهزة داخل الموقع (assets/audio)
   - مقاطع يرفعها المعلم، تُحفظ في متصفحه (IndexedDB) لتبقى بعد إغلاق الصفحة

   لإضافة أنشودة جاهزة لكل المستخدمين: ضع الملف في assets/audio وأضفه إلى BUILTINS. */
(function () {
  const BUILTINS = [
    { id: 'b:daf', name: 'إيقاع دف', file: 'daf.wav' },
    { id: 'b:clock', name: 'دقات ساعة هادئة', file: 'clock.wav' },
    { id: 'b:waves', name: 'أمواج هادئة', file: 'waves.wav' }
  ];

  const MAX_BYTES = 25 * 1024 * 1024;
  const DB_NAME = 'rafeeq-audio';
  const STORE = 'tracks';
  const memory = new Map(); // بديل مؤقت إن لم يتوفر IndexedDB
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await openDb();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : true);
        t.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  const urls = new Map();

  const api = {
    builtins: BUILTINS,
    maxBytes: MAX_BYTES,
    persistent: true,

    async listUploads() {
      const rows = await tx('readonly', s => s.getAll());
      const list = rows || Array.from(memory.values());
      return list
        .sort((a, b) => a.addedAt - b.addedAt)
        .map(r => ({ id: r.id, name: r.name, size: r.size }));
    },

    async addUpload(file) {
      if (!file || !/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|webm)$/i.test(file.name)) {
        return { error: 'الملف ليس ملفًا صوتيًا. اختر ملف mp3 أو m4a أو wav.' };
      }
      if (file.size > MAX_BYTES) return { error: 'حجم الملف أكبر من 25 ميجابايت. اختر مقطعًا أقصر.' };
      const rec = {
        id: 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name.replace(/\.[^.]+$/, ''),
        type: file.type,
        size: file.size,
        blob: file,
        addedAt: Date.now()
      };
      const ok = await tx('readwrite', s => s.put(rec));
      if (!ok) {
        memory.set(rec.id, rec);
        api.persistent = false;
      }
      return { track: { id: rec.id, name: rec.name, size: rec.size } };
    },

    async removeUpload(id) {
      memory.delete(id);
      await tx('readwrite', s => s.delete(id));
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    },

    async exists(id) {
      if (BUILTINS.some(b => b.id === id)) return true;
      return (await api.listUploads()).some(u => u.id === id);
    },

    async nameOf(id) {
      const b = BUILTINS.find(x => x.id === id);
      if (b) return b.name;
      const u = (await api.listUploads()).find(x => x.id === id);
      return u ? u.name : '';
    },

    // رابط تشغيل المقطع. base: المسار النسبي لجذر الموقع
    async urlFor(id, base) {
      const b = BUILTINS.find(x => x.id === id);
      if (b) return (base || '') + 'assets/audio/' + b.file;
      if (urls.has(id)) return urls.get(id);
      let rec = memory.get(id);
      if (!rec) rec = await tx('readonly', s => s.get(id));
      if (!rec || !rec.blob) return '';
      const url = URL.createObjectURL(rec.blob);
      urls.set(id, url);
      return url;
    }
  };

  window.RafeeqAudio = api;
})();
