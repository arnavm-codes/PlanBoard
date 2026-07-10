import { useDraggable } from "@dnd-kit/core";
import { Ticket } from "../api/tickets";
import { PRIORITY_LABELS, PRIORITY_SOLID } from "../constants/priority";
import Avatar from "./Avatar";

interface TicketCardProps {
  ticket: Ticket;
  assigneeUsername?: string;
  onClick: () => void;
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "done") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function TicketCard({ ticket, assigneeUsername, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  const overdue = isOverdue(ticket.due_date, ticket.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-2 ${PRIORITY_SOLID[ticket.priority]}`}
      >
        {PRIORITY_LABELS[ticket.priority]}
      </span>
      <p className="text-sm font-medium mb-3 leading-snug">{ticket.title}</p>
      <div className="flex items-center justify-between text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-gray-400 dark:text-gray-500">#{ticket.number}</span>
          {ticket.due_date && (
            <span
              className={
                overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"
              }
            >
              {ticket.due_date}
            </span>
          )}
        </div>
        {assigneeUsername && <Avatar username={assigneeUsername} />}
      </div>
    </div>
  );
}

export default TicketCard;
