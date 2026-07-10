import { ActivityLogEntry } from "../api/activity";

interface ActivityFeedProps {
  entries: ActivityLogEntry[];
  emptyMessage?: string;
}

function ActivityFeed({ entries, emptyMessage = "No activity yet." }: ActivityFeedProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {entries.map((e) => (
        <li key={e.id} className="py-2 text-sm">
          <p className="text-gray-700 dark:text-gray-300">{e.description}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}

export default ActivityFeed;
