"use client";

import { useEffect, useRef, useState } from "react";

import { secondaryBtnClass } from "@/components/clinica/ui";

export default function SignaturePad({ value, onChange, height = 160 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasStroke(true);
      };
      img.src = value;
    }
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps -- redraw on size only; value applied once on mount

  function pointFromEvent(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top,
    };
  }

  function start(event) {
    event.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event) {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFromEvent(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onChange?.(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, height);
    setHasStroke(false);
    onChange?.("");
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none"
          style={{ height }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          {hasStroke ? "Firma capturada" : "Dibujá la firma con el mouse o el dedo"}
        </p>
        <button type="button" className={secondaryBtnClass} onClick={clear}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
