"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraCaptureModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const start = async () => {
      if (!open) return;
      setError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError("Camera not available. Please allow camera access or use file upload.");
      }
    };
    start();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    console.log("Capturing from video, dimensions:", video.videoWidth, "x", video.videoHeight);
    
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);
    
    console.log("Canvas created, converting to blob...");
    canvas.toBlob((blob) => {
      if (blob) {
        console.log("Blob created successfully, size:", blob.size, "type:", blob.type);
        if (onCapture) onCapture(blob);
      } else {
        console.error("Failed to create blob from canvas");
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Take photo</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>
        {error ? (
          <div className="text-sm text-red-600 mb-3">{error}</div>
        ) : (
          <video ref={videoRef} className="w-full rounded bg-black" playsInline muted />
        )}
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-4 py-2 rounded-full border text-sm">Cancel</button>
          <button onClick={handleCapture} className="px-4 py-2 rounded-full text-white text-sm" style={{ background: "#EDC381" }}>Capture</button>
        </div>
      </div>
    </div>
  );
}


