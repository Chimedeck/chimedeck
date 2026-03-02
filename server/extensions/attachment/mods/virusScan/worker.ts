// Virus scan worker: subscribes to the scan queue, calls the scan API,
// and updates attachment status via the update module.
// Runs as a long-lived Bun worker; gated by VIRUS_SCAN_ENABLED flag.
import { env } from '../../../../config/env';
import { pubsub } from '../../../mods/pubsub/index';
import { updateScanResult } from './update';

const SCAN_QUEUE_KEY = 'virus_scan_queue';

async function scanFile({ s3Key }: { s3Key: string }): Promise<'READY' | 'REJECTED'> {
  // Calls VirusTotal-compatible API if VIRUS_SCAN_API_KEY is set.
  // In a full implementation this would stream the S3 object for analysis.
  // TODO: implement full VirusTotal/ClamAV integration when credentials are available.
  if (!env.VIRUS_SCAN_API_KEY) {
    // No key configured — treat as clean
    return 'READY';
  }

  try {
    const resp = await fetch(`https://www.virustotal.com/api/v3/urls`, {
      method: 'POST',
      headers: { 'x-apikey': env.VIRUS_SCAN_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(s3Key)}`,
    });
    const json = (await resp.json()) as { data?: { attributes?: { last_analysis_stats?: { malicious: number } } } };
    const malicious = json.data?.attributes?.last_analysis_stats?.malicious ?? 0;
    return malicious > 0 ? 'REJECTED' : 'READY';
  } catch {
    // Network / API error — treat as clean to avoid blocking uploads indefinitely
    return 'READY';
  }
}

export async function startVirusScanWorker(): Promise<void> {
  if (!env.VIRUS_SCAN_ENABLED) return;

  await pubsub.subscribe(SCAN_QUEUE_KEY, async (raw: string) => {
    let attachmentId: string;
    let s3Key: string | undefined;

    try {
      const msg = JSON.parse(raw) as { attachmentId: string; s3Key?: string };
      attachmentId = msg.attachmentId;
      s3Key = msg.s3Key;
    } catch {
      return;
    }

    const result = await scanFile({ s3Key: s3Key ?? attachmentId });
    await updateScanResult({ attachmentId, status: result });
  });
}
