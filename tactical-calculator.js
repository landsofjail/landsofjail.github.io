/* =========================================================
   TACTICAL FORMATION & COUNTER CALCULATOR — UI CONTROLLER
   ========================================================= */

(function () {
  let selectedMode = null;
  let selectedProfile = null;
  let lastResult = null;
  let currentLang = localStorage.getItem('selectedLanguage') || document.documentElement.lang || 'en';

  // The site's lang.js declares `const translations` and `function changeLanguage`
  // as classic top-level script bindings — they exist as bare globals, but NOT as
  // window.* properties, so we reference them directly (with safe existence checks).
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

  // Hook into the site's changeLanguage() so our dynamically-built result
  // panel (which isn't scanned by the site's own data-i18n walker, since it
  // doesn't exist yet at page-load time) re-renders in the new language too.
  if (typeof window.changeLanguage === 'function' && !window.__tcWrappedChangeLanguage) {
    const originalChangeLanguage = window.changeLanguage;
    window.changeLanguage = function (lang) {
      originalChangeLanguage(lang);
      currentLang = lang;
      if (lastResult) renderResults(lastResult);
    };
    window.__tcWrappedChangeLanguage = true;
  }

  const modeGrid = document.getElementById('tc-mode-grid');
  const profileGrid = document.getElementById('tc-profile-grid');
  const calcBtn = document.getElementById('tc-calc-btn');
  const hint = document.getElementById('tc-hint');
  const results = document.getElementById('tc-results');

  function selectOne(grid, btn, dataAttr) {
    grid.querySelectorAll('.tc-choice').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    return btn.getAttribute(dataAttr);
  }

  modeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tc-choice');
    if (!btn) return;
    selectedMode = selectOne(modeGrid, btn, 'data-mode');
    refreshCalcState();
  });

  profileGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tc-choice');
    if (!btn) return;
    selectedProfile = selectOne(profileGrid, btn, 'data-profile');
    refreshCalcState();
  });

  function refreshCalcState() {
    const ready = selectedMode && selectedProfile;
    calcBtn.disabled = !ready;
    hint.style.display = ready ? 'none' : 'block';
  }

  calcBtn.addEventListener('click', () => {
    lastResult = tcCalculate(selectedMode, selectedProfile);
    renderResults(lastResult);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const CLASS_LABEL_KEY = { Shield: 'tc_legend_shield', Bomber: 'tc_legend_bomber', Shooter: 'tc_legend_shooter' };
  const STAT_LABEL_KEY = { ATK: 'tc_stat_atk', DEF: 'tc_stat_def', HP: 'tc_stat_hp', Lethality: 'tc_stat_lethality' };
  const TRIGGER_LABEL_KEY = {
    solo_attack: 'tc_trigger_solo_attack',
    rally_attack: 'tc_trigger_rally_attack',
    defending: 'tc_trigger_defending',
  };
  const MODE_LABEL_KEY = {
    solo_attack: 'tc_mode_solo_attack', solo_defense: 'tc_mode_solo_defense',
    rally_attack: 'tc_mode_rally_attack', rally_defense: 'tc_mode_rally_defense',
  };
  const PROFILE_LABEL_KEY = {
    heavy_shooter: 'tc_profile_heavy_shooter', heavy_shield: 'tc_profile_heavy_shield',
    high_lethality: 'tc_profile_high_lethality', high_atk: 'tc_profile_high_atk',
    balanced: 'tc_profile_balanced',
  };

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
      <span class="tc-avatar tc-avatar-lg"><img src="${robot.img}" alt="${robot.name}" loading="lazy"></span>
      <div class="tc-robot-card-body">
        <span class="tc-robot-label">${tKey('tc_robot_pick', 'Recommended Power Armor')}</span>
        <span class="tc-robot-name">${robot.name}</span>
        <p class="tc-robot-note">${tKey(robot.noteKey, robot.note)}</p>
      </div>`;
  }

  function buildReason(result, formation, isAlternate) {
    const modeLabel = tKey(MODE_LABEL_KEY[result.mode], result.mode);
    const profileLabel = tKey(PROFILE_LABEL_KEY[result.enemyProfileKey], result.enemyProfileKey);
    const focusLabel = result.isAttack
      ? tKey('tc_focus_offense', 'Offense (ATK & Lethality)')
      : tKey('tc_focus_defense', 'Defense (DEF & HP)');
    const [sPct, bPct, hPct] = result.ratio;
    const ratioStr = `${sPct}/${bPct}/${hPct}`;
    const template = isAlternate
      ? tKey('tc_alt_reason_template',
          'This alternate lineup swaps in {shield}, {bomber}, and {shooter} for a different stat spread while keeping the same {ratio} Shield/Bomber/Shooter split — a solid backup if your primary picks are locked, injured, or already deployed elsewhere.')
      : tKey('tc_reason_template',
          'This lineup prioritizes {focus} to match {mode}, and leans into a {ratio} Shield/Bomber/Shooter split to counter a {profile} enemy, following the classic Shield → Bomber → Shooter → Shield matchup cycle.');
    return template
      .replace('{focus}', focusLabel)
      .replace('{mode}', modeLabel)
      .replace('{profile}', profileLabel)
      .replace('{ratio}', ratioStr)
      .replace('{shield}', formation.picks.shield.hero.name)
      .replace('{bomber}', formation.picks.bomber.hero.name)
      .replace('{shooter}', formation.picks.shooter.hero.name);
  }

  function summaryHTML(formation) {
    const template = tKey('tc_summary_template',
      '{count} of 3 heroes trigger their Exclusive Equipment in this mode, for a combined +{buff}% baseline stat boost before skills are even calculated.');
    return template.replace('{count}', formation.equippedCount).replace('{buff}', formation.totalBuff);
  }

  function formationBlockHTML(result, formation, isAlternate) {
    const variant = isAlternate ? 'alternate' : 'primary';
    const joinersHTML = tcJoinersBlockHTML(result.mode, result.enemyProfileKey, variant, tKey);
    return `
      <div class="tc-hero-cards">
        ${heroCardHTML('Shield', formation.picks.shield)}
        ${heroCardHTML('Bomber', formation.picks.bomber)}
        ${heroCardHTML('Shooter', formation.picks.shooter)}
      </div>
      <div class="tc-robot-card">
        ${robotCardHTML(formation.robot)}
      </div>
      ${joinersHTML}
      <p class="tc-summary">${summaryHTML(formation)}</p>
      <p class="tc-reason">${buildReason(result, formation, isAlternate)}</p>
    `;
  }

  function renderResults(result) {
    const [sPct, bPct, hPct] = result.ratio;
    document.getElementById('tc-seg-shield').style.width = sPct + '%';
    document.getElementById('tc-seg-bomber').style.width = bPct + '%';
    document.getElementById('tc-seg-shooter').style.width = hPct + '%';
    document.getElementById('tc-ratio-shield-pct').textContent = sPct + '%';
    document.getElementById('tc-ratio-bomber-pct').textContent = bPct + '%';
    document.getElementById('tc-ratio-shooter-pct').textContent = hPct + '%';

    document.getElementById('tc-primary-block').innerHTML = formationBlockHTML(result, result.primary, false);
    document.getElementById('tc-alt-block').innerHTML = formationBlockHTML(result, result.alternate, true);
  }
})();
