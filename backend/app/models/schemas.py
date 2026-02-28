from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Document Models ---

class DocumentMetadata(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: str
    chunks_count: int
    uploaded_at: str
    embedding_model: str = "all-MiniLM-L6-v2"


class UploadResponse(BaseModel):
    status: str = "success"
    document_id: str
    filename: str
    chunks_created: int
    embedding_model: str = "all-MiniLM-L6-v2"


class DocumentListResponse(BaseModel):
    documents: list[DocumentMetadata]
    total: int


# --- Query Models ---

class QueryRequest(BaseModel):
    question: str


class Source(BaseModel):
    document: str
    page: int
    chunk: str


class ReasoningStep(BaseModel):
    step: int = 0
    type: str = ""  # thought, action, observation, conclusion
    thought: str = ""
    action: str = ""
    observation: str = ""
    conclusion: str = ""
    content: str = ""


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source] = []
    reasoning_trace: list[ReasoningStep] = []
    retrieval_used: bool = False


# --- Chat Models ---

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: list[Source] = []
    reasoning: list[dict] = []
    retrieval_used: bool = False
    timestamp: str


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    sources: list[Source] = []
    reasoning_trace: list[ReasoningStep] = []
    retrieval_used: bool = False
    turn: int = 1


class SessionOut(BaseModel):
    id: str
    session_id: str
    title: str
    messages: list[ChatMessageOut] = []
    created_at: str
    updated_at: str
    message_count: int = 0


class SessionListResponse(BaseModel):
    sessions: list[SessionOut]
    total: int


# --- Clear Models ---

class ClearResponse(BaseModel):
    status: str = "success"
    cleared: dict = {}


# --- Dashboard Models ---

class DashboardStats(BaseModel):
    total_documents: int = 0
    total_queries: int = 0
    active_sessions: int = 0
    avg_response_time: float = 0.0


class ActivityItem(BaseModel):
    action: str
    detail: str
    time: str
    timestamp: str


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_activity: list[ActivityItem] = []
    agent_distribution: dict = {
        "document_search": 0,
        "direct_llm": 0,
        "combined": 0,
    }
