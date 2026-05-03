// Arabic letter shaping for thermal printers (CP864 / Windows-1256 don't auto-shape).
// Maps each Arabic letter to its 4 forms: isolated, initial, medial, final.
// Then reverses for RTL since thermal printers print LTR only.

type Forms = [string, string, string, string]; // [isolated, initial, medial, final]

// Unicode presentation forms (FExx) — these are the "shaped" glyphs.
const ARABIC_FORMS: Record<string, Forms> = {
  "ا": ["\uFE8D", "\uFE8D", "\uFE8E", "\uFE8E"],
  "أ": ["\uFE83", "\uFE83", "\uFE84", "\uFE84"],
  "إ": ["\uFE87", "\uFE87", "\uFE88", "\uFE88"],
  "آ": ["\uFE81", "\uFE81", "\uFE82", "\uFE82"],
  "ب": ["\uFE8F", "\uFE91", "\uFE92", "\uFE90"],
  "ت": ["\uFE95", "\uFE97", "\uFE98", "\uFE96"],
  "ث": ["\uFE99", "\uFE9B", "\uFE9C", "\uFE9A"],
  "ج": ["\uFE9D", "\uFE9F", "\uFEA0", "\uFE9E"],
  "ح": ["\uFEA1", "\uFEA3", "\uFEA4", "\uFEA2"],
  "خ": ["\uFEA5", "\uFEA7", "\uFEA8", "\uFEA6"],
  "د": ["\uFEA9", "\uFEA9", "\uFEAA", "\uFEAA"],
  "ذ": ["\uFEAB", "\uFEAB", "\uFEAC", "\uFEAC"],
  "ر": ["\uFEAD", "\uFEAD", "\uFEAE", "\uFEAE"],
  "ز": ["\uFEAF", "\uFEAF", "\uFEB0", "\uFEB0"],
  "س": ["\uFEB1", "\uFEB3", "\uFEB4", "\uFEB2"],
  "ش": ["\uFEB5", "\uFEB7", "\uFEB8", "\uFEB6"],
  "ص": ["\uFEB9", "\uFEBB", "\uFEBC", "\uFEBA"],
  "ض": ["\uFEBD", "\uFEBF", "\uFEC0", "\uFEBE"],
  "ط": ["\uFEC1", "\uFEC3", "\uFEC4", "\uFEC2"],
  "ظ": ["\uFEC5", "\uFEC7", "\uFEC8", "\uFEC6"],
  "ع": ["\uFEC9", "\uFECB", "\uFECC", "\uFECA"],
  "غ": ["\uFECD", "\uFECF", "\uFED0", "\uFECE"],
  "ف": ["\uFED1", "\uFED3", "\uFED4", "\uFED2"],
  "ق": ["\uFED5", "\uFED7", "\uFED8", "\uFED6"],
  "ك": ["\uFED9", "\uFEDB", "\uFEDC", "\uFEDA"],
  "ل": ["\uFEDD", "\uFEDF", "\uFEE0", "\uFEDE"],
  "م": ["\uFEE1", "\uFEE3", "\uFEE4", "\uFEE2"],
  "ن": ["\uFEE5", "\uFEE7", "\uFEE8", "\uFEE6"],
  "ه": ["\uFEE9", "\uFEEB", "\uFEEC", "\uFEEA"],
  "و": ["\uFEED", "\uFEED", "\uFEEE", "\uFEEE"],
  "ي": ["\uFEF1", "\uFEF3", "\uFEF4", "\uFEF2"],
  "ى": ["\uFEEF", "\uFEEF", "\uFEF0", "\uFEF0"],
  "ة": ["\uFE93", "\uFE93", "\uFE94", "\uFE94"],
  "ؤ": ["\uFE85", "\uFE85", "\uFE86", "\uFE86"],
  "ئ": ["\uFE89", "\uFE8B", "\uFE8C", "\uFE8A"],
  "ء": ["\uFE80", "\uFE80", "\uFE80", "\uFE80"],
};

// Letters that don't connect to the next letter (break the chain).
const NON_CONNECTING = new Set(["ا", "أ", "إ", "آ", "د", "ذ", "ر", "ز", "و", "ؤ", "ء", "ة"]);

function isArabic(ch: string): boolean {
  return ch in ARABIC_FORMS;
}

function shapeWord(word: string): string {
  const chars = [...word];
  const result: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!isArabic(ch)) {
      result.push(ch);
      continue;
    }
    const prev = i > 0 ? chars[i - 1] : "";
    const next = i < chars.length - 1 ? chars[i + 1] : "";

    const connectsBefore = isArabic(prev) && !NON_CONNECTING.has(prev);
    const connectsAfter = isArabic(next);

    let formIdx = 0; // isolated
    if (connectsBefore && connectsAfter && !NON_CONNECTING.has(ch)) formIdx = 2; // medial
    else if (connectsBefore && !connectsAfter) formIdx = 3; // final
    else if (connectsBefore && NON_CONNECTING.has(ch)) formIdx = 3; // final
    else if (!connectsBefore && connectsAfter && !NON_CONNECTING.has(ch)) formIdx = 1; // initial

    result.push(ARABIC_FORMS[ch][formIdx]);
  }
  return result.join("");
}

/**
 * Shapes Arabic text and reverses it for RTL display on LTR-only thermal printers.
 * Numbers and Latin words inside Arabic text are kept in their natural order.
 */
export function shapeArabic(text: string): string {
  const shaped = shapeWord(text);
  // Reverse the whole line because thermal printers print left-to-right.
  // But keep digit/latin runs in their original order.
  const tokens: string[] = [];
  let buffer = "";
  let bufferIsLtr = false;

  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = "";
    }
  };

  for (const ch of shaped) {
    const isLtr = /[A-Za-z0-9.\-:/]/.test(ch);
    if (ch === " ") {
      flush();
      tokens.push(" ");
      bufferIsLtr = false;
    } else if (isLtr !== bufferIsLtr && buffer) {
      flush();
      buffer = ch;
      bufferIsLtr = isLtr;
    } else {
      buffer += ch;
      bufferIsLtr = isLtr;
    }
  }
  flush();

  // Reverse token order for RTL, but each LTR token keeps its internal order;
  // each Arabic token (already shaped) needs char reversal.
  return tokens
    .reverse()
    .map((t) => {
      if (/^[A-Za-z0-9.\-:/ ]+$/.test(t)) return t;
      return [...t].reverse().join("");
    })
    .join("");
}
