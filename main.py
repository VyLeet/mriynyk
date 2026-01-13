from enum import Enum, StrEnum, auto
import os
from pathlib import Path
from typing import Final, Sequence, TypeAlias

from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI
from pydantic import BaseModel
import psycopg
from pgvector import Vector as PgVector
from pgvector.psycopg import register_vector
from psycopg import sql


class Year(Enum):
    eight = 8
    nine = 9

    def __str__(self) -> str:
        return str(self.value)

class Subject(StrEnum):
    ukrainian_language = "Українська мова"
    ukrainian_history = "Історія України"
    algebra = "Алгебра"

class QueryRequest(BaseModel):
    year: Year
    subject: Subject
    query: str

class QueryResponse(BaseModel):
    result: str

Vector: TypeAlias = Sequence[float]
DisciplineName: TypeAlias = str

ENV_FILE_PATH: Final = Path(".env")
API_KEY_ENV_VARS: Final = ("LAPATHON_API_KEY", "OPENAI_API_KEY")
DATABASE_URL_ENV_VARS: Final = ("DATABASE_URL", "PG_DSN", "POSTGRES_URL")
EMBEDDING_MODEL: Final = "text-embedding-qwen"
EMBEDDING_BASE_URL: Final = "http://146.59.127.106:4000"
DEFAULT_SCHEMA_NAME: Final = "public"
DEFAULT_TABLE_NAME: Final = "pages_for_hackathon"
DEFAULT_VECTOR_COLUMN: Final = "page_text_embedding"
DEFAULT_PAGE_TEXT_COLUMN: Final = "page_text"
DEFAULT_GRADE_COLUMN: Final = "grade"
DEFAULT_DISCIPLINE_COLUMN: Final = "global_discipline_name"

def load_environment() -> None:
    load_dotenv(ENV_FILE_PATH)

def resolve_api_key() -> str:
    for env_name in API_KEY_ENV_VARS:
        env_value = os.environ.get(env_name)
        if env_value:
            return env_value
    raise ValueError(
        "API key missing. Set LAPATHON_API_KEY or OPENAI_API_KEY in .env."
    )


def resolve_database_url(database_url: str | None) -> str:
    if database_url:
        return database_url
    for env_name in DATABASE_URL_ENV_VARS:
        env_value = os.environ.get(env_name)
        if env_value:
            return env_value
    raise ValueError(
        "Database URL missing. Set DATABASE_URL/PG_DSN/POSTGRES_URL."
    )


def embed_query(query: str) -> list[float]:
    client = OpenAI(
        api_key=resolve_api_key(),
        base_url=EMBEDDING_BASE_URL,
    )
    response = client.embeddings.create(
        input=query,
        model=EMBEDDING_MODEL,
        encoding_format="float",
    )
    return list(response.data[0].embedding)


def fetch_closest_page_text(
    database_url: str,
    vector: Vector,
    schema_name: str,
    table_name: str,
    vector_column: str,
    page_text_column: str,
    grade_column: str,
    discipline_column: str,
    grade_value: int,
    discipline_name: DisciplineName,
) -> str:
    query_vector = PgVector(vector)
    query_sql = sql.SQL(
        "SELECT {} FROM {}.{} WHERE {} = %s AND {} = %s ORDER BY {} <-> %s LIMIT 1"
    ).format(
        sql.Identifier(page_text_column),
        sql.Identifier(schema_name),
        sql.Identifier(table_name),
        sql.Identifier(grade_column),
        sql.Identifier(discipline_column),
        sql.Identifier(vector_column),
    )
    with psycopg.connect(database_url) as connection:
        register_vector(connection)
        with connection.cursor() as cursor:
            cursor.execute(
                query_sql,
                (grade_value, discipline_name, query_vector),
            )
            row = cursor.fetchone()
    if row is None:
        raise ValueError("No rows found in the database.")
    return str(row[0])


def answer_query(query: str, year: Year, subject: Subject) -> str:
    vector = embed_query(query)
    database_url = resolve_database_url(None)
    discipline_name: DisciplineName = subject.value
    return fetch_closest_page_text(
        database_url=database_url,
        vector=vector,
        schema_name=DEFAULT_SCHEMA_NAME,
        table_name=DEFAULT_TABLE_NAME,
        vector_column=DEFAULT_VECTOR_COLUMN,
        page_text_column=DEFAULT_PAGE_TEXT_COLUMN,
        grade_column=DEFAULT_GRADE_COLUMN,
        discipline_column=DEFAULT_DISCIPLINE_COLUMN,
        grade_value=year.value,
        discipline_name=discipline_name,
    )

def answer_request(request: QueryRequest) -> QueryResponse:
    response_text = answer_query(request.query, request.year, request.subject)
    return QueryResponse(result=response_text)

app = FastAPI()

@app.on_event("startup")
def handle_startup() -> None:
    load_environment()

@app.post("/answer", response_model=QueryResponse)
def answer(request: QueryRequest) -> QueryResponse:
    return answer_request(request)
