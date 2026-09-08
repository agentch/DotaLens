import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.player.upsert({
    where: { liquipediaPageId: 1 },
    update: {},
    create: {
      handle: "示例选手",
      realName: "等待 Liquipedia API 同步",
      nationality: "—",
      status: "sample",
      role: "核心",
      currentTeam: "示例战队",
      liquipediaPageId: 1,
      sourceUrl: "https://liquipedia.net/dota2/Portal:Players",
      aliases: { create: [{ alias: "demo" }] },
      teamTenures: { create: [{ teamName: "示例战队", role: "核心" }] },
      participations: {
        create: [{
          tournament: "示例赛事",
          teamName: "示例战队",
          placement: "—",
          result: "等待同步",
          tournamentUrl: "https://liquipedia.net/dota2/Portal:Tournaments"
        }]
      }
    }
  });
}

main().finally(() => prisma.$disconnect());
