export class Sanitizer {
  static sanitizeString(value, maxLength = 255) {
    if (value === null || value === undefined) return null;
    const sanitized = String(value).trim().slice(0, maxLength);
    return sanitized.replace(/[<>]/g, '');
  }

  static sanitizeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  static sanitizeInteger(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  static sanitizeBoolean(value, defaultValue = false) {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  }

  static sanitizePhone(value) {
    if (!value) return null;
    return String(value).replace(/[^0-9+\-\s]/g, '').slice(0, 20);
  }

  static sanitizeEmail(value) {
    if (!value) return null;
    const email = String(value).trim().toLowerCase().slice(0, 255);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? email : null;
  }

  static sanitizeBarcode(value) {
    if (!value) return null;
    return String(value).trim().replace(/[^0-9a-zA-Z\-_]/g, '').slice(0, 50);
  }

  static sanitizeObject(obj, schema) {
    const sanitized = {};
    for (const [key, rules] of Object.entries(schema)) {
      const value = obj[key];
      if (rules.required && (value === null || value === undefined || value === '')) {
        throw new Error(`${key} is required`);
      }
      switch (rules.type) {
        case 'string':
          sanitized[key] = this.sanitizeString(value, rules.maxLength);
          break;
        case 'number':
          sanitized[key] = this.sanitizeNumber(value, rules.default);
          break;
        case 'integer':
          sanitized[key] = this.sanitizeInteger(value, rules.default);
          break;
        case 'boolean':
          sanitized[key] = this.sanitizeBoolean(value, rules.default);
          break;
        case 'phone':
          sanitized[key] = this.sanitizePhone(value);
          break;
        case 'email':
          sanitized[key] = this.sanitizeEmail(value);
          break;
        case 'barcode':
          sanitized[key] = this.sanitizeBarcode(value);
          break;
        default:
          sanitized[key] = value;
      }
    }
    return sanitized;
  }
}