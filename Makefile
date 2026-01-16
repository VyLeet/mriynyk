IMAGE_NAME := mriynyk
ARGS ?=
DATABASE_URL ?= postgresql://mriynyk:mriynyk@localhost:5433/mriynyk
PARQUET_PATH ?= data/text-embedding-qwen/pages_for_hackathon.parquet
BENCHMARK_PATH ?= data/lms_questions_dev.parquet
BENCHMARK_MODEL ?= lapa

build:
	docker compose build &

up:
	docker compose up --build -d

db:
	DATABASE_URL=$(DATABASE_URL) uv run python scripts/load_parquet_to_postgres.py --parquet-path $(PARQUET_PATH) &

exec:
	@if [ -z "$(ARGS)" ]; then echo "ARGS is required for make exec"; exit 1; fi
	docker compose exec app uv run python scripts/call_api.py $(ARGS)

benchmark:
	docker compose exec app \
		uv run solve_questions.py --path $(BENCHMARK_PATH) --model $(BENCHMARK_MODEL)
