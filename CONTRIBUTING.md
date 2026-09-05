# Contributing

## Development setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
npm ci --prefix frontend
```

## Required checks

```bash
pytest -q
npm run build --prefix frontend
```

## Engineering rules

- Preserve SI units internally and include units in public field names.
- Add boundary and failure-mode tests for every model change.
- Never label synthetic output as measured or calibrated.
- New control logic must report infeasibility and constraint residuals.
- New model claims require a linked derivation, validity range, data provenance, and held-out validation plan.
- Do not add actuator write paths; this repository is advisory only.
- Keep economic assumptions explicit and scenario-based.
- Update `docs/MODEL_CARD.md` when behavior or limitations change.

## Pull requests

Describe the problem, model/software impact, tests, numerical evidence, backward compatibility, and any changed claim boundary. Avoid generated binary assets unless they are essential and reproducible from source.
