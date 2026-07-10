import { apiFetch, jsonPatch, jsonPost, parseErrorDetail } from "./client";

export type ProjectMemberRole = "admin" | "worker";

export interface Project {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  username: string;
  role_in_project: ProjectMemberRole;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export async function listProjects(): Promise<Project[]> {
  const res = await apiFetch("/projects");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function createProject(
  name: string,
  description: string,
  adminUserId: number,
): Promise<Project> {
  const res = await jsonPost("/projects", { name, description, admin_user_id: adminUserId });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getProject(projectId: number): Promise<ProjectDetail> {
  const res = await apiFetch(`/projects/${projectId}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function updateProject(
  projectId: number,
  payload: { name?: string; description?: string },
): Promise<Project> {
  const res = await jsonPatch(`/projects/${projectId}`, payload);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function addMember(
  projectId: number,
  userId: number,
  roleInProject: ProjectMemberRole,
): Promise<ProjectMember> {
  const res = await jsonPost(`/projects/${projectId}/members`, { user_id: userId, role_in_project: roleInProject });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function removeMember(projectId: number, userId: number): Promise<void> {
  const res = await apiFetch(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
}

export async function deleteProject(projectId: number): Promise<void> {
  const res = await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
}
