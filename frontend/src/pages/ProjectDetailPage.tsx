import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, Users as UsersIcon, Activity as ActivityIcon } from "lucide-react";
import { User } from "../api/auth";
import { listUsers } from "../api/users";
import {
  addMember,
  getProject,
  ProjectDetail,
  ProjectMemberRole,
  removeMember,
  updateProject,
} from "../api/projects";
import { listTickets, Ticket, TicketFilters, updateTicket } from "../api/tickets";
import { listProjectActivity, ActivityLogEntry } from "../api/activity";
import { PRIORITIES, PRIORITY_LABELS, TicketPriority, TicketStatus } from "../constants/priority";
import Board from "../components/Board";
import CreateTicketModal from "../components/CreateTicketModal";
import TicketDetailModal from "../components/TicketDetailModal";
import ActivityFeed from "../components/ActivityFeed";

interface ProjectDetailPageProps {
  currentUser: User;
}

function ProjectDetailPage({ currentUser }: ProjectDetailPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  const [newMemberId, setNewMemberId] = useState<number | "">("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectMemberRole>("worker");
  const [memberError, setMemberError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>({});
  const [search, setSearch] = useState("");

  const [createModalStatus, setCreateModalStatus] = useState<TicketStatus | null>(null);
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);

  const isSuperadmin = currentUser.role === "superadmin";
  const isProjectAdmin =
    isSuperadmin ||
    project?.members.some((m) => m.user_id === currentUser.id && m.role_in_project === "admin");

  async function refreshProject() {
    const p = await getProject(id);
    setProject(p);
    setName(p.name);
    setDescription(p.description);
  }

  async function refreshTickets() {
    const t = await listTickets(id, filters);
    setTickets(t);
  }

  // Used after creating/editing a ticket: a superadmin assigning a ticket to
  // a non-member auto-adds them as a project member server-side, so we need
  // project.members (and therefore usersById) refreshed too, not just the
  // ticket list — otherwise the newly-assigned person's name/avatar
  // wouldn't show until the next full page load.
  async function refreshTicketsAndProject() {
    await Promise.all([refreshProject(), refreshTickets()]);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([refreshProject(), refreshTickets()]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    if (currentUser.role === "superadmin") {
      listUsers().then(setAllUsers).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!loading) refreshTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Deep link from notifications / activity: /projects/:id?ticket=<id> opens
  // that ticket's detail modal directly instead of just landing on the board.
  useEffect(() => {
    const ticketParam = searchParams.get("ticket");
    if (ticketParam) {
      setOpenTicketId(Number(ticketParam));
      const next = new URLSearchParams(searchParams);
      next.delete("ticket");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    try {
      await updateProject(id, { name, description });
      await refreshProject();
      setEditingMeta(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (newMemberId === "") {
      setMemberError("Select a user to add");
      return;
    }
    setMemberError(null);
    try {
      await addMember(id, newMemberId, newMemberRole);
      setNewMemberId("");
      setNewMemberRole("worker");
      await refreshProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Failed to add member");
    }
  }

  async function handleRemoveMember(userId: number) {
    try {
      await removeMember(id, userId);
      await refreshProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function toggleActivity() {
    const opening = !activityOpen;
    setActivityOpen(opening);
    if (opening) {
      try {
        setActivity(await listProjectActivity(id));
      } catch {
        setActivity([]);
      }
    }
  }

  async function handleStatusChange(ticketId: number, newStatus: TicketStatus) {
    const previous = tickets;
    setTickets((ts) => ts.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
    try {
      await updateTicket(ticketId, { status: newStatus });
    } catch (err) {
      setTickets(previous); // roll back the optimistic update
      setError(err instanceof Error ? err.message : "Failed to move ticket");
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading project...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!project) return null;

  const memberUserIds = new Set(project.members.map((m) => m.user_id));
  const addableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));
  const usersById = Object.fromEntries(project.members.map((m) => [m.user_id, m.username]));
  const memberOptions = project.members.map((m) => ({ id: m.user_id, username: m.username }));
  // Superadmin can assign a ticket to any worker system-wide, not just
  // current project members — the backend auto-adds them as a project
  // member (worker role) when the assignment happens, so they can still
  // view their own ticket afterward.
  const assigneeOptions = isSuperadmin
    ? allUsers.filter((u) => u.role !== "superadmin").map((u) => ({ id: u.id, username: u.username }))
    : memberOptions;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          {editingMeta ? (
            <form onSubmit={handleSaveMeta} className="space-y-2 max-w-lg">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xl font-semibold rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
                >
                  {savingMeta ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMeta(false)}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div onClick={() => isProjectAdmin && setEditingMeta(true)} className={isProjectAdmin ? "cursor-pointer" : ""}>
              <h1 className="text-xl font-semibold">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setMembersOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <UsersIcon size={14} />
            {project.members.length}
          </button>
          <button
            onClick={toggleActivity}
            className="flex items-center gap-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ActivityIcon size={14} />
            Activity
          </button>
        </div>
      </div>

      {activityOpen && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 max-w-md">
          <ActivityFeed entries={activity} />
        </div>
      )}

      {membersOpen && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 max-w-md space-y-3">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {project.members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  {m.username} <span className="text-gray-500 dark:text-gray-400">({m.role_in_project})</span>
                </span>
                {isProjectAdmin && (
                  <button
                    onClick={() => handleRemoveMember(m.user_id)}
                    className="text-xs rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isProjectAdmin && isSuperadmin && (
            <form onSubmit={handleAddMember} className="flex items-center gap-2">
              <select
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm"
              >
                <option value="">Add user...</option>
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as ProjectMemberRole)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm"
              >
                <option value="worker">worker</option>
                <option value="admin">admin</option>
              </select>
              <button
                type="submit"
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Add
              </button>
            </form>
          )}
          {memberError && <p className="text-sm text-red-600 dark:text-red-400">{memberError}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-gray-300 dark:border-gray-600 bg-transparent pl-8 pr-3 py-1.5 text-sm w-48"
          />
        </div>
        <select
          value={filters.priority ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, priority: (e.target.value || undefined) as TicketPriority | undefined }))
          }
          className="rounded-full border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5"
        >
          <option value="">Priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={filters.assignee_id ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, assignee_id: e.target.value ? Number(e.target.value) : undefined }))
          }
          className="rounded-full border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5"
        >
          <option value="">Assignee</option>
          {memberOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
        <label className="text-gray-500 dark:text-gray-400 text-xs">Due by</label>
        <input
          type="date"
          value={filters.due_before ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, due_before: e.target.value || undefined }))}
          className="rounded-full border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1.5"
        />
        {(filters.priority || filters.assignee_id || filters.due_before || search) && (
          <button
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
            className="text-gray-500 dark:text-gray-400 hover:underline text-xs"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setCreateModalStatus("todo")}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
        >
          <Plus size={14} />
          Add ticket
        </button>
      </div>

      <Board
        tickets={tickets.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))}
        usersById={usersById}
        onStatusChange={handleStatusChange}
        onCardClick={(t) => setOpenTicketId(t.id)}
        onAddClick={(s) => setCreateModalStatus(s)}
      />

      {createModalStatus && (
        <CreateTicketModal
          projectId={id}
          initialStatus={createModalStatus}
          memberOptions={assigneeOptions}
          onClose={() => setCreateModalStatus(null)}
          onCreated={refreshTicketsAndProject}
        />
      )}

      {openTicketId && (
        <TicketDetailModal
          ticketId={openTicketId}
          currentUserId={currentUser.id}
          canManage={Boolean(isProjectAdmin)}
          usersById={usersById}
          memberOptions={assigneeOptions}
          onClose={() => setOpenTicketId(null)}
          onChanged={refreshTicketsAndProject}
        />
      )}
    </div>
  );
}

export default ProjectDetailPage;
