import { FormEvent, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { addComment, deleteTicket, getTicket, TicketDetail, updateTicket } from "../api/tickets";
import { COLUMNS, PRIORITIES, PRIORITY_LABELS, PRIORITY_SOLID, TicketPriority, TicketStatus } from "../constants/priority";
import Avatar from "./Avatar";

interface TicketDetailModalProps {
  ticketId: number;
  currentUserId: number;
  canManage: boolean; // project admin or superadmin: full edit + delete
  usersById: Record<number, string>;
  memberOptions: { id: number; username: string }[];
  onClose: () => void;
  onChanged: () => void;
}

function TicketDetailModal({
  ticketId,
  currentUserId,
  canManage,
  usersById,
  memberOptions,
  onClose,
  onChanged,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("backlog");
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const t = await getTicket(ticketId);
      setTicket(t);
      setTitle(t.title);
      setDescription(t.description);
      setPriority(t.priority);
      setStatus(t.status);
      setAssigneeId(t.assignee_id ?? "");
      setDueDate(t.due_date ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (!ticket) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>
    );
  }

  const canEdit = canManage || currentUserId === ticket.reporter_id || currentUserId === ticket.assignee_id;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTicket(ticketId, {
        title,
        description,
        priority,
        status,
        assignee_id: assigneeId === "" ? null : assigneeId,
        due_date: dueDate || null,
      });
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ticket");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteTicket(ticketId);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket");
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setCommentError(null);
    try {
      await addComment(ticketId, commentBody);
      setCommentBody("");
      await refresh();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Failed to add comment");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-xs text-gray-400 dark:text-gray-500 -mb-2">#{ticket.number}</p>
        {canEdit ? (
          <form onSubmit={handleSave} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Description (markdown supported)"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm font-mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
              >
                {COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {memberOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete ticket
                </button>
              )}
            </div>
          </form>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">{ticket.title}</h2>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:underline [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:rounded [&_code]:px-1">
              <ReactMarkdown>{ticket.description || "*No description*"}</ReactMarkdown>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_SOLID[ticket.priority]}`}
              >
                {PRIORITY_LABELS[ticket.priority]}
              </span>
              {ticket.assignee_id && usersById[ticket.assignee_id] && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Avatar username={usersById[ticket.assignee_id]} />
                  {usersById[ticket.assignee_id]}
                </span>
              )}
              {ticket.due_date && (
                <span className="text-xs text-gray-500 dark:text-gray-400">due {ticket.due_date}</span>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium mb-3">Comments</h3>
          <div className="space-y-3 mb-4">
            {ticket.comments.length === 0 && (
              <p className="text-sm text-gray-400">No comments yet.</p>
            )}
            {ticket.comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-sm">
                <Avatar username={c.author_username} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{c.author_username}</span>{" "}
                    · {new Date(c.created_at).toLocaleString()}
                  </p>
                  <div className="text-sm text-gray-700 dark:text-gray-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:underline [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:rounded [&_code]:px-1">
                    <ReactMarkdown>{c.body}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="space-y-2">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              placeholder="Add a comment (markdown supported)"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
            />
            {commentError && <p className="text-sm text-red-600 dark:text-red-400">{commentError}</p>}
            <button
              type="submit"
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Comment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TicketDetailModal;
