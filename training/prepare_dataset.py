#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "datasets" / "demo.jsonl"


def validate_example(example: dict) -> tuple[bool, str | None]:
    required = {"id", "scenario", "project", "instruction", "response", "metadata"}
    missing = sorted(required - set(example))
    if missing:
        return False, f"Campos ausentes: {missing}"
    metadata = example["metadata"]
    if not isinstance(metadata, dict):
        return False, "metadata deve ser objeto JSON"
    if metadata.get("reviewed_by_human") is not True:
        return False, "Exemplo precisa ter revisão humana marcada."
    return True, None


def split_examples(rows):
    if len(rows) < 3:
        raise ValueError("São necessários pelo menos 3 exemplos para separar treino, validação e teste.")
    train = rows[:4]
    validation = rows[4:5]
    test = rows[5:]
    return train, validation, test


def to_chat_example(example: dict) -> dict:
    project = example["project"]
    user_content = (
        f"Projeto: {project}\n"
        f"Etapa: {example['metadata'].get('stage', 'não informada')}\n"
        f"Cenário: {example['scenario']}\n\n"
        f"{example['instruction']}"
    )
    return {
        "messages": [
            {
                "role": "system",
                "content": (
                    "Você é um mentor educacional de PDLC e SDLC. Responda em português, "
                    "distinga fatos de hipóteses e não invente evidências."
                ),
            },
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": example["response"]},
        ]
    }


def main() -> None:
    examples = []
    for line in DATASET_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        example = json.loads(line)
        ok, message = validate_example(example)
        if not ok:
            raise ValueError(f"Exemplo inválido: {message}")
        examples.append(example)

    train, validation, test = split_examples(examples)
    splits = {
        "train": train,
        "valid": validation,
        "test": test,
    }
    for name, payload in splits.items():
        target = ROOT / "datasets" / f"{name}.jsonl"
        with target.open("w", encoding="utf-8") as handle:
            for item in payload:
                handle.write(json.dumps(to_chat_example(item), ensure_ascii=False) + "\n")
    print(
        f"Dataset validado: {len(examples)} exemplos fictícios revisados. "
        f"Treino={len(train)}, validação={len(validation)}, teste={len(test)}."
    )
    print("Aviso: este conjunto serve apenas para um piloto técnico, não para alegar qualidade geral do modelo.")


if __name__ == "__main__":
    main()
