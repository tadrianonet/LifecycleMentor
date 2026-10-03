#!/usr/bin/env python3
"""Compute MLX-LM test loss for the trained LoRA adapter."""
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "training" / "config.yaml"


def main() -> None:
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    adapter_path = ROOT / config["adapter_path"]
    if not any(adapter_path.glob("*.safetensors")):
        raise SystemExit("Adaptador não encontrado; execute primeiro training/train_lora.py")
    command = [
        sys.executable,
        "-m",
        "mlx_lm",
        "lora",
        "--model",
        config["model"],
        "--adapter-path",
        str(adapter_path),
        "--data",
        str(ROOT / config["data"]),
        "--test",
        "--test-batches",
        "-1",
        "--batch-size",
        "1",
        "--max-seq-length",
        str(config["max_seq_length"]),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    print("Nota: 1 exemplo de teste não é evidência estatística de qualidade geral.")


if __name__ == "__main__":
    main()
