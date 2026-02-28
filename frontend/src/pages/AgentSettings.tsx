import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, RotateCcw, Info, Sliders, Zap, Layers, Loader2, Check, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings } from "@/lib/api";

interface AvailableModel {
    id: string;
    name: string;
    context: number;
}

interface SettingsSnapshot {
    llm_model: string;
    chunk_size: number;
    chunk_overlap: number;
    temperature: number;
}

export default function AgentSettings() {
    const [llmModel, setLlmModel] = useState("llama-3.1-8b-instant");
    const [chunkSize, setChunkSize] = useState([500]);
    const [chunkOverlap, setChunkOverlap] = useState([50]);
    const [temperature, setTemperature] = useState([0.1]);
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const savedSnapshot = useRef<SettingsSnapshot>({
        llm_model: "llama-3.1-8b-instant",
        chunk_size: 500,
        chunk_overlap: 50,
        temperature: 0.1,
    });

    const isDirty =
        llmModel !== savedSnapshot.current.llm_model ||
        chunkSize[0] !== savedSnapshot.current.chunk_size ||
        chunkOverlap[0] !== savedSnapshot.current.chunk_overlap ||
        Math.abs(temperature[0] - savedSnapshot.current.temperature) > 0.001;

    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    // Warn on browser tab close / refresh
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirtyRef.current) e.preventDefault();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // Warn on in-app navigation via click interception
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!isDirtyRef.current) return;
            const anchor = (e.target as HTMLElement).closest("a");
            if (anchor && anchor.href && anchor.href.startsWith(window.location.origin)) {
                const confirmed = window.confirm("You have unsaved settings. Leave without saving?");
                if (!confirmed) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, []);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            setLoading(true);
            const data = await getSettings();
            const s = data.settings;
            setLlmModel(s.llm_model);
            setChunkSize([s.chunk_size]);
            setChunkOverlap([s.chunk_overlap]);
            setTemperature([s.temperature]);
            setAvailableModels(data.available_models);
            savedSnapshot.current = {
                llm_model: s.llm_model,
                chunk_size: s.chunk_size,
                chunk_overlap: s.chunk_overlap,
                temperature: s.temperature,
            };
        } catch {
            setError("Failed to load settings from backend");
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            await updateSettings({
                llm_model: llmModel,
                chunk_size: chunkSize[0],
                chunk_overlap: chunkOverlap[0],
                temperature: temperature[0],
            });
            savedSnapshot.current = {
                llm_model: llmModel,
                chunk_size: chunkSize[0],
                chunk_overlap: chunkOverlap[0],
                temperature: temperature[0],
            };
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            setError(e.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        setLlmModel(savedSnapshot.current.llm_model);
        setChunkSize([savedSnapshot.current.chunk_size]);
        setChunkOverlap([savedSnapshot.current.chunk_overlap]);
        setTemperature([savedSnapshot.current.temperature]);
    }

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-4xl mx-auto flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading configuration...
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Groq Agent Config</h1>
                    <p className="text-muted-foreground mt-1">Optimize your agent for ultra-low latency Groq inference</p>
                </div>
                <div className="flex gap-2">
                    {isDirty && (
                        <Button variant="outline" onClick={handleReset} className="gap-2">
                            <RotateCcw className="w-4 h-4" /> Discard
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={saving || (!isDirty && !saved)}
                        className={`gap-2 ${isDirty ? "bg-warning text-warning-foreground hover:bg-warning/90 animate-pulse" : "gradient-bg hover:opacity-90"}`}
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : saved ? (
                            <><Check className="w-4 h-4" /> Saved!</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Preferences</>
                        )}
                    </Button>
                </div>
            </motion.div>

            {/* Unsaved warning */}
            <AnimatePresence>
                {isDirty && !saving && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                            <p className="text-xs text-warning">
                                You have unsaved changes. Click <strong>"Save Preferences"</strong> to apply them to the backend.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {saved && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs">
                            Settings saved! Changes will take effect on the next query or document upload.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-xs">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Model & RAG */}
                <div className="md:col-span-2 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card rounded-xl p-6 space-y-6"
                    >
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Zap className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-foreground">Groq Inference Engine</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="model-select">Select Groq Model</Label>
                                <Select value={llmModel} onValueChange={setLlmModel}>
                                    <SelectTrigger id="model-select" className="bg-background/50">
                                        <SelectValue placeholder="Select Groq model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    Context window: {availableModels.find((m) => m.id === llmModel)?.context?.toLocaleString() || "—"} tokens
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card rounded-xl p-6 space-y-6"
                    >
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Layers className="w-5 h-5 text-info" />
                            <h2 className="font-semibold text-foreground">Retrieval Settings (RAG)</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-2">
                            {/* Chunk Size */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <Label>Chunk Size</Label>
                                    <span className="font-mono text-info font-bold">{chunkSize[0]} chars</span>
                                </div>
                                <Slider
                                    value={chunkSize}
                                    onValueChange={(v) => {
                                        setChunkSize(v);
                                        if (chunkOverlap[0] >= v[0]) setChunkOverlap([Math.max(0, v[0] - 50)]);
                                    }}
                                    min={100}
                                    max={4000}
                                    step={50}
                                    className="cursor-pointer"
                                />
                                <p className="text-[10px] text-muted-foreground">Size of each text chunk when splitting documents.</p>
                            </div>

                            {/* Chunk Overlap */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <Label>Chunk Overlap</Label>
                                    <span className="font-mono text-primary font-bold">{chunkOverlap[0]} chars</span>
                                </div>
                                <Slider
                                    value={chunkOverlap}
                                    onValueChange={setChunkOverlap}
                                    min={0}
                                    max={Math.min(500, chunkSize[0] - 50)}
                                    step={10}
                                    className="cursor-pointer"
                                />
                                <p className="text-[10px] text-muted-foreground">Characters overlapping between chunks to maintain context continuity.</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: Parameters */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card rounded-xl p-6 space-y-8"
                    >
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Sliders className="w-5 h-5 text-neon" />
                            <h2 className="font-semibold text-foreground">Groq Parameters</h2>
                        </div>

                        {/* Temperature */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <Label>Temperature</Label>
                                <span className="font-mono text-neon font-bold">{temperature[0].toFixed(2)}</span>
                            </div>
                            <Slider
                                value={temperature}
                                onValueChange={setTemperature}
                                min={0}
                                max={2}
                                step={0.05}
                                className="cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-medium">
                                <span>Deterministic</span>
                                <span>Creative</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2"
                    >
                        <h3 className="text-xs font-bold uppercase text-primary flex items-center gap-1">
                            <Info className="w-3 h-3" /> How It Works
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Changes take effect on the <strong>next query or upload</strong>. Model & temperature apply to LLM calls. Chunk size & overlap apply when processing new documents.
                        </p>
                    </motion.div>

                    {llmModel && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="p-4 rounded-xl bg-neon/5 border border-neon/20 space-y-2"
                        >
                            <h3 className="text-xs font-bold uppercase text-neon">Active Model</h3>
                            <p className="text-sm font-mono text-foreground">{availableModels.find((m) => m.id === llmModel)?.name || llmModel}</p>
                            <p className="text-[10px] text-muted-foreground">
                                {availableModels.find((m) => m.id === llmModel)?.context?.toLocaleString() || "—"} token context window
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
