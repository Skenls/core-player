/**
 * Formatters and string cleaners for music metadata.
 */

const PATRONYMIC_REGEX = /(?:ович|евич|ич|овна|евна|ична|инична)$/i;

/**
 * Checks if a string segment is a Russian full name (FIO / legal name).
 * Matches names like "Ицков Дмитрий Олегович", "Иванов И. И.", "Иванов Иван Иванович".
 */
function isFioSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return false;

  // Explicit mention of FIO
  if (/^(?:ф\s*[.\s]*и\s*[.\s]*о|фио)$/i.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4) {
    const allCyrillic = words.every((w) => /^[А-Яа-яЁё.\-]+$/.test(w));
    if (!allCyrillic) return false;

    // Has patronymic word (e.g. Олегович)
    const hasPatronymic = words.some((w) => PATRONYMIC_REGEX.test(w));
    if (hasPatronymic) return true;

    // Has initials (e.g. "И. И." or "И.")
    const hasInitials = words.some((w) => /^[А-Яа-яЁё]\.$/.test(w));
    if (hasInitials) return true;
  }

  return false;
}

/**
 * Cleans artist name from legal names / FIO (Фамилия Имя Отчество),
 * separators (•, ·, |, /, ;, ,), and parenthetical names.
 *
 * Examples:
 * - "Kai Angel • Ицков Дмитрий Олегович" -> "Kai Angel"
 * - "LIDA (Паньков Николай Романович)" -> "LIDA"
 * - "Artist (ф и о)" -> "Artist"
 * - "OG Buda / Ляхов Григорий Алексеевич" -> "OG Buda"
 * - "9mice, Дмитриев Сергей Дмитриевич" -> "9mice"
 */
export function cleanArtistName(artist?: string | null): string {
  if (!artist) return '';

  let cleaned = artist.trim();

  // 1. Remove explicit "(ф и о)", "(фио)", "(ф.и.о.)"
  cleaned = cleaned.replace(/\s*\(\s*(?:ф\s*[.\s]*и\s*[.\s]*о|фио)\s*\)/gi, '');

  // 2. Remove parenthetical FIO (contains patronymic, initials or Russian legal full name)
  cleaned = cleaned.replace(/\s*\([^)]*(?:ович|евич|ич|овна|евна|ична|инична)[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*\([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?\)/g, '');
  cleaned = cleaned.replace(/\s*\([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.\)/g, '');

  // 3. Handle separators (•, ·, |, /, ;)
  const separatorRegex = /\s*([•·|;/])\s*/;
  if (separatorRegex.test(cleaned)) {
    const parts = cleaned.split(separatorRegex).filter((p) => !/^[•·|;/]$/.test(p) && p.trim());
    const nonFioParts = parts.filter((part) => !isFioSegment(part));

    if (nonFioParts.length > 0) {
      cleaned = nonFioParts[0].trim();
    } else if (parts.length > 0) {
      cleaned = parts[0].trim();
    }
  }

  // 4. Handle comma-separated list where one part is a FIO (e.g. "Kai Angel, Ицков Дмитрий Олегович")
  if (cleaned.includes(',')) {
    const parts = cleaned.split(/\s*,\s*/).filter(Boolean);
    const nonFioParts = parts.filter((part) => !isFioSegment(part));

    if (nonFioParts.length > 0) {
      cleaned = nonFioParts.join(', ').trim();
    }
  }

  // 5. If the entire name is just a FIO with patronymic, remove the patronymic word
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 3 && words.every((w) => /^[А-Яа-яЁё.\-]+$/.test(w))) {
    const lastWord = words[2];
    if (PATRONYMIC_REGEX.test(lastWord)) {
      cleaned = `${words[0]} ${words[1]}`;
    }
  }

  return cleaned.trim() || artist.trim();
}
