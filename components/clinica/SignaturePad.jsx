"use client";

import { useEffect, useId, useRef, useState } from "react";

import { secondaryBtnClass } from "@/components/clinica/ui";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export default function SignaturePad({ value, onChange, height = 160 }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));
  const [uploadError, setUploadError] = useState("");
  const inputId = useId();

  function setupCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    return { canvas, ctx, width };
  }

  function paintImage(src) {
    const setup = setupCanvas();
    if (!setup) return;
    const { ctx, width } = setup;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(width / img.width, height / img.height, 1);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      setHasStroke(true);
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onChange?.(dataUrl);
    };
    img.onerror = () => {
      setUploadError("No se pudo leer la imagen de la firma.");
    };
    img.src = src;
  }

  useEffect(() => {
    const setup = setupCanvas();
    if (!setup) return;
    if (value) {
      const img = new Image();
      img.onload = () => {
        const { ctx, width } = setup;
        const scale = Math.min(width / img.width, height / img.height, 1);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (width - dw) / 2;
        const dy = (height - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        setHasStroke(true);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw on size only; value applied once on mount
  }, [height]);

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
    setupCanvas();
    setHasStroke(false);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange?.("");
  }

  function handleFileChange(event) {
    setUploadError("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!PHOTO_TYPES.has(file.type)) {
      setUploadError("La firma tiene que ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError("La imagen no puede superar 2 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setUploadError("No se pudo leer el archivo.");
        return;
      }
      paintImage(result);
    };
    reader.onerror = () => {
      setUploadError("No se pudo leer el archivo.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          {hasStroke
            ? "Firma lista (dibujada o subida)"
            : "Dibujá la firma o subí una imagen PNG/JPG/WebP"}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor={inputId} className={`${secondaryBtnClass} cursor-pointer`}>
            Subir imagen
          </label>
          <button type="button" className={secondaryBtnClass} onClick={clear}>
            Limpiar
          </button>
        </div>
      </div>
      {uploadError ? (
        <p className="text-sm text-red-700" role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}
