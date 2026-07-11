import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Users as UsersIcon, Activity as ActivityIcon, LogOut, Moon, Sun } from "lucide-react";
import { getMe, logout, User } from "./api/auth";
import Login from "./pages/Login";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import UsersPage from "./pages/UsersPage";
import ActivityPage from "./pages/ActivityPage";
import NotificationBell from "./components/NotificationBell";
import OmniSearchBar from "./components/OmniSearchBar";
import Avatar from "./components/Avatar";
import { useTheme, toggleTheme } from "./hooks/useTheme";
import logoDark from "./assets/logo-dark.png";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Icon size={18} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

function App() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const location = useLocation();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useTheme(user);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (user === "loading") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (user === null) {
    return <Login onLoginSuccess={setUser} />;
  }

  const navItems: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
  ];
  if (user.role === "superadmin") {
    navItems.push({ to: "/users", label: "Users", icon: UsersIcon });
    navItems.push({ to: "/activity", label: "Activity", icon: ActivityIcon });
  }

  return (
    <div className="h-screen overflow-hidden flex bg-white text-gray-900 dark:bg-black dark:text-gray-100">
      <aside className="w-56 shrink-0 h-full border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center">
          {/* Fixed h-16 (matching the top bar's h-16) instead of vertical
              padding, so the logo can be sized up without the row's height —
              and therefore its border-bottom — drifting out of alignment
              with the top bar's border-bottom on the other side of the
              sidebar boundary. PNG has a black background — only fits the
              true-black dark shell. Light theme keeps the pixel-font
              wordmark until an inverted (white-bg) version of the logo is
              provided. */}
          {user.theme_preference === "dark" ? (
            <img src={logoDark} alt="PlanBoard" className="h-12 w-auto object-contain" />
          ) : (
            <span className="font-pixel font-bold text-xl tracking-wide">PlanBoard</span>
          )}
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              active={item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)}
            />
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800 space-y-3 shrink-0">
          <div className="flex items-center gap-2 px-1">
            <Avatar username={user.username} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleTheme(user, setUser)}
              className="flex-1 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {user.theme_preference === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        {/* Dedicated top bar for the notification bell — part of normal page
            flow (not a floating overlay), so page content always starts
            below it and nothing can ever render in the same space. */}
        <div className="h-16 sticky top-0 z-40 flex items-center justify-between gap-4 px-6 bg-white/90 dark:bg-black/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
          <OmniSearchBar currentUser={user} />
          <NotificationBell />
        </div>
        <main className="p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage currentUser={user} />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage currentUser={user} />} />
            {user.role === "superadmin" && <Route path="/users" element={<UsersPage />} />}
            {user.role === "superadmin" && <Route path="/activity" element={<ActivityPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
