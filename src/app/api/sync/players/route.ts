import { NextResponse } from "next/server";
import { fetchLiquipediaPlayer } from "@/lib/liquipedia";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const run = await prisma.syncRun.create({ data: { source: "liquipedia", status: "running" } });
  try {
    const { pageName: input } = await request.json() as { pageName?: string };
    const pageName = input?.trim();
    if (!pageName || pageName.length > 100 || /[\p{C}<>]/u.test(pageName)) throw new Error("请输入有效的选手 ID");
    const source = await fetchLiquipediaPlayer(pageName);
    const values = { handle: source.handle, realName: source.realName, nationality: source.nationality, birthDate: source.birthDate, status: source.status, role: source.roles.join(", ") || undefined, currentTeam: source.currentTeam, totalWinnings: source.totalWinnings, sourceUrl: source.sourceUrl, sourceUpdatedAt: source.revisionTimestamp, syncedAt: new Date(), hiddenAt: null };
    const tenures = source.teamTenures.map((item) => ({ teamName: item.teamName, startDate: item.startDate, endDate: item.endDate }));
    const resultRows = source.results.map((item) => ({ tournament: item.tournament, tournamentUrl: item.tournamentUrl, startDate: item.date, tier: item.tier, teamName: item.teamName, placement: item.placement, result: item.result, prize: item.prize }));
    const achievementRows = source.achievements.map((item) => ({ tournament: item.tournament, tournamentUrl: item.tournamentUrl, startDate: item.date, tier: item.tier, teamName: item.teamName, placement: item.placement, result: item.result, prize: item.prize }));
    const player = await prisma.player.upsert({
      where: { liquipediaPageId: source.pageId },
      update: {
        ...values,
        aliases: { deleteMany: {}, create: source.aliases.map((alias) => ({ alias })) },
        teamTenures: { deleteMany: {}, create: tenures },
        participations: { deleteMany: {}, create: resultRows },
        achievements: { deleteMany: {}, create: achievementRows }
      },
      create: {
        ...values,
        liquipediaPageId: source.pageId,
        aliases: { create: source.aliases.map((alias) => ({ alias })) },
        teamTenures: { create: tenures },
        participations: { create: resultRows },
        achievements: { create: achievementRows }
      }
    });
    if (source.currentTeam) {
      await prisma.team.upsert({
        where: { pageName: source.currentTeam },
        update: { name: source.currentTeam, inactive: false, disbandedDate: null },
        create: { name: source.currentTeam, pageName: source.currentTeam, sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(source.currentTeam)}` }
      });
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "success", imported: 1, finishedAt: new Date() } });
    return NextResponse.json({ id: player.id, handle: player.handle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "failed", message, finishedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
