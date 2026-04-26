-- Enforce append-only on ledger_entries
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Updates and Deletions are not allowed on this table';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER make_ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- Enforce append-only on audit_log
CREATE TRIGGER make_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- Enabling Row-level security on tables
-- To use RLS with a custom connection pool (like Prisma), you typically pass the user ID as a session variable.
-- For example, `SET current_setting('app.current_user_id') TO '...';` before queries.
-- We will enable RLS on buyers as an example of buyer isolation

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can view their own profile"
ON buyers
FOR SELECT
USING (user_id::text = current_setting('app.current_user_id', true));

-- Project Admin isolation
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view their assigned projects"
ON projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM project_admin_assignments
    WHERE project_admin_assignments.project_id = projects.id
    AND project_admin_assignments.user_id::text = current_setting('app.current_user_id', true)
  )
);
