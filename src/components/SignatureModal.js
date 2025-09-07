'use client';
import { useState, useRef, useEffect } from 'react';
import colors from '@/app/colors';

export default function SignatureModal({ isOpen, onClose, onSave, title = "Digital Signature" }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Initialize canvas
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Disable passive event listeners for touch events
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      setHasSignature(true);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    if (hasSignature) {
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL();
      onSave(dataURL);
      onClose();
    }
  };

  const handleTouchStart = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const handleTouchMove = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const handleTouchEnd = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      setHasSignature(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>
        
        <div className="mb-4">
          <div className="border-2 border-gray-300 rounded-lg p-2 bg-white">
            <canvas
              ref={canvasRef}
              width={320}
              height={160}
              className="border border-gray-200 rounded cursor-crosshair w-full"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <div className="flex justify-between mt-2">
              <button
                onClick={clearSignature}
                className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                style={{ color: colors.primaryGreen, borderColor: colors.primaryGreen }}
              >
                Clear
              </button>
              <span className="text-sm text-gray-500">Sign above</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-full font-semibold hover:bg-gray-50"
            style={{ color: colors.primaryGreen, borderColor: colors.primaryGreen }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasSignature}
            className="flex-1 py-3 px-4 rounded-full font-semibold"
            style={{ 
              background: hasSignature ? colors.primaryGreen : "#cbd5e1", 
              color: colors.white 
            }}
          >
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}
