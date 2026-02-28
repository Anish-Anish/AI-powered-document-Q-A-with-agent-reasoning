import { motion } from "framer-motion";
import { Brain, MessageSquare, CheckCircle, ArrowDown, Lightbulb, Zap, Eye } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    label: "User Query",
    description: "Natural language question received from user",
    color: "bg-info/15 text-info",
    example: '"What is transformer architecture?"',
  },
  {
    icon: Lightbulb,
    label: "Thought",
    description: "Agent analyzes query and decides retrieval strategy",
    color: "bg-warning/15 text-warning",
    example: "I should check uploaded documents for relevant information about transformers.",
  },
  {
    icon: Zap,
    label: "Action",
    description: "Agent invokes tools: document_search, direct_llm, or both",
    color: "bg-primary/15 text-primary",
    example: 'document_search("transformer architecture self-attention")',
  },
  {
    icon: Eye,
    label: "Observation",
    description: "Agent evaluates tool results and retrieved chunks",
    color: "bg-success/15 text-success",
    example: "Found 3 relevant chunks with similarity scores > 0.85",
  },
  {
    icon: CheckCircle,
    label: "Conclusion",
    description: "Agent synthesizes final answer with citations",
    color: "bg-neon/15 text-neon",
    example: "Generated answer with 2 source citations from research_paper.pdf",
  },
];

const tools = [
  { name: "document_search", desc: "Query vector DB for relevant document chunks", badge: "Required" },
  { name: "direct_llm", desc: "Answer using LLM's internal knowledge", badge: "Required" },
  { name: "calculator", desc: "Math operations for quantitative queries", badge: "Optional" },
];

export default function AgentVisualizer() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Agent Decision Visualizer</h1>
        <p className="text-muted-foreground mt-1">How the ReAct agent processes queries step by step</p>
      </motion.div>

      {/* Flow */}
      <div className="space-y-0">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12 }}
          >
            <div className="glass-card rounded-xl p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${step.color}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Step {i + 1}</span>
                  <h3 className="text-sm font-semibold text-foreground">{step.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                <div className="mt-2 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono">
                  {step.example}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Agent Tools */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Agent Tools
          </h2>
        </div>
        <div className="divide-y divide-border">
          {tools.map((tool, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div>
                <code className="text-sm font-mono text-foreground">{tool.name}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                tool.badge === "Required" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {tool.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
