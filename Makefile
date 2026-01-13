IMAGE_NAME := mriynyk
ARGS ?=
DATABASE_URL ?= postgresql://mriynyk:mriynyk@localhost:5433/mriynyk
PARQUET_PATH ?= data/text-embedding-qwen/pages_for_hackathon.parquet

build:
	docker compose build &

up:
	docker compose up --build -d

db:
	DATABASE_URL=$(DATABASE_URL) uv run python load_parquet_to_postgres.py --parquet-path $(PARQUET_PATH) &

exec:
	@if [ -z "$(ARGS)" ]; then echo "ARGS is required for make exec"; exit 1; fi
	docker compose exec app uv run python call_api.py $(ARGS)
