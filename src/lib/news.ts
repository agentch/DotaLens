const API_URL = "https://liquipedia.net/dota2/api.php";

export type TransferNews = { date: string; players: string[]; previous: string; current: string; previousRole?: string; currentRole?: string; statusChange?: "active_to_inactive" | "inactive_to_active"; sourceUrl?: string };
export type WikiUpdate = { title: string; timestamp: string; comment?: string; url: string };

function text(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function cell(block: string, className: string, nextClass: string) {
  return block.match(new RegExp(`<div class="divCell [^"]*${className}[^"]*">([\\s\\S]*?)<div class="divCell [^"]*${nextClass}`, "i"))?.[1] || "";
}

export function parseTransfers(html: string): TransferNews[] {
  return html.split(/<div class="divRow mainpage-transfer[^"]*">/).slice(1).flatMap((block) => {
    const date = block.match(/<div class="divCell Date">([^<]+)<\/div>/)?.[1]?.trim();
    const nameBlock = cell(block, "Name", "Team OldTeam");
    const oldBlock = cell(block, "OldTeam", "Icon");
    const newBlock = cell(block, "NewTeam", "Ref");
    const players = [...nameBlock.matchAll(/<span class="name"[^>]*>[\s\S]*?<a [^>]*title="([^"]+)"/g)].map((match) => text(match[1]));
    if (!date || !players.length) return [];
    const team = (value: string) => value.match(/<a [^>]*title="([^"]+)"/)?.[1] || text(value) || "无俱乐部";
    const previous = team(oldBlock);
    const current = team(newBlock);
    const transferRole = (value: string) => {
      const content = text(value);
      const match = content.match(/\b(Assistant Coach|Stand-in|Substitute|Inactive|Coach|Analyst|Manager|Captain)\b/i)?.[1];
      if (!match) return undefined;
      return match.toLocaleLowerCase().replace(/(^|[-\s])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
    };
    const previousRole = transferRole(oldBlock);
    const currentRole = transferRole(newBlock);
    const oldInactive = previousRole === "Inactive";
    const newInactive = currentRole === "Inactive";
    const statusChange = previous === current && oldInactive !== newInactive
      ? oldInactive ? "inactive_to_active" as const : "active_to_inactive" as const
      : undefined;
    const sourceUrl = block.match(/<a [^>]*class="external text" href="([^"]+)"/)?.[1];
    return [{ date, players, previous, current, ...(previousRole ? { previousRole } : {}), ...(currentRole ? { currentRole } : {}), ...(statusChange ? { statusChange } : {}), sourceUrl }];
  });
}

async function api(params: URLSearchParams) {
  const userAgent = process.env.LIQUIPEDIA_USER_AGENT;
  if (!userAgent) throw new Error("缺少 LIQUIPEDIA_USER_AGENT");
  const response = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`Liquipedia API 请求失败：HTTP ${response.status}`);
  return response.json();
}

export async function getTransfers(now = new Date()) {
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const page = `Transfers/${now.getUTCFullYear()}/${quarter}${quarter === 1 ? "st" : quarter === 2 ? "nd" : quarter === 3 ? "rd" : "th"} Quarter`;
  const params = new URLSearchParams({ action: "parse", format: "json", formatversion: "2", page, prop: "text" });
  const data = await api(params) as { parse?: { text?: string } };
  return { page, items: parseTransfers(data.parse?.text || "").slice(0, 30) };
}

export async function getRecentUpdates(teamNames: string[]) {
  const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", list: "recentchanges", rcnamespace: "0", rclimit: "250", rcprop: "title|timestamp|comment|ids", rctype: "edit|new" });
  const data = await api(params) as { query?: { recentchanges?: Array<{ title: string; timestamp: string; comment?: string }> } };
  const updates = (data.query?.recentchanges || []).map((item) => ({ ...item, url: `https://liquipedia.net/dota2/${encodeURIComponent(item.title).replaceAll("%2F", "/")}` }));
  const teams = new Set(teamNames.map((name) => name.toLocaleLowerCase()));
  return {
    game: updates.filter((item) => /(^|\/)(version|patch)|hero|item|gameplay/i.test(item.title)).slice(0, 20),
    clubs: updates.filter((item) => teams.has(item.title.toLocaleLowerCase())).slice(0, 20)
  };
}
