import os
from typing import Optional, Tuple
from pathlib import Path
from argparse import ArgumentParser
import logging
import pandas as pd

from openai import OpenAI
from jinja2 import Environment, FileSystemLoader

from mriynyk.config import (
    DEFAULT_DISCIPLINE_COLUMN,
    DEFAULT_GRADE_COLUMN,
    DEFAULT_PAGE_TEXT_COLUMN,
    DEFAULT_SCHEMA_NAME,
    DEFAULT_TABLE_NAME,
    DEFAULT_VECTOR_COLUMN,
    OPENAI_BASE_URL,
    resolve_api_key,
    resolve_database_url,
)
from mriynyk.models import Subject, Year
from mriynyk.service import embed_query, fetch_closest_page_text
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
DEFAULT_LAPA_MODEL = "lapa"
DEFAULT_OPENAI_MODEL = "gpt-5.2"


def _direct_explain_prompt(question: str) -> str:
    env = Environment(loader=FileSystemLoader("prompts"))
    template = env.get_template("direct_explain.j2")
    prompt = template.render({"question": question})
    return prompt


def _format_choices(choices: Tuple[str, ...]) -> str:
    return "\n".join(f"{index}) {choice}" for index, choice in enumerate(choices))


def _solve_question_prompt(question: str, choices: Tuple[str, ...], relevant_info: str) -> str:
    env = Environment(loader=FileSystemLoader("prompts"))
    template = env.get_template("solve_question.j2")
    prompt = template.render(
        {
            "question": question,
            "choices": _format_choices(choices),
            "relevant_info": relevant_info,
        }
    )
    return prompt


def _request_text(
    *,
    client: OpenAI,
    model_choice: str,
    model_name: str,
    prompt: str,
    max_tokens: int,
) -> Optional[str]:
    if model_choice == "openai":
        response = client.responses.create(
            model=model_name,
            input=prompt,
            temperature=0.7,
            max_output_tokens=max_tokens,
        )
        return response.output_text

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content

def solve(
    question: str,
    choices: Tuple[str],
    year: Year,
    subject: Subject,
    model_choice: str,
) -> Optional[int]:
    logger.info("Solving question for year=%s subject=%s", year, subject)
    if model_choice == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY missing in environment for --model openai.")
        client = OpenAI(api_key=api_key)
        model_name = DEFAULT_OPENAI_MODEL
    else:
        client = OpenAI(
            api_key=resolve_api_key(),
            base_url=OPENAI_BASE_URL,
        )
        model_name = DEFAULT_LAPA_MODEL

    direct_explain_prompt = _direct_explain_prompt(question=question)

    logger.info("Requesting direct explanation")
    direct_explain_text = _request_text(
        client=client,
        model_choice=model_choice,
        model_name=model_name,
        prompt=direct_explain_prompt,
        max_tokens=100,
    )
    if not direct_explain_text:
        logger.warning("Direct explanation response was empty")
        return None

    logger.info("Embedding direct explanation")
    vector = embed_query(direct_explain_text)
    database_url = resolve_database_url(None)
    grade_value = year.value if isinstance(year, Year) else int(year)
    discipline_name = subject.value if isinstance(subject, Subject) else str(subject)
    logger.info("Fetching relevant info from database")
    relevant_info = fetch_closest_page_text(
        database_url=database_url,
        vector=vector,
        schema_name=DEFAULT_SCHEMA_NAME,
        table_name=DEFAULT_TABLE_NAME,
        vector_column=DEFAULT_VECTOR_COLUMN,
        page_text_column=DEFAULT_PAGE_TEXT_COLUMN,
        grade_column=DEFAULT_GRADE_COLUMN,
        discipline_column=DEFAULT_DISCIPLINE_COLUMN,
        grade_value=grade_value,
        discipline_name=discipline_name,
    )

    solve_question_prompt = _solve_question_prompt(question=question, choices=choices, relevant_info=relevant_info)

    logger.info("Requesting final answer")
    solve_question_text = _request_text(
        client=client,
        model_choice=model_choice,
        model_name=model_name,
        prompt=solve_question_prompt,
        max_tokens=100,
    )
    if not solve_question_text:
        logger.warning("Solve question response was empty")
        return None

    predicted_answer_index = int(solve_question_text) # make it safe
    logger.info("Predicted answer index: %s", predicted_answer_index)

    return predicted_answer_index


def solve_benchmark(path: Path, model_choice: str) -> None:
    logger.info("Loading parquet from %s", path)
    df = pd.read_parquet(path).head(5)
    logger.info("Solving %s questions", len(df))
    def _solve_row(row: pd.Series) -> Optional[int]:
        logger.info("Solving row %s", row.name)
        return solve(
            question=row.question_text,
            choices=row.answers,
            year=row.grade,
            subject=row.global_discipline_name,
            model_choice=model_choice,
        )

    df["predicted_answer_index"] = df.apply(_solve_row, axis=1)
    print(df.head)

if __name__ == "__main__":
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parser = ArgumentParser()
    parser.add_argument(
        "--path",
        type=Path,
        required=True,
        help="Path to the parquet file with questions.",
    )
    parser.add_argument(
        "--model",
        choices=("lapa", "openai"),
        required=True,
        help="Model backend to use: lapa or openai.",
    )
    args = parser.parse_args()

    solve_benchmark(path=args.path, model_choice=args.model)
