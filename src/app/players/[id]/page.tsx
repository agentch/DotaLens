import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SyncPlayerButton } from "@/components/sync-player-button";

function date(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "未知";
}

type SearchParams = Promise<{ tier?: string }>;

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const { tier = "" } = await searchParams;
  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    include: {
      aliases: true,
      teamTenures: { orderBy: { startDate: "desc" } },
      participations: { orderBy: { startDate: "desc" } }
    }
  });
  if (!player) notFound();

  const tiers = [...new Set(player.participations.flatMap((item) => item.tier ? [item.tier] : []))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const results = tier ? player.participations.filter((item) => item.tier === tier) : player.participations;
  const championships = tiers.map((name) => ({
    tier: name,
    count: player.participations.filter((item) => item.tier === name && item.placement === "1").length
  })).filter((item) => item.count > 0);
  const queriedAt = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date());

  return (
    <main>
      <Link className="back" href="/">← 返回选手列表</Link>
      <section className="profile">
        <div className="avatar large">{player.handle.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">PLAYER PROFILE</p>
          <h1>{player.handle}</h1>
          <p className="subtitle">{player.realName || "实名暂无"}</p>
          <div className="tags">
            {[player.nationality, player.status, player.role, player.currentTeam].filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          {player.birthDate && <small>出生日期：{date(player.birthDate)}</small>}
          <SyncPlayerButton pageName={player.handle} />
        </div>
      </section>

      <nav className="player-tabs">
        <Link className="active" href={`/players/${player.id}`}>参赛履历</Link>
        <Link href={`/players/${player.id}/achievements`}>主要成就</Link>
      </nav>

      <section className="stats">
        <div><small>个人 Total Winnings</small><strong>{player.totalWinnings || "暂无"}</strong><span>Liquipedia 估算个人总奖金</span></div>
        <div><small>赛事记录</small><strong>{player.participations.length}</strong><span>统计截至 {queriedAt}</span></div>
        {championships.map((item) => <div key={item.tier}><small>{item.tier}</small><strong>{item.count} 冠</strong></div>)}
        <p className="stats-note">冠军按赛事最终名次第 1 名统计，仅展示至少获得过一次冠军的级别。</p>
      </section>

      <section className="panel">
        <h2>战队经历</h2>
        {player.teamTenures.map((item) => <div className="row" key={item.id}><strong>{item.teamName}</strong><span>{date(item.startDate)} — {item.endDate ? date(item.endDate) : "至今"}</span></div>)}
        {!player.teamTenures.length && <p className="empty">暂无战队经历。</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>参赛履历</h2><small>{tier ? `${tier} · ${results.length} 条` : `全部 · ${results.length} 条`}</small></div>
          <form>
            <select name="tier" defaultValue={tier} aria-label="赛事级别">
              <option value="">全部级别</option>
              {tiers.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit">筛选</button>
          </form>
        </div>
        {results.map((item) => (
          <div className="row event" key={item.id}>
            <div><strong>{item.tournament}</strong><small>{[date(item.startDate), item.teamName, item.tier, item.result].filter(Boolean).join(" · ")}</small></div>
            <span>{[item.placement, item.prize].filter(Boolean).join(" · ") || "—"}</span>
          </div>
        ))}
        {!results.length && <p className="empty">该级别暂无参赛记录。</p>}
      </section>

      <footer>数据来源：<a href={player.sourceUrl} target="_blank" rel="noreferrer">Liquipedia</a> · 同步于 {player.syncedAt.toLocaleString("zh-CN")}</footer>
    </main>
  );
}
