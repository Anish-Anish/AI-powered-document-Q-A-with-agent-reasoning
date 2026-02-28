import { useState, useEffect } from "react";
import { FileText, MessageSquare, Activity, Zap } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { getDashboardStats } from "@/lib/api";

interface ActivityItem {
  action: string;
  detail: string;
  time: string;
}

export default function Dashboard() {
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalQueries, setTotalQueries] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [avgResponse, setAvgResponse] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [distribution, setDistribution] = useState([
    { label: "Document Search (RAG)", pct: 0, color: "bg-primary" },
    { label: "Direct LLM", pct: 0, color: "bg-info" },
    { label: "Combined", pct: 0, color: "bg-neon" },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboardStats();
        const s = data.stats || {};
        setTotalDocs(s.total_documents || 0);
        setTotalQueries(s.total_queries || 0);
        setActiveSessions(s.active_sessions || 0);
        setAvgResponse(s.avg_response_time || 0);
        setRecentActivity(
          (data.recent_activity || []).map((a: any) => ({
            action: a.action,
            detail: a.detail,
            time: a.time,
          }))
        );
        const dist = data.agent_distribution || {};
        setDistribution([
          { label: "Document Search (RAG)", pct: dist.document_search || 0, color: "bg-primary" },
          { label: "Direct LLM", pct: dist.direct_llm || 0, color: "bg-info" },
          { label: "Combined", pct: dist.combined || 0, color: "bg-neon" },
        ]);
      } catch {
        // backend may not be running
      }
    })();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Agentic RAG system</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Documents" value={totalDocs} icon={FileText} delay={0} color="primary" />
        <StatCard title="Total Queries" value={totalQueries} icon={MessageSquare} delay={100} color="info" />
        <StatCard title="Active Sessions" value={activeSessions} icon={Activity} delay={200} color="success" />
        <StatCard title="Avg Response" value={avgResponse} icon={Zap} delay={300} suffix="s" color="warning" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
            View All
          </Button>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.length === 0 && (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">No activity yet</div>
          )}
          {recentActivity.slice(0, 7).map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{item.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Agent Decision Distribution</h2>
        <div className="flex gap-4 flex-wrap">
          {distribution.map((item) => (
            <div key={item.label} className="flex-1 min-w-[180px]">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground">{item.pct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${item.color} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 1, delay: 0.8 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
