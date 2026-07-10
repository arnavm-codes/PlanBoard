import { apiFetch, parseErrorDetail } from "./client";

export interface ActivityLogEntry {
  id: number;
  project_id: number | null;
  actor_id: number;
  actor_username: string;
  action_type: string;
  target_type: string;
  target_id: number;
  description: string;
  created_at: string;
}

export async function listProjectActivity(projectId: number): Promise<ActivityLogEntry[]> {
  const res = await apiFetch(`/projects/${projectId}/activity`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function listGlobalActivity(): Promise<ActivityLogEntry[]> {
  const res = await apiFetch("/activity");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function listDashboardActivity(): Promise<ActivityLogEntry[]> {
  const res = await apiFetch("/dashboard/activity");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
