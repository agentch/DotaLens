import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "无效的选手 ID" }, { status: 400 });

  try {
    await prisma.player.update({ where: { id }, data: { hiddenAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "找不到选手" }, { status: 404 });
  }
}
