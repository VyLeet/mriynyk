import os
from pathlib import Path
from typing import Final

from dotenv import load_dotenv


ENV_FILE_PATH: Final[Path] = Path(".env")
API_KEY_ENV_VARS: Final[tuple[str, ...]] = ("LAPATHON_API_KEY", "OPENAI_API_KEY")
DATABASE_URL_ENV_VARS: Final[tuple[str, ...]] = (
    "DATABASE_URL",
    "PG_DSN",
    "POSTGRES_URL",
)
OPENAI_BASE_URL: Final[str] = "http://146.59.127.106:4000"
EMBEDDING_MODEL: Final[str] = "text-embedding-qwen"
DEFAULT_SCHEMA_NAME: Final[str] = "public"
DEFAULT_TABLE_NAME: Final[str] = "pages_for_hackathon"
DEFAULT_VECTOR_COLUMN: Final[str] = "page_text_embedding"
DEFAULT_PAGE_TEXT_COLUMN: Final[str] = "page_text"
DEFAULT_GRADE_COLUMN: Final[str] = "grade"
DEFAULT_DISCIPLINE_COLUMN: Final[str] = "global_discipline_name"


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
