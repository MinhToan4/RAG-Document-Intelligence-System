export type SupportedQuestionLanguage = 'vi' | 'en';

const VIETNAMESE_CHAR_REGEX =
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const VIETNAMESE_HINT_WORDS = new Set([
    'va',
    'la',
    'cua',
    'khong',
    'gi',
    'nao',
    'toi',
    'ban',
    'duoc',
    'trong',
    'tai',
    'lieu',
    'tom',
    'tat',
    'giai',
    'thich',
    'cho',
    'biet',
    'viet',
    'tieng',
]);

const ENGLISH_HINT_WORDS = new Set([
    'the',
    'what',
    'which',
    'how',
    'why',
    'where',
    'when',
    'summarize',
    'summary',
    'document',
    'explain',
    'please',
    'can',
    'could',
    'should',
    'does',
    'is',
    'are',
]);

function normalizePlainText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function detectQuestionLanguage(question: string): SupportedQuestionLanguage {
    const trimmed = question.trim();
    if (!trimmed) {
        return 'en';
    }

    if (VIETNAMESE_CHAR_REGEX.test(trimmed)) {
        return 'vi';
    }

    const normalized = normalizePlainText(trimmed);
    const tokens = normalized.match(/[a-z]+/g) ?? [];

    let viScore = 0;
    let enScore = 0;

    for (const token of tokens) {
        if (VIETNAMESE_HINT_WORDS.has(token)) {
            viScore += 1;
        }
        if (ENGLISH_HINT_WORDS.has(token)) {
            enScore += 1;
        }
    }

    return viScore > enScore ? 'vi' : 'en';
}

export function fallbackAnswerForLanguage(language: SupportedQuestionLanguage): string {
    return language === 'vi'
        ? 'Không tìm thấy thông tin liên quan trong các tài liệu đã cung cấp.'
        : 'No relevant information was found in the provided documents.';
}

export function instructionLanguageName(language: SupportedQuestionLanguage): string {
    return language === 'vi' ? 'Vietnamese' : 'English';
}

function includesAny(haystack: string, needles: string[]): boolean {
    return needles.some((needle) => haystack.includes(needle));
}

export function isListAvailableDocumentsIntent(question: string): boolean {
    const normalized = normalizePlainText(question);

    const documentHints = [
        'tai lieu',
        'tailieu',
        'document',
        'documents',
        'file',
        'files',
    ];
    const listHints = [
        'liet ke',
        'danh sach',
        'list',
        'show',
        'which',
        'what',
    ];
    const availabilityHints = [
        'co san',
        'san sang',
        'available',
        'ready',
    ];
    const contentTaskHints = ['tom tat', 'giai thich', 'summary', 'summarize', 'explain', 'noi dung', 'content'];

    if (includesAny(normalized, contentTaskHints)) {
        return false;
    }

    const hasDocumentHint = includesAny(normalized, documentHints);
    const hasListHint = includesAny(normalized, listHints);
    const hasAvailabilityHint = includesAny(normalized, availabilityHints);

    return hasDocumentHint && hasListHint && (hasAvailabilityHint || normalized.includes('all document'));
}

export function buildAvailableDocumentsAnswer(
    language: SupportedQuestionLanguage,
    documentNames: string[],
): string {
    if (documentNames.length === 0) {
        return language === 'vi'
            ? 'Hiện chưa có tài liệu nào ở trạng thái sẵn sàng.'
            : 'There are currently no documents in ready status.';
    }

    const header =
        language === 'vi' ? 'Các tài liệu sẵn sàng hiện có:' : 'The available ready documents are:';
    const items = documentNames.map((name) => `- ${name}`);
    return [header, '', ...items].join('\n');
}