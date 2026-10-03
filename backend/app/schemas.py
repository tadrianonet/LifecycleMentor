from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str = Field(..., min_length=10)
    audience: Optional[str] = None
    problem: Optional[str] = None
    constraints: Optional[str] = None
    learning_objective: Optional[str] = None


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    audience: Optional[str] = None
    problem: Optional[str] = None
    constraints: Optional[str] = None
    learning_objective: Optional[str] = None
    context_summary: Optional[str] = None
    project_data: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    mode: Literal["Aprender", "Construir", "Revisar"] = "Aprender"
    project_id: Optional[str] = None


class ArtifactCreate(BaseModel):
    name: str = Field(..., min_length=2)
    kind: str = Field(..., min_length=2)
    content: str = Field(..., min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ArtifactRecord(BaseModel):
    id: str
    project_id: str
    name: str
    kind: str
    content: str
    version: int
    status: str
    metadata: dict[str, Any]
    created_at: str
    updated_at: str


class DocumentUpload(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = None
    doc_type: str = "didatico"
    source_path: Optional[str] = None


class OllamaStatus(BaseModel):
    available: bool
    model: str
    base_url: str
    version: Optional[str] = None
    reason: Optional[str] = None


class SourceReference(BaseModel):
    document_id: str
    title: str
    section: Optional[str] = None
    page: Optional[int] = None
    snippet: str
    score: Optional[float] = None
