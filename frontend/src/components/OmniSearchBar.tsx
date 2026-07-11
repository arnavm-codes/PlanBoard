import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban, Ticket as TicketIcon, User as UserIcon, MessageSquare } from "lucide-react";
import { omniSearch, SearchResults } from "../api/search";
import { COLUMNS } from "../constants/priority";
import { User } from "../api/auth";

const EMPTY_RESULTS: SearchResults = { projects: [], tickets: [], users: [], comments: [] };
const DEBOUNCE_MS = 200;

// Every match becomes one flat, ordered entry so arrow-key navigation can
// move through groups without caring about their boundaries.
interface FlatEntry {
  key: string;
  onSelect: () => void;
  render: () => JSX.Element;
}

interface OmniSearchBarProps {
  currentUser: User;
}

function statusLabel(status: string): string {
  return COLUMNS.find((c) => c.status === status)?.label ?? status;
}

function OmniSearchBar({ currentUser }: OmniSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      omniSearch(trimmed, controller.signal)
        .then((r) => {
          setResults(r);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(path: string) {
    navigate(path);
    setOpen(false);
    setQuery("");
  }

  const entries: FlatEntry[] = [
    ...results.projects.map((p) => ({
      key: `project-${p.id}`,
      onSelect: () => goTo(`/projects/${p.id}`),
      render: () => (
        <>
          <FolderKanban size={14} className="shrink-0 text-gray-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{p.name}</p>
            {p.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.description}</p>}
          </div>
        </>
      ),
    })),
    ...results.tickets.map((t) => ({
      key: `ticket-${t.id}`,
      onSelect: () => goTo(`/projects/${t.project_id}?ticket=${t.id}`),
      render: () => (
        <>
          <TicketIcon size={14} className="shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{t.title}</p>
          </div>
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{statusLabel(t.status)}</span>
        </>
      ),
    })),
    ...results.comments.map((c) => ({
      key: `comment-${c.id}`,
      onSelect: () => goTo(`/projects/${c.project_id}?ticket=${c.ticket_id}`),
      render: () => (
        <>
          <MessageSquare size={14} className="shrink-0 text-gray-400" />
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{c.snippet}</p>
        </>
      ),
    })),
    ...results.users.map((u) => ({
      key: `user-${u.id}`,
      onSelect: currentUser.role === "superadmin" ? () => goTo("/users") : () => {},
      render: () => (
        <>
          <UserIcon size={14} className="shrink-0 text-gray-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{u.username}</p>
            {u.full_name && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.full_name}</p>}
          </div>
        </>
      ),
    })),
  ];

  const hasQuery = query.trim().length > 0;
  const hasResults = entries.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !hasResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % entries.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? entries.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = entries[activeIndex] ?? entries[0];
      target.onSelect();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Omni-Search... Type something"
          className="w-full rounded-full border border-gray-300 dark:border-gray-600 bg-transparent pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          aria-label="Omni search"
        />
      </div>

      {open && hasQuery && (
        <div className="absolute left-0 mt-2 w-full max-h-96 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
          {loading && entries.length === 0 && <p className="text-sm text-gray-400 px-3 py-4">Searching...</p>}
          {!loading && !hasResults && <p className="text-sm text-gray-400 px-3 py-4">No matches found.</p>}
          {hasResults && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((entry, i) => (
                <li
                  key={entry.key}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={entry.onSelect}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                    i === activeIndex ? "bg-gray-50 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {entry.render()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default OmniSearchBar;
