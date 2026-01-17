from typing import List, Optional, Sequence, TypeAlias

import psycopg
from psycopg import sql
from openai import OpenAI
from pgvector.psycopg import register_vector
from pgvector import Vector as PgVector
from jinja2 import Environment, FileSystemLoader

from mriynyk.config import (
    DEFAULT_DISCIPLINE_COLUMN,
    DEFAULT_GRADE_COLUMN,
    DEFAULT_PAGE_TEXT_COLUMN,
    DEFAULT_SCHEMA_NAME,
    DEFAULT_TABLE_NAME,
    DEFAULT_VECTOR_COLUMN,
    EMBEDDING_MODEL,
    LAPA_PROVIDER_BASE_URL,
    resolve_api_key,
    resolve_database_url,
)
from mriynyk.models import DisciplineName, Page, Subject, TopicRequest, TopicResponse, Workbook, Year

Vector: TypeAlias = Sequence[float]


def embed_query(query: str) -> list[float]:
    client = OpenAI(
        api_key=resolve_api_key(),
        base_url=LAPA_PROVIDER_BASE_URL,
    )
    response = client.embeddings.create(
        input=query,
        model=EMBEDDING_MODEL,
        encoding_format="float",
    )
    return list(response.data[0].embedding)


def _extract_exercises(page_metadata: object) -> List[str]:
    if not isinstance(page_metadata, dict):
        return []
    exercises = page_metadata.get("exercises")
    if not isinstance(exercises, list):
        return []
    exercise_texts: List[str] = []
    for entry in exercises:
        if isinstance(entry, dict):
            text = entry.get("text")
            if text:
                exercise_texts.append(str(text))
        elif entry:
            exercise_texts.append(str(entry))
    return exercise_texts


def fetch_closest_chapter_pages(
    database_url: str,
    vector: Vector,
    grade_value: int,
    discipline_name: DisciplineName,
) -> List[Page]:
    query_vector = PgVector(vector)
    closest_topic_sql = sql.SQL(
        "SELECT {} FROM {}.{} WHERE {} = %s AND {} = %s ORDER BY {} <-> %s LIMIT 1"
    ).format(
        sql.Identifier("topic_title"),
        sql.Identifier(DEFAULT_SCHEMA_NAME),
        sql.Identifier(DEFAULT_TABLE_NAME),
        sql.Identifier(DEFAULT_GRADE_COLUMN),
        sql.Identifier(DEFAULT_DISCIPLINE_COLUMN),
        sql.Identifier(DEFAULT_VECTOR_COLUMN),
    )
    pages_sql = sql.SQL(
        "SELECT {}, {} FROM {}.{} WHERE {} = %s AND {} = %s AND {} = %s "
        "ORDER BY (substring({}::text from '[\"'']book_page_number[\"'']\\s*:\\s*([0-9]+)'))::int "
        "ASC NULLS LAST"
    ).format(
        sql.Identifier(DEFAULT_PAGE_TEXT_COLUMN),
        sql.Identifier("page_metadata"),
        sql.Identifier(DEFAULT_SCHEMA_NAME),
        sql.Identifier(DEFAULT_TABLE_NAME),
        sql.Identifier(DEFAULT_GRADE_COLUMN),
        sql.Identifier(DEFAULT_DISCIPLINE_COLUMN),
        sql.Identifier("topic_title"),
        sql.Identifier("page_metadata"),
    )
    with psycopg.connect(database_url) as connection:
        register_vector(connection)
        with connection.cursor() as cursor:
            cursor.execute(
                closest_topic_sql,
                (grade_value, discipline_name, query_vector),
            )
            row = cursor.fetchone()
            if row is None:
                raise ValueError("No rows found in the database.")
            topic_title = row[0]
            cursor.execute(
                pages_sql,
                (grade_value, discipline_name, topic_title),
            )
            page_rows = cursor.fetchall()
    if not page_rows:
        raise ValueError("No rows found for the closest topic_title.")
    pages: List[Page] = []
    for page_text, page_metadata in page_rows:
        pages.append(
            Page(
                text=str(page_text),
                exercies=_extract_exercises(page_metadata),
            )
        )
    return pages


def answer_directly(topic: str, year: Year, subject: Subject) -> Optional[str]:
    client = OpenAI(
        api_key=resolve_api_key(),
        base_url=LAPA_PROVIDER_BASE_URL,
    )

    response = client.chat.completions.create(
        model="lapa",
        messages=[
            {
                "role": "user",
                "content": (
                    "Поясни цю тему з предмету "
                    f"{subject.value} учню {year.value}-го класу: {topic}"
                ),
            }
        ],
        temperature=0.7,
        max_tokens=100,
    )
    return response.choices[0].message.content

def generate_workbook_prompt(
    topic: str,
    subject: Subject,
    chapter_text: str,
    student_info: str,
) -> str:
    env = Environment(loader=FileSystemLoader("prompts"))
    template = env.get_template("generate_workbook.j2")
    prompt = template.render(
        {
            "topic": topic,
            "subject": subject.value,
            "chapter_text": chapter_text,
            "student_info": student_info,
        }
    )
    return prompt

# TODO: – Compare quality of higher/lower reasoning efforts
def generate_workbook(
    topic: str,
    subject: Subject,
    closest_chapter_pages: List[Page],
    student_info: str,
) -> Optional[Workbook]:
    client = OpenAI()

    chapter_text = "\n".join([page.text for page in closest_chapter_pages])
    prompt = generate_workbook_prompt(
        topic=topic,
        subject=subject,
        chapter_text=chapter_text,
        student_info=student_info,
    )

    response = client.responses.parse(
        model="gpt-5.2",
        reasoning={"effort": "low"},
        input=prompt,
        text_format=Workbook
    )

    workbook = response.output_parsed
    return workbook

def answer_topic(topic: str, year: Year, subject: Subject, student_info: str) -> Workbook:
    direct_answer = answer_directly(topic=topic, year=year, subject=subject)
    if direct_answer is None:
        raise ValueError("Direct answer missing from the model response.")

    vector = embed_query(direct_answer)
    database_url = resolve_database_url(None)
    discipline_name: DisciplineName = subject.value

    closest_chapter_pages = fetch_closest_chapter_pages(
        database_url=database_url,
        vector=vector,
        grade_value=year.value,
        discipline_name=discipline_name,
    )

    workbook = generate_workbook(
        topic=topic,
        subject=subject,
        closest_chapter_pages=closest_chapter_pages,
        student_info=student_info,
    )

    if workbook is None:
        raise ValueError("Workbook missing from the model response.")

    return workbook


def answer_request(request: TopicRequest) -> TopicResponse:
    workbook = answer_topic(
        request.topic,
        request.year,
        request.subject,
        request.student_info,
    )
    return TopicResponse(result=workbook.markdown_text, quiz_questions=workbook.quiz_questions)
