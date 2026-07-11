import { apiFetch, parseErrorDetail } from "./client";
import { TicketStatus } from "../constants/priority";

export interface ProjectSearchResult {
  id: number;
  name: string;
  description: string;
}

export interface TicketSearchResult {
  id: number;
  number: number;
  title: string;
  project_id: number;
  status: TicketStatus;
}

export interface UserSearchResult {
  id: number;
  username: string;
  full_name: string | null;
}

export interface CommentSearchResult {
  id: number;
  ticket_id: number;
  project_id: number;
  snippet: string;
}

export interface SearchResults {
  projects: ProjectSearchResult[];
  tickets: TicketSearchResult[];
  users: UserSearchResult[];
  comments: CommentSearchResult[];
}

export async function omniSearch(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
