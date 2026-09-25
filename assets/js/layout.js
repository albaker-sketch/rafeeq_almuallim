/* رفيق المعلم — الترويسة والتذييل المشتركان لكل الصفحات
   الاستخدام: <header id="siteHeader" data-base="../" data-page="tools"></header>
   data-base: المسار النسبي لجذر الموقع ("" للصفحات في الجذر، "../" لصفحات tools/) */
(function () {
  const NAV = [
    { id: 'home', label: 'الرئيسية', href: 'index.html' },
    { id: 'tools', label: 'الأدوات', href: 'tools.html' },
    { id: 'classes', label: 'صفوفي', href: 'classes.html' },
    { id: 'plans', label: 'الباقات', href: 'index.html#plans' },
    { id: 'about', label: 'من نحن', href: 'about.html' }
  ];

  const MARK = '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0C7051"/><path d="M9 13.5c3.7-1.5 7.5-1.2 11 1.2V29c-3.5-2.3-7.3-2.6-11-1.2z" fill="#fff"/><path d="M31 13.5c-3.7-1.5-7.5-1.2-11 1.2V29c3.5-2.3 7.3-2.6 11-1.2z" fill="#fff" opacity=".75"/><circle cx="31" cy="9.5" r="4" fill="#C0913F"/></svg>';

  const header = document.getElementById('siteHeader');
  if (header) {
    const base = header.dataset.base || '';
    const page = header.dataset.page || '';
    header.className = 'site-header';
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="${base}index.html" aria-label="رفيق المعلم، الصفحة الرئيسية">
          ${MARK}
          <span class="brand-name">رفيق المعلم<span class="brand-by">من رافد</span></span>
        </a>
        <nav class="main-nav" aria-label="القائمة الرئيسية">
          ${NAV.map(n => `<a href="${base}${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
        </nav>
        <a class="btn btn-primary header-cta" href="${base}login.html">تسجيل الدخول</a>
      </div>`;
  }

  const footer = document.getElementById('siteFooter');
  if (footer) {
    const base = footer.dataset.base || '';
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="wrap">
        <span>رفيق المعلم، أحد مشاريع رافد لتصميم البرمجيات الخاصة</span>
        <nav class="footer-nav" aria-label="روابط التذييل">
          ${NAV.map(n => `<a href="${base}${n.href}">${n.label}</a>`).join('')}
        </nav>
        <span>© 2026</span>
      </div>`;
  }
})();
