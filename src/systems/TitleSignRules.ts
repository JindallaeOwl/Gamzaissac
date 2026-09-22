interface SignFrame {
  time: number;
  x: number;
  y: number;
  angle: number;
  easing?: 'in' | 'out' | 'smooth';
}

export interface TitleSignTuning {
  delayMs: number;
  dropMs: number;
  dropHeight: number;
  initialAngle: number;
  settleFrames: readonly SignFrame[];
}

export function getTitleSignPose(elapsedMs: number, tuning: TitleSignTuning) {
  const elapsed = Math.max(0, elapsedMs) - tuning.delayMs;
  const first = tuning.settleFrames[0];
  if (elapsed < tuning.dropMs) {
    const progress = Math.max(0, elapsed) / tuning.dropMs;
    return {
      x: 0,
      y: -tuning.dropHeight * (1 - progress * progress),
      angle: tuning.initialAngle + (first.angle - tuning.initialAngle) * progress,
      visible: elapsed >= 0,
      ready: false,
    };
  }
  const settling = elapsed - tuning.dropMs;
  for (let i = 1; i < tuning.settleFrames.length; i += 1) {
    const end = tuning.settleFrames[i];
    if (settling > end.time) continue;
    const start = tuning.settleFrames[i - 1];
    const fraction = (settling - start.time) / (end.time - start.time);
    // 충격 직후에는 바로 튀고, 다시 처질 때는 가속한다. 매번 양 끝에서 멈추는
    // 보간은 사슬에 걸린 무게보다 고무 스프링처럼 보이므로 마지막 잔흔에만 쓴다.
    const blend =
      end.easing === 'out'
        ? 1 - (1 - fraction) * (1 - fraction)
        : end.easing === 'in'
          ? fraction * fraction
          : fraction * fraction * (3 - 2 * fraction);
    return {
      x: start.x + (end.x - start.x) * blend,
      y: start.y + (end.y - start.y) * blend,
      angle: start.angle + (end.angle - start.angle) * blend,
      visible: true,
      ready: true,
    };
  }
  return { x: 0, y: 0, angle: 0, visible: true, ready: true };
}

export function getTitleSignHook(
  origin: { x: number; y: number },
  localX: number,
  localY: number,
  angleDegrees: number,
) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: origin.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: origin.y + localX * Math.sin(angle) + localY * Math.cos(angle),
  };
}

export function getTitleChainPoints(
  anchor: { x: number; y: number },
  hook: { x: number; y: number },
  slack: number,
  side: -1 | 1,
) {
  const count = Math.max(1, Math.ceil(Math.hypot(hook.x - anchor.x, hook.y - anchor.y) / 5));
  return Array.from({ length: count + 1 }, (_, index) => {
    const progress = index / count;
    return {
      x:
        anchor.x +
        (hook.x - anchor.x) * progress +
        Math.sin(progress * Math.PI) * Math.max(0, slack) * side,
      y: anchor.y + (hook.y - anchor.y) * progress,
    };
  });
}
