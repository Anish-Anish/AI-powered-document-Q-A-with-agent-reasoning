"""Document processing service: parsing PDF, DOCX, TXT and semantic chunking."""

import os
import uuid
from datetime import datetime, timezone
from typing import BinaryIO

from pypdf import PdfReader
from docx import Document as DocxDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.config import get_settings, get_runtime_settings

settings = get_settings()


def parse_pdf(file_bytes: bytes) -> list[dict]:
    """Extract text from PDF with page metadata."""
    import io
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"text": text, "page": i + 1})
    return pages


def parse_docx(file_bytes: bytes) -> list[dict]:
    """Extract text from DOCX with paragraph-based page estimation."""
    import io
    doc = DocxDocument(io.BytesIO(file_bytes))
    full_text = []
    current_text = ""
    page_num = 1

    for para in doc.paragraphs:
        current_text += para.text + "\n"
        # Approximate page breaks every ~3000 chars
        if len(current_text) > 3000:
            full_text.append({"text": current_text, "page": page_num})
            current_text = ""
            page_num += 1

    if current_text.strip():
        full_text.append({"text": current_text, "page": page_num})

    return full_text


def parse_txt(file_bytes: bytes) -> list[dict]:
    """Extract text from TXT file."""
    text = file_bytes.decode("utf-8", errors="ignore")
    # Split into page-like sections (~3000 chars each)
    pages = []
    page_num = 1
    for i in range(0, len(text), 3000):
        chunk = text[i : i + 3000]
        if chunk.strip():
            pages.append({"text": chunk, "page": page_num})
            page_num += 1
    return pages


def parse_file(file_bytes: bytes, filename: str) -> list[dict]:
    """Parse file based on extension. Returns list of {text, page}."""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return parse_pdf(file_bytes)
    elif ext == "docx":
        return parse_docx(file_bytes)
    elif ext == "txt":
        return parse_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def semantic_chunk(pages: list[dict], filename: str) -> list[dict]:
    """Perform semantic chunking on parsed pages with metadata tagging."""
    rs = get_runtime_settings()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=rs.chunk_size,
        chunk_overlap=rs.chunk_overlap,
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


def format_file_size(size_bytes: int) -> str:
    """Format bytes to human readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
