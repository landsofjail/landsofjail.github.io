/* =========================================================
   TACTICAL MATCHUP & COUNTER ENGINE
   Core calculation logic for the Tactical Formation & Counter Calculator
   ========================================================= */

const TC_PROFILES = {
  heavy_shooter:  { ratio: [30, 50, 20], robots: ['Bastion', 'Halo'] },
  heavy_shield:   { ratio: [20, 20, 60], robots: ['Phantom Cat', 'Musashimaru'] },
  high_lethality: { ratio: [50, 25, 25], robots: ['Musashimaru', 'Atlas'] },
  high_atk:       { ratio: [40, 30, 30], robots: ['Atlas', 'Musashimaru'] },
  balanced:       { ratio: [34, 33, 33], robots: ['Infercore', 'Bastion', 'Yokozuna'] },
};

const TC_MODE_TRIGGER = {
  solo_attack:   'solo_attack',
  solo_defense:  'defending',
  rally_attack:  'rally_attack',
  rally_defense: 'defending',
};

const TC_MODE_IS_ATTACK = {
  solo_attack: true,
  solo_defense: false,
  rally_attack: true,
  rally_defense: false,
};

// Rank every hero of a class for this mode. Equipment-matched heroes always
// rank above non-matched ones; within each tier, sort by the relevant score.
function tcRankHeroes(cls, triggerKey, isAttack) {
  const pool = TC_HEROES.filter(h => h.cls === cls);
  const scoreKey = isAttack ? 'off' : 'def';
  const otherKey = isAttack ? 'def' : 'off';
  const scored = pool.map(h => ({
    hero: h,
    hasEquip: h.eqTrigger === triggerKey,
    score: h[scoreKey] + h[otherKey] * 0.3,
  }));
  scored.sort((a, b) => {
    if (a.hasEquip !== b.hasEquip) return a.hasEquip ? -1 : 1;
    return b.score - a.score;
  });
  return scored;
}

function tcPickRobot(profile, excludeName) {
  for (const name of profile.robots) {
    if (name === excludeName) continue;
    const r = TC_ROBOTS.find(x => x.name === name);
    if (r) return r;
  }
  // fallback: any robot not already used
  return TC_ROBOTS.find(x => x.name !== excludeName) || TC_ROBOTS[0];
}

function tcBuildFormation(ranked, robot) {
  return {
    picks: {
      shield: ranked.shield[0],
      bomber: ranked.bomber[0],
      shooter: ranked.shooter[0],
    },
    robot,
  };
}

function tcCalculate(mode, enemyProfileKey) {
  const profile = TC_PROFILES[enemyProfileKey];
  const triggerKey = TC_MODE_TRIGGER[mode];
  const isAttack = TC_MODE_IS_ATTACK[mode];

  const rankedShield = tcRankHeroes('Shield', triggerKey, isAttack);
  const rankedBomber = tcRankHeroes('Bomber', triggerKey, isAttack);
  const rankedShooter = tcRankHeroes('Shooter', triggerKey, isAttack);

  const primaryRobot = tcPickRobot(profile, null);
  const primary = tcBuildFormation(
    { shield: rankedShield, bomber: rankedBomber, shooter: rankedShooter },
    primaryRobot
  );

  // Alternate formation: next-best hero per class (falls back to same pick
  // if a class only has one viable candidate), and a different robot.
  const altShield = rankedShield[1] || rankedShield[0];
  const altBomber = rankedBomber[1] || rankedBomber[0];
  const altShooter = rankedShooter[1] || rankedShooter[0];
  const altRobot = tcPickRobot(profile, primaryRobot.name);
  const alternate = {
    picks: { shield: altShield, bomber: altBomber, shooter: altShooter },
    robot: altRobot,
  };

  function equippedCount(f) {
    return [f.picks.shield, f.picks.bomber, f.picks.shooter].filter(p => p.hasEquip).length;
  }
  function totalBuff(f) {
    return [f.picks.shield, f.picks.bomber, f.picks.shooter]
      .filter(p => p.hasEquip)
      .reduce((sum, p) => sum + p.hero.eqValue, 0);
  }

  primary.equippedCount = equippedCount(primary);
  primary.totalBuff = totalBuff(primary);
  alternate.equippedCount = equippedCount(alternate);
  alternate.totalBuff = totalBuff(alternate);

  return {
    mode, enemyProfileKey, profile,
    ratio: profile.ratio,
    isAttack,
    primary,
    alternate,
  };
}
