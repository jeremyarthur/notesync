import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PAGE_H, PAGE_W, renderInk } from "../lib/ink";
import type { Note } from "../lib/types";

const MIN_SCALE = 0.6;
const MAX_SCALE = 6;

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef({ dist: 0, scale: 1 });
  const drag = useRef({ x: 0, y: 0, moved: false });

  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ w: PAGE_W / 2, h: PAGE_H / 2 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .get<Note>(`/notes/${id}`)
      .then(setNote)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fit = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      const s = Math.min(clientWidth / PAGE_W, clientHeight / PAGE_H);
      setSize({ w: Math.round(PAGE_W * s), h: Math.round(PAGE_H * s) });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas || !note?.ink) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderInk(note.ink, ctx, size.w, size.h);
  }, [note, size]);

  const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { x: pan.x, y: pan.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) {
        setScale(clampScale((pinch.current.scale * dist) / pinch.current.dist));
      }
    } else if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      drag.current.moved = true;
      setPan({ x: drag.current.x + dx, y: drag.current.y + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const zoom = (factor: number) => setScale((s) => clampScale(s * factor));

  const share = async () => {
    const url = `${window.location.origin}/nota/${note!.id}`;
    const text = `Nota manuscrita: ${note!.title}`;
    setMessage("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setMessage("Enlace copiado. Pégalo en tu Atajo de Shortcuts (o en Recordatorios).");
      }
    } catch {
      /* el usuario cancelo el compartir */
    }
  };

  const remove = async () => {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    await api.delete(`/notes/${note!.id}`);
    navigate("/");
  };

  if (loading) {
    return <div className="flex h-dvh items-center justify-center text-slate-400">Cargando…</div>;
  }

  if (!note) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 text-slate-400">
        {error || "Nota no encontrada"}
        <Link to="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">
          ← Volver a las notas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Link
          to="/"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
        >
          ← Notas
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{note.title}</h1>
        <button
          onClick={() => zoom(0.8)}
          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
        >
          −
        </button>
        <button
          onClick={() => zoom(1.25)}
          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
        >
          +
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
        >
          ⛶
        </button>
        <button
          onClick={share}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          🔔 Añadir a iPhone
        </button>
        <button
          onClick={remove}
          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-red-500 hover:text-red-400"
        >
          ✕
        </button>
      </div>

      {message && (
        <p className="border-b border-slate-800 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden p-4"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: scale > 1 ? "grab" : "default" }}
      >
        <div
          ref={wrapperRef}
          className="absolute left-1/2 top-1/2"
          style={{
            width: size.w,
            height: size.h,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {note.ink ? (
            <canvas className="rounded-sm shadow-2xl" style={{ width: size.w, height: size.h }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-900 p-6 text-center text-slate-300">
              {note.body || note.title}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}