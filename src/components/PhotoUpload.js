'use client';

import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import colors from '@/app/colors';
import '@/i18n';
import { useTranslation } from 'react-i18next';
import HouseLoader from '@/components/HouseLoader';

export function compressImage(file, maxDimension = 1200) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.8,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

const PhotoUpload = forwardRef(function PhotoUpload(
  {
    currentPhotoUrl = null,
    currentPhotoPath = null,
    currentPhotos: currentPhotosArray = null,
    onPhotoRemoved,
    uploadPath = 'expenses',
    maxPhotos = 1,
    maxSize = 10 * 1024 * 1024,
    acceptedTypes = ['image/*'],
  },
  ref,
) {
  const { t } = useTranslation('components');

  const currentPhotos = useMemo(() => {
    if (currentPhotosArray && currentPhotosArray.length > 0) return currentPhotosArray;
    if (currentPhotoUrl) return [{ url: currentPhotoUrl, path: currentPhotoPath || '' }];
    return [];
  }, [currentPhotosArray, currentPhotoUrl, currentPhotoPath]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const [stagedFiles, setStagedFiles] = useState([]);
  const [removedExistingIds, setRemovedExistingIds] = useState(new Set());

  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraTimeoutRef = useRef(null);

  const stagedFilesRef = useRef(stagedFiles);
  const removedExistingIdsRef = useRef(removedExistingIds);
  const currentPhotosRef = useRef(currentPhotos);
  const uploadPathRef = useRef(uploadPath);

  useEffect(() => { stagedFilesRef.current = stagedFiles; }, [stagedFiles]);
  useEffect(() => { removedExistingIdsRef.current = removedExistingIds; }, [removedExistingIds]);
  useEffect(() => { currentPhotosRef.current = currentPhotos; }, [currentPhotos]);
  useEffect(() => { uploadPathRef.current = uploadPath; }, [uploadPath]);

  // Reset when parent entity changes
  const currentPhotosKey = JSON.stringify(currentPhotos.map((p) => p.url));
  useEffect(() => {
    setStagedFiles((prev) => {
      prev.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
      return [];
    });
    setRemovedExistingIds(new Set());
    setUploadError('');
    setUploadProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhotosKey]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      stagedFiles.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current); };
  }, []);

  useEffect(() => {
    return () => { if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop()); };
  }, [cameraStream]);

  // --- Derived display data ---

  const activeExisting = currentPhotos
    .map((p, i) => ({ displayUrl: p.url, isExisting: true, existingIndex: i }))
    .filter((p) => !removedExistingIds.has(p.existingIndex));

  const allDisplayPhotos = [
    ...activeExisting,
    ...stagedFiles.map((s, i) => ({ displayUrl: s.previewUrl, isExisting: false, stagedIndex: i })),
  ];

  const totalCount = allDisplayPhotos.length;
  const canAddMore = totalCount < maxPhotos && !showCamera;
  const isMulti = maxPhotos > 1;

  // --- Imperative handle ---

  useImperativeHandle(ref, () => ({
    async upload(onProgress) {
      const results = [];
      const existing = currentPhotosRef.current || [];
      const removed = removedExistingIdsRef.current;
      const staged = stagedFilesRef.current || [];

      for (let i = 0; i < existing.length; i++) {
        if (!removed.has(i)) {
          results.push({ url: existing[i].url, path: existing[i].path });
        }
      }

      if (staged.length > 0) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        setUploading(true);
        setUploadProgress(0);

        try {
          for (let i = 0; i < staged.length; i++) {
            const compressed = await compressImage(staged[i].file);
            const fileName = `${Date.now()}_${i}_${compressed.name || 'photo.jpg'}`;
            const fullPath = `${uploadPathRef.current}/${user.uid}/${fileName}`;
            const sRef = storageRef(storage, fullPath);

            const task = uploadBytesResumable(sRef, compressed, {
              contentType: compressed.type || 'image/jpeg',
            });

            await new Promise((resolve, reject) => {
              task.on(
                'state_changed',
                (snap) => {
                  if (snap.totalBytes > 0) {
                    const filePct = snap.bytesTransferred / snap.totalBytes;
                    const overallPct = Math.round(((i + filePct) / staged.length) * 100);
                    setUploadProgress(overallPct);
                    onProgress?.(overallPct);
                  }
                },
                reject,
                resolve,
              );
            });

            const url = await getDownloadURL(task.snapshot.ref);
            results.push({ url, path: fullPath });
          }
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      }

      return results;
    },

    hasFile() {
      if (stagedFilesRef.current.length > 0) return true;
      const existing = currentPhotosRef.current || [];
      const removed = removedExistingIdsRef.current;
      for (let i = 0; i < existing.length; i++) {
        if (!removed.has(i)) return true;
      }
      return false;
    },

    clear() {
      setStagedFiles((prev) => {
        prev.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
        return [];
      });
      setRemovedExistingIds(new Set());
      setUploadError('');
      setUploadProgress(0);
    },

    getPreviewUrl() {
      if (allDisplayPhotos.length > 0) return allDisplayPhotos[0].displayUrl;
      return null;
    },

    getPreviewUrls() {
      return allDisplayPhotos.map((p) => p.displayUrl);
    },
  }));

  // --- Camera ---

  const checkCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      }
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  useEffect(() => { checkCameras(); }, [checkCameras]);

  const startCamera = async (facingFront = useFrontCamera) => {
    try {
      setCameraLoading(true);
      setUploadError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('CAMERA_NOT_SUPPORTED');
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingFront ? 'user' : 'environment' },
      });

      checkCameras();
      setCameraStream(stream);
      setShowCamera(true);

      if (cameraTimeoutRef.current) clearTimeout(cameraTimeoutRef.current);

      cameraTimeoutRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current
            .play()
            .then(() => { setCameraLoading(false); setCameraReady(true); })
            .catch(() => {
              videoRef.current.muted = true;
              videoRef.current
                .play()
                .then(() => { setCameraLoading(false); setCameraReady(true); })
                .catch(() => { setCameraLoading(false); setCameraReady(false); });
            });
        } else {
          setCameraLoading(false);
        }
      }, 100);
    } catch (error) {
      setCameraLoading(false);
      if (error.name === 'NotAllowedError') {
        setUploadError(t('photo_upload.camera_access_denied'));
      } else if (error.name === 'NotFoundError') {
        setUploadError(t('photo_upload.no_camera_found'));
      } else if (error.message === 'CAMERA_NOT_SUPPORTED') {
        setUploadError(t('photo_upload.camera_not_supported'));
      } else {
        setUploadError(t('photo_upload.camera_error', { message: error.message }));
      }
    }
  };

  const flipCamera = async () => {
    const newVal = !useFrontCamera;
    setUseFrontCamera(newVal);
    if (showCamera) await startCamera(newVal);
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraLoading(false);
    setCameraReady(false);
  }, [cameraStream]);

  const addFile = (file) => {
    const entry = { file, previewUrl: URL.createObjectURL(file) };

    if (maxPhotos === 1) {
      setStagedFiles((prev) => {
        prev.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
        return [entry];
      });
      setRemovedExistingIds(new Set(currentPhotos.map((_, i) => i)));
    } else {
      setStagedFiles((prev) => [...prev, entry]);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setUploadError(t('photo_upload.camera_not_ready'));
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setUploadError(t('photo_upload.camera_not_ready'));
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          addFile(file);

          if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            setCameraStream(null);
          }
          setShowCamera(false);
          setCameraLoading(false);
          setCameraReady(false);
        } else {
          setUploadError(t('photo_upload.capture_failed'));
        }
      },
      'image/jpeg',
      0.8,
    );
  };

  // --- Gallery ---

  const triggerFilePicker = () => fileInputRef.current?.click();
  const clearFileInput = () => { if (fileInputRef.current) fileInputRef.current.value = ''; };

  const handleFileSelected = (event) => {
    setUploadError('');
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(t('photo_upload.select_image_file'));
      return;
    }
    if (file.size > maxSize) {
      setUploadError(t('photo_upload.file_too_large', { max: Math.round(maxSize / 1024 / 1024) }));
      return;
    }

    addFile(file);
  };

  // --- Remove ---

  const removePhoto = (photo) => {
    if (photo.isExisting) {
      setRemovedExistingIds((prev) => new Set([...prev, photo.existingIndex]));
    } else {
      setStagedFiles((prev) => {
        const removed = prev[photo.stagedIndex];
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        return prev.filter((_, i) => i !== photo.stagedIndex);
      });
    }
    onPhotoRemoved?.();
  };

  // --- Render ---

  const hasPhotos = totalCount > 0;
  const showPickerButtons = canAddMore && !showCamera;

  const pickerButtons = (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={startCamera}
        disabled={uploading || cameraLoading}
        className="px-4 py-3 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ borderColor: colors.gold, color: colors.gold, backgroundColor: `${colors.gold}10` }}
      >
        <span className="text-2xl">{cameraLoading ? '⏳' : '📱'}</span>
        <span className="text-sm">
          {cameraLoading ? t('photo_upload.starting_camera') : t('photo_upload.take_photo')}
        </span>
      </button>
      <button
        onClick={triggerFilePicker}
        disabled={uploading}
        className="px-4 py-3 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ borderColor: colors.gray400, color: colors.muted }}
      >
        <span className="text-2xl">📁</span>
        <span className="text-sm">{t('photo_upload.choose_from_gallery')}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelected}
        className="hidden"
        onClick={clearFileInput}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Single-photo preview */}
      {!isMulti && hasPhotos && !showCamera && (
        <div className="relative">
          <img
            src={allDisplayPhotos[0].displayUrl}
            alt=""
            className="w-full h-48 object-cover rounded-lg border"
          />
          <button
            onClick={() => removePhoto(allDisplayPhotos[0])}
            className="absolute top-2 right-2 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            style={{ backgroundColor: colors.red }}
            title={t('photo_upload.remove_photo')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Multi-photo grid */}
      {isMulti && hasPhotos && (
        <div className="grid grid-cols-3 gap-2">
          {allDisplayPhotos.map((photo, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
              <img
                src={photo.displayUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removePhoto(photo)}
                className="absolute top-1 right-1 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                style={{ backgroundColor: colors.red }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Camera viewfinder */}
      {showCamera && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className="w-full h-64 object-cover"
            style={{ backgroundColor: 'black' }}
            onCanPlay={() => setCameraLoading(false)}
            onError={() => setUploadError(t('photo_upload.camera_error', { message: 'video' }))}
          />
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <div className="flex justify-center mb-2">
                  <HouseLoader size={36} />
                </div>
                <p>{t('photo_upload.starting_camera')}</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
            <div className="flex items-center justify-between px-6">
              <button
                onClick={flipCamera}
                className="rounded-full w-11 h-11 flex items-center justify-center backdrop-blur-sm transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                title={t('photo_upload.flip_camera')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                  <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                  <circle cx="10" cy="12" r="1" />
                  <path d="m18 8-2 2h4l-2-2Z" />
                  <path d="m6 16 2-2H4l2 2Z" />
                </svg>
              </button>
              <button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className={`rounded-full w-16 h-16 flex items-center justify-center transition-colors border-4 ${
                  cameraReady
                    ? 'bg-white border-white/50 hover:bg-gray-100'
                    : 'bg-gray-400 border-gray-500 cursor-not-allowed'
                }`}
                title={cameraReady ? t('photo_upload.take_photo') : t('photo_upload.camera_not_ready')}
              >
                <div className={`rounded-full w-12 h-12 ${cameraReady ? 'bg-white' : 'bg-gray-400'}`} />
              </button>
              <button
                onClick={stopCamera}
                className="rounded-full w-11 h-11 flex items-center justify-center text-white text-lg backdrop-blur-sm transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picker buttons */}
      {showPickerButtons && pickerButtons}

      {/* Upload progress */}
      {uploading && (
        <div className="w-full">
          <div className="flex items-center justify-between text-sm mb-1" style={{ color: colors.muted }}>
            <span>{t('photo_upload.uploading')}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%`, backgroundColor: colors.gold }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="text-sm p-2 rounded" style={{ color: colors.red, backgroundColor: `${colors.red}10` }}>
          {uploadError}
        </div>
      )}

      {showPickerButtons && !uploading && (
        <p className="text-xs text-center" style={{ color: colors.muted }}>
          {isMulti
            ? t('photo_upload.upload_instructions_multi', { max: Math.round(maxSize / 1024 / 1024), count: totalCount, limit: maxPhotos })
            : t('photo_upload.upload_instructions', { max: Math.round(maxSize / 1024 / 1024) })}
        </p>
      )}
    </div>
  );
});

export default PhotoUpload;
