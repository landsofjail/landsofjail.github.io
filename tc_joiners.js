/* =========================================================
   JOINER HERO POOLS (Skill 1 Only)
   Mirrors the exact canonical pools already published in the
   guide's "Top 4 Joiner Assist Pool" sections — no new game
   data invented here, only reused + auto-selected by context.
   ========================================================= */

const TC_JOINERS_RALLY_ATTACK = [
  {name:'Koschevoi', cls:'Bomber',  skill:'Precision Strike',  effectKey:'tc_joiner_koschevoiprecisionstrike', hasCtx:true,  type:'buff'},
  {name:'Kate',       cls:'Shooter', skill:'Sprint Signal',     effectKey:'tc_joiner_katesprintsignal',         hasCtx:true,  type:'buff'},
  {name:'Worrell',    cls:'Bomber',  skill:'Charged Launch',    effectKey:'tc_joiner_worrellchargedlaunch',     hasCtx:false, type:'buff'},
  {name:'Phoenix',    cls:'Shield',  skill:'Crush Defense',     effectKey:'tc_joiner_phoenixcrushdefense',      hasCtx:true,  type:'buff'},
  {name:'Sawyer',     cls:'Shooter', skill:'Rust Erosion',      effectKey:'tc_joiner_sawyerrusterosion',        hasCtx:false, type:'strip'},
  {name:'Ada',        cls:'Shooter', skill:'Sweet Smile',       effectKey:'tc_joiner_adasweetsmile',            hasCtx:false, type:'strip'},
  {name:'Whisper',    cls:'Bomber',  skill:'Curse',             effectKey:'tc_joiner_whispercurse',             hasCtx:false, type:'strip'},
  {name:'Tyronn',     cls:'Shield',  skill:'Cripple',           effectKey:'tc_joiner_tyronncripple',            hasCtx:false, type:'multiply'},
  {name:'Lee',        cls:'Bomber',  skill:'Stealth Assault',   effectKey:'tc_joiner_leestealthassault',        hasCtx:false, type:'multiply'},
  {name:'Alph',       cls:'Bomber',  skill:'Photon Shield',     effectKey:'tc_joiner_alphphotonshield',         hasCtx:false, type:'survive'},
  {name:'Caesar',     cls:'Shield',  skill:'Gene Activity',     effectKey:'tc_joiner_caesargeneactivity',       hasCtx:false, type:'survive'},
];

const TC_JOINERS_RALLY_DEFENSE = [
  {name:'Alph',       cls:'Bomber',  skill:'Photon Shield',            effectKey:'tc_joiner_alphphotonshield',                 hasCtx:false, type:'survive'},
  {name:'Caesar',     cls:'Shield',  skill:'Gene Activity',            effectKey:'tc_joiner_caesargeneactivity',               hasCtx:false, type:'survive'},
  {name:'Lanchester', cls:'Bomber',  skill:'Adaptive Transformation',  effectKey:'tc_joiner_lanchesteradaptivetransformation', hasCtx:false, type:'survive'},
  {name:'Sawyer',     cls:'Shooter', skill:'Rust Erosion',             effectKey:'tc_joiner_sawyerrusterosion',                hasCtx:false, type:'strip'},
  {name:'Ada',        cls:'Shooter', skill:'Sweet Smile',              effectKey:'tc_joiner_adasweetsmile',                    hasCtx:false, type:'strip'},
  {name:'Tyronn',     cls:'Shield',  skill:'Cripple',                  effectKey:'tc_joiner_tyronncripple',                    hasCtx:false, type:'multiply'},
  {name:'Koschevoi',  cls:'Bomber',  skill:'Precision Strike',         effectKey:'tc_joiner_koschevoiprecisionstrike',         hasCtx:true,  type:'multiply'},
  {name:'Kate',       cls:'Shooter', skill:'Sprint Signal',            effectKey:'tc_joiner_katesprintsignal',                 hasCtx:true,  type:'multiply'},
  {name:'Phoenix',    cls:'Shield',  skill:'Crush Defense',            effectKey:'tc_joiner_phoenixcrushdefense',              hasCtx:true,  type:'multiply'},
];

// Which joiner "type" best answers a given enemy threat profile, in priority order.
const TC_JOINER_TYPE_PRIORITY = {
  high_lethality: ['survive', 'multiply', 'strip', 'buff'],
  high_atk:       ['survive', 'multiply', 'strip', 'buff'],
  heavy_shield:   ['buff', 'strip', 'multiply', 'survive'],
  heavy_shooter:  ['strip', 'multiply', 'survive', 'buff'],
  balanced:       ['buff', 'strip', 'survive', 'multiply'],
};

function tcPickJoiners(mode, profileKey, variant) {
  // mode: 'rally_attack' | 'rally_defense'  |  variant: 'primary' | 'alternate'
  if (mode !== 'rally_attack' && mode !== 'rally_defense') return null;
  const pool = mode === 'rally_attack' ? TC_JOINERS_RALLY_ATTACK : TC_JOINERS_RALLY_DEFENSE;
  const order = TC_JOINER_TYPE_PRIORITY[profileKey] || TC_JOINER_TYPE_PRIORITY.balanced;
  const rank = (h) => order.indexOf(h.type);
  const sorted = pool.slice().sort((a, b) => rank(a) - rank(b));
  return variant === 'alternate' ? sorted.slice(4, 8) : sorted.slice(0, 4);
}

// Shared HTML renderer for both tactical-calculator.js and counter-analyzer.js.
// `tKey(key, fallback)` is passed in so each page's own translation lookup is reused.
function tcJoinersBlockHTML(mode, profileKey, variant, tKey) {
  const joiners = tcPickJoiners(mode, profileKey, variant);
  if (!joiners || !joiners.length) return '';

  const ctxKey = mode === 'rally_attack' ? 'tc_joiner_ctx_rally' : 'tc_joiner_ctx_garrison';
  const ctxFallback = mode === 'rally_attack' ? 'rally' : 'garrison';
  const ctxLabel = tKey(ctxKey, ctxFallback);

  const rows = joiners.map(j => {
    const hero = TC_HEROES.find(h => h.name === j.name);
    let effect = tKey(j.effectKey, j.skill);
    if (j.hasCtx) effect = effect.replace('{ctx}', ctxLabel);
    return `
      <div class="tc-joiner-row">
        <span class="tc-avatar tc-avatar-xs"><img src="${hero.img}" alt="${hero.name}" loading="lazy"></span>
        <div class="tc-joiner-text">
          <span class="tc-joiner-name">${hero.name}</span>
          <span class="tc-joiner-effect">${j.skill}: ${effect}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="tc-joiners">
      <p class="tc-joiners-title">${tKey('tc_joiners_title', 'Recommended Joiner Heroes (Skill 1)')}</p>
      <div class="tc-joiners-list">${rows}</div>
    </div>`;
}
