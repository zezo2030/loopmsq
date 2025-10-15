import { useEffect, useState } from 'react';

export type MeResponse = {
  id: string;
  roles?: string[];
  name?: string;
  email?: string;
  language?: string;
};

function getApiBase(): string {
  // Vite env or fallback used elsewhere in the app
  const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE;
  return (typeof base === 'string' && base) ? base : 'http://localhost:3000/api/v1';
}

export async function fetchMe(accessToken?: string): Promise<MeResponse | null> {
  if (!accessToken) return null;
  const resp = await fetch(`${getApiBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
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
        const token = localStorage.getItem('accessToken') || undefined;
        const profile = await fetchMe(token);
        if (!mounted) return;
        if (!profile) {
          setStatus('unauthorized');
          setMe(null);
          return;
        }
        const roles = profile.roles || [];
        const allowed = roles.includes('admin');
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


