import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SyncNewsButton } from "@/components/sync-news-button";

export const dynamic = "force-dynamic";

function time(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export default async function NewsPage() {
  const [transfers, clubs, game, lastSync] = await Promise.all([
    prisma.transferUpdate.findMany({ orderBy: { date: "desc" }, take: 30 }),
    prisma.newsUpdate.findMany({ where: { category: "club" }, orderBy: { timestamp: "desc" }, take: 20 }),
    prisma.newsUpdate.findMany({ where: { category: "game" }, orderBy: { timestamp: "desc" }, take: 20 }),
    prisma.syncRun.findFirst({ where: { source: "liquipedia-news", status: "success" }, orderBy: { finishedAt: "desc" } })
  ]);

  return <main>
    <nav className="main-nav"><Link href="/">选手</Link><Link href="/teams">俱乐部</Link><Link href="/news">动态</Link></nav>
    <header><p className="eyebrow">LIQUIPEDIA UPDATES</p><h1>动态</h1><p className="subtitle">人员调整与已关注俱乐部、游戏资料的近期变化。</p><SyncNewsButton />{lastSync?.finishedAt && <small>最近同步：{time(lastSync.finishedAt.toISOString())}</small>}</header>

    <section className="panel"><div className="panel-heading"><div><h2>人员调整</h2><small>{transfers.length} 条最新记录</small></div><a href="https://liquipedia.net/dota2/Transfers" target="_blank" rel="noreferrer">查看来源</a></div>
      {transfers.map((item) => {
        const sameTeam = item.previous === item.current;
        const roleChange = sameTeam && item.previousRole !== item.currentRole && (item.previousRole || item.currentRole)
          ? `${item.previousRole || "Active"} → ${item.currentRole || "Active"}` : null;
        const previous = `${item.previous}${item.previousRole ? ` (${item.previousRole})` : ""}`;
        const current = `${item.current}${item.currentRole ? ` (${item.currentRole})` : ""}`;
        return <div className="row news-row" key={item.id}><div><strong>{item.players}</strong>{roleChange ? <small><span className={`status-change ${item.statusChange || "role-change"}`}>{roleChange}</span><span>{item.previous}</span></small> : <small>{previous} → {current}</small>}</div><div><span>{item.date}</span>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">来源</a>}</div></div>;
      })}
      {!transfers.length && <p className="empty">暂无本地动态，请点击“同步动态”。</p>}
    </section>

    <div className="news-columns">
      <section className="panel"><h2>俱乐部动态</h2><p className="panel-description">已同步选手效力过的俱乐部页面更新。</p>{clubs.map((item) => <a className="update" href={item.url} target="_blank" rel="noreferrer" key={item.id}><strong>{item.title}</strong><small>{time(item.timestamp.toISOString())}{item.comment ? ` · ${item.comment}` : ""}</small></a>)}{!clubs.length && <p className="empty">近期没有匹配的俱乐部更新。</p>}</section>
      <section className="panel"><h2>游戏动态</h2><p className="panel-description">版本、英雄、物品等 Liquipedia 页面更新。</p>{game.map((item) => <a className="update" href={item.url} target="_blank" rel="noreferrer" key={item.id}><strong>{item.title}</strong><small>{time(item.timestamp.toISOString())}{item.comment ? ` · ${item.comment}` : ""}</small></a>)}{!game.length && <p className="empty">近期没有匹配的游戏资料更新。</p>}</section>
    </div>
  </main>;
}
