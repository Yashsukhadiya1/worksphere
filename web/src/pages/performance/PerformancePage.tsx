import { useEffect, useState } from "react";
import {
  listCycles, createCycle, submitReview, getCycleSummary,
  myGoals, createGoal, assignGoal, updateGoal,
  listEmployees, employeeReviews, employeeGoals,
} from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import type { CycleSummaryEntry, Goal, Review, ReviewCycle, EmployeeSummary } from "@/types";

type Tab = "reviews" | "goals";

export default function PerformancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ["admin", "hr_manager", "dept_manager"].includes(user?.role ?? "");

  const [tab, setTab] = useState<Tab>("goals");
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");

  // Cycles
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [cycleName, setCycleName] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");

  // Review form
  const [selectedCycle, setSelectedCycle] = useState("");
  const [rating, setRating] = useState("3");
  const [comments, setComments] = useState("");
  const [empReviews, setEmpReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<CycleSummaryEntry[]>([]);

  // Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalDue, setGoalDue] = useState("");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const flash = (ok: boolean, text: string) => {
    ok ? setMsg(text) : setError(text);
    setTimeout(() => { setMsg(""); setError(""); }, 3000);
  };

  useEffect(() => {
    listCycles().then(setCycles);
    if (isAdmin) {
      listEmployees().then(setEmployees);
    } else {
      myGoals().then(setGoals);
    }
  }, [isAdmin]);

  // When admin selects an employee, load their reviews + goals
  useEffect(() => {
    if (!isAdmin || !selectedEmpId) return;
    employeeReviews(selectedEmpId).then(setEmpReviews).catch(() => setEmpReviews([]));
    employeeGoals(selectedEmpId).then(setGoals).catch(() => setGoals([]));
  }, [selectedEmpId, isAdmin]);

  const handleCreateCycle = async () => {
    if (!cycleName || !cycleStart || !cycleEnd) return;
    try {
      await createCycle(cycleName, cycleStart, cycleEnd);
      listCycles().then(setCycles);
      setCycleName(""); setCycleStart(""); setCycleEnd("");
      flash(true, "Review cycle created ✅");
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleSubmitReview = async () => {
    if (!selectedCycle || !selectedEmpId) return flash(false, "Select a cycle and employee first");
    try {
      await submitReview({ cycle_id: selectedCycle, employee_id: selectedEmpId, rating: Number(rating), comments });
      flash(true, "Review submitted ✅ — employee notified");
      setComments(""); setRating("3");
      employeeReviews(selectedEmpId).then(setEmpReviews);
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleLoadSummary = async (cycleId: string) => {
    try {
      const data = await getCycleSummary(cycleId);
      setSummary(data);
    } catch (e: any) { flash(false, "Failed to load summary"); }
  };

  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) return;
    try {
      if (isAdmin && selectedEmpId) {
        const g = await assignGoal(selectedEmpId, { title: goalTitle, description: goalDesc || undefined, due_date: goalDue || undefined });
        setGoals((p) => [g, ...p]);
        flash(true, "Goal assigned to employee ✅");
      } else if (!isAdmin) {
        const g = await createGoal({ title: goalTitle, description: goalDesc || undefined, due_date: goalDue || undefined });
        setGoals((p) => [g, ...p]);
        flash(true, "Goal added ✅");
      }
      setGoalTitle(""); setGoalDesc(""); setGoalDue("");
    } catch (e: any) { flash(false, e?.response?.data?.detail ?? "Error"); }
  };

  const handleProgressUpdate = async (id: string, progress: number) => {
    try {
      const updated = await updateGoal(id, progress);
      setGoals((p) => p.map((g) => g.id === id ? updated : g));
    } catch (e: any) { flash(false, "Failed to update progress"); }
  };

  const stars = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Performance</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["goals", "reviews"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "goals" ? "Goals" : "Reviews"}
            </button>
          ))}
        </div>
      </div>

      {msg   && <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}
      {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Admin employee selector */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow p-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Select Employee</label>
          <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— Choose an employee —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name} — {e.job_title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── REVIEWS TAB ── */}
      {tab === "reviews" && (
        <div className="space-y-4">
          {/* Create cycle (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">Review Cycles</h2>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Cycle Name</label>
                  <input value={cycleName} onChange={(e) => setCycleName(e.target.value)}
                    placeholder="e.g. Q1 2026"
                    className="border rounded px-2 py-1.5 text-sm w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Start</label>
                  <input type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">End</label>
                  <input type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <button onClick={handleCreateCycle}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                  Create Cycle
                </button>
              </div>
              <ul className="divide-y text-sm">
                {cycles.map((c) => (
                  <li key={c.id} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 text-xs ml-2">{c.start_date} – {c.end_date}</span>
                    </div>
                    <button onClick={() => handleLoadSummary(c.id)}
                      className="text-blue-600 hover:underline text-xs">
                      View Summary
                    </button>
                  </li>
                ))}
              </ul>
              {summary.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Employee</th>
                        <th className="px-3 py-2 text-left">Avg Rating</th>
                        <th className="px-3 py-2 text-left">Reviews</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary.map((s) => {
                        const emp = employees.find((e) => e.id === s.employee_id.toString());
                        return (
                          <tr key={s.employee_id.toString()}>
                            <td className="px-3 py-2">{emp ? `${emp.first_name} ${emp.last_name}` : s.employee_id.toString().slice(0, 8) + "…"}</td>
                            <td className="px-3 py-2">{stars(Math.round(s.average_rating))} {s.average_rating.toFixed(1)}</td>
                            <td className="px-3 py-2">{s.review_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Submit review (admin) */}
          {isAdmin && (
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">Submit Review</h2>
              {!selectedEmpId ? (
                <p className="text-gray-400 text-sm">Select an employee above to submit a review.</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Cycle</label>
                      <select value={selectedCycle} onChange={(e) => setSelectedCycle(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm">
                        <option value="">Select Cycle</option>
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Rating</label>
                      <select value={rating} onChange={(e) => setRating(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm">
                        {[1,2,3,4,5].map((n) => <option key={n} value={n}>{stars(n)} {n}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-gray-500">Comments</label>
                      <input value={comments} onChange={(e) => setComments(e.target.value)}
                        placeholder="Optional feedback..."
                        className="border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <button onClick={handleSubmitReview}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                      Submit Review
                    </button>
                  </div>

                  {/* Employee's review history */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      {employees.find(e => e.id === selectedEmpId)?.first_name}'s Review History
                    </p>
                    {empReviews.length === 0 ? (
                      <p className="text-gray-400 text-sm">No reviews yet for this employee.</p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {empReviews.map((r) => (
                          <li key={r.id} className="py-2 flex justify-between">
                            <span>{stars(r.rating)} — {r.comments ?? "No comments"}</span>
                            <span className="text-gray-400 text-xs">{r.submitted_at.slice(0,10)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Employee: my reviews */}
          {!isAdmin && (
            <div className="bg-white rounded-xl shadow p-4 space-y-2">
              <h2 className="font-semibold text-gray-700">My Performance Reviews</h2>
              {empReviews.length === 0 ? (
                <p className="text-gray-400 text-sm">No reviews submitted yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {empReviews.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex justify-between">
                        <span className="text-lg">{stars(r.rating)}</span>
                        <span className="text-gray-400 text-xs">{r.submitted_at.slice(0,10)}</span>
                      </div>
                      {r.comments && <p className="text-gray-600 text-sm mt-1">{r.comments}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── GOALS TAB ── */}
      {tab === "goals" && (
        <div className="space-y-4">
          {/* Add goal form */}
          {(isAdmin ? !!selectedEmpId : true) && (
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-gray-700">
                {isAdmin ? `Assign Goal to ${employees.find(e => e.id === selectedEmpId)?.first_name ?? "Employee"}` : "Add My Goal"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs text-gray-500">Goal Title *</label>
                  <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g. Complete Flutter module"
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Due Date</label>
                  <input type="date" value={goalDue} onChange={(e) => setGoalDue(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-3">
                  <label className="text-xs text-gray-500">Description</label>
                  <input value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)}
                    placeholder="Optional description..."
                    className="border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <button onClick={handleCreateGoal}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                {isAdmin ? "Assign Goal" : "Add Goal"}
              </button>
            </div>
          )}

          {isAdmin && !selectedEmpId && (
            <p className="text-gray-400 text-sm text-center py-4">Select an employee above to view or assign goals.</p>
          )}

          {/* Goals list */}
          {(isAdmin ? !!selectedEmpId : true) && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b">
                <span className="font-semibold text-gray-700 text-sm">
                  {isAdmin ? `${employees.find(e => e.id === selectedEmpId)?.first_name ?? "Employee"}'s Goals` : "My Goals"}
                </span>
              </div>
              {goals.length === 0 ? (
                <p className="px-4 py-8 text-center text-gray-400 text-sm">No goals yet.</p>
              ) : (
                <ul className="divide-y">
                  {goals.map((g) => (
                    <li key={g.id} className="px-4 py-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-medium text-sm">{g.title}</span>
                          {g.due_date && <span className="ml-2 text-xs text-gray-400">Due {g.due_date}</span>}
                        </div>
                        <span className="text-sm font-semibold text-blue-600">{g.progress}%</span>
                      </div>
                      {g.description && <p className="text-xs text-gray-500 mb-2">{g.description}</p>}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${g.progress}%` }}
                          />
                        </div>
                        {!isAdmin && (
                          <input type="range" min={0} max={100} value={g.progress}
                            onChange={(e) => handleProgressUpdate(g.id, Number(e.target.value))}
                            className="w-20" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
