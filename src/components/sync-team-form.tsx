"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SyncTeamForm({ pageName }: { pageName?: string }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await fetch("/api/sync/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageName: pageName || data.get("pageName") }) }); const result = await response.json() as { name?: string; error?: string; inactive?: boolean };
      if (!response.ok) return setMessage(result.error || "同步失败"); setMessage(result.inactive ? `${result.name} 已停止运营` : `已同步 ${result.name}`); form.reset(); router.refresh();
    } catch { setMessage("网络连接失败"); } finally { setPending(false); }
  }
  return <form className={pageName ? "player-sync" : "sync"} onSubmit={submit} autoComplete="off">{!pageName && <><div><strong>同步 Liquipedia 俱乐部</strong><p>输入俱乐部名称，例如 Team Liquid</p></div><input name="pageName" required disabled={pending} placeholder="俱乐部名称" /></>}<button disabled={pending}>{pending ? "同步中…" : pageName ? "同步该俱乐部" : "同步"}</button>{message && <small>{message}</small>}</form>;
}
