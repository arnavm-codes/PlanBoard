import { FormEvent, useState } from "react";
import { createTicket, updateTicket } from "../api/tickets";
import { PRIORITIES, PRIORITY_LABELS, TicketPriority, TicketStatus } from "../constants/priority";

interface CreateTicketModalProps {
  projectId: number;
  initialStatus: TicketStatus;
  memberOptions: { id: number; username: string }[];
  onClose: () => void;
  onCreated: () => void;
}

function CreateTicketModal({ projectId, initialStatus, memberOptions, onClose, onCreated }: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const ticket = await createTicket(projectId, {
        title,
        description,
        priority,
        assignee_id: assigneeId === "" ? null : assigneeId,
        due_date: dueDate || null,
      });
      if (initialStatus !== "backlog") {
        // createTicket always starts as backlog server-side; move it if a
        // non-backlog column's "+" was used.
        await updateTicket(ticket.id, { status: initialStatus });
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">New ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description (markdown supported)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTicketModal;
