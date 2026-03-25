// [why] <img> tags cannot send an Authorization header — the browser makes a
// plain GET with no credentials. Proxy endpoints require Bearer auth, so images
// would 401. This hook fetches the URL via the Fetch API (attaching the token)
// and returns a local blob URL the <img> can safely use.
import { useEffect, useState } from 'react';
import { useAppSelector } from './useAppSelector';
import { selectAuthToken } from '../extensions/Auth/duck/authDuck';

export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const token = useAppSelector(selectAuthToken);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !token) {
      setBlobUrl(null);
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setBlobUrl(null);
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);

  return blobUrl;
}
