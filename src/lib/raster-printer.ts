// Render an invoice to a monochrome canvas (with proper Arabic shaping via the
// browser's native text engine) and convert it to ESC/POS GS v 0 raster bytes.
// This works on virtually every cheap Bluetooth thermal printer because we
// bypass the printer's (often missing) Arabic font entirely.

export type RasterItem = { name: string; price: number; qty: number };

export type RasterInvoice = {
  title: string;
  subtitle?: string;
  invoiceNo: string;
  customer?: string;
  items: RasterItem[];
  total: number;
  currency: string;
  footer1?: string;
  footer2?: string;
};

const ESC = 0x1b;
const GS = 0x1d;

/** Wait for the requested font(s) to be ready before drawing. */
async function ensureFont(font: string) {
  try {
    const docFonts = (document as Document).fonts;
    if (docFonts) {
      await Promise.all([
        docFonts.load(`bold 28px ${font}`),
        docFonts.load(`bold 42px ${font}`),
        docFonts.load(`24px ${font}`),
      ]);
      await docFonts.ready;
    }
  } catch {
    /* ignore */
  }
}

type DrawOpts = {
  widthDots: number; // 384 for 58mm, 576 for 80mm
};

/** Render the invoice into an offscreen canvas. Returns the canvas. */
async function renderInvoiceCanvas(
  inv: RasterInvoice,
  opts: DrawOpts
): Promise<HTMLCanvasElement> {
  const FONT = '"Cairo", "Tajawal", system-ui, sans-serif';
  await ensureFont('"Cairo"');

  const W = opts.widthDots;
  const padX = 12;
  const innerW = W - padX * 2;

  // Use a tall scratch canvas; we'll trim to actual height afterwards.
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 2000;
  const ctx = scratch.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, scratch.height);
  ctx.fillStyle = "#000000";
  ctx.direction = "rtl";
  ctx.textBaseline = "top";

  let y = 10;

  // ---------- Title (centered, big bold) ----------
  ctx.font = `bold 42px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(inv.title, W / 2, y);
  y += 50;

  if (inv.subtitle) {
    ctx.font = `24px ${FONT}`;
    ctx.fillText(inv.subtitle, W / 2, y);
    y += 32;
  }

  // separator
  y += 6;
  drawSeparator(ctx, padX, y, W - padX, true);
  y += 14;

  // ---------- Meta rows (label : value) ----------
  ctx.font = `bold 26px ${FONT}`;
  const metaRow = (label: string, value: string) => {
    ctx.textAlign = "right";
    ctx.fillText(label, W - padX, y);
    ctx.textAlign = "left";
    ctx.fillText(value, padX, y);
    y += 34;
  };
  metaRow("رقم الفاتورة:", inv.invoiceNo);
  if (inv.customer && inv.customer.trim()) metaRow("العميل:", inv.customer.trim());
  const now = new Date();
  metaRow("التاريخ:", now.toLocaleDateString("en-GB"));
  metaRow(
    "الوقت:",
    now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );

  y += 4;
  drawSeparator(ctx, padX, y, W - padX, false);
  y += 10;

  // ---------- Items header ----------
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("المنتج", W - padX, y);
  ctx.textAlign = "center";
  ctx.fillText("الكمية", W / 2, y);
  ctx.textAlign = "left";
  ctx.fillText("السعر", padX, y);
  y += 32;
  drawSeparator(ctx, padX, y, W - padX, false);
  y += 8;

  // ---------- Items ----------
  ctx.font = `26px ${FONT}`;
  for (const it of inv.items) {
    // Wrap product name if too long.
    const lines = wrapText(ctx, it.name, innerW * 0.55);
    const lineH = 32;
    const blockH = lines.length * lineH;

    // First line carries qty + price; following lines just continue the name.
    for (let i = 0; i < lines.length; i++) {
      ctx.textAlign = "right";
      ctx.fillText(lines[i], W - padX, y + i * lineH);
    }
    ctx.textAlign = "center";
    ctx.fillText(String(it.qty), W / 2, y);
    ctx.textAlign = "left";
    ctx.fillText((it.price * it.qty).toFixed(0), padX, y);
    y += blockH + 4;
  }

  y += 6;
  drawSeparator(ctx, padX, y, W - padX, true);
  y += 14;

  // ---------- Total (big) ----------
  ctx.font = `bold 36px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("الإجمالي", W - padX, y);
  ctx.textAlign = "left";
  ctx.fillText(`${inv.total.toFixed(0)} ${inv.currency}`, padX, y);
  y += 48;
  drawSeparator(ctx, padX, y, W - padX, true);
  y += 20;

  // ---------- Footer ----------
  ctx.font = `26px ${FONT}`;
  ctx.textAlign = "center";
  if (inv.footer1) {
    ctx.fillText(inv.footer1, W / 2, y);
    y += 34;
  }
  if (inv.footer2) {
    ctx.font = `22px ${FONT}`;
    ctx.fillText(inv.footer2, W / 2, y);
    y += 30;
  }

  // Bottom whitespace before paper cut
  y += 30;

  // Trim canvas to actual height (round up to multiple of 8 for raster).
  const finalH = Math.ceil(y / 8) * 8;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = finalH;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, W, finalH);
  octx.drawImage(scratch, 0, 0);
  return out;
}

function drawSeparator(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
  bold: boolean
) {
  ctx.fillRect(x1, y, x2 - x1, bold ? 3 : 1);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/** Convert canvas to monochrome ESC/POS GS v 0 raster bytes. */
function canvasToEscposRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;

  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);

  // Threshold + pack. Simple Atkinson-like ordered threshold (no dithering for
  // crisp text). Pixel is "black" when luminance < 160 OR alpha > 0 dark.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
      // Treat transparent as white.
      const lum = a === 0 ? 255 : (r * 0.299 + g * 0.587 + b * 0.114);
      if (lum < 160) {
        const byteIdx = y * bytesPerRow + (x >> 3);
        raster[byteIdx] |= 0x80 >> (x & 7);
      }
    }
  }

  // Build full command stream.
  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const header = new Uint8Array([
    ESC, 0x40,            // init
    ESC, 0x61, 0x01,      // center align (image will be centered)
    GS, 0x76, 0x30, 0x00, // GS v 0  m=0 (normal)
    xL, xH, yL, yH,
  ]);
  const footer = new Uint8Array([
    0x0a, 0x0a, 0x0a,     // line feeds
    GS, 0x56, 0x00,       // full cut
  ]);

  const out = new Uint8Array(header.length + raster.length + footer.length);
  out.set(header, 0);
  out.set(raster, header.length);
  out.set(footer, header.length + raster.length);
  return out;
}

export async function buildInvoiceRaster(
  inv: RasterInvoice,
  paperMm: 58 | 80
): Promise<Uint8Array> {
  const widthDots = paperMm === 80 ? 576 : 384;
  const canvas = await renderInvoiceCanvas(inv, { widthDots });
  return canvasToEscposRaster(canvas);
}
