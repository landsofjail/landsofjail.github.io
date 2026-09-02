let heroes = [];
let visibleHeroes = [];
let rarity = "All";
let heroClass = "All";
let season = "All";
let current = null;

const grid = document.querySelector("#grid");
const count = document.querySelector("#count");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modalContent");
const editor = document.querySelector("#editor");
const editorContent = document.querySelector("#editorContent");

const rarityRank = { SSR: 3, SR: 2, R: 1 };
const classIcons = {
  Shield: "SH",
  Shooter: "AT",
  Bomber: "BM"
};


/* =========================================================
   LOAD HEROES
========================================================= */

fetch("heroes.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Unable to load heroes.json");
    }

    return response.json();
  })

  .then((data) => {

    heroes = data.map(normalizeHero);

    document.querySelector("#heroTotal").textContent = heroes.length;

    populateSeasonFilter();

    render();

    openHeroFromHash();
  })

  .catch((error) => {

    grid.innerHTML = `
      <div class="empty-state">
        Hero data could not be loaded.
        ${escapeHtml(error.message)}
      </div>
    `;

  });


/* =========================================================
   NORMALIZE HERO
========================================================= */

function normalizeHero(hero) {

  const rarityBase = getRarityBase(hero.rarity);

  const normalized = {

    ...hero,

    name: cleanEnglishName(
      hero.name ||
      hero.displayName ||
      "Unknown Hero"
    ),

    displayName: cleanEnglishName(
      hero.displayName ||
      hero.name ||
      "Unknown Hero"
    ),

    rarityBase,

    season:
      hero.season ||
      getSeasonFromRarity(hero.rarity) ||
      "Base",

    class:
      hero.class ||
      hero.type ||
      "Unknown",

    type:
      hero.type ||
      hero.class ||
      "Unknown",

    stats: normalizeStats(hero.stats),

    /* KEEP NEW WAR STATS */
    warStats: hero.warStats || {},

    arrestSkills:
      normalizeSkillList(
        hero.arrestSkills ||
        hero.skills
      ),

    warSkills:
      normalizeSkillList(
        hero.warSkills ||
        hero.warSkill
      ),

    exclusiveEquipment:
      normalizeSkillList(
        hero.exclusiveEquipment ||
        hero.equipment
      )
  };

  return mergeLocalHero(normalized);
}


function mergeLocalHero(hero) {
  return hero;
}


function normalizeHeroWithoutLocal(hero) {

  return {

    ...hero,

    name: cleanEnglishName(
      hero.name ||
      hero.displayName ||
      "Unknown Hero"
    ),

    displayName: cleanEnglishName(
      hero.displayName ||
      hero.name ||
      "Unknown Hero"
    ),

    rarityBase:
      getRarityBase(hero.rarity),

    season:
      hero.season ||
      getSeasonFromRarity(hero.rarity) ||
      "Base",

    class:
      hero.class ||
      hero.type ||
      "Unknown",

    type:
      hero.type ||
      hero.class ||
      "Unknown",

    stats:
      normalizeStats(hero.stats),

    warStats:
      hero.warStats || {},

    arrestSkills:
      normalizeSkillList(
        hero.arrestSkills ||
        hero.skills
      ),

    warSkills:
      normalizeSkillList(
        hero.warSkills ||
        hero.warSkill
      ),

    exclusiveEquipment:
      normalizeSkillList(
        hero.exclusiveEquipment ||
        hero.equipment
      )
  };
}


/* =========================================================
   NAME / RARITY / SEASON
========================================================= */

function cleanEnglishName(name) {

  return String(name)
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function getRarityBase(value = "") {

  if (String(value).startsWith("SSR")) {
    return "SSR";
  }

  if (String(value).startsWith("SR")) {
    return "SR";
  }

  if (String(value).startsWith("R")) {
    return "R";
  }

  return "R";
}


function getSeasonFromRarity(value = "") {

  const match =
    String(value).match(/S-\d+/);

  return match ? match[0] : "";
}


/* =========================================================
   STATS
========================================================= */

function normalizeStats(stats = {}) {

  return {

    arrestATK:
      stats.arrestATK ??
      stats.arrestAtk ??
      "",

    arrestDEF:
      stats.arrestDEF ??
      stats.arrestDef ??
      "",

    arrestHP:
      stats.arrestHP ??
      stats.arrestHp ??
      "",

    warATKDEF:
      stats.warATKDEF ??
      stats.warAtkDef ??
      ""
  };
}


/* =========================================================
   SKILLS
========================================================= */

function normalizeSkillList(value) {

  if (!value) {
    return [];
  }

  const list =
    Array.isArray(value)
      ? value
      : [value];

  return list
    .filter(Boolean)
    .map((skill, index) => {

      if (typeof skill === "string") {

        return {

          name:
            index === 0
              ? "TODO"
              : `TODO ${index + 1}`,

          icon: "",

          description: skill,

          levels: {}

        };
      }

      return {

        name:
          skill.name ||
          "TODO",

        icon:
          skill.icon ||
          "",

        description:
          skill.description ||
          "",

        levels:
          skill.levels ||
          {}

      };

    });
}


/* =========================================================
   SEASON FILTER
========================================================= */

function populateSeasonFilter() {

  const seasonSelect =
    document.querySelector("#season");

  if (!seasonSelect) {
    return;
  }

  const seasons = [
    ...new Set(
      heroes
        .map((hero) => hero.season)
        .filter(Boolean)
    )
  ].sort(compareSeason);

  seasonSelect.innerHTML =
    `<option value="All">All Seasons</option>` +
    seasons
      .map(
        (item) =>
          `<option value="${escapeAttr(item)}">
            ${escapeHtml(item)}
          </option>`
      )
      .join("");

  seasonSelect.value = season;
}


function compareSeason(a, b) {

  if (a === "Base") {
    return -1;
  }

  if (b === "Base") {
    return 1;
  }

  return a.localeCompare(
    b,
    undefined,
    { numeric: true }
  );
}


/* =========================================================
   MAIN GRID
========================================================= */

function render() {

  const q =
    document
      .querySelector("#search")
      .value
      .toLowerCase()
      .trim();

  const sort =
    document.querySelector("#sort").value;

  visibleHeroes = heroes

    .filter((hero) => {

      const matchesRarity =
        rarity === "All" ||
        hero.rarityBase === rarity;

      const matchesClass =
        heroClass === "All" ||
        hero.class === heroClass;

      const matchesSeason =
        season === "All" ||
        hero.season === season;

      const matchesSearch =
        hero.name
          .toLowerCase()
          .includes(q);

      return (
        matchesRarity &&
        matchesClass &&
        matchesSeason &&
        matchesSearch
      );

    })

    .sort((a, b) => {

      if (sort === "name") {

        return a.name.localeCompare(
          b.name
        );

      }

      return (
        (rarityRank[b.rarityBase] || 0) -
        (rarityRank[a.rarityBase] || 0)
      ) ||
        a.name.localeCompare(b.name);

    });

  count.textContent =
    `${visibleHeroes.length} heroes`;

  grid.innerHTML =
    visibleHeroes.length

      ? visibleHeroes
          .map(renderCard)
          .join("")

      : `
        <div class="empty-state">
          No heroes match these filters.
        </div>
      `;

  document
    .querySelectorAll(".card")
    .forEach((card) => {

      card.onclick = () =>
        openHero(card.dataset.id);

    });
}


/* =========================================================
   HERO CARD
========================================================= */

function renderCard(hero) {

  return `

    <article
      class="card ${hero.rarityBase.toLowerCase()}"
      data-id="${escapeAttr(hero.id)}"
    >

      <div class="portrait">

        <img
          src="${escapeAttr(hero.image)}"
          alt="${escapeAttr(hero.name)}"
          loading="lazy"
        >

        <div class="type-dot">
          ${escapeHtml(
            classIcons[hero.class] ||
            hero.class.slice(0, 2).toUpperCase()
          )}
        </div>

        <div class="rarity-glow">
          ${escapeHtml(hero.rarityBase)}
        </div>

      </div>


      <div class="card-body">

        <span class="pill ${hero.rarityBase.toLowerCase()}">
          ${escapeHtml(hero.rarityBase)}
        </span>

        <button
          class="favorite-dot ${isFavorite(hero.id) ? "active" : ""}"
          type="button"
          aria-label="Favorite ${escapeAttr(hero.name)}"
          onclick="toggleFavorite(event,'${escapeAttr(hero.id)}')"
        >
          F
        </button>

        <h3>
          ${escapeHtml(hero.name)}
        </h3>

        <p>
          ${escapeHtml(hero.class)}
          /
          ${escapeHtml(hero.season)}
        </p>

      </div>

    </article>

  `;
}


/* =========================================================
   OPEN HERO
========================================================= */

function getHero(id) {

  return heroes.find(
    (hero) => hero.id === id
  );
}


async function openHero(id) {

  current = getHero(id);

  if (!current) {
    return;
  }

  renderDetail(current);

  modal.classList.remove("hidden");

  if (
    typeof history !== "undefined" &&
    location.hash !== `#${current.id}`
  ) {

    history.replaceState(
      null,
      "",
      `#${current.id}`
    );

  }
}


function openHeroFromHash() {

  const id =
    (location.hash || "")
      .replace("#", "");

  if (
    id &&
    heroes.some(
      (hero) => hero.id === id
    )
  ) {

    openHero(id);

  }
}


/* =========================================================
   HERO DETAIL
========================================================= */

function renderDetail(hero) {

  const stats =
    hero.stats || {};

  const warStats =
    hero.warStats || {};

  const heroClass =
    String(hero.class || "")
      .toLowerCase();

  const classWarStats =
    warStats[heroClass] || {};


  modalContent.innerHTML = `

    <div
      class="hero-detail ${hero.rarityBase.toLowerCase()}"
    >


      <!-- HERO HEADER -->

      <div class="detail-hero">

        <div class="detail-image-frame">

          <img
            src="${escapeAttr(hero.image)}"
            alt="${escapeAttr(hero.name)}"
          >

        </div>


        <div class="detail-main">

          <div class="detail-actions">

            <span class="pill ${hero.rarityBase.toLowerCase()}">
              ${escapeHtml(hero.rarityBase)}
            </span>

            <button
              class="ghost-btn ${isFavorite(hero.id) ? "active" : ""}"
              type="button"
              onclick="toggleFavorite(event,'${escapeAttr(hero.id)}')"
            >
              ${isFavorite(hero.id)
                ? "Favorited"
                : "Favorite"}
            </button>

            <button
              class="share-btn"
              type="button"
              onclick="shareHero()"
            >
              Share
            </button>

          </div>


          <h2>
            ${escapeHtml(hero.name)}
          </h2>


          <p class="detail-sub">
            ${escapeHtml(
              hero.description ||
              hero.subtitle ||
              "TODO: Add hero overview."
            )}
          </p>


          <div class="detail-meta">

            <span>
              ${escapeHtml(hero.rarityBase)}
            </span>

            <span>
              ${escapeHtml(hero.season)}
            </span>

            <span>
              ${escapeHtml(hero.class)}
            </span>

          </div>

        </div>

      </div>


      <!-- WAR STATS -->

      <section class="detail-section">

        <div class="detail-title">
          <span></span>
          <h3>War Stats</h3>
        </div>


        <div class="stats-grid">

          ${renderStat(
            `${hero.class} ATK`,
            classWarStats.atk
          )}

          ${renderStat(
            `${hero.class} DEF`,
            classWarStats.def
          )}

          ${renderStat(
            `${hero.class} Lethality`,
            classWarStats.lethality
          )}

          ${renderStat(
            `${hero.class} HP`,
            classWarStats.hp
          )}

        </div>

      </section>


      <!-- =================================================
           EQUIPMENT + ARREST + WAR
           THREE COLUMNS
      ================================================= -->

      ${renderExclusiveSection(hero)}


      <!-- FOOTER -->

      <div class="detail-footer">

        <button
          type="button"
          onclick="prevHero()"
        >
          Previous
        </button>

        <button
          type="button"
          onclick="closeModal()"
        >
          Close
        </button>

        <button
          type="button"
          onclick="nextHero()"
        >
          Next
        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   EXCLUSIVE EQUIPMENT + ARREST + WAR
   LV5 ONLY
========================================================= */

function renderExclusiveSection(hero) {

  const equipment =
    hero.exclusiveEquipment?.[0] ||
    null;

  const arrest =
    hero.arrestSkills?.[0] ||
    null;

  const war =
    hero.warSkills?.[0] ||
    null;


  return `

    <section class="detail-section">

      <div class="detail-title">

        <span></span>

        <h3>
          Exclusive Equipment & Skills
        </h3>

      </div>


      <div class="exclusive-layout">


        <!-- EQUIPMENT -->

        <article class="exclusive-info-card">

          <div class="exclusive-info-icon">

            ${
              equipment?.icon

                ? `
                  <img
                    src="${escapeAttr(equipment.icon)}"
                    alt="${escapeAttr(equipment.name || "")}"
                  >
                `

                : "EQ"
            }

          </div>


          <div class="exclusive-info-copy">

            <small>
              EXCLUSIVE EQUIPMENT
            </small>


            <h4>
              ${escapeHtml(
                equipment?.name ||
                "Exclusive Equipment"
              )}
            </h4>


            <span class="exclusive-max-level">
              Lv.5 MAX
            </span>


            <p>
              ${escapeHtml(
                getMaxLevelDescription(equipment)
              )}
            </p>

          </div>

        </article>


        <!-- ARREST -->

        <article class="exclusive-info-card">

          <div class="exclusive-info-icon">

            ${
              arrest?.icon

                ? `
                  <img
                    src="${escapeAttr(arrest.icon)}"
                    alt="${escapeAttr(arrest.name || "")}"
                  >
                `

                : "SK"
            }

          </div>


          <div class="exclusive-info-copy">

            <small>
              ARREST SKILL
            </small>


            <h4>
              ${escapeHtml(
                arrest?.name ||
                "Arrest Skill"
              )}
            </h4>


            <span class="exclusive-max-level">
              Lv.5 MAX
            </span>


            <p>
              ${escapeHtml(
                getMaxLevelDescription(arrest)
              )}
            </p>

          </div>

        </article>


        <!-- WAR -->

        <article class="exclusive-info-card">

          <div class="exclusive-info-icon">

            ${
              war?.icon

                ? `
                  <img
                    src="${escapeAttr(war.icon)}"
                    alt="${escapeAttr(war.name || "")}"
                  >
                `

                : "SK"
            }

          </div>


          <div class="exclusive-info-copy">

            <small>
              WAR SKILL
            </small>


            <h4>
              ${escapeHtml(
                war?.name ||
                "War Skill"
              )}
            </h4>


            <span class="exclusive-max-level">
              Lv.5 MAX
            </span>


            <p>
              ${escapeHtml(
                getMaxLevelDescription(war)
              )}
            </p>

          </div>

        </article>


      </div>

    </section>

  `;
}


/* =========================================================
   GET LEVEL 5 DESCRIPTION
========================================================= */

function getMaxLevelDescription(skill) {

  if (!skill) {

    return "Skill data has not been added yet.";

  }


  const levels =
    skill.levels || {};


  const maxLevel =
    levels["5"] ||
    levels[5] ||
    levels["4"] ||
    levels[4] ||
    null;


  let description =
    skill.description || "";


  if (
    maxLevel &&
    typeof maxLevel === "object"
  ) {

    Object.entries(maxLevel)
      .forEach(([key, value]) => {

        if (
          value !== "-" &&
          value !== "" &&
          value != null
        ) {

          description =
            description.replace(
              new RegExp(
                "\\{" +
                key +
                "\\}",
                "g"
              ),
              String(value)
            );

        }

      });

  }


  return (
    description ||
    "No description available."
  );
}


/* =========================================================
   STAT
========================================================= */

function renderStat(label, value) {

  return `

    <div class="stat">

      <small>
        ${escapeHtml(label)}
      </small>

      <b>
        ${formatValue(value)}
      </b>

    </div>

  `;
}


/* =========================================================
   OLD SKILL SECTION
   KEPT FOR COMPATIBILITY
========================================================= */

function renderSkillSection(title, skills) {

  const skillList =
    skills && skills.length
      ? skills
      : [null];


  return `

    <section class="detail-section">

      <div class="detail-title">

        <span></span>

        <h3>
          ${escapeHtml(title)}
        </h3>

      </div>


      <div class="skills-grid">

        ${skillList
          .map((skill) =>
            skill
              ? renderSkill(skill)
              : renderEmptySkill()
          )
          .join("")}

      </div>

    </section>

  `;
}


/* =========================================================
   NORMAL SKILL - LV5 ONLY
========================================================= */

function renderSkill(skill) {

  const description =
    getMaxLevelDescription(skill);


  return `

    <article class="skill-card">

      <div class="skill-icon">

        ${
          skill.icon
            ? `
              <img
                src="${escapeAttr(skill.icon)}"
                alt=""
              >
            `
            : "SK"
        }

      </div>


      <div class="skill-copy">

        <h4>
          ${escapeHtml(
            skill.name ||
            "TODO"
          )}
        </h4>


        <p>
          ${escapeHtml(
            description ||
            "Skill data has not been added yet."
          )}
        </p>


        <div class="levels">

          <span class="filled">
            Lv.5
          </span>

        </div>

      </div>

    </article>

  `;
}


/* =========================================================
   EMPTY SKILL
========================================================= */

function renderEmptySkill() {

  return `

    <article class="skill-card empty-skill">

      <div class="skill-icon">
        SK
      </div>


      <div class="skill-copy">

        <h4>
          TODO
        </h4>


        <p>
          Skill data has not been added yet.
        </p>


        <div class="levels">

          <span>
            Lv.5: TODO
          </span>

        </div>

      </div>

    </article>

  `;
}


/* =========================================================
   LEVEL HELPER
========================================================= */

function renderLevels(levels = {}) {

  const value =
    levels["5"] ||
    levels[5] ||
    levels["4"] ||
    levels[4] ||
    null;


  if (
    value &&
    typeof value === "object"
  ) {

    const parts =
      Object.entries(value)

        .filter(
          ([key, val]) =>
            val !== "-" &&
            val !== "" &&
            val != null
        )

        .map(
          ([key, val]) =>
            `${key}: ${val}`
        )

        .join(" | ");


    return `

      <div class="levels">

        <span class="filled">

          Lv.5

          ${
            parts
              ? `: ${escapeHtml(parts)}`
              : ""
          }

        </span>

      </div>

    `;

  }


  return `

    <div class="levels">

      <span>
        Lv.5: TODO
      </span>

    </div>

  `;
}


/* =========================================================
   LIST
========================================================= */

function renderList(items = []) {

  return items.length

    ? `
      <ul>
        ${items
          .map(
            (item) =>
              `<li>${escapeHtml(item)}</li>`
          )
          .join("")}
      </ul>
    `

    : `
      <p>
        TODO: Add entries.
      </p>
    `;
}


/* =========================================================
   EDITOR
========================================================= */

function editHero() {

  const hero = current;

  if (!hero) {
    return;
  }

  const rating =
    hero.rating || {};


  editor.classList.remove("hidden");


  editorContent.innerHTML = `

    <div class="editor-head">

      <h2>
        Edit ${escapeHtml(hero.name)}
      </h2>

      <button
        class="close-editor"
        onclick="closeEditor()"
      >
        X
      </button>

    </div>


    <label>
      Name

      <input
        id="e-name"
        value="${escapeAttr(hero.name || "")}"
      >

    </label>


    <div class="form-grid">

      <label>
        Tier

        <input
          id="e-tier"
          value="${escapeAttr(hero.tier || "")}"
        >

      </label>


      <label>
        Overall

        <input
          id="e-overall"
          value="${escapeAttr(rating.overall || "")}"
        >

      </label>


      <label>
        Rally

        <input
          id="e-rally"
          value="${escapeAttr(rating.rally || "")}"
        >

      </label>


      <label>
        Defense

        <input
          id="e-defense"
          value="${escapeAttr(rating.defense || "")}"
        >

      </label>


      <label>
        Arena

        <input
          id="e-arena"
          value="${escapeAttr(rating.arena || "")}"
        >

      </label>


      <label>
        Value

        <input
          id="e-value"
          value="${escapeAttr(rating.value || "")}"
        >

      </label>


      <label class="wide">

        Overview

        <textarea id="e-description">
${escapeHtml(hero.description || "")}
        </textarea>

      </label>


      <label class="wide">

        Best Teams (one per line)

        <textarea id="e-bt">
${escapeHtml(
  (
    hero.bestTeams ||
    hero.recommendedTeams ||
    []
  ).join("\n")
)}
        </textarea>

      </label>


      <label class="wide">

        Notes

        <textarea id="e-notes">
${escapeHtml(hero.notes || "")}
        </textarea>

      </label>

    </div>


    <div class="editor-actions">

      <button onclick="saveLocal()">
        Save in Browser
      </button>

      <button onclick="downloadHero()">
        Download JSON
      </button>

    </div>


    <p class="editor-hint">
      Browser saves stay on this device.
      Use Download JSON to export the updated hero object.
    </p>

  `;
}


/* =========================================================
   COLLECT / SAVE
========================================================= */

function collect() {

  const hero =
    structuredClone(current);


  hero.name =
    val("#e-name");

  hero.displayName =
    hero.name;

  hero.tier =
    val("#e-tier");


  hero.rating = {

    overall:
      val("#e-overall"),

    rally:
      val("#e-rally"),

    defense:
      val("#e-defense"),

    arena:
      val("#e-arena"),

    value:
      val("#e-value")

  };


  hero.description =
    val("#e-description");


  hero.bestTeams =
    lines("#e-bt");


  hero.notes =
    val("#e-notes");


  hero.lastUpdated =
    new Date()
      .toISOString()
      .slice(0, 10);


  return normalizeHeroWithoutLocal(hero);
}


function saveLocal() {

  current =
    collect();


  const index =
    heroes.findIndex(
      (hero) =>
        hero.id === current.id
    );


  if (index >= 0) {

    heroes[index] =
      current;

  }


  localStorage.setItem(
    `loj:${current.id}`,
    JSON.stringify(current)
  );


  renderDetail(current);

  render();

  closeEditor();

  alert(
    "Saved in this browser."
  );
}


function downloadHero() {

  const hero =
    collect();


  const blob =
    new Blob(
      [
        JSON.stringify(
          hero,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  const link =
    document.createElement("a");


  link.href =
    URL.createObjectURL(blob);


  link.download =
    `${hero.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )}.json`;


  link.click();


  URL.revokeObjectURL(
    link.href
  );
}


/* =========================================================
   SHARE
========================================================= */

function shareHero() {

  if (!current) {
    return;
  }


  const url =
    `${location.href.split("#")[0]}#${current.id}`;


  if (navigator.share) {

    navigator.share({

      title:
        `${current.name} - Lands of Jail`,

      url

    });

  } else {

    navigator.clipboard?.writeText(url);

  }
}


/* =========================================================
   FAVORITES
========================================================= */

function toggleFavorite(event, id) {

  event?.stopPropagation();


  const favorites =
    getFavorites();


  if (favorites.has(id)) {

    favorites.delete(id);

  } else {

    favorites.add(id);

  }


  localStorage.setItem(
    "loj:favorites",
    JSON.stringify(
      [...favorites]
    )
  );


  render();


  if (
    current?.id === id
  ) {

    renderDetail(current);

  }
}


function getFavorites() {

  try {

    return new Set(
      JSON.parse(
        localStorage.getItem(
          "loj:favorites"
        ) ||
        "[]"
      )
    );

  } catch {

    return new Set();

  }
}


function isFavorite(id) {

  return getFavorites()
    .has(id);
}


/* =========================================================
   PREVIOUS / NEXT
========================================================= */

function move(dir) {

  if (!current) {
    return;
  }


  const list =
    visibleHeroes.length
      ? visibleHeroes
      : heroes;


  let index =
    list.findIndex(
      (hero) =>
        hero.id === current.id
    );


  index =
    (
      index +
      dir +
      list.length
    ) %
    list.length;


  openHero(
    list[index].id
  );
}


function prevHero() {

  move(-1);

}


function nextHero() {

  move(1);

}


/* =========================================================
   CLOSE
========================================================= */

function closeModal() {

  modal.classList.add("hidden");


  if (
    typeof history !== "undefined" &&
    location.hash === `#${current?.id}`
  ) {

    history.replaceState(
      null,
      "",
      location.pathname +
      location.search
    );

  }
}


function closeEditor() {

  editor.classList.add("hidden");

}


/* =========================================================
   UI HELPERS
========================================================= */

function active(selector, value) {

  document
    .querySelectorAll(selector)
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.value === value
      );

    });
}


function val(selector) {

  return document
    .querySelector(selector)
    .value
    .trim();

}


function lines(selector) {

  return val(selector)
    .split("\n")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);

}


function formatValue(value) {

  if (value === 0) {
    return "0";
  }

  if (!value) {
    return "TODO";
  }

  return escapeHtml(
    String(value)
  );
}


function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeAttr(value) {

  return escapeHtml(value);

}


function hasClass(element, name) {

  if (
    element.classList.contains
  ) {

    return element.classList.contains(
      name
    );

  }

  return Boolean(
    element.classList.classes?.has(name)
  );
}


/* =========================================================
   FILTER EVENTS
========================================================= */

document
  .querySelectorAll(
    "#rarityFilters .chip"
  )
  .forEach((button) => {

    button.onclick = () => {

      rarity =
        button.dataset.value;

      active(
        "#rarityFilters .chip",
        rarity
      );

      render();

    };

  });


document
  .querySelectorAll(
    "#roleFilters .chip"
  )
  .forEach((button) => {

    button.onclick = () => {

      heroClass =
        button.dataset.value;

      active(
        "#roleFilters .chip",
        heroClass
      );

      render();

    };

  });


const seasonElement = document.querySelector("#season");

if (seasonElement) {
  seasonElement.onchange = (event) => {
    season = event.target.value;
    render();
  };
}


const sortElement = document.querySelector("#sort");

if (sortElement) {
  sortElement.onchange = render;
}


const searchElement = document.querySelector("#search");

if (searchElement) {
  searchElement.oninput = render;
}


const clearElement = document.querySelector("#clear");

if (clearElement) {

  clearElement.onclick = () => {

    rarity = "All";
    heroClass = "All";
    season = "All";

    const search = document.querySelector("#search");
    const seasonSelect = document.querySelector("#season");

    if (search) {
      search.value = "";
    }

    if (seasonSelect) {
      seasonSelect.value = "All";
    }

    active("#rarityFilters .chip", "All");
    active("#roleFilters .chip", "All");

    render();

  };




  document.querySelector(
    "#search"
  ).value = "";


  document.querySelector(
    "#season"
  ).value = "All";


  active(
    "#rarityFilters .chip",
    "All"
  );


  active(
    "#roleFilters .chip",
    "All"
  );


  render();

};


/* =========================================================
   CLOSE BUTTONS
========================================================= */

document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach((item) => {

    item.onclick =
      closeModal;

  });


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Escape") {

      closeModal();

      closeEditor();

    }


    if (
      !hasClass(
        modal,
        "hidden"
      ) &&
      event.key === "ArrowLeft"
    ) {

      prevHero();

    }


    if (
      !hasClass(
        modal,
        "hidden"
      ) &&
      event.key === "ArrowRight"
    ) {

      nextHero();

    }

  }
);


/* =========================================================
   THEME
========================================================= */

const themeButton = document.querySelector("#themeBtn");

if (themeButton) {

  themeButton.onclick = () =>
    document.body.classList.toggle("light");

}

/* =========================================================
   CAGE HERO SELECTOR
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  const shooterSlot = document.getElementById("cageShooterSlot");
  const bomberSlot = document.getElementById("cageBomberSlot");
  const shieldSlot = document.getElementById("cageShieldSlot");

  const picker = document.getElementById("cageHeroPicker");
  const pickerList = document.getElementById("cageHeroList");
  const pickerTitle = document.getElementById("cagePickerTitle");
  const closeButton = document.getElementById("closeCagePicker");

  const shieldPercent = document.getElementById("cageShieldPercent");
  const bomberPercent = document.getElementById("cageBomberPercent");
  const shooterPercent = document.getElementById("cageShooterPercent");


  /* =======================================================
     CHECK
  ======================================================= */

  if (
    !shooterSlot ||
    !bomberSlot ||
    !shieldSlot ||
    !picker ||
    !pickerList
  ) {

    console.warn("Cage Hero Selector: HTML elements not found.");

    return;

  }


  /* =======================================================
     HERO DATA
  ======================================================= */

  const cageHeroes = {

    Shooter: [
      {
        name: "Ada",
        image: "assets/ada.png"
      },

      {
        name: "Mireya",
        image: "assets/mireya.png"
      }
    ],


    Bomber: [
      {
        name: "Wukong",
        image: "assets/wukong.png"
      },

      {
        name: "Ryuichi Ito",
        image: "assets/ryuichi-ito.png"
      },

      {
        name: "Flameborne",
        image: "assets/flameborne.png"
      },

      {
        name: "Whisper",
        image: "assets/whisper.png"
      }
    ],


    Shield: [
      {
        name: "Tyronn",
        image: "assets/tyron.png"
      },

      {
        name: "Xuanming",
        image: "assets/xuanming.png"
      },

      {
        name: "Phoenix",
        image: "assets/phoenix.png"
      }
    ]

  };


  /* =======================================================
     SELECTED HEROES
  ======================================================= */

  let selectedHeroes = {

    Shooter: null,

    Bomber: null,

    Shield: null

  };


  let activeClass = null;


  /* =======================================================
     OPEN POPUP
  ======================================================= */

  function openCagePicker(heroClass) {

    activeClass = heroClass;

    pickerTitle.textContent =
      heroClass.toUpperCase();

    pickerList.innerHTML = "";


    const heroes = cageHeroes[heroClass];


    heroes.forEach(function (hero) {

      const button = document.createElement("button");

      button.type = "button";

      button.className = "cage-picker-hero";


      button.innerHTML = `
        <img
          src="${hero.image}"
          alt="${hero.name}"
        >

        <strong>
          ${hero.name}
        </strong>
      `;


      button.addEventListener(
        "click",
        function () {

          selectCageHero(hero);

        }
      );


      pickerList.appendChild(button);

    });


    picker.classList.remove("hidden");

    document.body.style.overflow = "hidden";

  }


  /* =======================================================
     SELECT HERO
  ======================================================= */

  function selectCageHero(hero) {

    if (!activeClass) {
      return;
    }


    selectedHeroes[activeClass] = hero;


    renderCageHero(
      activeClass,
      hero
    );


    updateCageFormation();


    closeCagePicker();

  }


  /* =======================================================
     RENDER HERO
  ======================================================= */

  function renderCageHero(heroClass, hero) {

    let slot = null;


    if (heroClass === "Shooter") {

      slot = shooterSlot;

    }

    else if (heroClass === "Bomber") {

      slot = bomberSlot;

    }

    else if (heroClass === "Shield") {

      slot = shieldSlot;

    }


    if (!slot) {
      return;
    }


    const imageBox =
      slot.querySelector(".cage-hero-image");

    const name =
      slot.querySelector("strong");

    const className =
      slot.querySelector("small");


    if (imageBox) {

      imageBox.innerHTML = `
        <img
          src="${hero.image}"
          alt="${hero.name}"
        >
      `;

    }


    if (name) {

      name.textContent =
        hero.name;

    }


    if (className) {

      className.textContent =
        heroClass.toUpperCase();

    }

  }


  /* =======================================================
     TROOP FORMATION
  ======================================================= */

  function updateCageFormation() {

    let shield = 0;

    let bomber = 0;


    /* -------------------------------------------------------
       ADA
       +1% SHIELD
    ------------------------------------------------------- */

    if (
      selectedHeroes.Shooter &&
      selectedHeroes.Shooter.name === "Ada"
    ) {

      shield = 1;

    }


/* -------------------------------------------------------
   BOMBER
------------------------------------------------------- */

if (selectedHeroes.Bomber) {

  const bomberHero = selectedHeroes.Bomber.name;

  const adaSelected =
    selectedHeroes.Shooter &&
    selectedHeroes.Shooter.name === "Ada";


  if (bomberHero === "Wukong") {

    // Wukong: Ada varsa 9%, yoksa 15%
    bomber = adaSelected ? 14 : 15;

  } else {

    // Diğer Bomberlar: Ada varsa 9%, yoksa 10%
    bomber = adaSelected ? 9 : 10;

  }

}


    /* -------------------------------------------------------
       SHOOTER = REMAINING %
    ------------------------------------------------------- */

    let shooter =
      100 - shield - bomber;


    if (shooter < 0) {

      shooter = 0;

    }


    /* -------------------------------------------------------
       UPDATE SCREEN
    ------------------------------------------------------- */

    if (shieldPercent) {

      shieldPercent.textContent =
        shield + "%";

    }


    if (bomberPercent) {

      bomberPercent.textContent =
        bomber + "%";

    }


    if (shooterPercent) {

      shooterPercent.textContent =
        shooter + "%";

    }

  }


  /* =======================================================
     CLOSE POPUP
  ======================================================= */

  function closeCagePicker() {

    picker.classList.add("hidden");

    document.body.style.overflow = "";

    activeClass = null;

  }


  /* =======================================================
     SLOT CLICK EVENTS
  ======================================================= */

  shooterSlot.addEventListener(
    "click",
    function () {

      openCagePicker("Shooter");

    }
  );


  bomberSlot.addEventListener(
    "click",
    function () {

      openCagePicker("Bomber");

    }
  );


  shieldSlot.addEventListener(
    "click",
    function () {

      openCagePicker("Shield");

    }
  );


  /* =======================================================
     CLOSE BUTTON
  ======================================================= */

  if (closeButton) {

    closeButton.addEventListener(
      "click",
      closeCagePicker
    );

  }


  /* =======================================================
     BACKDROP
  ======================================================= */

  const backdrop =
    picker.querySelector(".cage-picker-backdrop");


  if (backdrop) {

    backdrop.addEventListener(
      "click",
      closeCagePicker
    );

  }


  /* =======================================================
     ESC
  ======================================================= */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Escape" &&
        !picker.classList.contains("hidden")
      ) {

        closeCagePicker();

      }

    }
  );


  /* =======================================================
     INITIAL FORMATION
  ======================================================= */

  updateCageFormation();


  console.log(
    "Cage Hero Selector loaded successfully."
  );

});
