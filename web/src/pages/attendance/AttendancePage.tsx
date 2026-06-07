import { useEffect, useState } from "react";
import {
  checkIn, checkOut, myAttendance, myLeaves, requestLeave,
  allAttendance, allLeaves, approveLeave, rejectLeave, deleteAttendanceRecord,
} from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import type { AttendanceRecord, LeaveRequest } from "@/types";

type Tab = "attendance" | "leaves";

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ["admin", "hr_manager", "dept_manager"].includes(user?.role ?? "");

  const [tab, setTab] = useState<Tab>("attendance");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves]   = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    start_date: "", end_date: "", leave_type: "annual" as const, reason: "",
  });
  const [msg, setMsg]     = useState("");
  const [error, setError] = useState("");

  const loadAttendance = () =>
    (isAdmin ? allAttendance() : myAttendance())
      .then(setRecords)
      .catch((e: any) => setError(e?.response?.data?.detail ?? "Failed to load"));

  const loadLeaves = () =>
    (isAdmin ? allLeaves() : myLeaves())
      .then(setLeaves)
      .catch(() => {});

  useEffect(() => { loadAttendance(); loadLeaves(); }, [isAdmin]);

  const flash = (ok: boolean, text: string) => {
    if (ok) setMsg(text); else setError(text);
    setTimeout(() => { setMsg(""); setError(""); }, 3000);
  };

  const handleClockIn = async () => {
    try { await checkIn(); flash(true, "Clocked in ✅"); loadAttendance(); }
    catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleClockOut = async () => {
    try { await checkOut(); flash(true, "Clocked out ✅"); loadAttendance(); }
    catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleLeave = async () => {
    try {
      await requestLeave({ ...leaveForm });
      flash(true, "Leave request submitted ✅");
      setLeaveForm({ start_date: "", end_date: "", leave_type: "annual", reason: "" });
      loadLeaves();
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    try {
      action === "approve" ? await approveLeave(id) : await rejectLeave(id);
      flash(true, `Leave ${action}d ✅`);
      loadLeaves();
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Permanently delete this attendance record? This cannot be undone.")) return;
    try {
      await deleteAttendanceRecord(id);
      flash(true, "Record deleted");
      loadAttendance();
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const fmt = (dt: string) => new Date(dt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const statusBadge = (status: string) => {
    const cls = status === "approved" ? "bg-green-100 text-green-700"
      : status === "rejected" ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["attendance", "leaves"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "attendance" ? "Clock Records" : "Leave Requests"}
            </button>
          ))}
        </div>
      </div>

      {msg   && <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}
      {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* ── CLOCK RECORDS TAB ── */}
      {tab === "attendance" && (
        <>
          {!isAdmin && (
            <div className="flex gap-3">
              <button onClick={handleClockIn}
                className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                🟢 Clock In
              </button>
              <button onClick={handleClockOut}
                className="bg-orange-500 text-white px-5 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium">
                🔴 Clock Out
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <span className="font-semibold text-gray-700 text-sm">
                {isAdmin ? "All Employee Clock Records" : "My Clock Records"}
              </span>
              <button onClick={loadAttendance} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {isAdmin && <th className="px-4 py-3 text-left">Employee</th>}
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Clock In</th>
                  <th className="px-4 py-3 text-left">Clock Out</th>
                  <th className="px-4 py-3 text-left">Hours</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">
                        {r.employee_id.slice(0, 8)}…
                      </td>
                    )}
                    <td className="px-4 py-2 font-medium">{r.date}</td>
                    <td className="px-4 py-2 text-gray-700">{fmt(r.check_in)}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {r.check_out ? fmt(r.check_out) : <span className="text-orange-500 text-xs">Active</span>}
                    </td>
                    <td className="px-4 py-2">
                      {r.total_hours
                        ? <span className="text-green-700 font-medium">{r.total_hours}h</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.check_out
                        ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Done</span>
                        : <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">In Progress</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        <button onClick={() => handleDeleteRecord(r.id)}
                          className="text-red-500 hover:text-red-700 text-xs hover:underline">
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 5}
                      className="px-4 py-8 text-center text-gray-400">
                      No clock records yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── LEAVE REQUESTS TAB ── */}
      {tab === "leaves" && (
        <>
          {!isAdmin && (
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">Request Leave</h2>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Start Date</label>
                  <input type="date" value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">End Date</label>
                  <input type="date" value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Type</label>
                  <select value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, leave_type: e.target.value as any }))}
                    className="border rounded px-2 py-1.5 text-sm">
                    {["annual","sick","unpaid","other"].map((t) =>
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-32">
                  <label className="text-xs text-gray-500">Reason (optional)</label>
                  <input value={leaveForm.reason}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex items-end">
                  <button onClick={handleLeave}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <span className="font-semibold text-gray-700 text-sm">
                {isAdmin ? "All Leave Requests" : "My Leave Requests"}
              </span>
              <button onClick={loadLeaves} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {isAdmin && <th className="px-4 py-3 text-left">Employee</th>}
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">
                        {l.employee_id.slice(0, 8)}…
                      </td>
                    )}
                    <td className="px-4 py-2 capitalize">{l.leave_type}</td>
                    <td className="px-4 py-2">{l.start_date}</td>
                    <td className="px-4 py-2">{l.end_date}</td>
                    <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{l.reason ?? "—"}</td>
                    <td className="px-4 py-2">{statusBadge(l.status)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        {l.status === "pending" ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleAction(l.id, "approve")}
                              className="bg-green-600 text-white px-2 py-0.5 rounded text-xs hover:bg-green-700">
                              Approve
                            </button>
                            <button onClick={() => handleAction(l.id, "reject")}
                              className="bg-red-500 text-white px-2 py-0.5 rounded text-xs hover:bg-red-600">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {l.reviewed_at ? new Date(l.reviewed_at).toLocaleDateString() : "—"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 5}
                      className="px-4 py-8 text-center text-gray-400">
                      No leave requests yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
