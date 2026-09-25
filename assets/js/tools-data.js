/* قائمة أدوات رفيق المعلم
   tier: "free" (مجانية بالتسجيل) | "pro" (للمشتركين)
   status: "live" (متاحة) | "soon" (قريبًا)
   usesClass: true إذا كانت الأداة تقرأ أسماء طلاب الصف المختار
   لإضافة أداة جديدة: أضف عنصرًا هنا وأنشئ صفحتها داخل مجلد tools/ */
window.RAFEEQ_TOOLS = [
  {
    id: 'wheel',
    name: 'عجلة الأسماء',
    desc: 'اختيار عشوائي وعادل لاسم طالب للمشاركة، مع خيار استبعاد من تم اختياره.',
    href: 'tools/wheel.html',
    tier: 'free',
    status: 'live',
    usesClass: true,
    color: '#0C7051',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4M12 12 5.6 18.4M12 12H3"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>'
  },
  {
    id: 'timer',
    name: 'مؤقت الأنشطة',
    desc: 'عدّ تنازلي كبير وواضح للأنشطة والمشاركات، مع تنبيه صوتي عند انتهاء الوقت.',
    href: 'tools/timer.html',
    tier: 'free',
    status: 'live',
    color: '#C0913F',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg>'
  }
];

window.RAFEEQ_TIER_LABEL = { free: 'مجانية', pro: 'للمشتركين' };

window.renderToolCards = function (container, basePath) {
  const base = basePath || '';
  container.innerHTML = window.RAFEEQ_TOOLS.map(t => {
    const live = t.status === 'live';
    const tag = live
      ? `<span class="tag tag-${t.tier}">${window.RAFEEQ_TIER_LABEL[t.tier]}</span>`
      : '<span class="tag tag-soon">قريبًا</span>';
    const inner = `
      <span class="tool-icon" style="--tool-color:${t.color}">${t.icon}</span>
      <span class="tool-text">
        <span class="tool-name">${t.name}</span>
        <span class="tool-desc">${t.desc}</span>
      </span>
      ${tag}
      ${t.usesClass ? '<span class="links-class"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>تعرض طلاب الصف المختار</span>' : ''}`;
    return live
      ? `<a class="tool-card" href="${base}${t.href}">${inner}</a>`
      : `<div class="tool-card is-soon" aria-disabled="true">${inner}</div>`;
  }).join('') + `
    <div class="tool-card is-next">
      <span class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
      <span class="tool-text">
        <span class="tool-name">أدوات جديدة في الطريق</span>
        <span class="tool-desc">نضيف أدوات جديدة للمعلم باستمرار.</span>
      </span>
    </div>`;
};
