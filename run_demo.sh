#!/usr/bin/env bash
# ==============================================================================
# Launcher: Catenary Enterprise Industrial Twin (OIL-BAGHEWALA-EOR-V2)
# Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
# ==============================================================================

set -e

echo "=============================================================================="
echo "  OIL INDIA LIMITED | Catenary Enterprise Industrial Twin"
echo "  Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited"
echo "  Baghewala Field CSS + SRP Optimization Engine (OIL-BAGHEWALA-EOR-V2)"
echo "=============================================================================="

# 1. Check Python environment
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH."
    exit 1
fi

echo "Verifying dependencies..."
python3 -c "import numpy, scipy, pydantic, streamlit, plotly, pandas, yaml; print('All dependencies verified.')"

# 2. Quick sanity test
echo "Running test sanity check..."
pytest tests/tier1_feature_coverage/ -q --disable-warnings

# 3. Launch Streamlit on localhost:8501
echo "Launching on http://localhost:8501 ..."
streamlit run app.py \
    --server.port 8501 \
    --server.headless true
