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

import enum
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("hrm.migrations")

_NO_DEFAULT = object()


def _scalar_default(column):
    """
    Return the column's Python-side default value if it's a plain scalar
    (e.g. False, 0.0, "General"), or a _NO_DEFAULT sentinel if there isn't
    one we can safely use for backfilling (no default, or a callable like
    dt.date.today).

    Enum members (e.g. Role.EMPLOYEE) are unwrapped to their plain .value —
    pg8000 has no adapter for raw Python Enum objects as bind params and
    raises/crashes the app on startup if handed one directly.
    """
    default = column.default
    if default is None or not getattr(default, "is_scalar", False):
        return _NO_DEFAULT
    value = default.arg
    if isinstance(value, enum.Enum):
        value = value.value
    return value


def _run_isolated(conn, description: str, fn) -> bool:
    """
    Run fn() inside its own SAVEPOINT. If it fails, roll back just that
    savepoint (not the whole outer transaction — Postgres aborts the entire
    transaction after any failed statement, so without this, one bad
    column would poison every statement after it) and log a warning.
    Returns True on success, False on failure.
    """
    try:
        with conn.begin_nested():
            fn()
        return True
    except Exception:
        logger.exception("Migration step failed, skipping: %s", description)
        return False


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
                if column.name not in existing_columns:
                    col_type = column.type.compile(dialect=conn.dialect)
                    ddl = (
                        f'ALTER TABLE "{table.name}" '
                        f'ADD COLUMN IF NOT EXISTS "{column.name}" {col_type}'
                    )
                    logger.info("Migrating: %s", ddl)
                    added = _run_isolated(conn, ddl, lambda ddl=ddl: conn.execute(text(ddl)))
                    if not added:
                        # Couldn't add the column — nothing to backfill either.
                        continue
                    existing_columns.add(column.name)

                # Backfill NULLs for not-nullable columns with a known
                # default. This covers both columns we just added above
                # (added as NULLable regardless of the model, to avoid
                # failing on existing rows) and older columns from a
                # previous version of this migration that never got
                # backfilled — e.g. is_super_admin ended up NULL on rows
                # created before that column existed, which then failed
                # Pydantic validation (expects a real bool) at login time.
                if column.nullable:
                    continue
                default_value = _scalar_default(column)
                if default_value is _NO_DEFAULT:
                    continue

                update_sql = (
                    f'UPDATE "{table.name}" SET "{column.name}" = :val '
                    f'WHERE "{column.name}" IS NULL'
                )
                result_holder = {}

                def _do_update(update_sql=update_sql, default_value=default_value, result_holder=result_holder):
                    result_holder["result"] = conn.execute(text(update_sql), {"val": default_value})

                ok = _run_isolated(
                    conn,
                    f"backfill {table.name}.{column.name} with default {default_value!r}",
                    _do_update,
                )
                if ok and result_holder["result"].rowcount:
                    logger.info(
                        "Backfilled %s NULL row(s) in %s.%s with default %r",
                        result_holder["result"].rowcount,
                        table.name,
                        column.name,
                        default_value,
                    )
