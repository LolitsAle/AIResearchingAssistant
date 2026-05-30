import { useRef, useState } from 'react';

export default function SnippingOverlay({ active, targetRef, onCancel, onCapture }) {
  const [drag, setDrag] = useState(null);
  const originRef = useRef(null);
  if (!active) return null;

  const rectFromPoints = (start, end) => ({
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  });

  const makeThumbnail = (selectionRect) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(240, Math.round(selectionRect.width));
    canvas.height = Math.max(140, Math.round(selectionRect.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#15120d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d4b66f';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = '#f2d48b';
    ctx.font = '16px Georgia';
    ctx.fillText('Vùng nội dung đã chụp', 18, 34);
    ctx.fillStyle = '#d8cfc0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${Math.round(selectionRect.width)} × ${Math.round(selectionRect.height)} px`, 18, 58);
    ctx.fillText('Gửi ảnh này đến Vision API để phân tích thật.', 18, 82);
    return canvas.toDataURL('image/png');
  };

  const handlePointerDown = (event) => {
    originRef.current = { x: event.clientX, y: event.clientY };
    setDrag(rectFromPoints(originRef.current, originRef.current));
  };
  const handlePointerMove = (event) => {
    if (!originRef.current) return;
    setDrag(rectFromPoints(originRef.current, { x: event.clientX, y: event.clientY }));
  };
  const handlePointerUp = () => {
    if (!drag || drag.width < 12 || drag.height < 12) {
      originRef.current = null;
      setDrag(null);
      return;
    }
    const targetBox = targetRef.current?.getBoundingClientRect();
    const relativeRect = targetBox ? { ...drag, left: drag.left - targetBox.left, top: drag.top - targetBox.top } : drag;
    onCapture({ dataUrl: makeThumbnail(drag), rect: relativeRect });
    originRef.current = null;
    setDrag(null);
  };

  return (
    <div className="al-snipping-overlay" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      <button type="button" className="al-snipping-cancel" onClick={(event) => { event.stopPropagation(); onCancel(); }}>Huỷ chụp</button>
      <div className="al-snipping-help">Kéo chuột quanh biểu đồ, công thức hoặc vùng nội dung cần hỏi AI.</div>
      {drag && <div className="al-snipping-box" style={drag} />}
    </div>
  );
}
