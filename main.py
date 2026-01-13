from argparse import ArgumentParser, ArgumentTypeError, Namespace
from enum import Enum, StrEnum, auto
from typing import Final, Sequence

import pandas as pd


class Year(Enum):
    eight = 8
    nine = 9

    def __str__(self) -> str:
        return str(self.value)

class Subject(StrEnum):
    ukrainian_language = auto()
    ukrainian_history = auto()
    algebra = auto()

def parse_args() -> Namespace:
    parser = ArgumentParser()
    parser.add_argument(
        "--year",
        required=True,
        type=lambda year: Year(int(year)),
        choices=tuple(Year),
    )
    parser.add_argument(
        "--subject",
        required=True,
        type=Subject,
        choices=tuple(Subject),
    )
    return parser.parse_args()


def main() -> None:
    pass


if __name__ == "__main__":
    args = parse_args()
