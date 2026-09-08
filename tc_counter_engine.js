/* =========================================================
   ENEMY COUNTER ANALYZER — ENGINE
   Takes the enemy's reported mode + 3 heroes + robot, infers
   their threat profile, and builds the ideal counter-formation
   for whatever mode the player chooses to respond with.
   ========================================================= */

// Reuses TC_HEROES / TC_ROBOTS / TC_PROFILES / TC_MODE_TRIGGER /
// TC_MODE_IS_ATTACK / tcRankHeroes / tcPickRobot from tc_engine.js.

function ccFindHero(name) {
  return TC_HEROES.find(h => h.name === name);
}
function ccFindRobot(name) {
  return TC_ROBOTS.find(r => r.name === name);
}

// --- 1. Infer the enemy's threat profile from their reported build ---
function ccAnalyzeEnemy(enemyMode, enemyShieldName, enemyBomberName, enemyShooterName, enemyRobotName) {
  const enemyTriggerKey = TC_MODE_TRIGGER[enemyMode];
  const heroes = {
    Shield: ccFindHero(enemyShieldName),
    Bomber: ccFindHero(enemyBomberName),
    Shooter: ccFindHero(enemyShooterName),
  };
  const robot = ccFindRobot(enemyRobotName);

  const statTally = { ATK: 0, DEF: 0, HP: 0, Lethality: 0 };
  let totalOff = 0, totalDef = 0;

  Object.values(heroes).forEach(h => {
    totalOff += h.off;
    totalDef += h.def;
    if (h.eqTrigger === enemyTriggerKey && h.eqStat) {
      statTally[h.eqStat] += h.eqValue;
    }
  });

  if (robot) {
    totalOff += (robot.mode === 'offense') ? 22 : (robot.mode === 'hybrid' ? 10 : 4);
    totalDef += (robot.mode === 'defense') ? 22 : (robot.mode === 'hybrid' ? 10 : 4);
    if (robot.statFocus) statTally[robot.statFocus] += 18;
  }

  // Which class is carrying the enemy's offense (highest raw off score)?
  let carryClass = 'Shooter';
  let carryScore = -Infinity;
  Object.entries(heroes).forEach(([cls, h]) => {
    if (h.off > carryScore) { carryScore = h.off; carryClass = cls; }
  });
  const carryHero = heroes[carryClass];

  const dominantStat = Object.entries(statTally).sort((a, b) => b[1] - a[1])[0][0];
  const aggressionRatio = totalOff / Math.max(totalDef, 1);

  let profileKey;
  if (dominantStat === 'Lethality' && aggressionRatio >= 0.9) {
    profileKey = 'high_lethality';
  } else if (dominantStat === 'ATK' && aggressionRatio >= 1.3) {
    profileKey = 'high_atk';
  } else if (aggressionRatio <= 0.7) {
    profileKey = 'heavy_shield';
  } else if (carryClass === 'Shooter' && aggressionRatio > 0.9) {
    profileKey = 'heavy_shooter';
  } else {
    profileKey = 'balanced';
  }

  return {
    heroes, robot, statTally, dominantStat,
    totalOff: Math.round(totalOff), totalDef: Math.round(totalDef),
    carryClass, carryHero,
    profileKey, profile: TC_PROFILES[profileKey],
    isAggressive: aggressionRatio > 1.05,
  };
}

// --- 2. Build the counter formation for the player's chosen response mode ---
function ccBuildCounter(myMode, enemyAnalysis) {
  const triggerKey = TC_MODE_TRIGGER[myMode];
  const isAttack = TC_MODE_IS_ATTACK[myMode];

  // Counter-nudge: lean the ranking toward whichever of MY stats directly
  // neutralizes the enemy's strength (their aggression -> my mitigation,
  // their turtle-style defense -> my raw power to break through).
  const nudgeTowardDefense = enemyAnalysis.isAggressive;

  function rankWithNudge(cls) {
    const pool = TC_HEROES.filter(h => h.cls === cls);
    const primaryKey = isAttack ? 'off' : 'def';
    const secondaryKey = isAttack ? 'def' : 'off';
    const nudgeKey = nudgeTowardDefense ? 'def' : 'off';
    const scored = pool.map(h => {
      const base = h[primaryKey] + h[secondaryKey] * 0.3;
      const nudge = h[nudgeKey] * 0.45;
      return { hero: h, hasEquip: h.eqTrigger === triggerKey, score: base + nudge };
    });
    scored.sort((a, b) => {
      if (a.hasEquip !== b.hasEquip) return a.hasEquip ? -1 : 1;
      return b.score - a.score;
    });
    return scored;
  }

  const shieldPool = rankWithNudge('Shield');
  const bomberPool = rankWithNudge('Bomber');
  const shooterPool = rankWithNudge('Shooter');

  const picks = { shield: shieldPool[0], bomber: bomberPool[0], shooter: shooterPool[0] };

  // Counter robot: oppose the enemy robot's mode; if enemy is hybrid,
  // counter their dominant stat instead.
  let robotPool;
  if (enemyAnalysis.robot.mode === 'offense') {
    robotPool = TC_ROBOTS.filter(r => r.mode === 'defense');
  } else if (enemyAnalysis.robot.mode === 'defense') {
    robotPool = TC_ROBOTS.filter(r => r.mode === 'offense');
  } else {
    robotPool = enemyAnalysis.isAggressive
      ? TC_ROBOTS.filter(r => r.mode === 'defense')
      : TC_ROBOTS.filter(r => r.mode === 'offense');
  }
  if (!robotPool.length) robotPool = TC_ROBOTS.slice();
  // Prefer a robot whose focus matches one of my picked classes.
  const myClasses = [picks.shield.hero.cls, picks.bomber.hero.cls, picks.shooter.hero.cls];
  robotPool = robotPool.slice().sort((a, b) => {
    const aMatch = myClasses.some(c => a.focus.includes(c)) ? 1 : 0;
    const bMatch = myClasses.some(c => b.focus.includes(c)) ? 1 : 0;
    return bMatch - aMatch;
  });
  const counterRobot = robotPool[0];

  const equippedCount = [picks.shield, picks.bomber, picks.shooter].filter(p => p.hasEquip).length;
  const totalBuff = [picks.shield, picks.bomber, picks.shooter]
    .filter(p => p.hasEquip).reduce((s, p) => s + p.hero.eqValue, 0);

  return {
    picks, robot: counterRobot, ratio: enemyAnalysis.profile.ratio,
    equippedCount, totalBuff, isAttack,
  };
}

function ccCalculate(enemyMode, enemyShieldName, enemyBomberName, enemyShooterName, enemyRobotName, myMode) {
  const enemyAnalysis = ccAnalyzeEnemy(enemyMode, enemyShieldName, enemyBomberName, enemyShooterName, enemyRobotName);
  const counter = ccBuildCounter(myMode, enemyAnalysis);
  return { enemyMode, myMode, enemyAnalysis, counter };
}
