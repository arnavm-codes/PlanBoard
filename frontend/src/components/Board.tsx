import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Ticket } from "../api/tickets";
import { COLUMNS, TicketStatus } from "../constants/priority";
import TicketCard from "./TicketCard";

interface BoardProps {
  tickets: Ticket[];
  usersById: Record<number, string>;
  onStatusChange: (ticketId: number, newStatus: TicketStatus) => void;
  onCardClick: (ticket: Ticket) => void;
  onAddClick: (status: TicketStatus) => void;
}

function Column({
  status,
  label,
  accent,
  tickets,
  usersById,
  onCardClick,
  onAddClick,
}: {
  status: TicketStatus;
  label: string;
  accent: string;
  tickets: Ticket[];
  usersById: Record<number, string>;
  onCardClick: (ticket: Ticket) => void;
  onAddClick: (status: TicketStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 rounded-md border border-gray-200 dark:border-gray-800 ${
        isOver ? "bg-blue-50 dark:bg-blue-950" : "bg-gray-50 dark:bg-gray-900"
      }`}
    >
      <div className={`h-1 rounded-t-md ${accent}`} />
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-gray-600 dark:text-gray-300">
          {label} <span className="text-gray-400 dark:text-gray-500 font-normal">{tickets.length}</span>
        </h3>
        <button
          onClick={() => onAddClick(status)}
          className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          title="Add ticket"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 px-2 pb-2 space-y-2 min-h-[120px]">
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            assigneeUsername={t.assignee_id ? usersById[t.assignee_id] : undefined}
            onClick={() => onCardClick(t)}
          />
        ))}
      </div>
    </div>
  );
}

function Board({ tickets, usersById, onStatusChange, onCardClick, onAddClick }: BoardProps) {
  // Without an activation constraint, dnd-kit starts "dragging" on the very
  // first pixel of pointer movement after mousedown, which swallows the
  // click event a plain tap/click relies on — the card's onClick then only
  // fires intermittently (effectively needing a second click). Requiring 8px
  // of movement before a drag activates lets an ordinary click pass through
  // untouched, while still recognizing an intentional drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const ticketId = Number(active.id);
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && ticket.status !== newStatus) {
      onStatusChange(ticketId, newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            accent={col.accent}
            tickets={tickets.filter((t) => t.status === col.status)}
            usersById={usersById}
            onCardClick={onCardClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>
    </DndContext>
  );
}

export default Board;
