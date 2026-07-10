import { apiFetch, parseErrorDetail } from "./client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface Notification {
  id: number;
  type: string;
  message: string;
  related_ticket_id: number | null;
  is_read: boolean;
  created_at: string;
}

export async function listNotifications(): Promise<Notification[]> {
  const res = await apiFetch("/notifications");
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function markRead(id: number): Promise<Notification> {
  const res = await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function markAllRead(): Promise<void> {
  const res = await apiFetch("/notifications/mark-all-read", { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
}

export function connectNotificationSocket(onMessage: (n: Notification) => void): WebSocket {
  const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws/notifications";
  const socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };
  return socket;
}
