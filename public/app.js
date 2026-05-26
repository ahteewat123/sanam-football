const state = {
  matches: [],
  view: "time",
  status: "all",
  query: "",
  league: "all",
  matchDay: readSeoMatchDay(),
  lastUpdated: null
};

const popularLeagueWords = [
  "Premier League",
  "Thai",
  "Champions League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Europa"
];

const matchesEl = document.querySelector("#matches");
const noticeEl = document.querySelector("#notice");
const updatedTextEl = document.querySelector("#updatedText");
const providerStateEl = document.querySelector("#providerState");
const matchSummaryEl = document.querySelector("#matchSummary");
const matchDayTitleEl = document.querySelector("#matchDayTitle");
const featuredLeaguesEl = document.querySelector("#featuredLeagues");
const dialogEl = document.querySelector("#detailDialog");

document.querySelectorAll(".toggle-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".toggle-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    renderMatches();
  });
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    setStatusFilter(button.dataset.status);
  });
});

document.querySelectorAll(".quick-tab").forEach((button) => {
  button.addEventListener("click", () => setStatusFilter(button.dataset.status));
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderMatches();
});

document.querySelector("#refreshButton").addEventListener("click", loadMatches);
document.querySelector("#closeDetail").addEventListener("click", closeDetail);
dialogEl.addEventListener("click", (event) => {
  if (event.target === dialogEl) closeDetail();
});

loadMatches();
setInterval(loadMatches, 60000);

async function loadMatches() {
  providerStateEl.textContent = "กำลังเชื่อมต่อ";
  providerStateEl.className = "provider-pill loading";
  setNotice("กำลังโหลดโปรแกรมและผลบอลจากผู้ให้บริการ...", "loading");
  matchDayTitleEl.textContent = `ผลบอลวันนี้ ${formatThaiDate(matchDayDate())}`;

  try {
    const response = await fetch(`${apiBaseUrl()}/api/matches`);
    const data = await response.json();
    const usable = data.ok ? data : data.latestAvailable;

    if (usable?.matches?.length) {
      state.matches = usable.matches;
      state.lastUpdated = usable.fetchedAt || usable.cachedAt;
      providerStateEl.textContent = data.ok ? "ข้อมูลสดจาก API" : "ใช้ข้อมูลล่าสุด";
      providerStateEl.className = data.ok ? "provider-pill online" : "provider-pill cached";
      setNotice(data.ok ? "" : "กำลังแสดงข้อมูลล่าสุดที่เคยโหลดได้ กรุณาลองใหม่อีกครั้งภายหลัง", data.ok ? "" : "warning");
    } else {
      state.matches = [];
      providerStateEl.textContent = "ไม่มีข้อมูล";
      providerStateEl.className = "provider-pill warning";
      setNotice("ยังไม่มีโปรแกรมหรือผลบอลจากผู้ให้บริการในขณะนี้", "empty", true);
    }
  } catch (error) {
    state.matches = [];
    providerStateEl.textContent = "เชื่อมต่อไม่ได้";
    providerStateEl.className = "provider-pill warning";
    setNotice("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error", true);
  }

  renderUpdatedText();
  renderFeaturedLeagues();
  renderMatches();
}

function apiBaseUrl() {
  return window.SANAM_CONFIG?.apiBaseUrl || "";
}

function renderMatches() {
  const visibleMatches = filterMatches(state.matches);
  renderSummary(visibleMatches);

  if (!visibleMatches.length) {
    matchesEl.innerHTML = `
      <div class="empty-list">
        <strong>ไม่พบคู่แข่งขันที่ตรงกับตัวกรอง</strong>
        <span>ลองล้างคำค้นหา หรือเลือกสถานะทั้งหมด</span>
      </div>
    `;
    return;
  }

  const groups = groupMatches(visibleMatches, state.view);
  matchesEl.innerHTML = groups.map(renderGroup).join("");

  matchesEl.querySelectorAll("[data-match-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = state.matches.find((item) => item.id === button.dataset.matchId);
      if (match) openDetail(match);
    });
  });
}

function setStatusFilter(status) {
  state.status = status;
  document.querySelectorAll(".filter-button, .quick-tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.status === status);
  });
  renderMatches();
}

function renderGroup(group) {
  const rows = group.matches.map(renderRow).join("");
  const color = group.color ? ` style="--league-color: ${escapeHtml(group.color)}"` : "";
  return `
    <section class="competition-group">
      <h3${color}>${escapeHtml(group.title)}</h3>
      <div class="table-head">
        <span>เวลาเริ่ม</span>
        <span>คู่การแข่งขัน</span>
        <span>สถานะ</span>
        <span>DETAIL</span>
      </div>
      ${rows}
    </section>
  `;
}

function renderRow(match) {
  const score = hasScore(match) ? `${match.homeScore} - ${match.awayScore}` : "VS";
  const status = labelStatus(match.status);
  const statusKind = statusKindOf(match.status);
  return `
    <article class="match-row">
      <time>${escapeHtml(formatMatchTime(match.startTime))}</time>
      <div class="teams">
        <strong>${escapeHtml(match.homeName)}</strong>
        <span class="${hasScore(match) ? "score" : "versus"}" title="${escapeHtml(status)}">${score}</span>
        <strong>${escapeHtml(match.awayName)}</strong>
      </div>
      <span class="match-status ${statusKind}">${escapeHtml(status)}</span>
      <button class="detail-button" data-match-id="${escapeHtml(match.id)}" type="button" aria-label="ดูรายละเอียด ${escapeHtml(match.homeName)} พบ ${escapeHtml(match.awayName)}">◎</button>
    </article>
  `;
}

function filterMatches(matches) {
  return matches.filter((match) => {
    const statusMatch = state.status === "all" || statusKindOf(match.status) === state.status;
    const haystack = `${match.homeName} ${match.awayName} ${match.competition}`.toLowerCase();
    const queryMatch = !state.query || haystack.includes(state.query);
    const leagueMatch = state.league === "all" || match.competition === state.league;
    return statusMatch && queryMatch && leagueMatch;
  });
}

function renderSummary(matches) {
  const live = matches.filter((match) => statusKindOf(match.status) === "live").length;
  const finished = matches.filter((match) => statusKindOf(match.status) === "finished").length;
  const scheduled = matches.filter((match) => statusKindOf(match.status) === "scheduled").length;
  matchSummaryEl.textContent = `${matches.length} คู่ • กำลังแข่ง ${live} • จบแล้ว ${finished} • ยังไม่เริ่ม ${scheduled}`;
}

function renderFeaturedLeagues() {
  const leagues = [...new Set(state.matches.map((match) => match.competition).filter(Boolean))];
  const popular = leagues
    .filter((league) => popularLeagueWords.some((word) => league.toLowerCase().includes(word.toLowerCase())))
    .slice(0, 6);
  const fallback = leagues.slice(0, Math.max(0, 6 - popular.length));
  const featured = [...new Set([...popular, ...fallback])];

  if (!featured.length) {
    featuredLeaguesEl.innerHTML = "";
    return;
  }

  featuredLeaguesEl.innerHTML = `
    <button class="${state.league === "all" ? "active" : ""}" data-league="all" type="button">ลีกทั้งหมด</button>
    ${featured
      .map(
        (league) =>
          `<button class="${state.league === league ? "active" : ""}" data-league="${escapeHtml(league)}" type="button">${escapeHtml(league)}</button>`
      )
      .join("")}
  `;

  featuredLeaguesEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.league = button.dataset.league;
      renderFeaturedLeagues();
      renderMatches();
    });
  });
}

function groupMatches(matches, view) {
  const sorted = [...matches].sort((a, b) => {
    const first = new Date(a.startTime || 0).getTime();
    const second = new Date(b.startTime || 0).getTime();
    return first - second;
  });

  if (view === "time") {
    return [{ title: "โปรแกรมบอลวันนี้", matches: sorted }];
  }

  const map = new Map();
  sorted.forEach((match) => {
    const key = match.competition || "Other Matches";
    if (!map.has(key)) map.set(key, { title: key, color: match.competitionColor, matches: [] });
    map.get(key).matches.push(match);
  });
  return [...map.values()];
}

function openDetail(match) {
  document.querySelector("#detailCompetition").textContent = match.competition || "รายละเอียดการแข่งขัน";
  document.querySelector("#detailTitle").textContent = `${match.homeName} พบ ${match.awayName}`;
  document.querySelector("#detailMeta").innerHTML = `
    <div><dt>เวลา</dt><dd>${escapeHtml(formatMatchTime(match.startTime))}</dd></div>
    <div><dt>สถานะ</dt><dd>${escapeHtml(labelStatus(match.status))}</dd></div>
    <div><dt>ผล</dt><dd>${hasScore(match) ? `${match.homeScore} - ${match.awayScore}` : "ยังไม่มีผล"}</dd></div>
    <div><dt>ลีก</dt><dd>${escapeHtml(match.competition || "-")}</dd></div>
    <div><dt>สนาม</dt><dd>${escapeHtml(match.detail?.venue || "-")}</dd></div>
    <div><dt>รอบ</dt><dd>${escapeHtml(match.detail?.round || "-")}</dd></div>
    <div><dt>อันดับ</dt><dd>${escapeHtml(formatRanks(match))}</dd></div>
    <div><dt>สภาพอากาศ</dt><dd>${escapeHtml(formatWeather(match))}</dd></div>
  `;
  dialogEl.hidden = false;
}

function closeDetail() {
  dialogEl.hidden = true;
}

function setNotice(message, tone, withRetry = false) {
  if (!message) {
    noticeEl.hidden = true;
    noticeEl.innerHTML = "";
    return;
  }

  noticeEl.hidden = false;
  noticeEl.className = `notice ${tone}`;
  noticeEl.innerHTML = `
    <span>${escapeHtml(message)}</span>
    ${withRetry ? '<button id="retryButton" type="button">ลองใหม่</button>' : ""}
  `;

  document.querySelector("#retryButton")?.addEventListener("click", loadMatches);
}

function renderUpdatedText() {
  updatedTextEl.textContent = state.lastUpdated
    ? `อัปเดตล่าสุด ${formatThaiDateTime(state.lastUpdated)}`
    : "รอข้อมูลจากผู้ให้บริการ";
}

function formatThaiDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function matchDayDate() {
  const [year, month, day] = state.matchDay.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function readSeoMatchDay() {
  const routeData = document.querySelector("#seo-route-data")?.textContent;
  if (routeData) {
    try {
      const parsed = JSON.parse(routeData);
      if (parsed.matchDay) return parsed.matchDay;
    } catch (error) {
      // Ignore malformed SEO data and fall back to Thailand today.
    }
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatThaiDateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMatchTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function labelStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["-1", "3", "finished", "ended"].includes(value)) return "จบการแข่งขัน";
  if (["0", "notstarted", "scheduled"].includes(value)) return "ยังไม่เริ่ม";
  if (["1", "live", "inplay"].includes(value)) return "กำลังแข่งขัน";
  if (["2", "half"].includes(value)) return "พักครึ่ง";
  return status || "-";
}

function statusKindOf(status) {
  const value = String(status || "").toLowerCase();
  if (["-1", "3", "finished", "ended"].includes(value)) return "finished";
  if (["1", "2", "live", "inplay", "half"].includes(value)) return "live";
  return "scheduled";
}

function hasScore(match) {
  return match.homeScore !== null && match.awayScore !== null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRanks(match) {
  const home = match.detail?.homeRank;
  const away = match.detail?.awayRank;
  if (!home && !away) return "-";
  return `${match.homeName}: ${home || "-"} / ${match.awayName}: ${away || "-"}`;
}

function formatWeather(match) {
  const weather = match.detail?.weather;
  const temperature = match.detail?.temperature;
  if (!weather && !temperature) return "-";
  return [weather, temperature].filter(Boolean).join(", ");
}
