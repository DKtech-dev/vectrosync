# Repository Guide

## Clone and verify

```bash
git clone https://github.com/DKtech-dev/vectrosync.git
cd vectrosync
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
npm ci --prefix frontend
pytest -q
npm run build --prefix frontend
```

## Actual layout

```text
backend/server.py         FastAPI application
frontend/                 React/Vite console
src/thermal.py            thermal model
src/rheology.py           viscosity and drag assumptions
src/rod_conservative.py   reduced-order card estimator and mesh utilities
src/controller.py         constraint-aware advisory governor
src/failsafe.py           supervisory software logic
src/adapter.py            telemetry normalization and safety gate
src/audit.py              in-memory hash chain
src/economics.py          commercial sensitivity
src/state_estimator.py    experimental estimator
tests/                    271-test suite
docs/                     model card, assurance case, commercial plan
configs/                  synthetic assumptions
```

## Run locally

```bash
npm run build --prefix frontend
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
streamlit run app.py --server.address 127.0.0.1 --server.port 8501
```

## Containers

```bash
docker compose up --build
```

Ports bind to localhost by default. See `SECURITY.md` before changing exposure.

## Reading order

1. `README.md`
2. `docs/MODEL_CARD.md`
3. `docs/ASSURANCE_CASE.md`
4. `docs/COMMERCIAL_CASE.md`
5. `SECURITY.md`
6. `submission/00_READ_ME_FIRST.md`

## License

No open-source grant is included. See `LICENSE-NOTICE.md` and do not imply operator affiliation.
