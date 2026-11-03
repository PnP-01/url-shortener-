import { z } from 'zod';

const RESERVED_CODES: readonly string[] = ['api', 'health', 'admin'];
const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const createLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, 'URL muito longa')
    .refine(isHttpUrl, 'Informe uma URL http ou https válida'),
  alias: z
    .string()
    .regex(ALIAS_REGEX, 'O alias deve ter de 3 a 30 caracteres: letras, números, _ ou -')
    .refine((v) => !RESERVED_CODES.includes(v.toLowerCase()), 'Este alias é reservado')
    .optional(),
  expiresAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() > Date.now(), 'A data de expiração deve estar no futuro')
    .optional(),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
