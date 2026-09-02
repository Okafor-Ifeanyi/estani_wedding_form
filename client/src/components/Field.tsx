// Renders a single form field from the schema. Controlled via `value` + `onChange`.
// Files are handled by the parent (they aren't part of the JSON payload).

import type { AnswerValue, FormField } from '../lib/formSchema';
import type { PickedFiles } from '../lib/brief';

interface FieldProps {
  field: FormField;
  value: AnswerValue | undefined;
  files: PickedFiles;
  onChange: (name: string, value: AnswerValue) => void;
  onFiles: (name: string, files: FileList | null) => void;
}

export default function Field({ field, value, files, onChange, onFiles }: FieldProps) {
  const { name, label } = field;

  // Narrow on `field.type` rather than a destructured `type`: destructuring
  // narrows the local variable, not the object the extra props hang off.
  if (field.type === 'textarea') {
    return (
      <div className={cls(field)}>
        <label htmlFor={name}>{label}</label>
        <textarea
          id={name}
          name={name}
          rows={field.rows || 3}
          placeholder={field.placeholder}
          value={asText(value)}
          onChange={(e) => onChange(name, e.target.value)}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className={cls(field)}>
        <label htmlFor={name}>{label}</label>
        <select
          id={name}
          name={name}
          value={asText(value)}
          onChange={(e) => onChange(name, e.target.value)}
        >
          <option value="">Select one</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (optValue: string) => {
      const next = selected.includes(optValue)
        ? selected.filter((v) => v !== optValue)
        : [...selected, optValue];
      onChange(name, next);
    };
    return (
      <div className={cls(field)}>
        <span className="check-legend">{label}</span>
        <div className="checks">
          {field.options.map((opt) => (
            <label className="check" key={opt.value}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className={cls(field)}>
        <span className="check-legend">{label}</span>
        <div className="palette-grid">
          {field.options.map((opt) => (
            <label className="palette-option" key={opt.value}>
              <input
                type="radio"
                name={name}
                checked={value === opt.value}
                onChange={() => onChange(name, opt.value)}
              />
              <span className="swatches">
                {(opt.swatches || []).map((c, i) => (
                  <span className="swatch" key={i} style={{ background: c }} />
                ))}
                {(!opt.swatches || opt.swatches.length === 0) && (
                  <>
                    <span className="swatch" style={{ border: '1px solid rgba(32,31,29,0.3)' }} />
                    <span className="swatch" style={{ border: '1px solid rgba(32,31,29,0.3)' }} />
                  </>
                )}
              </span>
              <span style={{ fontSize: '13.5px' }}>{opt.value}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'color') {
    // Keep the raw text in state so a half-typed hex isn't clobbered, but only
    // ever hand the picker a complete one — it silently resets on anything else.
    const raw = asText(value) || field.default || '#000000';
    const fallback = field.default || '#000000';
    const picked = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
    return (
      <div className={cls(field)}>
        <label htmlFor={name}>{label}</label>
        <div className="color-pick">
          <input
            id={name}
            type="color"
            name={name}
            value={picked}
            onChange={(e) => onChange(name, e.target.value)}
          />
          <input
            className="color-hex"
            type="text"
            aria-label={`${label} — hex code`}
            value={raw}
            spellCheck={false}
            autoComplete="off"
            placeholder={fallback}
            onChange={(e) => onChange(name, normaliseHex(e.target.value))}
          />
        </div>
      </div>
    );
  }

  if (field.type === 'file') {
    const picked = files[name];
    return (
      <div className={cls(field)}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          type="file"
          name={name}
          accept={field.accept}
          multiple={field.multiple || false}
          onChange={(e) => onFiles(name, e.target.files)}
        />
        {picked && picked.length > 0 && (
          <span className="saved-note">
            {Array.from(picked)
              .map((f) => f.name)
              .join(', ')}
          </span>
        )}
      </div>
    );
  }

  // text / email / tel / url / date / time / number
  return (
    <div className={cls(field)}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={field.type}
        name={name}
        placeholder={field.placeholder}
        value={asText(value)}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </div>
  );
}

/** Coerce typing into a hex code: one leading #, hex digits only, max six. */
function normaliseHex(input: string): string {
  const digits = input.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
  return `#${digits}`;
}

function cls(field: FormField): string {
  return `field${field.full ? ' full' : ''}`;
}

/** Coerce an answer to the string a single-value input can display. */
function asText(value: AnswerValue | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}
