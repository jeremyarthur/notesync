import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ReminderInput from "../components/ReminderInput";
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
  const [reminder, setReminder] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState(false);

  useEffect(() => {
    if (!id) return;
    setReminder(null);
    setEditingReminder(false);
    api
      .get<Note>(`/notes/${id}`)
      .then((n) => {
        setNote(n);
        setReminder(n.reminder_at);
      })
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

  const saveReminder = async (value: string | null) => {
    if (!note || savingReminder) return;
    setSavingReminder(true);
    setMessage("");
    try {
      await api.patch(`/notes/${note.id}`, { reminder_at: value });
      setReminder(value);
      setEditingReminder(false);
      setMessage(value ? "Recordatorio guardado" : "Recordatorio eliminado");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar el recordatorio");
    } finally {
      setSavingReminder(false);
    }
  };

  if (loading) {
    return <div className="flex h-dvh items-center justify-center text-slate-400">Cargando…</div>;
  }

  if (!note) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 text-slate-400">
        {error || "Nota no encontrada"}
        <Link to="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mr-1 inline h-4 w-4"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a las notas
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mr-1 inline h-4 w-4"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Notas
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
          title="Restablecer zoom"
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:border-indigo-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M11 3H5a2 2 0 00-2 2v6M13 21h6a2 2 0 002-2v-6M21 11V5a2 2 0 00-2-2h-6M3 13v6a2 2 0 002 2h6" />
          </svg>
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Añadir a iPhone
        </button>
        <button
          onClick={remove}
          aria-label="Eliminar nota"
          title="Eliminar nota"
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Recordatorio */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        {reminder ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-indigo-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              {new Date(reminder).toLocaleString("es-DO", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={() => setEditingReminder(true)}
              disabled={savingReminder}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-indigo-500 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
              Editar
            </button>
            <button
              onClick={() => saveReminder(null)}
              disabled={savingReminder}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-red-500 hover:text-red-400 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Quitar
            </button>
          </>
        ) : null}
        {!reminder && !editingReminder && (
          <button
            onClick={() => setEditingReminder(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            Fijar recordatorio
          </button>
        )}
        {editingReminder && (
          <div className="flex-1">
            <ReminderInput value={reminder} onChange={saveReminder} />
            <p className="mt-1 text-[11px] text-slate-500">
              Se guarda al elegir la fecha. Alcanzará la app de Recordatorios y el WebCal.
            </p>
          </div>
        )}
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