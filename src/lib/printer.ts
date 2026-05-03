// Web Bluetooth thermal printer interface.
/// <reference types="web-bluetooth" />

const PRINTER_SERVICES = [
  0x18F0, // Common thermal printer service
  0xFF00,
  0xFFE0,
  0xFFF0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
];

export type PrinterConnection = {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
};

export async function connectPrinter(): Promise<PrinterConnection> {
  if (!("bluetooth" in navigator)) {
    throw new Error("متصفحك لا يدعم Web Bluetooth. استخدم Chrome على أندرويد أو سطح المكتب.");
  }
  const device = await (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  const server = await device.gatt!.connect();
  const services = await server.getPrimaryServices();

  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        return { device, characteristic: ch };
      }
    }
  }
  throw new Error("لم يتم العثور على خاصية كتابة في الطابعة.");
}

export async function sendToPrinter(
  conn: PrinterConnection,
  data: Uint8Array
): Promise<void> {
  // Most BLE characteristics have a 512-byte (often 20-byte) MTU. Chunk to be safe.
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    if (conn.characteristic.properties.writeWithoutResponse) {
      await conn.characteristic.writeValueWithoutResponse(slice);
    } else {
      await conn.characteristic.writeValue(slice);
    }
    // Small delay between chunks to avoid BLE buffer overrun.
    await new Promise((r) => setTimeout(r, 30));
  }
}
