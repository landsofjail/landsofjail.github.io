/* =========================================================
   ENEMY COUNTER ANALYZER — UI CONTROLLER
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

  if (typeof window.changeLanguage === 'function' && !window.__ccWrappedChangeLanguage) {
    const originalChangeLanguage = window.changeLanguage;
    window.changeLanguage = function (lang) {
      originalChangeLanguage(lang);
      currentLang = lang;
      refreshSlotLabels();
      if (lastResult) renderResults(lastResult);
    };
    window.__ccWrappedChangeLanguage = true;
  }

  // ---------------- STATE ----------------
  const state = {
    enemyMode: null,
    enemyHero: { Shield: null, Bomber: null, Shooter: null },
    enemyRobot: null,
    myMode: null,
  };
  let lastResult = null;

  // ---------------- STEP CHOICE GRIDS (mode buttons) ----------------
  function wireModeGrid(gridId, onPick) {
    const grid = document.getElementById(gridId);
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.tc-choice');
      if (!btn) return;
      grid.querySelectorAll('.tc-choice').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(btn.getAttribute('data-mode'));
    });
  }
  wireModeGrid('cc-enemy-mode-grid', (mode) => { state.enemyMode = mode; refreshCalcState(); });
  wireModeGrid('cc-my-mode-grid', (mode) => { state.myMode = mode; refreshCalcState(); });

  // ---------------- PICKER MODAL ----------------
  const picker = document.getElementById('ccPicker');
  const pickerTitle = document.getElementById('ccPickerTitle');
  const pickerList = document.getElementById('ccPickerList');
  const pickerClose = document.getElementById('ccPickerClose');
  let activeSlotEl = null;
  let activeCls = null;

  function openPicker(cls, slotEl) {
    activeCls = cls;
    activeSlotEl = slotEl;
    pickerTitle.textContent = cls === 'Robot'
      ? tKey('cc_picker_title_robot', 'Select Power Armor')
      : tKey('cc_picker_title_hero', 'Select Hero');

    const items = cls === 'Robot' ? TC_ROBOTS : TC_HEROES.filter(h => h.cls === cls);
    pickerList.innerHTML = items.map(item => `
      <button type="button" class="cc-picker-item" data-name="${item.name}">
        <span class="tc-avatar tc-avatar-picker"><img src="${item.img}" alt="${item.name}" loading="lazy"></span>
        <span>${item.name}</span>
      </button>
    `).join('');

    picker.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePicker() {
    picker.classList.add('hidden');
    document.body.style.overflow = '';
    activeSlotEl = null;
    activeCls = null;
  }

  pickerClose.addEventListener('click', closePicker);
  picker.querySelector('.cc-picker-backdrop').addEventListener('click', closePicker);

  pickerList.addEventListener('click', (e) => {
    const item = e.target.closest('.cc-picker-item');
    if (!item) return;
    const name = item.getAttribute('data-name');
    fillSlot(activeCls, activeSlotEl, name);
    closePicker();
  });

  function fillSlot(cls, slotEl, name) {
    if (cls === 'Robot') {
      state.enemyRobot = name;
      const r = TC_ROBOTS.find(x => x.name === name);
      slotEl.innerHTML = `
        <span class="tc-avatar tc-avatar-sm"><img src="${r.img}" alt="${r.name}"></span>
        <span class="cc-slot-name">${r.name}</span>`;
    } else {
      state.enemyHero[cls] = name;
      const h = TC_HEROES.find(x => x.name === name);
      const roleLabelKey = { Shield: 'tc_legend_shield', Bomber: 'tc_legend_bomber', Shooter: 'tc_legend_shooter' }[cls];
      slotEl.innerHTML = `
        <span class="cc-slot-role">${tKey(roleLabelKey, cls)}</span>
        <span class="tc-avatar tc-avatar-sm"><img src="${h.img}" alt="${h.name}"></span>
        <span class="cc-slot-name">${h.name}</span>`;
    }
    slotEl.classList.add('filled');
    refreshCalcState();
  }

  function refreshSlotLabels() {
    // Re-apply translated role captions on filled hero slots after a language switch.
    ['Shield', 'Bomber', 'Shooter'].forEach(cls => {
      const name = state.enemyHero[cls];
      if (!name) return;
      const slotEl = document.getElementById('cc-slot-' + cls.toLowerCase());
      fillSlot(cls, slotEl, name);
    });
  }

  ['shield', 'bomber', 'shooter', 'robot'].forEach(key => {
    const el = document.getElementById('cc-slot-' + key);
    el.addEventListener('click', () => openPicker(el.getAttribute('data-cls'), el));
  });

  // ---------------- CALC BUTTON ----------------
  const calcBtn = document.getElementById('cc-calc-btn');
  const hint = document.getElementById('cc-hint');
  const results = document.getElementById('cc-results');

  function refreshCalcState() {
    const ready = state.enemyMode && state.enemyHero.Shield && state.enemyHero.Bomber &&
      state.enemyHero.Shooter && state.enemyRobot && state.myMode;
    calcBtn.disabled = !ready;
    hint.style.display = ready ? 'none' : 'block';
  }

  calcBtn.addEventListener('click', () => {
    lastResult = ccCalculate(
      state.enemyMode, state.enemyHero.Shield, state.enemyHero.Bomber, state.enemyHero.Shooter,
      state.enemyRobot, state.myMode
    );
    renderResults(lastResult);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------------- RENDER ----------------
  const STAT_LABEL_KEY = { ATK: 'tc_stat_atk', DEF: 'tc_stat_def', HP: 'tc_stat_hp', Lethality: 'tc_stat_lethality' };
  const TRIGGER_LABEL_KEY = {
    solo_attack: 'tc_trigger_solo_attack', rally_attack: 'tc_trigger_rally_attack', defending: 'tc_trigger_defending',
  };
  const CLASS_LABEL_KEY = { Shield: 'tc_legend_shield', Bomber: 'tc_legend_bomber', Shooter: 'tc_legend_shooter' };
  const MODE_LABEL_KEY = {
    solo_attack: 'tc_mode_solo_attack', solo_defense: 'tc_mode_solo_defense',
    rally_attack: 'tc_mode_rally_attack', rally_defense: 'tc_mode_rally_defense',
  };
  const PROFILE_LABEL_KEY = {
    heavy_shooter: 'tc_profile_heavy_shooter', heavy_shield: 'tc_profile_heavy_shield',
    high_lethality: 'tc_profile_high_lethality', high_atk: 'tc_profile_high_atk', balanced: 'tc_profile_balanced',
  };

  function analysisCardHTML(result) {
    const a = result.enemyAnalysis;
    const modeLabel = tKey(MODE_LABEL_KEY[result.enemyMode], result.enemyMode);
    const profileLabel = tKey(PROFILE_LABEL_KEY[a.profileKey], a.profileKey);
    const statLabel = tKey(STAT_LABEL_KEY[a.dominantStat], a.dominantStat);
    const carryRoleLabel = tKey(CLASS_LABEL_KEY[a.carryClass], a.carryClass);
    const template = tKey('cc_analysis_template',
      'Reported as {mode}, this build carries its offense through {carryRole} {carryName} and leans hardest on {stat} (offense score {off} vs defense score {def}) — the engine reads it as a {profile}-style threat.');
    const text = template
      .replace('{mode}', modeLabel).replace('{carryRole}', carryRoleLabel)
      .replace('{carryName}', a.carryHero.name).replace('{stat}', statLabel)
      .replace('{off}', a.totalOff).replace('{def}', a.totalDef).replace('{profile}', profileLabel);

    return `
      <div class="cc-analysis-head">
        <span class="tc-avatar tc-avatar-md"><img src="${a.carryHero.img}" alt="${a.carryHero.name}"></span>
        <div>
          <span class="cc-analysis-label">${tKey('cc_analysis_label', 'Threat Analysis')}</span>
          <p class="cc-analysis-text">${text}</p>
        </div>
      </div>`;
  }

  function heroCardHTML(role, pick) {
    const h = pick.hero;
    const roleLabel = tKey(CLASS_LABEL_KEY[role], role);
    const statLabel = h.eqStat ? tKey(STAT_LABEL_KEY[h.eqStat], h.eqStat) : '';
    const badge = pick.hasEquip
      ? `<span class="tc-badge tc-badge-on">✓ +${h.eqValue}% ${statLabel}</span>`
      : `<span class="tc-badge tc-badge-off">${tKey('tc_no_equip_match', 'No equipment match — best mechanical fit')}</span>`;
    const trigLabel = h.eqTrigger ? tKey(TRIGGER_LABEL_KEY[h.eqTrigger], h.eqTrigger) : '';
    return `
      <div class="tc-hero-card">
        <span class="tc-avatar tc-avatar-lg"><img src="${h.img}" alt="${h.name}" loading="lazy"></span>
        <div class="tc-hero-card-body">
          <div class="tc-hero-card-head">
            <span class="tc-hero-role">${roleLabel}</span>
            <span class="tc-hero-name">${h.name}</span>
          </div>
          ${badge}
          ${pick.hasEquip ? `<p class="tc-hero-eq-name">${h.eqName} <em>(${trigLabel})</em></p>` : ''}
          <div class="tc-hero-scores">
            <span>${tKey('tc_offense_score', 'Offense')}: <b>${h.off}</b></span>
            <span>${tKey('tc_defense_score', 'Defense')}: <b>${h.def}</b></span>
          </div>
        </div>
      </div>`;
  }

  function robotCardHTML(robot) {
    return `
      <div class="tc-robot-card">
        <span class="tc-avatar tc-avatar-lg"><img src="${robot.img}" alt="${robot.name}"></span>
        <div class="tc-robot-card-body">
          <span class="tc-robot-label">${tKey('cc_counter_robot_label', 'Counter Power Armor')}</span>
          <span class="tc-robot-name">${robot.name}</span>
          <p class="tc-robot-note">${tKey(robot.noteKey, robot.note)}</p>
        </div>
      </div>`;
  }

  function buildReason(result) {
    const c = result.counter, a = result.enemyAnalysis;
    const statLabel = tKey(STAT_LABEL_KEY[a.dominantStat], a.dominantStat);
    const [sPct, bPct, hPct] = c.ratio;
    const template = tKey('cc_reason_template',
      "{shield}, {bomber}, and {shooter} were chosen for their combined stat weight against the enemy's {stat} focus, while the {ratio} Shield/Bomber/Shooter split and {robot} keep the classic Shield → Bomber → Shooter → Shield cycle working in your favor against {enemyCarry}'s lineup.");
    return template
      .replace('{shield}', c.picks.shield.hero.name)
      .replace('{bomber}', c.picks.bomber.hero.name)
      .replace('{shooter}', c.picks.shooter.hero.name)
      .replace('{stat}', statLabel)
      .replace('{ratio}', `${sPct}/${bPct}/${hPct}`)
      .replace('{robot}', c.robot.name)
      .replace('{enemyCarry}', a.carryHero.name);
  }

  function summaryHTML(counter) {
    const template = tKey('tc_summary_template',
      '{count} of 3 heroes trigger their Exclusive Equipment in this mode, for a combined +{buff}% baseline stat boost before skills are even calculated.');
    return template.replace('{count}', counter.equippedCount).replace('{buff}', counter.totalBuff);
  }

  function renderResults(result) {
    document.getElementById('cc-analysis-card').innerHTML = analysisCardHTML(result);

    const [sPct, bPct, hPct] = result.counter.ratio;
    document.getElementById('tc-seg-shield').style.width = sPct + '%';
    document.getElementById('tc-seg-bomber').style.width = bPct + '%';
    document.getElementById('tc-seg-shooter').style.width = hPct + '%';
    document.getElementById('tc-ratio-shield-pct').textContent = sPct + '%';
    document.getElementById('tc-ratio-bomber-pct').textContent = bPct + '%';
    document.getElementById('tc-ratio-shooter-pct').textContent = hPct + '%';

    document.getElementById('cc-hero-cards').innerHTML =
      `<div class="tc-hero-cards">` +
      heroCardHTML('Shield', result.counter.picks.shield) +
      heroCardHTML('Bomber', result.counter.picks.bomber) +
      heroCardHTML('Shooter', result.counter.picks.shooter) +
      `</div>`;

    document.getElementById('cc-robot-card').innerHTML = robotCardHTML(result.counter.robot);
    document.getElementById('cc-joiners').innerHTML =
      tcJoinersBlockHTML(result.myMode, result.enemyAnalysis.profileKey, 'primary', tKey);
    document.getElementById('cc-summary').textContent = summaryHTML(result.counter);
    document.getElementById('cc-reason').textContent = buildReason(result);
  }
})();
