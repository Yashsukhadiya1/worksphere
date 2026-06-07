import { useEffect, useState } from "react";
import { listDepartments, createDepartment, updateDepartment, deleteDepartment } from "@/api/endpoints";
import type { Department } from "@/types";

const SUGGESTIONS = [
  "Engineering", "Human Resources", "Finance", "Marketing",
  "Sales", "Operations", "Product", "Design", "Legal", "Support",
];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const load = () => listDepartments().then(setDepartments);
  useEffect(() => { load(); }, []);

  const existingNames = departments.map((d) => d.name.toLowerCase());
  const suggestions = SUGGESTIONS.filter((s) => !existingNames.includes(s.toLowerCase()));

  const handleCreate = async (name?: string) => {
    const val = (name ?? newName).trim();
    if (!val) return;
    setError("");
    try { await createDepartment(val); setNewName(""); load(); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "Error"); }
  };

  const handleUpdate = async (id: string) => {
    setError("");
    try { await updateDepartment(id, editName); setEditId(null); load(); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "Error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this department? This will fail if employees are assigned to it.")) return;
    setError("");
    try { await deleteDepartment(id); load(); }
    catch (e: any) { setError("Cannot delete — employees are assigned to this department."); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Departments</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Add input */}
      <div className="flex gap-2">
        <input
          placeholder="New department name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="border rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={() => handleCreate()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          Add
        </button>
      </div>

      {/* Quick-add suggestions */}
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => handleCreate(s)}
                className="bg-gray-100 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Department list */}
      <div className="bg-white rounded-xl shadow divide-y">
        {departments.length === 0 && (
          <p className="px-4 py-6 text-center text-gray-400 text-sm">No departments yet. Add one above.</p>
        )}
        {departments.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            {editId === d.id ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div>
                <span className="font-medium text-gray-800">{d.name}</span>
                <span className="ml-2 text-xs text-gray-400">
                  Added {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              {editId === d.id ? (
                <>
                  <button onClick={() => handleUpdate(d.id)}
                    className="text-green-600 hover:underline text-xs">Save</button>
                  <button onClick={() => setEditId(null)}
                    className="text-gray-500 hover:underline text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(d.id); setEditName(d.name); }}
                    className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(d.id)}
                    className="text-red-600 hover:underline text-xs">Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
