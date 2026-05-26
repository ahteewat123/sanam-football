import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const env = loadEnv(join(root, ".env"));
const port = Number(env.PORT || process.env.PORT || 3000);
const apiKey = env.ISPORTS_API_KEY || process.env.ISPORTS_API_KEY || "";

let latestAvailable = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/matches") {
      await handleMatches(res);
      return;
    }

    if (url.pathname === "/robots.txt") {
      serveRobots(req, res);
      return;
    }

    if (url.pathname === "/sitemap.xml") {
      serveSitemap(req, res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, () => {
  console.log(`Football results site running at http://localhost:${port}`);
});

async function handleMatches(res) {
  if (!apiKey) {
    sendJson(res, 500, {
      ok: false,
      source: "missing-key",
      error: "ISPORTS_API_KEY is not configured",
      latestAvailable
    });
    return;
  }

  const providerUrl = new URL("http://api2.isportsapi.com/sport/football/livescores");
  providerUrl.searchParams.set("api_key", apiKey);

  try {
    const providerResponse = await fetch(providerUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });

    if (!providerResponse.ok) {
      throw new Error(`Provider returned HTTP ${providerResponse.status}`);
    }

    const raw = await providerResponse.json();
    const normalized = normalizeProviderPayload(raw);

    if (normalized.matches.length > 0) {
      latestAvailable = {
        ...normalized,
        cachedAt: new Date().toISOString()
      };
    }

    sendJson(res, 200, {
      ok: true,
      source: "provider",
      ...normalized,
      latestAvailable
    });
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      source: "latest-available",
      error: error instanceof Error ? error.message : String(error),
      latestAvailable
    });
  }
}

function normalizeProviderPayload(raw) {
  if (raw?.code !== undefined && raw.code !== 0) {
    throw new Error(raw.message || `Provider returned code ${raw.code}`);
  }

  const payload = raw?.data ?? raw?.matches ?? raw?.result ?? raw;
  const rows = Array.isArray(payload) ? payload : Object.values(payload || {});
  const matchDay = thaiDateKey(new Date());
  const matches = rows
    .map(normalizeMatch)
    .filter(Boolean)
    .filter((match) => !match.startTime || thaiDateKey(new Date(match.startTime)) === matchDay);

  return {
    fetchedAt: new Date().toISOString(),
    matches
  };
}

function normalizeMatch(row) {
  if (!row || typeof row !== "object") return null;

  const homeName = pick(row, ["homeName", "home_name", "home", "team_home", "home_team", "host_team", "home_team_name"]);
  const awayName = pick(row, ["awayName", "away_name", "away", "team_away", "away_team", "guest_team", "away_team_name"]);
  const competition = pick(row, ["leagueName", "league_name", "competition", "competition_name", "tournament_name"]) || "Other Matches";
  const status = pick(row, ["status", "match_status", "status_name", "state"]) || "scheduled";
  const startTime = normalizeTime(pick(row, ["matchTime", "match_time", "start_time", "kickoff", "time", "scheduled"]));
  const homeScore = pick(row, ["homeScore", "home_score", "score_home", "home_goals"]);
  const awayScore = pick(row, ["awayScore", "away_score", "score_away", "away_goals"]);

  if (!homeName && !awayName) return null;

  return {
    id: String(pick(row, ["matchId", "match_id", "id", "fixture_id"]) || `${homeName}-${awayName}-${startTime}`),
    competition,
    competitionColor: pick(row, ["leagueColor", "league_color"]) || "",
    startTime,
    homeName: String(homeName || "Home"),
    awayName: String(awayName || "Away"),
    homeScore: normalizeScore(homeScore),
    awayScore: normalizeScore(awayScore),
    status: String(status),
    rawStatus: String(status),
    detail: {
      round: pick(row, ["round", "round_name", "stage_name"]) || "",
      venue: pick(row, ["location", "venue", "stadium"]) || "",
      season: pick(row, ["season", "season_name"]) || "",
      weather: pick(row, ["weather"]) || "",
      temperature: pick(row, ["temperature"]) || "",
      homeRank: pick(row, ["homeRank", "home_rank"]) || "",
      awayRank: pick(row, ["awayRank", "away_rank"]) || ""
    }
  };
}

function normalizeScore(value) {
  if (value === undefined || value === null || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeTime(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const milliseconds = value > 9999999999 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function pick(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return "";
}

function thaiDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const target = normalize(join(publicDir, cleanPath));

  if (!target.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const file = existsSync(target) ? target : join(publicDir, "index.html");
  const fileExt = extname(file);
  let body = await readFile(file, fileExt === ".html" ? "utf8" : undefined);
  if (fileExt === ".html" || file.endsWith("index.html")) {
    body = injectSeo(body, pathname);
  }
  res.writeHead(200, { "Content-Type": mimeTypes[fileExt] || "application/octet-stream" });
  res.end(body);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  return Object.fromEntries(
    lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function injectSeo(html, pathname) {
  const match = pathname.match(/^\/football\/(\d{4}-\d{2}-\d{2})\/?$/);
  const date = match ? match[1] : thaiDateKey(new Date());
  const thaiDate = formatThaiDateFromKey(date);
  const title = `ผลบอลวันนี้ ${thaiDate} | สนามผลบอล`;
  const description = `ดูโปรแกรมบอลวันนี้ ${thaiDate} ผลบอลล่าสุด ตารางบอล และสถานะแมตช์จาก API อัปเดตตามเวลาไทยบนสนามผลบอล`;
  const canonicalPath = `/football/${date}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "สนามผลบอล",
    url: canonicalPath,
    description,
    inLanguage: "th-TH",
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonicalPath}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace("</head>", `<link rel="canonical" href="${canonicalPath}" />\n    <script id="seo-route-data" type="application/json">${JSON.stringify({ matchDay: date })}</script>\n  </head>`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
}

function serveRobots(req, res) {
  const origin = `http://${req.headers.host}`;
  const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function serveSitemap(req, res) {
  const origin = `http://${req.headers.host}`;
  const today = thaiDateKey(new Date());
  const days = [-2, -1, 0, 1, 2].map((offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return thaiDateKey(date);
  });
  const urls = ["/", ...days.map((day) => `/football/${day}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (path) => `  <url>\n    <loc>${origin}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>${path === "/" ? "1.0" : "0.8"}</priority>\n  </url>`
    )
    .join("\n")}\n</urlset>\n`;
  res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
  res.end(body);
}

function formatThaiDateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
