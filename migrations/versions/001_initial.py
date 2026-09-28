from alembic import op

from service.db import Base

revision = "001"
down_revision = None


def upgrade():
    bind = op.get_bind()
    Base.metadata.create_all(bind)
    for table in ("entities", "jobs", "idempotency", "events"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY tenant_access ON {table} USING "
                   "(tenant_id = current_setting('app.tenant_id', true)) "
                   "WITH CHECK (tenant_id = current_setting('app.tenant_id', true))")
    op.execute("CREATE POLICY worker_claim ON jobs TO sih_worker USING (true) WITH CHECK (true)")
    op.execute("GRANT USAGE ON SCHEMA public TO sih_app, sih_worker")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON entities, jobs, idempotency TO sih_app, sih_worker")
    op.execute("GRANT SELECT, INSERT ON events TO sih_app, sih_worker")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON login_states, login_sessions TO sih_app")


def downgrade():
    raise RuntimeError("Destructive downgrade is intentionally refused; restore a verified backup instead.")
