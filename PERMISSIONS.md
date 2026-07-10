# PlanBoard Permissions Matrix

This is the source of truth for role-based access control. Every backend route must
enforce these rules server-side (via a dependency/middleware check) — UI hiding alone
is never sufficient. As routes are implemented in later phases, this table is the
checklist for what each route's authorization dependency should enforce.

## Roles

- **Superadmin** — one or more system-wide administrators. Only role that can create
  user accounts.
- **Admin** — scoped to one or more specific projects, assigned by a superadmin.
- **Worker** — scoped to the project(s) they're a member of.

## Matrix

| Action                                      | Superadmin | Admin (own project) | Worker (own project) |
|----------------------------------------------|:----------:|:--------------------:|:----------------------:|
| Create user account                          | ✅         | ❌                    | ❌                      |
| Change any user's role                       | ✅         | ❌                    | ❌                      |
| Deactivate/reactivate user account           | ✅         | ❌                    | ❌                      |
| Create project                               | ✅         | ❌                    | ❌                      |
| Assign project admin                         | ✅         | ❌                    | ❌                      |
| Edit project metadata (name/description)     | ✅         | ✅ (own project)      | ❌                      |
| View project (board, activity, members)      | ✅ (all)   | ✅ (own project)      | ✅ (own project)        |
| Add/remove project members                   | ✅         | ✅ (own project)      | ❌                      |
| Create ticket                                | ✅         | ✅ (own project)      | ✅ (own project)        |
| Edit ticket (any)                            | ✅         | ✅ (own project)      | ❌                      |
| Edit ticket (own — created by or assigned to)| ✅         | ✅                    | ✅                      |
| Delete ticket                                | ✅         | ✅ (own project)      | ❌                      |
| Move ticket status / assign ticket           | ✅         | ✅ (own project)      | ✅ (own tickets only)   |
| Comment on ticket                            | ✅         | ✅ (own project)      | ✅ (own project)        |
| View activity feed                           | ✅ (global)| ✅ (own project)      | ✅ (own project/tickets)|
| View dashboard insights/aggregates           | ✅ (global)| ✅ (own project)      | ✅ (own scope)          |

## Implemented Routes

| Route                          | Auth required | Enforcement |
|---------------------------------|---------------|-------------|
| `POST /auth/login`              | No            | Rate-limited (`app/core/rate_limit.py`, 5 failed attempts / 15 min per username+IP) |
| `POST /auth/refresh`            | Refresh cookie| Validates + rotates refresh token (`app/core/security.py::rotate_refresh_token`) |
| `POST /auth/logout`             | Refresh cookie| Revokes the presented refresh token |
| `POST /auth/change-password`    | Yes (any role)| `get_current_user`; verifies current password; revokes all other sessions |
| `GET /auth/me`                  | Yes (any role)| `get_current_user` |
| `PATCH /auth/theme`             | Yes (any role)| `get_current_user`; only ever updates the caller's own `theme_preference` |
| `POST /users`                   | Superadmin    | `require_role(superadmin)` |
| `GET /users`                    | Superadmin    | `require_role(superadmin)` |
| `PATCH /users/{id}/role`        | Superadmin    | `require_role(superadmin)` |
| `PATCH /users/{id}/activation`  | Superadmin    | `require_role(superadmin)`; deactivating also revokes all the user's refresh tokens |
| `DELETE /users/{id}`            | Superadmin    | `require_role(superadmin)`; hard-blocked (400) if the user has any tickets, comments, activity log entries, or created projects — deactivate is the only option for users with history, since deleting them would orphan historical attribution (a ticket's `reporter_id`, a comment's `author_id`, etc. are all `NOT NULL`) |
| `POST /projects`                | Superadmin    | `require_role(superadmin)`; creates the project + the assigned admin's `ProjectMember` row in one transaction |
| `GET /projects`                 | Yes (any role)| `get_current_user`; superadmin sees all, others see only projects they have a `ProjectMember` row for |
| `GET /projects/{id}`            | Project member| `require_project_member()`; 404 (not 403) if not a member, so membership can't be probed |
| `PATCH /projects/{id}`          | Project admin | `require_project_member(admin)` |
| `POST /projects/{id}/members`   | Project admin | `require_project_member(admin)` |
| `DELETE /projects/{id}/members/{user_id}` | Project admin | `require_project_member(admin)`; refuses to remove a project's last remaining admin |
| `DELETE /projects/{id}`         | Superadmin    | `require_role(superadmin)`; hard-deletes the project and cascades (via `ON DELETE CASCADE`) to its tickets, comments, and memberships — unlike user deletion, not history-blocked, since a project's tickets have no meaning without it. That project's activity log entries lose their `project_id` (`ON DELETE SET NULL`) but keep their descriptive text |
| `POST /projects/{id}/tickets`   | Project member| `require_project_member()`; `reporter_id` is always the caller, never client-supplied; if the caller is superadmin and `assignee_id` isn't yet a project member, `_ensure_project_member` auto-adds them (as worker) first |
| `GET /projects/{id}/tickets`    | Project member| `require_project_member()`; supports `status`/`priority`/`assignee_id`/`due_before`/`due_after` filters |
| `GET /tickets/{id}`             | Ticket's project member | `require_ticket_access()`; 404 if not found or not a member of the ticket's project |
| `PATCH /tickets/{id}`           | Ticket's project member | `require_ticket_access()`, then: project admins/superadmin may edit any field; workers may edit only if they're the ticket's reporter or assignee; else 403. Same auto-add-as-member behavior as ticket creation when a superadmin reassigns to a non-member |
| `DELETE /tickets/{id}`          | Project admin | `require_ticket_access(admin)` — workers can't delete even their own tickets |
| `POST /tickets/{id}/comments`   | Ticket's project member | `require_ticket_access()` |
| `GET /dashboard/me`             | Yes (any role)| `get_current_user`; assigned/due-soon/overdue tickets and project list are inherently self-scoped (filtered by `assignee_id == caller` and `scoped_projects_query`), no separate membership check needed |
| `GET /dashboard/insights`       | Yes (any role)| `get_current_user`, then scoped in the route body rather than a shared dependency: superadmin gets every project, a global `admin` gets only projects where they hold an admin `ProjectMember` row, a `worker` gets `{"projects": []}` — an empty result, not a 403, matching the spec's "workers get a personal dashboard, not aggregate insights" |
| `GET /projects/{id}/activity`   | Project member| `require_project_member()`; that project's log entries, newest first, capped at 50 |
| `GET /activity`                 | Superadmin    | `require_role(superadmin)`; global feed including system-wide entries (`project_id IS NULL`, e.g. user creation/role changes) that no other role can see |
| `GET /dashboard/activity`       | Yes (any role)| `get_current_user`, scoped like `/dashboard/insights`: superadmin gets the global feed, everyone else gets entries where `project_id` is in their `scoped_projects_query` results — never system-wide entries |
| `GET /notifications`            | Yes (any role)| `get_current_user`; inherently self-scoped — filtered by `user_id == caller`, no project/role check needed |
| `PATCH /notifications/{id}/read`| Yes (any role)| `get_current_user`; 404 (not 403) if the notification doesn't belong to the caller, so notification IDs can't be probed |
| `POST /notifications/mark-all-read` | Yes (any role)| `get_current_user`; only ever touches the caller's own rows |
| `WS /ws/notifications`          | Yes (any role)| Reads the same `access_token` cookie as `get_current_user`, decodes the JWT manually (WebSockets have no `Depends`-based 401, so an invalid/missing token closes the socket with code 4401 instead) |

## Enforcement Notes

- Authorization checks live in FastAPI dependencies (`backend/app/core/deps.py`):
  - `get_current_user` — reads the `access_token` httpOnly cookie, verifies the JWT,
    loads the user.
  - `require_role(*roles)` — dependency factory for globally role-gated routes
    (e.g. superadmin-only user/project creation).
  - `require_project_member(*roles_in_project)` — dependency factory for routes
    with a `{project_id}` path parameter. Superadmins always pass. Otherwise it
    looks up a `ProjectMember` row for `(project_id, current_user)` and, if
    specific roles were passed, checks `role_in_project` is one of them. Returns
    404 (not 403) when the project doesn't exist *or* the user isn't a member —
    this is deliberate: a 403 would confirm the project ID exists to someone who
    isn't supposed to know that.
  - `require_ticket_access(*roles_in_project)` — same shape as
    `require_project_member`, but for routes with a `{ticket_id}` path param
    instead: loads the `Ticket`, resolves its `project_id`, and applies the
    same membership rules (404-not-403 included). Returns a `TicketAccess`
    (the loaded ticket, the current user, and whether they're a project
    admin/superadmin) so route handlers can apply the extra "or owns this
    ticket" rule for worker edits without a second DB query.
- "Own project" means the acting user has a `ProjectMember` row for that project
  (with `role_in_project = admin` for admin-level actions) — implemented as of
  Phase 3.
- A project must always retain at least one admin member; `DELETE
  /projects/{id}/members/{user_id}` rejects removing the last one (400).
- "Every meaningful action logged" is implemented via `log_activity`
  (`backend/app/core/activity.py`) — a small helper called from each mutating
  route right before its existing `db.commit()`, so the log write piggybacks
  on the same transaction rather than risking a partial write. Covers ticket
  create/update/move/delete, comments, project create/update, member
  add/remove, and user create/role-change/activation-change. The
  `description` field is a precomputed human-readable string, not derived at
  read time.
- This table will be expanded with concrete route paths as each phase implements
  the corresponding endpoints.
