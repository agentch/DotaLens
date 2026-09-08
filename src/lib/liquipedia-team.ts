import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeSearchInput } from "./liquipedia.ts";

const API_URL = "https://liquipedia.net/dota2/api.php";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
type Page = { pageid?: number; title: string; revisions?: Array<{ timestamp: string; slots: { main: { content: string } } }> };
export type TeamMemberData = { handle: string; realName?: string; role?: string; joinDate?: Date };

function field(source: string, name: string) {
  const value = source.match(new RegExp(`^\\|${name}=([^\\n]*)`, "mi"))?.[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  return value || undefined;
}

function plain(value?: string) {
  return value?.replace(/<br\s*\/?\s*>/gi, ", ").replace(/\[\[[^\]|]+\|([^\]]+)]]/g, "$1").replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)]/g, "$1").replace(/<[^>]+>/g, "").replace(/'''?/g, "").replace(/\s+/g, " ").trim() || undefined;
}

function date(value?: string) {
  const match = value?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return match ? new Date(`${match}T00:00:00Z`) : undefined;
}

function text(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function parseTeamMembersHtml(html: string): TeamMemberData[] {
  const start = html.search(/id="Active_Roster"/i);
  if (start < 0) return [];
  const tail = html.slice(start); const end = tail.search(/<h2\b/i); const section = end > 0 ? tail.slice(0, end) : tail;
  const seen = new Set<string>();
  return [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 2) return [];
    const link = cells[0].match(/<a [^>]*href="\/dota2\/[^"#]+"[^>]*title="([^"]+)"/i);
    const handle = text(link?.[1] || cells[0]);
    if (!handle || /^(id|name)$/i.test(handle)) return [];
    const role = text(cells[2] || "") || undefined; const key = `${handle}|${role || ""}`;
    if (seen.has(key)) return []; seen.add(key);
    return [{ handle, realName: text(cells[1]) || undefined, role, joinDate: date(text(cells[3] || "")) }];
  });
}

async function request(params: URLSearchParams) {
  const userAgent = process.env.LIQUIPEDIA_USER_AGENT;
  if (!userAgent) throw new Error("请先在 .env 中配置 LIQUIPEDIA_USER_AGENT");
  const response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip" } });
  if (!response.ok) throw new Error(`Liquipedia 俱乐部请求失败：HTTP ${response.status}`);
  return response.json();
}

export async function fetchLiquipediaTeam(input: string) {
  const directory = path.join(process.cwd(), "data", "cache"); const file = path.join(directory, `team-${encodeURIComponent(input)}.json`);
  try { const cached = JSON.parse(await readFile(file, "utf8")); if (Date.now() - cached.savedAt < CACHE_MAX_AGE) return parse(cached.page, cached.html); } catch { /* no cache */ }
  const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", generator: "search", gsrsearch: normalizeSearchInput(input), gsrnamespace: "0", gsrlimit: "10", prop: "revisions", rvprop: "timestamp|content", rvslots: "main" });
  const pages = ((await request(params)) as { query?: { pages?: Page[] } }).query?.pages || []; const wanted = input.toLocaleLowerCase();
  const page = pages.filter((item) => /\{\{Infobox team\b/i.test(item.revisions?.[0]?.slots.main.content || "")).sort((a, b) => Number(a.title.toLocaleLowerCase() !== wanted) - Number(b.title.toLocaleLowerCase() !== wanted))[0];
  if (!page?.pageid || !page.revisions?.[0]) throw new Error(`找不到俱乐部：${input}`);
  const rendered = await request(new URLSearchParams({ action: "parse", format: "json", formatversion: "2", page: page.title, prop: "text" })) as { parse?: { text?: string } }; const html = rendered.parse?.text || "";
  await mkdir(directory, { recursive: true }); await writeFile(file, JSON.stringify({ savedAt: Date.now(), page, html }), "utf8"); return parse(page, html);
}

function parse(page: Page, html: string) {
  const revision = page.revisions![0]; const source = revision.slots.main.content;
  return { pageName: page.title, name: plain(field(source, "name")) || page.title, location: plain(field(source, "location")), region: plain(field(source, "region")), sponsors: plain(field(source, "sponsor")), website: plain(field(source, "website")), createdDate: date(field(source, "created")), disbandedDate: date(field(source, "disbanded")), inactive: /^(true|yes|1)$/i.test(field(source, "inactive") || "") || Boolean(field(source, "disbanded")), sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(page.title).replaceAll("%2F", "/")}`, sourceUpdatedAt: new Date(revision.timestamp), members: parseTeamMembersHtml(html) };
}
