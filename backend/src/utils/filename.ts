function looksLikeMojibake(value: string): boolean {
  return /Ã.|Â.|á»|áº|Æ|Ð|�/.test(value);
}

export function normalizeUploadedFilename(originalName: string): string {
  if (!originalName) {
    return originalName;
  }

  if (!looksLikeMojibake(originalName)) {
    return originalName;
  }

  try {
    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    if (!decoded || decoded.includes('\u0000') || decoded.includes('�')) {
      return originalName;
    }
    return decoded;
  } catch {
    return originalName;
  }
}
