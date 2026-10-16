"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Estado de enquadramento manual da foto dentro do layout (arrastar pra
 * posicionar, e um zoom extra por cima do zoom da animação de vídeo).
 * offsetX/offsetY vão de -1 a 1 (0 = centralizado); scale vai de 1 (sem
 * zoom extra) até MAX_SCALE.
 */
export const PHOTO_ADJUST_DEFAULT = { offsetX: 0, offsetY: 0, scale: 1 };
const MAX_SCALE = 2.5;

export function usePhotoAdjust() {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    elW: number;
    elH: number;
  } | null>(null);

  const reset = useCallback(() => {
    setOffsetX(0);
    setOffsetY(0);
    setScale(1);
  }, []);

  /** Chame no onPointerDown do elemento que mostra a prévia (canvas ou img). */
  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        elW: rect.width || 1,
        elH: rect.height || 1,
      };
    },
    [offsetX, offsetY]
  );

  const onDragMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // arrastar a foto pra direita/baixo revela mais do lado esquerdo/topo
    // da imagem original — por isso o sinal invertido, pra "puxar" a foto
    // junto com o dedo/cursor, como em qualquer editor de foto.
    const dx = (e.clientX - drag.startX) / (drag.elW / 2);
    const dy = (e.clientY - drag.startY) / (drag.elH / 2);
    setOffsetX(Math.min(1, Math.max(-1, drag.startOffsetX - dx)));
    setOffsetY(Math.min(1, Math.max(-1, drag.startOffsetY - dy)));
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // já pode ter sido liberado
    }
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, +(s + 0.15).toFixed(2)));
  }, []);
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(1, +(s - 0.15).toFixed(2)));
  }, []);

  return {
    offsetX,
    offsetY,
    scale,
    setOffsetX,
    setOffsetY,
    setScale,
    reset,
    onDragStart,
    onDragMove,
    onDragEnd,
    zoomIn,
    zoomOut,
  };
}

/**
 * Estado de posição manual da logo — deslocamento livre em pixels do
 * canvas (1080 de largura), a partir da posição padrão de cada modelo.
 * Ao contrário da foto (que é sempre recortada por trás de um "enquadre"
 * fixo), a logo pode ir pra qualquer lugar da tela, inclusive saindo
 * dela — por isso aqui não tem limite de -1 a 1, é pixel livre mesmo.
 */
export function useLogoAdjust(canvasWidth: number) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scaleFactor: number;
  } | null>(null);

  const reset = useCallback(() => {
    setX(0);
    setY(0);
  }, []);

  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: x,
        startY: y,
        // a prévia é exibida menor (ou maior) que o canvas real —
        // converte pixels da tela pra pixels do canvas (1080 de largura).
        scaleFactor: canvasWidth / (rect.width || 1),
      };
    },
    [x, y, canvasWidth]
  );

  const onDragMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) * drag.scaleFactor;
    const dy = (e.clientY - drag.startClientY) * drag.scaleFactor;
    setX(drag.startX + dx);
    setY(drag.startY + dy);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // já pode ter sido liberado
    }
  }, []);

  return { x, y, setX, setY, reset, onDragStart, onDragMove, onDragEnd };
}
