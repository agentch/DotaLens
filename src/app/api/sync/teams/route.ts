import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLiquipediaTeam } from "@/lib/liquipedia-team";

export async function POST(request: Request) {
  try {
    const { pageName: input } = await request.json() as { pageName?: string }; const pageName = input?.trim();
    if (!pageName || pageName.length > 100 || /[\p{C}<>]/u.test(pageName)) throw new Error("请输入有效的俱乐部名称");
    const source = await fetchLiquipediaTeam(pageName);
    const values = { name: source.name, location: source.location, region: source.region, sponsors: source.sponsors, website: source.website, createdDate: source.createdDate, disbandedDate: source.disbandedDate, inactive: source.inactive, sourceUrl: source.sourceUrl, sourceUpdatedAt: source.sourceUpdatedAt, syncedAt: new Date() };
    const team = await prisma.team.upsert({ where: { pageName: source.pageName }, update: { ...values, members: { deleteMany: {}, create: source.members } }, create: { ...values, pageName: source.pageName, members: { create: source.members } } });
    return NextResponse.json({ id: team.id, name: team.name, inactive: team.inactive });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "同步失败" }, { status: 400 }); }
}
