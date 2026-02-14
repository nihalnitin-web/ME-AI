import { Challenge, FrameData, VerificationResult, GestureType, ExpressionType } from '../types';

export class VerificationService {
  private static CHALLENGE_EXPIRY = 45000;
  // Threshold: Factor must be detected in at least 15% of frames (lenient for short window)
  private static MIN_PASS_RATIO = 0.15; 

  static generateChallenge(): Challenge {
    const gestures: GestureType[] = ["left_hand_up", "right_hand_up", "touch_nose"];
    const expressions: ExpressionType[] = ["smile", "frown", "blink"];

    return {
      id: Math.random().toString(36).substring(7).toUpperCase(),
      gesture: gestures[Math.floor(Math.random() * gestures.length)],
      expression: expressions[Math.floor(Math.random() * expressions.length)],
      expiresAt: Date.now() + this.CHALLENGE_EXPIRY,
    };
  }

  static verify(challenge: Challenge, frames: FrameData[]): VerificationResult {
    if (Date.now() > challenge.expiresAt) {
      return { success: false, score: 0, reasons: ["Protocol timeout: session expired"] };
    }

    if (frames.length < 15) {
      return { success: false, score: 0, reasons: ["Data density failure: insufficient biometric stream"] };
    }

    let gesturePassCount = 0;
    let expressionPassCount = 0;

    frames.forEach(f => {
      const { landmarks } = f;
      
      // Gesture Detection - Y is inverted in screen coords (0 is top, 1 is bottom)
      // So wrist.y < shoulder.y means hand is ABOVE shoulders.
      if (challenge.gesture === "left_hand_up") {
        if (landmarks.left_hand_y > 0 && landmarks.left_hand_y < landmarks.shoulder_y) gesturePassCount++;
      } else if (challenge.gesture === "right_hand_up") {
        if (landmarks.right_hand_y > 0 && landmarks.right_hand_y < landmarks.shoulder_y) gesturePassCount++;
      } else if (challenge.gesture === "touch_nose") {
        if (landmarks.hand_nose_dist < 0.20) gesturePassCount++;
      }

      // Expression Detection
      if (challenge.expression === "smile") {
        if (landmarks.mouth_width > 0.07) expressionPassCount++;
      } else if (challenge.expression === "frown") {
        if (landmarks.brow_distance < 0.03) expressionPassCount++;
      } else if (challenge.expression === "blink") {
        if (landmarks.eye_ratio < 0.012) expressionPassCount++;
      }
    });

    const gestureRatio = gesturePassCount / frames.length;
    const expressionRatio = expressionPassCount / frames.length;

    const earValues = frames.map(f => f.eye_ratio);
    const variance = this.calculateVariance(earValues);
    const isHumanNoiseDetected = variance > 0.000000001; 

    const gesturePassed = gestureRatio >= this.MIN_PASS_RATIO;
    const expressionPassed = expressionRatio >= this.MIN_PASS_RATIO;
    const livenessPassed = isHumanNoiseDetected;

    const success = gesturePassed && expressionPassed && livenessPassed;

    const displayScore = Math.round(
      (Math.min(gestureRatio / 0.4, 1) * 40) + 
      (Math.min(expressionRatio / 0.4, 1) * 40) + 
      (livenessPassed ? 20 : 0)
    );

    const reasons = [];
    if (!gesturePassed) {
      reasons.push(`CRITICAL: Mandatory gesture (${challenge.gesture.replace(/_/g, ' ')}) missing`);
    } else {
      reasons.push(`Gesture confirmed: ${Math.round(gestureRatio * 100)}% match`);
    }

    if (!expressionPassed) {
      reasons.push(`CRITICAL: Mandatory expression (${challenge.expression}) missing`);
    } else {
      reasons.push(`Expression confirmed: ${Math.round(expressionRatio * 100)}% match`);
    }

    if (!livenessPassed) {
      reasons.push("CRITICAL: Temporal authenticity failure");
    } else {
      reasons.push("Temporal authenticity confirmed");
    }

    return {
      success,
      score: displayScore,
      reasons,
      token: success ? this.generateToken(challenge.id) : undefined
    };
  }

  private static calculateVariance(data: number[]): number {
    const mean = data.reduce((a, b) => a + b) / data.length;
    return data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  }

  private static generateToken(challengeId: string): string {
    return `MFPOL.${btoa(challengeId)}.${btoa(Date.now().toString())}.sig_${Math.floor(Math.random() * 0xffffff).toString(16)}`;
  }
}
