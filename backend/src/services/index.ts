/**
 * Service composition module exporting backend service contracts and implementations.
 */
export { EmbeddingServiceImpl } from './impl/embedding.service.impl.js';
export type { IEmbeddingService } from './impl/embedding.service.interface.js';

export { GenerationServiceImpl } from './impl/generation.service.impl.js';
export type { IGenerationService } from './impl/generation.service.interface.js';

export { ParserServiceImpl } from './impl/parser.service.impl.js';
export type { IParserService } from './impl/parser.service.interface.js';

export { RetrievalServiceImpl } from './impl/retrieval.service.impl.js';
export type { AskInput, IRetrievalService } from './impl/retrieval.service.interface.js';

export { IngestionServiceImpl } from './impl/ingestion.service.impl.js';
export type { IIngestionService, ListDocumentsInput } from './impl/ingestion.service.interface.js';

export { AuthServiceImpl } from './impl/auth.service.impl.js';
export type { AuthResult, IAuthService } from './impl/auth.service.interface.js';
