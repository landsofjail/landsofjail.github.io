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
const classIcons = { Shield: "SH", Shooter: "AT", Rider: "RD" };

fetch("heroes.json")
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load heroes.json");
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
    grid.innerHTML = `<div class="empty-state">Hero data could not be loaded. ${escapeHtml(error.message)}</div>`;
  });

function normalizeHero(hero) {
  const rarityBase = getRarityBase(hero.rarity);
  const normalized = {
    ...hero,
    name: cleanEnglishName(hero.name || hero.displayName || "Unknown Hero"),
    displayName: cleanEnglishName(hero.displayName || hero.name || "Unknown Hero"),
    rarityBase,
    season: hero.season || getSeasonFromRarity(hero.rarity) || "Base",
    class: hero.class || hero.type || "Unknown",
    type: hero.type || hero.class || "Unknown",
    stats: normalizeStats(hero.stats),
    arrestSkills: normalizeSkillList(hero.arrestSkills || hero.skills),
    warSkills: normalizeSkillList(hero.warSkills || hero.warSkill),
    exclusiveEquipment: normalizeSkillList(hero.exclusiveEquipment || hero.equipment),
  };

  return mergeLocalHero(normalized);
}

function mergeLocalHero(hero) {
  return hero;
}

function normalizeHeroWithoutLocal(hero) {
  return {
    ...hero,
    name: cleanEnglishName(hero.name || hero.displayName || "Unknown Hero"),
    displayName: cleanEnglishName(hero.displayName || hero.name || "Unknown Hero"),
    rarityBase: getRarityBase(hero.rarity),
    season: hero.season || getSeasonFromRarity(hero.rarity) || "Base",
    class: hero.class || hero.type || "Unknown",
    type: hero.type || hero.class || "Unknown",
    stats: normalizeStats(hero.stats),
    arrestSkills: normalizeSkillList(hero.arrestSkills || hero.skills),
    warSkills: normalizeSkillList(hero.warSkills || hero.warSkill),
    exclusiveEquipment: normalizeSkillList(hero.exclusiveEquipment || hero.equipment),
  };
}

function cleanEnglishName(name) {
  return String(name).replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim();
}

function getRarityBase(value = "") {
  if (String(value).startsWith("SSR")) return "SSR";
  if (String(value).startsWith("SR")) return "SR";
  if (String(value).startsWith("R")) return "R";
  return "R";
}

function getSeasonFromRarity(value = "") {
  const match = String(value).match(/S-\d+/);
  return match ? match[0] : "";
}

function normalizeStats(stats = {}) {
  return {
    arrestATK: stats.arrestATK ?? stats.arrestAtk ?? "",
    arrestDEF: stats.arrestDEF ?? stats.arrestDef ?? "",
    arrestHP: stats.arrestHP ?? stats.arrestHp ?? "",
    warATKDEF: stats.warATKDEF ?? stats.warAtkDef ?? "",
  };
}

function normalizeSkillList(value) {
  if (!value) return [];

  const list = Array.isArray(value) ? value : [value];

  return list.filter(Boolean).map((skill, index) => {
    if (typeof skill === "string") {
      return {
        name: index === 0 ? "TODO" : `TODO ${index + 1}`,
        icon: "",
        description: skill,
        levels: []
      };
    }

    return {
      name: skill.name || "TODO",
      icon: skill.icon || "",
      description: skill.description || "",
      levels: skill.levels || []
    };
  });
}

function populateSeasonFilter() {
  const seasonSelect = document.querySelector("#season");
  if (!seasonSelect) return;

  const seasons = [...new Set(heroes.map((hero) => hero.season).filter(Boolean))].sort(compareSeason);
  seasonSelect.innerHTML = `<option value="All">All Seasons</option>${seasons
    .map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`)
    .join("")}`;
  seasonSelect.value = season;
}

function compareSeason(a, b) {
  if (a === "Base") return -1;
  if (b === "Base") return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

function render() {
  const q = document.querySelector("#search").value.toLowerCase().trim();
  const sort = document.querySelector("#sort").value;

  visibleHeroes = heroes
    .filter((hero) => {
      const matchesRarity = rarity === "All" || hero.rarityBase === rarity;
      const matchesClass = heroClass === "All" || hero.class === heroClass;
      const matchesSeason = season === "All" || hero.season === season;
      const matchesSearch = hero.name.toLowerCase().includes(q);
      return matchesRarity && matchesClass && matchesSeason && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (rarityRank[b.rarityBase] || 0) - (rarityRank[a.rarityBase] || 0) || a.name.localeCompare(b.name);
    });

  count.textContent = `${visibleHeroes.length} heroes`;
  grid.innerHTML = visibleHeroes.length
    ? visibleHeroes.map(renderCard).join("")
    : `<div class="empty-state">No heroes match these filters.</div>`;

  document.querySelectorAll(".card").forEach((card) => {
    card.onclick = () => openHero(card.dataset.id);
  });
}

function renderCard(hero) {
  return `<article class="card ${hero.rarityBase.toLowerCase()}" data-id="${escapeAttr(hero.id)}">
    <div class="portrait">
      <img src="${escapeAttr(hero.image)}" alt="${escapeAttr(hero.name)}" loading="lazy">
      <div class="type-dot">${escapeHtml(classIcons[hero.class] || hero.class.slice(0, 2).toUpperCase())}</div>
      <div class="rarity-glow">${escapeHtml(hero.rarityBase)}</div>
    </div>
    <div class="card-body">
      <span class="pill ${hero.rarityBase.toLowerCase()}">${escapeHtml(hero.rarityBase)}</span>
      <button class="favorite-dot ${isFavorite(hero.id) ? "active" : ""}" type="button" aria-label="Favorite ${escapeAttr(hero.name)}" onclick="toggleFavorite(event,'${escapeAttr(hero.id)}')">F</button>
      <h3>${escapeHtml(hero.name)}</h3>
      <p>${escapeHtml(hero.class)} / ${escapeHtml(hero.season)}</p>
    </div>
  </article>`;
}

function getHero(id) {
  return heroes.find((hero) => hero.id === id);
}

async function openHero(id) {
  current = getHero(id);
  if (!current) return;
  renderDetail(current);
  modal.classList.remove("hidden");
  if (typeof history !== "undefined" && location.hash !== `#${current.id}`) {
    history.replaceState(null, "", `#${current.id}`);
  }
}

function openHeroFromHash() {
  const id = (location.hash || "").replace("#", "");
  if (id && heroes.some((hero) => hero.id === id)) openHero(id);
}

function renderDetail(hero) {
  const stats = hero.stats || {};

  modalContent.innerHTML = `<div class="hero-detail ${hero.rarityBase.toLowerCase()}">
    <div class="detail-hero">
      <div class="detail-image-frame">
        <img src="${escapeAttr(hero.image)}" alt="${escapeAttr(hero.name)}">
      </div>
      <div class="detail-main">
        <div class="detail-actions">
          <span class="pill ${hero.rarityBase.toLowerCase()}">${escapeHtml(hero.rarityBase)}</span>
          <button class="ghost-btn ${isFavorite(hero.id) ? "active" : ""}" type="button" onclick="toggleFavorite(event,'${escapeAttr(hero.id)}')">${isFavorite(hero.id) ? "Favorited" : "Favorite"}</button>
          <button class="share-btn" type="button" onclick="shareHero()">Share</button>
        </div>
        <h2>${escapeHtml(hero.name)}</h2>
        <p class="detail-sub">${escapeHtml(hero.description || hero.subtitle || "TODO: Add hero overview.")}</p>
        <div class="detail-meta">
          <span>${escapeHtml(hero.rarityBase)}</span>
          <span>${escapeHtml(hero.season)}</span>
          <span>${escapeHtml(hero.class)}</span>
        </div>
      </div>
    </div>

    <section class="detail-section">
      <div class="detail-title"><span></span><h3>Stats</h3></div>
      <div class="stats-grid">
        ${renderStat("War ATK", stats.arrestATK)}
        ${renderStat(" DEF", stats.arrestDEF)}
        ${renderStat("Arrest HP", stats.arrestHP)}
        ${renderStat("War ATK/DEF", stats.warATKDEF)}
      </div>
    </section>

    ${renderSkillSection("Arrest Skills", hero.arrestSkills)}
    ${renderSkillSection("War Skills", hero.warSkills)}
    ${renderSkillSection("Exclusive Equipment", hero.exclusiveEquipment)}

    

    <div class="detail-footer">
      <button type="button" onclick="prevHero()">Previous</button>
      <button type="button" onclick="closeModal()">Close</button>
      <button type="button" onclick="nextHero()">Next</button>
    </div>
  </div>`;
}

function renderStat(label, value) {
  return `<div class="stat"><small>${escapeHtml(label)}</small><b>${formatValue(value)}</b></div>`;
}

function renderSkillSection(title, skills) {
  const isExclusive = title === "Exclusive Equipment";
  const skillList = skills && skills.length
    ? skills
    : Array.from({ length: isExclusive ? 1 : 3 }, () => null);

  return `<section class="detail-section">
    <div class="detail-title">
      <span></span>
      <h3>${escapeHtml(title)}</h3>
    </div>

    <div class="skills-grid">
      ${skillList.map(skill =>
        skill ? renderSkill(skill) : renderEmptySkill()
      ).join("")}
    </div>
  </section>`;
}

function renderSkill(skill) {
  const levels = skill.levels || {};

  // Sadece maksimum seviye
  const maxLevel =
    levels["5"] ||
    levels[5] ||
    levels[4] ||
    {};

  let description = skill.description || "";

  // {A}, {B}, {C} değerlerini Lv.5'ten al
  Object.entries(maxLevel).forEach(([key, value]) => {
    if (value !== "-" && value !== "" && value != null) {
      description = description.replace(
        new RegExp("\\{" + key + "\\}", "g"),
        String(value)
      );
    }
  });

  return `<article class="skill-card">
    <div class="skill-icon">
      ${skill.icon ? `<img src="${escapeAttr(skill.icon)}" alt="">` : "SK"}
    </div>

    <div class="skill-copy">
      <h4>${escapeHtml(skill.name || "TODO")}</h4>

      <p>
        ${escapeHtml(
          description || "Skill data has not been added yet."
        )}
      </p>

      <div class="levels">
        <span class="filled">Lv.5</span>
      </div>
    </div>
  </article>`;
}
function renderEmptySkill() {
  return `<article class="skill-card empty-skill">
    <div class="skill-icon">SK</div>

    <div class="skill-copy">
      <h4>TODO</h4>

      <p>Skill data has not been added yet.</p>

      <div class="levels">
        <span>Lv.5: TODO</span>
      </div>
    </div>
  </article>`;
}

function renderLevels(levels = {}) {
  const value =
    levels["5"] ||
    levels[5] ||
    levels[4] ||
    null;

  if (value && typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([key, val]) => val !== "-" && val !== "" && val != null)
      .map(([key, val]) => `${key}: ${val}`)
      .join(" | ");

    return `<div class="levels">
      <span class="filled">Lv.5${parts ? `: ${escapeHtml(parts)}` : ""}</span>
    </div>`;
  }

  return `<div class="levels">
    <span>Lv.5: TODO</span>
  </div>`;
}

function renderList(items = []) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>TODO: Add entries.</p>`;
}

function editHero() {
  const hero = current;
  if (!hero) return;
  const rating = hero.rating || {};

  editor.classList.remove("hidden");
  editorContent.innerHTML = `<div class="editor-head">
    <h2>Edit ${escapeHtml(hero.name)}</h2>
    <button class="close-editor" onclick="closeEditor()">X</button>
  </div>
  <label>Name<input id="e-name" value="${escapeAttr(hero.name || "")}"></label>
  <div class="form-grid">
    <label>Tier<input id="e-tier" value="${escapeAttr(hero.tier || "")}"></label>
    <label>Overall<input id="e-overall" value="${escapeAttr(rating.overall || "")}"></label>
    <label>Rally<input id="e-rally" value="${escapeAttr(rating.rally || "")}"></label>
    <label>Defense<input id="e-defense" value="${escapeAttr(rating.defense || "")}"></label>
    <label>Arena<input id="e-arena" value="${escapeAttr(rating.arena || "")}"></label>
    <label>Value<input id="e-value" value="${escapeAttr(rating.value || "")}"></label>
    <label class="wide">Overview<textarea id="e-description">${escapeHtml(hero.description || "")}</textarea></label>
    <label class="wide">Best Teams (one per line)<textarea id="e-bt">${escapeHtml((hero.bestTeams || hero.recommendedTeams || []).join("\n"))}</textarea></label>
    <label class="wide">Notes<textarea id="e-notes">${escapeHtml(hero.notes || "")}</textarea></label>
  </div>
  <div class="editor-actions">
    <button onclick="saveLocal()">Save in Browser</button>
    <button onclick="downloadHero()">Download JSON</button>
  </div>
  <p class="editor-hint">Browser saves stay on this device. Use Download JSON to export the updated hero object.</p>`;
}

function collect() {
  const hero = structuredClone(current);
  hero.name = val("#e-name");
  hero.displayName = hero.name;
  hero.tier = val("#e-tier");
  hero.rating = {
    overall: val("#e-overall"),
    rally: val("#e-rally"),
    defense: val("#e-defense"),
    arena: val("#e-arena"),
    value: val("#e-value"),
  };
  hero.description = val("#e-description");
  hero.bestTeams = lines("#e-bt");
  hero.notes = val("#e-notes");
  hero.lastUpdated = new Date().toISOString().slice(0, 10);
  return normalizeHeroWithoutLocal(hero);
}

function saveLocal() {
  current = collect();
  const index = heroes.findIndex((hero) => hero.id === current.id);
  if (index >= 0) heroes[index] = current;
  localStorage.setItem(`loj:${current.id}`, JSON.stringify(current));
  renderDetail(current);
  render();
  closeEditor();
  alert("Saved in this browser.");
}

function downloadHero() {
  const hero = collect();
  const blob = new Blob([JSON.stringify(hero, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${hero.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function shareHero() {
  if (!current) return;
  const url = `${location.href.split("#")[0]}#${current.id}`;
  if (navigator.share) {
    navigator.share({ title: `${current.name} - Lands of Jail`, url });
  } else {
    navigator.clipboard?.writeText(url);
  }
}

function toggleFavorite(event, id) {
  event?.stopPropagation();
  const favorites = getFavorites();
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  localStorage.setItem("loj:favorites", JSON.stringify([...favorites]));
  render();
  if (current?.id === id) renderDetail(current);
}

function getFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem("loj:favorites") || "[]"));
  } catch {
    return new Set();
  }
}

function isFavorite(id) {
  return getFavorites().has(id);
}

function move(dir) {
  if (!current) return;
  const list = visibleHeroes.length ? visibleHeroes : heroes;
  let index = list.findIndex((hero) => hero.id === current.id);
  index = (index + dir + list.length) % list.length;
  openHero(list[index].id);
}

function prevHero() {
  move(-1);
}

function nextHero() {
  move(1);
}

function closeModal() {
  modal.classList.add("hidden");
  if (typeof history !== "undefined" && location.hash === `#${current?.id}`) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function closeEditor() {
  editor.classList.add("hidden");
}

function active(selector, value) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function val(selector) {
  return document.querySelector(selector).value.trim();
}

function lines(selector) {
  return val(selector).split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatValue(value) {
  if (value === 0) return "0";
  if (!value) return "TODO";
  return escapeHtml(String(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function hasClass(element, name) {
  if (element.classList.contains) return element.classList.contains(name);
  return Boolean(element.classList.classes?.has(name));
}

document.querySelectorAll("#rarityFilters .chip").forEach((button) => {
  button.onclick = () => {
    rarity = button.dataset.value;
    active("#rarityFilters .chip", rarity);
    render();
  };
});

document.querySelectorAll("#roleFilters .chip").forEach((button) => {
  button.onclick = () => {
    heroClass = button.dataset.value;
    active("#roleFilters .chip", heroClass);
    render();
  };
});

document.querySelector("#season").onchange = (event) => {
  season = event.target.value;
  render();
};

document.querySelector("#sort").onchange = render;
document.querySelector("#search").oninput = render;
document.querySelector("#clear").onclick = () => {
  rarity = "All";
  heroClass = "All";
  season = "All";
  document.querySelector("#search").value = "";
  document.querySelector("#season").value = "All";
  active("#rarityFilters .chip", "All");
  active("#roleFilters .chip", "All");
  render();
};

document.querySelectorAll("[data-close]").forEach((item) => {
  item.onclick = closeModal;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    closeEditor();
  }
  if (!hasClass(modal, "hidden") && event.key === "ArrowLeft") prevHero();
  if (!hasClass(modal, "hidden") && event.key === "ArrowRight") nextHero();
});

document.querySelector("#themeBtn").onclick = () => document.body.classList.toggle("light");
