from fastapi import FastAPI

from mriynyk.config import load_environment
from mriynyk.models import QueryRequest, QueryResponse
from mriynyk.service import answer_request

app = FastAPI()


@app.on_event("startup")
def handle_startup() -> None:
    load_environment()


@app.post("/answer", response_model=QueryResponse)
def answer(request: QueryRequest) -> QueryResponse:
    return answer_request(request)
