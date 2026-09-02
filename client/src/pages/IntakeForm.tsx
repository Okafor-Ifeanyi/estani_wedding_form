import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FORM_SCHEMA,
  ARRAY_FIELDS,
  countedRepeatRows,
  hasAnswer,
  repeatRowOf,
} from '../lib/formSchema';
import type { AnswerValue, FormField, FormSection, FormValues } from '../lib/formSchema';
import { BOOKING_NOTE, SAMPLE_SITES, sampleTheme } from '../lib/studio';
import type { SampleSite } from '../lib/studio';
import { buildBrief } from '../lib/brief';
import type { PickedFiles } from '../lib/brief';
import { api } from '../lib/api';
import Field from '../components/Field';

const DRAFT_KEY = 'ei-intake-draft-v2';

/** Rows visible per repeat section, keyed by section id. */
type OpenRows = Record<string, number>;

// Seed color defaults so the swatches render, but don't count as "answered"
// until touched (matches the original's behaviour).
function initialValues(): FormValues {
  const v: FormValues = {};
  for (const s of FORM_SCHEMA) {
    for (const f of s.fields) {
      if (ARRAY_FIELDS.includes(f.name)) v[f.name] = [];
    }
  }
  return v;
}

/** Start each repeat section at its default run, stretched to fit a draft. */
function openRowsFor(values: FormValues): OpenRows {
  const rows: OpenRows = {};
  for (const s of FORM_SCHEMA) {
    if (s.repeat) rows[s.id] = countedRepeatRows(s, values);
  }
  return rows;
}

export default function IntakeForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [openRows, setOpenRows] = useState<OpenRows>(() => openRowsFor({}));
  const [files, setFiles] = useState<PickedFiles>({});
  const [savedNote, setSavedNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{ brief: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Restore draft once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const restored = { ...initialValues(), ...(JSON.parse(raw) as FormValues) };
      setValues(restored);
      // Reopen however many chapters / items the draft actually reaches.
      setOpenRows(openRowsFor(restored));
    } catch {
      /* ignore corrupt draft */
    }
  }, []);

  // Autosave (debounced), files excluded — they can't be serialised.
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        setSavedNote('Draft saved');
        clearTimeout(noteTimer.current);
        noteTimer.current = setTimeout(() => setSavedNote(''), 1800);
      } catch {
        /* storage full or blocked */
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [values]);

  const { answered, total } = useMemo(
    () => countAnswered(values, files, openRows),
    [values, files, openRows],
  );
  const pct = total ? Math.round((answered / total) * 100) : 0;

  const setValue = (name: string, value: AnswerValue) =>
    setValues((prev) => ({ ...prev, [name]: value }));
  const setFileList = (name: string, list: FileList | null) =>
    setFiles((prev) => ({ ...prev, [name]: list }));

  // Reveal one more chapter / order-of-day item, up to the schema's ceiling.
  function addRow(section: FormSection) {
    const group = section.repeat;
    if (!group) return;
    setOpenRows((prev) => ({
      ...prev,
      [section.id]: Math.min(group.max, (prev[section.id] ?? group.initial) + 1),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // Only send fields with content (keeps the payload lean).
      const payload: FormValues = {};
      for (const [k, v] of Object.entries(values)) {
        if (Array.isArray(v) ? v.length : (v ?? '').toString().trim()) payload[k] = v;
      }
      const { id } = await api.createSubmission(payload);

      // Upload any picked files against the new submission.
      const fd = new FormData();
      let hasFiles = false;
      for (const [name, list] of Object.entries(files)) {
        for (const file of list ? Array.from(list) : []) {
          fd.append(name, file);
          hasFiles = true;
        }
      }
      if (hasFiles) await api.uploadFiles(id, fd);

      const brief = buildBrief(values, files, { answered, total });
      localStorage.removeItem(DRAFT_KEY);
      setConfirmed({ brief });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'We could not send your answers. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setValues(initialValues());
    setOpenRows(openRowsFor({}));
    setFiles({});
    setConfirmed(null);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (confirmed) {
    return <Confirmation brief={confirmed.brief} onStartOver={startOver} />;
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <span className="eyebrow">Estani digital invites</span>
          <h1>Tell us about your day</h1>
          <p>
            Everything below is optional. Fill in what you know, skip what you don't — we will follow
            up on the gaps. Your answers save in this browser as you type.
          </p>
          <span className="rule">
            <span className="bar" />
            <span>&#10022;</span>
            <span className="bar" />
          </span>

          <div className="offer">
            <p className="offer-line">
              <strong>Typing all this feels like stress?</strong> Book a session with us instead —
              we'll sit with you, ask the questions ourselves, and fill the whole thing in on your
              behalf.
            </p>
            <a className="btn btn-primary" href={"https://calendly.com/zeusifeanyi058/30min"} target="_blank" rel="noreferrer">
              Book a session
            </a>
            <span className="offer-note">{BOOKING_NOTE}</span>
          </div>

          <Samples />
        </div>
      </header>

      <div className="progress">
        <div className="progress-inner">
          <span className="progress-track">
            <span className="progress-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="progress-label">
            {answered} of {total} answered
          </span>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {FORM_SCHEMA.map((section) => (
          <section className="card" key={section.id}>
            <div className="card-head">
              <span className="card-num">{section.number}</span>
              <h2>{section.title}</h2>
              {section.intro && <p className="card-intro">{section.intro}</p>}
            </div>
            <SectionFields
              section={section}
              values={values}
              files={files}
              openRows={openRows[section.id] ?? section.repeat?.initial ?? 0}
              onAddRow={() => addRow(section)}
              onChange={setValue}
              onFiles={setFileList}
            />
          </section>
        ))}

        {error && <div className="error-banner">{error}</div>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send to the studio'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={startOver}>
            Start over
          </button>
          <span className="saved-note">{savedNote}</span>
        </div>
      </form>

      <footer className="foot">
        <p>Every field optional. Every answer helps.</p>
      </footer>
    </div>
  );
}

// A strip of finished sites, so people can see what they are filling this in for.
function Samples() {
  if (!SAMPLE_SITES.length) return null;
  return (
    <div className="samples">
      <span className="samples-title">A look at what we build</span>
      <div className="samples-grid">
        {SAMPLE_SITES.map((sample) => (
          <SampleCard key={sample.name} sample={sample} />
        ))}
      </div>
    </div>
  );
}

function SampleCard({ sample }: { sample: SampleSite }) {
  const theme = sampleTheme(sample);
  // The card wears the site's own palette, so the link previews the theme it
  // opens rather than sitting in the form's paper colour.
  const style = {
    '--sample-bg': theme.bg,
    '--sample-bg-soft': theme.bgSoft,
    '--sample-ink': theme.ink,
    '--sample-ink-muted': theme.inkMuted,
    '--sample-edge': theme.edge,
    '--sample-accent': theme.accent,
    '--sample-sheen': theme.sheen,
  } as React.CSSProperties;

  return (
    <a className="sample" style={style} href={sample.url} target="_blank" rel="noreferrer">
      <span className="sample-sheen" aria-hidden="true" />
      <span className="sample-name">{sample.name}</span>
      <span className="sample-blurb">{sample.blurb}</span>
      <span className="sample-foot">
        <span className="swatches">
          {sample.swatches.slice(1).map((c, i) => (
            <span className="swatch" key={i} style={{ background: c }} />
          ))}
        </span>
        <span className="sample-link">
          <span className="sample-host">{hostOf(sample.url)}</span>
          <span className="sample-arrow" aria-hidden="true">
            &#8599;
          </span>
        </span>
      </span>
    </a>
  );
}

// "https://estherandifeanyi.com/story" -> "estherandifeanyi.com", so the card
// shows where it goes without the scheme noise.
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface SectionFieldsProps {
  section: FormSection;
  values: FormValues;
  files: PickedFiles;
  /** Rows of this section's repeat group to draw (0 when it has none). */
  openRows: number;
  onAddRow: () => void;
  onChange: (name: string, value: AnswerValue) => void;
  onFiles: (name: string, files: FileList | null) => void;
}

// Render a section, grouping fields that share a `row` (timeline / order of
// day) and hiding repeat rows the guest hasn't asked for yet.
function SectionFields({
  section,
  values,
  files,
  openRows,
  onAddRow,
  onChange,
  onFiles,
}: SectionFieldsProps) {
  const blocks: React.ReactElement[] = [];
  const fields = section.fields;
  const repeat = section.repeat;
  let i = 0;
  let drewRepeatRow = false;
  let addDrawn = false;

  // The add button sits directly after the last drawn row of the group.
  function pushAdd() {
    if (addDrawn || !repeat) return;
    addDrawn = true;
    const atCeiling = openRows >= repeat.max;
    blocks.push(
      <div className="row-add" key={`add-${section.id}`}>
        <button type="button" className="btn btn-add" onClick={onAddRow} disabled={atCeiling}>
          + {repeat.addLabel}
        </button>
        <span className="row-add-note">
          {atCeiling
            ? `That's all ${repeat.max} ${repeat.nounPlural}.`
            : `Showing ${openRows} of ${repeat.max} ${repeat.nounPlural}.`}
        </span>
      </div>,
    );
  }

  while (i < fields.length) {
    const f = fields[i] as FormField;
    const rowNo = repeatRowOf(section, f);

    // The run of repeat rows just ended — the button belongs right here.
    if (drewRepeatRow && rowNo === 0) pushAdd();

    // A repeat row not yet revealed: skip past all of its fields.
    if (rowNo > openRows) {
      pushAdd();
      const skipped = f.row;
      while (i < fields.length && fields[i]?.row === skipped) i += 1;
      continue;
    }

    if (f.row) {
      const rowId = f.row;
      const rowFields: FormField[] = [];
      while (i < fields.length && fields[i]?.row === rowId) {
        rowFields.push(fields[i] as FormField);
        i += 1;
      }
      if (rowNo) drewRepeatRow = true;
      const groupLabel = rowFields[0]?.groupLabel;
      blocks.push(
        <div className="row" key={rowId}>
          {groupLabel && <span className="group-label">{groupLabel}</span>}
          {rowFields.map((rf, idx) => (
            <input
              key={rf.name}
              type="text"
              aria-label={rf.label}
              placeholder={rf.placeholder}
              value={asText(values[rf.name])}
              onChange={(e) => onChange(rf.name, e.target.value)}
              style={{ flex: idx === 0 ? '1 1 110px' : idx === 1 ? '2 1 190px' : '3 1 260px' }}
            />
          ))}
        </div>,
      );
    } else {
      // Collect a run of non-row fields into a responsive grid.
      const gridFields: FormField[] = [];
      while (i < fields.length && !fields[i]?.row) {
        gridFields.push(fields[i] as FormField);
        i += 1;
      }
      blocks.push(
        <div className="grid" key={`grid-${blocks.length}`}>
          {gridFields.map((gf) => (
            <Field
              key={gf.name}
              field={gf}
              value={values[gf.name]}
              files={files}
              onChange={onChange}
              onFiles={onFiles}
            />
          ))}
        </div>,
      );
    }
  }

  // A section that ends on its repeat group still needs the button.
  if (drewRepeatRow) pushAdd();

  // If a section is nothing but rows, wrap them so they stack with spacing.
  return <div className="rows">{blocks}</div>;
}

function Confirmation({ brief, onStartOver }: { brief: string; onStartOver: () => void }) {
  const [copyLabel, setCopyLabel] = useState('Copy');

  function copy() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(brief).then(
        () => {
          setCopyLabel('Copied');
          setTimeout(() => setCopyLabel('Copy'), 1800);
        },
        () => {},
      );
    }
  }

  function download() {
    const blob = new Blob([brief], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wedding-site-brief.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <span className="eyebrow">Received</span>
          <h1>Thank you</h1>
          <p>
            Your answers are with the studio — we'll be in touch about anything still open. Keep a
            copy of your brief below for your records.
          </p>
        </div>
      </header>

      <div className="confirm">
        <div className="card">
          <div className="card-head">
            <span className="card-num">Your brief</span>
            <h2>Safely with us</h2>
            <p className="card-intro">
              This is exactly what we received. Copy or download it if you'd like.
            </p>
          </div>
          <pre className="brief-pre">{brief}</pre>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copyLabel}
            </button>
            <button type="button" className="btn btn-ghost" onClick={download}>
              Download
            </button>
            <button type="button" className="btn btn-ghost" onClick={onStartOver}>
              Start another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function asText(value: AnswerValue | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

// Count answered fields (files count when at least one is picked). Repeat rows
// count only once they are on screen, so adding a chapter can't quietly drop
// the percentage of a form the guest has already finished.
function countAnswered(
  values: FormValues,
  files: PickedFiles,
  openRows: OpenRows,
): { answered: number; total: number } {
  let answered = 0;
  let total = 0;
  for (const section of FORM_SCHEMA) {
    const countedRows = section.repeat
      ? countedRepeatRows(section, values, openRows[section.id])
      : 0;
    for (const field of section.fields) {
      const rowNo = repeatRowOf(section, field);
      if (rowNo > countedRows) continue;
      total += 1;
      if (field.type === 'file') {
        const list = files[field.name];
        if (list && list.length) answered += 1;
        continue;
      }
      if (hasAnswer(values[field.name])) answered += 1;
    }
  }
  return { answered, total };
}
