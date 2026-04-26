/**
 * Service implementation for parser operations. Encapsulates domain workflows and provider/repository integration.
 */
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import type { IParserService } from '../interfaces/parser.service.interface.js';

/**
 * Implementation of the Parser Service.
 * Responsible for reading uploaded files from the filesystem and extracting raw text from them.
 * Supports PDF, DOCX, and plain text files.
 */
export class ParserServiceImpl implements IParserService {
  /**
   * Parses a file stored on the disk and extracts its textual content based on its MIME type.
   *
   * @param storagePath - The absolute or relative path to the file on the filesystem
   * @param mimeType - The MIME type of the file (e.g., 'application/pdf', 'text/plain')
   * @returns A promise that resolves to the extracted text string
   */
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
