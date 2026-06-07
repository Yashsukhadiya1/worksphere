// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest { email: string; password: string; }
export interface TokenResponse { access_token: string; refresh_token: string; token_type: string; }
export interface UserProfile { id: string; email: string; role: string; is_active: boolean; }

// ── Department ────────────────────────────────────────────────────────────────
export interface Department { id: string; name: string; created_at: string; }
export interface DepartmentSummary { id: string; name: string; }

// ── Employee ──────────────────────────────────────────────────────────────────
export interface EmployeeSummary {
  id: string; employee_number: string; first_name: string; last_name: string;
  job_title: string; department: DepartmentSummary | null; status: string;
}
export interface EmployeeDetail extends EmployeeSummary {
  user_id: string; hire_date: string; base_salary: string; created_at: string;
}
export interface EmployeeCreate {
  email: string; password: string; first_name: string; last_name: string;
  job_title: string; department_id: string; hire_date: string; base_salary: string;
  role: "hr_manager" | "dept_manager" | "employee";
}
export interface EmployeeUpdate {
  first_name?: string; last_name?: string; job_title?: string;
  department_id?: string; base_salary?: string;
  role?: "hr_manager" | "dept_manager" | "employee";
}

// ── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string; employee_id: string; check_in: string; check_out: string | null;
  total_hours: string | null; date: string;
}
export interface LeaveRequest {
  id: string; employee_id: string; start_date: string; end_date: string;
  leave_type: string; status: string; reason: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
}
export interface LeaveRequestCreate {
  start_date: string; end_date: string;
  leave_type: "annual" | "sick" | "unpaid" | "other"; reason?: string;
}
export interface AttendanceSummary {
  employee_id: string; total_hours: string; overtime_hours: string; leave_days: number;
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export interface Payslip {
  id: string; payroll_run_id: string; employee_id: string;
  gross_salary: string; total_deductions: string; net_salary: string;
  deduction_details: Record<string, number> | null; created_at: string;
}
export interface PayrollRunSummary {
  id: string; pay_period_start: string; pay_period_end: string; payslip_count: number;
}

// ── Performance ───────────────────────────────────────────────────────────────
export interface ReviewCycle {
  id: string; name: string; start_date: string; end_date: string;
  created_by: string; created_at: string;
}
export interface Review {
  id: string; cycle_id: string; employee_id: string; reviewer_id: string;
  rating: number; comments: string | null; submitted_at: string;
}
export interface Goal {
  id: string; employee_id: string; title: string; description: string | null;
  progress: number; due_date: string | null; created_at: string;
}
export interface CycleSummaryEntry { employee_id: string; average_rating: number; review_count: number; }

// ── AI ────────────────────────────────────────────────────────────────────────
export interface InsightReport { summary: string; flagged_employees: string[]; generated_at: string; }
export interface AIQueryResult { query: string; result: string; structured_data: Record<string, unknown> | null; }

// ── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string; user_id: string; sent_by_user_id: string | null;
  title: string; body: string;
  is_read: boolean; read_by_name: string | null; read_at: string | null;
  created_at: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: number; actor_user_id: string; action: string;
  entity_type: string; entity_id: string;
  payload: Record<string, unknown> | null; created_at: string;
}
