import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { User } from "../api/auth";
import { listUsers } from "../api/users";
import { createProject, deleteProject, listProjects, Project } from "../api/projects";
import { projectColorClasses } from "../utils/projectColors";

interface ProjectsPageProps {
  currentUser: User;
}

function ProjectsPage({ currentUser }: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adminUserId, setAdminUserId] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSuperadmin = currentUser.role === "superadmin";

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listProjects());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (isSuperadmin) {
      listUsers().then(setUsers).catch(() => {});
    }
  }, [isSuperadmin]);

  async function handleDelete(e: MouseEvent, p: Project) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Permanently delete project '${p.name}'? This deletes all its tickets, comments, and members. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await deleteProject(p.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (adminUserId === "") {
      setFormError("Select an admin for this project");
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      await createProject(name, description, adminUserId);
      setName("");
      setDescription("");
      setAdminUserId("");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading projects...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-4">Projects</h1>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No projects yet.</p>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {projects.map((p) => (
              <div key={p.id} className="relative">
                <Link
                  to={`/projects/${p.id}`}
                  className={`block rounded-lg border p-4 pr-10 hover:shadow-md transition-shadow ${projectColorClasses(p.id)}`}
                >
                  <p className="font-medium">{p.name}</p>
                  {p.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                  )}
                </Link>
                {isSuperadmin && (
                  <button
                    onClick={(e) => handleDelete(e, p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Delete project ${p.name}`}
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isSuperadmin && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 max-w-sm border-t border-gray-200 dark:border-gray-700 pt-6"
        >
          <h2 className="text-sm font-medium">Create project</h2>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
          />
          <select
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value ? Number(e.target.value) : "")}
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Select project admin...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
      )}
    </div>
  );
}

export default ProjectsPage;
