/* =========================================================
   ARENA COUNTER ANALYZER — UI CONTROLLER
   ========================================================= */

(function () {
  let currentLang = localStorage.getItem('selectedLanguage') || document.documentElement.lang || 'en';

  function tKey(key, fallback) {
    try {
      if (typeof translations !== 'undefined') {
        const byLang = translations[currentLang];
        if (byLang && byLang[key] !== undefined) return byLang[key];
        if (translations.en && translations.en[key] !== undefined) return translations.en[key];
      }
    } catch (e) { /* noop */ }
    return fallback;
  }

  if (typeof window.changeLanguage === 'function' && !window.__aaWrappedChangeLanguage) {
    const originalChangeLanguage = window.changeLanguage;
    window.changeLanguage = function (lang) {
      originalChangeLanguage(lang);
      currentLang = lang;
      refreshAllSlotLabels();
      if (lastResult) renderResults(lastResult);
    };
    window.__aaWrappedChangeLanguage = true;
  }

  const CLASS_LABEL_KEY = { Shield: 'tc_legend_shield', Bomber: 'tc_legend_bomber', Shooter: 'tc_legend_shooter' };

  // ---------------- STATE ----------------
  // slotId -> hero/robot name
  const state = {};
  let lastResult = null;

  const heroSlotIds = ['enemy-h-0', 'enemy-h-1', 'enemy-h-2', 'enemy-h-3', 'enemy-h-4'];
  const robotSlotIds = ['enemy-r-0', 'enemy-r-1'];

  // ---------------- PICKER MODAL ----------------
  const picker = document.getElementById('ccPicker');
  const pickerTitle = document.getElementById('ccPickerTitle');
  const pickerList = document.getElementById('ccPickerList');
  const pickerClose = document.getElementById('ccPickerClose');
  let activeSlotEl = null;
  let activeKind = null;

  function openPicker(kind, slotEl) {
    activeKind = kind;
    activeSlotEl = slotEl;
    pickerTitle.textContent = kind === 'robot'
      ? tKey('cc_picker_title_robot', 'Select Power Armor')
      : tKey('cc_picker_title_hero', 'Select Hero');

    // Exclude names already chosen in OTHER slots of the same kind — one
    // Hero or Power Armor can only be used once across the whole lineup.
    const relevantIds = kind === 'robot' ? robotSlotIds : heroSlotIds;
    const currentSlotId = slotEl.getAttribute('data-slot');
    const usedElsewhere = new Set(
      relevantIds
        .filter(id => id !== currentSlotId)
        .map(id => state[id])
        .filter(Boolean)
    );

    const items = kind === 'robot' ? TC_ARENA_ROBOTS : TC_ARENA_HEROES;
    pickerList.innerHTML = items.map(item => {
      const disabled = usedElsewhere.has(item.name);
      return `
      <button type="button" class="cc-picker-item${disabled ? ' cc-picker-item-disabled' : ''}" data-name="${item.name}" ${disabled ? 'disabled' : ''}>
        <span class="tc-avatar tc-avatar-picker"><img src="${item.img}" alt="${item.name}" loading="lazy"></span>
        <span>${item.name}</span>
      </button>`;
    }).join('');

    picker.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePicker() {
    picker.classList.add('hidden');
    document.body.style.overflow = '';
    activeSlotEl = null;
    activeKind = null;
  }

  pickerClose.addEventListener('click', closePicker);
  picker.querySelector('.cc-picker-backdrop').addEventListener('click', closePicker);

  pickerList.addEventListener('click', (e) => {
    const item = e.target.closest('.cc-picker-item');
    if (!item) return;
    const name = item.getAttribute('data-name');
    const slotId = activeSlotEl.getAttribute('data-slot');
    state[slotId] = name;
    fillSlot(activeSlotEl, activeKind, name);
    closePicker();
    refreshCalcState();
  });

  function fillSlot(slotEl, kind, name) {
    if (kind === 'robot') {
      const r = TC_ARENA_ROBOTS.find(x => x.name === name);
      slotEl.innerHTML = `
        <span class="tc-avatar tc-avatar-sm"><img src="${r.img}" alt="${r.name}"></span>
        <span class="cc-slot-name">${r.name}</span>`;
    } else {
      const h = TC_ARENA_HEROES.find(x => x.name === name);
      slotEl.innerHTML = `
        <span class="cc-slot-role">${tKey(CLASS_LABEL_KEY[h.cls], h.cls)}</span>
        <span class="tc-avatar tc-avatar-sm"><img src="${h.img}" alt="${h.name}"></span>
        <span class="cc-slot-name">${h.name}</span>`;
    }
    slotEl.classList.add('filled');
  }

  function refreshAllSlotLabels() {
    document.querySelectorAll('.aa-slot[data-slot]').forEach(slotEl => {
      const slotId = slotEl.getAttribute('data-slot');
      const name = state[slotId];
      if (!name) return;
      const kind = slotEl.getAttribute('data-picker');
      fillSlot(slotEl, kind, name);
    });
  }

  document.querySelectorAll('.aa-slot[data-slot]').forEach(el => {
    el.addEventListener('click', () => openPicker(el.getAttribute('data-picker'), el));
  });

  // ---------------- CALC ----------------
  const calcBtn = document.getElementById('aa-calc-btn');
  const hint = document.getElementById('aa-hint');
  const results = document.getElementById('aa-results');

  function refreshCalcState() {
    const ready = heroSlotIds.every(id => state[id]) && robotSlotIds.every(id => state[id]);
    calcBtn.disabled = !ready;
    hint.style.display = ready ? 'none' : 'block';
  }

  calcBtn.addEventListener('click', () => {
    const heroNames = heroSlotIds.map(id => state[id]);
    const robotNames = robotSlotIds.map(id => state[id]);
    lastResult = aaCalculate(heroNames, robotNames);
    renderResults(lastResult);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------------- RENDER ----------------
  function heroResultCardHTML(h) {
    const roleLabel = tKey(CLASS_LABEL_KEY[h.cls], h.cls);
    return `
      <div class="aa-result-card">
        <span class="aa-result-role">${roleLabel}</span>
        <span class="tc-avatar tc-avatar-sm"><img src="${h.img}" alt="${h.name}" loading="lazy"></span>
        <span class="aa-result-name">${h.name}</span>
      </div>`;
  }

  function robotResultCardHTML(r) {
    return `
      <div class="aa-result-card aa-result-robot">
        <span class="tc-avatar tc-avatar-sm"><img src="${r.img}" alt="${r.name}"></span>
        <span class="aa-result-name">${r.name}</span>
      </div>`;
  }

  function analysisCardHTML(result) {
    const a = result.enemyAnalysis;
    const classLabel = tKey(CLASS_LABEL_KEY[a.dominantClass], a.dominantClass);
    const simpleOff = Math.round(a.totalOff / 100);
    const simpleDef = Math.round(a.totalDef / 100);
    const template = tKey('aa_analysis_template',
      "This Arena lineup leans hardest on <strong>{class}</strong> troops (offense score {off} vs defense score {def}), with <strong>{carry}</strong> carrying the biggest individual Arrest threat — also watch for <strong>{secondary}</strong>.");
    const text = template
      .replace('{class}', classLabel)
      .replace('{off}', simpleOff)
      .replace('{def}', simpleDef)
      .replace('{carry}', a.carryHero ? a.carryHero.name : '-')
      .replace('{secondary}', a.secondaryThreat ? a.secondaryThreat.name : (a.carryHero ? a.carryHero.name : '-'));
    return `
      <div class="cc-analysis-head">
        <span class="tc-avatar tc-avatar-md"><img src="${a.carryHero.img}" alt="${a.carryHero.name}"></span>
        <div>
          <span class="cc-analysis-label">${tKey('cc_analysis_label', 'Threat Analysis')}</span>
          <p class="cc-analysis-text">${text}</p>
        </div>
      </div>`;
  }

  function buildReason(result) {
    const enemyClassLabel = tKey(CLASS_LABEL_KEY[result.enemyAnalysis.dominantClass], result.enemyAnalysis.dominantClass);
    const counterClassLabel = tKey(CLASS_LABEL_KEY[result.counter.counterClass], result.counter.counterClass);
    const namesStr = result.counter.picks.map(h => h.name).join(', ');
    const shieldPick = result.counter.picks.find(h => h.cls === 'Shield');
    const counterCount = result.counter.picks.filter(h => h.cls === result.counter.counterClass).length;
    const robotNamesStr = result.counter.robotPicks.map(r => r.name).join(' & ');

    const template = tKey('aa_reason_template',
      "Because the enemy leans on {enemyClass}, this lineup ({names}) puts {counterCount} of its 5 Heroes into {counterClass} — enough to exploit the Shield → Bomber → Shooter → Shield priority cycle where {counterClass} instinctively strikes {enemyClass} first, without going all-in on a single class. {shieldName} stays in the back line purely for damage mitigation, since no real Arena team survives a 5-round fight without at least one Hero soaking hits. {robotNames} were picked to counter the enemy's Power Armor tendency directly, rounding out a team that can both punish the enemy's weak class and hold the line against their strongest one.");

    return template
      .replace(/\{enemyClass\}/g, enemyClassLabel)
      .replace(/\{counterClass\}/g, counterClassLabel)
      .replace('{names}', namesStr)
      .replace('{counterCount}', counterCount)
      .replace('{shieldName}', shieldPick ? shieldPick.name : counterClassLabel)
      .replace('{robotNames}', robotNamesStr);
  }

  function renderResults(result) {
    document.getElementById('aa-analysis-card').innerHTML = analysisCardHTML(result);

    const grid = document.getElementById('aa-counter-grid');
    const p = result.counter.picks;
    const rp = result.counter.robotPicks;
    grid.innerHTML = `
      <div class="aa-row aa-row-heroes-2">${heroResultCardHTML(p[0])}${heroResultCardHTML(p[1])}</div>
      <div class="aa-row aa-row-robots-2">${robotResultCardHTML(rp[0])}${robotResultCardHTML(rp[1])}</div>
      <div class="aa-row aa-row-heroes-3">${heroResultCardHTML(p[2])}${heroResultCardHTML(p[3])}${heroResultCardHTML(p[4])}</div>
    `;

    document.getElementById('aa-reason').textContent = buildReason(result);
    document.getElementById('aa-priority-note').textContent = tKey('aa_priority_note',
      "Priority-targeting reminder: Shield troops soak hits while dealing modest damage back, and are the first target for Shooters; Bombers move first against the Shooters they counter; Shooters move first against the Bombers they counter. Positioning your counter-class heroes up front lets this natural targeting order work in your favor.");
  }
})();
