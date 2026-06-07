import { useEffect, useState } from "react";
import {
  listEmployees, getEmployee,
  deactivateEmployee, activateEmployee, deleteEmployeePermanent,
} from "@/api/endpoints";
import type { EmployeeDetail, EmployeeSummary } from "@/types";
import EmployeeFormModal from "./EmployeeFormModal";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeDetail | null>(null);
  const [actionError, setActionError] = useState("");

  const load = async () => {
    const data = await listEmployees(search ? { name: search } : undefined);
    setEmployees(data);
  };

  useEffect(() => { load(); }, [search]);

  const handleEdit = async (id: string) => {
    const detail = await getEmployee(id);
    setEditTarget(detail);
    setShowModal(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: string, name: string) => {
    const isActive = currentStatus === "active";
    const action = isActive ? "deactivate" : "activate";
    if (!confirm(`${isActive ? "Deactivate" : "Activate"} ${name}?`)) return;
    setActionError("");
    try {
      isActive ? await deactivateEmployee(id) : await activateEmployee(id);
      load();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail ?? `Failed to ${action}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(
      `Permanently delete ${name}?\n\nThis will remove all their records (attendance, payroll, leaves, reviews) and cannot be undone.`
    )) return;
    setActionError("");
    try {
      await deleteEmployeePermanent(id);
      load();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail ?? "Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
        >
          + Add Employee
        </button>
      </div>

      {actionError && (
        <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{actionError}</p>
      )}

      <input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {["#", "Name", "Job Title", "Department", "Joined", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((e) => {
              const isActive = e.status === "active";
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.employee_number}</td>
                  <td className="px-4 py-3 font-medium">{e.first_name} {e.last_name}</td>
                  <td className="px-4 py-3">{e.job_title}</td>
                  <td className="px-4 py-3">{e.department?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {(e as any).hire_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(e.id)}
                        className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        Edit
                      </button>

                      {/* Deactivate / Activate toggle */}
                      <button
                        onClick={() => handleToggleStatus(e.id, e.status, `${e.first_name} ${e.last_name}`)}
                        className={`px-2 py-1 text-xs rounded border ${
                          isActive
                            ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                            : "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                        }`}
                      >
                        {isActive ? "Deactivate" : "Activate"}
                      </button>

                      {/* Permanent delete */}
                      <button
                        onClick={() => handleDelete(e.id, `${e.first_name} ${e.last_name}`)}
                        className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <EmployeeFormModal
          employee={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
