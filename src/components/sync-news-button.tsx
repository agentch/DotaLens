"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncNewsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setPending(true); setMessage("");
    const response = await fetch("/api/sync/news", { method: "POST" });
    const result = await response.json() as { imported?: number; error?: string };
    setPending(false);
    if (!response.ok) return setMessage(result.error || "同步失败");
    setMessage(`已同步 ${result.imported} 条动态`);
    router.refresh();
  }

  return <div className="sync-news"><button onClick={sync} disabled={pending}>{pending ? "同步中…" : "同步动态"}</button>{message && <small>{message}</small>}</div>;
}
