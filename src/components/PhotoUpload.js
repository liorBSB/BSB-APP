import React, { useState, useRef, useCallback } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import colors from '@/app/colors';

export default function PhotoUpload({ 
  onPhotoUploaded, 
  currentPhotoUrl = null, 
  onPhotoRemoved,
  uploadPath = 'expenses',
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['image/*']
}) {
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
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Check for multiple cameras on component mount
  React.useEffect(() => {
    const checkCameras = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        }
      } catch (error) {
        console.log('Could not enumerate devices:', error);
        setHasMultipleCameras(false);
      }
    };
    checkCameras();
  }, []);

  // Reset component state when currentPhotoUrl changes (e.g., after form reset)
  React.useEffect(() => {
    setPhotoUrl(currentPhotoUrl);
    if (!currentPhotoUrl && !showCamera) {
      // Only reset states when photo is removed AND camera is not active
      setUploadError('');
      setUploadProgress(0);
      // Don't stop camera if it's currently active
    }
  }, [currentPhotoUrl, showCamera]);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      setUploadError('');
      
      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }
      
      // Stop existing stream if any
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }

      console.log('Requesting camera access...');
      
      // Use simpler, more compatible constraints
      const constraints = {
        video: {
          facingMode: useFrontCamera ? 'user' : 'environment'
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', stream);
      
      // Set the stream and show camera immediately
      setCameraStream(stream);
      setShowCamera(true);
      
      // Wait a bit for the video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          console.log('Setting video srcObject...');
          videoRef.current.srcObject = stream;
          
          // Ensure video plays
          videoRef.current.play().then(() => {
            console.log('Video playing successfully');
            setCameraLoading(false);
            setCameraReady(true);
          }).catch(playError => {
            console.error('Play error:', playError);
            // Try alternative approach
            videoRef.current.muted = true;
            videoRef.current.play().then(() => {
              console.log('Video playing with muted fallback');
              setCameraLoading(false);
              setCameraReady(true);
            }).catch(e => {
              console.error('Muted play also failed:', e);
              setCameraLoading(false);
              setCameraReady(false);
            });
          });
        } else {
          console.error('Video ref not available');
          setCameraLoading(false);
        }
      }, 100);
      
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraLoading(false);
      if (error.name === 'NotAllowedError') {
        setUploadError('Camera access denied. Please allow camera permissions.');
      } else if (error.name === 'NotFoundError') {
        setUploadError('No camera found on this device.');
      } else if (error.message === 'Camera not supported on this device') {
        setUploadError('Camera not supported on this device.');
      } else {
        setUploadError(`Camera error: ${error.message}`);
      }
    }
  };

  const flipCamera = async () => {
    setUseFrontCamera(!useFrontCamera);
    // Restart camera with new facing mode
    if (showCamera) {
      await startCamera();
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCapturedImage(null);
    setCameraLoading(false);
    setCameraReady(false);
  }, [cameraStream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setUploadError('Camera not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Check if video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setUploadError('Camera not ready yet. Please wait a moment and try again.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        // Convert blob to file
        const file = new File([blob], `camera_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        // Set the captured image as a file
        setCapturedImage(file);
        
        // Then close camera
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setShowCamera(false);
        setCameraLoading(false);
        setCameraReady(false);
        
        // Automatically upload the photo as a file
        handleFileUpload(file);
      } else {
        setUploadError('Failed to capture photo. Please try again.');
      }
    }, 'image/jpeg', 0.8);
  };

  const handleFileUpload = async (file) => {
    try {
      setUploadError('');
      setUploading(true);
      setUploadProgress(0);

      // Create unique path for the photo
      const user = auth.currentUser;
      if (!user) {
        setUploadError('You must be logged in to upload photos');
        return;
      }
      
      const timestamp = Date.now();
      const fileName = file.name || `${timestamp}_photo.jpg`;
      const path = `${uploadPath}/${user.uid}/${fileName}`;
      const ref = storageRef(storage, path);

      // Upload the file
      const task = uploadBytesResumable(ref, file, { contentType: file.type || 'image/jpeg' });

      await new Promise((resolve, reject) => {
        task.on('state_changed', (snap) => {
          if (snap.totalBytes > 0) {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        }, reject, resolve);
      });

      // Get download URL
      const downloadURL = await getDownloadURL(task.snapshot.ref);
      
      setPhotoUrl(downloadURL);
      setUploadProgress(0);
      setCapturedImage(null);
      
      // Call the callback with the new photo URL
      if (onPhotoUploaded) {
        console.log('Calling onPhotoUploaded callback with:', downloadURL, path);
        onPhotoUploaded(downloadURL, path);
      } else {
        console.log('No onPhotoUploaded callback provided');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleFileSelected = async (event) => {
    try {
      setUploadError('');
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        setUploadError(`File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      // Create unique path for the photo
      const user = auth.currentUser;
      if (!user) {
        setUploadError('You must be logged in to upload photos');
        return;
      }
      
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const path = `${uploadPath}/${user.uid}/${fileName}`;
      const ref = storageRef(storage, path);

      // Upload the file
      const task = uploadBytesResumable(ref, file, { contentType: file.type });

      await new Promise((resolve, reject) => {
        task.on('state_changed', (snap) => {
          if (snap.totalBytes > 0) {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        }, reject, resolve);
      });

      // Get download URL
      const downloadURL = await getDownloadURL(task.snapshot.ref);
      
      setPhotoUrl(downloadURL);
      setUploadProgress(0);
      
      // Call the callback with the new photo URL
      if (onPhotoUploaded) {
        console.log('File upload: Calling onPhotoUploaded callback with:', downloadURL, path);
        onPhotoUploaded(downloadURL, path);
      } else {
        console.log('File upload: No onPhotoUploaded callback provided');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
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

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelected}
        className="hidden"
        onClick={clearFileInput}
      />

      {/* Hidden canvas for photo capture */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {/* Current photo display */}
      {photoUrl && (
        <div className="relative">
          <img
            src={photoUrl}
            alt="Receipt"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <button
            onClick={removePhoto}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Remove photo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Camera view */}
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
            onLoadedMetadata={() => {
              console.log('Video metadata loaded');
              console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
            }}
            onCanPlay={() => {
              console.log('Video can play');
              setCameraLoading(false);
            }}
            onError={(e) => {
              console.error('Video error:', e);
              setUploadError('Video error occurred. Please try again.');
            }}
            onLoadStart={() => console.log('Video load started')}
            onLoadedData={() => console.log('Video data loaded')}
          />
          
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>Starting camera...</p>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
            <div className="flex justify-center gap-3">
              <button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className={`rounded-full w-16 h-16 flex items-center justify-center text-2xl transition-colors ${
                  cameraReady 
                    ? 'bg-white text-black hover:bg-gray-200' 
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
                title={cameraReady ? "Take photo" : "Camera not ready yet"}
              >
                📸
              </button>
              {hasMultipleCameras && (
                <button
                  onClick={flipCamera}
                  className="bg-gray-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl hover:bg-gray-600 transition-colors"
                  title="Flip camera"
                >
                  {useFrontCamera ? '👤' : '👥'}
                </button>
              )}
              <button
                onClick={stopCamera}
                className="bg-red-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl hover:bg-red-600 transition-colors"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captured image preview */}
      {capturedImage && !showCamera && (
        <div className="relative">
          <img
            src={URL.createObjectURL(capturedImage)}
            alt="Captured photo"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <div className="absolute bottom-2 left-2 right-2 flex gap-2">
            <button
              onClick={retakePhoto}
              className="bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {/* Upload buttons - only show when no photo and no camera active */}
      {!photoUrl && !showCamera && !capturedImage && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startCamera}
            disabled={uploading || cameraLoading}
            className="px-4 py-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 disabled:opacity-50"
          >
            <span className="text-2xl">{cameraLoading ? '⏳' : '📱'}</span>
            <span className="text-sm">{cameraLoading ? 'Starting...' : 'Take Photo'}</span>
          </button>
          <button
            onClick={triggerFilePicker}
            disabled={uploading}
            className="px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-gray-700"
          >
            <span className="text-2xl">📁</span>
            <span className="text-sm">Upload</span>
          </button>
          
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="w-full">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {uploadError}
        </div>
      )}

      {/* Upload instructions */}
      {!photoUrl && !showCamera && !capturedImage && !uploading && (
        <p className="text-xs text-gray-500 text-center">
          Take a photo with your camera or upload an existing image • Max size: {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      )}
    </div>
  );
}
