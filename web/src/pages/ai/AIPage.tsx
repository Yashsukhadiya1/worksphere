import { useState } from "react";
import { getInsights, aiQuery } from "@/api/endpoints";
import type { AIQueryResult, InsightReport } from "@/types";

export default function AIPage() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<AIQueryResult | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [error, setError] = useState("");

  const handleInsights = async () => {
    setLoadingInsights(true); setError("");
    try { setReport(await getInsights()); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "AI unavailable"); }
    finally { setLoadingInsights(false); }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    setLoadingQuery(true); setError("");
    try { setQueryResult(await aiQuery(query)); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "AI unavailable"); }
    finally { setLoadingQuery(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">AI Workforce Insights</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Generate Insight Report</h2>
          <button onClick={handleInsights} disabled={loadingInsights}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loadingInsights ? "Generating…" : "Generate"}
          </button>
        </div>
        {report && (
          <div className="space-y-2">
            <p className="text-gray-700 text-sm leading-relaxed">{report.summary}</p>
            {report.flagged_employees.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">Flagged Employees</p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {report.flagged_employees.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-400">Generated {new Date(report.generated_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-700">Ask a Question</h2>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. How many employees are on leave this month?"
            className="border rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <button onClick={handleQuery} disabled={loadingQuery}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loadingQuery ? "…" : "Ask"}
          </button>
        </div>
        {queryResult && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
            {queryResult.result}
          </div>
        )}
      </div>
    </div>
  );
}
