import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const SUGGESTED_QUESTIONS = [
  { category: "Employees", q: "Who was the latest employee added?" },
  { category: "Employees", q: "List all active employees with their job titles." },
  { category: "Employees", q: "How many employees are currently active?" },
  { category: "Employees", q: "Which employees have been with the company for more than 2 years?" },
  { category: "Employees", q: "Who are the highest paid employees?" },
  { category: "Attendance", q: "Which employees had the most absences in the last 30 days?" },
  { category: "Attendance", q: "Who has the best attendance record this month?" },
  { category: "Attendance", q: "List employees with less than 10 present days this month." },
  { category: "Performance", q: "Who has the highest average performance rating?" },
  { category: "Performance", q: "Which employees have never received a performance review?" },
  { category: "Performance", q: "List employees with a rating below 3." },
  { category: "Performance", q: "How many goals have been completed across all employees?" },
  { category: "Leave", q: "Which employees have taken the most leaves?" },
  { category: "Leave", q: "How many leave requests were approved vs rejected?" },
  { category: "Payroll", q: "What is the total payroll cost this month?" },
  { category: "Payroll", q: "Which employee has the highest net salary?" },
  { category: "Payroll", q: "List employees who have not received a payslip yet." },
  { category: "Risk", q: "Who is at highest risk of leaving the company?" },
  { category: "Risk", q: "Which department has the most at-risk employees?" },
  { category: "Risk", q: "Are there any employees showing burnout signals?" },
];

const CATEGORIES = [...new Set(SUGGESTED_QUESTIONS.map(s => s.category))];

interface AttritionEntry {
  employee_id: string; name: string; job_title: string;
  risk_score: number; risk_level: string;
  factors: { absence_rate_30d: number; leave_requests_90d: number; latest_rating: number | null };
}
interface DeptRankEntry {
  rank: number; department_name: string; employee_count: number;
  avg_performance_rating: number; attendance_rate_30d: number; composite_score: number;
}
interface ProductivityResult {
  score: number; level: string; date: string;
  breakdown: Record<string, boolean | string>;
}
interface BurnoutResult { consecutive_working_days: number; warning: boolean; message: string; }
interface MonthlyRecord {
  month: string; present_days: number; avg_hours_per_day: number;
  approved_leaves: number; performance_rating: number | null; net_salary: number | null;
}
interface InsightReport { summary: string; flagged_employees: string[]; generated_at: string; }
interface AIQueryResult { query: string; result: string; }

type Tab = "query" | "attrition" | "departments" | "productivity" | "burnout" | "history" | "lookup";

const RISK_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};
const LEVEL_COLOR: Record<string, string> = {
  Excellent: "text-green-600", Good: "text-blue-600",
  Average: "text-amber-600", Low: "text-red-600",
};

function renderBreakdownItem(k: string, v: boolean | string) {
  let icon = "✅", label = k.replace(/_/g, " "), color = "bg-green-50 text-green-700 border border-green-100";
  if (k === "goals_in_progress") {
    if (v === "completed")   { icon = "✅"; label = "Goals Completed";       color = "bg-green-50 text-green-700 border border-green-100"; }
    else if (v === "in_progress") { icon = "🔄"; label = "Goal Has Been Started"; color = "bg-blue-50 text-blue-700 border border-blue-100"; }
    else                     { icon = "❌"; label = "Goals Not Started";     color = "bg-red-50 text-red-600 border border-red-100"; }
  } else {
    const ok = v === true;
    icon  = ok ? "✅" : "❌";
    color = ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100";
  }
  return { icon, label, color };
}

export default function AIDashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "hr_manager";

  const [tab, setTab] = useState<Tab>(isAdmin ? "query" : "productivity");
  const [error, setError] = useState("");

  const [datasetLastUpdated, setDatasetLastUpdated] = useState<string | null>(null);
  const [datasetStale, setDatasetStale] = useState(false);
  const [refreshingDS, setRefreshingDS] = useState(false);

  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<AIQueryResult | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [attrition, setAttrition] = useState<AttritionEntry[]>([]);
  const [loadingAttrition, setLoadingAttrition] = useState(false);
  const [deptRanking, setDeptRanking] = useState<DeptRankEntry[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const [productivity, setProductivity] = useState<ProductivityResult | null>(null);
  const [loadingProd, setLoadingProd] = useState(false);
  const [burnout, setBurnout] = useState<BurnoutResult | null>(null);
  const [loadingBurnout, setLoadingBurnout] = useState(false);
  const [history, setHistory] = useState<MonthlyRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Admin employee lookup
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [lookupProd, setLookupProd] = useState<ProductivityResult | null>(null);
  const [lookupBurnout, setLookupBurnout] = useState<BurnoutResult | null>(null);
  const [lookupHistory, setLookupHistory] = useState<MonthlyRecord[]>([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupLoaded, setLookupLoaded] = useState(false);

  const setErr = (e: any) => setError(e?.response?.data?.detail ?? e?.message ?? "Request failed");

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/ai/dataset/status").then(r => {
      setDatasetLastUpdated(r.data.last_updated);
      setDatasetStale(r.data.is_stale);
    }).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setError("");
    if (tab === "attrition" && attrition.length === 0) fetchAttrition();
    if (tab === "departments" && deptRanking.length === 0) fetchDepts();
    if (tab === "productivity" && !productivity) fetchProductivity();
    if (tab === "burnout" && !burnout) fetchBurnout();
    if (tab === "history" && history.length === 0) fetchHistory();
    if (tab === "lookup") loadEmployeeList();
  }, [tab]);

  const fetchAttrition = async () => {
    setLoadingAttrition(true);
    try { setAttrition((await api.get("/ai/ml/attrition-risk")).data); }
    catch (e) { setErr(e); } finally { setLoadingAttrition(false); }
  };
  const fetchDepts = async () => {
    setLoadingDepts(true);
    try { setDeptRanking((await api.get("/ai/ml/department-ranking")).data); }
    catch (e) { setErr(e); } finally { setLoadingDepts(false); }
  };
  const fetchProductivity = async () => {
    setLoadingProd(true);
    try { setProductivity((await api.get("/ai/ml/productivity")).data); }
    catch (e) { setErr(e); } finally { setLoadingProd(false); }
  };
  const fetchBurnout = async () => {
    setLoadingBurnout(true);
    try { setBurnout((await api.get("/ai/ml/burnout")).data); }
    catch (e) { setErr(e); } finally { setLoadingBurnout(false); }
  };
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try { setHistory((await api.get("/ai/ml/my-dataset")).data); }
    catch (e) { setErr(e); } finally { setLoadingHistory(false); }
  };
  const handleRefreshDS = async () => {
    setRefreshingDS(true); setError("");
    try {
      await api.post("/ai/dataset/refresh");
      const r = await api.get("/ai/dataset/status");
      setDatasetLastUpdated(r.data.last_updated);
      setDatasetStale(r.data.is_stale);
    } catch (e) { setErr(e); } finally { setRefreshingDS(false); }
  };
  const handleQuery = async () => {
    if (!query.trim()) return;
    setLoadingQuery(true); setError("");
    try { setQueryResult((await api.post("/ai/query", { query })).data); }
    catch (e) { setErr(e); } finally { setLoadingQuery(false); }
  };
  const handleInsights = async () => {
    setLoadingInsights(true); setError("");
    try { setReport((await api.post("/ai/insights")).data); }
    catch (e) { setErr(e); } finally { setLoadingInsights(false); }
  };

  // Load employee list when lookup tab is opened
  const loadEmployeeList = async () => {
    if (employees.length > 0) return;
    try {
      const r = await api.get("/employees");
      setEmployees(r.data.map((e: any) => ({
        id: e.id,
        name: `${e.first_name} ${e.last_name} — ${e.job_title}`,
      })));
    } catch (e) { setErr(e); }
  };

  const fetchLookup = async (empId: string) => {
    if (!empId) return;
    setLoadingLookup(true); setError(""); setLookupLoaded(false);
    setLookupProd(null); setLookupBurnout(null); setLookupHistory([]);
    try {
      const [prod, burn, hist] = await Promise.all([
        api.get(`/ai/ml/employee/${empId}/productivity`),
        api.get(`/ai/ml/employee/${empId}/burnout`),
        api.get(`/ai/ml/employee/${empId}/history`),
      ]);
      setLookupProd(prod.data);
      setLookupBurnout(burn.data);
      setLookupHistory(hist.data);
      setLookupLoaded(true);
    } catch (e) { setErr(e); } finally { setLoadingLookup(false); }
  };

  const adminTabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "query",        label: "Ask AI",          emoji: "🤖" },
    { id: "attrition",   label: "Attrition Risk",   emoji: "⚠️" },
    { id: "departments", label: "Dept Ranking",     emoji: "🏆" },
    { id: "lookup",      label: "Employee Lookup",  emoji: "🔍" },
  ];
  const empTabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "productivity", label: "Productivity", emoji: "📊" },
    { id: "burnout",      label: "Burnout",      emoji: "🔥" },
    { id: "history",      label: "My History",   emoji: "📅" },
  ];
  const tabs = isAdmin ? adminTabs : empTabs;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">AI &amp; ML Insights</h1>
        {isAdmin && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              Dataset:{" "}
              {datasetLastUpdated
                ? <span className={datasetStale ? "text-amber-500 font-medium" : "text-green-600 font-medium"}>
                    {datasetStale ? "Stale" : "Fresh"} · {new Date(datasetLastUpdated).toLocaleTimeString()}
                  </span>
                : <span className="text-red-500 font-medium">Not built</span>}
            </span>
            <button onClick={handleRefreshDS} disabled={refreshingDS}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
              {refreshingDS ? "Building…" : "Refresh Dataset"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-all ${
              tab === t.id
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ── Ask AI ── */}
      {tab === "query" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="font-semibold text-gray-700">🤖 Ask AI about your workforce</p>
            <p className="text-xs text-gray-400">Answers are generated from the admin dataset. Refresh the dataset first for latest data.</p>

            {/* Suggested questions dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSuggestions(s => !s)}
                className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-gray-700 transition-colors bg-gray-50">
                <span>💡 Choose a suggested question…</span>
                <span className="text-gray-400">{showSuggestions ? "▲" : "▼"}</span>
              </button>
              {showSuggestions && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                  {CATEGORIES.map(cat => (
                    <div key={cat}>
                      <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                        {cat}
                      </p>
                      {SUGGESTED_QUESTIONS.filter(s => s.category === cat).map(s => (
                        <button key={s.q}
                          onClick={() => { setQuery(s.q); setShowSuggestions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                          {s.q}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input + Ask button */}
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleQuery()}
                onFocus={() => setShowSuggestions(false)}
                placeholder="Or type your own question…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleQuery} disabled={loadingQuery || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
                {loadingQuery ? "…" : "Ask"}
              </button>
            </div>
            {queryResult && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 mb-2">Q: {queryResult.query}</p>
                {queryResult.result}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-700">✨ Generate Insight Report</p>
              <button onClick={handleInsights} disabled={loadingInsights}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {loadingInsights ? "Generating…" : "Generate"}
              </button>
            </div>
            {report && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
                {report.flagged_employees.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-600 mb-1">Flagged Employees</p>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                      {report.flagged_employees.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-gray-400">Generated {new Date(report.generated_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Employee Lookup ── */}
      {tab === "lookup" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="font-semibold text-gray-700">🔍 Employee Lookup</p>
            <p className="text-xs text-gray-400">Select any employee to view their productivity, burnout status, and 6-month history.</p>
            <div className="flex gap-2">
              <select
                value={selectedEmpId}
                onChange={e => { setSelectedEmpId(e.target.value); setLookupLoaded(false); }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select an employee —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <button
                onClick={() => fetchLookup(selectedEmpId)}
                disabled={!selectedEmpId || loadingLookup}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
                {loadingLookup ? "Loading…" : "View"}
              </button>
            </div>
          </div>

          {loadingLookup && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {lookupLoaded && lookupProd && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Productivity */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <p className="font-semibold text-gray-700">📊 Productivity Score</p>
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke={lookupProd.score >= 80 ? "#16a34a" : lookupProd.score >= 60 ? "#2563eb" : lookupProd.score >= 40 ? "#d97706" : "#dc2626"}
                        strokeWidth="3.5"
                        strokeDasharray={`${lookupProd.score} ${100 - lookupProd.score}`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-gray-800">{lookupProd.score}</span>
                      <span className="text-xs text-gray-400">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${LEVEL_COLOR[lookupProd.level] ?? "text-gray-700"}`}>{lookupProd.level}</p>
                    <p className="text-xs text-gray-400 mt-1">{lookupProd.date}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(lookupProd.breakdown).map(([k, v]) => {
                    const { icon, label, color } = renderBreakdownItem(k, v);
                    return (
                      <div key={k} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${color}`}>
                        <span>{icon}</span><span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Burnout */}
              {lookupBurnout && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <p className="font-semibold text-gray-700">🔥 Burnout Status</p>
                  <div className={`rounded-xl p-5 border ${lookupBurnout.warning ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{lookupBurnout.warning ? "🔥" : "✅"}</span>
                      <div>
                        <p className={`font-bold ${lookupBurnout.warning ? "text-red-700" : "text-green-700"}`}>
                          {lookupBurnout.warning ? "Burnout Warning!" : "Doing Great"}
                        </p>
                        <p className="text-sm text-gray-500">{lookupBurnout.consecutive_working_days} consecutive days</p>
                      </div>
                    </div>
                    <p className={`text-sm ${lookupBurnout.warning ? "text-red-700" : "text-green-700"}`}>{lookupBurnout.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {lookupLoaded && lookupHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p className="font-semibold text-gray-700">📅 Last 6 Months History</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lookupHistory.map(r => (
                  <div key={r.month} className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-gray-800 text-sm">{r.month}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Present Days</span><span className="font-medium">{r.present_days}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Avg Hours/Day</span><span className="font-medium">{r.avg_hours_per_day}h</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Approved Leaves</span><span className="font-medium">{r.approved_leaves}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Performance</span><span className="font-medium">{r.performance_rating ? `${r.performance_rating}/5` : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Net Salary</span><span className="font-medium">{r.net_salary != null ? `₹${r.net_salary.toLocaleString()}` : "—"}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Attrition Risk ── */}
      {tab === "attrition" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">⚠️ Employee Attrition Risk</p>
            <button onClick={fetchAttrition} disabled={loadingAttrition}
              className="text-blue-600 text-xs hover:underline disabled:opacity-50">Refresh</button>
          </div>
          {loadingAttrition
            ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : attrition.length === 0
              ? <p className="text-center text-gray-400 py-8">No employee data found.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left pb-3 pr-4">Employee</th>
                        <th className="text-left pb-3 pr-4">Title</th>
                        <th className="text-left pb-3 pr-4">Score</th>
                        <th className="text-left pb-3 pr-4">Risk</th>
                        <th className="text-left pb-3 pr-4">Absences</th>
                        <th className="text-left pb-3 pr-4">Leaves</th>
                        <th className="text-left pb-3">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attrition.map(e => (
                        <tr key={e.employee_id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">{e.name}</td>
                          <td className="py-3 pr-4 text-gray-500">{e.job_title}</td>
                          <td className="py-3 pr-4">
                            <span className="font-bold text-gray-800">{e.risk_score}</span>
                            <span className="text-gray-400 text-xs">/100</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${RISK_COLOR[e.risk_level] ?? ""}`}>
                              {e.risk_level}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{e.factors.absence_rate_30d}%</td>
                          <td className="py-3 pr-4 text-gray-600">{e.factors.leave_requests_90d}</td>
                          <td className="py-3 text-gray-600">{e.factors.latest_rating ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      )}

      {/* ── Department Ranking ── */}
      {tab === "departments" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">🏆 Department Performance Ranking</p>
            <button onClick={fetchDepts} disabled={loadingDepts}
              className="text-blue-600 text-xs hover:underline disabled:opacity-50">Refresh</button>
          </div>
          {loadingDepts
            ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : deptRanking.length === 0
              ? <p className="text-center text-gray-400 py-8">No department data.</p>
              : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {deptRanking.map(d => (
                    <div key={d.department_name}
                      className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs font-bold text-gray-400 uppercase">Rank #{d.rank}</span>
                          <p className="font-semibold text-gray-800 mt-0.5">{d.department_name}</p>
                          <p className="text-xs text-gray-400">{d.employee_count} employees</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{d.composite_score}</p>
                          <p className="text-xs text-gray-400">score</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
                        <div>
                          <p className="text-xs text-gray-400">Avg Rating</p>
                          <p className="font-semibold text-gray-700">⭐ {d.avg_performance_rating.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Attendance</p>
                          <p className="font-semibold text-gray-700">📅 {d.attendance_rate_30d}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </div>
      )}

      {/* ── Productivity ── */}
      {tab === "productivity" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">📊 Today's Productivity Score</p>
            <button onClick={() => { setProductivity(null); fetchProductivity(); }}
              disabled={loadingProd} className="text-blue-600 text-xs hover:underline disabled:opacity-50">Refresh</button>
          </div>
          {loadingProd
            ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : productivity
              ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-8">
                    {/* Circle */}
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none"
                          stroke={productivity.score >= 80 ? "#16a34a" : productivity.score >= 60 ? "#2563eb" : productivity.score >= 40 ? "#d97706" : "#dc2626"}
                          strokeWidth="3.5"
                          strokeDasharray={`${productivity.score} ${100 - productivity.score}`}
                          strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-800">{productivity.score}</span>
                        <span className="text-xs text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${LEVEL_COLOR[productivity.level] ?? "text-gray-700"}`}>
                        {productivity.level}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{productivity.date}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(productivity.breakdown).map(([k, v]) => {
                      const { icon, label, color } = renderBreakdownItem(k, v);
                      return (
                        <div key={k} className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${color}`}>
                          <span className="text-base">{icon}</span>
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
              : <p className="text-center text-gray-400 py-8">No data available.</p>
          }
        </div>
      )}

      {/* ── Burnout ── */}
      {tab === "burnout" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">🔥 Burnout Warning Check</p>
            <button onClick={() => { setBurnout(null); fetchBurnout(); }}
              disabled={loadingBurnout} className="text-blue-600 text-xs hover:underline disabled:opacity-50">Refresh</button>
          </div>
          {loadingBurnout
            ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : burnout
              ? (
                <div className={`rounded-xl p-6 border ${
                  burnout.warning
                    ? "bg-red-50 border-red-200"
                    : "bg-green-50 border-green-200"
                }`}>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-5xl">{burnout.warning ? "🔥" : "✅"}</span>
                    <div>
                      <p className={`text-lg font-bold ${burnout.warning ? "text-red-700" : "text-green-700"}`}>
                        {burnout.warning ? "Burnout Warning!" : "You're Doing Great"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {burnout.consecutive_working_days} consecutive working days
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm ${burnout.warning ? "text-red-700" : "text-green-700"}`}>
                    {burnout.message}
                  </p>
                </div>
              )
              : <p className="text-center text-gray-400 py-8">No data available.</p>
          }
        </div>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-700">📅 My Last 6 Months</p>
            <button onClick={() => { setHistory([]); fetchHistory(); }}
              disabled={loadingHistory} className="text-blue-600 text-xs hover:underline disabled:opacity-50">Refresh</button>
          </div>
          {loadingHistory
            ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : history.length === 0
              ? <p className="text-center text-gray-400 py-8">No history yet.</p>
              : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {history.map(r => (
                    <div key={r.month} className="border border-gray-200 rounded-xl p-4 space-y-2">
                      <p className="font-semibold text-gray-800 text-sm">{r.month}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Present Days</span><span className="font-medium">{r.present_days}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Avg Hours/Day</span><span className="font-medium">{r.avg_hours_per_day}h</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Approved Leaves</span><span className="font-medium">{r.approved_leaves}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Performance</span><span className="font-medium">{r.performance_rating ? `${r.performance_rating}/5` : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Net Salary</span><span className="font-medium">{r.net_salary != null ? `₹${r.net_salary.toLocaleString()}` : "—"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </div>
      )}
    </div>
  );
}
