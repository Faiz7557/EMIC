export interface BomItem {
  id: string;
  perangkat: "simpul" | "pager";
  komponen: string;
  jumlah: number;
  harga: number;
  sumber: string;
}

/** Lampiran C. Harga komponen; tidak termasuk kirim, PPN, dan perakitan. */
export const bom = [
  { id: "esp32-s3", perangkat: "simpul", komponen: "ESP32-S3-DevKitC-1 asli Espressif", jumlah: 1, harga: 420000, sumber: "Tokopedia (2026)" },
  { id: "inmp441", perangkat: "simpul", komponen: "Mikrofon INMP441", jumlah: 1, harga: 34680, sumber: "Tokopedia (2026)" },
  { id: "led", perangkat: "simpul", komponen: "Cincin LED WS2812 12 titik", jumlah: 1, harga: 25000, sumber: "Estimasi" },
  { id: "connectors", perangkat: "simpul", komponen: "Tombol, kabel, konektor, dioda, resistor", jumlah: 1, harga: 15000, sumber: "Estimasi" },
  { id: "node-case", perangkat: "simpul", komponen: "Casing PLA cetak 3D ±100 g", jumlah: 1, harga: 35000, sumber: "Estimasi" },
  { id: "adapter", perangkat: "simpul", komponen: "Adaptor USB 5 V", jumlah: 1, harga: 35000, sumber: "Estimasi" },
  { id: "pager-board", perangkat: "pager", komponen: "Modul ESP32-C3, motor getar, 4 LED, transistor", jumlah: 1, harga: 65000, sumber: "Estimasi" },
  { id: "battery", perangkat: "pager", komponen: "Li-Po 1000 mAh dan TP4056", jumlah: 1, harga: 45000, sumber: "Estimasi" },
  { id: "pager-case", perangkat: "pager", komponen: "Casing dan tombol", jumlah: 1, harga: 20000, sumber: "Estimasi" },
] as const satisfies readonly BomItem[];

const subtotal = (device: BomItem["perangkat"]) => bom.filter((item) => item.perangkat === device).reduce((sum, item) => sum + item.jumlah * item.harga, 0);
export const bomTotals = { node: subtotal("simpul"), pager: subtotal("pager"), kit: 4 * subtotal("simpul") + subtotal("pager") };
export const BOM = bom;
