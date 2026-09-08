/* =========================================================
   ARENA / ARREST COUNTER ANALYZER — ENGINE (v4)
   5 heroes (no class restriction) + 2 Power Armors per side.

   v4 change — Real Damage Modeling: earlier versions blended a
   real-stat comparison with a synthetic "skill score" derived
   from crude text parsing (roughly: damage% * 0.3, summed across
   skills). That let a single flashy percentage (e.g. a 582%
   nuke) dominate the ranking regardless of the Hero's actual
   ATK — a Hero with a huge % but low ATK could outrank a
   sturdier, higher-ATK Hero with a more modest %, which isn't
   how real damage works.

   Now every Hero's offensive power is expressed as a single,
   consistent number: Estimated Damage = real ATK * (best skill's
   damage % / 100) — the same unit as the raw stats, so it can be
   combined with real DEF/HP without unit mismatches. AoE gets an
   explicit "Team Wipe" bonus scaled by both that real damage AND
   the exact number of enemy Heroes present in the class it hits
   — since Arena is won by wiping the whole enemy team, not just
   answering one matchup.
   ========================================================= */

// "What troop type beats X" (X's hard counter)
const AA_COUNTER_OF = { Shield: 'Shooter', Bomber: 'Shield', Shooter: 'Bomber' };
// "What troop type X beats" (inverse of the above)
const AA_BEATS = { Shield: 'Bomber', Bomber: 'Shooter', Shooter: 'Shield' };

const AA_CLASS_CAP = 3;   // max heroes of one class among the 5 counter picks

// --- Weight constants (all tuned so every term lands roughly in the same
//     0-100 range per Hero, so no single factor silently dominates) ---
const AA_W_DAMAGE = 0.012;         // Estimated Damage -> power score (Bomber / Shooter)
const AA_W_TANK = 0.00045;         // (HP + DEF*8) -> survivability score (Bomber / Shooter)

// Shield heroes are valued for what they're actually there to do — soak hits
// and hold the line. DEF/HP dominate their score; their own damage output is
// only a minor, last-resort tiebreaker, not a primary factor.
const AA_W_TANK_SHIELD = 0.0018;   // ~4x the normal tank weight
const AA_W_DAMAGE_SHIELD = 0.003;  // ~1/4 the normal damage weight
const AA_W_TEAMWIPE = 0.010;       // extra value per ADDITIONAL target an AoE hero can hit
const AA_CC_BONUS = 14;
const AA_HEAL_BONUS = 8;
const AA_CLASS_ADV_PER_ENEMY = 10; // per enemy Hero of the class I directly beat
const AA_REAL_ATK_WEIGHT = 22;     // reward for my ATK penetrating the DEF of who I counter
const AA_REAL_SURVIVAL_WEIGHT = 12;// reward for my HP outlasting the ATK of who counters me
const AA_CARRY_CC_BONUS = 20;      // bonus for CC tools when the enemy has a clear carry
const AA_CARRY_CLASS_BONUS = 10;   // bonus if my class specifically beats the carry's class
const AA_VS_DEFENSE_ROBOT_CC_BONUS = 10;
const AA_VS_OFFENSE_ROBOT_DMG_WEIGHT = 0.004;

function aaFindHero(name) {
  return TC_ARENA_HEROES.find(h => h.name === name);
}
function aaFindRobot(name) {
  return TC_ARENA_ROBOTS.find(r => r.name === name);
}

// Real, unit-consistent damage estimate: actual ATK scaled by the Hero's
// strongest skill multiplier — NOT a text-derived synthetic score.
function aaEstimatedDamage(h) {
  return h.atk * (h.bestDmgPct / 100);
}

// --- 1. Analyze the enemy's 5 heroes + 2 robots ---
function aaAnalyzeEnemy(heroNames, robotNames) {
  const heroes = heroNames.map(aaFindHero).filter(Boolean);
  const robots = robotNames.map(aaFindRobot).filter(Boolean);

  const classTally = { Shield: { count: 0 }, Bomber: { count: 0 }, Shooter: { count: 0 } };
  let totalDamage = 0, totalTank = 0;

  heroes.forEach(h => {
    classTally[h.cls].count += 1;
    totalDamage += aaEstimatedDamage(h);
    totalTank += h.hp + h.hdef * 8;
  });

  // Dominant class = most Heroes of that class (kept for the narrative text only)
  let dominantClass = 'Shield', bestCount = -1;
  Object.entries(classTally).forEach(([cls, t]) => {
    if (t.count > bestCount) { bestCount = t.count; dominantClass = cls; }
  });

  // Carry hero = single highest REAL-DAMAGE hero overall (the enemy's main individual threat)
  let carryHero = heroes[0] || null;
  heroes.forEach(h => { if (!carryHero || aaEstimatedDamage(h) > aaEstimatedDamage(carryHero)) carryHero = h; });

  // Secondary threat = the toughest OTHER hero (highest effective HP among the
  // rest) — gives the player a second concrete name to watch for, covering
  // the "hard to kill" danger alongside the carry's "hits hard" danger.
  let secondaryThreat = null;
  heroes.forEach(h => {
    if (h === carryHero) return;
    if (!secondaryThreat || aaEffectiveHp(h) > aaEffectiveHp(secondaryThreat)) secondaryThreat = h;
  });

  const robotModeCount = { offense: 0, defense: 0, hybrid: 0 };
  robots.forEach(r => { robotModeCount[r.mode] = (robotModeCount[r.mode] || 0) + 1; });
  const dominantRobotMode = Object.entries(robotModeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'hybrid';

  return {
    heroes, robots, classTally, dominantClass, carryHero, secondaryThreat,
    totalOff: Math.round(totalDamage), totalDef: Math.round(totalTank / 8),
    dominantRobotMode,
  };
}

// --- 2. Score one of MY heroes directly against THIS enemy team ---
function aaMatchupScore(myHero, enemyAnalysis) {
  const myDamage = aaEstimatedDamage(myHero);
  const myTank = myHero.hp + myHero.hdef * 8;

  // Raw power: real damage output + real survivability, same units, no single
  // flashy percentage can dominate independent of actual ATK anymore.
  // Shield heroes flip the balance — DEF/HP lead, ATK-derived damage trails.
  let score = (myHero.cls === 'Shield')
    ? (myTank * AA_W_TANK_SHIELD + myDamage * AA_W_DAMAGE_SHIELD)
    : (myDamage * AA_W_DAMAGE + myTank * AA_W_TANK);

  if (myHero.cc) score += AA_CC_BONUS;
  if (myHero.hasHeal) score += AA_HEAL_BONUS;

  const iBeat = AA_BEATS[myHero.cls];                                   // class I directly threaten
  const beatsMe = Object.keys(AA_BEATS).find(k => AA_BEATS[k] === myHero.cls); // class that threatens me

  const targets = enemyAnalysis.heroes.filter(e => e.cls === iBeat);
  const threats = enemyAnalysis.heroes.filter(e => e.cls === beatsMe);

  // Class advantage — scaled by how many enemy Heroes I actually threaten right now
  score += targets.length * AA_CLASS_ADV_PER_ENEMY;

  // Team Wipe bonus: AoE is only worth extra once there's more than one body to
  // hit, and its value scales with my REAL damage, not a flat number.
  if (myHero.aoe && targets.length > 1) {
    score += myDamage * AA_W_TEAMWIPE * (targets.length - 1);
  }

  // Real stat edge against the SPECIFIC enemies I counter
  if (targets.length > 0) {
    const avgOffenseRatio = targets.reduce((s, e) => s + (myHero.atk / Math.max(e.hdef, 1)), 0) / targets.length;
    score += avgOffenseRatio * AA_REAL_ATK_WEIGHT;
  }
  // Mild caution against the specific enemies that counter me
  if (threats.length > 0) {
    const avgSurvival = threats.reduce((s, e) => s + Math.sqrt(myHero.hp / Math.max(e.atk, 1)), 0) / threats.length;
    score += avgSurvival * AA_REAL_SURVIVAL_WEIGHT;
  }

  // Direct response to the enemy's single biggest individual threat (the carry)
  if (enemyAnalysis.carryHero) {
    if (myHero.cc) score += AA_CARRY_CC_BONUS;
    if (iBeat === enemyAnalysis.carryHero.cls) score += AA_CARRY_CLASS_BONUS;
  }

  // React to what the enemy's specific Power Armors bring to the fight
  const robotModes = enemyAnalysis.robots.map(r => r.mode);
  if (robotModes.includes('defense') && myHero.cc) score += AA_VS_DEFENSE_ROBOT_CC_BONUS;
  if (robotModes.includes('offense')) score += myDamage * AA_VS_OFFENSE_ROBOT_DMG_WEIGHT;

  return score;
}

// --- Focus-Fire Survival Simulation ---
// Arena mechanic: when a Shield dies, its counter (Shooter) doesn't stop —
// it moves on to the next target. So a single Shield only "works" if it (and
// any Shield(s) after it) survives long enough for my Bombers to kill off the
// enemy's Shooters first. This runs that race using a baseline skill
// activation cadence (uniform placeholder until per-Hero cooldown data is
// available) and escalates the Shield count only if the simulation says the
// current one(s) would fall before the Bombers finish the job.
const AA_ACTIVATION_INTERVAL_SEC = 7; // fallback only — used for Heroes without a known real cooldown yet
const AA_DEF_MITIGATION = 8;          // effective-HP multiplier for DEF, same curve used elsewhere
const AA_MAX_SHIELDS = 3;

// Power Armor timing (not yet wired into the survival race below — Power
// Armors don't map cleanly onto the Shield/Bomber/Shooter triangle, so this
// is stored for now and will be integrated once that's worked out).
const AA_ROBOT_ENTRY_DELAY_SEC = 3;
const AA_ROBOT_ACTIVATION_INTERVAL_SEC = 3.5; // average of the observed 3-4s range

function aaDps(h) {
  return aaEstimatedDamage(h) / (h.actInterval || AA_ACTIVATION_INTERVAL_SEC);
}
function aaEffectiveHp(h) {
  return h.hp + h.hdef * AA_DEF_MITIGATION;
}

// Only enemy Shooters threaten my Shields (Shooter beats Shield), and only my
// Bombers race to remove that threat (Bomber beats Shooter) — so the
// simulation is scoped to exactly that pair, matching the real triangle.
function aaSimulateShieldSurvival(myPicks, enemyAnalysis) {
  const enemyShooters = enemyAnalysis.heroes.filter(e => e.cls === 'Shooter');
  const enemyShooterDps = enemyShooters.reduce((s, e) => s + aaDps(e), 0);
  const enemyShooterPool = enemyShooters.reduce((s, e) => s + aaEffectiveHp(e), 0);

  const myShieldPool = myPicks.filter(h => h.cls === 'Shield').reduce((s, h) => s + aaEffectiveHp(h), 0);
  const myBomberDps = myPicks.filter(h => h.cls === 'Bomber').reduce((s, h) => s + aaDps(h), 0);

  if (enemyShooterDps <= 0) return { survivalTime: Infinity, killTime: 0, survives: true };
  const survivalTime = myShieldPool / enemyShooterDps;
  const killTime = myBomberDps > 0 ? enemyShooterPool / myBomberDps : Infinity;
  return { survivalTime, killTime, survives: survivalTime >= killTime };
}

// Escalates Shield count (up to AA_MAX_SHIELDS) only if the current lineup
// would lose the focus-fire race — swapping out the weakest non-Shield pick
// each time, but never the last remaining Bomber (that would guarantee the
// race can never be won at all).
function aaEnsureSurvivability(picks, ranked, enemyAnalysis) {
  let currentPicks = picks.slice();
  let currentSim = aaSimulateShieldSurvival(currentPicks, enemyAnalysis);

  while (!currentSim.survives && currentPicks.filter(h => h.cls === 'Shield').length < AA_MAX_SHIELDS) {
    // The Shield slot's job is to survive — pick the TANKIEST unused Shield
    // (highest effective HP), not the one with the best general matchup
    // score. A high raw-power Shield with mediocre HP/DEF doesn't help here.
    const unusedShields = TC_ARENA_HEROES.filter(h => h.cls === 'Shield' && !currentPicks.includes(h));
    if (unusedShields.length === 0) break;
    const nextShieldHero = unusedShields.reduce((best, h) => aaEffectiveHp(h) > aaEffectiveHp(best) ? h : best);

    const bomberCount = currentPicks.filter(h => h.cls === 'Bomber').length;
    let worstIdx = -1, worstScore = Infinity;
    currentPicks.forEach((h, i) => {
      if (h.cls === 'Shield') return;
      if (h.cls === 'Bomber' && bomberCount <= 1) return; // keep at least 1 Bomber alive to fight back
      const sc = ranked.find(r => r.hero === h).score;
      if (sc < worstScore) { worstScore = sc; worstIdx = i; }
    });
    if (worstIdx === -1) break;

    // Trading a damage dealer for another Shield only makes sense if it
    // genuinely narrows the survival gap. Swapping a Bomber out also slows
    // the kill clock down, so if that cost outweighs the extra survival
    // time, adding more Shields is actively counter-productive — stop here
    // instead of hollowing out the damage side of the team for no benefit.
    const trialPicks = currentPicks.slice();
    trialPicks[worstIdx] = nextShieldHero;
    const trialSim = aaSimulateShieldSurvival(trialPicks, enemyAnalysis);

    const currentGap = currentSim.killTime - currentSim.survivalTime;
    const trialGap = trialSim.killTime - trialSim.survivalTime;
    if (trialGap >= currentGap) break;

    currentPicks = trialPicks;
    currentSim = trialSim;
  }

  return currentPicks;
}

// --- 3. Build a realistic 5-hero counter lineup ---
function aaBuildCounter(enemyAnalysis) {
  const counterClass = AA_COUNTER_OF[enemyAnalysis.dominantClass]; // narrative label only

  const ranked = TC_ARENA_HEROES
    .map(h => ({ hero: h, score: aaMatchupScore(h, enemyAnalysis) }))
    .sort((a, b) => b.score - a.score);

  let picks = [];
  const classCount = { Shield: 0, Bomber: 0, Shooter: 0 };

  for (const r of ranked) {
    if (picks.length >= 5) break;
    if (classCount[r.hero.cls] >= AA_CLASS_CAP) continue;
    picks.push(r.hero);
    classCount[r.hero.cls] += 1;
  }
  if (picks.length < 5) {
    for (const r of ranked) {
      if (picks.length >= 5) break;
      if (picks.includes(r.hero)) continue;
      picks.push(r.hero);
    }
  }

  // Guarantee at least one Shield for baseline survivability, regardless of the favored class.
  // Pick the TANKIEST Shield (highest effective HP) — this slot's job is to
  // survive, not to maximize general matchup score.
  if (classCount.Shield === 0) {
    const allShields = TC_ARENA_HEROES.filter(h => h.cls === 'Shield');
    const tankiestShield = allShields.reduce((best, h) => aaEffectiveHp(h) > aaEffectiveHp(best) ? h : best);
    if (tankiestShield) {
      let worstIdx = -1, worstScore = Infinity;
      picks.forEach((h, i) => {
        const sc = ranked.find(r => r.hero === h).score;
        if (sc < worstScore) { worstScore = sc; worstIdx = i; }
      });
      picks[worstIdx] = tankiestShield;
    }
  }

  // Run the focus-fire survival simulation and escalate Shield count if the
  // enemy's Shooters would burn through it before my Bombers clear them out.
  picks = aaEnsureSurvivability(picks, ranked, enemyAnalysis);
  const survivalSim = aaSimulateShieldSurvival(picks, enemyAnalysis);

  // Robots: oppose the enemy's dominant robot mode, prefer higher combined score
  const targetMode = enemyAnalysis.dominantRobotMode === 'offense' ? 'defense'
                    : enemyAnalysis.dominantRobotMode === 'defense' ? 'offense'
                    : null;
  let robotPool = TC_ARENA_ROBOTS.slice();
  if (targetMode) {
    const matched = robotPool.filter(r => r.mode === targetMode);
    if (matched.length >= 2) robotPool = matched;

  }
  robotPool = robotPool.sort((a, b) => (b.off + b.def) - (a.off + a.def));
  const robotPicks = robotPool.slice(0, 2);

  // Shield heroes go first — they're the ones expected to tank/soak hits,
  // so displaying them up front matches how a real Arena team is positioned.
  picks.sort((a, b) => (a.cls === 'Shield' ? 0 : 1) - (b.cls === 'Shield' ? 0 : 1));

  return { picks, robotPicks, counterClass, survivalSim };
}

function aaCalculate(heroNames, robotNames) {
  const enemyAnalysis = aaAnalyzeEnemy(heroNames, robotNames);
  const counter = aaBuildCounter(enemyAnalysis);
  return { enemyAnalysis, counter };
}
