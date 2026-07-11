"""session_based_sharing

Revision ID: 7e13a3c56a9c
Revises: 0002
Create Date: 2026-07-11 11:33:53.908454

"""
from alembic import op
import sqlalchemy as sa


revision = '7e13a3c56a9c'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add session_id column as nullable
    op.add_column("shared_links", sa.Column("session_id", sa.Integer(), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=True))

    # 2. Populate session_id using the most recent session for that note
    op.execute("""
        UPDATE shared_links
        SET session_id = (
            SELECT id FROM chat_sessions
            WHERE chat_sessions.note_id = shared_links.note_id
            ORDER BY created_at DESC
            LIMIT 1
        )
    """)

    # 3. Delete any shared links that couldn't be migrated (no sessions existed for the note)
    op.execute("DELETE FROM shared_links WHERE session_id IS NULL")

    # 4. Make session_id nullable=False now that it's populated
    op.alter_column("shared_links", "session_id", nullable=False)

    # 5. Create index on session_id
    op.create_index("ix_shared_links_session_id", "shared_links", ["session_id"])

    # 6. Drop old index and column for note_id
    op.drop_index("ix_shared_links_note_id", table_name="shared_links")
    op.drop_column("shared_links", "note_id")


def downgrade() -> None:
    # 1. Add note_id column as nullable
    op.add_column("shared_links", sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=True))

    # 2. Populate note_id using the session's note_id
    op.execute("""
        UPDATE shared_links
        SET note_id = (
            SELECT note_id FROM chat_sessions
            WHERE chat_sessions.id = shared_links.session_id
        )
    """)

    # 3. Make note_id nullable=False
    op.alter_column("shared_links", "note_id", nullable=False)

    # 4. Create index on note_id
    op.create_index("ix_shared_links_note_id", "shared_links", ["note_id"])

    # 5. Drop index and column for session_id
    op.drop_index("ix_shared_links_session_id", table_name="shared_links")
    op.drop_column("shared_links", "session_id")
