import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, RotateCcw, ChevronDown, ChevronRight, BookOpen, Brain, Sparkles, User, Plus, Clock, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatMessage, listSessions, deleteSession as apiDeleteSession } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Source {
  document: string;
  page: number;
  chunk: string;
}

interface ReasoningStep {
  type: "thought" | "action" | "observation";
  content: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  reasoning?: ReasoningStep[];
  retrievalUsed?: boolean;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  sessionId: string;
}

function formatRelativeDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      const mapped: ChatSession[] = (data.sessions || []).map((s: any) => ({
        id: s.session_id,
        sessionId: s.session_id,
        title: s.title || "Untitled",
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
        messages: (s.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || [],
          reasoning: (m.reasoning || []).map((r: any) => ({
            type: r.type || "thought",
            content: r.content || r.thought || r.action || r.observation || r.conclusion || "",
          })),
          retrievalUsed: m.retrieval_used ?? false,
          timestamp: new Date(m.timestamp),
        })),
      }));
      setSessions(mapped);
    } catch {
      // backend may not be running
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const startNewSession = () => {
    setActiveSessionId(null);
    setBackendSessionId(null);
    setMessages([]);
  };

  const selectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setBackendSessionId(session.sessionId);
    setMessages(session.messages);
  };

  const deleteSessionHandler = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await apiDeleteSession(sessionId);
    } catch { /* ignore */ }
    setSessions((s) => s.filter((sess) => sess.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setBackendSessionId(null);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const currentInput = input;
    setInput("");
    setIsTyping(true);

    try {
      const resp = await chatMessage(currentInput, backendSessionId);

      // Update backend session id
      const newBackendSessionId = resp.session_id;
      setBackendSessionId(newBackendSessionId);

      // Map reasoning trace
      const reasoning: ReasoningStep[] = (resp.reasoning_trace || []).map((r: any) => ({
        type: r.type || "thought",
        content: r.content || r.thought || r.action || r.observation || r.conclusion || "",
      }));

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: resp.answer,
        sources: resp.sources || [],
        reasoning,
        retrievalUsed: resp.retrieval_used ?? false,
        timestamp: new Date(),
      };
      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);

      // If new session, add to sidebar
      if (!activeSessionId) {
        const newSession: ChatSession = {
          id: newBackendSessionId,
          sessionId: newBackendSessionId,
          title: currentInput.length > 40 ? currentInput.slice(0, 40) + "..." : currentInput,
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setSessions((s) => [newSession, ...s]);
        setActiveSessionId(newBackendSessionId);
      } else {
        // Update existing session messages
        setSessions((s) =>
          s.map((sess) =>
            sess.id === activeSessionId
              ? { ...sess, messages: updatedMessages, updatedAt: new Date() }
              : sess
          )
        );
      }
    } catch (err: any) {
      // On error, show error as assistant message
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${err.message || "Failed to get response. Make sure the backend is running."}`,
        timestamp: new Date(),
      };
      setMessages([...newMessages, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Chat History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-border bg-card/30 flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Chat History</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startNewSession}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {sessions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No chat history</p>
                </div>
              )}
              {sessions.map((session) => (
                <motion.button
                  key={session.id}
                  layout
                  onClick={() => selectSession(session)}
                  className={`w-full text-left px-3 py-2.5 mx-1 rounded-lg transition-all duration-150 group flex items-start gap-2.5 ${activeSessionId === session.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                    }`}
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${activeSessionId === session.id ? "text-primary" : "text-muted-foreground"
                    }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${activeSessionId === session.id ? "text-foreground" : "text-foreground/80"
                      }`}>
                      {session.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeDate(session.updatedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · {session.messages.length} msgs
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteSessionHandler(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {activeSession ? activeSession.title : "New Chat"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {activeSession
                  ? `Session · ${activeSession.messages.length} messages`
                  : "Start a new conversation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startNewSession}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setMessages([]); setActiveSessionId(null); }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-4 animate-pulse-glow">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Ask anything</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                The agent will decide whether to retrieve from your documents, use its internal knowledge, or combine both.
              </p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.role === "user" ? (
                  <UserMessage content={msg.content} />
                ) : (
                  <AssistantMessage message={msg} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="glass-card rounded-xl px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-border bg-card/30">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask a question about your documents..."
              className="flex-1 h-11 px-4 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isTyping} size="icon" className="h-11 w-11 rounded-xl gradient-bg hover:opacity-90">
              <Send className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-4 py-3 max-w-lg">
        <p className="text-sm">{content}</p>
      </div>
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: Message }) {
  const [showSources, setShowSources] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="space-y-2 max-w-2xl">
        <div className="glass-card rounded-xl rounded-tl-sm px-4 py-3 relative group/msg">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <div className="overflow-x-auto my-3 rounded-lg border border-border">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted/60">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left text-xs font-semibold text-foreground border-b border-border">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 text-xs text-muted-foreground border-b border-border/50">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
              ),
              h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
              p: ({ children }) => <p className="text-sm text-foreground leading-relaxed my-1.5">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 text-sm text-foreground">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-sm text-foreground">{children}</ol>,
              li: ({ children }) => <li className="text-sm text-foreground leading-relaxed">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/50 pl-3 my-2 text-sm text-muted-foreground italic">{children}</blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <pre className="bg-muted/30 rounded-lg p-3 my-2 overflow-x-auto">
                    <code className="text-xs text-foreground font-mono">{children}</code>
                  </pre>
                ) : (
                  <code className="text-primary bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                );
              },
              hr: () => <hr className="border-border my-3" />,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{children}</a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>

          <button
            onClick={handleCopy}
            className={`absolute top-2 right-2 p-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm opacity-0 group-hover/msg:opacity-100 transition-all duration-200 hover:bg-muted ${copied ? "text-success border-success/30 shadow-[0_0_10px_rgba(var(--success),0.2)]" : "text-muted-foreground"}`}
            title="Copy response"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {message.retrievalUsed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">RAG Used</span>
          )}
          {message.retrievalUsed === false && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/15 text-info font-medium">Direct LLM</span>
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSources ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <BookOpen className="w-3.5 h-3.5" />
            {message.sources.length} source{message.sources.length > 1 ? "s" : ""}
          </button>
        )}
        <AnimatePresence>
          {showSources && message.sources && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {message.sources.map((src, i) => (
                <div key={i} className="glass-card rounded-lg px-3 py-2 neon-border">
                  <p className="text-xs font-medium text-foreground">{src.document} — Page {src.page}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">"{src.chunk}"</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {message.reasoning && message.reasoning.length > 0 && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showReasoning ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Brain className="w-3.5 h-3.5" />
            Reasoning trace
          </button>
        )}
        <AnimatePresence>
          {showReasoning && message.reasoning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden pl-2 border-l-2 border-primary/30"
            >
              {message.reasoning.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${step.type === "thought" ? "bg-warning/15 text-warning" :
                      step.type === "action" ? "bg-info/15 text-info" :
                        "bg-success/15 text-success"
                    }`}>
                    {step.type}
                  </span>
                  <p className="text-xs text-muted-foreground">{step.content}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
