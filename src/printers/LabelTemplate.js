import { generateBarcodeSVG } from '../utils/barcodeRenderer';

export function buildLabelHTML({ productName, barcode, price, currency = '' }) {
  const barcodeSvg = generateBarcodeSVG(barcode, 'CODE128');
  return `
    <div style="width:60mm;padding:4mm;font-family:'Courier New',monospace;text-align:center;background:#fff">
      <div style="font-size:14px;font-weight:bold;margin-bottom:4px;border-bottom:1px solid #ccc;padding-bottom:4px">${productName}</div>
      ${barcodeSvg}
      <div style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;font-size:20px;font-weight:bold">${Number(price).toFixed(2)} ${currency}</div>
    </div>
  `;
}
