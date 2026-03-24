'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import colors from '@/app/colors';
import '@/i18n';
import { useTranslation } from 'react-i18next';

export default function PhotoUpload({ 
  onPhotoUploaded, 
  currentPhotoUrl = null, 
  onPhotoRemoved,
  uploadPath = 'expenses',
  maxSize = 10 * 1024 * 1024,
  acceptedTypes = ['image/*']
}) {
  const { t } = useTranslation('components');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraTimeoutRef = useRef(null);

  const checkCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      }
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  useEffect(() => {
    checkCameras();
  }, [checkCameras]);

  useEffect(() => {
    setPhotoUrl(currentPhotoUrl);
    if (!currentPhotoUrl) {
      setUploadError('');
      setUploadProgress(0);
    }
  }, [currentPhotoUrl]);

  // Revoke previous object URL when previewUrl changes or on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Cleanup camera timeout and stream on unmount
  useEffect(() => {
    return () => {
      if (cameraTimeoutRef.current) {
        clearTimeout(cameraTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const startCamera = async (facingFront = useFrontCamera) => {
    try {
      setCameraLoading(true);
      setUploadError('');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('CAMERA_NOT_SUPPORTED');
      }
      
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }

      const constraints = {
        video: {
          facingMode: facingFront ? 'user' : 'environment'
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Re-check cameras now that permission is granted (browsers hide devices until then)
      checkCameras();

      setCameraStream(stream);
      setShowCamera(true);

      if (cameraTimeoutRef.current) {
        clearTimeout(cameraTimeoutRef.current);
      }
      
      cameraTimeoutRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.play().then(() => {
            setCameraLoading(false);
            setCameraReady(true);
          }).catch(() => {
            videoRef.current.muted = true;
            videoRef.current.play().then(() => {
              setCameraLoading(false);
              setCameraReady(true);
            }).catch(() => {
              setCameraLoading(false);
              setCameraReady(false);
            });
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
    if (showCamera) {
      await startCamera(newVal);
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCapturedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCameraLoading(false);
    setCameraReady(false);
  }, [cameraStream, previewUrl]);

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

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setCapturedImage(file);
        
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(file));
        
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setShowCamera(false);
        setCameraLoading(false);
        setCameraReady(false);
      } else {
        setUploadError(t('photo_upload.capture_failed'));
      }
    }, 'image/jpeg', 0.8);
  };

  const confirmCapturedPhoto = () => {
    if (capturedImage) {
      handleFileUpload(capturedImage);
    }
  };

  const handleFileUpload = async (file) => {
    try {
      setUploadError('');
      setUploading(true);
      setUploadProgress(0);

      const user = auth.currentUser;
      if (!user) {
        setUploadError(t('photo_upload.login_required'));
        return;
      }
      
      const timestamp = Date.now();
      const fileName = file.name || `${timestamp}_photo.jpg`;
      const path = `${uploadPath}/${user.uid}/${fileName}`;
      const ref = storageRef(storage, path);

      const task = uploadBytesResumable(ref, file, { contentType: file.type || 'image/jpeg' });

      await new Promise((resolve, reject) => {
        task.on('state_changed', (snap) => {
          if (snap.totalBytes > 0) {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        }, reject, resolve);
      });

      const downloadURL = await getDownloadURL(task.snapshot.ref);
      
      setPhotoUrl(downloadURL);
      setUploadProgress(0);
      setCapturedImage(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
      if (onPhotoUploaded) {
        onPhotoUploaded(downloadURL, path);
      }

    } catch (error) {
      console.error('Photo upload failed:', error);
      setUploadError(t('photo_upload.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    startCamera();
  };

  const handleFileSelected = async (event) => {
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

    handleFileUpload(file);
  };

  const removePhoto = () => {
    setPhotoUrl(null);
    if (onPhotoRemoved) {
      onPhotoRemoved();
    }
  };

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {photoUrl && (
        <div className="relative">
          <img
            src={photoUrl}
            alt=""
            className="w-full h-48 object-cover rounded-lg border"
          />
          <button
            onClick={removePhoto}
            className="absolute top-2 right-2 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            style={{ backgroundColor: colors.red }}
            title={t('photo_upload.remove_photo')}
          >
            ✕
          </button>
        </div>
      )}

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
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

      {capturedImage && !showCamera && (
        <div className="relative">
          <img
            src={previewUrl}
            alt=""
            className="w-full h-48 object-cover rounded-lg border"
          />
          <div className="absolute bottom-2 left-2 right-2 flex gap-2">
            <button
              onClick={retakePhoto}
              disabled={uploading}
              className="bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {t('photo_upload.retake')}
            </button>
            <button
              onClick={confirmCapturedPhoto}
              disabled={uploading}
              className="py-2 px-4 rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: colors.green }}
            >
              {t('photo_upload.use_photo')}
            </button>
          </div>
        </div>
      )}

      {!photoUrl && !showCamera && !capturedImage && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startCamera}
            disabled={uploading || cameraLoading}
            className="px-4 py-3 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ 
              borderColor: colors.gold, 
              color: colors.gold, 
              backgroundColor: `${colors.gold}10`
            }}
          >
            <span className="text-2xl">{cameraLoading ? '⏳' : '📱'}</span>
            <span className="text-sm">{cameraLoading ? t('photo_upload.starting_camera') : t('photo_upload.take_photo')}</span>
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
      )}

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

      {!photoUrl && !showCamera && !capturedImage && !uploading && (
        <p className="text-xs text-center" style={{ color: colors.muted }}>
          {t('photo_upload.upload_instructions', { max: Math.round(maxSize / 1024 / 1024) })}
        </p>
      )}
    </div>
  );
}
