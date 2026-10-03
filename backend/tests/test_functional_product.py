from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_complete_product_flow() -> None:
    project_payload = {
        "name": "Produto funcional - fluxo completo",
        "description": "Valida a criação, artefatos, exportação e interação do assistente em um ciclo de produto realista.",
        "audience": "Equipes de produto",
        "problem": "Demonstrar que o sistema consegue guiar a criação de um projeto completo e rastreável.",
        "constraints": "Execução local sem serviços externos",
        "learning_objective": "Validar MVP end-to-end",
    }

    create_response = client.post("/api/projects", json=project_payload)
    assert create_response.status_code == 200, create_response.text
    project = create_response.json()
    project_id = project["id"]

    list_response = client.get("/api/projects")
    assert list_response.status_code == 200, list_response.text
    project_names = [item["name"] for item in list_response.json()]
    assert project_payload["name"] in project_names

    details_response = client.get(f"/api/projects/{project_id}")
    assert details_response.status_code == 200, details_response.text
    details = details_response.json()
    assert details["id"] == project_id
    assert details["name"] == project_payload["name"]

    artifact_payload = {
        "name": "Hipótese inicial",
        "kind": "Registro de hipóteses",
        "content": "A hipótese principal é que a proposta de valor melhora a compreensão da jornada do usuário e reduz a fricção operacional em comparação com o modelo atual de anotações e planilhas manuais.",
    }
    artifact_response = client.post(f"/api/projects/{project_id}/artifacts", json=artifact_payload)
    assert artifact_response.status_code == 200, artifact_response.text
    artifact = artifact_response.json()
    assert artifact["name"] == artifact_payload["name"]
    assert artifact["version"] == 1

    export_response = client.get(f"/api/projects/{project_id}/export?format=markdown")
    assert export_response.status_code == 200, export_response.text
    export_body = export_response.json()
    assert export_body["project_id"] == project_id
    assert "# " in export_body["content"]

    chat_response = client.post(
        f"/api/projects/{project_id}/chat",
        json={"message": "Explique a hipótese principal do produto e como ela se conecta ao problema do usuário.", "mode": "Aprender"},
    )
    assert chat_response.status_code == 200, chat_response.text
    chat_body = chat_response.json()
    assert "answer" in chat_body
    assert len(chat_body["answer"]) > 30


def test_invalid_product_inputs_are_rejected() -> None:
    invalid_project = {
        "name": "A",
        "description": "Curto",
    }

    response = client.post("/api/projects", json=invalid_project)
    assert response.status_code == 422

    valid_project = {
        "name": "Projeto inválido",
        "description": "Projeto de validação para testar falhas de regra de negócio em artefatos.",
        "audience": "Alunos",
        "problem": "Problema de validação",
        "constraints": "Local",
        "learning_objective": "Verificar rejeição de artefato inválido",
    }
    project_response = client.post("/api/projects", json=valid_project)
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    invalid_artifact = {
        "name": "Nome válido",
        "kind": "Definição do problema",
        "content": "curto",
    }
    artifact_response = client.post(f"/api/projects/{project_id}/artifacts", json=invalid_artifact)
    assert artifact_response.status_code == 400
    assert "ao menos 10 caracteres" in artifact_response.json()["detail"]


def test_product_can_answer_in_all_modes() -> None:
    project_payload = {
        "name": "Produto multi-modo",
        "description": "Valida que o assistente responde a todos os modos pedagógicos.",
        "audience": "Time de engenharia",
        "problem": "Garantir que o assistente tem respostas consistentes para cada modo.",
        "constraints": "Sem IA externa",
        "learning_objective": "Confirmar fluxo pedagógico",
    }
    project_response = client.post("/api/projects", json=project_payload)
    project_id = project_response.json()["id"]

    for mode in ["Aprender", "Construir", "Revisar"]:
        response = client.post(
            f"/api/projects/{project_id}/chat",
            json={"message": "Qual é o próximo passo mais importante para este projeto?", "mode": mode},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert "answer" in body
        assert len(body["answer"]) > 20
