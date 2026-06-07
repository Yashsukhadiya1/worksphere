import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  listEmployees, listDepartments, allAttendance,
  allLeaves, myNotifications,
} from "@/api/endpoints";
import { Link } from "react-router-dom";
import EmployeeFormModal from "@/pages/employees/EmployeeFormModal";

// ── tiny stat card ────────────────────────────────────────────────────────────
function StatCard({
  emoji, label, value, sub, accent,
}: {
  emoji: string; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${accent} p-5 flex items-start gap-4 shadow-sm`}>
      <span className="text-2xl leading-none mt-0.5">{emoji}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-3xl mb-1">{icon}</p>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

// ── bar chart (pure CSS) ──────────────────────────────────────────────────────
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 truncate text-gray-600 text-xs">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-gray-500">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: allAttendance,
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves-all"],
    queryFn: allLeaves,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: myNotifications,
  });

  // ── derived stats ─────────────────────────────────────────────────────────
  const activeEmp        = employees.filter((e) => e.status === "active").length;
  const inactiveEmp      = employees.filter((e) => e.status !== "active").length;
  const checkedInToday   = attendance.filter((a) => a.date === today).length;
  const pendingLeaves    = leaves.filter((l) => l.status === "pending").length;
  const approvedLeaves   = leaves.filter((l) => l.status === "approved").length;
  const rejectedLeaves   = leaves.filter((l) => l.status === "rejected").length;
  const unreadNotifs     = notifications.filter((n) => !n.is_read).length;

  // dept breakdown
  const deptCount: Record<string, number> = {};
  employees.forEach((e) => {
    const name = e.department?.name ?? "Unassigned";
    deptCount[name] = (deptCount[name] ?? 0) + 1;
  });
  const deptEntries = Object.entries(deptCount).sort((a, b) => b[1] - a[1]);
  const maxDeptCount = deptEntries[0]?.[1] ?? 1;

  // leave type breakdown
  const leaveTypes: Record<string, number> = {};
  leaves.forEach((l) => {
    leaveTypes[l.leave_type] = (leaveTypes[l.leave_type] ?? 0) + 1;
  });

  // recent 5 today attendance
  const todayAttendance = attendance.filter((a) => a.date === today).slice(0, 6);

  // recent 5 leaves
  const recentLeaves = [...leaves].reverse().slice(0, 5);

  // greeting
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {greeting}, {user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            <span className="capitalize font-medium text-gray-500">{user?.role?.replace(/_/g, " ")}</span>
            &nbsp;·&nbsp;{dateStr}
          </p>
        </div>
        <button
          onClick={() => setShowAddEmployee(true)}
          className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Employee
        </button>
      </div>

      {/* ── Primary stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard emoji="👥" label="Total Employees"  value={loadingEmp ? "…" : employees.length} sub={`${activeEmp} active · ${inactiveEmp} inactive`} accent="border-blue-100" />
        <StatCard emoji="🏢" label="Departments"      value={departments.length}  sub="configured"            accent="border-indigo-100" />
        <StatCard emoji="✅" label="Present Today"    value={checkedInToday}      sub="checked in so far"     accent="border-green-100" />
        <StatCard emoji="🔔" label="Unread Alerts"    value={unreadNotifs}        sub="notifications"         accent="border-rose-100" />
      </div>

      {/* ── Secondary stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard emoji="📅" label="Pending Leaves"   value={pendingLeaves}   sub="awaiting approval"     accent="border-amber-100" />
        <StatCard emoji="✔️" label="Approved Leaves"  value={approvedLeaves}  sub="all time"              accent="border-teal-100" />
        <StatCard emoji="❌" label="Rejected Leaves"  value={rejectedLeaves}  sub="all time"              accent="border-red-100" />
        <StatCard emoji="📋" label="Total Requests"   value={leaves.length}   sub="leave submissions"     accent="border-purple-100" />
      </div>

      {/* ── Three column row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Employees by department */}
        <Section title="Employees by Department">
          {deptEntries.length === 0 ? (
            <EmptyState icon="🏢" text="No employees assigned yet" />
          ) : (
            <div className="space-y-3">
              {deptEntries.map(([name, count]) => (
                <MiniBar key={name} label={name} value={count} max={maxDeptCount} color="bg-blue-400" />
              ))}
            </div>
          )}
        </Section>

        {/* Leave type breakdown */}
        <Section title="Leave Type Breakdown">
          {Object.keys(leaveTypes).length === 0 ? (
            <EmptyState icon="📭" text="No leave data yet" />
          ) : (
            <div className="space-y-3">
              {Object.entries(leaveTypes).map(([type, count]) => (
                <MiniBar key={type} label={type} value={count} max={leaves.length} color="bg-indigo-400" />
              ))}
              <div className="pt-2 border-t border-gray-50 grid grid-cols-3 text-center text-xs text-gray-500">
                <div><p className="font-bold text-green-600 text-base">{approvedLeaves}</p>Approved</div>
                <div><p className="font-bold text-amber-500 text-base">{pendingLeaves}</p>Pending</div>
                <div><p className="font-bold text-red-500 text-base">{rejectedLeaves}</p>Rejected</div>
              </div>
            </div>
          )}
        </Section>

        {/* System info */}
        <Section title="System Info">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Platform</span>
              <span className="font-medium text-gray-700">EEMS v1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Backend</span>
              <span className="font-medium text-gray-700">FastAPI + PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Web</span>
              <span className="font-medium text-gray-700">React 18 + Tailwind</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Mobile</span>
              <span className="font-medium text-gray-700">Flutter + Riverpod</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AI Engine</span>
              <span className="font-medium text-gray-700">Gemini + ML scoring</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Logged in as</span>
              <span className="font-medium text-blue-600 truncate max-w-[130px]">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                user?.role === "admin" ? "bg-blue-100 text-blue-700"
                : user?.role === "hr_manager" ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600"
              }`}>
                {user?.role?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Two column row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Today's attendance */}
        <Section
          title="Today's Attendance"
          action={<Link to="/attendance" className="text-xs text-blue-500 hover:underline">View all</Link>}
        >
          {todayAttendance.length === 0 ? (
            <EmptyState icon="🕐" text="No check-ins recorded today" />
          ) : (
            <ul className="divide-y divide-gray-50">
              {todayAttendance.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      In: <span className="font-medium text-gray-700">
                        {new Date(a.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {a.check_out && (
                        <> · Out: <span className="font-medium text-gray-700">
                          {new Date(a.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span></>
                      )}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.check_out ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {a.check_out ? `${a.total_hours}h` : "Active"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Recent leave requests */}
        <Section
          title="Recent Leave Requests"
          action={<Link to="/attendance" className="text-xs text-blue-500 hover:underline">View all</Link>}
        >
          {recentLeaves.length === 0 ? (
            <EmptyState icon="📭" text="No leave requests yet" />
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentLeaves.map((l) => (
                <li key={l.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">{l.leave_type}</p>
                    <p className="text-xs text-gray-400">{l.start_date} → {l.end_date}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    l.status === "approved" ? "bg-green-100 text-green-700"
                    : l.status === "rejected" ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                  }`}>
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── Quick links ── */}
      <Section title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: "/employees",   emoji: "👤", label: "Manage Employees" },
            { to: "/departments", emoji: "🏢", label: "Departments" },
            { to: "/payroll",     emoji: "💰", label: "Run Payroll" },
            { to: "/performance", emoji: "⭐", label: "Performance" },
            { to: "/attendance",  emoji: "🕐", label: "Attendance" },
            { to: "/ai",          emoji: "🤖", label: "AI Insights" },
            { to: "/notifications", emoji: "🔔", label: "Notifications" },
            { to: "/audit-logs",  emoji: "📋", label: "Audit Logs" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-center"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-medium text-gray-600">{item.label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {showAddEmployee && (
        <EmployeeFormModal
          employee={null}
          onClose={() => setShowAddEmployee(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setShowAddEmployee(false);
          }}
        />
      )}
    </div>
  );
}
