import { useEffect, useState } from "react";
import { myNotifications, markRead, sendNotification, sentNotifications, listEmployees } from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import type { Notification, EmployeeSummary } from "@/types";

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "hr_manager";

  const [inbox, setInbox] = useState<Notification[]>([]);
  const [sent, setSent] = useState<Notification[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [tab, setTab] = useState<"compose" | "sent">("compose");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadInbox = () => myNotifications().then(setInbox);
  const loadSent = () => sentNotifications().then(setSent);

  useEffect(() => {
    loadInbox();
    if (isAdmin) {
      listEmployees().then(setEmployees);
      loadSent();
    }
  }, [isAdmin]);

  const handleRead = async (id: string) => {
    await markRead(id);
    setInbox((p) => p.filter((n) => n.id !== id));
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setMsg(""); setError("");
    try {
      await sendNotification(title.trim(), body.trim(), targetId || undefined);
      setMsg(targetId ? "Sent to employee ✅" : "Broadcast sent to all employees ✅");
      setTitle(""); setBody(""); setTargetId("");
      loadSent();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "Unknown";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>

      {/* Admin panel */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b">
            {(["compose", "sent"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}>
                {t === "compose" ? "Compose" : `Sent ${sent.length > 0 ? `(${sent.length})` : ""}`}
              </button>
            ))}
          </div>

          {tab === "compose" && (
            <div className="p-5 space-y-4">
              {msg   && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Send to</label>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">📢 All Employees (Broadcast)</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.job_title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Office Closed Tomorrow"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Message</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)}
                  rows={3} placeholder="Write your message here..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {sending ? "Sending…" : targetId ? "Send to Employee" : "Broadcast to All"}
              </button>
            </div>
          )}

          {tab === "sent" && (
            <div className="divide-y max-h-96 overflow-y-auto">
              {sent.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400">No notifications sent yet.</p>
              )}
              {sent.map((n) => (
                <div key={n.id} className="px-5 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {n.is_read ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        ✓ Read by {n.read_by_name}
                        {n.read_at && <span className="text-gray-400 ml-1">{new Date(n.read_at).toLocaleDateString()}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">Unread</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My inbox */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-700">
          My Inbox
          {inbox.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{inbox.length}</span>
          )}
        </h2>
        {inbox.length === 0 && <p className="text-gray-400 text-sm">No unread notifications.</p>}
        <ul className="space-y-2">
          {inbox.map((n) => (
            <li key={n.id} className="bg-white rounded-xl shadow px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                <p className="text-gray-600 text-xs mt-0.5">{n.body}</p>
                <p className="text-gray-400 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => handleRead(n.id)}
                className="text-blue-600 hover:underline text-xs whitespace-nowrap">
                Mark read
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
