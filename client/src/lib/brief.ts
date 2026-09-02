import { FORM_SCHEMA, FIELD_LABELS } from './formSchema';
import type { FormValues } from './formSchema';

/** Files picked in the form, keyed by field name. */
export type PickedFiles = Record<string, FileList | null | undefined>;

// Mirror of the server's brief, for immediate on-screen confirmation.
export function buildBrief(
  values: FormValues,
  files: PickedFiles,
  { answered, total }: { answered: number; total: number },
): string {
  const lines: string[] = ['WEDDING SITE BRIEF', `Submitted ${new Date().toLocaleString()}`, ''];

  for (const section of FORM_SCHEMA) {
    const block: string[] = [];
    for (const field of section.fields) {
      const v = values[field.name];
      const printed = Array.isArray(v) ? v.join(' · ') : (v || '').toString().trim();
      if (!printed) continue;
      block.push(`  ${FIELD_LABELS[field.name] || field.name}: ${printed}`);
    }
    if (!block.length) continue;
    lines.push(section.title.toUpperCase());
    lines.push(block.join('\n'));
    lines.push('');
  }

  const picked = Object.values(files).flatMap((list) =>
    list ? Array.from(list).map((f) => f.name) : [],
  );
  if (picked.length) {
    lines.push('FILES ATTACHED');
    picked.forEach((n) => lines.push(`  - ${n}`));
    lines.push('');
  }

  lines.push(`Answered ${answered} of ${total} fields.`);
  return lines.join('\n');
}
