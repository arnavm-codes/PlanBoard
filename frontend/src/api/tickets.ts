import { apiFetch, jsonPatch, jsonPost, parseErrorDetail } from "./client";
import { TicketPriority, TicketStatus } from "../constants/priority";

export interface Ticket {
  id: number;
  project_id: number;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: number | null;
  reporter_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  ticket_id: number;
  author_id: number;
  author_username: string;
  body: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  comments: Comment[];
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee_id?: number;
  due_before?: string;
  due_after?: string;
}

export interface TicketCreateInput {
  title: string;
  description?: string;
  priority?: TicketPriority;
  assignee_id?: number | null;
  due_date?: string | null;
}

export interface TicketUpdateInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee_id?: number | null;
  due_date?: string | null;
}

export async function listTickets(projectId: number, filters: TicketFilters = {}): Promise<Ticket[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  const res = await apiFetch(`/projects/${projectId}/tickets${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function createTicket(projectId: number, payload: TicketCreateInput): Promise<Ticket> {
  const res = await jsonPost(`/projects/${projectId}/tickets`, payload);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getTicket(ticketId: number): Promise<TicketDetail> {
  const res = await apiFetch(`/tickets/${ticketId}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function updateTicket(ticketId: number, payload: TicketUpdateInput): Promise<Ticket> {
  const res = await jsonPatch(`/tickets/${ticketId}`, payload);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function deleteTicket(ticketId: number): Promise<void> {
  const res = await apiFetch(`/tickets/${ticketId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
}

export async function addComment(ticketId: number, body: string): Promise<Comment> {
  const res = await jsonPost(`/tickets/${ticketId}/comments`, { body });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
