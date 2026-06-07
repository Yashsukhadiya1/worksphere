import { api } from "./client";
import type {
  AIQueryResult, AttendanceRecord, AttendanceSummary, AuditLog,
  CycleSummaryEntry, Department, EmployeeCreate, EmployeeDetail,
  EmployeeSummary, EmployeeUpdate, Goal, InsightReport,
  LeaveRequest, LeaveRequestCreate, LoginRequest, Notification,
  Payslip, PayrollRunSummary, Review, ReviewCycle, TokenResponse, UserProfile,
} from "@/types";

// Auth
export const login = (body: LoginRequest) =>
  api.post<TokenResponse>("/auth/login", body).then((r) => r.data);
export const refreshToken = (refresh_token: string) =>
  api.post<{ access_token: string }>("/auth/refresh", { refresh_token }).then((r) => r.data);
export const logout = (refresh_token: string) =>
  api.post("/auth/logout", { refresh_token });
export const getMe = () => api.get<UserProfile>("/auth/me").then((r) => r.data);

// Departments
export const listDepartments = () => api.get<Department[]>("/departments").then((r) => r.data);
export const createDepartment = (name: string) =>
  api.post<Department>("/departments", { name }).then((r) => r.data);
export const updateDepartment = (id: string, name: string) =>
  api.put<Department>(`/departments/${id}`, { name }).then((r) => r.data);
export const deleteDepartment = (id: string) => api.delete(`/departments/${id}`);

// Employees
export const listEmployees = (params?: Record<string, string>) =>
  api.get<EmployeeSummary[]>("/employees", { params }).then((r) => r.data);
export const getEmployee = (id: string) =>
  api.get<EmployeeDetail>(`/employees/${id}`).then((r) => r.data);
export const createEmployee = (body: EmployeeCreate) =>
  api.post<EmployeeDetail>("/employees", body).then((r) => r.data);
export const updateEmployee = (id: string, body: EmployeeUpdate) =>
  api.put<EmployeeDetail>(`/employees/${id}`, body).then((r) => r.data);
export const deactivateEmployee = (id: string) => api.delete(`/employees/${id}`);
export const activateEmployee = (id: string) => api.patch(`/employees/${id}/activate`);
export const deleteEmployeePermanent = (id: string) => api.delete(`/employees/${id}/permanent`);

// Attendance
export const checkIn = () => api.post<AttendanceRecord>("/attendance/checkin").then((r) => r.data);
export const checkOut = () => api.post<AttendanceRecord>("/attendance/checkout").then((r) => r.data);
export const myAttendance = () => api.get<AttendanceRecord[]>("/attendance/me").then((r) => r.data);
export const allAttendance = () => api.get<AttendanceRecord[]>("/attendance/all").then((r) => r.data);
export const deleteAttendanceRecord = (id: string) => api.delete(`/attendance/${id}`);
export const employeeAttendance = (id: string) =>
  api.get<AttendanceRecord[]>(`/attendance/${id}`).then((r) => r.data);
export const attendanceSummary = (id: string, start: string, end: string) =>
  api.get<AttendanceSummary>(`/attendance/${id}/summary`, { params: { period_start: start, period_end: end } }).then((r) => r.data);

// Leave
export const requestLeave = (body: LeaveRequestCreate) =>
  api.post<LeaveRequest>("/leave/request", body).then((r) => r.data);
export const approveLeave = (id: string) =>
  api.put<LeaveRequest>(`/leave/${id}/approve`).then((r) => r.data);
export const rejectLeave = (id: string) =>
  api.put<LeaveRequest>(`/leave/${id}/reject`).then((r) => r.data);
export const myLeaves = () => api.get<LeaveRequest[]>("/leave/me").then((r) => r.data);
export const allLeaves = () => api.get<LeaveRequest[]>("/leave/all").then((r) => r.data);

// Payroll
export const runPayroll = (pay_period_start: string, pay_period_end: string) =>
  api.post<PayrollRunSummary>("/payroll/run", { pay_period_start, pay_period_end }).then((r) => r.data);
export const myPayslips = () => api.get<Payslip[]>("/payroll/payslips/me").then((r) => r.data);
export const getPayslip = (id: string) =>
  api.get<Payslip>(`/payroll/payslips/${id}`).then((r) => r.data);
export const exportPayrollCsv = (runId: string) =>
  api.get<string>(`/payroll/export/${runId}`, { responseType: "blob" }).then((r) => r.data);

// Performance
export const listCycles = () => api.get<ReviewCycle[]>("/performance/cycles").then((r) => r.data);
export const createCycle = (name: string, start_date: string, end_date: string) =>
  api.post<ReviewCycle>("/performance/cycles", { name, start_date, end_date }).then((r) => r.data);
export const submitReview = (body: { cycle_id: string; employee_id: string; rating: number; comments?: string }) =>
  api.post<Review>("/performance/reviews", body).then((r) => r.data);
export const getCycleSummary = (id: string) =>
  api.get<CycleSummaryEntry[]>(`/performance/cycles/${id}/summary`).then((r) => r.data);
export const myReviews = () => api.get<Review[]>("/performance/reviews/me").then((r) => r.data);
export const employeeReviews = (id: string) => api.get<Review[]>(`/performance/reviews/employee/${id}`).then((r) => r.data);
export const createGoal = (body: { title: string; description?: string; due_date?: string }) =>
  api.post<Goal>("/performance/goals", body).then((r) => r.data);
export const assignGoal = (employeeId: string, body: { title: string; description?: string; due_date?: string }) =>
  api.post<Goal>(`/performance/goals/assign?employee_id=${employeeId}`, body).then((r) => r.data);
export const updateGoal = (id: string, progress: number) =>
  api.put<Goal>(`/performance/goals/${id}`, { progress }).then((r) => r.data);
export const myGoals = () => api.get<Goal[]>("/performance/goals/me").then((r) => r.data);
export const employeeGoals = (id: string) => api.get<Goal[]>(`/performance/goals/employee/${id}`).then((r) => r.data);

// AI
export const getInsights = () => api.post<InsightReport>("/ai/insights").then((r) => r.data);
export const aiQuery = (query: string) =>
  api.post<AIQueryResult>("/ai/query", { query }).then((r) => r.data);
export const refreshAdminDataset = () =>
  api.post<{ message: string; last_updated: string | null }>("/ai/dataset/refresh").then((r) => r.data);
export const getDatasetStatus = () =>
  api.get<{ last_updated: string | null; is_stale: boolean }>("/ai/dataset/status").then((r) => r.data);

// Notifications
export const myNotifications = () => api.get<Notification[]>("/notifications").then((r) => r.data);
export const markRead = (id: string) => api.put(`/notifications/${id}/read`);
export const sendNotification = (title: string, body: string, employee_id?: string) =>
  api.post("/notifications/send", { title, body, ...(employee_id ? { employee_id } : {}) });
export const sentNotifications = () => api.get<Notification[]>("/notifications/sent").then((r) => r.data);

// Audit Logs
export const listAuditLogs = (params?: Record<string, string>) =>
  api.get<AuditLog[]>("/audit-logs", { params }).then((r) => r.data);
