"""Vector store service using ChromaDB for document embeddings.

ChromaDB uses its built-in default embedding function (all-MiniLM-L6-v2)
so no external API key is needed for embeddings. Only the Groq API key
is required for the LLM in the agent service.
"""

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings

settings = get_settings()

# Module-level singletons
_chroma_client = None
_collection = None

COLLECTION_NAME = "rag_documents"


def get_chroma_client():
    """Get or create ChromaDB persistent client."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection():
    """Get or create the document collection.

    Uses ChromaDB's default embedding function (all-MiniLM-L6-v2)
    which runs locally — no API key required for embeddings.
    """
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


async def add_chunks(chunks: list[dict], document_id: str) -> int:
    """Add document chunks to the vector store.

    ChromaDB auto-generates embeddings using its built-in model.
    """
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

    # ChromaDB generates embeddings automatically using its default model
    collection.add(
        ids=ids,
        documents=texts,
        metadatas=metadatas,
    )

    return len(chunks)


async def search_documents(query: str, top_k: int = 5) -> list[dict]:
    """Search vector store for relevant document chunks.

    ChromaDB embeds the query automatically and finds nearest neighbours.
    """
    collection = get_collection()

    results = collection.query(
        query_texts=[query],
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
                "score": 1 - distance,  # Convert distance to similarity
            })

    return search_results


def delete_document_chunks(document_id: str) -> int:
    """Delete all chunks for a specific document from vector store."""
    collection = get_collection()
    # Get all IDs for this document
    results = collection.get(
        where={"document_id": document_id},
        include=[],
    )
    if results and results["ids"]:
        collection.delete(ids=results["ids"])
        return len(results["ids"])
    return 0


def clear_all() -> int:
    """Clear all documents from vector store."""
    global _collection
    client = get_chroma_client()
    try:
        collection = get_collection()
        count = collection.count()
        client.delete_collection(COLLECTION_NAME)
        _collection = None
        return count
    except Exception:
        return 0


def get_total_chunks() -> int:
    """Get total number of chunks in vector store."""
    try:
        collection = get_collection()
        return collection.count()
    except Exception:
        return 0
