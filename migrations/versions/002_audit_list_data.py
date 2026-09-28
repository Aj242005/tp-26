"""Keep metadata reads independent of configuration size."""
from alembic import op

revision = "002"
down_revision = "001"


def upgrade():
    # Initial local databases may already include current Base metadata from revision 001.
    op.execute("ALTER TABLE entities ADD COLUMN IF NOT EXISTS list_data json")
    op.execute("""UPDATE entities SET list_data =
        ((data::jsonb - ARRAY['findings','normalization','mapping_snapshot','agent_checkpoint',
                            'investigation','clarification_answers']) #- '{policy,rules}')::json
        WHERE kind = 'audit' AND list_data IS NULL""")


def downgrade():
    op.execute("ALTER TABLE entities DROP COLUMN list_data")
