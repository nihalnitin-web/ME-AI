
import React, { useRef, useEffect, useState } from 'react';
import { LandmarkData } from '../types';

interface CameraViewProps {
  isActive: boolean;
  onFrame: (data: LandmarkData) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ isActive, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  
  const faceMeshRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const isClosedRef = useRef(false);
  
  const onFrameRef = useRef(onFrame);
  const isActiveRef = useRef(isActive);

  // Buffer state to synchronize disparate model outputs
  const sharedState = useRef<LandmarkData>({
    left_hand_y: -1,
    right_hand_y: -1,
    shoulder_y: 0.75,
    mouth_width: 0,
    brow_distance: 0,
    hand_nose_dist: 1,
    eye_ratio: 0.02,
    timestamp: Date.now()
  });

  const currentNose = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    onFrameRef.current = onFrame;
    isActiveRef.current = isActive;
  }, [onFrame, isActive]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    isClosedRef.current = false;

    // @ts-ignore
    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    // @ts-ignore
    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    faceMesh.setOptions({ 
      maxNumFaces: 1, 
      refineLandmarks: true, 
      minDetectionConfidence: 0.5, 
      minTrackingConfidence: 0.5 
    });

    hands.setOptions({ 
      maxNumHands: 2, 
      modelComplexity: 1, 
      minDetectionConfidence: 0.5, 
      minTrackingConfidence: 0.5 
    });

    faceMeshRef.current = faceMesh;
    handsRef.current = hands;

    const ctx = canvasRef.current.getContext('2d');

    faceMesh.onResults((results: any) => {
      if (isClosedRef.current) return;
      
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      if (!results.multiFaceLandmarks || !results.multiFaceLandmarks[0]) {
        currentNose.current = null;
        return;
      }
      
      const face = results.multiFaceLandmarks[0];
      const nose = face[1];
      const chin = face[152];
      
      currentNose.current = { x: nose.x, y: nose.y };
      // Lower shoulder threshold relative to head position
      sharedState.current.shoulder_y = chin.y + 0.15; 

      sharedState.current.eye_ratio = Math.abs(face[159].y - face[145].y);
      sharedState.current.mouth_width = Math.abs(face[61].x - face[291].x);
      sharedState.current.brow_distance = Math.abs(face[55].y - face[285].y);

      if (ctx) {
        // @ts-ignore
        window.drawConnectors(ctx, face, window.FACEMESH_TESSELATION, {color: '#3b82f630', lineWidth: 1});
      }
    });

    hands.onResults((results: any) => {
      if (isClosedRef.current) return;
      
      // Reset only if no hands are detected at all
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        sharedState.current.left_hand_y = -1;
        sharedState.current.right_hand_y = -1;
        sharedState.current.hand_nose_dist = 1;
        return;
      }

      // Temporarily clear to avoid stale data from previous hand detections in this same result cycle
      let foundLeft = false;
      let foundRight = false;
      let minNoseDist = 1;

      results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        
        /**
         * DEFAULT VIEW (Unmirrored):
         * Physical Right Hand appears on the Left side of the screen (x < 0.5)
         * Physical Left Hand appears on the Right side of the screen (x > 0.5)
         */
        const isRightHand = wrist.x < 0.5;
        const isLeftHand = wrist.x >= 0.5;

        if (isLeftHand) {
          sharedState.current.left_hand_y = wrist.y;
          foundLeft = true;
        } else if (isRightHand) {
          sharedState.current.right_hand_y = wrist.y;
          foundRight = true;
        }
        
        if (currentNose.current) {
          const d = Math.sqrt(
            Math.pow(indexTip.x - currentNose.current.x, 2) + 
            Math.pow(indexTip.y - currentNose.current.y, 2)
          );
          minNoseDist = Math.min(minNoseDist, d);
        }

        if (ctx) {
          // @ts-ignore
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#3b82f6', lineWidth: 2});
          // @ts-ignore
          window.drawLandmarks(ctx, landmarks, {color: '#ffffff', radius: 2});
        }
      });

      if (!foundLeft) sharedState.current.left_hand_y = -1;
      if (!foundRight) sharedState.current.right_hand_y = -1;
      sharedState.current.hand_nose_dist = minNoseDist;
    });

    // @ts-ignore
    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (isClosedRef.current || !isActiveRef.current || !videoRef.current) return;
        try {
          if (faceMeshRef.current) await faceMeshRef.current.send({image: videoRef.current});
          if (handsRef.current) await handsRef.current.send({image: videoRef.current});
          
          onFrameRef.current({
            ...sharedState.current,
            timestamp: Date.now()
          });
        } catch (e) {
          console.error("Biometric Frame Error:", e);
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current = camera;
    camera.start().then(() => {
      if (!isClosedRef.current) setIsReady(true);
    });

    return () => {
      isClosedRef.current = true;
      setIsReady(false);
      if (cameraRef.current) cameraRef.current.stop();
      if (faceMeshRef.current) faceMeshRef.current.close();
      if (handsRef.current) handsRef.current.close();
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover grayscale opacity-20" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width={640} height={480} />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-sm font-mono text-slate-400 uppercase tracking-widest">Initialising_Sensors...</p>
          </div>
        </div>
      )}

      {/* Scoping Brackets */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-blue-500/30"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-blue-500/30"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-blue-500/30"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-blue-500/30"></div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="w-full h-1 bg-blue-500/5 absolute top-0 animate-[scan_6s_linear_infinite]"></div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
      `}} />
    </div>
  );
};
