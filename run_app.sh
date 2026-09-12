#!/usr/bin/env bash
# ==============================================================================
# Master Launcher: Catenary Enterprise Industrial Twin Web Application
# Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
# Model: OIL-BAGHEWALA-EOR-V2
# ==============================================================================

set -e

echo "=============================================================================="
echo "  OIL INDIA LIMITED | Catenary Enterprise Industrial Twin Application"
echo "  Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited"
echo "  Baghewala Field CSS + SRP Optimization Engine (OIL-BAGHEWALA-EOR-V2)"
echo "=============================================================================="

# 1. Check Python and Node environment
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "Error: node is not installed or not in PATH."
    exit 1
fi

echo "1. Checking Python and Node dependencies..."
python3 -c "import numpy, scipy, pydantic, fastapi, uvicorn, pandas, yaml; print('  ✓ Python backend dependencies verified.')"

# 2. Build Frontend (if dist doesn't exist or on clean run)
if [ ! -d "frontend/dist" ]; then
    echo "2. Building modern React frontend..."
    cd frontend && npm install && npm run build && cd ..
else
    echo "2. Production frontend bundle detected (frontend/dist)."
fi

# 3. Quick sanity test
echo "3. Running test sanity check..."
pytest tests/test_api_endpoints.py -q --disable-warnings

# 4. Launch FastAPI Modern Industrial App on Localhost:8000
echo ""
echo "=============================================================================="
echo "  🚀 Launching Modern Digital Twin Application on http://localhost:8000"
echo "=============================================================================="
echo ""

uvicorn backend.server:app --host 0.0.0.0 --port 8000
