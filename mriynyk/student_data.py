from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from mriynyk.models import (
    AbsenceItem,
    OverviewResponse,
    ScoreItem,
    StudentAverage,
    StudentDataResponse,
    StudentListItem,
    SubjectAverage,
    SubjectCount,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
ABSENCES_PATH = DATA_DIR / "benchmark_absences.parquet"
SCORES_PATH = DATA_DIR / "benchmark_scores.parquet"

ABSENCE_COLUMNS = (
    "student_id",
    "discipline_name",
    "lesson_date",
    "absence_reason",
    "grade",
)
SCORE_COLUMNS = (
    "student_id",
    "discipline_name",
    "lesson_date",
    "score_numeric",
    "score_text",
    "grade",
)
RECENT_DAYS = 30


@lru_cache(maxsize=1)
def load_absences() -> pd.DataFrame:
    return pd.read_parquet(ABSENCES_PATH, columns=list(ABSENCE_COLUMNS))


@lru_cache(maxsize=1)
def load_scores() -> pd.DataFrame:
    return pd.read_parquet(SCORES_PATH, columns=list(SCORE_COLUMNS))


def format_date(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def parse_score(score_numeric: Any, score_text: Any) -> float | None:
    if score_numeric is not None and not pd.isna(score_numeric):
        return float(score_numeric)
    if isinstance(score_text, str):
        trimmed = score_text.strip().replace(",", ".")
        try:
            return float(trimmed)
        except ValueError:
            return None
    return None


def normalize_reason(value: Any) -> str:
    if value is None or pd.isna(value):
        return "—"
    return str(value)


def apply_filters(
    dataframe: pd.DataFrame,
    student_id: int,
    grade: int | None,
    subject: str | None,
) -> pd.DataFrame:
    mask = dataframe["student_id"] == student_id
    if grade is not None:
        mask &= dataframe["grade"] == grade
    if subject:
        mask &= dataframe["discipline_name"] == subject
    return dataframe.loc[mask]


@lru_cache(maxsize=6)
def list_student_ids(grade: int | None) -> tuple[int, ...]:
    absences = load_absences()
    scores = load_scores()
    if grade is not None:
        absences = absences[absences["grade"] == grade]
        scores = scores[scores["grade"] == grade]
    student_ids = set(absences["student_id"].unique()) | set(scores["student_id"].unique())
    return tuple(sorted(int(value) for value in student_ids))


def list_students(grade: int | None) -> list[StudentListItem]:
    return [
        StudentListItem(id=student_id, label=f"Учень {student_id}")
        for student_id in list_student_ids(grade)
    ]


def build_absence_items(dataframe: pd.DataFrame) -> list[AbsenceItem]:
    items: list[AbsenceItem] = []
    sorted_frame = dataframe.sort_values("lesson_date", ascending=False)
    for row in sorted_frame.itertuples(index=False):
        items.append(
            AbsenceItem(
                date=format_date(row.lesson_date),
                subject=str(row.discipline_name),
                reason=normalize_reason(row.absence_reason),
            )
        )
    return items


def build_score_items(dataframe: pd.DataFrame) -> list[ScoreItem]:
    items: list[ScoreItem] = []
    sorted_frame = dataframe.sort_values("lesson_date", ascending=False)
    for row in sorted_frame.itertuples(index=False):
        score_value = parse_score(row.score_numeric, row.score_text)
        items.append(
            ScoreItem(
                date=format_date(row.lesson_date),
                subject=str(row.discipline_name),
                score=score_value,
            )
        )
    return items


def select_recent_frame(
    dataframe: pd.DataFrame,
    date_column: str,
    grade: int | None,
    days: int = RECENT_DAYS,
) -> pd.DataFrame:
    frame = dataframe
    if grade is not None:
        frame = frame[frame["grade"] == grade]
    if frame.empty:
        return frame.iloc[0:0]
    dates = pd.to_datetime(frame[date_column], errors="coerce")
    max_date = dates.max()
    if pd.isna(max_date):
        return frame.iloc[0:0]
    cutoff = max_date - pd.Timedelta(days=days)
    mask = dates >= cutoff
    return frame.loc[mask].copy()


def add_score_values(dataframe: pd.DataFrame) -> pd.DataFrame:
    if dataframe.empty:
        dataframe = dataframe.copy()
        dataframe["score_value"] = pd.Series(dtype="float64")
        return dataframe
    scores = dataframe.copy()
    scores["score_value"] = [
        parse_score(score_numeric, score_text)
        for score_numeric, score_text in zip(
            scores["score_numeric"], scores["score_text"]
        )
    ]
    return scores[pd.notna(scores["score_value"])]


def build_student_average_items(
    series: pd.Series,
    limit: int,
    ascending: bool,
) -> list[StudentAverage]:
    if series.empty:
        return []
    sorted_series = series.sort_values(ascending=ascending).head(limit)
    items: list[StudentAverage] = []
    for student_id, average_score in sorted_series.items():
        items.append(
            StudentAverage(
                student_id=int(student_id),
                label=f"Учень {int(student_id)}",
                average=round(float(average_score), 1),
            )
        )
    return items


def get_student_data(
    student_id: int,
    grade: int | None = None,
    subject: str | None = None,
) -> StudentDataResponse:
    trimmed_subject = subject.strip() if subject else None
    absences = apply_filters(load_absences(), student_id, grade, trimmed_subject)
    scores = apply_filters(load_scores(), student_id, grade, trimmed_subject)
    return StudentDataResponse(
        absences=build_absence_items(absences),
        scores=build_score_items(scores),
    )


@lru_cache(maxsize=6)
def get_overview(grade: int | None = None) -> OverviewResponse:
    recent_absences = select_recent_frame(load_absences(), "lesson_date", grade)
    recent_scores = select_recent_frame(load_scores(), "lesson_date", grade)
    scores_with_values = add_score_values(recent_scores)

    if scores_with_values.empty:
        average_scores: list[SubjectAverage] = []
        top_students: list[StudentAverage] = []
        bottom_students: list[StudentAverage] = []
    else:
        subject_avg = (
            scores_with_values.groupby("discipline_name")["score_value"]
            .mean()
            .sort_values(ascending=False)
        )
        average_scores = [
            SubjectAverage(subject=str(subject), average=round(float(avg), 1))
            for subject, avg in subject_avg.items()
        ]
        student_avg = scores_with_values.groupby("student_id")["score_value"].mean()
        top_students = build_student_average_items(student_avg, limit=3, ascending=False)
        bottom_students = build_student_average_items(
            student_avg, limit=3, ascending=True
        )

    if recent_absences.empty:
        absences_by_subject: list[SubjectCount] = []
    else:
        absences_counts = (
            recent_absences.groupby("discipline_name")["student_id"]
            .count()
            .sort_values(ascending=False)
        )
        absences_by_subject = [
            SubjectCount(subject=str(subject), count=int(count))
            for subject, count in absences_counts.items()
        ]

    return OverviewResponse(
        average_scores=average_scores,
        absences_by_subject=absences_by_subject,
        top_students=top_students,
        bottom_students=bottom_students,
    )
