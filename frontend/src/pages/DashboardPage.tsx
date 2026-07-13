import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardInsights, DashboardMe, getDashboardInsights, getDashboardMe } from "../api/dashboard";
import { COLUMNS, PRIORITY_COLORS, PRIORITY_LABELS } from "../constants/priority";

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function DashboardPage() {
  const [me, setMe] = useState<DashboardMe | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getDashboardMe(), getDashboardInsights()])
      .then(([m, i]) => {
        setMe(m);
        setInsights(i);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading dashboard...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!me || !insights) return null;

  const dueSoonIds = new Set(me.due_soon_tickets.map((t) => t.id));

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <h1 className="text-xl font-semibold mb-4">My tickets</h1>
        {me.assigned_tickets.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No open tickets assigned to you.</p>
        ) : (
          <ul className="space-y-2">
            {me.assigned_tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${t.project_id}?ticket=${t.id}`)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">#{t.number}</span>
                    <span className="text-sm font-medium">{t.title}</span>
                    {dueSoonIds.has(t.id) && (
                      <span
                        className={`ml-2 text-xs rounded px-1.5 py-0.5 ${
                          isOverdue(t.due_date)
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        }`}
                      >
                        {isOverdue(t.due_date) ? "Overdue" : "Due soon"}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs rounded px-1.5 py-0.5 ${PRIORITY_COLORS[t.priority]}`}>
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {me.overdue_count > 0 && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3">
            {me.overdue_count} overdue ticket{me.overdue_count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <h2 className="text-sm font-medium mb-3">Projects</h2>
        {me.projects.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">You're not a member of any project yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {me.projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="text-sm rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 inline-block"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {insights.projects.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
          <h2 className="text-sm font-medium mb-3">Insights</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.projects.map((p) => (
              <div key={p.project_id} className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                <p className="text-sm font-medium mb-2">{p.project_name}</p>
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  {COLUMNS.map((c) => (
                    <span
                      key={c.status}
                      className="rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5"
                    >
                      {c.label}: {p.counts_by_status[c.status] ?? 0}
                    </span>
                  ))}
                </div>
                {p.overdue_count > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">{p.overdue_count} overdue</p>
                )}
                {p.workload.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    {p.workload.map((w) => (
                      <p key={w.user_id}>
                        {w.username}: {w.ticket_count} open ticket{w.ticket_count === 1 ? "" : "s"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
