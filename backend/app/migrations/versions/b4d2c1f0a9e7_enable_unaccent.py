"""enable unaccent extension for accent-insensitive search

Revision ID: b4d2c1f0a9e7
Revises: e87348435f9a
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b4d2c1f0a9e7'
down_revision: Union[str, None] = 'e87348435f9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS unaccent")
