## Setup

Prerequisites:
- Docker + Docker Compose
- uv
- API key in `.env` (`LAPATHON_API_KEY` or `OPENAI_API_KEY`)

First-time setup:
```bash
mv {PATH_TO_Lapathon2026 Mriia public files} data
make up
make db
make exec ARGS='--year 8 --subject ukrainian_language --topic "explain_noun_cases"'
```

Benchmark questions:
```bash
make benchmark
make benchmark BENCHMARK_MODEL=openai
make benchmark BENCHMARK_PATH=data/lms_questions_dev.parquet
```

Notes:
- `.env` is loaded into the app container (supports `OPENAI_API_KEY` and `LAPATHON_API_KEY`).
- Rebuild containers after code changes: `make up`.

Project layout:
- `mriynyk/` - FastAPI app and core logic
- `scripts/` - CLI utilities (`call_api.py`, `load_parquet_to_postgres.py`, `answer_test.py`)
