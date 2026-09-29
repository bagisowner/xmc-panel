import fs from 'fs';
import crypto from 'crypto';

export interface JarVerificationResult {
  valid: boolean;
  size: number;
  sizeBytes: number;
  type: string;
  reason: string | null;
  sha256?: string;
}

export function validateJar(filePath: string, options?: { minSizeBytes?: number; expectedSha256?: string }): JarVerificationResult {
  return JarVerifier.validateJar(filePath, options);
}

export class JarVerifier {
  /**
   * Verifies that a file is a valid, readable, uncorrupted Java JAR / ZIP archive.
   * Checks for physical existence, stat.size > 0, optional explicit minimum size if provided,
   * standard ZIP magic header (PK\x03\x04), End-of-Central-Directory (EOCD) record,
   * absence of HTML or JSON error responses, and optional SHA-256 integrity.
   * Does NOT impose an arbitrary minimum file size unless explicitly requested by the caller.
   */
  public static validateJar(filePath: string, options?: { minSizeBytes?: number; expectedSha256?: string }): JarVerificationResult {
    return this.verifyJar(filePath, options);
  }

  public static verifyJar(filePath: string, options?: { minSizeBytes?: number; expectedSha256?: string }): JarVerificationResult {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        size: 0,
        sizeBytes: 0,
        type: 'unknown',
        reason: `File does not exist: ${filePath}`
      };
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch (e: any) {
      return {
        valid: false,
        size: 0,
        sizeBytes: 0,
        type: 'unknown',
        reason: `Failed to stat file: ${e.message}`
      };
    }

    // Zero-byte check (file size must be greater than 0 bytes)
    if (stat.size <= 0) {
      return {
        valid: false,
        size: 0,
        sizeBytes: 0,
        type: 'unknown',
        reason: 'Downloaded file is empty (0 bytes).'
      };
    }

    // Only apply minimum size check if explicitly requested by the caller
    if (options?.minSizeBytes !== undefined && options.minSizeBytes > 0) {
      if (stat.size < options.minSizeBytes) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'unknown',
          reason: `Downloaded file size (${(stat.size / 1024).toFixed(1)} KB) is smaller than required minimum (${(options.minSizeBytes / 1024).toFixed(1)} KB). Download may be truncated or failed.`
        };
      }
    }

    let fd: number | null = null;
    try {
      fd = fs.openSync(filePath, 'r');

      // Check first 512 bytes for HTML/JSON or standard ZIP magic header
      const headSize = Math.min(stat.size, 512);
      const headBuf = Buffer.alloc(headSize);
      fs.readSync(fd, headBuf, 0, headSize, 0);

      const headStr = headBuf.toString('utf8', 0, Math.min(headSize, 256)).trim().toLowerCase();
      if (headStr.startsWith('<!doctype') || headStr.startsWith('<html') || headStr.includes('<head>') || headStr.includes('<body>')) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'text/html',
          reason: 'Downloaded response is an HTML error page or cloudflare challenge, not a valid JAR.'
        };
      }

      if (headStr.startsWith('{') && (headStr.includes('"error"') || headStr.includes('"message"') || headStr.includes('"status"'))) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'application/json',
          reason: `Downloaded response is a JSON API error message: "${headStr.slice(0, 120)}..."`
        };
      }

      // Check standard ZIP/JAR signature magic bytes PK\x03\x04 (0x04034b50)
      if (headBuf[0] !== 0x50 || headBuf[1] !== 0x4b || headBuf[2] !== 0x03 || headBuf[3] !== 0x04) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'unknown',
          reason: 'File is not a valid ZIP/JAR archive: missing standard ZIP magic header (PK\\x03\\x04).'
        };
      }

      // Check for End of Central Directory (EOCD) record at the end of the file
      // Maximum EOCD comment length is 65535 bytes, plus 22 bytes fixed header
      const maxEocdSearch = Math.min(stat.size, 65557);
      const tailBuf = Buffer.alloc(maxEocdSearch);
      fs.readSync(fd, tailBuf, 0, maxEocdSearch, stat.size - maxEocdSearch);

      let foundEocd = false;
      let eocdOffsetInTail = -1;
      // Search backwards for PK\x05\x06 (0x06054b50)
      for (let i = maxEocdSearch - 22; i >= 0; i--) {
        if (tailBuf[i] === 0x50 && tailBuf[i + 1] === 0x4b && tailBuf[i + 2] === 0x05 && tailBuf[i + 3] === 0x06) {
          foundEocd = true;
          eocdOffsetInTail = i;
          break;
        }
      }

      if (!foundEocd) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'invalid-zip',
          reason: 'Downloaded file is corrupted or incomplete: missing ZIP End-of-Central-Directory (EOCD) record.'
        };
      }

      // Validate Central Directory bounds
      if (eocdOffsetInTail >= 0) {
        const cdSize = tailBuf.readUInt32LE(eocdOffsetInTail + 12);
        const cdOffset = tailBuf.readUInt32LE(eocdOffsetInTail + 16);
        if (cdOffset + cdSize > stat.size) {
          return {
            valid: false,
            size: stat.size,
            sizeBytes: stat.size,
            type: 'invalid-zip',
            reason: 'Downloaded file is corrupted: ZIP Central Directory exceeds file size.'
          };
        }
      }
    } catch (e: any) {
      return {
        valid: false,
        size: stat.size,
        sizeBytes: stat.size,
        type: 'unreadable',
        reason: `JAR structure validation error: ${e.message}`
      };
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
    }

    // Optional SHA-256 verification
    let computedSha256: string | undefined;
    if (options?.expectedSha256) {
      try {
        const fileBuf = fs.readFileSync(filePath);
        computedSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex').toLowerCase();
        const expected = options.expectedSha256.toLowerCase().trim();
        if (computedSha256 !== expected) {
          return {
            valid: false,
            size: stat.size,
            sizeBytes: stat.size,
            type: 'java-archive',
            sha256: computedSha256,
            reason: `SHA-256 checksum mismatch! Expected: ${expected}, got: ${computedSha256}`
          };
        }
      } catch (e: any) {
        return {
          valid: false,
          size: stat.size,
          sizeBytes: stat.size,
          type: 'java-archive',
          reason: `Failed to compute file checksum: ${e.message}`
        };
      }
    }

    return {
      valid: true,
      size: stat.size,
      sizeBytes: stat.size,
      type: 'java-archive',
      reason: null,
      sha256: computedSha256
    };
  }
}
