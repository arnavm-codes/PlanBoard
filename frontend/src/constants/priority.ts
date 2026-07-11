export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";

export const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "critical"];

// Subtle tinted badges — used in filter dropdowns / compact inline text.
export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

// Solid-color pills — used on ticket cards / detail headers, closer to the
// Jira reference look (saturated background, white text, uppercase).
export const PRIORITY_SOLID: Record<TicketPriority, string> = {
  low: "bg-slate-500 text-white",
  medium: "bg-blue-600 text-white",
  high: "bg-orange-500 text-white",
  critical: "bg-red-600 text-white",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const COLUMNS: { status: TicketStatus; label: string; accent: string }[] = [
  { status: "backlog", label: "Backlog", accent: "bg-orange-700" },
  { status: "todo", label: "To Do", accent: "bg-blue-500" },
  { status: "in_progress", label: "In Progress", accent: "bg-amber-500" },
  { status: "in_review", label: "In Review", accent: "bg-purple-500" },
  { status: "done", label: "Done", accent: "bg-green-500" },
  { status: "cancelled", label: "Cancelled", accent: "bg-red-600" },
];
