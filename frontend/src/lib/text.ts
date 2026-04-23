function looksLikeMojibake(value: string): boolean {
  return /Ã.|Â.|á»|áº|Æ|Ð|�/.test(value);
}

export function normalizeMojibakeText(value: string): string {
  if (!value || !looksLikeMojibake(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded || decoded.includes('\u0000') || decoded.includes('�')) {
      return value;
    }
    return decoded;
  } catch {
    return value;
  }
}
