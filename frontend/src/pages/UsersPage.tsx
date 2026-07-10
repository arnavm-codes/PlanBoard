import { FormEvent, useEffect, useState } from "react";
import { User, UserRole } from "../api/auth";
import { createUser, deleteUser, listUsers, setUserActive, updateUserRole } from "../api/users";
import PasswordInput from "../components/PasswordInput";

const ROLES: UserRole[] = ["superadmin", "admin", "worker"];

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("worker");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      await createUser(username, password, role, fullName);
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("worker");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: number, newRole: UserRole) {
    await updateUserRole(userId, newRole);
    await refresh();
  }

  async function handleToggleActive(u: User) {
    await setUserActive(u.id, !u.is_active);
    await refresh();
  }

  async function handleDelete(u: User) {
    if (!window.confirm(`Permanently delete user '${u.username}'? This cannot be undone.`)) {
      return;
    }
    setRowError(null);
    try {
      await deleteUser(u.id);
      await refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading users...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-4">Users</h1>
        {rowError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{rowError}</p>}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-4">{u.full_name || <span className="text-gray-400">—</span>}</td>
                <td className="py-2 pr-4">{u.username}</td>
                <td className="py-2 pr-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    className="rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-4">
                  {u.is_active ? (
                    <span className="text-green-600 dark:text-green-400">Active</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">Deactivated</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className="text-xs rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="text-xs rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="space-y-3 max-w-sm border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-sm font-medium">Create user</h2>
        <input
          type="text"
          placeholder="Name (optional)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
        />
        <PasswordInput
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          {creating ? "Creating..." : "Create user"}
        </button>
      </form>
    </div>
  );
}

export default UsersPage;
