"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import api, { parseApiError } from "@/lib/api";

/**
 * Phase-3 — barber portfolio editor on the CRM.
 *
 * Mirrors partner-mobile's portfolio_edit_page: GET /me/portfolio
 * renders a 4-column grid; a hidden file input + "Add photo" button
 * runs the two-step upload (POST /media/upload returns a URL, then
 * POST /me/portfolio with that URL + decoded w/h); hovering a tile
 * shows a delete overlay.
 *
 * No spec-tagging UI yet (schema accepts optional spec_id — next PR
 * adds a SpecializationPicker modal from inside the card).
 */
interface Photo {
  id: string;
  url: string;
  w: number;
  h: number;
  spec_id: string | null;
}

interface MediaUploadResult {
  url: string;
  kind: string;
  size_bytes: number;
}

async function decodeImageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1024, h: 1024 });
    img.src = URL.createObjectURL(file);
  });
}

export default function PortfolioPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/me/portfolio").then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("kind", "photo");
      form.append("file", file);
      const uploaded: MediaUploadResult = (
        await api.post("/media/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
      const { w, h } = await decodeImageSize(file);
      return (
        await api.post("/me/portfolio", { url: uploaded.url, w, h })
      ).data as Photo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setErr("");
    },
    onError: (e) => setErr(parseApiError(e, "Upload failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/me/portfolio/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <h1 style={{
          fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700,
          color: "var(--text)",
        }}>
          Portfolio
        </h1>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--gold)", color: "#0a0a0b", border: "none",
            borderRadius: 10, padding: "10px 16px", fontSize: 14,
            fontWeight: 700, fontFamily: "'Manrope',sans-serif",
            cursor: uploadMutation.isPending ? "default" : "pointer",
            opacity: uploadMutation.isPending ? 0.6 : 1,
          }}
        >
          <Plus size={16} />
          Add photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = "";
          }}
        />
      </div>
      {err && (
        <div style={{
          marginBottom: 16, padding: "8px 12px",
          background: "rgba(224,90,90,0.1)", border: "1px solid rgba(224,90,90,0.3)",
          borderRadius: 8, color: "var(--red)", fontSize: 13,
          fontFamily: "'Manrope',sans-serif",
        }}>
          {err}
        </div>
      )}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text2)" }}>
          Loading…
        </div>
      ) : !photos || photos.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, color: "var(--text2)",
          fontFamily: "'Manrope',sans-serif", fontSize: 14,
        }}>
          No photos yet — click "Add photo" to upload your first one.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}>
          {photos.map((p) => (
            <PortfolioTile
              key={p.id}
              photo={p}
              onDelete={() => deleteMutation.mutate(p.id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioTile({
  photo, onDelete, deleting,
}: { photo: Photo; onDelete: () => void; deleting: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirming(false);
      }}
      style={{
        position: "relative", aspectRatio: 1, borderRadius: 14,
        overflow: "hidden", background: "var(--surface)",
      }}
    >
      <img
        src={photo.url}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {hovered && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {confirming ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { onDelete(); setConfirming(false); }}
                disabled={deleting}
                style={{
                  padding: "6px 14px", background: "var(--red)", color: "#fff",
                  border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "'Manrope',sans-serif",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirming(false)}
                style={{
                  padding: "6px 14px", background: "rgba(255,255,255,0.9)",
                  color: "#000", border: "none", borderRadius: 8,
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                  fontFamily: "'Manrope',sans-serif",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              style={{
                padding: "8px", background: "rgba(255,255,255,0.9)",
                color: "#000", border: "none", borderRadius: 999,
                cursor: "pointer",
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
