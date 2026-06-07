import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { myNotifications } from "@/api/endpoints";
import { useEffect, useState } from "react";

const NAV: { label: string; to: string; roles: string[] }[] = [
  { label: "Dashboard",   to: "/dashboard",    roles: ["admin","hr_manager","dept_manager","employee"] },
  { label: "Employees",   to: "/employees",    roles: ["admin","hr_manager"] },
  { label: "Departments", to: "/departments",  roles: ["admin"] },
  { label: "Attendance",  to: "/attendance",   roles: ["admin","hr_manager","dept_manager","employee"] },
  { label: "Payroll",     to: "/payroll",      roles: ["admin","hr_manager","employee"] },
  { label: "Performance", to: "/performance",  roles: ["admin","hr_manager","dept_manager","employee"] },
  { label: "AI Insights", to: "/ai",           roles: ["admin","hr_manager","dept_manager","employee"] },
  { label: "Audit Logs",  to: "/audit-logs",   roles: ["admin"] },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
  }`;

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    myNotifications().then((n) => setUnread(n.length)).catch(() => {});
  }, []);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const visibleNav = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white shadow flex flex-col">
        <div className="px-5 py-4 border-b">
          <span className="text-lg font-bold text-blue-700">EEMS</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/notifications" className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`}>
            Notifications {unread > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 text-xs">{unread}</span>}
          </NavLink>
        </nav>
        <div className="px-4 py-3 border-t text-xs text-gray-500">
          <p className="truncate">{user?.email}</p>
          <p className="capitalize text-gray-400">{user?.role.replace("_"," ")}</p>
          <button onClick={handleLogout} className="mt-2 text-red-500 hover:underline">Logout</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
