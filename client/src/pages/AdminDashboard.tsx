import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STATUS_LABELS, StatusPill } from '../components/status';
import type { StatusFilter, SubmissionListResponse } from '../lib/types';

const STATUS_ORDER: StatusFilter[] = [
  'ALL',
  'NEW',
  'IN_REVIEW',
  'IN_PROGRESS',
  'AWAITING_CLIENT',
  'DONE',
  'ARCHIVED',
];

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SubmissionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSubmissions({ status, q, page, pageSize: 25 })
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Request failed.'))
      .finally(() => setLoading(false));
  }, [status, q, page]);

  // Debounce search-driven reloads.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const counts = data?.statusCounts ?? {};
  const totalAll = Object.values(counts).reduce<number>((a, b) => a + b, 0);

  return (
    <div className="admin">
      <div className="admin-bar">
        <div className="admin-brand">
          <span className="ey">Intake</span>
          <span className="ti">Submissions</span>
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
        <div className="admin-toolbar">
          <input
            className="admin-search"
            placeholder="Search names, email, or web address…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          <div className="status-tabs">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                className={`status-tab${status === s ? ' active' : ''}`}
                onClick={() => {
                  setPage(1);
                  setStatus(s);
                }}
              >
                {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
                <span className="n">{s === 'ALL' ? totalAll : (counts[s] ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Couple</th>
                <th>Contact</th>
                <th>Wedding date</th>
                <th>Answered</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr key={row.id} onClick={() => navigate(`/admin/submissions/${row.id}`)}>
                  <td>
                    <div className="cell-names">
                      {[row.brideName, row.groomName].filter(Boolean).join(' & ') || 'Untitled'}
                    </div>
                    {row.domain && <div className="cell-sub">{row.domain}</div>}
                  </td>
                  <td>
                    <div>{row.contactName || '—'}</div>
                    {row.contactEmail && <div className="cell-sub">{row.contactEmail}</div>}
                  </td>
                  <td className="cell-meta">{row.weddingDate || '—'}</td>
                  <td>
                    <div className="cell-meta">
                      {row.answered} / {row.total}
                    </div>
                    <div className="answered-bar">
                      <span
                        style={{ width: `${row.total ? (row.answered / row.total) * 100 : 0}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td className="cell-meta">{new Date(row.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && data?.rows.length === 0 && (
            <div className="admin-empty">No submissions match this view yet.</div>
          )}
          {loading && <div className="admin-empty">Loading…</div>}
        </div>

        {data && data.pages > 1 && (
          <div className="admin-pager">
            <span>
              Page {data.page} of {data.pages} · {data.total} total
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
