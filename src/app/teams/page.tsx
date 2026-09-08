import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SyncTeamForm } from "@/components/sync-team-form";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({ where: { inactive: false, disbandedDate: null }, orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } });
  return <main><header><nav className="main-nav"><Link href="/">选手</Link><Link href="/teams">俱乐部</Link><Link href="/news">动态</Link></nav><p className="eyebrow">ACTIVE CLUBS</p><h1>俱乐部</h1><p className="subtitle">只展示当前仍在运营的 Dota 2 俱乐部。</p></header><SyncTeamForm />
    <section><div className="section-title"><h2>当前俱乐部</h2><span>{teams.length} 条</span></div><div className="grid">{teams.map((team) => <Link className="card card-link" href={`/teams/${team.id}`} key={team.id}><div className="avatar">{team.name.slice(0, 1).toUpperCase()}</div><div><h3>{team.name}</h3><p>{[team.location, team.region].filter(Boolean).join(" · ") || "资料待同步"}</p><small>{team.syncedAt ? `${team._count.members} 名当前人员` : "点击进入后同步详情"}</small></div></Link>)}</div>{!teams.length && <p className="empty">暂无俱乐部，请输入名称同步。</p>}</section>
  </main>;
}
