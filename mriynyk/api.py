from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles

from mriynyk.config import load_environment
from mriynyk.models import (
    OverviewResponse,
    QueryRequest,
    QueryResponse,
    StudentDataResponse,
    StudentListItem,
)
from mriynyk.service import answer_request
from mriynyk.student_data import get_overview, get_student_data, list_students

app = FastAPI()
FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"


@app.on_event("startup")
def handle_startup() -> None:
    load_environment()


@app.post("/answer", response_model=QueryResponse)
def answer(request: QueryRequest) -> QueryResponse:
    return answer_request(request)


@app.get("/students", response_model=list[StudentListItem])
def students(grade: int | None = Query(default=None, ge=1, le=12)) -> list[StudentListItem]:
    return list_students(grade)


@app.get("/students/{student_id}", response_model=StudentDataResponse)
def student_data(
    student_id: int,
    grade: int | None = Query(default=None, ge=1, le=12),
    subject: str | None = None,
) -> StudentDataResponse:
    return get_student_data(student_id=student_id, grade=grade, subject=subject)


@app.get("/overview", response_model=OverviewResponse)
def overview(grade: int | None = Query(default=None, ge=1, le=12)) -> OverviewResponse:
    return get_overview(grade)


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
