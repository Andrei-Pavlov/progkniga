/**
 * Конвертация текста в символы языка книги.
 * Работает с любыми алфавитами (латиница, кириллица и т.д.).
 */

export interface BookLanguageMapping {
  id: string;
  language_id: string;
  source_char: string;
  symbol: string;
}

export interface BookLanguageWord {
  id: string;
  language_id: string;
  source_word: string;
  symbol: string;
}

/** Создаёт Map для быстрого поиска: символ/слово → замена */
function buildCharMap(mappings: BookLanguageMapping[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of mappings) {
    if (m.source_char) map.set(m.source_char, m.symbol);
  }
  return map;
}

/** Создаёт Map для слов (словарь), ключи в нижнем регистре для поиска */
function buildWordMap(words: BookLanguageWord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const w of words) {
    const key = w.source_word.trim().toLowerCase();
    if (key) map.set(key, w.symbol);
  }
  return map;
}

/**
 * Конвертирует текст в символы языка.
 * Сначала проверяются слова (длинные совпадения), затем символы.
 */
export function convertToLanguage(
  text: string,
  charMappings: BookLanguageMapping[],
  wordMappings: BookLanguageWord[] = []
): string {
  const charMap = buildCharMap(charMappings);
  const wordMap = buildWordMap(wordMappings);

  if (wordMap.size > 0) {
    // Разбиваем на слова, для каждого слова проверяем словарь
    const words = text.split(/(\s+|[^\s]+)/);
    return words
      .map((token) => {
        const trimmed = token.trim();
        if (!trimmed) return token;
        const lower = trimmed.toLowerCase();
        const wordSymbol = wordMap.get(lower);
        if (wordSymbol) return wordSymbol;
        // Иначе посимвольно
        return [...token].map((c) => charMap.get(c) ?? c).join('');
      })
      .join('');
  }

  // Только посимвольная замена
  return [...text].map((c) => charMap.get(c) ?? c).join('');
}

/**
 * Обратная конвертация: символы языка → исходный текст.
 * Требует обратного маппинга (symbol → source_char).
 */
export function convertFromLanguage(
  text: string,
  charMappings: BookLanguageMapping[]
): string {
  const reverseMap = new Map<string, string>();
  for (const m of charMappings) {
    if (m.symbol) reverseMap.set(m.symbol, m.source_char);
  }
  return [...text].map((c) => reverseMap.get(c) ?? c).join('');
}
