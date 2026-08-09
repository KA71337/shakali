import sanitizeHtml from "sanitize-html";

export const MAX_MESSAGE_LENGTH = 1000;

export type MessageValidationResult =
  | { ok: true; message: string }
  | { ok: false; code: "EMPTY_MESSAGE" | "MESSAGE_TOO_LONG"; message: string };

function countSymbols(value: string): number {
  return Array.from(value).length;
}

export function sanitizeMessage(input: unknown, allowEmpty = false): MessageValidationResult {
  if (typeof input !== "string") {
    return { ok: false, code: "EMPTY_MESSAGE", message: "Введите сообщение." };
  }

  if (countSymbols(input) > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "MESSAGE_TOO_LONG",
      message: "Сообщение слишком длинное. Максимум — 1000 символов.",
    };
  }

  const withoutMarkup = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });

  const cleaned = withoutMarkup
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();

  if (!cleaned) {
    return allowEmpty
      ? { ok: true, message: "" }
      : { ok: false, code: "EMPTY_MESSAGE", message: "Введите сообщение или добавьте изображение." };
  }

  if (countSymbols(cleaned) > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "MESSAGE_TOO_LONG",
      message: "Сообщение слишком длинное. Максимум — 1000 символов.",
    };
  }

  return { ok: true, message: cleaned };
}
