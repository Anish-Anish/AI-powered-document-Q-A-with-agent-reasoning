"""Document management routes: upload, list, delete."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.database import get_db
from app.services.document_processor import parse_file, semantic_chunk, format_file_size
from app.services.vector_store import add_chunks, delete_document_chunks
from app.models.schemas import UploadResponse, DocumentListResponse, DocumentMetadata
from app.config import get_settings

settings = get_settings()
router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """Upload a document: parse → chunk → embed → store in vector DB."""
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT",
        )

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Parse the file
    try:
        pages = parse_file(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {str(e)}")

    if not pages:
        raise HTTPException(status_code=422, detail="No text content found in file")

    # Semantic chunking
    chunks = semantic_chunk(pages, file.filename)

    # Generate document ID
    document_id = f"doc_{uuid.uuid4().hex[:12]}"

    # Store embeddings in vector DB
    chunks_created = await add_chunks(chunks, document_id)

    # Store document metadata in MongoDB
    db = get_db()
    doc_record = {
        "document_id": document_id,
        "filename": file.filename,
        "file_type": ext.upper(),
        "file_size": format_file_size(file_size),
        "file_size_bytes": file_size,
        "chunks_count": chunks_created,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "embedding_model": "all-MiniLM-L6-v2",
    }
    await db.documents.insert_one(doc_record)

    # Log activity
    await db.activity.insert_one({
        "action": "Document uploaded",
        "detail": f"{file.filename} — {chunks_created} chunks",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "upload",
    })

    return UploadResponse(
        status="success",
        document_id=document_id,
        filename=file.filename,
        chunks_created=chunks_created,
        embedding_model="all-MiniLM-L6-v2",
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents():
    """List all uploaded documents with metadata."""
    db = get_db()
    docs_cursor = db.documents.find({}, {"_id": 0}).sort("uploaded_at", -1)
    docs = await docs_cursor.to_list(length=1000)

    documents = []
    for doc in docs:
        documents.append(DocumentMetadata(
            id=doc["document_id"],
            filename=doc["filename"],
            file_type=doc["file_type"],
            file_size=doc["file_size"],
            chunks_count=doc["chunks_count"],
            uploaded_at=doc["uploaded_at"][:16].replace("T", " "),
            embedding_model=doc.get("embedding_model", "all-MiniLM-L6-v2"),
        ))

    return DocumentListResponse(documents=documents, total=len(documents))


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a specific document and its chunks."""
    db = get_db()

    # Check document exists
    doc = await db.documents.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from vector store
    chunks_deleted = delete_document_chunks(document_id)

    # Delete from MongoDB
    await db.documents.delete_one({"document_id": document_id})

    # Log activity
    await db.activity.insert_one({
        "action": "Document deleted",
        "detail": f"{doc['filename']} — {chunks_deleted} chunks removed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "delete",
    })

    return {
        "status": "success",
        "document_id": document_id,
        "chunks_deleted": chunks_deleted,
    }
