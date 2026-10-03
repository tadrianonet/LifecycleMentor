import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from backend.app.database import deserialize, get_connection, serialize


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


STAGE_DEFINITIONS = [
    {"id": "discovery", "name": "Descoberta do problema", "category": "PDLC"},
    {"id": "research", "name": "Pesquisa e evidências", "category": "PDLC"},
    {"id": "hypothesis", "name": "Hipóteses e validação", "category": "PDLC"},
    {"id": "value", "name": "Proposta de valor", "category": "PDLC"},
    {"id": "mvp", "name": "Definição e priorização do MVP", "category": "PDLC"},
    {"id": "launch", "name": "Lançamento e métricas", "category": "PDLC"},
    {"id": "learning", "name": "Aprendizagem e evolução", "category": "PDLC"},
    {"id": "requirements", "name": "Requisitos", "category": "SDLC"},
    {"id": "design", "name": "Arquitetura e design", "category": "SDLC"},
    {"id": "implementation-plan", "name": "Planejamento da implementação", "category": "SDLC"},
    {"id": "development", "name": "Desenvolvimento", "category": "SDLC"},
    {"id": "testing", "name": "Testes", "category": "SDLC"},
    {"id": "publication", "name": "Publicação", "category": "SDLC"},
    {"id": "operations", "name": "Operação e manutenção", "category": "SDLC"},
]


def build_project_data(project):
    payload = {
        "stage_flow": STAGE_DEFINITIONS,
        "steps": {
            stage["id"]: {
                "status": "pendente",
                "deliverable": None,
                "notes": "",
                "review_criteria": [],
            }
            for stage in STAGE_DEFINITIONS
        },
        "traceability": [
            {
                "from": "Problema",
                "to": "Hipótese",
                "relationship": "evidência",
            },
            {
                "from": "Hipótese",
                "to": "Funcionalidade",
                "relationship": "validação",
            },
            {
                "from": "Funcionalidade",
                "to": "Requisito",
                "relationship": "implementação",
            },
            {
                "from": "Requisito",
                "to": "Teste",
                "relationship": "verificação",
            },
            {
                "from": "Teste",
                "to": "Métrica",
                "relationship": "evolução",
            },
        ],
    }
    return payload


def create_project(payload: dict) -> dict:
    project_id = str(uuid.uuid4())
    now = utc_now()
    project_record = {
        "id": project_id,
        "name": payload["name"],
        "description": payload["description"],
        "audience": payload.get("audience"),
        "problem": payload.get("problem"),
        "constraints": payload.get("constraints"),
        "learning_objective": payload.get("learning_objective"),
        "context_summary": payload.get("description"),
        "project_data": build_project_data(payload),
        "created_at": now,
        "updated_at": now,
    }
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO projects (id, name, description, audience, problem, constraints, learning_objective, context_summary, created_at, updated_at, project_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                project_record["name"],
                project_record["description"],
                project_record["audience"],
                project_record["problem"],
                project_record["constraints"],
                project_record["learning_objective"],
                project_record["context_summary"],
                now,
                now,
                json.dumps(project_record["project_data"], ensure_ascii=False),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return project_record


def get_projects() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) | {"project_data": deserialize(row["project_data"])} for row in rows]


def get_project(project_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    data = dict(row)
    data["project_data"] = deserialize(row["project_data"])
    return data


def upsert_project_context(project_id: str, summary: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE projects SET context_summary = ?, updated_at = ? WHERE id = ?",
            (summary, utc_now(), project_id),
        )
        conn.commit()
    finally:
        conn.close()


def list_messages(project_id: str) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM project_messages WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,),
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


def save_message(project_id: str, role: str, content: str, mode: str) -> dict:
    message_id = str(uuid.uuid4())
    created_at = utc_now()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO project_messages (id, project_id, role, content, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (message_id, project_id, role, content, mode, created_at),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": message_id, "project_id": project_id, "role": role, "content": content, "mode": mode, "created_at": created_at}


def list_artifacts(project_id: str) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM artifacts WHERE project_id = ? ORDER BY updated_at DESC",
            (project_id,),
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) | {"metadata": deserialize(row["metadata"])} for row in rows]


def create_artifact(project_id: str, payload: dict) -> dict:
    artifact_id = str(uuid.uuid4())
    now = utc_now()
    artifact = {
        "id": artifact_id,
        "project_id": project_id,
        "name": payload["name"],
        "kind": payload["kind"],
        "content": payload["content"],
        "metadata": payload.get("metadata", {}),
        "status": "draft",
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO artifacts (id, project_id, name, kind, version, content, metadata, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                artifact_id,
                project_id,
                artifact["name"],
                artifact["kind"],
                artifact["version"],
                artifact["content"],
                serialize(artifact["metadata"]),
                artifact["status"],
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return artifact


def update_artifact(project_id: str, artifact_id: str, payload: dict) -> dict:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM artifacts WHERE id = ? AND project_id = ?", (artifact_id, project_id)).fetchone()
        if row is None:
            raise ValueError("Artefato não encontrado")
        version = int(row["version"]) + 1
        now = utc_now()
        conn.execute(
            "UPDATE artifacts SET name = ?, kind = ?, content = ?, metadata = ?, version = ?, updated_at = ? WHERE id = ?",
            (
                payload["name"],
                payload["kind"],
                payload["content"],
                serialize(payload.get("metadata", {})),
                version,
                now,
                artifact_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": artifact_id,
        "project_id": project_id,
        "name": payload["name"],
        "kind": payload["kind"],
        "content": payload["content"],
        "metadata": payload.get("metadata", {}),
        "version": version,
        "updated_at": now,
    }


def validate_artifact_content(payload: dict) -> tuple[bool, Optional[str]]:
    name = (payload.get("name") or "").strip()
    content = (payload.get("content") or "").strip()
    if not content or len(content) < 10:
        return False, "O conteúdo do artefato deve ter ao menos 10 caracteres."
    if not name or len(name) < 2:
        return False, "O nome do artefato deve ter pelo menos 2 caracteres."
    return True, None


def build_project_context(project_id: str) -> str:
    project = get_project(project_id)
    if not project:
        return "Projeto não encontrado."
    messages = list_messages(project_id)
    artifacts = list_artifacts(project_id)
    relevant = messages[-8:]
    artifact_summary = "; ".join(f"{item['kind']}: {item['name']}" for item in artifacts[:5])
    combined = [
        f"Projeto: {project['name']}",
        f"Descrição: {project['description']}",
        f"Público: {project.get('audience') or 'Não informado'}",
        f"Problema: {project.get('problem') or 'Não informado'}",
        f"Restrições: {project.get('constraints') or 'Não informado'}",
        f"Objetivo de aprendizagem: {project.get('learning_objective') or 'Não informado'}",
        f"Contexto: {project.get('context_summary') or project['description']}",
        f"Artefatos: {artifact_summary or 'Nenhum artefato'}",
        "Histórico recente:",
    ]
    for item in relevant:
        combined.append(f"- {item['role']} ({item['mode']}): {item['content'][:400]}")
    return "\n".join(combined)


def export_project(project_id: str, fmt: str = "markdown") -> str:
    project = get_project(project_id)
    if not project:
        raise ValueError("Projeto não encontrado")
    artifacts = list_artifacts(project_id)
    if fmt == "json":
        payload = {
            "project": project,
            "artifacts": artifacts,
            "traceability": project["project_data"].get("traceability", []),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)
    lines = [
        f"# {project['name']}",
        "",
        f"- Descrição: {project['description']}",
        f"- Público: {project.get('audience') or 'Não informado'}",
        f"- Problema: {project.get('problem') or 'Não informado'}",
        f"- Restrições: {project.get('constraints') or 'Não informado'}",
        f"- Objetivo de aprendizagem: {project.get('learning_objective') or 'Não informado'}",
        "",
        "## Artefatos",
    ]
    for artifact in artifacts:
        lines.append(f"- {artifact['kind']}: {artifact['name']} (versão {artifact['version']})")
    return "\n".join(lines)


def set_demo_seed(project_name: str = "Aplicativo para acompanhar a evolução de atletas de jiu-jítsu") -> dict:
    payload = {
        "name": project_name,
        "description": "Aplicativo para acompanhar a evolução de atletas de jiu-jítsu em treinos, competições e progresso técnico.",
        "audience": "Atletas, professores e preparadores físicos.",
        "problem": "Treinos e maratonas de acompanhamento são registrados em planilhas e comunicação informal, dificultando revisões e evidências de progresso.",
        "constraints": "Dados sensíveis, uso rotativo em celulares, integração com calendário e sem depender de serviços externos em fase inicial.",
        "learning_objective": "Aplicar PDLC e SDLC em um produto realista de acompanhamento esportivo.",
    }
    return create_project(payload)
