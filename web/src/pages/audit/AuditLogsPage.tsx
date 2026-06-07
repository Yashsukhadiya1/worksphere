import { useEffect, useState } from "react";
import { listAuditLogs } from "@/api/endpoints";
import type { AuditLog } from "@/types";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { listAuditLogs().then(setLogs); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Audit Logs</h1>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>{["ID","Actor","Action","Entity","Entity ID","Time"].map((h) => <th key={h} className="px-3 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{l.id}</td>
                <td className="px-3 py-2 font-mono">{l.actor_user_id.slice(0,8)}…</td>
                <td className="px-3 py-2 font-medium">{l.action}</td>
                <td className="px-3 py-2">{l.entity_type}</td>
                <td className="px-3 py-2 font-mono">{l.entity_id.slice(0,8)}…</td>
                <td className="px-3 py-2 text-gray-400">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
