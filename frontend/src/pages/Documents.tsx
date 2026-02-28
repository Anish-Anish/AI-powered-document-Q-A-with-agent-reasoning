import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Trash2, X, CheckCircle, File, Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { uploadDocument, listDocuments, deleteDocument, clearAll } from "@/lib/api";

interface Doc {
  id: string;
  name: string;
  type: string;
  size: string;
  chunks: number;
  uploadedAt: string;
}

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const data = await listDocuments();
      setDocs(
        (data.documents || []).map((d: any) => ({
          id: d.id,
          name: d.filename,
          type: d.file_type,
          size: d.file_size,
          chunks: d.chunks_count,
          uploadedAt: d.uploaded_at,
        }))
      );
    } catch {
      // backend may not be running yet — keep empty
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) doUpload(file);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) doUpload(e.target.files[0]);
  };

  const doUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    // Simulate progress bar while actual upload happens
    const interval = setInterval(() => {
      setUploadProgress((p) => (p >= 90 ? 90 : p + 5));
    }, 100);
    try {
      await uploadDocument(file);
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        fetchDocs();
      }, 400);
    } catch (err: any) {
      clearInterval(interval);
      setUploading(false);
      setUploadProgress(0);
      alert(err.message || "Upload failed");
    }
  };

  const getLoadingMessage = () => {
    if (uploadProgress < 30) return "Grab a cup of coffee, we are uploading the document...";
    if (uploadProgress < 70) return "Our application is loading your PDF fastly until you finish your coffee...";
    if (uploadProgress < 95) return "Wait, you finished your coffee already? Maybe grab one more!";
    return "Almost there, finishing up!";
  };

  const handleDelete = async () => {
    if (deleteDoc) {
      try {
        await deleteDocument(deleteDoc.id);
        setDocs((d) => d.filter((doc) => doc.id !== deleteDoc.id));
      } catch {
        // ignore
      }
      setDeleteDoc(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll();
      setDocs([]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your knowledge base</p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
        >
          <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileInput} />
          {uploading ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-md px-8 text-center">
              <div className="relative">
                <Coffee className="w-10 h-10 text-primary animate-bounce" />
                <Loader2 className="w-14 h-14 text-primary/20 animate-spin absolute -top-2 -left-2" />
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full gradient-bg rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                  style={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{getLoadingMessage()}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  {uploadProgress}% Uploaded
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT — Max 50MB</p>
            </>
          )}
        </label>
      </motion.div>

      {/* Documents Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Uploaded Documents ({docs.length})</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear All
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">File</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Size</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Chunks</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Uploaded</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {docs.map((doc, i) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <File className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{doc.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">{doc.type}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{doc.size}</td>
                    <td className="px-6 py-4 text-sm text-foreground font-medium">{doc.chunks}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{doc.uploadedAt}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDoc(doc)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          <AnimatePresence>
            {docs.map((doc) => (
              <motion.div key={doc.id} layout exit={{ opacity: 0 }} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.chunks} chunks · {doc.size}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDeleteDoc(doc)} className="text-destructive shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {docs.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        )}
      </motion.div>

      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDoc?.name}</strong>? This will remove all associated chunks from the vector database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
