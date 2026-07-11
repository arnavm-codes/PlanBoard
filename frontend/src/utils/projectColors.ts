// Full class strings only — Tailwind's content scanner needs the literal
// name present in source, so these can't be built by string interpolation.
const PROJECT_COLOR_PALETTE = [
  "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
  "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900",
  "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
  "bg-lime-50 dark:bg-lime-950/40 border-lime-200 dark:border-lime-900",
  "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900",
  "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900",
  "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900",
  "bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-200 dark:border-fuchsia-900",
  "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900",
];

// Deterministic per project (stable across reloads/re-renders) rather than
// truly random on every render, which would make cards flicker colors.
export function projectColorClasses(projectId: number): string {
  return PROJECT_COLOR_PALETTE[projectId % PROJECT_COLOR_PALETTE.length];
}
