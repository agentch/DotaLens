import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SyncTeamForm } from "@/components/sync-team-form";

const date = (value: Date | null) => value?.toLocaleDateString("zh-CN", { timeZone: "UTC" }) || "暂无";
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const team = await prisma.team.findUnique({ where: { id: Number((await params).id) }, include: { members: { orderBy: [{ role: "asc" }, { handle: "asc" }] } } });
  if (!team) notFound();
  return <main><Link className="back" href="/teams">← 返回俱乐部</Link><div className="profile compact"><div className="avatar large">{team.name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">CLUB PROFILE</p><h1>{team.name}</h1><p className="subtitle">{[team.location, team.region].filter(Boolean).join(" · ") || "资料待同步"}</p><SyncTeamForm pageName={team.pageName} /></div></div>
    {team.inactive && <p className="notice">Liquipedia 已将该俱乐部标记为停止运营。</p>}<div className="team-meta"><div><small>成立时间</small><strong>{date(team.createdDate)}</strong></div><div><small>赞助信息</small><strong>{team.sponsors || "暂无"}</strong></div><div><small>最近同步</small><strong>{team.syncedAt ? date(team.syncedAt) : "尚未同步"}</strong></div></div>
    <section className="panel"><h2>当前人员</h2>{team.members.map((member) => <div className="row" key={member.id}><div><strong>{member.handle}</strong><small>{member.realName || "实名暂无"}</small></div><small>{[member.role, member.joinDate ? date(member.joinDate) : null].filter(Boolean).join(" · ") || "角色暂无"}</small></div>)}{!team.members.length && <p className="empty">暂无人员数据，请同步该俱乐部。</p>}</section><footer>来源：<a href={team.sourceUrl} target="_blank" rel="noreferrer">Liquipedia</a></footer>
  </main>;
}
