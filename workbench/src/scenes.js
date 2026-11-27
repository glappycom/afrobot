/**
 * Synthetic drawings used for practice and tests.
 * They are generated in the browser. They are not photographs and not student work.
 * Variants 0–3 are the practice set. Higher variants move and recolor the drawing
 * so a test can ask the model about a picture it was not trained on.
 */
export const SCENE_SIZE = 224;

export function scenePixels(kind, variant = 0) {
  const w = SCENE_SIZE;
  const h = SCENE_SIZE;
  const data = new Uint8Array(w * h * 3);
  const bg = [168 + variant * 3, 132 + (variant % 3) * 4, 96];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      const grain = ((x * 3 + y * 5 + variant * 11) % 17) - 8;
      data[i] = bg[0] + grain;
      data[i + 1] = bg[1] + grain / 2;
      data[i + 2] = bg[2];
    }
  }
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 3;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  };
  const fillRect = (x0, y0, x1, y1, r, g, b) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) set(x, y, r, g, b);
    }
  };
  const ox = (variant % 5) * 6 - 12;
  const oy = (variant % 3) * 5 - 6;
  if (kind === 'paper') {
    fillRect(48 + ox, 36 + oy, 176 + ox, 196 + oy, 246, 243, 234);
    for (let y = 58 + oy; y < 180 + oy; y += 12 + (variant % 2)) {
      fillRect(60 + ox, y, 164 + ox, y + 2, 70, 78, 90);
    }
  } else if (kind === 'plastic') {
    const cx = 112 + ox;
    const cy = 120 + oy;
    const rx = 28 + (variant % 3) * 2;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / 62;
        if (dx * dx + dy * dy <= 1) set(x, y, 30, 176, 186);
      }
    }
    fillRect(cx - 12, 42 + oy, cx + 12, 78 + oy, 18, 92, 140);
    fillRect(cx - 16, 36 + oy, cx + 16, 48 + oy, 12, 70, 120);
  } else if (kind === 'mix') {
    fillRect(48, 36, 176, 196, 246, 243, 234);
    for (let y = 58; y < 180; y += 12) fillRect(60, y, 164, y + 2, 70, 78, 90);
    const cx = 112;
    const cy = 120;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = (x - cx) / 28;
        const dy = (y - cy) / 62;
        if (dx * dx + dy * dy <= 1) set(x, y, 30, 176, 186);
      }
    }
  }
  return data;
}
