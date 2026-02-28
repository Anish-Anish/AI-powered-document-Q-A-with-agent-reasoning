# Support Guide — Build This Backend From Scratch

> **Audience:** You are a backend engineer. You want to understand every piece of this project by typing it yourself. 
> This guide walks you through the entire backend — file by file, class by class — in the exact order you should build it. No frontend stuff. Just pure backend.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Prerequisites — What You Need Installed](#2-prerequisites)
3. [Phase 1: Project Skeleton](#3-phase-1-project-skeleton)
4. [Phase 2: Configuration (config.py)](#4-phase-2-configuration)
5. [Phase 3: Database Connection (database.py)](#5-phase-3-database-connection)
6. [Phase 4: Pydantic Models (schemas.py)](#6-phase-4-pydantic-models)
7. [Phase 5: Document Processor Service](#7-phase-5-document-processor)
8. [Phase 6: Vector Store Service (ChromaDB)](#8-phase-6-vector-store)
9. [Phase 7: The Agent (The Brain)](#9-phase-7-the-agent)
10. [Phase 8: Routes — Documents](#10-phase-8-routes-documents)
11. [Phase 9: Routes — Query & Chat](#11-phase-9-routes-query-and-chat)
12. [Phase 10: Routes — Dashboard](#12-phase-10-routes-dashboard)
13. [Phase 11: Routes — Clear](#13-phase-11-routes-clear)
14. [Phase 12: Main App (Glue Everything Together)](#14-phase-12-main-app)
15. [Phase 13: Run It](#15-phase-13-run-it)
16. [Phase 14: Test It With curl](#16-phase-14-test-with-curl)
17. [How Everything Connects — The Full Flow](#17-full-flow)
18. [Glossary](#18-glossary)

---

## 1. The Big Picture

Imagine you have a box of documents (PDFs, Word files, text files). You want to:
- **Put documents in the box** (upload)
- **Ask questions about them** ("What does the report say about revenue?")
- **Get smart answers** with the exact page and paragraph where the info came from
- **Have conversations** where the system remembers what you said before

That's what this backend does. Here's the mental model:

```
┌──────────────────────────────────────────────────────────-┐
│                        YOUR BACKEND                       │
│                                                           │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────-─┐  │
│  │ FastAPI │───▶│   Routes    │──▶ │    Services       │  │
│  │ (door)  │    │ (receptionist)   │ (workers)         │  │
│  └─────────┘    └─────────────┘    │                   │  │
│                                     │  ┌─────────────┐ │  │
│                                     │  │doc_processor│ │  │
│                                     │  │(reads files)│ │  │
│                                     │  └──────┬──────┘ │  │
│                                     │         ▼        │  │
│                                     │  ┌─────────────┐ │  │
│                                     │  │ vector_store│ │  │
│                                     │  │ (memory box)│ │  │
│                                     │  └─────────────┘ │  │
│                                     │                  │  │
│                                     │  ┌─────────────┐ │  │
│                                     │  │   agent     │ │  │
│                                     │  │ (the brain) │ │  │
│                                     │  └─────────────┘ │  │
│                                     └──────────────────┘  │
│                                                           │
│  ┌──────────┐    ┌──────────────┐                         │
│  │ MongoDB  │    │   ChromaDB   │                         │
│  │(notebook)│    │(memory box)  │                         │
│  └──────────┘    └──────────────┘                         │
└──────────────────────────────────────────────────────────-┘
```

Think of it like a library:
- **FastAPI** = the front door of the library
- **Routes** = the receptionist who directs you
- **Document Processor** = the librarian who reads and organizes books
- **ChromaDB (Vector Store)** = the shelf system that finds similar books fast
- **Agent** = the smart assistant who decides HOW to answer your question
- **MongoDB** = the notebook that remembers everything (sessions, metadata, logs)

---

## 2. Prerequisites

Before you type a single line of code, make sure you have:

```bash
# Check Python version (need 3.11+)
python3 --version

# Check if MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"
# If not installed: brew install mongodb-community (macOS)
# Or use Docker: docker run -d -p 27017:27017 --name rag_mongo mongo:7

# Get a Groq API key (free)
# Go to: https://console.groq.com
# Sign up → Create API key → Copy it
```

---

## 3. Phase 1: Project Skeleton

Create the folder structure first. Every file. Even the empty ones.

```bash
mkdir -p backend/app/models
mkdir -p backend/app/routes
mkdir -p backend/app/services

# Create all the empty __init__.py files (Python needs these)
touch backend/app/__init__.py
touch backend/app/models/__init__.py
touch backend/app/routes/__init__.py
touch backend/app/services/__init__.py
```

**Why `__init__.py`?** Python treats folders as "packages" only if they have this file. Without it, `from app.services.agent import ...` would fail.

Now create the requirements file:

```bash
cd backend
cat > requirements.txt << 'EOF'
fastapi==0.115.6
uvicorn==0.34.0
python-dotenv==1.0.1
python-multipart==0.0.20
motor==3.6.0
pymongo>=4.9,<4.10
langchain==0.3.13
langchain-groq==0.2.4
langchain-community==0.3.13
chromadb==0.4.24
pypdf==4.2.0
python-docx==1.1.2
tiktoken==0.7.0
pydantic==2.10.4
pydantic-settings==2.7.0
aiofiles==24.1.0
numexpr==2.10.2
pytest==8.2.2
EOF
```

**What each package does:**

| Package | What it does |
|---------|-------------|
| `fastapi` | The web framework — creates HTTP endpoints |
| `uvicorn` | The server that runs FastAPI |
| `python-dotenv` | Reads `.env` file so secrets stay out of code |
| `python-multipart` | Lets FastAPI accept file uploads |
| `motor` | Async MongoDB driver (lets Python talk to MongoDB without blocking) |
| `pymongo` | Base MongoDB driver (motor is built on top of this) |
| `langchain` | Framework for building AI agents with tools |
| `langchain-groq` | LangChain's connector to Groq's LLM API |
| `langchain-community` | Community integrations for LangChain |
| `chromadb` | Vector database — stores document chunks as numbers (embeddings) |
| `pypdf` | Reads PDF files and extracts text |
| `python-docx` | Reads .docx (Word) files and extracts text |
| `tiktoken` | Counts tokens (used internally by LangChain) |
| `pydantic` | Data validation — makes sure API inputs/outputs are correct |
| `pydantic-settings` | Reads `.env` into typed Python settings |
| `aiofiles` | Async file operations |
| `numexpr` | Fast math expression evaluator (for the calculator tool) |
| `pytest` | Testing framework |

Install everything:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create your `.env` file:

```bash
cat > .env << 'EOF'
GROQ_API_KEY=gsk_paste_your_key_here
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=rag_system
CHROMA_PERSIST_DIR=./chroma_data
HOST=0.0.0.0
PORT=8000
LLM_MODEL=llama-3.1-8b-instant
CHUNK_SIZE=500
CHUNK_OVERLAP=50
EOF
```
---


## 4. Phase 2: Configuration

**File: `app/config.py`**

This is the first real file you write. It reads your `.env` file and turns it into a typed Python object.

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "rag_system"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LLM_MODEL: str = "llama-3.1-8b-instant"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

**What's happening here:**

- `BaseSettings` from pydantic reads environment variables automatically. If there's a `GROQ_API_KEY` in your `.env` file, it maps to `self.GROQ_API_KEY`.
- `@lru_cache()` means "create this object once, then reuse it every time someone calls `get_settings()`". It's a singleton pattern.
- The `Config` inner class tells pydantic which file to read.
- **Security**: Your API key lives in `.env` (which is git-ignored), NOT in your code. The code only says `settings.GROQ_API_KEY` — the actual value comes from the environment.

**Test it mentally:** When you do `settings = get_settings()`, then `settings.GROQ_API_KEY` gives you the key from `.env`.

---

## 5. Phase 3: Database Connection

**File: `app/database.py`**

This file connects to MongoDB using Motor (an async driver).

```python
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    # Create indexes for faster queries
    await db.documents.create_index("filename")
    await db.documents.create_index("uploaded_at")
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("updated_at")
    await db.activity.create_index("timestamp")


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return db
```

**What's happening:**

- `AsyncIOMotorClient` = an async MongoDB client. "Async" means it doesn't block — while waiting for MongoDB to respond, Python can handle other requests.
- `client[settings.MONGODB_DB_NAME]` = selects (or creates) the database. MongoDB creates databases automatically when you first write to them.
- `create_index(...)` = makes lookups faster. Like an index in a book — instead of reading every page, you jump straight to where "filename" is.
- `global client, db` = module-level variables shared across the app. `get_db()` returns the database object any route can use.

**MongoDB collections we'll use:**
- `documents` — metadata about uploaded files (name, size, chunks count)
- `sessions` — chat conversation history
- `activity` — log of everything that happens (uploads, queries)
- `stats` — counters (total queries, etc.)

You don't need to create these collections manually. MongoDB creates them when you first insert a document.

---

## 6. Phase 4: Pydantic Models

**File: `app/models/schemas.py`**

These are your data shapes. Every API request and response has a strict shape defined here.

Think of Pydantic models as contracts: "This endpoint MUST receive data that looks like THIS, and MUST return data that looks like THAT."

```python
from pydantic import BaseModel
from typing import Optional


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
    type: str = ""
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


# --- Clear / Dashboard ---

class ClearResponse(BaseModel):
    status: str = "success"
    cleared: dict = {}

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
```

**Why Pydantic?**
- If someone sends `{"question": 123}` to your `/query` endpoint, Pydantic rejects it because `question` must be a `str`. No manual validation needed.
- FastAPI uses these models to auto-generate the Swagger docs at `/docs`.
- `Optional[str] = None` means the field is optional.
- `list[Source] = []` means "a list of Source objects, defaulting to empty".

**Key insight:** `ReasoningStep` has many fields (`thought`, `action`, `observation`, `conclusion`, `content`) — all optional with defaults. This is because different steps in the reasoning trace populate different fields.

---

## 7. Phase 5: Document Processor

**File: `app/services/document_processor.py`**

This is the librarian. It reads documents and chops them into chunks.

```python
import os
import uuid
from datetime import datetime, timezone

from pypdf import PdfReader
from docx import Document as DocxDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.config import get_settings

settings = get_settings()
```

**Three parsers — one for each file type:**

```python
def parse_pdf(file_bytes: bytes) -> list[dict]:
    import io
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"text": text, "page": i + 1})
    return pages

def parse_docx(file_bytes: bytes) -> list[dict]:
    import io
    doc = DocxDocument(io.BytesIO(file_bytes))
    full_text = []
    current_text = ""
    page_num = 1
    for para in doc.paragraphs:
        current_text += para.text + "\n"
        if len(current_text) > 3000:  # approximate page break
            full_text.append({"text": current_text, "page": page_num})
            current_text = ""
            page_num += 1
    if current_text.strip():
        full_text.append({"text": current_text, "page": page_num})
    return full_text

def parse_txt(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8", errors="ignore")
    pages = []
    page_num = 1
    for i in range(0, len(text), 3000):
        chunk = text[i:i + 3000]
        if chunk.strip():
            pages.append({"text": chunk, "page": page_num})
            page_num += 1
    return pages
```

**Router function:**

```python
def parse_file(file_bytes: bytes, filename: str) -> list[dict]:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return parse_pdf(file_bytes)
    elif ext == "docx":
        return parse_docx(file_bytes)
    elif ext == "txt":
        return parse_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
```

**The chunker — this is the important part:**

```python
def semantic_chunk(pages: list[dict], filename: str) -> list[dict]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,    # 500 characters per chunk
        chunk_overlap=settings.CHUNK_OVERLAP,  # 50 characters overlap
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = []
    for page_data in pages:
        page_chunks = text_splitter.split_text(page_data["text"])
        for chunk_text in page_chunks:
            if chunk_text.strip():
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "text": chunk_text.strip(),
                    "metadata": {
                        "source": filename,
                        "page": page_data["page"],
                        "upload_timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                })
    return chunks
```

**Why chunk?** LLMs have token limits. You can't feed a 100-page PDF into a prompt. Instead, you:
1. Split the document into small pieces (chunks)
2. Store each chunk as a vector (embedding)
3. When someone asks a question, find the most relevant chunks
4. Feed only those chunks to the LLM

**Why overlap?** If a sentence gets split across two chunks, the overlap ensures both chunks contain the full sentence. Without overlap, you'd lose context at boundaries.

**`RecursiveCharacterTextSplitter`** tries to split at paragraph breaks first (`\n\n`), then line breaks (`\n`), then sentences (`. `), then words (` `), then characters. This keeps meaning intact.

Also add the file size formatter:

```python
def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
```

---

## 8. Phase 6: Vector Store

**File: `app/services/vector_store.py`**

This is the memory box. It stores document chunks as vectors and finds similar ones when you search.

**What is a vector?** Every chunk of text gets converted into a list of numbers (like `[0.12, -0.45, 0.78, ...]`). Similar texts have similar numbers. ChromaDB does this conversion automatically using a local model called `all-MiniLM-L6-v2`.

```python
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import get_settings

settings = get_settings()

_chroma_client = None
_collection = None

COLLECTION_NAME = "rag_documents"


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection():
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection
```

**Key concepts:**
- `PersistentClient` = saves to disk so data survives restarts
- `get_or_create_collection` = if the collection exists, use it; otherwise create it
- `"hnsw:space": "cosine"` = use cosine similarity to compare vectors. Cosine similarity measures the angle between two vectors — identical = 1.0, completely different = 0.0

**Adding chunks:**

```python
async def add_chunks(chunks: list[dict], document_id: str) -> int:
    if not chunks:
        return 0
    collection = get_collection()
    texts = [c["text"] for c in chunks]
    ids = [c["id"] for c in chunks]
    metadatas = []
    for c in chunks:
        meta = c["metadata"].copy()
        meta["document_id"] = document_id
        metadatas.append(meta)

    # ChromaDB generates embeddings automatically!
    collection.add(ids=ids, documents=texts, metadatas=metadatas)
    return len(chunks)
```

You pass the raw text, and ChromaDB embeds it internally. No external API call.

**Searching:**

```python
async def search_documents(query: str, top_k: int = 5) -> list[dict]:
    collection = get_collection()
    results = collection.query(
        query_texts=[query],   # ChromaDB auto-embeds this query too
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    search_results = []
    if results and results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            metadata = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else 1.0
            search_results.append({
                "text": doc,
                "source": metadata.get("source", "unknown"),
                "page": metadata.get("page", 0),
                "document_id": metadata.get("document_id", ""),
                "score": 1 - distance,
            })
    return search_results
```

`1 - distance` converts distance (lower = closer) to similarity (higher = more similar).

Also add `delete_document_chunks`, `clear_all`, and `get_total_chunks` — see the actual file for these. They're straightforward CRUD operations on ChromaDB.

---

## 9. Phase 7: The Agent (The Brain)

**File: `app/services/agent.py`**

This is the most important file. The agent decides HOW to answer your question.

**The ReAct pattern:** Think of it like a person thinking out loud:
1. **Thought** — "Hmm, the user is asking about their Q3 report. I should search their documents."
2. **Action** — Calls `document_search("Q3 report revenue")`
3. **Observation** — "Found 3 relevant chunks from quarterly_review.pdf"
4. **Conclusion** — Combines the chunks with LLM knowledge to write a final answer

**Step 1: Define the tools**

```python
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from app.config import get_settings
from app.services.vector_store import search_documents

settings = get_settings()

@tool
async def document_search(query: str) -> str:
    """Search the vector database for relevant document chunks."""
    results = await search_documents(query, top_k=5)
    if not results:
        return "No relevant documents found."
    output_parts = []
    for i, r in enumerate(results):
        output_parts.append(
            f"[Source {i+1}] {r['source']} (Page {r['page']}, Score: {r['score']:.2f}):\n{r['text']}"
        )
    return "\n\n".join(output_parts)

@tool
def direct_llm(query: str) -> str:
    """Answer using LLM's internal knowledge (no retrieval)."""
    return f"Using internal LLM knowledge to answer: {query}"

@tool
def calculator(expression: str) -> str:
    """Evaluate a math expression."""
    import numexpr
    try:
        result = numexpr.evaluate(expression).item()
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"
```

The `@tool` decorator from LangChain turns a regular function into a tool the agent can call. The docstring becomes the tool's description — the agent reads it to decide when to use it.

**Step 2: Create the LLM**

```python
def get_llm():
    return ChatGroq(
        model=settings.LLM_MODEL,         # llama-3.1-8b-instant
        temperature=0.1,                   # low = more deterministic
        groq_api_key=settings.GROQ_API_KEY,
    )
```

**Step 3: The main function — `run_agent_query`**

This is ~100 lines but here's the logic:

```
1. Take the user's question
2. Ask the LLM: "What strategy should I use?" (returns JSON)
3. Parse the strategy: document_search / direct_llm / combined / calculator
4. Execute the chosen tool(s)
5. Build a prompt with the tool results
6. Ask the LLM to generate the final answer
7. Return everything: answer, sources, reasoning_trace, retrieval_used
```

The agent doesn't use LangChain's built-in `AgentExecutor` here — instead, we manually orchestrate the Thought → Action → Observation → Conclusion flow. This gives us full control over the reasoning trace format that the frontend expects.

**Why not `AgentExecutor`?** It works great for simple cases, but we need the reasoning trace in a specific JSON format for the frontend. Manual orchestration is more predictable and debuggable.

---

## 10. Phase 8: Routes — Documents

**File: `app/routes/documents.py`**

This file handles: uploading files, listing files, deleting files.

```python
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # 1. Validate file type (pdf, docx, txt)
    # 2. Read file bytes
    # 3. Parse file → get pages
    # 4. Semantic chunk → get chunks
    # 5. Store chunks in ChromaDB (vector store)
    # 6. Store metadata in MongoDB
    # 7. Log activity
    # 8. Return response
    ...

@router.get("/documents")
async def list_documents():
    # Query MongoDB for all documents, return as list
    ...

@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    # 1. Find document in MongoDB
    # 2. Delete its chunks from ChromaDB
    # 3. Delete metadata from MongoDB
    # 4. Log activity
    ...
```

**Key pattern:** Every route follows: validate → process → store → log → respond. The actual business logic lives in the services layer, not here.

---

## 11. Phase 9: Routes — Query and Chat

**File: `app/routes/query.py`**

Two main endpoints:

**`POST /query`** — Single question, no conversation history:
```python
@router.post("/query")
async def query(request: QueryRequest):
    result = await run_agent_query(request.question)
    # Log to MongoDB, return structured response
```

**`POST /chat`** — Multi-turn conversation:
```python
@router.post("/chat")
async def chat(request: ChatRequest):
    # 1. Find or create session in MongoDB
    # 2. Load chat history from session
    # 3. Run agent with history context
    # 4. Save user message + assistant message to session
    # 5. Return response with session_id
```

The difference: `/chat` passes `chat_history` to `run_agent_query()`, so the LLM sees previous messages and can follow up.

**Session management endpoints:**
- `GET /sessions` — list all sessions
- `GET /sessions/{id}` — get one session with all messages
- `DELETE /sessions/{id}` — delete a session

---

## 12. Phase 10: Routes — Dashboard

**File: `app/routes/dashboard.py`**

One endpoint: `GET /dashboard/stats`

It queries MongoDB for:
- Total documents count
- Total queries count
- Active sessions (updated in last 24h)
- Recent activity log (last 10 events)
- Agent strategy distribution (how often was RAG used vs direct LLM)

```python
pipeline = [
    {"$match": {"type": {"$in": ["query", "chat"]}}},
    {"$group": {"_id": "$strategy", "count": {"$sum": 1}}},
]
dist_cursor = db.activity.aggregate(pipeline)
```

This is a MongoDB aggregation pipeline — it groups activity records by strategy and counts them. Like SQL's `SELECT strategy, COUNT(*) FROM activity GROUP BY strategy`.

---

## 13. Phase 11: Routes — Clear

**File: `app/routes/clear.py`**

One endpoint: `DELETE /clear`

Nuclear option — deletes everything:
1. Counts current documents, sessions
2. Clears ChromaDB (deletes the collection)
3. Clears all MongoDB collections
4. Logs that it happened

---

## 14. Phase 12: Main App (Glue Everything Together)

**File: `app/main.py`**

This is where everything comes together:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_db, close_db
from app.routes import documents, query, dashboard, clear


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()    # Connect to MongoDB on startup
    yield
    await close_db()      # Disconnect on shutdown


app = FastAPI(
    title="GenAI Agentic RAG System",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route groups under /api prefix
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(query.router, prefix="/api", tags=["Query & Chat"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(clear.router, prefix="/api", tags=["System"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
```

**What's happening:**
- `lifespan` = startup/shutdown hooks. MongoDB connects when app starts, disconnects when app stops.
- `CORSMiddleware` = allows the frontend (on a different port) to call this backend.
- `include_router` = registers each route file. `prefix="/api"` means all routes get `/api/` prepended.
- `tags` = groups in the Swagger docs.

---

## 15. Phase 13: Run It

**File: `run.py`**

```python
import uvicorn
from app.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,       # Auto-restart when code changes
    )
```

```bash
python run.py
```

Open http://localhost:8000/docs — you'll see all your endpoints with interactive testing.

---

## 16. Phase 14: Test With curl

```bash
# Health check
curl http://localhost:8000/api/health

# Upload a PDF
curl -X POST http://localhost:8000/api/upload -F "file=@some_document.pdf"

# Ask a question
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?"}'

# Multi-turn chat
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Summarize the main points"}'

# List documents
curl http://localhost:8000/api/documents

# List sessions
curl http://localhost:8000/api/sessions

# Dashboard
curl http://localhost:8000/api/dashboard/stats

# Clear everything
curl -X DELETE http://localhost:8000/api/clear
```

---

## 17. Full Flow — How Everything Connects

When someone uploads a file, here's what happens step by step:

```
POST /api/upload (file=report.pdf)
    │
    ├── routes/documents.py :: upload_document()
    │   ├── Validates file type
    │   ├── Reads raw bytes
    │   │
    │   ├── services/document_processor.py :: parse_file()
    │   │   └── parse_pdf() → returns [{text: "...", page: 1}, ...]
    │   │
    │   ├── services/document_processor.py :: semantic_chunk()
    │   │   └── RecursiveCharacterTextSplitter splits into 500-char chunks
    │   │   └── Each chunk gets a UUID + metadata (source, page, timestamp)
    │   │
    │   ├── services/vector_store.py :: add_chunks()
    │   │   └── ChromaDB auto-embeds text → stores vectors + metadata
    │   │
    │   ├── database.py :: db.documents.insert_one()
    │   │   └── MongoDB stores document metadata
    │   │
    │   └── database.py :: db.activity.insert_one()
    │       └── Logs "Document uploaded — 24 chunks"
    │
    └── Returns: { document_id, filename, chunks_created }
```

When someone asks a question:

```
POST /api/chat (message="What does the report say about revenue?")
    │
    ├── routes/query.py :: chat()
    │   ├── Finds or creates session in MongoDB
    │   ├── Loads chat history
    │   │
    │   ├── services/agent.py :: run_agent_query()
    │   │   │
    │   │   ├── [THOUGHT] LLM analyzes query → decides "document_search"
    │   │   │
    │   │   ├── [ACTION] services/vector_store.py :: search_documents()
    │   │   │   └── ChromaDB finds top 5 similar chunks
    │   │   │
    │   │   ├── [OBSERVATION] "Found 3 relevant chunks (0.89, 0.85, 0.82)"
    │   │   │
    │   │   ├── [GENERATE] LLM writes answer using chunks as context
    │   │   │
    │   │   └── [CONCLUSION] Returns answer + sources + reasoning_trace
    │   │
    │   ├── Saves user_msg + assistant_msg to session in MongoDB
    │   ├── Logs activity
    │   │
    │   └── Returns: { session_id, answer, sources, reasoning_trace, turn }
```

---

## 18. Glossary

| Term | Meaning |
|------|---------|
| **RAG** | Retrieval-Augmented Generation — find relevant docs, then generate answer using them |
| **ReAct** | Reasoning + Acting — the agent thinks, acts, observes, then concludes |
| **Embedding** | Converting text to a list of numbers (vector) that captures meaning |
| **Vector DB** | Database optimized for finding similar vectors (= similar text) |
| **ChromaDB** | The specific vector database we use (runs locally) |
| **Chunk** | A small piece of a document (~500 characters) |
| **Cosine similarity** | Math formula that measures how similar two vectors are (1.0 = identical) |
| **Motor** | Async MongoDB driver for Python |
| **Pydantic** | Data validation library — defines the shape of your data |
| **FastAPI** | Python web framework built on top of Starlette + Pydantic |
| **Groq** | Cloud provider that runs LLMs super fast (free tier available) |
| **LangChain** | Python framework for building LLM-powered applications |
| **Tool** | A function the agent can call (document_search, calculator, etc.) |
| **Session** | A multi-turn conversation stored in MongoDB |
| **CORS** | Cross-Origin Resource Sharing — allows frontend on port 8080 to call backend on port 8000 |

---

## Build Order Summary

If you want to type everything from scratch, follow this exact order:

```
1.  requirements.txt          ← what to install
2.  .env                      ← secrets
3.  app/__init__.py            ← empty
4.  app/config.py              ← reads .env
5.  app/database.py            ← MongoDB connection
6.  app/models/__init__.py     ← empty
7.  app/models/schemas.py      ← data shapes
8.  app/services/__init__.py   ← empty
9.  app/services/document_processor.py  ← reads files, chunks text
10. app/services/vector_store.py        ← ChromaDB operations
11. app/services/agent.py               ← THE BRAIN (Groq + LangChain)
12. app/routes/__init__.py     ← empty
13. app/routes/documents.py    ← upload, list, delete docs
14. app/routes/query.py        ← query, chat, sessions
15. app/routes/dashboard.py    ← stats
16. app/routes/clear.py        ← reset everything
17. app/main.py                ← glue it all together
18. run.py                     ← start the server
```

Each file builds on the previous ones. You can test at each step by running the server and hitting `/docs`.

Good luck. You've got this.
