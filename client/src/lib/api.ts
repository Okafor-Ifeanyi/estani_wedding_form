import type {
  Admin,
  LoginResponse,
  SubmissionDetailData,
  SubmissionListResponse,
  SubmissionStatus,
  FollowUpNote,
  StatusFilter,
} from './types';
import type { FormValues } from './formSchema';

const BASE: string = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'wi-admin-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** An error carrying the HTTP status and any field-level detail the API sent. */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: { path: string; message: string }[];

  constructor(message: string, status: number, details?: { path: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const payload: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const { error, details } = (payload ?? {}) as {
      error?: string;
      details?: { path: string; message: string }[];
    };
    throw new ApiError(error || 'Request failed.', res.status, details);
  }
  return payload as T;
}

export interface ListParams {
  status: StatusFilter;
  q: string;
  page: number;
  pageSize: number;
}

export const api = {
  // Public
  createSubmission: (data: FormValues) =>
    request<{ id: string; createdAt: string }>('/api/submissions', {
      method: 'POST',
      body: { data },
    }),
  uploadFiles: (id: string, formData: FormData) =>
    request<{ attached: number }>(`/api/submissions/${id}/files`, {
      method: 'POST',
      body: formData,
    }),

  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<{ admin: Admin }>('/api/auth/me', { auth: true }),

  // Admin
  listSubmissions: (params: ListParams) => {
    const qs = new URLSearchParams({
      status: params.status,
      q: params.q,
      page: String(params.page),
      pageSize: String(params.pageSize),
    }).toString();
    return request<SubmissionListResponse>(`/api/admin/submissions?${qs}`, { auth: true });
  },
  getSubmission: (id: string) =>
    request<{ submission: SubmissionDetailData }>(`/api/admin/submissions/${id}`, { auth: true }),
  setStatus: (id: string, status: SubmissionStatus) =>
    request<{ submission: { id: string; status: SubmissionStatus } }>(
      `/api/admin/submissions/${id}`,
      { method: 'PATCH', auth: true, body: { status } },
    ),
  addNote: (id: string, body: string) =>
    request<{ note: FollowUpNote }>(`/api/admin/submissions/${id}/notes`, {
      method: 'POST',
      auth: true,
      body: { body },
    }),
  briefUrl: (id: string) => `${BASE}/api/admin/submissions/${id}/brief`,
  fileUrl: (id: string) => `${BASE}/api/admin/files/${id}`,
};

export { BASE };
