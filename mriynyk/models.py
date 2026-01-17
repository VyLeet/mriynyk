from enum import Enum, StrEnum
from typing import List, TypeAlias
from dataclasses import dataclass

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class Year(Enum):
    eight = 8
    nine = 9

    def __str__(self) -> str:
        return str(self.value)


class Subject(StrEnum):
    ukrainian_language = "Українська мова"
    ukrainian_history = "Історія України"
    algebra = "Алгебра"


@dataclass
class Page:
    text: str
    exercies: List[str]



class TopicRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    year: Year
    subject: Subject
    topic: str = Field(validation_alias=AliasChoices("question", "query"))
    student_info: str = ""


class TopicResponse(BaseModel):
    result: str


DisciplineName: TypeAlias = str


class StudentListItem(BaseModel):
    id: int
    label: str


class AbsenceItem(BaseModel):
    date: str
    subject: str
    reason: str


class ScoreItem(BaseModel):
    date: str
    subject: str
    score: float | None


class StudentDataResponse(BaseModel):
    absences: list[AbsenceItem]
    scores: list[ScoreItem]


class SubjectAverage(BaseModel):
    subject: str
    average: float


class SubjectCount(BaseModel):
    subject: str
    count: int


class StudentAverage(BaseModel):
    student_id: int
    label: str
    average: float


class OverviewResponse(BaseModel):
    average_scores: list[SubjectAverage]
    absences_by_subject: list[SubjectCount]
    top_students: list[StudentAverage]
    bottom_students: list[StudentAverage]
