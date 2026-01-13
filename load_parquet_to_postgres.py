from __future__ import annotations

import os
from argparse import ArgumentParser
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator, Literal, Mapping, Sequence, TypeAlias

import pandas as pd
import psycopg
from pgvector.psycopg import register_vector
from psycopg import sql

VectorValue: TypeAlias = Sequence[float]
RowValues: TypeAlias = tuple[Any, ...]
IndexType: TypeAlias = Literal["hnsw", "ivfflat"]

DATABASE_URL_ENV_VARS: tuple[str, ...] = ("DATABASE_URL", "PG_DSN", "POSTGRES_URL")


@dataclass(frozen=True)
class LoadConfig:
    parquet_path: Path
    database_url: str
    schema_name: str
    table_name: str
    vector_column: str
    index_name: str
    hnsw_m: int
    hnsw_ef_construction: int
    ivfflat_lists: int
    batch_size: int
    truncate_table: bool


def parse_args() -> LoadConfig:
    parser = ArgumentParser(description="Load a parquet file into Postgres with pgvector.")
    parser.add_argument(
        "--parquet-path",
        default="data/text-embedding-qwen/pages_for_hackathon.parquet",
        type=Path,
    )
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--schema-name", default="public")
    parser.add_argument("--table-name", default="pages_for_hackathon")
    parser.add_argument("--vector-column", default="page_text_embedding")
    parser.add_argument("--index-name", default="pages_for_hackathon_embedding_idx")
    parser.add_argument("--hnsw-m", default=16, type=int)
    parser.add_argument("--hnsw-ef-construction", default=64, type=int)
    parser.add_argument("--ivfflat-lists", default=100, type=int)
    parser.add_argument("--batch-size", default=1000, type=int)
    parser.add_argument("--truncate-table", action="store_true")
    args = parser.parse_args()

    database_url = resolve_database_url(args.database_url)

    return LoadConfig(
        parquet_path=args.parquet_path,
        database_url=database_url,
        schema_name=args.schema_name,
        table_name=args.table_name,
        vector_column=args.vector_column,
        index_name=args.index_name,
        hnsw_m=args.hnsw_m,
        hnsw_ef_construction=args.hnsw_ef_construction,
        ivfflat_lists=args.ivfflat_lists,
        batch_size=args.batch_size,
        truncate_table=args.truncate_table,
    )


def resolve_database_url(database_url: str | None) -> str:
    if database_url:
        return database_url
    for env_name in DATABASE_URL_ENV_VARS:
        env_value = os.environ.get(env_name)
        if env_value:
            return env_value
    raise ValueError(
        "Database URL missing. Provide --database-url or set DATABASE_URL/PG_DSN/POSTGRES_URL."
    )


def load_dataframe(parquet_path: Path) -> pd.DataFrame:
    if not parquet_path.exists():
        raise FileNotFoundError(f"Missing parquet file: {parquet_path}")
    return pd.read_parquet(parquet_path)


def is_missing_value(value: Any) -> bool:
    if value is None:
        return True
    try:
        missing = pd.isna(value)
    except Exception:
        return False
    if isinstance(missing, bool):
        return missing
    return False


def vector_dimension(values: Iterable[Any], vector_column: str) -> int:
    for value in values:
        if is_missing_value(value):
            continue
        if isinstance(value, (list, tuple)):
            return len(value)
        if hasattr(value, "shape"):
            shape = getattr(value, "shape")
            if shape:
                return int(shape[0])
        raise ValueError(
            f"Unsupported vector value in column '{vector_column}': {type(value)!r}"
        )
    raise ValueError(f"No non-null values found in column '{vector_column}'.")


def infer_column_types(
    dataframe: pd.DataFrame, vector_column: str, vector_dim: int
) -> dict[str, str]:
    column_types: dict[str, str] = {}
    for column_name in dataframe.columns:
        if column_name == vector_column:
            column_types[column_name] = f"vector({vector_dim})"
            continue
        series = dataframe[column_name]
        if pd.api.types.is_integer_dtype(series):
            column_types[column_name] = "bigint"
        elif pd.api.types.is_float_dtype(series):
            column_types[column_name] = "double precision"
        elif pd.api.types.is_bool_dtype(series):
            column_types[column_name] = "boolean"
        elif pd.api.types.is_datetime64_any_dtype(series):
            column_types[column_name] = "timestamptz"
        else:
            column_types[column_name] = "text"
    return column_types


def build_create_table_sql(
    schema_name: str, table_name: str, column_types: Mapping[str, str]
) -> sql.SQL:
    columns_sql = sql.SQL(", ").join(
        sql.SQL("{} {}").format(sql.Identifier(column), sql.SQL(column_type))
        for column, column_type in column_types.items()
    )
    return sql.SQL("CREATE TABLE IF NOT EXISTS {}.{} ({})").format(
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
        columns_sql,
    )


def build_insert_sql(
    schema_name: str, table_name: str, columns: Sequence[str]
) -> sql.SQL:
    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)
    column_sql = sql.SQL(", ").join(sql.Identifier(column) for column in columns)
    return sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
        column_sql,
        placeholders,
    )


def build_truncate_sql(schema_name: str, table_name: str) -> sql.SQL:
    return sql.SQL("TRUNCATE TABLE {}.{}").format(
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
    )


def build_analyze_sql(schema_name: str, table_name: str) -> sql.SQL:
    return sql.SQL("ANALYZE {}.{}").format(
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
    )


def build_index_sql(
    schema_name: str,
    table_name: str,
    index_name: str,
    vector_column: str,
    index_type: IndexType,
    hnsw_m: int,
    hnsw_ef_construction: int,
    ivfflat_lists: int,
) -> sql.SQL:
    if index_type == "hnsw":
        return sql.SQL(
            "CREATE INDEX IF NOT EXISTS {} ON {}.{} USING hnsw ({} vector_cosine_ops) "
            "WITH (m = {}, ef_construction = {})"
        ).format(
            sql.Identifier(index_name),
            sql.Identifier(schema_name),
            sql.Identifier(table_name),
            sql.Identifier(vector_column),
            sql.Literal(hnsw_m),
            sql.Literal(hnsw_ef_construction),
        )
    return sql.SQL(
        "CREATE INDEX IF NOT EXISTS {} ON {}.{} USING ivfflat ({} vector_cosine_ops) "
        "WITH (lists = {})"
    ).format(
        sql.Identifier(index_name),
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
        sql.Identifier(vector_column),
        sql.Literal(ivfflat_lists),
    )


def normalize_vector_value(value: Any) -> VectorValue | None:
    if is_missing_value(value):
        return None
    if isinstance(value, (list, tuple)):
        return [float(item) for item in value]
    if hasattr(value, "tolist"):
        return [float(item) for item in value.tolist()]
    return value


def normalize_cell_value(column_name: str, value: Any, vector_column: str) -> Any:
    if is_missing_value(value):
        return None
    if column_name == vector_column:
        return normalize_vector_value(value)
    if isinstance(value, (dict, list, tuple)):
        return str(value)
    return value


def iter_rows(
    dataframe: pd.DataFrame, vector_column: str, columns: Sequence[str]
) -> Iterator[RowValues]:
    for row in dataframe.itertuples(index=False, name=None):
        yield tuple(
            normalize_cell_value(column, value, vector_column)
            for column, value in zip(columns, row, strict=True)
        )


def batch_rows(rows: Iterable[RowValues], batch_size: int) -> Iterator[list[RowValues]]:
    batch: list[RowValues] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def load_to_postgres(config: LoadConfig) -> None:
    dataframe = load_dataframe(config.parquet_path)
    if config.vector_column not in dataframe.columns:
        raise ValueError(
            f"Vector column '{config.vector_column}' not found in parquet file."
        )

    vector_dim = vector_dimension(
        dataframe[config.vector_column].tolist(), config.vector_column
    )
    column_types = infer_column_types(
        dataframe, config.vector_column, vector_dim
    )
    columns = list(column_types.keys())

    create_table_sql = build_create_table_sql(
        config.schema_name, config.table_name, column_types
    )
    insert_sql = build_insert_sql(config.schema_name, config.table_name, columns)
    analyze_sql = build_analyze_sql(config.schema_name, config.table_name)
    index_sql: sql.SQL | None
    if vector_dim > 2000:
        index_sql = None
    else:
        index_type: IndexType = "hnsw"
        index_sql = build_index_sql(
            config.schema_name,
            config.table_name,
            config.index_name,
            config.vector_column,
            index_type,
            config.hnsw_m,
            config.hnsw_ef_construction,
            config.ivfflat_lists,
        )

    with psycopg.connect(config.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
            register_vector(connection)
            cursor.execute(create_table_sql)
            if config.truncate_table:
                cursor.execute(build_truncate_sql(config.schema_name, config.table_name))

            rows = iter_rows(dataframe, config.vector_column, columns)
            for batch in batch_rows(rows, config.batch_size):
                cursor.executemany(insert_sql, batch)
                connection.commit()

            cursor.execute(analyze_sql)
            if index_sql is not None:
                cursor.execute(index_sql)


if __name__ == "__main__":
    load_to_postgres(parse_args())
