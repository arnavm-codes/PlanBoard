import { apiFetch, jsonPatch, jsonPost, parseErrorDetail } from "./client";
import { User, UserRole } from "./auth";

export async function listUsers(): Promise<User[]> {
  const res = await apiFetch("/users");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  fullName?: string,
): Promise<User> {
  const res = await jsonPost("/users", { username, password, role, full_name: fullName || null });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function updateUserRole(userId: number, role: UserRole): Promise<User> {
  const res = await jsonPatch(`/users/${userId}/role`, { role });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function setUserActive(userId: number, isActive: boolean): Promise<User> {
  const res = await jsonPatch(`/users/${userId}/activation`, { is_active: isActive });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function deleteUser(userId: number): Promise<void> {
  const res = await apiFetch(`/users/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
}
