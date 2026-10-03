#!/usr/bin/env python3
"""Exportação do adaptador e metadados.

Este script apenas documenta o fluxo e não roda treino/transformação automática.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    print("Fluxo de exportação planejado:")
    print("1. salvar adaptador e metadados")
    print("2. fundir adaptador ao modelo base, quando suportado")
    print("3. converter para GGUF via caminho compatível")
    print("4. quantizar Q4_K_M e validar inferência no Ollama")
    print(f"Diretório de referência: {ROOT / 'training'}")


if __name__ == "__main__":
    main()
