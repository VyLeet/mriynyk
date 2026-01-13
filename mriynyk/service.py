from typing import Optional, Sequence, TypeAlias

import psycopg
from openai import OpenAI
from pgvector import Vector as PgVector
from pgvector.psycopg import register_vector
from psycopg import sql

from mriynyk.config import (
    DEFAULT_DISCIPLINE_COLUMN,
    DEFAULT_GRADE_COLUMN,
    DEFAULT_PAGE_TEXT_COLUMN,
    DEFAULT_SCHEMA_NAME,
    DEFAULT_TABLE_NAME,
    DEFAULT_VECTOR_COLUMN,
    EMBEDDING_MODEL,
    OPENAI_BASE_URL,
    resolve_api_key,
    resolve_database_url,
)
from mriynyk.models import DisciplineName, QueryRequest, QueryResponse, Subject, Year

Vector: TypeAlias = Sequence[float]


def embed_query(query: str) -> list[float]:
    client = OpenAI(
        api_key=resolve_api_key(),
        base_url=OPENAI_BASE_URL,
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


def answer_directly(query: str, year: Year, subject: Subject) -> Optional[str]:
    client = OpenAI(
        api_key=resolve_api_key(),
        base_url=OPENAI_BASE_URL,
    )

    response = client.chat.completions.create(
        model="lapa",
        messages=[
            {
                "role": "user",
                "content": (
                    "Поясни цю тему з предмету "
                    f"{subject.value} учню {year.value}-го класу: {query}"
                ),
            }
        ],
        temperature=0.7,
        max_tokens=100,
    )
    return response.choices[0].message.content


def answer_query(query: str, year: Year, subject: Subject) -> str:
    direct_answer = answer_directly(query=query, year=year, subject=subject)
    if direct_answer is None:
        raise ValueError("Direct answer missing from the model response.")

    vector = embed_query(direct_answer)
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
