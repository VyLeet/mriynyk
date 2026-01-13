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
make exec ARGS='--year 8 --subject ukrainian_language --query "explain_noun_cases"'
```
