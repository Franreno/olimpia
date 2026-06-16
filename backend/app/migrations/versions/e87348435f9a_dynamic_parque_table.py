"""dynamic parque table

Revision ID: e87348435f9a
Revises: a2094de88a4c
Create Date: 2026-06-16 19:57:37.013316

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e87348435f9a'
down_revision: Union[str, None] = 'a2094de88a4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parque",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("ativo", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("ordem", sa.Integer(), server_default="0", nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    # parks are now dynamic — drop the hard-coded CHECK enum and widen the column
    op.drop_constraint("ck_resposta_demanda_parque", "resposta_demanda", type_="check")
    op.alter_column(
        "resposta_demanda",
        "parque",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "resposta_demanda",
        "parque",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_resposta_demanda_parque",
        "resposta_demanda",
        "parque IN ('thermas', 'rubio', 'hot_beach', 'dolce_dulce')",
    )
    op.drop_table("parque")
