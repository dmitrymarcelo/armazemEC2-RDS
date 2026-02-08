const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: BRAZIL_TIME_ZONE,
});

const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: BRAZIL_TIME_ZONE,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: BRAZIL_TIME_ZONE,
});

const parsePtBrDateString = (text: string) => {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\sT-]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const rawYear = Number.parseInt(match[3], 10);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const hour = Number.parseInt(match[4] || '0', 10);
  const minute = Number.parseInt(match[5] || '0', 10);
  const second = Number.parseInt(match[6] || '0', 10);

  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const parseDateLike = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;

  const ptBrDate = parsePtBrDateString(text);
  if (ptBrDate) return ptBrDate;

  const isoLike = new Date(text);
  if (!Number.isNaN(isoLike.getTime())) return isoLike;

  return null;
};

export const formatDateTimePtBR = (value: unknown, fallback = '') => {
  const date = parseDateLike(value);
  if (!date) return fallback;
  return DATE_TIME_FORMATTER.format(date);
};

export const formatDatePtBR = (value: unknown, fallback = '') => {
  const date = parseDateLike(value);
  if (!date) return fallback;
  return DATE_FORMATTER.format(date);
};

export const formatTimePtBR = (value: unknown, fallback = '') => {
  const date = parseDateLike(value);
  if (!date) return fallback;
  return TIME_FORMATTER.format(date);
};

export const splitDateTimePtBR = (
  value: unknown,
  fallbackDate = '--/--/----',
  fallbackTime = '--:--:--'
) => {
  const date = parseDateLike(value);
  if (!date) {
    return { date: fallbackDate, time: fallbackTime };
  }

  return {
    date: DATE_FORMATTER.format(date),
    time: TIME_FORMATTER.format(date),
  };
};

