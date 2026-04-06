/*!
 * ab-datepicker.js  v1.0
 * AbDatepicker + AbTimeslot
 * 
 */

(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     SHARED CONSTANTS
  ═══════════════════════════════════════════════════════════════════════ */

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /** Shared TZ — AbTimeslot inherits from last AbDatepicker.init() call. */
  let _sharedTimezone = 'Asia/Kuala_Lumpur';

  /* ═══════════════════════════════════════════════════════════════════════
     AbDatepicker
  ═══════════════════════════════════════════════════════════════════════ */

  function createDatepickerInstance(opts) {
    const daterowEl  = document.getElementById(opts.daterowId);
    const calendarEl = document.getElementById(opts.calendarId);
    const clockEl    = opts.clockId ? document.getElementById(opts.clockId) : null;

    const calMode  = (calendarEl && calendarEl.getAttribute('mode'))     || opts.mode     || 'inline';
    const timezone = (calendarEl && calendarEl.getAttribute('timezone')) || opts.timezone || 'Asia/Kuala_Lumpur';
    const accent   = opts.accent || '#3a8b6b';

    _sharedTimezone = timezone;

    const S = {
      timezone,
      calMode,
      today      : null,
      todayKey   : null,
      calYear    : 0,
      calMonth   : 0,
      selected   : null,
      isOpen     : false,
      blockedDates : opts.blockedDates  || [],
      blockedRanges: opts.blockedRanges || [],
      cutoffs: {
        prevDay   : opts.prevDayCutoff || null,
        sameDay   : opts.sameDayCutoff || null,
        sunday    : opts.sundayCutoff  || null,
        noSunday  : opts.noSunday      || false,
        noSaturday: opts.noSaturday    || false,
      },
      dateCutoffs  : opts.dateCutoffs   || {},
      onChange     : opts.onChange      || null,
      beforeShowDay: opts.beforeShowDay || null,
      initialRender: opts.initialRender || false,
      _injectedBeforeShowDay: null,
      _slotDependency: opts.slotDependency || false,
      calWrap    : null,
      chipEls    : [],
      clockTimer : null,
    };

    /* ── TZ helpers ── */

    function tzNow() {
      return new Date(new Date().toLocaleString('en-US', { timeZone: S.timezone }));
    }

    function tzHHMM() {
      const n = tzNow();
      return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    }

    function isAfter(c) { return c ? tzHHMM() >= c : false; }

    function refreshToday() {
      const n    = tzNow();
      S.today    = { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
      S.todayKey = dateKey(S.today.y, S.today.m, S.today.d);
    }

    /* ── Key helpers ── */

    function dateKey(y, mi, d) {
      return `${y}-${String(mi + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function parseKey(k) {
      if (!k) return { y: 0, m: 0, d: 0 };
      const [y, m, d] = k.split('-').map(Number);
      return { y, m: m - 1, d };
    }

    /** 'YYYY-MM-DD' → 'DD-MM-YYYY' */
    function keyToDisplay(k) {
      if (!k) return null;
      const [y, m, d] = k.split('-');
      return `${d}-${m}-${y}`;
    }

    function buildDateObj(key, disOverride = null) {
      if (!key) {
        return {
          date: null, dateKey: null, time: tzHHMM(),
          dayofweek: null, dayIndex: 0, isToday: false, isDisabled: true,
          year: 0, month: 0, day: 0, monthName: null,
        };
      }
      const { y, m, d } = parseKey(key);
      const di = new Date(y, m, d).getDay();
      return {
        date      : keyToDisplay(key),
        dateKey   : key,
        time      : tzHHMM(),
        dayofweek : DAY_ABBR[di],
        dayIndex  : di,
        isToday   : key === S.todayKey,
        isDisabled: disOverride !== null ? disOverride : isDayDisabled(key),
        year      : y,
        month     : m + 1,
        day       : d,
        monthName : MONTH_NAMES[m],
      };
    }

    /* ── Disable logic ── */

    function isPast(k) { return k < S.todayKey; }

    function isExplicitlyBlocked(k) {
      const { y, m, d } = parseKey(k);
      const dmy = `${String(d).padStart(2,'0')}-${String(m+1).padStart(2,'0')}-${y}`;
      if (S.blockedDates.includes(dmy)) return true;
      if (S.blockedRanges.some(r => k >= r.start && k <= r.end)) return true;
      const dow = new Date(y, m, d).getDay();
      if (S.cutoffs.noSunday   && dow === 0) return true;
      if (S.cutoffs.noSaturday && dow === 6) return true;
      return false;
    }

    function isCutoffBlocked(k) {
      if (isExplicitlyBlocked(k)) return false;
      const hasCfg = S.cutoffs.sameDay || S.cutoffs.prevDay || S.cutoffs.sunday
                  || Object.keys(S.dateCutoffs).length > 0;
      if (!hasCfg) return false;

      const { y, m, d } = parseKey(k);
      const dow = new Date(y, m, d).getDay();

      if (k === S.todayKey) {
        const cut = S.dateCutoffs[k]
          || (dow === 0 ? S.cutoffs.sunday || S.cutoffs.sameDay : S.cutoffs.sameDay);
        if (isAfter(cut)) return true;
      }

      const tmr    = new Date(S.today.y, S.today.m, S.today.d + 1);
      const tmrKey = dateKey(tmr.getFullYear(), tmr.getMonth(), tmr.getDate());
      if (k === tmrKey) {
        const cut = dow === 0 ? S.cutoffs.sunday || S.cutoffs.prevDay : S.cutoffs.prevDay;
        if (isAfter(cut)) return true;
      }

      return false;
    }

    function isDayDisabled(k) {
      if (isPast(k))              return true;
      if (isExplicitlyBlocked(k)) return true;
      if (isCutoffBlocked(k))     return true;
      if (S.beforeShowDay) {
        try { if (S.beforeShowDay(buildDateObj(k, false)) === false) return true; } catch (e) {}
      }
      if (S._injectedBeforeShowDay) {
        try { if (S._injectedBeforeShowDay(buildDateObj(k, false)) === false) return true; } catch (e) {}
      }
      return false;
    }

    function hasDot(k) {
      if (isDayDisabled(k)) return false;
      const { y, m, d } = parseKey(k);
      const dow = new Date(y, m, d).getDay();
      return !!(S.cutoffs.sameDay || S.cutoffs.prevDay
             || (dow === 0 && S.cutoffs.sunday) || S.dateCutoffs[k]);
    }

    function findNext(max = 365) {
      for (let i = 0; i < max; i++) {
        const dt = new Date(S.today.y, S.today.m, S.today.d + i);
        const k  = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
        if (!isDayDisabled(k)) return k;
      }
      return S.todayKey;
    }

    /* ── Date row ── */

    function buildDateRow() {
      if (!daterowEl) return;
      refreshToday();
      daterowEl.innerHTML = '';
      daterowEl.className = 'ab-dp-root';
      daterowEl.style.setProperty('--ab-accent', accent);

      const card = document.createElement('div');
      card.className = 'ab-dr-card';
      card.innerHTML = `
        <div class="ab-chips"></div>
        <div class="ab-footer">
          <button class="ab-see-full">
            See Full Calendar
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.6"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="ab-selected-date"></span>
        </div>
      `;

      buildChips(card);
      updateSelectedDateDisplay(card);

      const toggleBtn = card.querySelector('.ab-see-full');
      if (S.isOpen) toggleBtn.classList.add('ab-open');
      toggleBtn.addEventListener('click', toggleCal);

      S.calWrap = buildCalPanel(S.calMode);
      if (S.isOpen) S.calWrap.classList.add('ab-open');
      card.appendChild(S.calWrap);

      daterowEl.appendChild(card);
      startClock();
    }

    function updateSelectedDateDisplay(card) {
      const root = card || (daterowEl && daterowEl.querySelector('.ab-dr-card'));
      const el   = root && root.querySelector('.ab-selected-date');
      if (!el || !S.selected) return;

      /* Hide if selected date is within the visible 7 chips */
      const inChips = S.chipEls.some(c => c.dataset.key === S.selected);
      if (inChips) {
        el.textContent   = '';
        el.style.display = 'none';
        return;
      }

      const { y, m, d } = parseKey(S.selected);
      el.textContent   = `${DAY_ABBR[new Date(y, m, d).getDay()]}, ${d} ${MONTH_NAMES[m]} ${y}`;
      el.style.display = '';
    }

    function buildChips(card) {
      S.chipEls = [];
      const wrap = card.querySelector('.ab-chips');
      const now  = tzNow();

      /* DocumentFragment — one DOM insertion for all 7 chips */
      const frag = document.createDocumentFragment();

      for (let i = 0; i < 7; i++) {
        const cd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const k  = dateKey(cd.getFullYear(), cd.getMonth(), cd.getDate());
        const isTd = k === S.todayKey;
        const dis  = isDayDisabled(k);
        const dot  = !dis && hasDot(k);

        const chip = document.createElement('div');
        chip.dataset.key = k;
        chip.innerHTML   = `
          <span class="ab-dow">${DAY_ABBR[cd.getDay()]}</span>
          <span class="ab-dom">${cd.getDate()}</span>
          ${dot ? '<span class="ab-chip-dot"></span>' : ''}
        `;
        applyChipCls(chip, k, isTd, dis);
        S.chipEls.push(chip);

        if (!dis) {
          chip.addEventListener('click', () => {
            S.selected   = k;
            S.calYear    = cd.getFullYear();
            S.calMonth   = cd.getMonth();
            if (S.calWrap) { buildCalGrid(S.calWrap); syncPrev(S.calWrap); }
            closeCal();
            refreshChips();
            if (S.calWrap) syncSelBar(S.calWrap);
            updateSelectedDateDisplay();
            if (S.onChange) S.onChange({ type: 'single', ...buildDateObj(k, false) });
          });
        }

        frag.appendChild(chip);
      }

      wrap.appendChild(frag);
    }

    function applyChipCls(el, k, isTd, dis) {
      const sel = k === S.selected;
      el.className = [
        'ab-chip',
        dis && isTd  ? 'ab-dis ab-today-dis' : '',
        dis && !isTd ? 'ab-dis' : '',
        !dis && isTd ? 'ab-today' : '',
        !dis && sel  ? 'ab-sel'   : '',
      ].filter(Boolean).join(' ');
    }

    function refreshChips() {
      refreshToday();
      S.chipEls.forEach(chip => {
        const k = chip.dataset.key;
        applyChipCls(chip, k, k === S.todayKey, isDayDisabled(k));
      });
    }

    /* ── Calendar panel ── */

    function buildCalPanel(type) {
      const isPop = type === 'popup';
      const wrap  = document.createElement('div');
      wrap.className       = isPop ? 'ab-popup-wrap' : 'ab-inline-wrap';
      wrap.dataset.calPanel = '1';

      const body = `
        <div class="ab-cal-panel">
          <div class="ab-cal-nav">
            <button class="ab-nav-btn ab-prev" aria-label="Previous month">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M6 1L1 6l5 5" stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <span class="ab-month-label"></span>
            <button class="ab-nav-btn ab-next" aria-label="Next month">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="ab-cal-grid"></div>
        </div>
        <div class="ab-sel-bar">
          <span class="ab-sb-l">Selected</span>
          <span class="ab-sb-v">—</span>
        </div>
      `;

      wrap.innerHTML = isPop
        ? body
        : `<div class="ab-inline-inner"><div class="ab-hr"></div>${body}</div>`;

      wrap.querySelector('.ab-prev').addEventListener('click', () => {
        if (atMin()) return;
        S.calMonth--;
        if (S.calMonth < 0) { S.calMonth = 11; S.calYear--; }
        buildCalGrid(wrap);
        syncPrev(wrap);
      });

      wrap.querySelector('.ab-next').addEventListener('click', () => {
        S.calMonth++;
        if (S.calMonth > 11) { S.calMonth = 0; S.calYear++; }
        buildCalGrid(wrap);
        syncPrev(wrap);
      });

      buildCalGrid(wrap);
      syncPrev(wrap);
      return wrap;
    }

    function atMin() {
      return S.calYear < S.today.y
          || (S.calYear === S.today.y && S.calMonth <= S.today.m);
    }

    function syncPrev(wrap) {
      const btn = wrap.querySelector('.ab-prev');
      if (!btn) return;
      const at = atMin();
      btn.disabled           = at;
      btn.style.opacity      = at ? '0.3' : '';
      btn.style.cursor       = at ? 'not-allowed' : '';
      btn.style.pointerEvents = at ? 'none' : '';
    }

    function buildCalGrid(wrap) {
      const y = S.calYear, m = S.calMonth;
      const lbl = wrap.querySelector('.ab-month-label');
      if (lbl) lbl.textContent = `${MONTH_NAMES[m]} ${y}`;

      const grid = wrap.querySelector('.ab-cal-grid');
      if (!grid) return;
      grid.innerHTML = '';

      /* Use a single DocumentFragment — one reflow for the whole grid */
      const frag = document.createDocumentFragment();

      DAY_ABBR.forEach(a => {
        const h = document.createElement('div');
        h.className   = 'ab-g-dow';
        h.textContent = a;
        frag.appendChild(h);
      });

      const fc   = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();

      for (let i = 0; i < fc; i++) {
        const e = document.createElement('div');
        e.className = 'ab-cell ab-cell-empty';
        frag.appendChild(e);
      }

      for (let day = 1; day <= days; day++) {
        const k    = dateKey(y, m, day);
        const past = isPast(k);
        const dis  = !past && isDayDisabled(k);
        const dot  = !past && !dis && hasDot(k);

        const cell = document.createElement('div');
        cell.dataset.key = k;
        cell.innerHTML   = `<span class="ab-cn">${day}</span>${dot ? '<span class="ab-cell-dot"></span>' : ''}`;
        applyCellCls(cell, k, past, dis);
        if (!past && !dis) cell.addEventListener('click', () => onCellClick(k, wrap));
        frag.appendChild(cell);
      }

      const tot   = fc + days;
      const trail = tot % 7 === 0 ? 0 : 7 - (tot % 7);
      for (let i = 0; i < trail; i++) {
        const e = document.createElement('div');
        e.className = 'ab-cell ab-cell-empty';
        frag.appendChild(e);
      }

      grid.appendChild(frag);   /* single DOM mutation */
      syncSelBar(wrap);
      syncPrev(wrap);
    }

    function patchCalGrid(wrap) {
      if (!wrap) return;
      refreshToday();
      wrap.querySelectorAll('.ab-cell:not(.ab-cell-empty)').forEach(cell => {
        const k    = cell.dataset.key;
        const past = isPast(k);
        applyCellCls(cell, k, past, !past && isDayDisabled(k));
      });
      syncSelBar(wrap);
    }

    function applyCellCls(el, k, past, dis) {
      const sel = k === S.selected, isTd = k === S.todayKey;
      el.className = [
        'ab-cell',
        past                        ? 'ab-cc-past'               : '',
        !past && dis && isTd        ? 'ab-cc-dis ab-cc-today-dis' : '',
        !past && dis && !isTd       ? 'ab-cc-dis'                 : '',
        !past && !dis && sel        ? 'ab-cc-sel'                 : '',
        !past && !dis && isTd && !sel ? 'ab-cc-today'             : '',
      ].filter(Boolean).join(' ');
    }

    function onCellClick(k, wrap) {
      S.selected = k;
      const { y, m } = parseKey(k);
      S.calYear  = y;
      S.calMonth = m;
      buildCalGrid(wrap);
      syncPrev(wrap);
      refreshChips();
      closeCal();
      updateSelectedDateDisplay();
      if (S.onChange) S.onChange({ type: 'single', ...buildDateObj(k, false) });
    }

    function syncSelBar(wrap) {
      if (!wrap) return;
      const bar = wrap.querySelector('.ab-sel-bar');
      const val = wrap.querySelector('.ab-sb-v');
      if (!bar || !val) return;
      if (S.selected) { bar.classList.add('ab-on'); val.textContent = keyToDisplay(S.selected); }
      else              bar.classList.remove('ab-on');
    }

    /* ── Open / close ── */

    function toggleCal() { S.isOpen ? closeCal() : openCal(); }

    function openCal() {
      S.isOpen = true;
      if (!S.calWrap) return;
      S.calWrap.classList.add('ab-open');
      const btn = daterowEl && daterowEl.querySelector('.ab-see-full');
      if (btn) btn.classList.add('ab-open');
      patchCalGrid(S.calWrap);
      syncPrev(S.calWrap);
      if (S.calMode === 'popup') setTimeout(() => document.addEventListener('click', onOutside), 0);
    }

    function closeCal() {
      if (!S.isOpen) return;
      S.isOpen = false;
      if (S.calWrap) S.calWrap.classList.remove('ab-open');
      const btn = daterowEl && daterowEl.querySelector('.ab-see-full');
      if (btn) btn.classList.remove('ab-open');
      document.removeEventListener('click', onOutside);
    }

    function onOutside(e) {
      const card = daterowEl && daterowEl.querySelector('.ab-dr-card');
      if (card && !card.contains(e.target)) closeCal();
    }

    /* ── Clock ── */

    function startClock() {
      function tick() {
        const t = tzNow().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        if (clockEl) clockEl.textContent = t;
      }
      tick();
      clearInterval(S.clockTimer);
      S.clockTimer = setInterval(tick, 1000);
    }

    /* ── Reload ── */

    function reload() {
      refreshToday();
      S.calYear  = S.today.y;
      S.calMonth = S.today.m;
      if (S.selected && isDayDisabled(S.selected)) S.selected = null;
      buildDateRow();
    }

    /* ── Init ── */

    refreshToday();
    S.selected = isDayDisabled(S.todayKey) ? findNext() : S.todayKey;

    /* Position calendar on selected date's month */
    if (S.selected) {
      const { y, m } = parseKey(S.selected);
      S.calYear  = y;
      S.calMonth = m;
    } else {
      S.calYear  = S.today.y;
      S.calMonth = S.today.m;
    }

    buildDateRow();

    if (S.initialRender && S.selected && S.onChange) {
      requestAnimationFrame(() => S.onChange({ type: 'single', ...buildDateObj(S.selected, false) }));
    }

    /* ── Public API ── */

    return {
      getSelected()          { return keyToDisplay(S.selected); },
      setCalMode(mode)       { S.calMode = mode; closeCal(); reload(); },
      open()                 { openCal(); },
      close()                { closeCal(); },
      addBlockedDate(dmy)    { S.blockedDates.push(dmy); reload(); },
      clearBlockedDates()    { S.blockedDates = []; reload(); },
      reload,

      _injectBeforeShowDay(fn) { S._injectedBeforeShowDay = fn; reload(); },
      get _slotDependency()    { return S._slotDependency; },

      _selectDate(k) {
        if (!k || S.selected === k) return;
        S.selected = k;
        const { y, m } = parseKey(k);
        S.calYear  = y;
        S.calMonth = m;
        buildDateRow();
        if (S.onChange) S.onChange({ type: 'single', ...buildDateObj(k, false) });
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AbTimeslot
  ═══════════════════════════════════════════════════════════════════════ */

  function createTimeslotInstance(opts) {
    const containerEl = document.getElementById(opts.containerId);
    if (!containerEl) {
      console.error('[AbTimeslot] containerId not found:', opts.containerId);
      return null;
    }

    const S = {
      timezone      : opts.timezone        || _sharedTimezone,
      closesSoonMins: opts.closesSoonMins   != null ? opts.closesSoonMins : 300,
      noSlotsText   : opts.noSlotsText      || 'No delivery slots available for this date.',
      slots         : opts.slots            || [],
      blockSlotsByDate: normalizeDateKeys(opts.blockSlotsByDate),
      blockSlots    : opts.blockSlots       || [],
      weekdayRules  : opts.weekdayRules     || {},
      rules         : opts.rules            || [],
      onChange      : opts.onChange         || null,
      currentDateKey: null,
      selectedSlotId: null,
      _onRender     : null,
      _advancing    : false,
      _refreshTimer : null,
    };

    const DOW_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

    /* ── TZ helpers ── */

    function tzNow() {
      return new Date(new Date().toLocaleString('en-US', { timeZone: S.timezone }));
    }

    function tzHHMM() {
      const n = tzNow();
      return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    }

    function todayKey() {
      const n = tzNow();
      return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
    }

    function getDOW(k) {
      if (!k) return 0;
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d).getDay();
    }

    function isAfter(c) { return c ? tzHHMM() >= c : false; }

    function minsLeft(c) {
      if (!c) return Infinity;
      const [ch, cm] = c.split(':').map(Number);
      const [nh, nm] = tzHHMM().split(':').map(Number);
      return (ch * 60 + cm) - (nh * 60 + nm);
    }

    function normalizeKey(raw) {
      if (!raw) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
        const [dd, mm, yyyy] = raw.split('-');
        return `${yyyy}-${mm}-${dd}`;
      }
      return raw;
    }

    function normalizeDateKeys(obj) {
      if (!obj) return {};
      const out = {};
      Object.entries(obj).forEach(([k, v]) => { out[normalizeKey(k) || k] = v; });
      return out;
    }

    function addDays(k, n) {
      if (!k) return null;
      const [y, m, d] = k.split('-').map(Number);
      const t = new Date(y, m - 1, d + n);
      return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    }

    /** 'YYYY-MM-DD' → 'DD-MM-YYYY' */
    function keyToDisplay(k) {
      if (!k) return null;
      const [y, m, d] = k.split('-');
      return `${d}-${m}-${y}`;
    }

    /* ── Override helper ── */

    function applyOverride(cfg, ov) {
      if (ov === false || ov === null)  return 'hidden';
      if (ov === 'force')               return 'available';
      if (ov === 'open')                { cfg.prevdayCutoff = null; return null; }
      if (typeof ov === 'string')       { cfg.samedayCutoff = ov; cfg.prevdayCutoff = null; return null; }
      if (typeof ov === 'object') {
        const hs = 'samedayCutoff' in ov, hp = 'prevdayCutoff' in ov;
        if ('hidden'      in ov) cfg.hidden      = ov.hidden;
        if ('unavailable' in ov) cfg.unavailable = ov.unavailable;
        if (hs) cfg.samedayCutoff = ov.samedayCutoff;
        if (hp) cfg.prevdayCutoff = ov.prevdayCutoff;
        else if (hs) cfg.prevdayCutoff = null;
        if ('showFrom'  in ov) cfg.showFrom  = ov.showFrom;
        if ('showUntil' in ov) cfg.showUntil = ov.showUntil;
        if (cfg.hidden)      return 'hidden';
        if (cfg.unavailable) return 'unavailable';
      }
      return null;
    }

    function resolveWDRule(dow, dowNm, slotId) {
      const entry = S.weekdayRules[dowNm]
                 || S.weekdayRules[dowNm.charAt(0).toUpperCase() + dowNm.slice(1)]
                 || S.weekdayRules[dow];
      if (!entry) return undefined;
      if (Array.isArray(entry)) return entry.includes(slotId) ? false : undefined;
      return slotId in entry ? entry[slotId] : undefined;
    }

    /* ── Status engine ──────────────────────────────────────────────────────
       PRECEDENCE: rules[] > blockSlotsByDate > weekdayRules > slot defaults

       1. cfg seeded from slot defaults
       2. blockSlotsByDate merges into cfg (or returns early)
       3. weekdayRules merges into cfg (skipped if date override exists)
       4. rules[] run LAST — see merged cfg, can override EVERYTHING
       5. Final time checks read from (possibly rule-modified) cfg

       NEW in v2.5: ctx includes `date` ('DD-MM-YYYY') alongside `dateKey`.
    ──────────────────────────────────────────────────────────────────────── */

    function computeStatus(slot, dk) {
      if (!dk) return 'hidden';

      const today = todayKey();
      const isTd  = dk === today;
      const isTmr = dk === addDays(today, 1);
      const dow   = getDOW(dk);
      const dowNm = DOW_NAMES[dow];
      const now   = tzHHMM();

      /* cfg — mutable effective config for this slot × date */
      const cfg = {
        hidden        : false,
        unavailable   : false,
        samedayCutoff : slot.samedayCutoff || null,
        prevdayCutoff : slot.prevdayCutoff || null,
        showFrom      : slot.showFrom      || null,
        showUntil     : slot.showUntil     || null,
        _forceOpen    : false,
      };

      /* Hard kills */
      if (!slot.open)                   return 'hidden';
      if (S.blockSlots.includes(slot.id)) return 'hidden';

      /* blockSlotsByDate (lower precedence than rules) */
      const dateOvr = (S.blockSlotsByDate[dk] || {})[slot.id];
      if (dateOvr !== undefined) {
        const r = applyOverride(cfg, dateOvr);
        if (r !== null) return r;
      }

      /* weekdayRules (only when no date override matched) */
      if (dateOvr === undefined) {
        const wdOvr = resolveWDRule(dow, dowNm, slot.id);
        if (wdOvr !== undefined) {
          const r = applyOverride(cfg, wdOvr);
          if (r !== null) return r;
        }
      }

      /* rules[] — LAST, highest precedence, sees merged cfg.
         ─────────────────────────────────────────────────────
         ctx.date    = 'DD-MM-YYYY'  ← NEW in v2.5
         ctx.dateKey = 'YYYY-MM-DD'  (unchanged)
         ─────────────────────────────────────────────────────
         IMPORTANT: if you set cfg.samedayCutoff in a rule for a slot that
         has prevdayCutoff by default, also set cfg.prevdayCutoff = null.
         Object overrides auto-clear it; rule callbacks do not.            */
      const ctx = {
        slot,
        date     : keyToDisplay(dk),   /* ← NEW: 'DD-MM-YYYY' e.g. '20-04-2026' */
        dateKey  : dk,                  /* unchanged: 'YYYY-MM-DD' */
        dow,
        dowName  : dowNm,
        isToday  : isTd,
        isTomorrow: isTmr,
        now,
        cfg,
      };

      for (const rule of S.rules) {
        try {
          const r = rule(ctx);
          if (r === false)    return 'hidden';
          if (cfg.hidden)     return 'hidden';
          if (cfg._forceOpen) return 'available';
          if (cfg.unavailable) return 'unavailable';
        } catch (e) {
          console.error('[AbTimeslot] rule error:', e);
        }
      }

      /* prevdayCutoff */
      if (cfg.prevdayCutoff) {
        const deadline = addDays(dk, -1);
        if (today >= dk)                                   return 'unavailable';
        if (today === deadline && isAfter(cfg.prevdayCutoff)) return 'unavailable';
      }

      /* showFrom / showUntil (today only) */
      if (isTd) {
        if (cfg.showFrom  && now < cfg.showFrom)   return 'hidden';
        if (cfg.showUntil && now >= cfg.showUntil) return 'hidden';
      }

      /* samedayCutoff (today only) */
      if (cfg.samedayCutoff && isTd) {
        if (isAfter(cfg.samedayCutoff))                        return 'unavailable';
        if (minsLeft(cfg.samedayCutoff) )  return 'closes_soon';
      }

      /* prevdayCutoff closes-soon (deadline = day before slot date) */
      if (cfg.prevdayCutoff) {
        const deadline = addDays(dk, -1);
        if (today === deadline && !isAfter(cfg.prevdayCutoff)) {
          if (minsLeft(cfg.prevdayCutoff) <= S.closesSoonMins) return 'closes_soon';
        }
      }

      return 'available';
    }

    function dateHasSlots(dk) {
      return S.slots.some(slot => {
        const s = computeStatus(slot, dk);
        return s === 'available' || s === 'closes_soon';
      });
    }

    /* ── Auto-refresh timer ─────────────────────────────────────────────────
       Re-renders every 30 s when showing today or tomorrow so badges and
       unavailable states update without a page reload.
    ──────────────────────────────────────────────────────────────────────── */

    function startRefreshTimer() {
      stopRefreshTimer();
      if (!S.currentDateKey || S.slots.length === 0) return;
      const today    = todayKey();
      const tomorrow = addDays(today, 1);
      if (S.currentDateKey !== today && S.currentDateKey !== tomorrow) return;
      S._refreshTimer = setInterval(() => render(), 30000);
    }

    function stopRefreshTimer() {
      if (S._refreshTimer) { clearInterval(S._refreshTimer); S._refreshTimer = null; }
    }

    /* ── Render ─────────────────────────────────────────────────────────────
       Uses DocumentFragment — all slot chips inserted in one DOM mutation.
       Closes-soon badge appears only on the first bookable slot.
       Auto-selects first bookable slot when nothing is selected.
    ──────────────────────────────────────────────────────────────────────── */

    function render() {
      containerEl.innerHTML = '';
      containerEl.className = 'ab-ts-grid';
      if (!S.currentDateKey) return;

      /* Pre-compute all statuses once */
      const computed = S.slots.map(slot => ({ slot, status: computeStatus(slot, S.currentDateKey) }));

      /* Find first bookable slot ID (for the "Closes Soon" badge).
         Only relevant when the current date is today or tomorrow — on any other
         date the badge would never show, so skip the scan entirely.           */
      const today    = todayKey();
      const tomorrow = addDays(today, 1);
      let   badgeSlotId = null;

      if (S.currentDateKey === today || S.currentDateKey === tomorrow) {
        const first = computed.find(({ status }) => status === 'available' || status === 'closes_soon');
        if (first) badgeSlotId = first.slot.id;
      }

      /* Build chips into a fragment */
      const frag = document.createDocumentFragment();
      let clickable = 0, firstSlot = null, firstChip = null;

      computed.forEach(({ slot, status }) => {
        if (status === 'hidden') return;

        const showBadge = status === 'closes_soon' && slot.id === badgeSlotId;

        const chip = document.createElement('div');
        chip.className      = 'ab-ts-chip';
        chip.dataset.slotId = slot.id;
        chip.dataset.status = status;

        chip.innerHTML = `
          ${showBadge ? '<span class="ab-ts-badge">Closes Soon</span>' : ''}
          <span class="ab-ts-label">${slot.label}</span>
          ${status === 'unavailable'
            ? '<span class="ab-ts-unavail">Unavailable</span>'
            : `<span class="ab-ts-time">${slot.timeRange}</span>`}
        `;

        if (status === 'unavailable') chip.classList.add('ab-ts-dis');

        if (slot.id === S.selectedSlotId && status !== 'unavailable') {
          chip.classList.add('ab-ts-sel');
        }

        if (status !== 'unavailable') {
          clickable++;
          if (!firstSlot) { firstSlot = slot; firstChip = chip; }
          chip.addEventListener('click', () => {
            S.selectedSlotId = slot.id;
            containerEl.querySelectorAll('.ab-ts-chip').forEach(c => c.classList.remove('ab-ts-sel'));
            chip.classList.add('ab-ts-sel');
            if (S.onChange) S.onChange({ dateKey: S.currentDateKey, slot, status });
          });
        }

        frag.appendChild(chip);
      });

      if (clickable === 0) {
        /* No slots — show empty state (fragment discarded cleanly) */
        containerEl.classList.add('ab-ts-empty');
        const msg = document.createElement('div');
        msg.className   = 'ab-ts-no-slots';
        msg.textContent = S.noSlotsText;
        containerEl.appendChild(msg);
        S.selectedSlotId = null;
      } else {
        containerEl.classList.remove('ab-ts-empty');
        containerEl.appendChild(frag);   /* single DOM mutation */

        /* Auto-select first bookable slot when nothing is selected */
        if (!S.selectedSlotId && firstSlot && firstChip) {
          S.selectedSlotId = firstSlot.id;
          firstChip.classList.add('ab-ts-sel');
          if (S.onChange) {
            const cap = { slot: firstSlot, status: firstChip.dataset.status, key: S.currentDateKey };
            setTimeout(() => S.onChange({ dateKey: cap.key, slot: cap.slot, status: cap.status }), 0);
          }
        }
      }

      startRefreshTimer();
      if (S._onRender) setTimeout(() => S._onRender(clickable > 0), 0);
    }

    /* ── Public API ── */

    return {
      /**
       * Render slots for a date. Accepts 'YYYY-MM-DD' or 'DD-MM-YYYY'.
       * Wire to AbDatepicker onChange: ts.setDate(val.dateKey)
       */
      setDate(raw) {
        const k = normalizeKey(raw);
        if (!k) return;
        S.currentDateKey = k;
        S.selectedSlotId = null;
        render();
        /* Note: startRefreshTimer() is called inside render() */
      },

      /** Returns { dateKey, slot } or null. */
      getSelected() {
        if (!S.selectedSlotId || !S.currentDateKey) return null;
        const slot = S.slots.find(s => s.id === S.selectedSlotId);
        return slot ? { dateKey: S.currentDateKey, slot } : null;
      },

      clearSelection() {
        S.selectedSlotId = null;
        containerEl.querySelectorAll('.ab-ts-chip').forEach(c => c.classList.remove('ab-ts-sel'));
      },

      refresh() { render(); },

      hasAvailableSlots(raw) { return dateHasSlots(normalizeKey(raw)); },

      /* slots */
      setSlots(arr)          { S.slots = arr || []; S.selectedSlotId = null; render(); },
      patchSlot(id, patch)   { const s = S.slots.find(x => x.id === id); if (s) Object.assign(s, patch); render(); },

      /* blockSlots */
      setBlockSlots(arr)     { S.blockSlots = arr || []; render(); },
      addBlockSlots(...ids)  { ids.flat().forEach(id => { if (!S.blockSlots.includes(id)) S.blockSlots.push(id); }); render(); },
      removeBlockSlots(...ids) { ids.flat().forEach(id => { S.blockSlots = S.blockSlots.filter(x => x !== id); }); render(); },

      /* blockSlotsByDate */
      setBlockSlotsByDate(obj) { S.blockSlotsByDate = normalizeDateKeys(obj); render(); },
      addBlockSlotsByDate(obj) {
        const norm = normalizeDateKeys(obj);
        Object.entries(norm).forEach(([date, ovr]) => {
          /* Deep-merge per-slot overrides, not shallow Object.assign */
          if (!S.blockSlotsByDate[date]) {
            S.blockSlotsByDate[date] = ovr;
          } else {
            Object.assign(S.blockSlotsByDate[date], ovr);
          }
        });
        render();
      },

      /* weekdayRules */
      setWeekdayRules(obj) { S.weekdayRules = obj || {}; render(); },
      addWeekdayRules(obj) {
        Object.entries(obj || {}).forEach(([dow, r]) => {
          S.weekdayRules[dow] = Object.assign(S.weekdayRules[dow] || {}, r);
        });
        render();
      },

      /* rules */
      setRules(arr) { S.rules = arr || []; render(); },
      addRule(fn)   { S.rules.push(fn); render(); },

      /**
       * linkDatepicker(pickerInstance, options?)
       * Wires slot availability into the datepicker disabled logic.
       * options.slotDependency  — also accepted on AbDatepicker.init()
       * options.lookAheadDays   — how many days to scan (default 60)
       */
      linkDatepicker(picker, options) {
        const enabled =
          (options && options.slotDependency != null ? options.slotDependency : false) ||
          (picker && picker._slotDependency);
        if (!enabled) return;

        const lookAhead = (options && options.lookAheadDays) || 60;

        if (typeof picker._injectBeforeShowDay === 'function') {
          picker._injectBeforeShowDay(dateObj => dateHasSlots(dateObj.dateKey));
        }

        function findNext() {
          const t = todayKey();
          for (let i = 0; i <= lookAhead; i++) {
            const c = addDays(t, i);
            if (dateHasSlots(c)) return c;
          }
          return null;
        }

        S._onRender = (hasSlots) => {
          if (hasSlots || S._advancing) return;
          const next = findNext();
          if (!next) return;
          S._advancing = true;
          if (typeof picker._selectDate === 'function') picker._selectDate(next);
          setTimeout(() => { S._advancing = false; }, 0);
        };

        /* Boot check — fire if today has no slots */
        setTimeout(() => {
          if (S._onRender) S._onRender(S.currentDateKey ? dateHasSlots(S.currentDateKey) : false);
        }, 0);
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EXPORTS
  ═══════════════════════════════════════════════════════════════════════ */

  global.AbDatepicker = { init: createDatepickerInstance };
  global.AbTimeslot   = { init: createTimeslotInstance };

}(window));