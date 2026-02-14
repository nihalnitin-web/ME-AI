
import { Challenge, FrameData, VerificationResult, GestureType, ExpressionType } from '../types';

/**
 * VerificationService handles the logic:
 * - Evaluating liveness scores (EAR, temporal variance)
 * - Validating gestures and expressions
 * - Issuing JWT-like tokens
 * 
 * SECURITY UPDATE: Strict multi-factor check. All factors must pass.
 */
export class VerificationService {
  private static CHALLENGE_EXPIRY = 45000;
  // Threshold: Factor must be detected in at least 20% of frames to account for reaction time
  private static MIN_PASS_RATIO = 0.20; 

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

    // Ensure we have enough data. 5 seconds at ~15fps is 75 frames.
    if (frames.length < 15) {
      return { success: false, score: 0, reasons: ["Data density failure: insufficient biometric stream"] };
    }

    let gesturePassCount = 0;
    let expressionPassCount = 0;

    frames.forEach(f => {
      const { landmarks } = f;
      
      // Gesture Detection
      if (challenge.gesture === "left_hand_up") {
        // Physical Left hand up
        if (landmarks.left_hand_y > 0 && landmarks.left_hand_y < landmarks.shoulder_y) gesturePassCount++;
      } else if (challenge.gesture === "right_hand_up") {
        // Physical Right hand up
        if (landmarks.right_hand_y > 0 && landmarks.right_hand_y < landmarks.shoulder_y) gesturePassCount++;
      } else if (challenge.gesture === "touch_nose") {
        // Hand tip near nose
        if (landmarks.hand_nose_dist < 0.16) gesturePassCount++;
      }

      // Expression Detection
      if (challenge.expression === "smile") {
        if (landmarks.mouth_width > 0.075) expressionPassCount++;
      } else if (challenge.expression === "frown") {
        if (landmarks.brow_distance < 0.025) expressionPassCount++;
      } else if (challenge.expression === "blink") {
        if (landmarks.eye_ratio < 0.012) expressionPassCount++;
      }
    });

    const gestureRatio = gesturePassCount / frames.length;
    const expressionRatio = expressionPassCount / frames.length;

    // Liveness Detection (Temporal EAR Variance)
    const earValues = frames.map(f => f.eye_ratio);
    const variance = this.calculateVariance(earValues);
    const isHumanNoiseDetected = variance > 0.000000005; 

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
      reasons.push(`CRITICAL: Mandatory gesture (${challenge.gesture.replace(/_/g, ' ')}) not detected`);
    } else {
      reasons.push(`Gesture sequence verified: ${Math.round(gestureRatio * 100)}% temporal match`);
    }

    if (!expressionPassed) {
      reasons.push(`CRITICAL: Mandatory expression (${challenge.expression}) not detected`);
    } else {
      reasons.push(`Expression micro-signature verified: ${Math.round(expressionRatio * 100)}% temporal match`);
    }

    if (!livenessPassed) {
      reasons.push("CRITICAL: Temporal authenticity failed (Static subject suspected)");
    } else {
      reasons.push("Temporal noise verified (Human subject confirmed)");
    }

    if (success) {
      reasons.push("All security layers validated successfully");
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
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      sub: "biometric_auth",
      cid: challengeId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600
    }));
    return `MFPOL.${header}.${payload}.sig_0x${Math.floor(Math.random() * 0xffffff).toString(16)}`;
  }
}
