/** Renderizador compartido de tinta: editor, miniaturas y visor usan la misma funcion. */

import type { InkData, InkStroke } from "./types";

export const PAGE_W = 1414;
export const PAGE_H = 2000;

export function emptyInk(): InkData {
  return { version: 1, page: { w: PAGE_W, h: PAGE_H }, strokes: [] };
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