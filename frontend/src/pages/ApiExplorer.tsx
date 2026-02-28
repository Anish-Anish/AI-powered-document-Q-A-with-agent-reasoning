import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface Endpoint {
  method: "POST" | "GET" | "DELETE";
  path: string;
  description: string;
  request?: string;
  response: string;
}

const endpoints: Endpoint[] = [
  {
    method: "POST",
    path: "/upload",
    description: "Upload file → chunk → embed → store in vector DB",
    request: `curl -X POST /upload \\
  -F "file=@research_paper.pdf"`,
    response: `{
  "status": "success",
  "document_id": "doc_abc123",
  "filename": "research_paper.pdf",
  "chunks_created": 24,
  "embedding_model": "text-embedding-3-small"
}`,
  },
  {
    method: "POST",
    path: "/query",
    description: "Ask question → agent decides retrieval strategy → return cited answer + reasoning trace",
    request: `curl -X POST /query \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is transformer architecture?"}'`,
    response: `{
  "answer": "The Transformer architecture...",
  "sources": [
    {"document": "research_paper.pdf", "page": 12, "chunk": "..."}
  ],
  "reasoning_trace": [
    {"step": "thought", "content": "..."},
    {"step": "action", "content": "document_search(...)"},
    {"step": "observation", "content": "Found 3 chunks..."}
  ],
  "retrieval_used": true
}`,
  },
  {
    method: "POST",
    path: "/chat",
    description: "Multi-turn conversation with session ID (maintains context)",
    request: `curl -X POST /chat \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "sess_123", "message": "Tell me more"}'`,
    response: `{
  "session_id": "sess_123",
  "answer": "Building on our previous discussion...",
  "sources": [],
  "turn": 3
}`,
  },
  {
    method: "GET",
    path: "/documents",
    description: "List all uploaded documents with metadata",
    response: `{
  "documents": [
    {
      "id": "doc_abc123",
      "filename": "research_paper.pdf",
      "chunks": 24,
      "uploaded_at": "2026-02-26T10:30:00Z"
    }
  ],
  "total": 4
}`,
  },
  {
    method: "DELETE",
    path: "/clear",
    description: "Clear vector DB / reset session",
    response: `{
  "status": "success",
  "cleared": {
    "documents": 4,
    "chunks": 90,
    "sessions": 3
  }
}`,
  },
];

export default function ApiExplorer() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">API Explorer</h1>
        <p className="text-muted-foreground mt-1">FastAPI endpoints for the Agentic RAG system</p>
      </motion.div>

      <div className="space-y-3">
        {endpoints.map((ep, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <EndpointCard endpoint={ep} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const methodClass = endpoint.method === "GET" ? "method-get" : endpoint.method === "POST" ? "method-post" : "method-delete";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${methodClass}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{endpoint.description}</span>
        <div className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground sm:hidden">{endpoint.description}</p>

              {endpoint.request && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">Request</h4>
                    <button onClick={() => copy(endpoint.request!, "req")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      {copied === "req" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === "req" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono text-foreground">{endpoint.request}</pre>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Response</h4>
                  <button onClick={() => copy(endpoint.response, "res")} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    {copied === "res" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === "res" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono text-foreground">{endpoint.response}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
