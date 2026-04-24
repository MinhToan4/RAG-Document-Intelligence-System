import type { ChunkSearchResult } from '../types/index.js';
import {
  fallbackAnswerForLanguage,
  instructionLanguageName,
  type SupportedQuestionLanguage,
} from './language.js';

export function buildGroundedPrompt(
  question: string,
  chunks: ChunkSearchResult[],
  language: SupportedQuestionLanguage,
): string {
  const context = chunks
    .map(
      (chunk, idx) =>
        `[#${idx + 1}] [${chunk.documentName} - chunk ${chunk.chunkIndex}] (score ${chunk.score.toFixed(
          3,
        )})\n${chunk.content}`,
    )
    .join('\n\n');

  const fallbackAnswer = fallbackAnswerForLanguage(language);
  const languageName = instructionLanguageName(language);

  return [
    'You are a document QA assistant.',
    'Only answer using the provided context.',
    'If the context does not contain the answer, reply exactly:',
    `"${fallbackAnswer}"`,
    `Always answer in ${languageName}.`,
    'Do not mix answer language with another language unless quoting source text.',
    'Return the answer in clean markdown format with short sections and bullet points when appropriate.',
    'Do not output one long paragraph.',
    'IMPORTANT: When citing sources, include citations INLINE in your answer using this exact format: [filename.pdf - chunk N] or [filename.docx - chunk N].',
    'Place citations right after the relevant sentence or paragraph they support.',
    'For example: "The museum was built in 1920 [Hồ sơ Đề xuất Kỹ thuật 360.pdf - chunk 2]. It contains artifacts from...[Hồ sơ Đề xuất Kỹ thuật 360.pdf - chunk 3]."',
    'Use the exact document names from the context provided below.',
    'Avoid citation-only lines and do not append a footer with file names at the end.',
    '',
    'Context:',
    context,
    '',
    'Question:',
    question,
  ].join('\n');
}
