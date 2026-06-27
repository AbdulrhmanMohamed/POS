import JsBarcode from 'jsbarcode';

export function generateBarcodeSVG(barcode, format = 'CODE128', options = {}) {
  if (typeof document === 'undefined') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><text x="150" y="50" text-anchor="middle" font-family="monospace" font-size="14">${barcode}</text></svg>`;
  }

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    JsBarcode(svg, barcode, {
      format,
      width: 1.5,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      ...options,
    });

    return svg.outerHTML;
  } catch (e) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><text x="150" y="45" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold">${barcode}</text></svg>`;
  }
}
