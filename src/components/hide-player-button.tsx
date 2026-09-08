"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HidePlayerButton({ id, handle }: { id: number; handle: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function hide() {
    if (!window.confirm(`从选手页面隐藏 ${handle}？数据库中的保留，再次同步后会恢复显示。`)) return;
    setPending(true);
    const response = await fetch(`/api/players/${id}/hide`, { method: "POST" });
    setPending(false);
    if (response.ok) router.refresh();
    else window.alert("隐藏失败，请稍后重试。");
  }

  return <button className="hide-player" type="button" onClick={hide} disabled={pending} aria-label={`隐藏 ${handle}`}>{pending ? "处理中…" : "隐藏"}</button>;
}
