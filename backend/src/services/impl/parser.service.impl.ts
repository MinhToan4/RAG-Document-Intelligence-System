import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import type { IParserService } from './parser.service.interface.js';

export class ParserServiceImpl implements IParserService {
  async parseFile(storagePath: string, mimeType: string): Promise<string> {
    const fileBuffer = await fs.readFile(storagePath);

    if (mimeType === 'application/pdf') {
      const parsed = await pdfParse(fileBuffer);
      return parsed.text ?? '';
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const parsed = await mammoth.extractRawText({ buffer: fileBuffer });
      return parsed.value ?? '';
    }

    if (mimeType === 'text/plain') {
      return fileBuffer.toString('utf8');
    }

    throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}
