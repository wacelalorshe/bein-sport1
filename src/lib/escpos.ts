// ESC/POS command builder for thermal printers with Arabic (CP864) support.
import { shapeArabic } from "./arabic-shaper";

// Unicode -> CP864 byte mapping for Arabic presentation forms.
// CP864 is the most widely supported Arabic codepage in thermal printers.
const CP864_MAP: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  // ASCII passthrough
  for (let i = 0; i < 128; i++) m[i] = i;

  // Arabic presentation forms FE80-FEFF -> CP864 high bytes
  // Reference: standard CP864 mapping table
  const pairs: [number, number][] = [
    [0xFE80, 0x8C], [0xFE81, 0xC1], [0xFE82, 0xC2], [0xFE83, 0xC3], [0xFE84, 0xC4],
    [0xFE85, 0xC5], [0xFE86, 0xC5], [0xFE87, 0xC6], [0xFE88, 0xC6], [0xFE89, 0xC7],
    [0xFE8A, 0xC7], [0xFE8B, 0xC7], [0xFE8C, 0xC7], [0xFE8D, 0xC8], [0xFE8E, 0xC8],
    [0xFE8F, 0xC9], [0xFE90, 0xC9], [0xFE91, 0xCA], [0xFE92, 0xCA],
    [0xFE93, 0xCB], [0xFE94, 0xCB],
    [0xFE95, 0xCC], [0xFE96, 0xCC], [0xFE97, 0xCD], [0xFE98, 0xCD],
    [0xFE99, 0xCE], [0xFE9A, 0xCE], [0xFE9B, 0xCF], [0xFE9C, 0xCF],
    [0xFE9D, 0xD0], [0xFE9E, 0xD0], [0xFE9F, 0xD1], [0xFEA0, 0xD1],
    [0xFEA1, 0xD2], [0xFEA2, 0xD2], [0xFEA3, 0xD3], [0xFEA4, 0xD3],
    [0xFEA5, 0xD4], [0xFEA6, 0xD4], [0xFEA7, 0xD5], [0xFEA8, 0xD5],
    [0xFEA9, 0xD6], [0xFEAA, 0xD6],
    [0xFEAB, 0xD7], [0xFEAC, 0xD7],
    [0xFEAD, 0xD8], [0xFEAE, 0xD8],
    [0xFEAF, 0xD9], [0xFEB0, 0xD9],
    [0xFEB1, 0xDA], [0xFEB2, 0xDA], [0xFEB3, 0xDB], [0xFEB4, 0xDB],
    [0xFEB5, 0xDC], [0xFEB6, 0xDC], [0xFEB7, 0xDD], [0xFEB8, 0xDD],
    [0xFEB9, 0xDE], [0xFEBA, 0xDE], [0xFEBB, 0xDF], [0xFEBC, 0xDF],
    [0xFEBD, 0xE0], [0xFEBE, 0xE0], [0xFEBF, 0xE1], [0xFEC0, 0xE1],
    [0xFEC1, 0xE2], [0xFEC2, 0xE2], [0xFEC3, 0xE3], [0xFEC4, 0xE3],
    [0xFEC5, 0xE4], [0xFEC6, 0xE4], [0xFEC7, 0xE5], [0xFEC8, 0xE5],
    [0xFEC9, 0xE6], [0xFECA, 0xE6], [0xFECB, 0xE7], [0xFECC, 0xE7],
    [0xFECD, 0xE8], [0xFECE, 0xE8], [0xFECF, 0xE9], [0xFED0, 0xE9],
    [0xFED1, 0xEA], [0xFED2, 0xEA], [0xFED3, 0xEB], [0xFED4, 0xEB],
    [0xFED5, 0xEC], [0xFED6, 0xEC], [0xFED7, 0xED], [0xFED8, 0xED],
    [0xFED9, 0xEE], [0xFEDA, 0xEE], [0xFEDB, 0xEF], [0xFEDC, 0xEF],
    [0xFEDD, 0xF0], [0xFEDE, 0xF0], [0xFEDF, 0xF1], [0xFEE0, 0xF1],
    [0xFEE1, 0xF2], [0xFEE2, 0xF2], [0xFEE3, 0xF3], [0xFEE4, 0xF3],
    [0xFEE5, 0xF4], [0xFEE6, 0xF4], [0xFEE7, 0xF5], [0xFEE8, 0xF5],
    [0xFEE9, 0xF6], [0xFEEA, 0xF6], [0xFEEB, 0xF7], [0xFEEC, 0xF7],
    [0xFEED, 0xF8], [0xFEEE, 0xF8],
    [0xFEEF, 0xF9], [0xFEF0, 0xF9],
    [0xFEF1, 0xFA], [0xFEF2, 0xFA], [0xFEF3, 0xFB], [0xFEF4, 0xFB],
    // Arabic-Indic digits ٠-٩ -> CP864 0xB0-0xB9
    [0x0660, 0xB0], [0x0661, 0xB1], [0x0662, 0xB2], [0x0663, 0xB3], [0x0664, 0xB4],
    [0x0665, 0xB5], [0x0666, 0xB6], [0x0667, 0xB7], [0x0668, 0xB8], [0x0669, 0xB9],
  ];
  for (const [u, b] of pairs) m[u] = b;
  return m;
})();

function encodeCP864(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code in CP864_MAP) bytes.push(CP864_MAP[code]);
    else if (code < 256) bytes.push(code);
    else bytes.push(0x3F); // ?
  }
  return new Uint8Array(bytes);
}

const ESC = 0x1B;
const GS = 0x1D;

export const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;

export class EscPosBuilder {
  private chunks: number[] = [];
  private width: number;

  constructor(width: number = 32) {
    this.width = width;
    // Initialize printer + select CP864 (Arabic) — code page 22 on most printers
    this.chunks.push(ESC, 0x40); // ESC @ - init
    this.chunks.push(ESC, 0x74, 0x16); // ESC t 22 - codepage CP864
  }

  align(a: number) {
    this.chunks.push(ESC, 0x61, a);
    return this;
  }

  bold(on: boolean) {
    this.chunks.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  size(w: 0 | 1, h: 0 | 1) {
    // GS ! n  — n bits: width<<4 | height
    this.chunks.push(GS, 0x21, (w << 4) | h);
    return this;
  }

  text(s: string) {
    const shaped = shapeArabic(s);
    const bytes = encodeCP864(shaped);
    this.chunks.push(...bytes);
    return this;
  }

  raw(s: string) {
    // No shaping — for ASCII / digits.
    const bytes = encodeCP864(s);
    this.chunks.push(...bytes);
    return this;
  }

  newline(n = 1) {
    for (let i = 0; i < n; i++) this.chunks.push(0x0A);
    return this;
  }

  line(char = "-") {
    this.raw(char.repeat(this.width)).newline();
    return this;
  }

  /** Two-column row: label (Arabic, right side) and value (LTR, left side). */
  row(label: string, value: string) {
    const valStr = String(value);
    // Print value first (will appear on left after RTL framing isn't needed since printer is LTR);
    // we want label on RIGHT and value on LEFT visually. With LTR printer, that means value first, then spaces, then shaped Arabic.
    const shapedLabel = shapeArabic(label);
    // Compute visible width approximated by character count of shapedLabel + value.
    const totalLen = [...shapedLabel].length + valStr.length;
    const pad = Math.max(1, this.width - totalLen);
    const valBytes = encodeCP864(valStr);
    const padBytes = encodeCP864(" ".repeat(pad));
    const labBytes = encodeCP864(shapedLabel);
    this.chunks.push(...valBytes, ...padBytes, ...labBytes);
    this.newline();
    return this;
  }

  cut() {
    this.chunks.push(GS, 0x56, 0x00);
    return this;
  }

  feed(n = 3) {
    this.chunks.push(ESC, 0x64, n);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}
