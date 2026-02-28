"""LangChain ReAct agent with tool calling for the RAG system.

Uses Groq as the LLM provider (fast inference, free tier available).
The agent follows a ReAct pattern: Thought → Action → Observation → Conclusion.
"""

import json
import time
from typing import Optional

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool

from app.config import get_settings, get_runtime_settings
from app.services.vector_store import search_documents, get_total_chunks

settings = get_settings()


# --- Agent Tools ---

@tool
async def document_search(query: str) -> str:
    """Search the vector database for relevant document chunks based on the query.
    Use this when the user asks about specific documents, uploaded files, or
    information that might be in their knowledge base."""
    results = await search_documents(query, top_k=5)
    if not results:
        return "No relevant documents found in the knowledge base."

    output_parts = []
    for i, r in enumerate(results):
        output_parts.append(
            f"[Source {i+1}] {r['source']} (Page {r['page']}, Score: {r['score']:.2f}):\n{r['text']}"
        )
    return "\n\n".join(output_parts)


@tool
def direct_llm(query: str) -> str:
    """Answer a question using the LLM's internal knowledge without document retrieval.
    Use this for general knowledge questions, common facts, explanations of concepts,
    or when no relevant documents are available."""
    # This tool signals the agent to use its own knowledge
    return f"Using internal LLM knowledge to answer: {query}"


@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression. Use this for calculations,
    arithmetic, percentages, or any quantitative queries.
    Example: calculator('2 + 2') or calculator('100 * 0.15')"""
    try:
        import numexpr
        result = numexpr.evaluate(expression).item()
        return f"Result: {result}"
    except Exception as e:
        return f"Error evaluating expression: {str(e)}"


# --- Agent Setup ---

SYSTEM_PROMPT = """You are an intelligent RAG (Retrieval-Augmented Generation) assistant.
Your job is to answer user questions accurately using the available tools.

Decision Strategy:
1. If the question is about specific documents, reports, papers, or uploaded content → use document_search tool first
2. If the question is general knowledge, common facts, or conceptual → use direct_llm tool
3. If the question involves calculations → use calculator tool
4. You can combine multiple tools if needed

Important rules:
- Always provide cited answers when using document sources
- Return the reasoning behind your tool selection
- If document_search returns no results, fall back to direct_llm
- Be concise but thorough in your answers

{agent_scratchpad}"""


def get_llm():
    """Create Groq LLM instance using runtime settings."""
    rs = get_runtime_settings()
    return ChatGroq(
        model=rs.llm_model,
        temperature=rs.temperature,
        groq_api_key=settings.GROQ_API_KEY,
    )


def get_tools():
    """Get the list of agent tools."""
    return [document_search, direct_llm, calculator]


async def run_agent_query(
    question: str,
    chat_history: Optional[list[dict]] = None,
) -> dict:
    """Run the ReAct agent on a question and return structured response.

    Returns dict with: answer, sources, reasoning_trace, retrieval_used
    """
    start_time = time.time()
    llm = get_llm()
    tools = get_tools()

    reasoning_trace = []
    sources = []
    retrieval_used = False

    # Build conversation messages
    messages = []
    if chat_history:
        for msg in chat_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

    # Check if documents exist in the vector store
    total_chunks = get_total_chunks()
    has_documents = total_chunks > 0

    # Step 1: Thought - Agent decides strategy
    # If documents exist, always search them first (combined approach)
    if has_documents:
        # Only use pure direct_llm if the question is clearly NOT about documents
        decision_prompt = f"""Given this question: "{question}"

The user has uploaded documents ({total_chunks} chunks in the knowledge base).

Decide the best approach:
1. "document_search" - search uploaded documents to answer (DEFAULT when documents exist)
2. "combined" - search documents AND supplement with your knowledge
3. "calculator" - ONLY if the question is purely a math calculation like "2+2" or "15% of 200"
4. "direct_llm" - ONLY if the question is completely unrelated to any document (e.g. "what is the weather")

IMPORTANT: When in doubt, ALWAYS choose "document_search" or "combined". The user uploaded documents because they want answers FROM those documents.

Respond with JSON: {{"strategy": "<strategy>", "thought": "<your reasoning>"}}"""
    else:
        decision_prompt = f"""Given this question: "{question}"

No documents have been uploaded yet.

Decide the best approach:
1. "direct_llm" - answer from your knowledge
2. "calculator" - if it involves math/calculations

Respond with JSON: {{"strategy": "<strategy>", "thought": "<your reasoning>"}}"""

    decision_messages = [
        SystemMessage(content="You are a query routing agent. Respond only with valid JSON."),
        *messages,
        HumanMessage(content=decision_prompt),
    ]

    decision_response = await llm.ainvoke(decision_messages)
    decision_text = decision_response.content.strip()

    # Parse decision
    try:
        # Handle markdown code blocks
        if "```" in decision_text:
            decision_text = decision_text.split("```")[1]
            if decision_text.startswith("json"):
                decision_text = decision_text[4:]
            decision_text = decision_text.strip()
        decision = json.loads(decision_text)
    except (json.JSONDecodeError, IndexError):
        # Default: search documents if they exist, otherwise direct LLM
        fallback = "combined" if has_documents else "direct_llm"
        decision = {"strategy": fallback, "thought": "Unable to parse decision, using fallback."}

    strategy = decision.get("strategy", "combined" if has_documents else "direct_llm")
    thought = decision.get("thought", "Analyzing query...")

    # Safety net: if documents exist and LLM wrongly chose direct_llm, override to combined
    if has_documents and strategy == "direct_llm":
        strategy = "combined"
        thought += " (Overridden: documents exist in knowledge base, searching them first.)"

    reasoning_trace.append({
        "step": 1,
        "type": "thought",
        "thought": thought,
        "content": thought,
    })

    # Step 2: Action - Execute tools based on strategy
    doc_context = ""

    if strategy in ("document_search", "combined"):
        reasoning_trace.append({
            "step": 2,
            "type": "action",
            "action": f"document_search('{question}')",
            "content": f"document_search('{question}')",
        })

        search_results = await search_documents(question, top_k=5)

        if search_results:
            retrieval_used = True
            chunks_info = []
            for r in search_results:
                sources.append({
                    "document": r["source"],
                    "page": r["page"],
                    "chunk": r["text"][:200] + "..." if len(r["text"]) > 200 else r["text"],
                })
                chunks_info.append(f"[{r['source']} p.{r['page']}]: {r['text']}")

            doc_context = "\n\n".join(chunks_info)
            scores_str = ", ".join(str(round(r["score"], 2)) for r in search_results[:3])
            reasoning_trace.append({
                "step": 3,
                "type": "observation",
                "observation": f"Found {len(search_results)} relevant chunks with similarity scores ({scores_str})",
                "content": f"Found {len(search_results)} relevant chunks from document search.",
            })
        else:
            reasoning_trace.append({
                "step": 3,
                "type": "observation",
                "observation": "No relevant documents found. Falling back to LLM knowledge.",
                "content": "No relevant documents found. Falling back to LLM knowledge.",
            })
            if strategy == "document_search":
                strategy = "direct_llm"

    if strategy in ("direct_llm", "combined") and not retrieval_used:
        reasoning_trace.append({
            "step": len(reasoning_trace) + 1,
            "type": "action",
            "action": f"direct_llm('{question}')",
            "content": f"Using LLM internal knowledge to answer: {question}",
        })
        reasoning_trace.append({
            "step": len(reasoning_trace) + 1,
            "type": "observation",
            "observation": "LLM responded with answer from internal knowledge.",
            "content": "LLM responded with answer from internal knowledge.",
        })

    if strategy == "calculator":
        reasoning_trace.append({
            "step": 2,
            "type": "action",
            "action": f"calculator('{question}')",
            "content": f"Evaluating mathematical expression.",
        })

    # Step 3: Generate final answer
    format_instructions = """
FORMAT YOUR ANSWER using rich Markdown. This is critical — follow these rules exactly:

**Text formatting:**
- Use **bold** for key terms, important facts, numbers, and critical values
- Use `code` for technical terms, file names, or specific values
- Keep paragraphs short (2-3 sentences max)
- Start with a one-line **bold summary**, then elaborate

**Structure:**
- Use ## for main sections and ### for subsections
- Use bullet lists (- item) or numbered lists (1. item) for multiple points
- Use > blockquotes for direct quotes from documents

**Tables — ALWAYS use proper markdown table syntax when presenting structured/comparative data:**
A valid markdown table MUST have:
1. A header row: | Column A | Column B | Column C |
2. A separator row: |---|---|---|
3. Data rows: | value1 | value2 | value3 |

Example of a correct table:
| Feature | Description | Status |
|---|---|---|
| Auth | JWT tokens | Active |
| Cache | Redis layer | Pending |

Use tables whenever you present comparisons, lists of properties, statistics, key-value pairs, or any data that has 2+ attributes per item."""

    if retrieval_used and doc_context:
        answer_prompt = f"""You have access to the following information to help answer the user's question:

---
{doc_context}
---

User's question: {question}
{format_instructions}

CRITICAL RULES:
- Answer the question directly and naturally as if you already know the information.
- NEVER mention "chunks", "retrieved context", "document chunks", "provided context", or any internal retrieval process.
- NEVER say things like "based on the provided documents" or "the retrieved context shows" or "unfortunately the provided chunks do not contain".
- If the information above does NOT contain the answer, simply say you don't have that information in a natural way (e.g. "This information isn't covered in the available documents.") and offer what you DO know.
- Write as a knowledgeable assistant who naturally knows this information, not as a search engine explaining its results.
- When referencing sources, naturally mention the document name (e.g. "According to **resume.pdf**...") without explaining the retrieval mechanism."""
    else:
        answer_prompt = f"""Answer the following question using your knowledge.
Be accurate, helpful, and natural.

Question: {question}
{format_instructions}"""

    answer_messages = [
        SystemMessage(content="You are a helpful, knowledgeable AI assistant. Answer questions directly and naturally. Never mention internal processes like 'chunks', 'retrieval', 'context', or 'document processing'. Format answers with rich Markdown — bold, headings, lists, tables, and code formatting."),
        *messages,
        HumanMessage(content=answer_prompt),
    ]

    answer_response = await llm.ainvoke(answer_messages)
    answer = answer_response.content.strip()

    # Step 4: Conclusion
    elapsed = time.time() - start_time
    reasoning_trace.append({
        "step": len(reasoning_trace) + 1,
        "type": "conclusion",
        "conclusion": f"Answer {'uses document retrieval' if retrieval_used else 'uses LLM internal knowledge'}. "
                      f"Generated in {elapsed:.2f}s.",
        "content": f"Answer {'is based on retrieved documents with citations' if retrieval_used else 'is factual and does not require document retrieval'}.",
    })

    return {
        "answer": answer,
        "sources": sources,
        "reasoning_trace": reasoning_trace,
        "retrieval_used": retrieval_used,
        "strategy": strategy,
        "response_time": elapsed,
    }
