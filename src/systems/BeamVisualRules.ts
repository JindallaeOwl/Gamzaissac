export interface BeamSection {
  x: number;
  offset: number;
  radius: number;
  core: number;
}

/** A quick opening, flowing thick body, then a collapsing tail. Cosmetic only. */
export function beamSections(
  range: number,
  ageMs: number,
  durationMs: number,
  width: number,
): BeamSection[] {
  if (range <= 0 || durationMs <= 0 || ageMs < 0 || ageMs >= durationMs) return [];
  const progress = ageMs / durationMs;
  const opening = Math.min(1, (ageMs + 8) / 28);
  const closing = Math.min(1, (durationMs - ageMs) / 80);
  const envelope = opening * closing;
  const sections: BeamSection[] = [];
  // Quantized animation and rectangles keep the beam crisp like the sprite art.
  const phase = Math.floor(ageMs / 24) * 0.85;
  for (let x = 0; x < range; x += 3) {
    const taper = 0.82 + 0.18 * Math.sin((x / range) * Math.PI);
    const ripple = Math.sin(x * 0.14 - phase) * 0.9;
    sections.push({
      x,
      offset: Math.round(Math.sin(x * 0.09 - phase * 1.8) * 1.5 * envelope),
      radius: Math.max(1, Math.round((width * 0.45 * taper + ripple) * envelope)),
      core: Math.max(
        1,
        Math.round((2.5 + Math.sin(x * 0.12 - phase * 2)) * envelope * (1 - progress * 0.25)),
      ),
    });
  }
  return sections;
}
