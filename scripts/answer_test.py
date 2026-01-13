import os
import sys
from typing import Optional
from openai import OpenAI

LAPATHON_API_KEY = "sk-J80E861VtloH6TSq4EfQ7w"

def answer_directly(query: str, year=8, subject="Українська мова") -> Optional[str]:
    client = OpenAI(
        api_key=LAPATHON_API_KEY,
        base_url="http://146.59.127.106:4000"
    )

    response = client.chat.completions.create(
        model="lapa",
        messages=[
            {"role": "user", "content": f"Поясни цю тему з предмету {subject} учню {year}-го класу: {query}"}
        ],
        temperature=0.7,
        max_tokens=100
    )
    return response.choices[0].message.content

answer_directly(query=sys.argv[1])
