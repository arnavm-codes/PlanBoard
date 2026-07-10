import { apiFetch } from "./client";

export type UserRole = "superadmin" | "admin" | "worker";
export type ThemePreference = "light" | "dark";

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: UserRole;
  theme_preference: ThemePreference;
  is_active: boolean;
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function login(username: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<User | null> {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
}

export async function updateTheme(themePreference: ThemePreference): Promise<User> {
  const res = await apiFetch("/auth/theme", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme_preference: themePreference }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  return res.json();
}
