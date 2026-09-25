/* مخطط الجلوس — رسم الغرفة بصيغة SVG
   roomSVG(doc, opts) يرجع نص SVG كاملًا يُستخدم في المحرر وشاشة الطلاب والصور المصغرة والتصدير. */
(function () {
  const T = window.SeatTemplates;
  const U = 40;
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const GROUP_FILL = ['#DCEBFF', '#DDF3E4', '#FFEBD2', '#EEE2FF', '#FFE0EC', '#D6F2F5', '#FFF4C2', '#FFDCDC', '#E4EEF8', '#E8F5D6'];
  const GROUP_STROKE = ['#2F80ED', '#27AE60', '#F2994A', '#9B51E0', '#EB5A9A', '#17A2B8', '#D4A017', '#E5484D', '#5B7FA6', '#6FA83A'];
  const LEVEL_COLOR = { 1: '#27AE60', 2: '#D4A017', 3: '#E5484D' };
  const FLAG_COLOR = { vision: '#2F80ED', hearing: '#9B51E0', support: '#F2994A', lowPart: '#8A9A95', notBack: '#E5484D', tall: '#16302A', short: '#16302A' };
  const CARD = { s: [60, 24, 11], m: [70, 28, 12.5], l: [84, 34, 15] };

  const ITEM_STYLE = {
    seat: { fill: '#E9DCC3', stroke: '#C4AE85' },
    desk2: { fill: '#E9DCC3', stroke: '#C4AE85' },
    table: { fill: '#DCC7A1', stroke: '#B39463' },
    round: { fill: '#DCC7A1', stroke: '#B39463' },
    board: { fill: '#1F4D3F', stroke: '#0F2C23', text: '#fff', label: 'السبورة' },
    tdesk: { fill: '#8B6B4A', stroke: '#5E4630', text: '#fff', label: 'مكتب المعلم' },
    door: { fill: '#C9A27A', stroke: '#8B6B4A', text: '#3B2A10', label: 'باب' },
    window: { fill: '#CBE8F7', stroke: '#6FAED0', text: '#1F5673', label: 'نافذة' },
    screen: { fill: '#2B2F36', stroke: '#111', text: '#fff', label: 'شاشة العرض' },
    cabinet: { fill: '#B7A58A', stroke: '#8C7A5E', text: '#fff', label: 'خزانة' },
    aisle: { fill: 'rgba(12,112,81,.05)', stroke: '#9DB7AC', text: '#7A948A', label: 'ممر', dash: '8 6' },
    zone: { fill: 'rgba(242,184,75,.12)', stroke: '#E0B35C', text: '#8A6420', label: 'منطقة نشاط', dash: '10 6' },
    blocked: { fill: 'url(#hatch)', stroke: '#9AA5A1', text: '#5A6D66', label: 'غير قابل للاستخدام' }
  };

  // ترتيب المجموعات (الطاولات) من الأمام للخلف ومن اليمين لليسار
  function groupIndex(items) {
    const idx = {};
    items.filter(i => T.seatSlots(i).length > 1)
      .sort((a, b) => (Math.round(a.y) - Math.round(b.y)) || (b.x - a.x))
      .forEach((t, k) => { idx[t.id] = k; });
    return idx;
  }

  // ترقيم المقاعد: من الأمام، ومن اليمين
  function seatNumbers(seats) {
    const n = {};
    seats.slice().sort((a, b) => (Math.round(a.y) - Math.round(b.y)) || (b.x - a.x)).forEach((s, k) => { n[s.id] = k + 1; });
    return n;
  }

  function lockGlyph(x, y) {
    return `<g transform="translate(${x} ${y})"><rect x="-5" y="-2" width="10" height="8" rx="1.5" fill="#16302A"/><path d="M-3 -2v-2.5a3 3 0 0 1 6 0V-2" fill="none" stroke="#16302A" stroke-width="1.6"/></g>`;
  }

  function chip(doc, seat, it, o, ctx) {
    const [cw, ch, fs0] = CARD[o.card || 'm'];
    const sid = doc.assign[seat.id];
    const blocked = (doc.blocked || {})[seat.id];
    const pinned = (doc.pins || {})[seat.id];
    const tr = -(it.rot || 0) - (o.flip ? 180 : 0);
    const x = seat.lx * U, y = seat.ly * U;
    const num = ctx.nums[seat.id];
    const gi = ctx.groups[it.id];
    const absent = sid && ctx.absent.has(sid);
    let s = `<g class="chip" data-seat="${seat.id}" transform="translate(${x} ${y}) rotate(${tr})">`;
    const hl = sid && o.highlight && o.highlight[sid];
    if (blocked) {
      s += `<rect x="${-cw / 2}" y="${-ch / 2}" width="${cw}" height="${ch}" rx="8" fill="#E7EAE9" stroke="#9AA5A1" stroke-dasharray="4 3"/>`;
      s += `<path d="M${-8} ${-8}L8 8M8 ${-8}L${-8} 8" stroke="#9AA5A1" stroke-width="2"/>`;
    } else if (!sid || (absent && o.student)) {
      s += `<rect x="${-cw / 2}" y="${-ch / 2}" width="${cw}" height="${ch}" rx="8" fill="rgba(255,255,255,.7)" stroke="#B9C4BF" stroke-dasharray="4 3"/>`;
    } else {
      const useGroup = o.groupColors && gi !== undefined;
      const fill = absent ? '#F1F1F1' : useGroup ? GROUP_FILL[gi % GROUP_FILL.length] : '#FFFFFF';
      const stroke = hl || (useGroup ? GROUP_STROKE[gi % GROUP_STROKE.length] : '#8FA39B');
      const name = o.fullNames ? ctx.full[sid] : ctx.short[sid];
      const fs = Math.max(8, Math.min(fs0, (cw * 1.75) / Math.max(3, (name || '').length)));
      s += `<rect x="${-cw / 2}" y="${-ch / 2}" width="${cw}" height="${ch}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${hl ? 4 : 1.6}"${absent ? ' stroke-dasharray="3 3"' : ''}/>`;
      if (!o.student && o.tags) {
        const p = ctx.profiles[sid] || {};
        s += `<rect x="${cw / 2 - 5}" y="${-ch / 2 + 3}" width="3" height="${ch - 6}" rx="1.5" fill="${LEVEL_COLOR[p.level || 2]}"/>`;
        let fx = -cw / 2 + 5;
        ['vision', 'hearing', 'support', 'lowPart', 'notBack'].forEach(k => {
          if (p[k]) { s += `<circle cx="${fx}" cy="${-ch / 2 + 5}" r="2.6" fill="${FLAG_COLOR[k]}"/>`; fx += 6; }
        });
      }
      s += `<text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="600" fill="${absent ? '#9AA5A1' : '#16302A'}">${esc(name || '')}</text>`;
      if (absent && !o.student) s += `<text x="0" y="${ch / 2 + 9}" text-anchor="middle" font-size="9" fill="#E5484D">غائب</text>`;
      const role = (doc.roles || {})[sid];
      if (role && !absent) s += `<text x="0" y="${ch / 2 + 10}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${useGroup ? GROUP_STROKE[gi % GROUP_STROKE.length] : '#5A6D66'}">${esc(role)}</text>`;
    }
    if (pinned && !o.student) s += lockGlyph(cw / 2 - 4, -ch / 2 - 1);
    if (o.nums && num) s += `<text x="${-cw / 2 + 2}" y="${-ch / 2 - 4}" font-size="9" fill="#7A8F87">${num}</text>`;
    s += '</g>';
    return s;
  }

  function item(doc, it, o, ctx) {
    const st = ITEM_STYLE[it.kind] || ITEM_STYLE.cabinet;
    const w = it.w * U, h = it.h * U;
    const cx = (it.x + it.w / 2) * U, cy = (it.y + it.h / 2) * U;
    const tr = -(it.rot || 0) - (o.flip ? 180 : 0);
    const sel = o.sel && o.sel.has(it.id);
    let s = `<g class="it" data-item="${it.id}" transform="translate(${cx} ${cy}) rotate(${it.rot || 0})">`;
    if (it.kind === 'round') {
      s += `<circle r="${w / 2}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"/>`;
    } else {
      s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${it.kind === 'seat' || it.kind === 'desk2' ? 6 : 4}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
    }
    if (it.kind === 'door') s += `<path d="M${-w / 2} ${h / 2} A ${w} ${w} 0 0 1 ${w / 2} ${h / 2 + w * 0.0}" fill="none" stroke="${st.stroke}" stroke-dasharray="4 4" opacity=".6"/>`;
    // عناوين العناصر
    if (!T.KINDS[it.kind].seating) {
      let label = it.label || st.label;
      if (it.kind === 'zone' && it.station !== undefined && o.stationNow) {
        const g = o.stationNow[it.station];
        if (g !== undefined) label += ' — الآن: المجموعة ' + (g + 1);
      }
      const big = Math.min(w, h) > 60;
      const fs = it.kind === 'zone' ? 15 : (big || it.kind === 'board' || it.kind === 'screen') ? 14 : 11;
      const ty = it.kind === 'zone' ? -h / 2 + 18 : 0;
      const vertical = it.kind === 'aisle' && h > w;
      s += `<text transform="rotate(${vertical ? tr + 90 : tr})" x="0" y="${vertical ? 0 : ty}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="700" fill="${st.text}">${esc(label)}</text>`;
    } else if (ctx.groups[it.id] !== undefined && o.groupLabels) {
      const gi = ctx.groups[it.id];
      const label = it.station !== undefined ? '' : 'مجموعة ' + (gi + 1);
      if (label) s += `<text transform="rotate(${tr})" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="${GROUP_STROKE[gi % GROUP_STROKE.length]}">${label}</text>`;
    }
    // المقاعد
    ctx.seatsByItem[it.id] && ctx.seatsByItem[it.id].forEach(seat => { s += chip(doc, seat, it, o, ctx); });
    if (sel) {
      const pad = T.KINDS[it.kind].seating && it.kind !== 'seat' && it.kind !== 'desk2' ? 34 : 6;
      s += `<rect x="${-w / 2 - pad}" y="${-h / 2 - pad}" width="${w + pad * 2}" height="${h + pad * 2}" fill="none" stroke="#C0913F" stroke-width="2.5" stroke-dasharray="6 4" rx="8"/>`;
      if (o.handles && it.kind !== 'seat' && it.kind !== 'desk2') s += `<circle class="handle" data-handle="${it.id}" cx="${w / 2 + pad}" cy="${h / 2 + pad}" r="9" fill="#C0913F" stroke="#fff" stroke-width="2"/>`;
    }
    s += '</g>';
    return s;
  }

  function arrow(a, color) {
    const x1 = a.from.x * U, y1 = a.from.y * U, x2 = a.to.x * U, y2 = a.to.y * U;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = 14;
    const hx = x2 - Math.cos(ang) * 20, hy = y2 - Math.sin(ang) * 20;
    const p1 = `${hx},${hy}`;
    const p2 = `${hx - Math.cos(ang - 0.45) * L},${hy - Math.sin(ang - 0.45) * L}`;
    const p3 = `${hx - Math.cos(ang + 0.45) * L},${hy - Math.sin(ang + 0.45) * L}`;
    return `<g class="arrow"><circle cx="${x1}" cy="${y1}" r="6" fill="${color}" opacity=".7"/><line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" stroke="${color}" stroke-width="4" stroke-dasharray="10 6" opacity=".85"/><polygon points="${p1} ${p2} ${p3}" fill="${color}"/></g>`;
  }

  /* opts: { student, flip, grid, nums, fullNames, groupColors, tags, card, sel, handles, highlight, arrows,
             width, height, profiles, names, absent, stationNow, groupLabels } */
  function roomSVG(doc, o) {
    o = o || {};
    const W = doc.room.w * U, H = doc.room.h * U;
    const seats = T.seatsOf(doc.items);
    const seatsByItem = {};
    seats.forEach(s => { (seatsByItem[s.itemId] = seatsByItem[s.itemId] || []).push(s); });
    const ctx = {
      groups: groupIndex(doc.items),
      nums: seatNumbers(seats),
      seatsByItem,
      short: (o.names && o.names.short) || {},
      full: (o.names && o.names.full) || {},
      profiles: o.profiles || {},
      absent: o.absent || new Set()
    };
    const order = { zone: 0, aisle: 1, blocked: 2, window: 3, door: 3, board: 4, screen: 4, cabinet: 4, tdesk: 4 };
    const items = doc.items.slice().sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${o.width || W}" height="${o.height || H}" font-family="Readex Pro, Tahoma, Arial, sans-serif">`;
    s += `<defs><pattern id="grid" width="${U}" height="${U}" patternUnits="userSpaceOnUse"><path d="M ${U} 0 L 0 0 0 ${U}" fill="none" stroke="#DCE4E0" stroke-width="1"/></pattern>`;
    s += `<pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#EEF1F0"/><line x1="0" y1="0" x2="0" y2="10" stroke="#B8C2BE" stroke-width="4"/></pattern></defs>`;
    s += `<g class="roomG"${o.flip ? ` transform="rotate(180 ${W / 2} ${H / 2})"` : ''}>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#FBFAF6" stroke="#B9C4BF" stroke-width="3" rx="6"/>`;
    if (o.grid) s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#grid)"/>`;
    items.forEach(it => { s += item(doc, it, o, ctx); });
    (o.arrows || []).forEach(a => { s += arrow(a, a.color || '#2F80ED'); });
    s += `<g class="anim"></g></g></svg>`;
    return s;
  }

  window.SeatRender = { U, roomSVG, groupIndex, seatNumbers, GROUP_FILL, GROUP_STROKE, esc };
})();
