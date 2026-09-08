"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncPlayerButton({ pageName }: { pageName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setPending(true); setMessage("");
    const response = await fetch("/api/sync/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageName })
    });
    const result = await response.json() as { handle?: string; error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error || "同步失败");
    setMessage(`已同步 ${result.handle}`);
    router.refresh();
  }

  return <div className="player-sync">
    <button onClick={sync} disabled={pending}>{pending ? "同步中…" : "同步该选手"}</button>
    {message && <small>{message}</small>}
  </div>;
}
