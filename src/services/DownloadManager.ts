import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { JarVerifier } from './JarVerifier';

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  percent: number;
  speedBytesPerSec: number;
  formattedProgress: string;
}

export interface DownloadOptions {
  expectedSha256?: string;
  minSizeBytes?: number;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
  onLog?: (message: string) => void;
  validateJarStructure?: boolean;
}

export class DownloadManager {
  private static readonly USER_AGENT = 'CraftCommandCenter/2.0 (panel@craftcommand.internal; +https://craftcommand.internal)';
  private static readonly DEFAULT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_MAX_RETRIES = 3;

  /**
   * Streams a remote file directly to a .part temporary file, validates its headers,
   * size, checksum, and structure, and atomically renames it to the target file.
   */
  public static async downloadFile(
    url: string,
    targetFilePath: string,
    options: DownloadOptions = {}
  ): Promise<{ finalPath: string; bytesDownloaded: number; sha256: string }> {
    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const partPath = `${targetFilePath}.part`;
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const validateJar = options.validateJarStructure !== false;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('Download was cancelled by user.');
      }

      // Cleanup any pre-existing .part file before attempt
      if (fs.existsSync(partPath)) {
        try { fs.unlinkSync(partPath); } catch {}
      }

      options.onLog?.(`[Download] [Attempt ${attempt}/${maxRetries}] Connecting to ${url}...`);

      try {
        const result = await this.streamAttempt(url, partPath, timeoutMs, options);

        // Verification phase on the temporary file before atomic rename
        options.onLog?.(`[Download] Download completed (${(result.bytesDownloaded / (1024 * 1024)).toFixed(2)} MB). Verifying file integrity...`);

        if (validateJar) {
          const jarCheck = JarVerifier.verifyJar(partPath, {
            minSizeBytes: options.minSizeBytes,
            expectedSha256: options.expectedSha256
          });

          if (!jarCheck.valid) {
            throw new Error(`DOWNLOAD_VERIFICATION_FAILED: ${jarCheck.reason}`);
          }
        } else if (options.expectedSha256) {
          if (result.sha256.toLowerCase() !== options.expectedSha256.toLowerCase().trim()) {
            throw new Error(`DOWNLOAD_VERIFICATION_FAILED: Checksum mismatch. Expected ${options.expectedSha256}, got ${result.sha256}`);
          }
        }

        // Atomic rename from .part to final destination
        try {
          if (fs.existsSync(targetFilePath)) {
            fs.unlinkSync(targetFilePath);
          }
          fs.renameSync(partPath, targetFilePath);
        } catch (renameErr: any) {
          throw new Error(`Failed to atomically commit downloaded file: ${renameErr.message}`);
        }

        options.onLog?.(`[Download] File verified and saved successfully to ${path.basename(targetFilePath)}.`);

        return {
          finalPath: targetFilePath,
          bytesDownloaded: result.bytesDownloaded,
          sha256: result.sha256
        };

      } catch (err: any) {
        lastError = err;
        options.onLog?.(`[Download] Attempt ${attempt} failed: ${err.message}`);

        // Cleanup temporary .part file on failure
        if (fs.existsSync(partPath)) {
          try { fs.unlinkSync(partPath); } catch {}
        }

        // Don't retry if aborted or verification failed specifically due to invalid format
        if (options.signal?.aborted || err.message?.startsWith('DOWNLOAD_VERIFICATION_FAILED')) {
          throw err;
        }

        if (attempt < maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          options.onLog?.(`[Download] Retrying in ${(backoffDelay / 1000).toFixed(1)} seconds...`);
          await new Promise(r => setTimeout(r, backoffDelay));
        }
      }
    }

    throw lastError || new Error(`Failed to download file from ${url} after ${maxRetries} attempts.`);
  }

  private static async streamAttempt(
    url: string,
    partPath: string,
    timeoutMs: number,
    options: DownloadOptions
  ): Promise<{ bytesDownloaded: number; sha256: string }> {
    const controller = new AbortController();
    let timeoutTimer: NodeJS.Timeout | null = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const abortListener = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener('abort', abortListener);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/java-archive, application/octet-stream, application/zip, */*'
        },
        redirect: 'follow',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} ${response.statusText} from server`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(`Server returned HTML instead of binary artifact (Content-Type: ${contentType})`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

      if (!response.body) {
        throw new Error('Response body stream is empty');
      }

      // Prepare file write stream and sha256 hasher
      const fileStream = fs.createWriteStream(partPath, { flags: 'w' });
      const hash = crypto.createHash('sha256');

      let bytesDownloaded = 0;
      let lastProgressReportTime = 0;
      let lastReportedBytes = 0;
      let speedBytesPerSec = 0;

      // Wrap body Web ReadableStream into Node Readable
      const nodeReadable = Readable.fromWeb(response.body as any);

      await new Promise<void>((resolve, reject) => {
        nodeReadable.on('data', (chunk: Buffer) => {
          // Reset inactivity timeout on each received chunk
          if (timeoutTimer) clearTimeout(timeoutTimer);
          timeoutTimer = setTimeout(() => {
            controller.abort();
          }, timeoutMs);

          bytesDownloaded += chunk.length;
          hash.update(chunk);

          const now = Date.now();
          if (now - lastProgressReportTime >= 400 || (totalBytes && bytesDownloaded >= totalBytes)) {
            const timeDeltaSec = (now - lastProgressReportTime) / 1000;
            if (timeDeltaSec > 0 && lastReportedBytes > 0) {
              speedBytesPerSec = Math.round((bytesDownloaded - lastReportedBytes) / timeDeltaSec);
            }
            lastProgressReportTime = now;
            lastReportedBytes = bytesDownloaded;

            const percent = totalBytes && totalBytes > 0
              ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100))
              : 0;

            const mbDown = (bytesDownloaded / (1024 * 1024)).toFixed(1);
            const mbTotal = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';
            const speedMb = (speedBytesPerSec / (1024 * 1024)).toFixed(2);

            const formattedProgress = totalBytes
              ? `${percent}% (${mbDown} MB / ${mbTotal} MB @ ${speedMb} MB/s)`
              : `${mbDown} MB downloaded @ ${speedMb} MB/s`;

            options.onProgress?.({
              bytesDownloaded,
              totalBytes,
              percent,
              speedBytesPerSec,
              formattedProgress
            });
          }
        });

        nodeReadable.on('error', (err) => {
          fileStream.destroy();
          reject(err);
        });

        fileStream.on('error', (err) => {
          nodeReadable.destroy();
          reject(err);
        });

        fileStream.on('finish', () => {
          resolve();
        });

        nodeReadable.pipe(fileStream);
      });

      // Verify content length matches if header was present
      if (totalBytes !== null && bytesDownloaded !== totalBytes) {
        throw new Error(`Incomplete download: Expected ${totalBytes} bytes, received ${bytesDownloaded} bytes`);
      }

      return {
        bytesDownloaded,
        sha256: hash.digest('hex')
      };

    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener('abort', abortListener);
      }
    }
  }
}
