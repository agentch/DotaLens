import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SyncPlayerButton } from "@/components/sync-player-button";

function date(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "未知";
}

export default async function AchievementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    include: { achievements: { orderBy: { startDate: "desc" } } }
  });
  if (!player) notFound();

  return <main>
    <Link className="back" href="/">← 返回选手列表</Link>
    <section className="profile compact">
      <div className="avatar large">{player.handle.slice(0, 1).toUpperCase()}</div>
      <div><p className="eyebrow">PLAYER ACHIEVEMENTS</p><h1>{player.handle}</h1><p className="subtitle">Liquipedia 精选主要成绩</p><SyncPlayerButton pageName={player.handle} /></div>
    </section>

    <nav className="player-tabs">
      <Link href={`/players/${player.id}`}>参赛履历</Link>
      <Link className="active" href={`/players/${player.id}/achievements`}>主要成就</Link>
    </nav>

    <section className="panel">
      <div className="panel-heading"><div><h2>Achievements</h2><small>{player.achievements.length} 条</small></div></div>
      {player.achievements.map((item) => <div className="row event" key={item.id}>
        <div><strong>{item.tournament}</strong><small>{[date(item.startDate), item.teamName, item.tier, item.result].filter(Boolean).join(" · ")}</small></div>
        <span>{[item.placement, item.prize].filter(Boolean).join(" · ") || "—"}</span>
      </div>)}
      {!player.achievements.length && <p className="empty">暂无主要成就，请重新同步该选手。</p>}
    </section>

    <footer>数据来源：<a href={player.sourceUrl} target="_blank" rel="noreferrer">Liquipedia</a> · 同步于 {player.syncedAt.toLocaleString("zh-CN")}</footer>
  </main>;
}
