import { useNavigate } from "react-router-dom";
import { ActivityLogEntry } from "../api/activity";

interface ActivityFeedProps {
  entries: ActivityLogEntry[];
  emptyMessage?: string;
}

function ActivityFeed({ entries, emptyMessage = "No activity yet." }: ActivityFeedProps) {
  const navigate = useNavigate();

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {entries.map((e) => {
        // Only ticket-targeted entries with a known project can route to the
        // board — e.g. member_added entries target a user, not a ticket.
        const isTicketLink = e.target_type === "ticket" && e.project_id !== null;
        return (
          <li
            key={e.id}
            onClick={isTicketLink ? () => navigate(`/projects/${e.project_id}?ticket=${e.target_id}`) : undefined}
            className={`py-2 text-sm ${isTicketLink ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 -mx-1" : ""}`}
          >
            <p className="text-gray-700 dark:text-gray-300">{e.description}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(e.created_at).toLocaleString()}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default ActivityFeed;
