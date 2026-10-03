#!/usr/bin/env python3
"""Publish a trained LoRA adapter and model card to Hugging Face Hub."""
import argparse
import os
from pathlib import Path

import yaml
from dotenv import load_dotenv
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "training" / "config.yaml"


def model_card(repo_id: str, base_model: str) -> str:
    return f'''---
license: cc-by-sa-4.0
base_model: {base_model}
library_name: mlx
pipeline_tag: text-generation
tags:
- mlx
- lora
- portuguese
- pdlc
- sdlc
---

# Lifecycle Mentor LoRA pilot

Experimental Portuguese-language LoRA adapter for educational assistance with product development (PDLC) and software development (SDLC).

## Base model and use

This repository contains only the MLX LoRA adapter, not the base model. Load it with `mlx-community/Qwen2.5-7B-Instruct-4bit` and a compatible `mlx-lm` version. The base model is `Qwen/Qwen2.5-7B-Instruct` (Apache-2.0). The adapter uses CC-BY-SA-4.0 to match the license declared for the fictional examples used in this pilot; review the source dataset and base model terms before redistribution or reuse.

## Training data and limitations

The initial pilot was trained on six human-reviewed, fictional demonstration examples from the Lifecycle Mentor repository: four train, one validation, and one test example. This is far too small to support claims of general performance, safety, or factual reliability. The adapter is an engineering experiment and must be evaluated with a larger, independently reviewed dataset before production use.

Pilot run: 20 LoRA iterations; validation loss moved from 4.367 to 4.176. The single held-out example produced test loss 3.890 and perplexity 48.906. These values are included for reproducibility only and are not a meaningful benchmark.

No real student conversations or personal data are included. The examples are marked fictional and CC-BY-SA-4.0 in the source dataset.

## Intended use

Educational prototyping and evaluation of Portuguese PDLC/SDLC guidance. The model is not a source of medical, legal, or other professional advice and must not fabricate user research, metrics, or evidence.

## Reproducibility

- Adapter repository: `{repo_id}`
- Base model: `{base_model}`
- Training framework: MLX-LM LoRA on Apple Silicon
- Configuration: `training/config.yaml` in the source project
- Training examples: 4; validation examples: 1; test examples: 1
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-id", help="Destino Hugging Face username/model")
    parser.add_argument("--confirm-public", action="store_true", help="Confirmar criação/atualização de um repositório público")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env")
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    env_repo_id = os.getenv("HF_MODEL_REPO", "")
    if "seu-usuario" in env_repo_id or "username" in env_repo_id:
        env_repo_id = ""
    repo_id = args.repo_id or env_repo_id or config["hf_model_repo"]
    adapter_path = ROOT / config["adapter_path"]
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
    adapter_weights = list(adapter_path.glob("adapters.safetensors"))
    if not token:
        raise SystemExit("HF_TOKEN não foi encontrado no ambiente nem em .env; nenhum upload foi realizado.")
    if not args.confirm_public:
        raise SystemExit(f"Publicação pública não confirmada. Revise o destino {repo_id} e passe --confirm-public.")
    if not adapter_weights:
        raise SystemExit(f"Nenhum adaptador .safetensors encontrado em {adapter_path}; nenhum upload foi realizado.")
    if not (adapter_path / "adapter_config.json").exists():
        raise SystemExit("adapter_config.json ausente; o adaptador parece incompleto.")

    api = HfApi(token=token)
    identity = api.whoami()
    repo_owner = repo_id.split("/", maxsplit=1)[0]
    if repo_owner != identity.get("name"):
        raise SystemExit("O destino precisa pertencer à conta autenticada; nenhum upload foi realizado.")

    readme_path = adapter_path / "README.md"
    readme_path.write_text(model_card(repo_id, config["base_model_full_precision"]), encoding="utf-8")
    api.create_repo(repo_id=repo_id, repo_type="model", private=False, exist_ok=True)
    api.upload_folder(
        repo_id=repo_id,
        repo_type="model",
        folder_path=str(adapter_path),
        allow_patterns=["adapters.safetensors", "adapter_config.json", "README.md"],
        commit_message="Publish Lifecycle Mentor experimental LoRA adapter",
    )
    print(f"Adaptador publicado publicamente: https://huggingface.co/{repo_id}")


if __name__ == "__main__":
    main()
