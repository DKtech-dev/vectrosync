#!/bin/bash
set -e

echo "=================================================================="
echo " Starting VectroSync Enterprise Industrial Digital Twin           "
echo " Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin "
echo " Operator: Oil India Limited | Model: OIL-BAGHEWALA-EOR-V2       "
echo "=================================================================="

# Launch FastAPI REST API server in background on port 8000
python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 &
FASTAPI_PID=$!

# Launch Streamlit Industrial Console on port 8501
streamlit run app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true &
STREAMLIT_PID=$!

# Forward shutdown signals to child processes
trap "kill -TERM $FASTAPI_PID $STREAMLIT_PID 2>/dev/null || true" SIGTERM SIGINT

# Keep running while any child is active
wait -n
