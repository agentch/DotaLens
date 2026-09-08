"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SyncPlayerForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/sync/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageName: data.get("pageName") }) });
      const result = await response.json() as { handle?: string; error?: string };
      if (!response.ok) return setMessage(result.error || "同步失败");
      setMessage(`已同步 ${result.handle}`); form.reset(); router.refresh();
    } catch {
      setMessage("网络连接失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <form className="sync" onSubmit={submit} autoComplete="off">
    <div><strong>同步 Liquipedia 选手</strong><p>可输入不完整 ID，例如 miracle 会自动匹配 Miracle-</p></div>
    <input name="pageName" required disabled={pending} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="选手 ID" aria-label="选手 ID" />
    <button disabled={pending}>{pending ? "同步中…" : "同步"}</button>
    {pending && <div className="sync-loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><span>正在从 Liquipedia 获取选手资料与赛事记录，首次同步可能需要约 30 秒…</span></div>}
    {!pending && message && <output>{message}</output>}
  </form>;
}
