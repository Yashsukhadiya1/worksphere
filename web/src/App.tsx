import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import EmployeesPage from "@/pages/employees/EmployeesPage";
import DepartmentsPage from "@/pages/departments/DepartmentsPage";
import AttendancePage from "@/pages/attendance/AttendancePage";
import PayrollPage from "@/pages/payroll/PayrollPage";
import PerformancePage from "@/pages/performance/PerformancePage";
import AIPage from "@/pages/ai/AIDashboard";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import AuditLogsPage from "@/pages/audit/AuditLogsPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  useEffect(() => { loadUser(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="employees"    element={<EmployeesPage />} />
          <Route path="departments"  element={<DepartmentsPage />} />
          <Route path="attendance"   element={<AttendancePage />} />
          <Route path="payroll"      element={<PayrollPage />} />
          <Route path="performance"  element={<PerformancePage />} />
          <Route path="ai"           element={<AIPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit-logs"   element={<AuditLogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
