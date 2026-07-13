import { useEffect, useState } from "react";
import { ActivityLogEntry, listGlobalActivity } from "../api/activity";
import ActivityFeed from "../components/ActivityFeed";

function ActivityPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGlobalActivity()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load activity"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400">Loading activity...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Activity</h1>
      <ActivityFeed entries={entries} emptyMessage="No activity yet." />
    </div>
  );
}

export default ActivityPage;
