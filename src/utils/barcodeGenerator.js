function ean13CheckDigit(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += parseInt(data[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check;
}

function upcaCheckDigit(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += parseInt(data[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check;
}

function randomDigits(length) {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * Math.pow(10, Math.max(1, length - 8))).toString().padStart(length - 8, '0');
  return (ts + rand).slice(-length);
}

export function generateBarcode(format = 'numeric12') {
  switch (format) {
    case 'ean13': {
      const data = randomDigits(12);
      return data + ean13CheckDigit(data);
    }
    case 'upca': {
      const data = randomDigits(11);
      return data + upcaCheckDigit(data);
    }
    case 'code128': {
      const ts = Date.now().toString(36).toUpperCase();
      const rand = Math.floor(Math.random() * 1000000).toString(36).toUpperCase().padStart(4, '0');
      return `BC-${ts}${rand}`;
    }
    case 'pos': {
      const ts = Date.now().toString().slice(-8);
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `POS-${ts}${rand}`;
    }
    default: {
      const ts = Date.now().toString().slice(-8);
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${ts}${rand}`;
    }
  }
}

export function getBarcodeFormatLabel(format, t) {
  const labels = {
    ean13: t?.('settings.ean13') || 'EAN-13 (13 digits)',
    upca: t?.('settings.upca') || 'UPC-A (12 digits)',
    code128: t?.('settings.code128') || 'Code 128 (Alphanumeric)',
    numeric12: t?.('settings.numeric12') || '12-Digit Numeric',
    pos: t?.('settings.posFormat') || 'POS Format (Legacy)',
  };
  return labels[format] || format;
}
