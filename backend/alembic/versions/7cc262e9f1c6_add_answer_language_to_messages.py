"""add_answer_language_to_messages

Revision ID: 7cc262e9f1c6
Revises: 7e13a3c56a9c
Create Date: 2026-07-11 11:49:03.054924

"""
from alembic import op
import sqlalchemy as sa


revision = '7cc262e9f1c6'
down_revision = '7e13a3c56a9c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("answer_language", sa.String(10), nullable=True, server_default="en"))


def downgrade() -> None:
    op.drop_column("messages", "answer_language")
