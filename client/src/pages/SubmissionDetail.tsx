import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { api, getToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { FORM_SCHEMA, FIELD_LABELS } from '../lib/formSchema';
import type { AnswerValue, FormField } from '../lib/formSchema';
import { STATUS_LABELS, STATUS_VALUES, StatusPill } from '../components/status';
import type { SubmissionDetailData, SubmissionStatus } from '../lib/types';

const COLOR_FIELDS = new Set([
  'guest_color_1',
  'guest_color_2',
  'guest_color_3',
  'custom_primary',
  'custom_secondary',
  'custom_metal',
]);

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const [sub, setSub] = useState<SubmissionDetailData | null>(null);
  const [error, setError] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getSubmission(id)
      .then((res) => setSub(res.submission))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load submission.'),
      );
  }, [id]);

  async function changeStatus(status: SubmissionStatus) {
    if (!id) return;
    try {
      const res = await api.setStatus(id, status);
      setSub((prev) => (prev ? { ...prev, status: res.submission.status } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the status.');
    }
  }

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.addNote(id, noteBody.trim());
      setSub((prev) => (prev ? { ...prev, notes: [res.note, ...prev.notes] } : prev));
      setNoteBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the note.');
    } finally {
      setSavingNote(false);
    }
  }

  // Download the brief with the auth header, then save the blob.
  async function downloadBrief() {
    if (!id) return;
    const res = await fetch(api.briefUrl(id), {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'brief.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Media endpoints are auth-protected, so fetch with the token and open the blob.
  async function openFile(fileId: string) {
    try {
      const res = await fetch(api.fileUrl(fileId), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Could not open file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file.');
    }
  }

  if (error) {
    return (
      <div className="admin">
        <div className="admin-main">
          <Link className="back-link" to="/admin">
            ← Back to submissions
          </Link>
          <div className="form-error">{error}</div>
        </div>
      </div>
    );
  }
  if (!sub) {
    return (
      <div className="admin">
        <div className="admin-loading">Loading…</div>
      </div>
    );
  }

  const data = sub.data ?? {};
  const names = [sub.brideName, sub.groomName].filter(Boolean).join(' & ') || 'Untitled submission';

  return (
    <div className="admin">
      <div className="admin-bar">
        <div className="admin-brand">
          <span className="ey">Intake</span>
          <span className="ti">Submission</span>
        </div>
        <div className="admin-who">
          <span>{admin?.name}</span>
          <button
            className="link-btn"
            onClick={() => {
              logout();
              navigate('/admin/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="admin-main">
        <Link className="back-link" to="/admin">
          ← Back to submissions
        </Link>

        <div className="detail-top">
          <div>
            <h1 className="detail-title">{names}</h1>
            <div className="detail-sub">
              Received {new Date(sub.createdAt).toLocaleString()} · answered {sub.answered} of{' '}
              {sub.total}
              {sub.contactEmail ? ` · ${sub.contactEmail}` : ''}
            </div>
          </div>
          <div className="detail-actions">
            <StatusPill status={sub.status} />
            <select
              className="status-select"
              value={sub.status}
              onChange={(e) => changeStatus(e.target.value as SubmissionStatus)}
            >
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button className="mini-btn" onClick={downloadBrief}>
              Download brief
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div className="panel">
            <h3>Answers</h3>
            {FORM_SCHEMA.map((section) => {
              const rows = section.fields
                .filter((f) => f.type !== 'file')
                .map((f) => ({ f, v: data[f.name] }))
                .filter(({ v }) =>
                  Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '',
                );
              if (!rows.length) return null;
              return (
                <div className="answer-section" key={section.id}>
                  <div className="answer-section-title">
                    {section.number} · {section.title}
                  </div>
                  {rows.map(({ f, v }) => (
                    <div className="answer-row" key={f.name}>
                      <span className="answer-label">{FIELD_LABELS[f.name]}</span>
                      <span className="answer-value">{renderValue(f, v)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div>
            <div className="panel" style={{ marginBottom: 24 }}>
              <h3>Follow-up notes</h3>
              <form className="note-form" onSubmit={addNote}>
                <textarea
                  placeholder="Log a call, an email sent, a decision…"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
                <button type="submit" disabled={savingNote}>
                  {savingNote ? 'Saving…' : 'Add note'}
                </button>
              </form>
              <div style={{ marginTop: 18 }}>
                {sub.notes.length === 0 && <div className="cell-meta">No notes yet.</div>}
                {sub.notes.map((n) => (
                  <div className="note" key={n.id}>
                    <div>{n.body}</div>
                    <div className="note-meta">
                      {n.author?.name || 'Admin'} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Files</h3>
              {sub.files.length === 0 ? (
                <div className="cell-meta">
                  No files uploaded. Check the photo folder link in the answers.
                </div>
              ) : (
                <div className="file-list">
                  {sub.files.map((f) => (
                    <div className="file-item" key={f.id}>
                      <span>
                        {f.originalName}
                        <div className="cell-meta">
                          {f.field} · {(f.size / 1024).toFixed(0)} KB
                        </div>
                      </span>
                      <button className="mini-btn" onClick={() => openFile(f.id)}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderValue(field: FormField, value: AnswerValue | undefined): ReactNode {
  if (value == null) return null;
  if (Array.isArray(value)) return value.join(', ');
  if (COLOR_FIELDS.has(field.name) && /^#/.test(value)) {
    return (
      <span>
        <span className="swatch-inline" style={{ background: value }} />
        {value}
      </span>
    );
  }
  if (field.type === 'url' && /^https?:\/\//.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }
  return value;
}
