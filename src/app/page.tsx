import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SyncPlayerForm } from "@/components/sync-player-form";
import { HidePlayerButton } from "@/components/hide-player-button";

type SearchParams = Promise<{ q?: string; nationality?: string; role?: string; team?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", nationality = "", role = "", team = "" } = await searchParams;
  const normalizedRole = role.toLocaleLowerCase();
  let players = await prisma.player.findMany({
    where: {
      AND: [
        { hiddenAt: null },
        q ? { OR: [{ handle: { contains: q } }, { realName: { contains: q } }, { aliases: { some: { alias: { contains: q } } } }] } : {},
        nationality ? { nationality } : {},
        team ? { teamTenures: { some: { teamName: team } } } : {}
      ]
    }
  });
  if (normalizedRole) {
    players = players.filter((player) => player.role?.split(",").some((item) => item.trim().toLocaleLowerCase() === normalizedRole));
  }
  const playerCollator = new Intl.Collator("en", { sensitivity: "base", numeric: false });
  players.sort((a, b) => playerCollator.compare(a.handle, b.handle));

  const nationalities = (await prisma.player.findMany({
    where: { hiddenAt: null },
    select: { nationality: true },
    distinct: ["nationality"]
  })).flatMap(({ nationality }) => nationality ? [nationality] : []);
  nationalities.sort((a, b) => a.localeCompare(b));

  const roles = [...new Set((await prisma.player.findMany({ where: { hiddenAt: null }, select: { role: true } }))
    .flatMap(({ role }) => role ? role.split(",").map((item) => item.trim().toLocaleLowerCase()).filter(Boolean) : []))]
    .sort((a, b) => a.localeCompare(b));
  const roleLabel = (value: string) => /^[a-z]/.test(value) ? value[0].toUpperCase() + value.slice(1) : value;

  const teams = [...new Set((await prisma.teamTenure.findMany({ where: { player: { hiddenAt: null } }, select: { teamName: true } })).map(({ teamName }) => teamName))]
    .sort((a, b) => a.localeCompare(b));

  return (
    <main>
      <header>
        <nav className="main-nav"><Link href="/">选手</Link><Link href="/teams">俱乐部</Link><Link href="/news">动态</Link></nav>
        <p className="eyebrow">LOCAL PLAYER ARCHIVE</p>
        <h1>DotaLens</h1>
        <p className="subtitle">快速查询 Dota 2 选手资料、战队经历和参赛履历。</p>
      </header>

      <SyncPlayerForm />

      <form className="search">
        <input name="q" defaultValue={q} placeholder="输入选手 ID、实名或别名" aria-label="搜索选手" />
        <select name="nationality" defaultValue={nationality} aria-label="国籍">
          <option value="">全部国籍</option>
          {nationalities.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="role" defaultValue={normalizedRole} aria-label="选手位置">
          <option value="">全部位置</option>
          {roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
        </select>
        <select name="team" defaultValue={team} aria-label="历史效力俱乐部">
          <option value="">全部俱乐部</option>
          {teams.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="submit">搜索</button>
        {(q || nationality || role || team) && <Link className="reset" href="/">清除筛选</Link>}
      </form>

      <section>
        <div className="section-title"><h2>选手</h2><span>{players.length} 条</span></div>
        <div className="grid">
          {players.map((player) => (
            <article className="card" key={player.id}>
              <Link className="card-link" href={`/players/${player.id}`}>
                <div className="avatar">{player.handle.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>{player.handle}</h3>
                  <p>{player.realName || "实名暂无"}</p>
                  <small>{[player.nationality, player.currentTeam, player.role].filter(Boolean).join(" · ") || "资料待完善"}</small>
                </div>
              </Link>
              <HidePlayerButton id={player.id} handle={player.handle} />
            </article>
          ))}
        </div>
        {!players.length && <p className="empty">没有找到匹配的选手。</p>}
      </section>
    </main>
  );
}
