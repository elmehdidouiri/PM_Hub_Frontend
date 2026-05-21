export function extractApiErrorMessages(errorBody: unknown): string[] {
  if (!errorBody) {
    return [];
  }

  if (typeof errorBody === 'string') {
    return errorBody.trim() ? [errorBody.trim()] : [];
  }

  if (Array.isArray(errorBody)) {
    return errorBody.flatMap((item) => extractApiErrorMessages(item));
  }

  if (typeof errorBody !== 'object') {
    return [];
  }

  const body = errorBody as Record<string, unknown>;
  const directMessages = firstStrings(body, ['message', 'Message', 'error', 'Error', 'detail', 'title']);
  const validationErrors = body['errors'] ?? body['Errors'];

  return [...directMessages, ...extractValidationMessages(validationErrors)]
    .map(cleanModelBindingMessage)
    .filter((message, index, messages) => !!message && messages.indexOf(message) === index);
}

function extractValidationMessages(errors: unknown): string[] {
  if (!errors) {
    return [];
  }

  if (typeof errors === 'string') {
    return [errors];
  }

  if (Array.isArray(errors)) {
    return errors.flatMap((item) => extractValidationMessages(item));
  }

  if (typeof errors === 'object') {
    return Object.values(errors as Record<string, unknown>).flatMap((value) => extractValidationMessages(value));
  }

  return [];
}

function firstStrings(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
  }

  return [];
}

function cleanModelBindingMessage(message: string): string {
  return message
    .replace(/\s+Path:\s*\$[^|]*(\|\s*)?/gi, ' ')
    .replace(/\s+LineNumber:\s*\d+\s*\|\s*/gi, ' ')
    .replace(/\s+BytePositionInLine:\s*\d+\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
