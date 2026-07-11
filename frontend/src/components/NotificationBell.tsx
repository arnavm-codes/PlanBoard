import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  connectNotificationSocket,
  listNotifications,
  markAllRead,
  markRead,
  Notification,
} from "../api/notifications";
import { getTicket } from "../api/tickets";

function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  // Glows red from the moment a notification arrives until the user opens
  // the dropdown to look at it — separate from unreadCount so it doesn't
  // reappear just because some notifications are still individually unread.
  const [hasUnseen, setHasUnseen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listNotifications()
      .then(setNotifications)
      .catch(() => {});

    const socket = connectNotificationSocket((n) => {
      setNotifications((prev) => [n, ...prev]);
      setHasUnseen(true);
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleToggleOpen() {
    setOpen((v) => !v);
    setHasUnseen(false);
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      try {
        await markRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch {
        // best-effort
      }
    }
    setOpen(false);
    if (n.related_ticket_id) {
      try {
        const ticket = await getTicket(n.related_ticket_id);
        navigate(`/projects/${ticket.project_id}?ticket=${ticket.id}`);
      } catch {
        // Ticket may have been deleted since the notification was created,
        // or the user may no longer have access — fall back to the project list.
        navigate("/projects");
      }
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // best-effort
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggleOpen}
        className={`relative flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border shadow-sm w-9 h-9 hover:bg-gray-50 dark:hover:bg-gray-700 ${
          hasUnseen
            ? "border-red-500 animate-pulse shadow-[0_0_8px_2px_rgba(220,38,38,0.6)]"
            : "border-gray-200 dark:border-gray-700"
        }`}
        aria-label="Notifications"
      >
        <Bell size={16} className={hasUnseen ? "text-red-600 dark:text-red-500" : undefined} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-4">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    n.is_read ? "text-gray-500 dark:text-gray-400" : "font-medium"
                  }`}
                >
                  <p>{n.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
