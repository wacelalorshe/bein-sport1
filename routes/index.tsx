import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { connectPrinter, sendToPrinter, type PrinterConnection } from "@/lib/printer";
import { buildInvoiceRaster } from "@/lib/raster-printer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "وسيل سوفت — نظام الفواتير" },
      { name: "description", content: "نظام إدارة الفواتير المتكامل مع طباعة بلوتوث حرارية بدعم النص العربي." },
    ],
  }),
  component: InvoicePage,
});

type Item = { id: string; name: string; price: number; qty: number };
type Status = "idle" | "connecting" | "connected" | "error" | "printing";

const PAPER_WIDTHS: { label: string; value: 58 | 80 }[] = [
  { label: "58 مم", value: 58 },
  { label: "80 مم", value: 80 },
];

function InvoicePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("جاهز للاتصال بالطابعة");
  const [conn, setConn] = useState<PrinterConnection | null>(null);
  const [paperMm, setPaperMm] = useState<58 | 80>(58);

  const [customer, setCustomer] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(() => `INV-${Date.now().toString().slice(-6)}`);

  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pQty, setPQty] = useState("1");
  const [items, setItems] = useState<Item[]>([]);

  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleConnect = async () => {
    setStatus("connecting");
    setStatusMsg("جاري البحث عن الطابعة...");
    try {
      const c = await connectPrinter();
      setConn(c);
      setStatus("connected");
      setStatusMsg(`متصل بـ ${c.device.name ?? "الطابعة"}`);
      showToast("تم الاتصال بالطابعة بنجاح", "ok");
      c.device.addEventListener("gattserverdisconnected", () => {
        setConn(null);
        setStatus("idle");
        setStatusMsg("انقطع الاتصال بالطابعة");
      });
    } catch (e) {
      setStatus("error");
      setStatusMsg((e as Error).message);
      showToast((e as Error).message, "err");
    }
  };

  const handleAdd = () => {
    const price = parseFloat(pPrice);
    const qty = parseInt(pQty) || 1;
    if (!pName.trim() || isNaN(price) || price <= 0) {
      showToast("أدخل اسم المنتج والسعر بشكل صحيح", "err");
      return;
    }
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: pName.trim(), price, qty }]);
    setPName("");
    setPPrice("");
    setPQty("1");
  };

  const handleDelete = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const handlePrint = async () => {
    if (!conn) { showToast("اتصل بالطابعة أولاً", "err"); return; }
    if (items.length === 0) { showToast("أضف منتجات قبل الطباعة", "err"); return; }

    setStatus("printing");
    setStatusMsg("جاري تجهيز الفاتورة...");
    try {
      const bytes = await buildInvoiceRaster(
        {
          title: "وسيل سوفت",
          subtitle: "نظام الفواتير المتكامل",
          invoiceNo,
          customer,
          items,
          total,
          currency: "ر.ي",
          footer1: "شكراً لتعاملكم معنا",
          footer2: "www.waseelsoft.com",
        },
        paperMm
      );
      setStatusMsg("جاري الطباعة...");
      await sendToPrinter(conn, bytes);
      setStatus("connected");
      setStatusMsg(`متصل بـ ${conn.device.name ?? "الطابعة"}`);
      showToast("تمت الطباعة بنجاح ✓", "ok");
    } catch (e) {
      setStatus("error");
      setStatusMsg("فشلت الطباعة: " + (e as Error).message);
      showToast("فشلت الطباعة", "err");
    }
  };

  const dotColor =
    status === "connected" ? "bg-success shadow-[0_0_10px_var(--color-success)]"
    : status === "connecting" || status === "printing" ? "bg-warning animate-pulse"
    : status === "error" ? "bg-destructive"
    : "bg-muted-foreground/40";

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto w-full max-w-xl space-y-4">
        {/* Header */}
        <header
          className="rounded-3xl p-6 text-center text-primary-foreground shadow-[var(--shadow-elegant)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <h1 className="text-3xl font-black tracking-tight">🧾 وسيل سوفت</h1>
          <p className="mt-1 text-sm opacity-90">نظام إدارة الفواتير والمبيعات المتكامل</p>
        </header>

        {/* Status */}
        <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
          <span className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
          <span className="text-sm text-muted-foreground">{statusMsg}</span>
        </div>

        {/* Printer */}
        <Card title="🖨️ إعدادات الطابعة">
          <button
            onClick={handleConnect}
            disabled={status === "connecting"}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-bold text-primary-foreground shadow-[var(--shadow-elegant)] transition active:scale-[0.97] disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          >
            📡 {conn ? "إعادة الاتصال" : "اتصال بالطابعة"}
          </button>
          <div className="mt-3">
            <Label>📐 عرض ورق الطباعة</Label>
            <select
              value={paperMm}
              onChange={(e) => setPaperMm(parseInt(e.target.value) as 58 | 80)}
              className="w-full rounded-xl border-2 border-input bg-muted/40 px-4 py-3 text-sm font-semibold focus:border-ring focus:bg-card focus:outline-none"
            >
              {PAPER_WIDTHS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              💡 يُطبع النص العربي كصورة عالية الجودة (raster) — يدعم جميع الطابعات.
            </p>
          </div>
        </Card>

        {/* Customer */}
        <Card title="👤 بيانات الفاتورة">
          <Label>اسم العميل</Label>
          <Input value={customer} onChange={setCustomer} placeholder="اسم العميل (اختياري)" />
          <Label>رقم الفاتورة</Label>
          <Input value={invoiceNo} onChange={setInvoiceNo} placeholder="رقم الفاتورة" />
        </Card>

        {/* Add product */}
        <Card title="➕ إضافة منتج">
          <Label>اسم المنتج</Label>
          <Input value={pName} onChange={setPName} placeholder="مثال: شاي" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>السعر (ر.ي)</Label>
              <Input value={pPrice} onChange={setPPrice} placeholder="0" type="number" />
            </div>
            <div>
              <Label>الكمية</Label>
              <Input value={pQty} onChange={setPQty} placeholder="1" type="number" />
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-bold text-success-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.97]"
            style={{ background: "var(--gradient-success)" }}
          >
            ✨ إضافة المنتج
          </button>
        </Card>

        {/* Items */}
        <Card title="📋 المنتجات المضافة">
          {items.length === 0 ? (
            <p className="rounded-xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">
              🎯 لا توجد منتجات بعد
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">المنتج</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="p-3 font-semibold">{it.name}</td>
                      <td className="p-3">{it.qty}</td>
                      <td className="p-3 font-mono">{(it.price * it.qty).toFixed(0)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleDelete(it.id)}
                          className="rounded-lg px-2 py-1 text-destructive hover:bg-destructive/10"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            className="mt-4 flex items-center justify-between rounded-2xl px-5 py-4 text-primary-foreground shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <span className="text-sm font-semibold opacity-90">💰 الإجمالي</span>
            <span className="font-mono text-2xl font-black">{total.toFixed(0)} ر.ي</span>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handlePrint}
            disabled={status === "printing" || !conn || items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-4 text-lg font-bold text-background shadow-[var(--shadow-elegant)] transition active:scale-[0.98] disabled:opacity-50"
          >
            🖨️ {status === "printing" ? "جاري الطباعة..." : "طباعة الفاتورة"}
          </button>
          <button
            onClick={() => setItems([])}
            disabled={items.length === 0}
            className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition active:scale-[0.98] disabled:opacity-40"
          >
            🗑️ مسح جميع المنتجات
          </button>
        </div>

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} وسيل سوفت — طباعة نصية مباشرة عبر Bluetooth
        </footer>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-2xl transition ${
            toast.type === "ok" ? "bg-success" : "bg-destructive"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 mt-2 block text-sm font-bold text-foreground">{children}</label>;
}

function Input({
  value, onChange, placeholder, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border-2 border-input bg-muted/40 px-4 py-3 text-sm font-semibold transition focus:border-ring focus:bg-card focus:outline-none focus:ring-4 focus:ring-ring/15"
    />
  );
}
