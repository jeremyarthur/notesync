import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ReminderInput from "../components/ReminderInput";
import { ERASER_RADIUS, PAGE_H, PAGE_W, eraseStrokes, renderInk } from "../lib/ink";
import type { InkData, InkStroke } from "../lib/types";

const COLORS = ["#1e293b", "#2563eb", "#dc2626", "#059669", "#b45309"];
const WIDTHS = [2, 4, 8];
const PRESSURE_FLOOR = 0.05;
const MAX_HISTORY = 100;

function clampPressure(p: number): number {
  const v = Math.min(1, Math.max(0, p));
  return v < PRESSURE_FLOOR ? PRESSURE_FLOOR : v;
}

export default function Editor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committed = useRef<InkStroke[]>([]);
  const current = useRef<InkStroke | null>(null);
  const drawing = useRef(false);
  const drawRaf = useRef(false);
  const eraserPath = useRef<[number, number, number][]>([]);
  const eraserTick = useRef(false);
  const history = useRef<InkStroke[][]>([]);

  const [size, setSize] = useState({ w: PAGE_W / 2, h: PAGE_H / 2 });
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [title, setTitle] = useState("");
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminder, setReminder] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<{ id: number; title: string; reminder_at: string | null; ink: InkData | null }>(
        `/notes/${id}`,
      )
      .then((note) => {
        setTitle(note.title);
        setReminder(note.reminder_at);
        history.current = [];
        setCanUndo(false);
        if (note.ink) {
          committed.current = note.ink.strokes;
          setStrokes(note.ink.strokes);
        }
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
      const scale = Math.min(clientWidth / PAGE_W, clientHeight / PAGE_H);
      setSize({ w: Math.round(PAGE_W * scale), h: Math.round(PAGE_H * scale) });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink: InkData = {
      version: 1,
      page: { w: PAGE_W, h: PAGE_H },
      strokes: [...committed.current, ...(current.current ? [current.current] : [])],
    };
    renderInk(ink, ctx, size.w, size.h);
  };

  useEffect(() => {
    redraw();
  });

  const scheduleDraw = () => {
    if (drawRaf.current) return;
    drawRaf.current = true;
    requestAnimationFrame(() => {
      drawRaf.current = false;
      redraw();
    });
  };

  const pushHistory = () => {
    if (history.current.length >= MAX_HISTORY) history.current.shift();
    history.current.push(committed.current.map((s) => ({ ...s, points: s.points.slice() })));
    setCanUndo(true);
  };

  const toLogical = (clientX: number, clientY: number, pressure: number): [number, number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      Math.round(((clientX - rect.left) / rect.width) * PAGE_W),
      Math.round(((clientY - rect.top) / rect.height) * PAGE_H),
      clampPressure(pressure),
    ];
  };

  const applyErase = () => {
    const path = eraserPath.current;
    if (path.length === 0) return;
    eraserPath.current = [];
    const next = eraseStrokes(committed.current, path, ERASER_RADIUS);
    committed.current = next;
    setStrokes(next);
    redraw();
  };

  const scheduleErase = () => {
    if (eraserTick.current) return;
    eraserTick.current = true;
    requestAnimationFrame(() => {
      eraserTick.current = false;
      applyErase();
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== "pen" && e.pointerType !== "mouse") return;
    e.preventDefault();
    try {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } catch {
      /* eventos sinteticos (ej. pruebas automatizadas) */
    }
    drawing.current = true;
    if (tool === "eraser") {
      pushHistory();
      eraserPath.current = [toLogical(e.clientX, e.clientY, 0.5)];
      scheduleErase();
    } else {
      current.current = {
        tool,
        color,
        width,
        points: [toLogical(e.clientX, e.clientY, e.pressure)],
      };
      scheduleDraw();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    if (tool === "eraser") {
      const native = e.nativeEvent as PointerEvent;
      const events =
        typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [e];
      for (const ev of events) {
        eraserPath.current.push(toLogical(ev.clientX, ev.clientY, 0.5));
      }
      scheduleErase();
      return;
    }
    const stroke = current.current!;
    const native = e.nativeEvent as PointerEvent;
    const events =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [e];
    for (const ev of events) {
      stroke.points.push(toLogical(ev.clientX, ev.clientY, ev.pressure));
    }
    scheduleDraw();
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === "eraser") {
      applyErase();
    } else if (current.current && current.current.points.length >= 2) {
      pushHistory();
      const next = [...committed.current, current.current];
      committed.current = next;
      setStrokes(next);
    }
    current.current = null;
    redraw();
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    committed.current = prev;
    setStrokes(prev);
    setCanUndo(history.current.length > 0);
    redraw();
  };

  const clear = () => {
    pushHistory();
    committed.current = [];
    current.current = null;
    eraserPath.current = [];
    setStrokes([]);
    redraw();
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const ink: InkData = {
      version: 1,
      page: { w: PAGE_W, h: PAGE_H },
      strokes: committed.current,
    };
    const finalTitle = title.trim() || "Nota manuscrita";
    try {
      if (id) {
        await api.patch(`/notes/${id}`, { title: finalTitle, ink, reminder_at: reminder });
      } else {
        await api.post("/notes", {
          title: finalTitle,
          source: "samsung",
          ink,
          reminder_at: reminder,
        });
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-400">
        Cargando nota…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-950">
      {/* Barra superior */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Link
          to="/"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500"
        >
          ← Notas
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          disabled={saving}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {error && (
        <p className="border-b border-slate-800 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Recordatorio opcional */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="shrink-0 text-sm text-slate-400">🔔 Recordatorio</span>
        <ReminderInput value={reminder} onChange={setReminder} />
      </div>

      {/* Lienzo */}
      <div ref={containerRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="touch-none rounded-sm shadow-2xl"
          style={{ width: size.w, height: size.h, cursor: tool === "eraser" ? "cell" : "crosshair" }}
        />
      </div>

      {/* Barra inferior de herramientas */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-3 py-2">
        <button
          onClick={() => {
            setTool("pen");
            setColor(COLORS[0]);
          }}
          className={`rounded-lg px-3 py-1.5 text-sm ${tool === "pen" ? "bg-indigo-500 text-white" : "border border-slate-700 text-slate-300"}`}
        >
          ✍️ Lápiz
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`rounded-lg px-3 py-1.5 text-sm ${tool === "eraser" ? "bg-indigo-500 text-white" : "border border-slate-700 text-slate-300"}`}
        >
          🧽 Goma
        </button>

        <span className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setTool("pen");
                setColor(c);
              }}
              aria-label={`Color ${c}`}
              className={`h-7 w-7 rounded-full border-2 ${tool === "pen" && color === c ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setTool("pen");
                setWidth(w);
              }}
              aria-label={`Grosor ${w}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tool === "pen" && width === w ? "border-indigo-400 bg-indigo-500/20" : "border-slate-700"}`}
            >
              <span className="rounded-full bg-slate-200" style={{ width: w * 2, height: w * 2 }} />
            </button>
          ))}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500 disabled:opacity-40"
        >
          ↩️ Deshacer
        </button>
        <button
          onClick={clear}
          disabled={strokes.length === 0}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-red-500 hover:text-red-400 disabled:opacity-40"
        >
          🗑️ Borrar todo
        </button>
      </div>
    </div>
  );
}