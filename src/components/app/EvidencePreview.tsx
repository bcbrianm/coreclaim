import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET } from "@/lib/evidence";

export function EvidencePreview({ path, label, className }: { path: string | null | undefined; label?: string; className?: string }) {
  const q = useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!path) return <div className={`flex h-28 items-center justify-center rounded border border-dashed text-xs text-muted-foreground ${className ?? ""}`}>{label ? `No ${label}` : "No file"}</div>;
  if (q.isError) return <div className="text-xs text-destructive">Couldn't load file</div>;
  if (!q.data) return <div className={`h-28 animate-pulse rounded bg-muted ${className ?? ""}`} />;
  if (path.toLowerCase().endsWith(".pdf")) return (
    <div className={className}>
      <iframe src={q.data} title={label ?? "PDF"} className="h-64 w-full rounded border bg-white" />
      <a href={q.data} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline"><FileText className="h-4 w-4" />Open PDF</a>
    </div>
  );
  return <a href={q.data} target="_blank" rel="noreferrer"><img src={q.data} alt={label ?? "Evidence"} className={`max-h-64 rounded border object-contain ${className ?? ""}`} /></a>;
}
