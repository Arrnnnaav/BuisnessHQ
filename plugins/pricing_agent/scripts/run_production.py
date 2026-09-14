"""Run the vendored agent with BusinessOS's non-interactive approval queue."""

import os
import subprocess
import sys
from pathlib import Path


if not os.environ.get("GEMINI_API_KEY"):
    raise SystemExit("GEMINI_API_KEY is required. Store it in the BusinessOS vault/deployment secret manager, then supply it only to this process.")

root = Path(__file__).resolve().parents[1] / "vendor"
environment = {**os.environ, "BUSINESSOS_APPROVAL_MODE": "queue"}
result = subprocess.run([sys.executable, "main.py"], cwd=root, env=environment)
raise SystemExit(result.returncode)
