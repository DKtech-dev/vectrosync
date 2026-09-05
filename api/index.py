import os
import sys

# Ensure root workspace is on Python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.server import app

# Vercel Serverless Function entrypoint
