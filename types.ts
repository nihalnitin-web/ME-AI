
export enum AppState {
  IDLE = 'IDLE',
  CHALLENGE = 'CHALLENGE',
  VERIFYING = 'VERIFYING',
  RESULT = 'RESULT'
}

export type GestureType = "left_hand_up" | "right_hand_up" | "touch_nose";
export type ExpressionType = "smile" | "frown" | "blink";

export interface Challenge {
  id: string;
  gesture: GestureType;
  expression: ExpressionType;
  expiresAt: number;
}

export interface VerificationResult {
  success: boolean;
  score: number;
  token?: string;
  reasons: string[];
}

export interface LandmarkData {
  left_hand_y: number;
  right_hand_y: number;
  shoulder_y: number;
  mouth_width: number;
  brow_distance: number;
  hand_nose_dist: number;
  eye_ratio: number;
  timestamp: number;
}

export interface FrameData {
  timestamp: number;
  eye_ratio: number;
  landmarks: LandmarkData;
}
