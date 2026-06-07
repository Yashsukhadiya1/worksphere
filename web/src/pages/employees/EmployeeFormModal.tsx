import { FormEvent, useEffect, useState } from "react";
import { createEmployee, updateEmployee, listDepartments } from "@/api/endpoints";
import type { Department, EmployeeDetail } from "@/types";

interface Props {
  employee: EmployeeDetail | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EmployeeFormModal({ employee, onClose, onSaved }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    email:         "",
    password:      "",
    first_name:    employee?.first_name    ?? "",
    last_name:     employee?.last_name     ?? "",
    job_title:     employee?.job_title     ?? "",
    department_id: employee?.department?.id ?? "",
    hire_date:     employee?.hire_date     ?? "",
    base_salary:   employee?.base_salary   ?? "",
    role:          (employee as any)?.role ?? "employee",
  });
  const [error, setError] = useState("");

  useEffect(() => { listDepartments().then(setDepartments); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          first_name:    form.first_name,
          last_name:     form.last_name,
          job_title:     form.job_title,
          department_id: form.department_id,
          base_salary:   form.base_salary,
          role:          form.role as any,
        });
      } else {
        await createEmployee({
          email:         form.email,
          password:      form.password,
          first_name:    form.first_name,
          last_name:     form.last_name,
          job_title:     form.job_title,
          department_id: form.department_id,
          hire_date:     form.hire_date,
          base_salary:   form.base_salary,
          role:          form.role as any,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "An error occurred");
    }
  };

  const field = (label: string, key: string, type = "text", required = true) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input
        type={type}
        required={required}
        value={(form as any)[key]}
        onChange={set(key)}
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">{employee ? "Edit Employee" : "Add Employee"}</h2>
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          {field("First Name", "first_name")}
          {field("Last Name", "last_name")}
          {field("Job Title", "job_title")}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Department</label>
            <select required value={form.department_id} onChange={set("department_id")}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {field("Hire Date", "hire_date", "date")}
          {field("Base Salary", "base_salary", "number")}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Role</label>
            <select value={form.role} onChange={set("role")}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="employee">Employee</option>
              <option value="hr_manager">HR Manager</option>
              <option value="dept_manager">Dept Manager</option>
            </select>
          </div>

          {!employee && (
            <>
              {field("Email", "email", "email")}
              {field("Password", "password", "password")}
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {employee ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}
