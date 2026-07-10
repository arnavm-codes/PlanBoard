import { apiFetch, parseErrorDetail } from "./client";
import { Project } from "./projects";
import { Ticket } from "./tickets";

export interface TicketWithProject extends Ticket {
  project_name: string;
}

export interface DashboardMe {
  assigned_tickets: TicketWithProject[];
  due_soon_tickets: TicketWithProject[];
  overdue_count: number;
  projects: Project[];
}

export interface WorkloadEntry {
  user_id: number;
  username: string;
  ticket_count: number;
}

export interface ProjectInsight {
  project_id: number;
  project_name: string;
  counts_by_status: Record<string, number>;
  overdue_count: number;
  workload: WorkloadEntry[];
}

export interface DashboardInsights {
  projects: ProjectInsight[];
}

export async function getDashboardMe(): Promise<DashboardMe> {
  const res = await apiFetch("/dashboard/me");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  const res = await apiFetch("/dashboard/insights");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
