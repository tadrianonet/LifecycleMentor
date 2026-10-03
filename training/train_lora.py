#!/usr/bin/env python3
"""Execute um piloto LoRA local com MLX-LM em Apple Silicon."""

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "training" / "config.yaml"
DATASET_DIR = ROOT / "datasets"


def build_command(config: dict, iterations: int | None = None) -> list[str]:
    command = [sys.executable, "-m", "mlx_lm", "lora", "--config", str(CONFIG_PATH)]
    if iterations is not None:
        command.extend(["--iters", str(iterations)])
    return command


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iters", type=int, help="Sobrescreve o número pequeno de passos do piloto.")
    args = parser.parse_args()
    if not all((DATASET_DIR / name).is_file() for name in ("train.jsonl", "valid.jsonl", "test.jsonl")):
        raise SystemExit("Execute primeiro: python training/prepare_dataset.py")
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    command = build_command(config, args.iters)
    print(f"Modelo quantizado: {config['model']}", flush=True)
    print(f"Dataset local: {DATASET_DIR}", flush=True)
    print(f"Adaptador de saída: {ROOT / config['adapter_path']}", flush=True)
    print(f"Passos: {args.iters or config['iters']}; dataset demonstrativo com 6 exemplos.", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
