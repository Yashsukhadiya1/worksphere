import { useState } from "react";
import { runPayroll, myPayslips, exportPayrollCsv } from "@/api/endpoints";
import type { Payslip, PayrollRunSummary } from "@/types";

export default function PayrollPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [runResult, setRunResult] = useState<PayrollRunSummary | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [error, setError] = useState("");

  const handleRun = async () => {
    setError("");
    try {
      const result = await runPayroll(start, end);
      setRunResult(result);
    } catch (e: any) { setError(e?.response?.data?.detail ?? "Error running payroll"); }
  };

  const handleLoadMyPayslips = async () => {
    const data = await myPayslips();
    setPayslips(data);
  };

  const handleExport = async (runId: string) => {
    const blob = await exportPayrollCsv(runId);
    const url = URL.createObjectURL(blob as any);
    const a = document.createElement("a");
    a.href = url; a.download = `payroll-${runId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-700">Run Payroll</h2>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="border rounded-lg px-3 py-2" placeholder="Period Start" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="border rounded-lg px-3 py-2" placeholder="Period End" />
          <button onClick={handleRun} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            Run
          </button>
        </div>
        {runResult && (
          <div className="flex items-center gap-4 text-sm text-gray-700 bg-green-50 p-3 rounded-lg">
            <span>✅ {runResult.payslip_count} payslips generated for {runResult.pay_period_start} – {runResult.pay_period_end}</span>
            <button onClick={() => handleExport(runResult.id)}
              className="ml-auto text-blue-600 hover:underline text-xs">Download CSV</button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">My Payslips</h2>
          <button onClick={handleLoadMyPayslips} className="text-blue-600 hover:underline text-sm">Load</button>
        </div>
        {payslips.length > 0 && (
          <table className="min-w-full text-sm">
            <thead className="text-gray-500 uppercase text-xs">
              <tr>{["Gross", "Deductions", "Net", "Date"].map((h) => <th key={h} className="py-2 text-left px-2">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {payslips.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-2">{p.gross_salary}</td>
                  <td className="px-2 py-2">{p.total_deductions}</td>
                  <td className="px-2 py-2 font-medium text-green-700">{p.net_salary}</td>
                  <td className="px-2 py-2 text-gray-500">{p.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
