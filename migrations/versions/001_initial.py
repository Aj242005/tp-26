import os

from alembic import op

from service.db import Base

revision = "001"
down_revision = None


def upgrade():
    bind = op.get_bind()
    quote = bind.dialect.identifier_preparer.quote
    app_role = quote(os.environ.get("APP_DB_USER", "prooflane_app"))
    worker_role = quote(os.environ.get("WORKER_DB_USER", "prooflane_worker"))
    Base.metadata.create_all(bind)
    for table in ("entities", "jobs", "idempotency", "events"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY tenant_access ON {table} USING "
                   "(tenant_id = current_setting('app.tenant_id', true)) "
                   "WITH CHECK (tenant_id = current_setting('app.tenant_id', true))")
    op.execute(f"CREATE POLICY worker_claim ON jobs TO {worker_role} USING (true) WITH CHECK (true)")
    op.execute(f"GRANT USAGE ON SCHEMA public TO {app_role}, {worker_role}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON entities, jobs, idempotency TO {app_role}, {worker_role}")
    op.execute(f"GRANT SELECT, INSERT ON events TO {app_role}, {worker_role}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON login_states, login_sessions TO {app_role}")


def downgrade():
    raise RuntimeError("Destructive downgrade is intentionally refused; restore a verified backup instead.")
