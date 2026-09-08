import { NextResponse } from "next/server";
import { getRecentUpdates, getTransfers } from "@/lib/news";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const run = await prisma.syncRun.create({ data: { source: "liquipedia-news", status: "running" } });
  try {
    const teamNames = (await prisma.teamTenure.findMany({ select: { teamName: true }, distinct: ["teamName"] })).map((item) => item.teamName);
    const transfers = await getTransfers();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const updates = await getRecentUpdates(teamNames);

    await prisma.$transaction([
      ...transfers.items.map((item) => prisma.transferUpdate.upsert({
        where: { date_players_previous_current: { date: item.date, players: item.players.join("、"), previous: item.previous, current: item.current } },
        update: { previousRole: item.previousRole, currentRole: item.currentRole, statusChange: item.statusChange, sourceUrl: item.sourceUrl, syncedAt: new Date() },
        create: { date: item.date, players: item.players.join("、"), previous: item.previous, current: item.current, previousRole: item.previousRole, currentRole: item.currentRole, statusChange: item.statusChange, sourceUrl: item.sourceUrl }
      })),
      ...updates.clubs.map((item) => prisma.newsUpdate.upsert({
        where: { category_title_timestamp: { category: "club", title: item.title, timestamp: new Date(item.timestamp) } },
        update: { comment: item.comment, url: item.url, syncedAt: new Date() },
        create: { category: "club", title: item.title, timestamp: new Date(item.timestamp), comment: item.comment, url: item.url }
      })),
      ...updates.game.map((item) => prisma.newsUpdate.upsert({
        where: { category_title_timestamp: { category: "game", title: item.title, timestamp: new Date(item.timestamp) } },
        update: { comment: item.comment, url: item.url, syncedAt: new Date() },
        create: { category: "game", title: item.title, timestamp: new Date(item.timestamp), comment: item.comment, url: item.url }
      }))
    ]);

    const imported = transfers.items.length + updates.clubs.length + updates.game.length;
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "success", imported, finishedAt: new Date() } });
    return NextResponse.json({ imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "动态同步失败";
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "failed", message, finishedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
