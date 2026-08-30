import { useEffect, useRef } from "react";
import { PAGE_H, PAGE_W, renderInk } from "../lib/ink";
import type { InkData } from "../lib/types";

export default function InkMini({ ink }: { ink: InkData }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.clientWidth;
      if (w === 0) return;
      const h = Math.round((w * PAGE_H) / PAGE_W);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderInk(ink, ctx, w, h);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [ink]);

  return (
    <canvas
      ref={ref}
      className="h-auto w-full"
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
    />
  );
}