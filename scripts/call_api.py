from __future__ import annotations

from argparse import ArgumentParser
from dataclasses import dataclass
import json
import os
from pathlib import Path
import sys
from typing import Any, Final, TypedDict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from mriynyk.models import Subject, Year


API_URL_ENV_VAR: Final[str] = "API_URL"
DEFAULT_API_URL: Final[str] = "http://localhost:8000/answer"
REQUEST_TIMEOUT_ENV_VAR: Final[str] = "API_TIMEOUT_SECONDS"
DEFAULT_REQUEST_TIMEOUT_SECONDS: Final[float] = 120.0


class AnswerRequest(TypedDict):
    year: int
    subject: str
    topic: str
    student_info: str


class AnswerResponse(TypedDict):
    result: str


@dataclass(frozen=True)
class CommandLineArguments:
    year: Year
    subject: Subject
    topic: str
    student_info: str


def build_parser() -> ArgumentParser:
    parser = ArgumentParser()
    parser.add_argument(
        "--year",
        required=True,
        type=lambda value: Year(int(value)),
        choices=tuple(Year),
        help="Grade year for the student.",
    )
    parser.add_argument(
        "--subject",
        required=True,
        type=Subject,
        choices=tuple(Subject),
        help="Subject to explain.",
    )
    parser.add_argument(
        "--topic",
        required=True,
        type=str,
        help="Topic to generate a response for.",
    )
    parser.add_argument(
        "--student-info",
        required=True,
        type=str,
        help="Student context to personalize the response.",
    )
    return parser


def parse_args() -> CommandLineArguments:
    parser = build_parser()
    parsed_args = parser.parse_args()
    return CommandLineArguments(
        year=parsed_args.year,
        subject=parsed_args.subject,
        topic=parsed_args.topic,
        student_info=parsed_args.student_info,
    )


def build_request_payload(arguments: CommandLineArguments) -> AnswerRequest:
    return {
        "year": arguments.year.value,
        "subject": arguments.subject.value,
        "topic": arguments.topic,
        "student_info": arguments.student_info,
    }


def resolve_request_timeout_seconds() -> float:
    raw_timeout = os.environ.get(REQUEST_TIMEOUT_ENV_VAR)
    if raw_timeout is None:
        return DEFAULT_REQUEST_TIMEOUT_SECONDS
    try:
        timeout = float(raw_timeout)
    except ValueError as exc:
        raise ValueError(
            f"{REQUEST_TIMEOUT_ENV_VAR} must be a positive number."
        ) from exc
    if timeout <= 0:
        raise ValueError(f"{REQUEST_TIMEOUT_ENV_VAR} must be a positive number.")
    return timeout


def load_response_payload(response_body: str) -> AnswerResponse:
    parsed_body: Any = json.loads(response_body)
    if not isinstance(parsed_body, dict):
        raise ValueError("Unexpected response payload.")
    result = parsed_body.get("result")
    if not isinstance(result, str):
        raise ValueError("Missing 'result' in response.")
    return {"result": result}


def post_json(
    api_url: str,
    payload: AnswerRequest,
    timeout_seconds: float,
) -> AnswerResponse:
    request_body = json.dumps(payload).encode("utf-8")
    request = Request(
        api_url,
        data=request_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read().decode("utf-8")
    except TimeoutError as exc:
        raise RuntimeError(
            "API request timed out after "
            f"{timeout_seconds:.0f}s. "
            f"Set {REQUEST_TIMEOUT_ENV_VAR} to a higher value."
        ) from exc
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8")
        raise RuntimeError(
            f"API request failed with status {exc.code}: {error_body}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"API request failed: {exc.reason}") from exc
    return load_response_payload(response_body)


def main() -> int:
    arguments = parse_args()
    api_url = os.environ.get(API_URL_ENV_VAR, DEFAULT_API_URL)
    payload = build_request_payload(arguments)
    timeout_seconds = resolve_request_timeout_seconds()
    response = post_json(api_url, payload, timeout_seconds)
    print(response["result"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
