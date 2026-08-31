/** Renderizador compartido de tinta: editor, miniaturas y visor usan la misma funcion. */

import type { InkData, InkStroke } from "./types";

export const PAGE_W = 1414;
export const PAGE_H = 2000;

/** Radio de la goma en unidades logicas de pagina. */
export const ERASER_RADIUS = 32;

export function emptyInk(): InkData {
  return { version: 1, page: { w: PAGE_W, h: PAGE_H }, strokes: [] };
}

function distSqToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ox = px - ax;
    const oy = py - ay;
    return ox * ox + oy * oy;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const ox = px - (ax + t * dx);
  const oy = py - (ay + t * dy);
  return ox * ox + oy * oy;
}

function pointNearPath(
  p: [number, number, number],
  path: [number, number, number][],
  r2: number
): boolean {
  if (path.length === 0) return false;
  const [px, py] = p;
  if (path.length === 1) {
    const dx = px - path[0][0];
    const dy = py - path[0][1];
    return dx * dx + dy * dy <= r2;
  }
  for (let i = 1; i < path.length; i++) {
    if (distSqToSegment(px, py, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]) <= r2) {
      return true;
    }
  }
  return false;
}

/**
 * Goma vectorial: elimina puntos de tinta cuyo trazo pasa a <radius de la
 * polilinea de la goma. Si borra en medio de un trazo, lo divide en dos.
 * Nunca toca el papel: la tinta se acaba, el fondo se conserva.
 */
export function eraseStrokes(
  strokes: InkStroke[],
  path: [number, number, number][],
  radius: number = ERASER_RADIUS
): InkStroke[] {
  if (path.length === 0) return strokes;
  const r2 = radius * radius;
  const out: InkStroke[] = [];
  for (const s of strokes) {
    let run: [number, number, number][] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ ...s, points: run });
      run = [];
    };
    for (const pt of s.points) {
      if (pointNearPath(pt, path, r2)) flush();
      else run.push(pt);
    }
    flush();
  }
  return out;
}

function pressureWidth(stroke: InkStroke, pressure: number): number {
  const factor = 0.55 + pressure * 0.45;
  return stroke.width * factor;
}

/** Dibuja la pagina (papel + pautado) y todos los trazos en el contexto dado. */
export function renderInk(
  ink: InkData,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const sx = width / ink.page.w;
  const sy = height / ink.page.h;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // papel
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  // pautado
  ctx.strokeStyle = "rgba(100,116,139,0.20)";
  ctx.lineWidth = 1;
  const gap = 64 * sy;
  ctx.beginPath();
  for (let y = gap; y < height; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(37,99,235,0.25)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, height);
  ctx.stroke();

  for (const stroke of ink.strokes) {
    if (stroke.points.length < 2) continue;
    const pts = stroke.points;
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let [x, y, p] = pts[0];
    ctx.lineWidth = pressureWidth(stroke, p);
    ctx.beginPath();
    ctx.moveTo(x * sx, y * sy);
    for (let i = 1; i < pts.length; i++) {
      [x, y, p] = pts[i];
      ctx.lineWidth = pressureWidth(stroke, p);
      ctx.lineTo(x * sx, y * sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x * sx, y * sy);
    }
    ctx.stroke();
  }
  ctx.restore();
}