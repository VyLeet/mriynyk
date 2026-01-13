from enum import Enum, StrEnum
from typing import TypeAlias

from pydantic import BaseModel


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


DisciplineName: TypeAlias = str
