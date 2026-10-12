/**
 * Formatters and string cleaners for music metadata.
 */

// Cyrillic and Latin patronymic endings (e.g., Олегович, Dmitrievich, Petrovna, Ivanovych)
const PATRONYMIC_REGEX = /(?:ович|евич|ич|овна|евна|ична|инична|ovich|evich|ich|ovna|evna|ichna|inichna|ovych|evych|ivna|avna)$/i;

const RUSSIAN_SURNAME_REGEX = /(?:ов|ова|ев|ева|ёв|ёва|ин|ина|ын|ына|ский|ская|ской|цкий|цкая|енко|чук|ov|ova|ev|eva|off|in|ina|yn|yna|sky|skiy|skaya|tsky|tskiy|enko|chuk)$/i;

const COMMON_FIRST_NAME_REGEX = /^(?:dmitri|dmitriy|dmitry|dima|sergei|sergey|serezha|nikolai|nikolay|kolya|grigori|grigoriy|grigory|grisha|aleksandr|alexander|alexandr|sasha|shura|aleksei|aleksey|alexey|lesha|ivan|vanya|mikhail|misha|maksim|maxim|artem|artyom|tema|danil|daniil|danila|danya|vladimir|vova|volodya|vladislav|vlad|denis|pavel|pasha|egor|ilya|ilyusha|kirill|timur|roman|roma|anton|antoha|oleg|gleb|matvey|yaroslav|fedor|fedya|stepan|styopa|anna|anya|elena|lena|olga|olya|tatiana|tatyana|tanya|ekaterina|katya|maria|masha|anastasia|nastya|polina|daria|dasha|alisa|ksenia|ksyusha|дмитрий|дима|сергей|серёжа|николай|коля|григорий|гриша|александр|саша|алексей|лёша|иван|ваня|михаил|миша|максим|артём|артем|данил|даниил|данила|владимир|вова|владислав|влад|денис|павел|паша|егор|илья|кирилл|тимур|роман|антон|олег|глеб|матвей|ярослав|фёдор|федор|степан|стёпа|анна|елена|ольга|татьяна|екатерина|мария|анастасия|полина|дарья|алиса|ксения)$/i;

/**
 * Checks if a string segment is a full name / legal name (FIO).
 * Matches names like "Ицков Дмитрий Олегович", "Dmitriy Olegovich Itskov",
 * "Dmitri Itskov", "Иванов И. И.", "Itskov D. O.", "Иванов Иван Иванович".
 */
export function isFioSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return false;

  // Explicit mention of FIO (Russian or Latin)
  if (/^(?:ф\s*[.\s]*и\s*[.\s]*о|фио|f\s*[.\s]*i\s*[.\s]*o|fio)$/i.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4) {
    const allCyrillic = words.every((w) => /^[А-Яа-яЁё.\-]+$/.test(w));
    const allLatin = words.every((w) => /^[A-Za-z.\-']+$/.test(w));
    if (!allCyrillic && !allLatin) return false;

    // Has patronymic word (e.g. Олегович or Olegovich)
    const hasPatronymic = words.some((w) => PATRONYMIC_REGEX.test(w));
    if (hasPatronymic) return true;

    // Has initials (e.g. "И. И." or "И." or "D. O." or "D.")
    const hasInitials = words.some((w) => /^(?:[А-Яа-яЁё]|[A-Za-z])\.$/.test(w));
    if (hasInitials) return true;

    // Common first name + Russian/Slavic surname ending (e.g. "Dmitri Itskov", "Николай Паньков")
    const hasFirstName = words.some((w) => COMMON_FIRST_NAME_REGEX.test(w.replace(/\.$/, '')));
    const hasSurname = words.some((w) => RUSSIAN_SURNAME_REGEX.test(w));
    if (hasFirstName && hasSurname) return true;
  }

  return false;
}

/**
 * Cleans artist name from legal names / FIO (Фамилия Имя Отчество),
 * separators (•, ·, |, /, ;, ,), and parenthetical names.
 *
 * Examples:
 * - "Kai Angel • Ицков Дмитрий Олегович" -> "Kai Angel"
 * - "Kai Angel • Dmitriy Olegovich Itskov" -> "Kai Angel"
 * - "Kai Angel • Dmitri Itskov" -> "Kai Angel"
 * - "LIDA (Паньков Николай Романович)" -> "LIDA"
 * - "Kai Angel (Dmitriy Olegovich Itskov)" -> "Kai Angel"
 * - "Artist (ф и о)" / "Artist (fio)" -> "Artist"
 * - "OG Buda / Ляхов Григорий Алексеевич" -> "OG Buda"
 * - "9mice, Дмитриев Сергей Дмитриевич" -> "9mice"
 * - "Kai Angel - Dmitriy Olegovich Itskov" -> "Kai Angel"
 */
export function cleanArtistName(artist?: string | null): string {
  if (!artist) return '';

  let cleaned = artist.trim();

  // 1. Remove explicit "(ф и о)", "(фио)", "(fio)", "(f.i.o.)"
  cleaned = cleaned.replace(/\s*\(\s*(?:ф\s*[.\s]*и\s*[.\s]*о|фио|f\s*[.\s]*i\s*[.\s]*o|fio)\s*\)/gi, '');

  // 2. Remove parenthetical FIO (contains patronymic in Cyrillic or Latin)
  cleaned = cleaned.replace(/\s*\([^)]*(?:ович|евич|ич|овна|евна|ична|инична|ovich|evich|ich|ovna|evna|ichna|inichna|ovych|evych|ivna|avna)[^)]*\)/gi, '');

  // 3. Remove parenthetical full names (e.g. "(Паньков Николай Романович)", "(Dmitriy Itskov)")
  cleaned = cleaned.replace(/\s*\((?!(?:feat|ft|with|prod|remix|live|acoustic|edit|ver|version)\b)[A-ZА-ЯЁ][a-zа-яё]+(?:\s+[A-ZА-ЯЁ][a-zа-яё]+){1,3}\)/g, '');

  // 4. Remove parenthetical initials (e.g. "(Иванов И. И.)", "(Itskov D. O.)")
  cleaned = cleaned.replace(/\s*\((?:[A-ZА-ЯЁ][a-zа-яё]+\s+(?:[A-ZА-ЯЁ]\.\s*)+|(?:[A-ZА-ЯЁ]\.\s*)+[A-ZА-ЯЁ][a-zа-яё]+)\)/g, '');

  // 5. Handle dash separator with FIO (e.g. "Kai Angel - Dmitriy Olegovich Itskov", "Kai Angel - Dmitri Itskov")
  const dashParts = cleaned.split(/\s+[-—–]\s+/);
  if (dashParts.length === 2) {
    if (isFioSegment(dashParts[1])) {
      cleaned = dashParts[0].trim();
    } else if (isFioSegment(dashParts[0])) {
      cleaned = dashParts[1].trim();
    }
  }

  // 6. Handle separators (•, ·, |, /, ;)
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

  // 7. Handle comma-separated list where one part is a FIO (e.g. "Kai Angel, Dmitriy Olegovich Itskov")
  if (cleaned.includes(',')) {
    const parts = cleaned.split(/\s*,\s*/).filter(Boolean);
    const nonFioParts = parts.filter((part) => !isFioSegment(part));

    if (nonFioParts.length > 0) {
      cleaned = nonFioParts.join(', ').trim();
    }
  }

  // 8. If the entire name is just a FIO with patronymic, remove the patronymic word
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && words.length <= 4) {
    const allCyrillic = words.every((w) => /^[А-Яа-яЁё.\-]+$/.test(w));
    const allLatin = words.every((w) => /^[A-Za-z.\-']+$/.test(w));
    if (allCyrillic || allLatin) {
      const hasPatronymic = words.some((w) => PATRONYMIC_REGEX.test(w));
      if (hasPatronymic) {
        cleaned = words.filter((w) => !PATRONYMIC_REGEX.test(w)).join(' ');
      }
    }
  }

  return cleaned.trim() || artist.trim();
}
