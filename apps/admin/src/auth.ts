import { useEffect, useState } from 'react';
import { authFetch, getAccessToken, getRefreshToken } from './shared/session';

export type MeResponse = {
  id: string;
  roles?: string[];
  name?: string;
  email?: string;
  language?: string;
  branchId?: string; // optional: موجود لمُدراء الفروع
};

export async function fetchMe(): Promise<MeResponse | null> {
  // authFetch refreshes an expired access token before giving up.
  if (!getAccessToken() && !getRefreshToken()) return null;
  const resp = await authFetch('/auth/me', { credentials: 'include' });
  if (!resp.ok) return null;
  return resp.json();
}

export function useAdminAuth() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await fetchMe();
        if (!mounted) return;
        if (!profile) {
          setStatus('unauthorized');
          setMe(null);
          return;
        }
        const roles = profile.roles || [];
        const allowed = roles.includes('admin') || roles.includes('branch_manager');
        setStatus(allowed ? 'authorized' : 'unauthorized');
        setMe(profile);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || e));
        setStatus('unauthorized');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { me, status, error };
}


