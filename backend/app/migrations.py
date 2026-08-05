"""
Very small, dependency-free migration helper.

We don't have Alembic set up, and this app is still early-stage, so instead of a
full migration framework this does one safe, idempotent thing: for any table
that already exists in the database, add any columns that exist on the
SQLAlchemy model but not in the real table yet. New columns are always added
as NULLable (regardless of the model's nullable=False) so this can't fail on
existing rows — application code should already tolerate None/NULL for any
newly-added field.

This only runs against Postgres. The SQLite path is local-dev-only and is
always rebuilt fresh, so there's nothing to migrate there.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("hrm.migrations")


def run_lightweight_migrations(engine: Engine, base) -> None:
    if engine.dialect.name != "postgresql":
        return

    inspector = inspect(engine)

    with engine.begin() as conn:
        for table in base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue  # brand new table - create_all() will handle it

            existing_columns = {c["name"] for c in inspector.get_columns(table.name)}

            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = column.type.compile(dialect=conn.dialect)
                ddl = (
                    f'ALTER TABLE "{table.name}" '
                    f'ADD COLUMN IF NOT EXISTS "{column.name}" {col_type}'
                )
                logger.info("Migrating: %s", ddl)
                conn.execute(text(ddl))
