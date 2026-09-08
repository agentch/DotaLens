import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://liquipedia.net/dota2/api.php";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
let lastParseRequestAt = 0;

export type LiquipediaPlayer = {
  pageId: number;
  pageName: string;
  revisionTimestamp: Date;
  handle: string;
  realName?: string;
  aliases: string[];
  nationality?: string;
  birthDate?: Date;
  status?: string;
  roles: string[];
  sourceUrl: string;
  achievements: LiquipediaAchievement[];
  results: LiquipediaAchievement[];
  teamTenures: LiquipediaTeamTenure[];
  currentTeam?: string;
  totalWinnings?: string;
};

export type LiquipediaAchievement = { date: Date; placement?: string; tier?: string; tournament: string; teamName?: string; result?: string; prize?: string; tournamentUrl?: string };
export type LiquipediaTeamTenure = { teamName: string; startDate?: Date; endDate?: Date; isCurrent: boolean };

type ApiPage = { pageid?: number; title: string; missing?: boolean; index?: number; revisions?: Array<{ timestamp: string; slots: { main: { content: string } } }> };
type ApiResponse = { query?: { pages?: ApiPage[] } };

export function normalizeSearchInput(value: string) {
  return value.normalize("NFKC").replace(/[‐‑‒–—−]/g, "-").replace(/[‘’]/g, "'").trim();
}

function vowelVariants(value: string) {
  const variants = new Set<string>();
  const vowels = "aeiou";
  [...value].forEach((character, index) => {
    if (!vowels.includes(character.toLowerCase())) return;
    for (const vowel of vowels) variants.add(`${value.slice(0, index)}${vowel}${value.slice(index + 1)}`);
  });
  variants.delete(value);
  return [...variants];
}

function containsPlayerPage(data: ApiResponse) {
  return data.query?.pages?.some((page) => /\{\{Infobox player\b/i.test(page.revisions?.[0]?.slots.main.content || ""));
}

function field(source: string, name: string) {
  const value = source.match(new RegExp(`^\\|${name}=([^\\n]*)`, "mi"))?.[1]
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  return value || undefined;
}

function decodeHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&#58;/g, ":").replace(/&#8212;/g, "—").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function parseTeamHistoryHtml(html: string): LiquipediaTeamTenure[] {
  const rows = [...html.matchAll(/<tr>\s*<td class="th-mono"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g)];
  return rows.flatMap((row) => {
    const range = decodeHtml(row[1]);
    const dates = range.match(/^([\d?]{4}-[\d?]{2}-[\d?]{2})\s+—\s+(.+)$/);
    const teamName = row[2].match(/<a [^>]*title="([^"]+)"/)?.[1];
    if (!dates || !teamName) return [];
    const exactDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : undefined;
    return [{ teamName: decodeHtml(teamName), startDate: exactDate(dates[1]), endDate: exactDate(dates[2]), isCurrent: /Present/i.test(dates[2]) }];
  });
}

export function parseTotalWinningsHtml(html: string) {
  const match = html.match(/<div class="infobox-cell-2 infobox-description">(?:Approx\.\s*)?Total Winnings:<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
  return match ? decodeHtml(match[1]) : undefined;
}

export function parseAchievementsHtml(html: string): LiquipediaAchievement[] {
  const rows = [...html.matchAll(/<tr class="[^"]*table2(?:&#95;|_)&#95;row--body[^"]*">([\s\S]*?)<\/tr>/g)];
  return rows.flatMap((row) => {
    const cells = [...row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((match) => ({ attrs: match[1], html: match[2], text: decodeHtml(match[2]), sort: match[1].match(/data-sort-value="([^"]*)"/)?.[1] }));
    if (cells.length < 9 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0].text)) return [];
    const tournament = cells[4].sort || cells[4].text;
    const href = cells[4].html.match(/href="(\/dota2\/[^"]+)"/)?.[1];
    if (!tournament) return [];
    return [{
      date: new Date(`${cells[0].text}T00:00:00Z`),
      placement: cells[1].sort || cells[1].text,
      tier: cells[2].text,
      tournament,
      tournamentUrl: href ? `https://liquipedia.net${href}` : undefined,
      teamName: cells[5].sort || cells[5].text,
      result: cells[6].text,
      prize: cells.at(-1)?.text
    }];
  });
}

export function parsePlayerWikitext(pageId: number, pageName: string, timestamp: string, source: string, achievements: LiquipediaAchievement[] = [], teamTenures: LiquipediaTeamTenure[] = [], totalWinnings?: string): LiquipediaPlayer {
  const split = (value?: string) => (value || "").split(",").map((item) => item.trim()).filter(Boolean);
  const birthDateValue = field(source, "birth_date");
  return {
    pageId,
    pageName,
    revisionTimestamp: new Date(timestamp),
    handle: field(source, "id") || pageName,
    realName: field(source, "name"),
    aliases: split(field(source, "ids")),
    nationality: field(source, "country"),
    birthDate: birthDateValue && /^\d{4}-\d{2}-\d{2}$/.test(birthDateValue) ? new Date(`${birthDateValue}T00:00:00Z`) : undefined,
    status: field(source, "status"),
    roles: split(field(source, "roles")),
    sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(pageName).replaceAll("%2F", "/")}`,
    achievements,
    results: achievements,
    teamTenures,
    currentTeam: teamTenures.find((item) => item.isCurrent)?.teamName,
    totalWinnings
  };
}

async function getRenderedData(pageName: string) {
  const cacheDirectory = path.join(process.cwd(), "data", "cache");
  const cacheFile = path.join(cacheDirectory, `${encodeURIComponent(pageName)}-achievements.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8")) as { savedAt: number; html: string };
    if (Date.now() - cached.savedAt < CACHE_MAX_AGE) return { achievements: parseAchievementsHtml(cached.html), teamTenures: parseTeamHistoryHtml(cached.html), totalWinnings: parseTotalWinningsHtml(cached.html) };
  } catch { /* First sync has no cache. */ }

  const userAgent = process.env.LIQUIPEDIA_USER_AGENT;
  if (!userAgent) throw new Error("请先在 .env 中配置 LIQUIPEDIA_USER_AGENT");
  const waitMs = Math.max(0, 30_000 - (Date.now() - lastParseRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  const params = new URLSearchParams({ action: "parse", format: "json", formatversion: "2", page: pageName, prop: "text" });
  const response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip" } });
  lastParseRequestAt = Date.now();
  if (!response.ok) throw new Error(`Liquipedia 成就数据请求失败：HTTP ${response.status}`);
  const data = await response.json() as { parse?: { text?: string } };
  const html = data.parse?.text;
  if (!html) return { achievements: [], teamTenures: [], totalWinnings: undefined };
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ savedAt: Date.now(), html }), "utf8");
  return { achievements: parseAchievementsHtml(html), teamTenures: parseTeamHistoryHtml(html), totalWinnings: parseTotalWinningsHtml(html) };
}

async function getApiResponse(pageName: string): Promise<ApiResponse> {
  const searchInput = normalizeSearchInput(pageName);
  const cacheDirectory = path.join(process.cwd(), "data", "cache");
  const cacheFile = path.join(cacheDirectory, `${encodeURIComponent(pageName)}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8")) as { savedAt: number; data: ApiResponse };
    if (Date.now() - cached.savedAt < CACHE_MAX_AGE && containsPlayerPage(cached.data)) return cached.data;
  } catch { /* First sync has no cache. */ }

  const userAgent = process.env.LIQUIPEDIA_USER_AGENT;
  if (!userAgent) throw new Error("请先在 .env 中配置 LIQUIPEDIA_USER_AGENT");
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", generator: "search",
    gsrsearch: searchInput, gsrnamespace: "0", gsrlimit: "10",
    prop: "revisions", rvprop: "timestamp|content", rvslots: "main"
  });
  let response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip" } });
  if (!response.ok) throw new Error(`Liquipedia API 请求失败：HTTP ${response.status}`);
  let data = await response.json() as ApiResponse;
  if (!containsPlayerPage(data)) {
    const variants = vowelVariants(searchInput);
    if (variants.length) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      params.set("gsrsearch", variants.join(" OR "));
      response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip" } });
      if (!response.ok) throw new Error(`Liquipedia API 请求失败：HTTP ${response.status}`);
      data = await response.json() as ApiResponse;
    }
  }
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ savedAt: Date.now(), data }), "utf8");
  return data;
}

export async function fetchLiquipediaPlayer(pageName: string) {
  const pages = (await getApiResponse(pageName)).query?.pages || [];
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const wanted = normalize(pageName);
  const candidates = pages.flatMap((page) => {
    const content = page.revisions?.[0]?.slots.main.content;
    if (!content || !/\{\{Infobox player\b/i.test(content)) return [];
    const handle = field(content, "id") || page.title;
    const aliases = [...(field(content, "ids") || "").split(","), ...(field(content, "nicknames") || "").split(",")];
    const names = [page.title, handle, ...aliases].map((value) => normalize(value.trim())).filter(Boolean);
    const score = names.includes(wanted) ? 0 : names.some((value) => value.startsWith(wanted)) ? 1 : page.index ?? 99;
    return [{ page, score }];
  }).sort((a, b) => a.score - b.score || (a.page.index ?? 99) - (b.page.index ?? 99));
  const page = candidates[0]?.page;
  const revision = page?.revisions?.[0];
  if (!page || page.missing || !page.pageid || !revision) throw new Error(`找不到选手：${pageName}。请尝试更完整的游戏 ID`);
  if (candidates[1]?.score === candidates[0].score && candidates[1].page.title !== page.title) {
    throw new Error(`找到多个相近选手：${candidates.slice(0, 4).map((item) => item.page.title).join("、")}。请输入其中一个完整 ID`);
  }
  const profile = await getRenderedData(page.title);
  let results = await getRenderedData(`${page.title}/Results`);
  if (!results.achievements.length) results = profile;
  const player = parsePlayerWikitext(page.pageid, page.title, revision.timestamp, revision.slots.main.content, profile.achievements, profile.teamTenures, profile.totalWinnings);
  return { ...player, results: results.achievements };
}
