from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "ollama_model" in payload


def test_create_project_and_fetch_it() -> None:
    payload = {
        "name": "Projeto de testes",
        "description": "Projeto usado para validar API e persistência local.",
        "audience": "Estudantes",
        "problem": "Necessidade de validar fluxo de criação",
        "constraints": "Execução local",
        "learning_objective": "Checar criação de projeto e obtenção de dados",
    }

    create_response = client.post("/api/projects", json=payload)
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == payload["name"]
    assert created["description"] == payload["description"]

    project_id = created["id"]
    fetch_response = client.get(f"/api/projects/{project_id}")
    assert fetch_response.status_code == 200
    fetched = fetch_response.json()
    assert fetched["id"] == project_id
    assert fetched["name"] == payload["name"]


def test_artifact_validation_rejects_short_content() -> None:
    payload = {
        "name": "Projeto de testes",
        "description": "Projeto usado para validar API e persistência local.",
        "audience": "Estudantes",
        "problem": "Necessidade de validar fluxo de criação",
        "constraints": "Execução local",
        "learning_objective": "Checar criação de projeto e obtenção de dados",
    }
    project_response = client.post("/api/projects", json=payload)
    project_id = project_response.json()["id"]

    invalid_artifact = {
        "name": "Nome válido",
        "kind": "Definição do problema",
        "content": "curto",
    }

    response = client.post(f"/api/projects/{project_id}/artifacts", json=invalid_artifact)
    assert response.status_code == 400
    assert "ao menos 10 caracteres" in response.json()["detail"]


def test_create_valid_artifact_and_export_project() -> None:
    payload = {
        "name": "Projeto exportável",
        "description": "Projeto usado para validar exportação e artefatos.",
        "audience": "Time de produto",
        "problem": "Precisa validar rastreabilidade",
        "constraints": "Local",
        "learning_objective": "Testar exportação",
    }
    project_response = client.post("/api/projects", json=payload)
    project_id = project_response.json()["id"]

    valid_artifact = {
        "name": "Definição inicial",
        "kind": "Definição do problema",
        "content": "Este artefato descreve a problemática e o contexto do projeto com o suficiente para validar a tentativa inicial.",
    }

    artifact_response = client.post(f"/api/projects/{project_id}/artifacts", json=valid_artifact)
    assert artifact_response.status_code == 200
    artifact = artifact_response.json()
    assert artifact["name"] == valid_artifact["name"]
    assert artifact["version"] == 1

    export_response = client.get(f"/api/projects/{project_id}/export?format=markdown")
    assert export_response.status_code == 200
    exported = export_response.json()
    assert exported["project_id"] == project_id
    assert "# " in exported["content"]


def test_export_unknown_project_returns_not_found() -> None:
    response = client.get("/api/projects/unknown-project/export?format=markdown")

    assert response.status_code == 404
    assert response.json()["detail"] == "Projeto não encontrado."


def test_chat_endpoint_returns_answer_without_crashing() -> None:
    payload = {
        "name": "Projeto de chat",
        "description": "Projeto usado para validar o fluxo de conversação.",
        "audience": "Equipe",
        "problem": "Verificar fallback de chat",
        "constraints": "Sem modelo externo",
        "learning_objective": "Validar resposta do assistente",
    }
    project_response = client.post("/api/projects", json=payload)
    project_id = project_response.json()["id"]

    response = client.post(
        f"/api/projects/{project_id}/chat",
        json={"message": "Explique a hipótese principal do projeto.", "mode": "Aprender"},
    )
    assert response.status_code == 200
    result = response.json()
    assert "answer" in result
    assert len(result["answer"]) > 20
