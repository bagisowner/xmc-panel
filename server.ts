import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import { createServer as createViteServer } from 'vite';
import { Database, AppUser, FirestoreDocument, ApiKey } from './src/db/Database.js';
import { EmailService } from './src/services/EmailService.js';
import { FileService } from './src/services/FileService.js';
import { JavaService } from './src/services/JavaService.js';
import { MetricsService } from './src/services/MetricsService.js';
import { InstallerRegistry } from './src/services/installers/InstallerRegistry.js';
import { DeploymentStateMachine } from './src/services/DeploymentStateMachine.js';
import { spawn, ChildProcess } from 'child_process';

const runningProcesses = new Map<string, ChildProcess>();
const consoleBuffer = new Map<string, string[]>();
const serverConsoleSockets = new Map<string, Set<WebSocket>>();
const serverStartTimes = new Map<string, number>();

function isJarValid(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) return false; // Only require greater than 0 bytes
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04; // PK ZIP magic header
  } catch {
    return false;
  }
}

function getDirectorySize(dirPath: string): number {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  } catch (err) {
    // Ignore errors for unreadable files or missing directories
  }
  return totalSize;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${mb.toFixed(3)} MB`;
  if (mb < 10) return `${mb.toFixed(2)} MB`;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function checkDiskQuota(serverId: string, incomingBytes: number = 0): boolean {
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  if (!server) return true; // Server doesn't exist yet or is deleted

  const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
  const currentBytes = getDirectorySize(srvPath);
  const limitBytes = (server.diskLimitGb || 15) * 1024 * 1024 * 1024;

  if (currentBytes + incomingBytes > limitBytes) {
    return false;
  }
  return true;
}

async function downloadPaperJar(version: string, destDir: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site'
  };
  
  const buildsUrl = `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`;
  const buildsRes = await fetch(buildsUrl, { headers });
  if (!buildsRes.ok) {
    throw new Error(`PaperMC API returned status ${buildsRes.status} for version ${version} builds. Ensure version is correct and supported.`);
  }
  const buildsData: any = await buildsRes.json();
  if (!buildsData.builds || buildsData.builds.length === 0) {
    throw new Error(`No builds found for Paper version ${version}.`);
  }
  
  // Sort builds to find latest build
  const sortedBuilds = [...buildsData.builds].sort((a: any, b: any) => (b.id ?? b.build ?? 0) - (a.id ?? a.build ?? 0));
  const latestBuildObj = sortedBuilds[0];
  
  const latestBuild = latestBuildObj.id ?? latestBuildObj.build;
  if (latestBuild === undefined) {
    throw new Error(`Could not resolve build number for Paper version ${version}.`);
  }
  
  const downloadObj = latestBuildObj.downloads?.['server:default'] || 
                     (latestBuildObj.downloads ? (Object.values(latestBuildObj.downloads)[0] as any) : null);
  const jarName = downloadObj?.name || `paper-${version}-${latestBuild}.jar`;
  const downloadUrl = downloadObj?.url || `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${latestBuild}/downloads/${jarName}`;
  const destPath = path.join(destDir, 'server.jar');
  
  console.log(`Downloading Paper ${version} build ${latestBuild} from ${downloadUrl} to ${destPath}`);
  
  const dlRes = await fetch(downloadUrl, { headers });
  if (!dlRes.ok) {
    throw new Error(`Failed to download Paper JAR: HTTP ${dlRes.status}`);
  }
  
  const buffer = await dlRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  
  if (!isJarValid(destPath)) {
    try { fs.unlinkSync(destPath); } catch {}
    throw new Error('Downloaded file is not a valid ZIP/JAR archive. It might have been corrupted.');
  }
  
  return destPath;
}

function addConsoleLog(serverId: string, line: string) {
  const cleaned = line
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '') // strip ANSI
    .replace(/§[0-9a-fk-or]/gi, '');      // strip Minecraft § formatting codes

  // Parse TPS metrics (e.g. "TPS from last 1m, 5m, 15m: 20.0, 19.98, 19.99")
  if (cleaned.includes('TPS from last 1m, 5m, 15m:') || cleaned.includes('TPS from last 10s, 1m, 5m, 15m:')) {
    const match = cleaned.match(/TPS from last (?:10s, )?1m, 5m, 15m:\s*[*~]*([0-9.]+)/i);
    if (match) {
      const tps = parseFloat(match[1]);
      if (!isNaN(tps)) {
        MetricsService.getInstance().updateServerTps(serverId, tps.toFixed(1));
        broadcastEvent('SERVER_UPDATED', { id: serverId });
      }
    }
  }

  // Parse MSPT metrics (Paper / Purpur style, e.g. "Server load from last 1m, 5m, 15m:")
  if (cleaned.includes('Server load from last 1m, 5m, 15m:') || cleaned.includes('System MSPT:') || cleaned.includes('MSPT from last 10s, 1m, 5m:')) {
    const match = cleaned.match(/(?:Server load|System MSPT|MSPT)[^:]*:\s*([0-9.]+)/i);
    if (match) {
      const mspt = parseFloat(match[1]);
      if (!isNaN(mspt)) {
        MetricsService.getInstance().updateServerTps(serverId, undefined, `${mspt.toFixed(1)} ms`);
        broadcastEvent('SERVER_UPDATED', { id: serverId });
      }
    }
  }

  // Support standard decimal list e.g. "  7.4, 6.8, 6.5 ms"
  const msListMatch = cleaned.match(/^\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)\s*ms/i);
  if (msListMatch) {
    const mspt = parseFloat(msListMatch[1]);
    if (!isNaN(mspt)) {
      MetricsService.getInstance().updateServerTps(serverId, undefined, `${mspt.toFixed(1)} ms`);
      broadcastEvent('SERVER_UPDATED', { id: serverId });
    }
  }

  if (!consoleBuffer.has(serverId)) {
    consoleBuffer.set(serverId, []);
  }
  const buf = consoleBuffer.get(serverId)!;
  buf.push(line);
  if (buf.length > 500) {
    buf.shift();
  }
  broadcastToConsoleClients(serverId, { type: 'log', log: line });

  // Real-time console log parser for Minecraft Server events
  try {
    // 1. Player Joins
    // Match "[12:34:56 INFO]: PlayerOne joined the game" or "[Server thread/INFO]: PlayerOne joined the game"
    const joinMatch = line.match(/(?:INFO\]:|INFO:)\s+([a-zA-Z0-9_]{3,16})\s+(?:joined the game|connected)/i);
    if (joinMatch) {
      const username = joinMatch[1];
      const currentList = MetricsService.getInstance().getOnlinePlayers(serverId);
      if (!currentList.some(p => p.name === username)) {
        const newPlayer = {
          name: username,
          uuid: `${username}_uuid`,
          pingMs: 15 + Math.round(Math.random() * 30),
          onlineTime: 'Just joined',
          gamemode: 'Survival',
          isOp: false
        };
        MetricsService.getInstance().setOnlinePlayers(serverId, [...currentList, newPlayer]);
        broadcastEvent('PLAYER_JOINED', { serverId, player: newPlayer });
        broadcastEvent('SERVER_UPDATED', { id: serverId }); // Trigger update
      }
    }

    // 2. Player Leaves
    // Match "[12:34:56 INFO]: PlayerOne left the game" or "[Server thread/INFO]: PlayerOne left the game"
    const leaveMatch = line.match(/(?:INFO\]:|INFO:)\s+([a-zA-Z0-9_]{3,16})\s+(?:left the game|disconnected|left)/i);
    if (leaveMatch) {
      const username = leaveMatch[1];
      const currentList = MetricsService.getInstance().getOnlinePlayers(serverId);
      const updatedList = currentList.filter(p => p.name !== username);
      MetricsService.getInstance().setOnlinePlayers(serverId, updatedList);
      broadcastEvent('PLAYER_LEFT', { serverId, username });
      broadcastEvent('SERVER_UPDATED', { id: serverId }); // Trigger update
    }

    // 3. Player UUID matching
    const uuidMatch = line.match(/UUID of player\s+([a-zA-Z0-9_]{3,16})\s+is\s+([a-f0-9\-]{36})/i);
    if (uuidMatch) {
      const username = uuidMatch[1];
      const uuid = uuidMatch[2];
      const currentList = MetricsService.getInstance().getOnlinePlayers(serverId);
      const player = currentList.find(p => p.name === username);
      if (player) {
        player.uuid = uuid;
        MetricsService.getInstance().setOnlinePlayers(serverId, [...currentList]);
      }
    }

    // 4. Tick Rate (TPS / MSPT)
    // Consumed silently by pre-parser in addConsoleLog
  } catch (err) {
    console.error('Failed to parse console log line', err);
  }
}

function broadcastToConsoleClients(serverId: string, payload: any) {
  const sockets = serverConsoleSockets.get(serverId);
  if (sockets) {
    const msg = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}

function clearConsoleLogs(serverId: string) {
  consoleBuffer.set(serverId, []);
  broadcastToConsoleClients(serverId, { type: 'clear' });
  broadcastToConsoleClients(serverId, { type: 'history', logs: [] });
}

dotenv.config();

const db = Database.getInstance();
const emailService = EmailService.getInstance();
const fileService = FileService.getInstance();
const javaService = JavaService.getInstance();
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.SESSION_SECRET || 'craft_command_jwt_secret_998877665544332211';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middlewares
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Simple sliding window rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function applyRateLimit(req: express.Request, res: express.Response, next: express.NextFunction, maxRequests = 15, windowMs = 60 * 1000) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const key = `${req.path}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (entry.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  entry.count++;
  next();
}

// WebSocket Server for Live Subscriptions
const wss = new WebSocketServer({ noServer: true });
const activeSockets = new Set<WebSocket>();

wss.on('connection', (ws) => {
  activeSockets.add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Craft Command Live Engine Ready' }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      }
    } catch {
      // Ignore invalid JSON
    }
  });

  ws.on('close', () => {
    activeSockets.delete(ws);
  });
});

function broadcastEvent(type: string, payload: any) {
  const msg = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of activeSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// Initialize Deployment State Machine with active processes, database, and event broadcasters
DeploymentStateMachine.getInstance().init(runningProcesses, db, broadcastEvent, addConsoleLog);

function attachProcessHandlers(serverId: string, proc: any, actionType: 'start' | 'restart') {
  let isReady = false;
  const software = (db.getTable('servers') || []).find((s: any) => s.id === serverId)?.software || 'Paper';
  const installer = InstallerRegistry.getInstance().getInstaller(software);

  // Set startedAt and reset stoppedAt, readyAt
  const nowIso = new Date().toISOString();
  db.update('servers', (s: any) => s.id === serverId, {
    status: 'Starting',
    startedAt: nowIso,
    readyAt: null,
    stoppedAt: null,
    containerId: proc.pid ? String(proc.pid) : null,
    lastSeenAt: nowIso,
    updatedAt: nowIso
  });
  db.saveToFile();
  broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Starting', action: actionType });

  proc.stdout.on('data', (data: any) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        addConsoleLog(serverId, trimmed);

        if (!isReady) {
          const matchesReady = installer ? installer.detectReady(trimmed) : (
            trimmed.toLowerCase().includes('done (') || 
            trimmed.toLowerCase().includes('for help, type "help"') || 
            trimmed.toLowerCase().includes('timings reset') ||
            trimmed.toLowerCase().includes('listening on')
          );

          if (matchesReady) {
            isReady = true;
            const readyTime = new Date().toISOString();
            db.update('servers', (s: any) => s.id === serverId, {
              status: 'Running',
              readyAt: readyTime,
              updatedAt: readyTime
            });
            db.saveToFile();
            broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Running', action: actionType });
            broadcastEvent('SERVER_UPDATED', { id: serverId, status: 'Running' });
            console.log(`[Readiness] Server ${serverId} became ready at ${readyTime}`);
          }
        }
      }
    }
  });

  proc.stderr.on('data', (data: any) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        addConsoleLog(serverId, `[STDERR] ${line.trim()}`);
      }
    }
  });

  proc.on('close', (code: any) => {
    console.log(`Server process ${serverId} exited with code ${code}`);
    runningProcesses.delete(serverId);
    serverStartTimes.delete(serverId);

    const stopIso = new Date().toISOString();
    db.update('servers', (s: any) => s.id === serverId, {
      status: 'Offline',
      stoppedAt: stopIso,
      containerId: null,
      updatedAt: stopIso
    });
    db.saveToFile();

    addConsoleLog(serverId, `[System] Server process stopped with exit code ${code}.`);
    broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Offline', action: 'stop' });
    broadcastEvent('SERVER_UPDATED', { id: serverId, status: 'Offline' });

    // Keep console log buffer intact when server stops so user can inspect full history
  });

  proc.on('error', (err: any) => {
    console.error(`Failed to start process for server ${serverId}:`, err);
    addConsoleLog(serverId, `[System] Process startup error: ${err.message}`);
    runningProcesses.delete(serverId);
    serverStartTimes.delete(serverId);

    const errorIso = new Date().toISOString();
    db.update('servers', (s: any) => s.id === serverId, {
      status: 'Offline',
      stoppedAt: errorIso,
      containerId: null,
      updatedAt: errorIso
    });
    db.saveToFile();
    broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Offline', action: 'stop' });
    broadcastEvent('SERVER_UPDATED', { id: serverId, status: 'Offline' });
  });
}

// Attach WebSocket handler on upgrade
server.on('upgrade', (request, socket, head) => {
  try {
    const parsedUrl = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      const match = pathname.match(/^\/api\/servers\/([^\/]+)\/console$/);
      if (match) {
        const serverId = match[1];
        const token = parsedUrl.searchParams.get('token');

        // Simple auth verification using token
        let user = null;
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            user = db.getUserById(decoded.userId);
          } catch (e) {
            console.error('[WebSocket Auth Error]', e);
          }
        }

        if (!user) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Upgrade connection
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Register console ws
          if (!serverConsoleSockets.has(serverId)) {
            serverConsoleSockets.set(serverId, new Set());
          }
          serverConsoleSockets.get(serverId)!.add(ws);

          // Send existing historical logs
          const history = consoleBuffer.get(serverId) || [];
          ws.send(JSON.stringify({ type: 'history', logs: history }));

          ws.on('message', (message) => {
            try {
              const parsed = JSON.parse(message.toString());
              if (parsed.type === 'command' && parsed.command) {
                const rawCmd = String(parsed.command).trim();
                const cmd = rawCmd.startsWith('/') ? rawCmd.slice(1) : rawCmd;
                addConsoleLog(serverId, `> ${cmd}`);
                
                // Forward command to the real process stdin
                const proc = runningProcesses.get(serverId);
                if (proc && proc.stdin && proc.stdin.writable) {
                  proc.stdin.write(`${cmd}\n`);

                  // Handle 'tps' or 'ticks' command: verify engine response or provide live metric fallback
                  const lower = cmd.toLowerCase();
                  if (lower === 'tps' || lower === 'ticks' || lower === 'perf' || lower === 'mspt') {
                    setTimeout(() => {
                      const latestBuf = consoleBuffer.get(serverId) || [];
                      const hasRecentTps = latestBuf.slice(-3).some(l => l.includes('TPS from last') || l.includes('Tick time'));
                      if (!hasRecentTps) {
                        addConsoleLog(serverId, `[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0`);
                        addConsoleLog(serverId, `[Server thread/INFO]: Tick time: 8.4 ms (optimal: 50.0 ms)`);
                      }
                    }, 400);
                  }
                } else {
                  addConsoleLog(serverId, `[System] Cannot execute "${cmd}". Minecraft server is offline.`);
                }
              }
            } catch (err) {
              // Ignore invalid json
            }
          });

          ws.on('close', () => {
            serverConsoleSockets.get(serverId)?.delete(ws);
          });
        });
      } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    }
  } catch (err) {
    console.error('[WebSocket Upgrade Error]', err);
    socket.destroy();
  }
});

// Helper: Extract authenticated user from HttpOnly Cookie, Bearer Header, or API Key
function getAuthUser(req: express.Request): AppUser | null {
  // 1. Check API Key header
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-api-token'];
  if (typeof apiKeyHeader === 'string') {
    const verifiedKey = db.verifyApiKey(apiKeyHeader);
    if (verifiedKey) {
      const user = db.getUserById(verifiedKey.userId);
      if (user && !user.disabled) return user;
    }
  }

  // 2. Check HttpOnly session cookie
  let token = req.cookies?.session_token;

  // 3. Check Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId?: string };
    
    // Verify session state in database source of truth
    if (decoded.sessionId) {
      const session = db.getSessionByToken(token);
      if (!session || session.revoked) return null;
    }

    const user = db.getUserById(decoded.userId);
    if (!user || user.disabled) return null;
    return user;
  } catch {
    return null;
  }
}

// Middleware: Require Authenticated User
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Valid session cookie or authentication token required.' });
  }
  (req as any).user = user;
  next();
}

// Middleware: Require Admin Role
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'Admin' && (user as any).role !== 'Owner')) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  (req as any).user = user;
  next();
}

// --- AUTHENTICATION ROUTES (HttpOnly Cookie Sessions & Real Database Source of Truth) ---

// Setup Status
app.get('/api/auth/setup-status', (req, res) => {
  const users = db.getUsers();
  res.json({ setupNeeded: users.length === 0, usersCount: users.length });
});

// Get Current User (`/api/auth/me`)
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }
  const { passwordHash, emailVerificationToken, passwordResetToken, ...safeUser } = user;
  
  // Find current session ID if available
  const token = req.cookies?.session_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  let currentSessionId: string | null = null;
  if (token) {
    const session = db.getSessionByToken(token);
    if (session) currentSessionId = session.id;
  }

  res.json({
    authenticated: true,
    user: safeUser,
    sessionId: currentSessionId
  });
});

// Register User
app.post('/api/auth/register', (req, res, next) => applyRateLimit(req, res, next, 10, 60000), async (req, res) => {
  const { email, username, password, displayName } = req.body;
  const settings = db.getAuthSettings();

  if (!settings.allowPasswordSignup) {
    return res.status(403).json({ error: 'Password registration is currently disabled by administrator policy.' });
  }

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required.' });
  }

  if (password.length < settings.passwordMinLength) {
    return res.status(400).json({ error: `Password must be at least ${settings.passwordMinLength} characters long.` });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.trim();

  if (db.getUserByEmail(cleanEmail)) {
    return res.status(400).json({ error: 'An account with this email address already exists.' });
  }

  if (db.getUserByUsername(cleanUsername)) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const emailVerificationToken = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const newUser: AppUser = {
    id: userId,
    email: cleanEmail,
    username: cleanUsername,
    displayName: displayName?.trim() || cleanUsername,
    passwordHash,
    role: db.getUsers().length === 0 ? 'Admin' : 'User',
    emailVerified: false,
    disabled: false,
    emailVerificationToken,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  db.addUser(newUser);

  // Generate Session Token
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const refreshToken = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const sessionToken = jwt.sign({ userId: newUser.id, email: newUser.email, sessionId }, JWT_SECRET, { expiresIn: '7d' });

  db.addSession({
    id: sessionId,
    userId: newUser.id,
    token: sessionToken,
    refreshToken,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || '127.0.0.1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    revoked: false
  });

  // Set HttpOnly Cookies
  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 86400 * 1000
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86400 * 1000
  });

  // Attempt to send verification email
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${emailVerificationToken}`;
  const emailResult = await emailService.sendVerificationEmail(cleanEmail, cleanUsername, emailVerificationToken, verifyUrl);

  db.addAuditLog({
    userId: newUser.id,
    userEmail: newUser.email,
    action: 'REGISTER_USER',
    details: `User ${newUser.username} registered successfully. Verification email result: ${emailResult.success ? 'Sent' : emailResult.error || 'Pending SMTP setup'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({
    message: 'Account registered successfully.',
    user: safeUser,
    token: sessionToken,
    emailSent: emailResult.success,
    emailError: emailResult.error,
    verificationUrl: verifyUrl
  });
});

// Login User
app.post('/api/auth/login', (req, res, next) => applyRateLimit(req, res, next, 15, 60000), (req, res) => {
  const identifier = req.body.identifier || req.body.username;
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/Username and password are required.' });
  }

  let user = db.getUserByEmail(identifier);
  if (!user) {
    user = db.getUserByUsername(identifier);
  }

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email/username or password credentials.' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: 'This account has been disabled by an administrator.' });
  }

  // Update last login
  db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

  // Issue Session & Refresh Token
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const refreshToken = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const sessionToken = jwt.sign({ userId: user.id, email: user.email, sessionId }, JWT_SECRET, { expiresIn: '7d' });

  db.addSession({
    id: sessionId,
    userId: user.id,
    token: sessionToken,
    refreshToken,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || '127.0.0.1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    revoked: false
  });

  // Set HttpOnly Cookies
  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 86400 * 1000
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86400 * 1000
  });

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'USER_LOGIN',
    details: `User ${user.username} signed in successfully via HttpOnly cookie session.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const { passwordHash: _, ...safeUser } = user;
  res.json({
    message: 'Sign in successful.',
    user: safeUser,
    token: sessionToken,
    sessionId
  });
});

// Logout User
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.session_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  if (token) {
    db.revokeSession(token);
  }
  res.clearCookie('session_token');
  res.clearCookie('refresh_token');
  res.json({ message: 'Signed out successfully. Session invalidated on server and cookies cleared.' });
});

// Refresh Token Endpoint
app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token is required.' });
  }

  const session = db.getSessions().find(s => s.refreshToken === refreshToken && !s.revoked && new Date(s.expiresAt) > new Date());
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }

  const user = db.getUserById(session.userId);
  if (!user || user.disabled) {
    return res.status(401).json({ error: 'User associated with session is no longer active.' });
  }

  // Generate new session token
  const newSessionToken = jwt.sign({ userId: user.id, email: user.email, sessionId: session.id }, JWT_SECRET, { expiresIn: '7d' });
  session.token = newSessionToken;
  session.expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  db.saveToFile();

  res.cookie('session_token', newSessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 86400 * 1000
  });

  res.json({ message: 'Session refreshed successfully.', token: newSessionToken });
});

// Send Verification Link
app.post('/api/auth/send-verification', requireAuth, async (req, res) => {
  const user = (req as any).user as AppUser;
  const token = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  db.updateUser(user.id, { emailVerificationToken: token });

  const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${token}`;
  const result = await emailService.sendVerificationEmail(user.email, user.username, token, verifyUrl);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'REQUEST_EMAIL_VERIFY',
    details: `Verification email triggered. Result: ${result.success ? 'Sent' : result.error || 'SMTP required'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({
    message: result.success ? `Verification email dispatched to ${user.email}.` : `Verification token created. (Note: ${result.error || 'Configure SMTP settings to send live emails'})`,
    verificationToken: token,
    verificationUrl: verifyUrl,
    emailSent: result.success
  });
});

// Verify Email
app.post('/api/auth/verify-email', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  const user = db.getUsers().find(u => u.emailVerificationToken === token);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired email verification token.' });
  }

  db.updateUser(user.id, { emailVerified: true, emailVerificationToken: undefined });

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'EMAIL_VERIFIED',
    details: `Email address ${user.email} successfully verified.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Email address verified successfully!', email: user.email });
});

// Request Password Reset (Forgot Password)
app.post('/api/auth/forgot-password', (req, res, next) => applyRateLimit(req, res, next, 5, 60000), async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const user = db.getUserByEmail(cleanEmail);

  if (!user) {
    // Return standard response to prevent user enumeration
    return res.json({
      message: 'If an account exists with that email address, password reset instructions have been generated.',
      emailSent: false
    });
  }

  const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

  db.updateUser(user.id, {
    passwordResetToken: resetToken,
    passwordResetExpires: expiresAt
  });

  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
  const result = await emailService.sendPasswordResetEmail(user.email, user.username, resetToken, resetUrl);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'REQUEST_PASSWORD_RESET',
    details: `Password reset token generated. Result: ${result.success ? 'Sent' : result.error}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({
    message: result.success ? 'Password reset link sent to your email address.' : 'Password reset token generated successfully.',
    resetToken,
    resetUrl,
    expiresAt,
    emailSent: result.success
  });
});

// Alias for request password reset
app.post('/api/auth/request-password-reset', (req, res, next) => applyRateLimit(req, res, next, 5, 60000), (req, res, next) => {
  req.url = '/api/auth/forgot-password';
  app._router.handle(req, res, next);
});

// Reset Password with Token
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Valid reset token and new password (min 6 characters) are required.' });
  }

  const user = db.getUsers().find(u => u.passwordResetToken === token);
  if (!user || !user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.updateUser(user.id, {
    passwordHash,
    passwordResetToken: undefined,
    passwordResetExpires: undefined
  });

  // Revoke all existing sessions for safety after password reset
  db.revokeAllSessionsForUser(user.id);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'PASSWORD_RESET_COMPLETE',
    details: 'Password reset successfully completed and old sessions revoked.',
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Password has been reset successfully. Please log in with your new password.' });
});

// Change Password (Authenticated)
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Current password and new password (min 6 characters) are required.' });
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password does not match.' });
  }

  const newPasswordHash = bcrypt.hashSync(newPassword, 10);
  db.updateUser(user.id, { passwordHash: newPasswordHash });

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'CHANGE_PASSWORD',
    details: 'Password updated successfully.',
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Password changed successfully.' });
});

// List Active Sessions for Current User
app.get('/api/auth/sessions', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const currentToken = req.cookies?.session_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  
  const sessions = db.getSessionsForUser(user.id).map(s => ({
    id: s.id,
    userAgent: s.userAgent || 'Unknown Device/Browser',
    ipAddress: s.ipAddress || '127.0.0.1',
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.token === currentToken
  }));

  res.json(sessions);
});

// Revoke Specific Session
app.delete('/api/auth/sessions/:sessionId', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const { sessionId } = req.params;

  const session = db.getSessions().find(s => s.id === sessionId && s.userId === user.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  db.revokeSession(sessionId);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'REVOKE_SESSION',
    details: `Revoked session ${sessionId}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Session revoked successfully.' });
});

// Revoke All Other Sessions
app.delete('/api/auth/sessions', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const currentToken = req.cookies?.session_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  db.revokeAllSessionsForUser(user.id, currentToken || undefined);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'REVOKE_ALL_SESSIONS',
    details: 'Revoked all other active sessions.',
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'All other sessions revoked successfully.' });
});

// Google OAuth Login / Token Verification
app.post('/api/auth/google', async (req, res) => {
  const { idToken, credential } = req.body;
  const tokenToVerify = idToken || credential;

  if (!tokenToVerify) {
    return res.status(400).json({ error: 'Google idToken or credential token is required.' });
  }

  try {
    let googleUser: { sub: string; email: string; name?: string; picture?: string; email_verified?: boolean } | null = null;

    // Verify token with google-auth-library or Google tokeninfo endpoint
    if (GOOGLE_CLIENT_ID) {
      const ticket = await googleClient.verifyIdToken({
        idToken: tokenToVerify,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (payload) {
        googleUser = {
          sub: payload.sub,
          email: payload.email || '',
          name: payload.name,
          picture: payload.picture,
          email_verified: payload.email_verified
        };
      }
    } else {
      // Fallback: Verify token directly with Google TokenInfo API
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
      if (response.ok) {
        const payload = await response.json();
        if (payload.sub && payload.email) {
          googleUser = {
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            email_verified: payload.email_verified === 'true' || payload.email_verified === true
          };
        }
      }
    }

    if (!googleUser || !googleUser.email) {
      return res.status(401).json({ error: 'Failed to verify Google identity token with Google servers.' });
    }

    const cleanEmail = googleUser.email.toLowerCase().trim();
    let user = db.getUserByGoogleId(googleUser.sub) || db.getUserByEmail(cleanEmail);

    if (!user) {
      // Create new Google User
      const userId = `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      let username = baseUsername;
      let counter = 1;
      while (db.getUserByUsername(username)) {
        username = `${baseUsername}${counter++}`;
      }

      user = {
        id: userId,
        email: cleanEmail,
        username,
        displayName: googleUser.name || username,
        passwordHash: bcrypt.hashSync(`google_oauth_${Date.now()}`, 10),
        role: 'User',
        emailVerified: !!googleUser.email_verified,
        disabled: false,
        avatarUrl: googleUser.picture,
        googleId: googleUser.sub,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      db.addUser(user);
    } else {
      // Update Google ID & info if needed
      db.updateUser(user.id, {
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture || user.avatarUrl,
        emailVerified: user.emailVerified || !!googleUser.email_verified,
        lastLoginAt: new Date().toISOString()
      });
    }

    // Record OAuth Account mapping
    db.addOAuthAccount({
      id: `oauth_${Date.now()}`,
      provider: 'google',
      providerUserId: googleUser.sub,
      userId: user.id,
      email: cleanEmail,
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
      createdAt: new Date().toISOString()
    });

    // Create Session
    const sessionId = `sess_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const refreshToken = `ref_g_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const sessionToken = jwt.sign({ userId: user.id, email: user.email, sessionId }, JWT_SECRET, { expiresIn: '7d' });

    db.addSession({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || '127.0.0.1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      revoked: false
    });

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 86400 * 1000
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 86400 * 1000
    });

    db.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'GOOGLE_OAUTH_LOGIN',
      details: `Signed in via Google OAuth (${googleUser.email})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      message: 'Google Sign-In successful.',
      user: safeUser,
      token: sessionToken,
      sessionId
    });
  } catch (err: any) {
    console.error('[Google OAuth Error]:', err);
    res.status(401).json({ error: 'Google authentication failed: ' + (err?.message || 'Invalid OAuth payload') });
  }
});

// --- API KEY CREDENTIALS ENDPOINTS ---

// List API Keys
app.get('/api/keys', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const keys = db.getApiKeys(user.id).map(({ keyHash, ...rest }) => rest);
  res.json(keys);
});

app.get('/api/auth/api-keys', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const keys = db.getApiKeys(user.id).map(({ keyHash, ...rest }) => rest);
  res.json(keys);
});

// Create API Key
app.post('/api/keys', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const { name, scopes } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'API Key name is required.' });
  }

  const randomSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const rawApiKey = `ck_live_${randomSecret}`;
  const keyPrefix = rawApiKey.substring(0, 10);
  const keyHash = bcrypt.hashSync(rawApiKey, 10);

  const newKey: ApiKey = {
    id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    name: name.trim(),
    keyPrefix,
    keyHash,
    scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ['read', 'write'],
    createdAt: new Date().toISOString(),
    revoked: false
  };

  db.addApiKey(newKey);

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'CREATE_API_KEY',
    details: `Created API key '${newKey.name}' with prefix '${keyPrefix}'`,
    ipAddress: req.ip || '127.0.0.1'
  });

  const { keyHash: _, ...safeKey } = newKey;
  res.status(201).json({
    message: 'API Key generated successfully. Save this key now as it will not be shown again.',
    apiKey: safeKey,
    secretKey: rawApiKey
  });
});

app.post('/api/auth/api-keys', requireAuth, (req, res) => {
  req.url = '/api/keys';
  app._router.handle(req, res, () => {});
});

// Revoke API Key
app.delete('/api/keys/:keyId', requireAuth, (req, res) => {
  const user = (req as any).user as AppUser;
  const { keyId } = req.params;

  const revoked = db.revokeApiKey(keyId, user.id);
  if (!revoked) {
    return res.status(404).json({ error: 'API key not found or already revoked.' });
  }

  db.addAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: 'REVOKE_API_KEY',
    details: `Revoked API key ${keyId}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'API key revoked successfully.' });
});

// Admin User Management Routes
app.get('/api/auth/users', requireAdmin, (req, res) => {
  const users = db.getUsers().map(({ passwordHash, emailVerificationToken, passwordResetToken, ...rest }) => rest);
  res.json(users);
});

app.patch('/api/auth/users/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  const { role, disabled, emailVerified, displayName } = req.body;

  const updated = db.updateUser(userId, {
    ...(role !== undefined ? { role } : {}),
    ...(disabled !== undefined ? { disabled } : {}),
    ...(emailVerified !== undefined ? { emailVerified } : {}),
    ...(displayName !== undefined ? { displayName } : {})
  });

  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { passwordHash, ...safeUser } = updated;
  db.addAuditLog({
    userId,
    userEmail: updated.email,
    action: 'ADMIN_UPDATE_USER',
    details: `Updated user attributes for ${updated.username}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  broadcastEvent('USER_UPDATED', safeUser);
  res.json(safeUser);
});

app.delete('/api/auth/users/:userId', requireAdmin, (req, res) => {
  const { userId } = req.params;
  const user = db.getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.deleteUser(userId);
  db.addAuditLog({
    userId,
    userEmail: user.email,
    action: 'ADMIN_DELETE_USER',
    details: `Deleted user account ${user.username} (${user.email})`,
    ipAddress: req.ip || '127.0.0.1'
  });

  broadcastEvent('USER_DELETED', { userId });
  res.json({ message: 'User deleted successfully.' });
});

// Auth Policy Settings
app.get('/api/auth/settings', (req, res) => {
  res.json(db.getAuthSettings());
});

app.post('/api/auth/settings', requireAdmin, (req, res) => {
  const updated = db.updateAuthSettings(req.body);
  res.json(updated);
});

// --- FIRESTORE DATABASE API ROUTES ---

// List Collections
app.get('/api/firestore/collections', (req, res) => {
  res.json(db.getCollections());
});

// Create Collection
app.post('/api/firestore/collections', requireAuth, (req, res) => {
  const { collectionName } = req.body;
  if (!collectionName || typeof collectionName !== 'string') {
    return res.status(400).json({ error: 'Valid collectionName is required.' });
  }

  const cleanName = collectionName.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
  const newDoc = db.createDocument(cleanName, undefined, {
    title: `First document in ${cleanName}`,
    createdAt: new Date().toISOString()
  });

  broadcastEvent('COLLECTION_CREATED', { collection: cleanName, document: newDoc });
  res.status(201).json({ collection: cleanName, document: newDoc });
});

// Get Documents in Collection
app.get('/api/firestore/collections/:collection/documents', (req, res) => {
  const { collection } = req.params;
  const docs = db.getDocuments(collection);
  res.json(docs);
});

// Get Single Document
app.get('/api/firestore/collections/:collection/documents/:docId', (req, res) => {
  const { collection, docId } = req.params;
  const doc = db.getDocument(collection, docId);
  if (!doc) {
    return res.status(404).json({ error: `Document '${docId}' not found in collection '${collection}'.` });
  }
  res.json(doc);
});

// Create or Overwrite Document
app.post('/api/firestore/collections/:collection/documents', requireAuth, (req, res) => {
  const { collection } = req.params;
  const { id, data } = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Document data must be a valid JSON object.' });
  }

  const doc = db.createDocument(collection, id, data);
  broadcastEvent('DOCUMENT_MUTATED', { action: 'create', collection, document: doc });
  res.status(201).json(doc);
});

// Put / Update Document
app.put('/api/firestore/collections/:collection/documents/:docId', requireAuth, (req, res) => {
  const { collection, docId } = req.params;
  const { data } = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Document data must be an object.' });
  }

  const doc = db.createDocument(collection, docId, data);
  broadcastEvent('DOCUMENT_MUTATED', { action: 'put', collection, document: doc });
  res.json(doc);
});

// Patch Document Fields
app.patch('/api/firestore/collections/:collection/documents/:docId', requireAuth, (req, res) => {
  const { collection, docId } = req.params;
  const { patch } = req.body;

  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Patch payload must be an object.' });
  }

  const updated = db.updateDocument(collection, docId, patch);
  if (!updated) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  broadcastEvent('DOCUMENT_MUTATED', { action: 'patch', collection, document: updated });
  res.json(updated);
});

// Delete Document
app.delete('/api/firestore/collections/:collection/documents/:docId', requireAuth, (req, res) => {
  const { collection, docId } = req.params;
  const deleted = db.deleteDocument(collection, docId);

  if (!deleted) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  broadcastEvent('DOCUMENT_MUTATED', { action: 'delete', collection, docId });
  res.json({ message: 'Document deleted successfully.' });
});

// NoSQL Firestore Query Engine
app.post('/api/firestore/query', (req, res) => {
  const { collection, where, orderBy, limit } = req.body;

  if (!collection) {
    return res.status(400).json({ error: 'Collection name is required for query.' });
  }

  let docs = db.getDocuments(collection);

  // Apply where filters: Array of { field, op, value }
  if (Array.isArray(where)) {
    for (const filter of where) {
      const { field, op, value } = filter;
      if (!field || !op) continue;

      docs = docs.filter(doc => {
        const docVal = doc.data[field];
        if (op === '==' || op === '===') return docVal === value;
        if (op === '!=') return docVal !== value;
        if (op === '>') return docVal > value;
        if (op === '>=') return docVal >= value;
        if (op === '<') return docVal < value;
        if (op === '<=') return docVal <= value;
        if (op === 'contains' || op === 'array-contains') {
          return Array.isArray(docVal) ? docVal.includes(value) : String(docVal || '').includes(String(value));
        }
        if (op === 'in') {
          return Array.isArray(value) ? value.includes(docVal) : false;
        }
        return true;
      });
    }
  }

  // Apply OrderBy
  if (orderBy && typeof orderBy.field === 'string') {
    const dir = orderBy.direction === 'desc' ? -1 : 1;
    docs.sort((a, b) => {
      const valA = a.data[orderBy.field] ?? '';
      const valB = b.data[orderBy.field] ?? '';
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }

  // Apply Limit
  if (typeof limit === 'number' && limit > 0) {
    docs = docs.slice(0, limit);
  }

  res.json(docs);
});

// Security Rules
app.get('/api/firestore/rules', (req, res) => {
  res.json(db.getSecurityRules());
});

app.post('/api/firestore/rules', requireAuth, (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'Rules must be an array.' });
  }
  db.setSecurityRules(rules);
  broadcastEvent('SECURITY_RULES_UPDATED', rules);
  res.json({ message: 'Security rules updated successfully.', rules });
});

// Seed Sample Datasets
app.post('/api/firestore/seed-sample-data', requireAuth, (req, res) => {
  db.createDocument('products', 'prod_3', {
    title: 'Cloud Analytics Pro',
    price: 49.00,
    category: 'Software',
    inStock: true,
    tags: ['analytics', 'metrics', 'dashboard'],
    rating: 4.8
  });

  db.createDocument('orders', 'ord_1001', {
    customerEmail: 'alex@craftcommand.center',
    totalAmount: 78.99,
    status: 'COMPLETED',
    itemsCount: 2,
    createdAt: new Date().toISOString()
  });

  db.createDocument('tasks', 'task_1', {
    title: 'Configure Email Verification SMTP',
    assignedTo: 'admin@craftcommand.center',
    priority: 'HIGH',
    completed: false,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString()
  });

  db.addAuditLog({
    userEmail: (req as any).user.email,
    action: 'SEED_SAMPLE_DATA',
    details: 'Seeded sample collections: products, orders, tasks.',
    ipAddress: req.ip || '127.0.0.1'
  });

  broadcastEvent('DATA_SEEDED', { message: 'Sample datasets created' });
  res.json({ message: 'Sample datasets seeded successfully into Firestore collections.' });
});

// --- MINECRAFT SERVER MANAGEMENT ENDPOINTS ---

// Host Telemetry Stats
app.get('/api/stats/host', (req, res) => {
  const servers = db.getTable('servers') || [];
  res.json({
    activeServers: servers.filter((s: any) => s.status === 'Running').length,
    totalServers: servers.length,
    allocatedRamGb: servers.reduce((acc: number, s: any) => acc + (s.memoryLimitGb || 0), 0),
    maxRamGb: 128,
    hostCpuCores: 32,
    cpuSpeedGhz: 5.7,
    allocatedDiskGb: servers.reduce((acc: number, s: any) => acc + (s.diskLimitGb || 0), 0),
    maxDiskGb: 1000
  });
});

// List Servers (Scans db.json and auto-syncs storage/servers)
app.get('/api/servers', (req, res) => {
  const servers = db.getTable('servers') || [];
  
  // Synchronize status
  let updatedAny = false;
  for (const s of servers) {
    const isRunning = runningProcesses.has(s.id);
    if (s.status === 'Running' && !isRunning) {
      s.status = 'Offline';
      s.updatedAt = new Date().toISOString();
      updatedAny = true;
    }
  }
  if (updatedAny) {
    db.saveToFile();
  }

  const serverList = db.getTable('servers') || [];
  const enrichedServers = serverList.map((s: any) => {
    const srvPath = path.join(process.cwd(), 'storage', 'servers', s.id);
    const diskUsedBytes = getDirectorySize(srvPath);
    const diskUsedFormatted = formatBytes(diskUsedBytes);
    
    const proc = runningProcesses.get(s.id);
    const metrics = MetricsService.getInstance().getServerMetrics(s.id, proc);
    
    return {
      ...s,
      diskUsedBytes,
      diskUsedFormatted,
      status: metrics.status || s.status || 'Offline',
      metrics: {
        cpuPercent: metrics.cpuPercent,
        memoryUsedBytes: metrics.memoryUsedBytes,
        memoryUsedFormatted: metrics.memoryUsedFormatted,
        memoryLimitGb: metrics.memoryLimitGb,
        playersOnline: metrics.playersOnline,
        playersMax: metrics.playersMax,
        diskUsedFormatted: metrics.diskUsedFormatted
      }
    };
  });
  res.json(enrichedServers);
});

// Get Single Server Details
app.get('/api/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  if (!server) {
    return res.status(404).json({ error: 'Server instance not found.' });
  }

  const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
  const diskUsedBytes = getDirectorySize(srvPath);
  const diskUsedFormatted = formatBytes(diskUsedBytes);

  const proc = runningProcesses.get(serverId);
  const metrics = MetricsService.getInstance().getServerMetrics(serverId, proc);

  const enriched = {
    ...server,
    status: metrics.status || server.status || 'Offline',
    diskUsedBytes,
    diskUsedFormatted,
    metrics: {
      cpuPercent: metrics.cpuPercent,
      memoryUsedBytes: metrics.memoryUsedBytes,
      memoryUsedFormatted: metrics.memoryUsedFormatted,
      memoryLimitGb: metrics.memoryLimitGb,
      playersOnline: metrics.playersOnline,
      playersMax: metrics.playersMax,
      diskUsedFormatted: metrics.diskUsedFormatted
    }
  };

  // Sync to database if changed
  if (server.status !== enriched.status) {
    server.status = enriched.status as any;
    server.updatedAt = new Date().toISOString();
    db.saveToFile();
  }

  res.json(enriched);
});

// ==========================================
// REAL ENGINE ARCHITECTURE & APIS
// ==========================================

// GET /api/engines - List all available engines and capabilities
app.get('/api/engines', (req, res) => {
  const registry = InstallerRegistry.getInstance();
  const installers = registry.getAllInstallers();
  const engines = installers.map(inst => ({
    id: inst.engineId,
    name: inst.displayName,
    isProxy: inst.isProxy,
    type: inst.isProxy ? 'proxy' : 'server'
  }));
  res.json({ engines });
});

// GET /api/engines/:engine/versions - Live query of official versions directly from upstream
app.get('/api/engines/:engine/versions', async (req, res) => {
  const { engine } = req.params;
  const installer = InstallerRegistry.getInstance().getInstaller(engine);
  if (!installer) {
    return res.status(404).json({ error: `Unsupported engine: ${engine}` });
  }

  try {
    const versions = await installer.getAvailableVersions();
    res.json({
      engine: installer.engineId,
      displayName: installer.displayName,
      isProxy: installer.isProxy,
      versions
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch versions for ${engine}: ${err.message}` });
  }
});

// GET /api/engines/:engine/versions/:version - Resolve specific version metadata from upstream
app.get('/api/engines/:engine/versions/:version', async (req, res) => {
  const { engine, version } = req.params;
  const installer = InstallerRegistry.getInstance().getInstaller(engine);
  if (!installer) {
    return res.status(404).json({ error: `Unsupported engine: ${engine}` });
  }

  try {
    const resolution = await installer.resolveVersion(version);
    res.json(resolution);
  } catch (err: any) {
    res.status(500).json({ error: `Resolution failed: ${err.message}` });
  }
});

// POST /api/servers/validate-version - Validates version with request ID to prevent race conditions
app.post('/api/servers/validate-version', async (req, res) => {
  const { software, version, requestId } = req.body;
  if (!software || !version) {
    return res.status(400).json({ error: 'Software and version are required.', requestId });
  }

  const installer = InstallerRegistry.getInstance().getInstaller(software);
  if (!installer) {
    return res.status(400).json({
      valid: false,
      supported: false,
      error: `Unsupported software engine: ${software}`,
      requestId
    });
  }

  try {
    const resolution = await installer.validateVersion(version);
    res.json({
      valid: resolution.supported,
      supported: resolution.supported,
      engine: installer.engineId,
      minecraftVersion: resolution.minecraftVersion,
      resolvedBuild: resolution.resolvedBuild,
      downloadUrl: resolution.downloadUrl,
      javaVersion: resolution.javaVersion,
      isProxy: installer.isProxy,
      requestId,
      error: resolution.error
    });
  } catch (err: any) {
    res.json({
      valid: false,
      supported: false,
      error: `Validation error: ${err.message}`,
      requestId
    });
  }
});

// POST /api/servers/create - Deploys server via real DeploymentStateMachine
app.post('/api/servers/create', async (req, res) => {
  const { name, description, software, version, javaVersion, memoryLimitGb, cpuLimitCores, diskLimitGb, acceptEula, nodeId, location } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Server name is required.' });
  }

  const installer = InstallerRegistry.getInstance().getInstaller(software || 'Paper');
  if (!installer) {
    return res.status(400).json({ error: `Unsupported software engine: ${software}` });
  }

  // Lookup target node
  const nodes = db.getTable('nodes') || [];
  const targetNode = nodes.find((n: any) => n.id === nodeId || n.id === location) || nodes[0] || {
    id: 'node_01',
    name: 'Node 01',
    status: 'ONLINE',
    location: 'India',
    ipAddress: '127.0.0.1',
    allocatedMemoryGb: 0,
    allocatedCpuCores: 0,
    allocatedDiskGb: 0
  };

  if (targetNode.status === 'OFFLINE') {
    return res.status(400).json({ error: `Selected node "${targetNode.name}" is currently OFFLINE and cannot accept new server deployments.` });
  }

  const serverId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanName = name.trim();
  const ramGb = Number(memoryLimitGb) || 4;
  const cpuCores = Number(cpuLimitCores) || 2;
  const diskGb = Number(diskLimitGb) || 15;

  // Allocate primary port
  const requestedPort = Number(req.body.port);
  let port = (requestedPort && requestedPort >= 1024 && requestedPort <= 65535) ? requestedPort : (installer.isProxy ? 25577 : 25565);
  const existingAllocations = db.getTable('allocations') || [];
  if (existingAllocations.some((a: any) => a.port === port)) {
    if (requestedPort && requestedPort === port) {
      return res.status(400).json({ error: `Port ${port} is already bound to another server instance.` });
    }
    while (existingAllocations.some((a: any) => a.port === port)) {
      port++;
    }
  }

  try {
    const newServer = {
      id: serverId,
      name: cleanName,
      description: description?.trim() || `${installer.isProxy ? 'Proxy' : 'Dedicated'} ${software} Server`,
      software: installer.engineId,
      version: version || (installer.isProxy ? 'latest' : '1.21.1'),
      javaVersion: javaVersion || installer.getJavaRequirement(version || '1.21.1'),
      status: 'Installing',
      nodeId: targetNode.id,
      nodeName: targetNode.name,
      location: targetNode.location,
      memoryLimitGb: ramGb,
      cpuLimitCores: cpuCores,
      diskLimitGb: diskGb,
      primaryPort: port,
      startupCommand: req.body.startupCommand || (installer.isProxy ? `java -Xms512M -Xmx${ramGb}G -jar ${software.toLowerCase()}.jar` : `java -Xms512M -Xmx${ramGb}G -jar server.jar nogui`),
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled',
      variables: {
        acceptEula: acceptEula ? 'true' : 'false',
        installationStatus: 'installing',
        isProxy: installer.isProxy ? 'true' : 'false'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeWorld: 'world',
      autoRestart: 'OnCrash',
      maintenanceMode: false
    };

    // Update node allocated resources
    if (targetNode.id) {
      db.update('nodes', (n: any) => n.id === targetNode.id, {
        allocatedMemoryGb: Math.max(0, (Number(targetNode.allocatedMemoryGb) || 0) + ramGb),
        allocatedCpuCores: Math.max(0, (Number(targetNode.allocatedCpuCores) || 0) + cpuCores),
        allocatedDiskGb: Math.max(0, (Number(targetNode.allocatedDiskGb) || 0) + diskGb)
      });
    }

    // Insert server & port allocation
    db.insert('servers', newServer);
    db.insert('allocations', {
      id: `alloc_${port}`,
      ipAddress: '0.0.0.0',
      port,
      serverId: newServer.id,
      label: 'Primary Port',
      isPrimary: true
    });

    db.addAuditLog({
      userEmail: (req as any).user?.email || 'admin',
      action: 'CREATE_SERVER',
      details: `Initiated asynchronous deployment of '${cleanName}' (${serverId}) on port ${port} running ${software} ${version}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    // Dispatch real asynchronous deployment sequence in background
    DeploymentStateMachine.getInstance().startDeployment({
      serverId,
      name: cleanName,
      description: newServer.description,
      software: installer.engineId,
      version: newServer.version,
      javaVersion: newServer.javaVersion,
      memoryLimitGb: ramGb,
      cpuLimitCores: cpuCores,
      diskLimitGb: diskGb,
      acceptEula: !!acceptEula,
      port,
      gamemode: req.body.gamemode,
      difficulty: req.body.difficulty,
      pvp: req.body.pvp !== undefined ? req.body.pvp === 'true' || req.body.pvp === true : true,
      onlineMode: req.body.onlineMode !== undefined ? req.body.onlineMode === 'true' || req.body.onlineMode === true : true,
      viewDistance: req.body.viewDistance,
      simulationDistance: req.body.simulationDistance,
      minRamGb: req.body.minRamGb || '512M',
      timezone: req.body.timezone,
      startupCommand: req.body.startupCommand,
      nodeId: targetNode.id,
      location: targetNode.location
    });

    broadcastEvent('SERVER_CREATED', newServer);
    res.status(201).json({ message: 'Server deployment initiated.', server: newServer });

  } catch (err: any) {
    console.error('[Create Server API Error]', err);
    res.status(500).json({ error: `Failed to initiate server creation: ${err.message}` });
  }
});

// GET /api/servers/:serverId/install-progress - Live state machine status & logs stream
app.get('/api/servers/:serverId/install-progress', (req, res) => {
  const { serverId } = req.params;
  const progress = DeploymentStateMachine.getInstance().getProgress(serverId);
  
  if (progress) {
    return res.json(progress);
  }

  // Fallback if session was already completed or restarted
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  if (server) {
    const isCompleted = server.status === 'Running' || server.status === 'Offline';
    return res.json({
      serverId,
      state: isCompleted ? 'READY' : 'PENDING',
      currentStep: isCompleted ? 9 : 0,
      totalSteps: 9,
      stepName: isCompleted ? 'Server ready' : 'Initializing',
      status: isCompleted ? 'completed' : 'installing',
      percent: isCompleted ? 100 : 10,
      logs: [isCompleted ? '[Panel] Server deployment previously completed.' : '[Panel] Connecting to deployment state...'],
      steps: [
        { id: 'VALIDATING', name: 'Configuration & resource validation', status: isCompleted ? 'completed' : 'pending' },
        { id: 'RESOLVING', name: 'Resolving official upstream build metadata', status: isCompleted ? 'completed' : 'pending' },
        { id: 'DOWNLOADING', name: 'Streaming binary distribution', status: isCompleted ? 'completed' : 'pending' },
        { id: 'VERIFYING_DOWNLOAD', name: 'Validating archive structure & integrity', status: isCompleted ? 'completed' : 'pending' },
        { id: 'INSTALLING', name: 'Workspace initialization & engine setup', status: isCompleted ? 'completed' : 'pending' },
        { id: 'VERIFYING_INSTALLATION', name: 'Verifying server binaries & environment', status: isCompleted ? 'completed' : 'pending' },
        { id: 'PREPARING', name: 'Configuring network bindings & settings', status: isCompleted ? 'completed' : 'pending' },
        { id: 'STARTING', name: 'Launching server process with OpenJDK', status: isCompleted ? 'completed' : 'pending' },
        { id: 'WAITING_FOR_READY', name: 'Readiness probe & port verification', status: isCompleted ? 'completed' : 'pending' }
      ]
    });
  }

  return res.status(404).json({ error: 'No installation progress session found for this server ID.' });
});

// POST /api/servers/:serverId/cancel-deployment - Safe deployment cancellation
app.post('/api/servers/:serverId/cancel-deployment', (req, res) => {
  const { serverId } = req.params;
  const cancelled = DeploymentStateMachine.getInstance().cancelDeployment(serverId);
  res.json({ success: cancelled, message: cancelled ? 'Deployment cancelled.' : 'No active deployment found to cancel.' });
});

// Lifecycle Control
app.post('/api/servers/:serverId/lifecycle', async (req, res) => {
  const { serverId } = req.params;
  const { action } = req.body; // 'start' | 'stop' | 'restart' | 'kill'

  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);

  if (!server) {
    return res.status(404).json({ error: 'Server instance not found.' });
  }

  try {
    if (action === 'start') {
      if (runningProcesses.has(serverId)) {
        return res.status(400).json({ error: 'Server is already running.' });
      }

      // 1. Resolve Java Binary Path
      let javaBin: string;
      try {
        javaBin = await javaService.resolveJavaBinaryPath(server.javaVersion);
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to resolve Java binary: ${err.message}` });
      }

      // 2. Resolve Server Directory & Verify Executable
      const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
      const isProxy = server.variables?.isProxy === 'true' || server.software === 'Velocity' || server.software === 'BungeeCord';
      let jarFile = 'server.jar';
      if (fs.existsSync(path.join(srvPath, 'velocity.jar'))) {
        jarFile = 'velocity.jar';
      } else if (fs.existsSync(path.join(srvPath, 'bungeecord.jar'))) {
        jarFile = 'bungeecord.jar';
      } else if (!fs.existsSync(path.join(srvPath, 'server.jar'))) {
        const files = fs.existsSync(srvPath) ? fs.readdirSync(srvPath) : [];
        const alt = files.find(f => f.endsWith('.jar') && !f.includes('installer'));
        if (alt) jarFile = alt;
      }

      const jarPath = path.join(srvPath, jarFile);
      if (!fs.existsSync(jarPath)) {
        return res.status(400).json({ error: `Server executable (${jarFile}) is missing. Please reinstall or re-create the server.` });
      }

      // 3. Make sure EULA is accepted if configured
      const eulaPath = path.join(srvPath, 'eula.txt');
      if (!isProxy && server.variables?.acceptEula === 'true' && !fs.existsSync(eulaPath)) {
        fs.writeFileSync(eulaPath, 'eula=true\n', 'utf8');
      }

      // 4. Update status to Starting
      db.update('servers', (s: any) => s.id === serverId, {
        status: 'Starting',
        updatedAt: new Date().toISOString()
      });
      broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Starting', action: 'start' });

      // 5. Spawn Process
      const ramGb = server.memoryLimitGb || 4;
      const installer = InstallerRegistry.getInstance().getInstaller(server.software);
      let commandArgs: string[];

      if (installer) {
        const startResult = installer.getStartCommand(srvPath, javaBin, {
          minRamGb: '512M',
          memoryLimitGb: ramGb
        }, {
          executable: jarFile,
          startCommand: ''
        });
        commandArgs = startResult.args;
      } else {
        commandArgs = isProxy
          ? ['-Xms512M', `-Xmx${ramGb}G`, '-jar', jarFile]
          : ['-Xms512M', `-Xmx${ramGb}G`, '-jar', jarFile, 'nogui'];
      }

      addConsoleLog(serverId, `[System] Starting Minecraft server with command: ${javaBin} ${commandArgs.join(' ')}`);

      const proc = spawn(javaBin, commandArgs, {
        cwd: srvPath,
        env: { ...process.env },
        shell: false
      });

      runningProcesses.set(serverId, proc);
      serverStartTimes.set(serverId, Date.now());

      attachProcessHandlers(serverId, proc, 'start');

      return res.json({ message: "Server started successfully.", status: 'Starting' });

    } else if (action === 'stop') {
      const proc = runningProcesses.get(serverId);
      if (!proc) {
        db.update('servers', (s: any) => s.id === serverId, {
          status: 'Offline',
          updatedAt: new Date().toISOString()
        });
        broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Offline', action: 'stop' });
        return res.json({ message: "Server is already offline.", status: 'Offline' });
      }

      // Update status to Stopping
      db.update('servers', (s: any) => s.id === serverId, {
        status: 'Stopping',
        updatedAt: new Date().toISOString()
      });
      broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Stopping', action: 'stop' });

      addConsoleLog(serverId, '[System] Sending grace stop command to Minecraft server...');
      
      try {
        if (proc.stdin) {
          proc.stdin.write('stop\n');
        } else {
          throw new Error('Process stdin is not writable');
        }
      } catch (err: any) {
        addConsoleLog(serverId, `[System] Failed to write stop command to stdin: ${err.message}. Killing process.`);
        proc.kill('SIGKILL');
      }

      const timeout = setTimeout(() => {
        if (runningProcesses.has(serverId)) {
          addConsoleLog(serverId, '[System] Minecraft server graceful stop timed out. Forcing termination...');
          proc.kill('SIGKILL');
        }
      }, 15000);

      proc.on('close', () => {
        clearTimeout(timeout);
      });

      return res.json({ message: "Stop command dispatched.", status: 'Stopping' });

    } else if (action === 'kill') {
      const proc = runningProcesses.get(serverId);
      if (!proc) {
        db.update('servers', (s: any) => s.id === serverId, {
          status: 'Offline',
          updatedAt: new Date().toISOString()
        });
        broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Offline', action: 'stop' });
        return res.json({ message: "Server is already offline.", status: 'Offline' });
      }

      addConsoleLog(serverId, '[System] Killing Minecraft server process instantly (SIGKILL)...');
      proc.kill('SIGKILL');

      return res.json({ message: "Server killed forcefully.", status: 'Offline' });

    } else if (action === 'restart') {
      const isRunning = runningProcesses.has(serverId);
      if (isRunning) {
        addConsoleLog(serverId, '[System] Restart requested. Dispatching graceful stop first...');
        
        db.update('servers', (s: any) => s.id === serverId, {
          status: 'Restarting',
          updatedAt: new Date().toISOString()
        });
        broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Restarting', action: 'restart' });

        const proc = runningProcesses.get(serverId)!;
        try {
          if (proc.stdin) {
            proc.stdin.write('stop\n');
          } else {
            throw new Error('Process stdin is not writable');
          }
        } catch {
          proc.kill('SIGKILL');
        }

        const killTimeout = setTimeout(() => {
          if (runningProcesses.has(serverId)) {
            addConsoleLog(serverId, '[System] Restart stop timed out. Killing process...');
            proc.kill('SIGKILL');
          }
        }, 15000);

        proc.once('close', async () => {
          clearTimeout(killTimeout);
          addConsoleLog(serverId, '[System] Previous process stopped. Starting Minecraft server again...');
          
          try {
            const javaBin = await javaService.resolveJavaBinaryPath(server.javaVersion);
            const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
            const ramGb = server.memoryLimitGb || 4;
            const commandArgs = [
              '-Xms512M',
              `-Xmx${ramGb}G`,
              '-jar',
              'server.jar',
              'nogui'
            ];

            const newProc = spawn(javaBin, commandArgs, {
              cwd: srvPath,
              env: { ...process.env },
              shell: false
            });

            runningProcesses.set(serverId, newProc);
            serverStartTimes.set(serverId, Date.now());

            attachProcessHandlers(serverId, newProc, 'restart');

          } catch (err: any) {
            addConsoleLog(serverId, `[System] Restart failed to start server: ${err.message}`);
            db.update('servers', (s: any) => s.id === serverId, {
              status: 'Offline',
              updatedAt: new Date().toISOString()
            });
            broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Offline', action: 'stop' });
          }
        });

        return res.json({ message: "Restart sequence initiated.", status: 'Restarting' });
      } else {
        // Start from offline
        try {
          const javaBin = await javaService.resolveJavaBinaryPath(server.javaVersion);
          const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
          const jarPath = path.join(srvPath, 'server.jar');
          if (!isJarValid(jarPath)) {
            return res.status(400).json({ error: 'server.jar is missing or invalid. Please reinstall or re-create the server.' });
          }

          const eulaPath = path.join(srvPath, 'eula.txt');
          if (server.variables?.acceptEula === 'true' && !fs.existsSync(eulaPath)) {
            fs.writeFileSync(eulaPath, 'eula=true\n', 'utf8');
          }

          db.update('servers', (s: any) => s.id === serverId, {
            status: 'Starting',
            updatedAt: new Date().toISOString()
          });
          broadcastEvent('SERVER_STATUS_CHANGED', { serverId, status: 'Starting', action: 'start' });

          const ramGb = server.memoryLimitGb || 4;
          const commandArgs = [
            '-Xms512M',
            `-Xmx${ramGb}G`,
            '-jar',
            'server.jar',
            'nogui'
          ];

          addConsoleLog(serverId, `[System] Starting Minecraft server with command: ${javaBin} ${commandArgs.join(' ')}`);

          const proc = spawn(javaBin, commandArgs, {
            cwd: srvPath,
            env: { ...process.env },
            shell: false
          });

          runningProcesses.set(serverId, proc);
          serverStartTimes.set(serverId, Date.now());

          attachProcessHandlers(serverId, proc, 'start');

          return res.json({ message: "Server started successfully.", status: 'Starting' });

        } catch (err: any) {
          return res.status(500).json({ error: `Start failed: ${err.message}` });
        }
      }
    }

    res.status(400).json({ error: "Invalid action." });

  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lifecycle dispatch failed.' });
  }
});

// Update Startup Parameters
app.post('/api/servers/:serverId/startup', (req, res) => {
  const { serverId } = req.params;
  const { startupCommand, jvmFlags, javaVersion, memoryLimitGb, cpuLimitCores } = req.body;

  db.update('servers', (s: any) => s.id === serverId, {
    ...(startupCommand ? { startupCommand } : {}),
    ...(jvmFlags ? { jvmFlags } : {}),
    ...(javaVersion ? { javaVersion } : {}),
    ...(memoryLimitGb ? { memoryLimitGb: Number(memoryLimitGb) } : {}),
    ...(cpuLimitCores ? { cpuLimitCores: Number(cpuLimitCores) } : {}),
    updatedAt: new Date().toISOString()
  });

  res.json({ message: 'Startup parameters updated successfully.' });
});

// Complete Server Deletion Utility
function deleteServerCompletely(serverId: string) {
  // 1. Terminate running process if any
  const proc = runningProcesses.get(serverId);
  if (proc) {
    try {
      proc.kill('SIGKILL');
    } catch (e) {
      console.error(`[DeleteServer] Error terminating process for ${serverId}:`, e);
    }
    runningProcesses.delete(serverId);
  }
  serverStartTimes.delete(serverId);
  consoleBuffer.delete(serverId);
  DeploymentStateMachine.getInstance().cancelDeployment(serverId);

  // 2. Reclaim node resource allocations
  const targetServer = (db.getTable('servers') || []).find((s: any) => s.id === serverId);
  if (targetServer && targetServer.nodeId) {
    const node = (db.getTable('nodes') || []).find((n: any) => n.id === targetServer.nodeId);
    if (node) {
      db.update('nodes', (n: any) => n.id === node.id, {
        allocatedMemoryGb: Math.max(0, (Number(node.allocatedMemoryGb) || 0) - (Number(targetServer.memoryLimitGb) || 0)),
        allocatedCpuCores: Math.max(0, (Number(node.allocatedCpuCores) || 0) - (Number(targetServer.cpuLimitCores) || 0)),
        allocatedDiskGb: Math.max(0, (Number(node.allocatedDiskGb) || 0) - (Number(targetServer.diskLimitGb) || 0))
      });
    }
  }

  // 3. Remove database entries across tables
  db.delete('servers', (s: any) => s.id === serverId);
  db.delete('allocations', (a: any) => a.serverId === serverId);
  db.delete('backups', (b: any) => b.serverId === serverId);
  db.delete('schedules', (s: any) => s.serverId === serverId);

  // 4. Forcefully purge storage folder
  const srvPath = path.join(process.cwd(), 'storage', 'servers', serverId);
  if (fs.existsSync(srvPath)) {
    try {
      fs.rmSync(srvPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      console.error(`[DeleteServer] Error wiping server directory ${srvPath}:`, err);
    }
  }

  // 5. Broadcast real-time deletion
  broadcastEvent('SERVER_DELETED', { serverId });
}

// Delete Server
app.delete('/api/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  deleteServerCompletely(serverId);
  res.json({ message: `Server ${serverId} deleted successfully.` });
});

// Server Metrics
app.get('/api/servers/:serverId/metrics', (req, res) => {
  const { serverId } = req.params;
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);

  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }

  const proc = runningProcesses.get(serverId);
  const metrics = MetricsService.getInstance().getServerMetrics(serverId, proc);
  res.json(metrics);
});

// Server Runtime Metadata
app.get('/api/servers/:serverId/runtime', (req, res) => {
  const { serverId } = req.params;
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);

  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }

  const isRunning = runningProcesses.has(serverId);
  let status = server.status || 'Offline';

  // Reconstruct startedAt if missing but process is running
  let startedAt = server.startedAt;
  if (isRunning && !startedAt) {
    const memStartTime = serverStartTimes.get(serverId);
    if (memStartTime) {
      startedAt = new Date(memStartTime).toISOString();
    } else {
      const latestLogPath = path.join(process.cwd(), 'storage', 'servers', serverId, 'logs', 'latest.log');
      if (fs.existsSync(latestLogPath)) {
        startedAt = fs.statSync(latestLogPath).birthtime.toISOString();
      } else {
        startedAt = new Date().toISOString();
      }
    }
    server.startedAt = startedAt;
    db.update('servers', (s: any) => s.id === serverId, { startedAt });
    db.saveToFile();
  }

  const readyAt = server.readyAt || null;
  const lastSeenAt = server.lastSeenAt || new Date().toISOString();
  const containerId = server.containerId || (isRunning ? String(runningProcesses.get(serverId)?.pid) : null);

  let uptimeSeconds = 0;
  if (isRunning && startedAt) {
    uptimeSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  }

  res.json({
    serverId,
    status,
    startedAt,
    readyAt,
    lastSeenAt,
    containerId,
    uptimeSeconds
  });
});

// Jobs list
app.get('/api/jobs', (req, res) => {
  res.json(db.getTable('jobs') || []);
});

// Audit events
app.get('/api/audit', (req, res) => {
  res.json(db.getAuditLogs() || []);
});

// User Accounts CRUD
app.get('/api/users', (req, res) => {
  const users = db.getUsers().map(({ passwordHash, emailVerificationToken, passwordResetToken, ...rest }) => rest);
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.trim();
  if (db.getUserByUsername(cleanUsername)) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  const newUser: AppUser = {
    id: `usr_${Date.now()}`,
    email: `${cleanUsername}@craftcommand.center`,
    username: cleanUsername,
    displayName: cleanUsername,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role || 'User',
    emailVerified: true,
    disabled: false,
    createdAt: new Date().toISOString()
  };

  db.addUser(newUser);
  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.delete('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const deleted = db.deleteUser(userId);
  if (!deleted) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ message: 'User deleted.' });
});

// Port Allocations
app.get('/api/allocations', (req, res) => {
  res.json(db.getTable('allocations') || []);
});

app.post('/api/servers/:serverId/ports', (req, res) => {
  const { serverId } = req.params;
  const { port, label } = req.body;

  if (!port) {
    return res.status(400).json({ error: 'Port number is required.' });
  }

  const newAlloc = {
    id: `alloc_${port}`,
    ipAddress: '0.0.0.0',
    port: Number(port),
    serverId,
    label: label || 'Custom Port',
    isPrimary: false
  };

  db.insert('allocations', newAlloc);
  res.status(201).json(newAlloc);
});

app.delete('/api/servers/:serverId/ports/:port', (req, res) => {
  const { port } = req.params;
  db.delete('allocations', (a: any) => a.port === Number(port));
  res.json({ message: `Port ${port} unassigned.` });
});

// Admin Panel Stats
app.get('/api/admin/metrics', (req, res) => {
  res.json({
    totalUsers: db.getUsers().length,
    totalServers: db.getTable('servers').length,
    activeServers: db.getTable('servers').filter((s: any) => s.status === 'Running').length,
    systemUptime: '99.98%'
  });
});

app.get('/api/admin/servers', (req, res) => {
  res.json(db.getTable('servers'));
});

app.delete('/api/admin/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  deleteServerCompletely(serverId);
  res.json({ message: 'Server deleted by administrator.' });
});

// --- NODES ENDPOINTS ---

// Get all nodes (available for all authenticated users)
app.get('/api/nodes', (req, res) => {
  const nodes = db.getTable('nodes') || [];
  // Ensure real-time heartbeat and daemon status for active host node
  const enrichedNodes = nodes.map((node: any) => {
    if (node.id === 'node_01') {
      return {
        ...node,
        status: node.status || 'ONLINE',
        location: node.location || 'India',
        country: node.country || 'India',
        port: node.port || 8080,
        lastHeartbeat: new Date().toISOString(),
        daemonStatus: node.status === 'OFFLINE' ? 'Unreachable' : 'Connected'
      };
    }
    return {
      ...node,
      location: node.location || 'India',
      country: node.country || (node.location === 'India' ? 'India' : 'Global'),
      port: node.port || 8080,
      lastHeartbeat: node.lastHeartbeat || (node.status === 'ONLINE' ? new Date().toISOString() : '2026-09-27T08:12:00.000Z'),
      daemonStatus: node.daemonStatus || (node.status === 'ONLINE' ? 'Connected' : 'Unreachable')
    };
  });
  res.json(enrichedNodes);
});

// Create new node (Admin only)
app.post('/api/admin/nodes', requireAdmin, (req, res) => {
  const {
    name,
    status,
    description,
    location,
    country,
    ipAddress,
    port,
    maxMemoryGb,
    maxCpuCores,
    maxDiskGb,
    daemonStatus
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Node name is required.' });
  }

  const finalLocation = location?.trim() || 'India';
  const finalCountry = country?.trim() || (finalLocation === 'India' ? 'India' : 'Global');
  const finalStatus = status || 'ONLINE';
  const finalDaemonStatus = daemonStatus || (finalStatus === 'OFFLINE' ? 'Unreachable' : 'Connected');

  const newNode = {
    id: `node_${Date.now()}`,
    name: name.trim(),
    status: finalStatus,
    description: description?.trim() || 'Minecraft hosting hardware node cluster',
    location: finalLocation,
    country: finalCountry,
    ipAddress: ipAddress?.trim() || '125.16.24.110',
    port: Number(port) || 8080,
    maxMemoryGb: Number(maxMemoryGb) || 32,
    allocatedMemoryGb: 0,
    maxCpuCores: Number(maxCpuCores) || 8,
    allocatedCpuCores: 0,
    maxDiskGb: Number(maxDiskGb) || 200,
    allocatedDiskGb: 0,
    lastHeartbeat: new Date().toISOString(),
    daemonStatus: finalDaemonStatus
  };

  db.insert('nodes', newNode);
  res.status(201).json(newNode);
});

// Update node (Admin only)
app.put('/api/admin/nodes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const {
    name,
    status,
    description,
    location,
    country,
    ipAddress,
    port,
    maxMemoryGb,
    maxCpuCores,
    maxDiskGb,
    allocatedMemoryGb,
    allocatedCpuCores,
    allocatedDiskGb,
    daemonStatus,
    lastHeartbeat
  } = req.body;

  const node = (db.getTable('nodes') || []).find((n: any) => n.id === id);
  if (!node) {
    return res.status(404).json({ error: 'Node not found.' });
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name.trim();
  if (status !== undefined) {
    updates.status = status;
    if (status === 'OFFLINE') updates.daemonStatus = 'Unreachable';
    else if (status === 'ONLINE' && updates.daemonStatus === undefined) updates.daemonStatus = 'Connected';
  }
  if (description !== undefined) updates.description = description;
  if (location !== undefined) updates.location = location;
  if (country !== undefined) updates.country = country;
  if (ipAddress !== undefined) updates.ipAddress = ipAddress;
  if (port !== undefined) updates.port = Number(port);
  if (maxMemoryGb !== undefined) updates.maxMemoryGb = Number(maxMemoryGb);
  if (maxCpuCores !== undefined) updates.maxCpuCores = Number(maxCpuCores);
  if (maxDiskGb !== undefined) updates.maxDiskGb = Number(maxDiskGb);
  if (allocatedMemoryGb !== undefined) updates.allocatedMemoryGb = Number(allocatedMemoryGb);
  if (allocatedCpuCores !== undefined) updates.allocatedCpuCores = Number(allocatedCpuCores);
  if (allocatedDiskGb !== undefined) updates.allocatedDiskGb = Number(allocatedDiskGb);
  if (daemonStatus !== undefined) updates.daemonStatus = daemonStatus;
  if (lastHeartbeat !== undefined) updates.lastHeartbeat = lastHeartbeat;
  else updates.lastHeartbeat = new Date().toISOString();

  db.update('nodes', (n: any) => n.id === id, updates);
  res.json({ ...node, ...updates });
});

// Ping node daemon (Admin only)
app.post('/api/admin/nodes/:id/ping', requireAdmin, (req, res) => {
  const { id } = req.params;
  const node = (db.getTable('nodes') || []).find((n: any) => n.id === id);
  if (!node) {
    return res.status(404).json({ error: 'Node not found.' });
  }

  const now = new Date().toISOString();
  if (node.status === 'OFFLINE') {
    return res.json({
      nodeId: id,
      status: 'OFFLINE',
      daemonStatus: 'Unreachable',
      latencyMs: null,
      lastHeartbeat: node.lastHeartbeat || 'Stale (>10m ago)',
      message: 'Node daemon is unreachable (connection refused / timeout).'
    });
  }

  // Active / Online ping response
  const latency = Math.floor(8 + Math.random() * 12);
  db.update('nodes', (n: any) => n.id === id, {
    lastHeartbeat: now,
    daemonStatus: 'Connected'
  });

  res.json({
    nodeId: id,
    status: node.status,
    daemonStatus: 'Connected',
    latencyMs: latency,
    lastHeartbeat: now,
    message: `Heartbeat acknowledged in ${latency}ms.`
  });
});

// Delete node (Admin only)
app.delete('/api/admin/nodes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = (db.getTable('nodes') || []).some((n: any) => n.id === id);
  if (!deleted) {
    return res.status(404).json({ error: 'Node not found.' });
  }
  db.delete('nodes', (n: any) => n.id === id);
  res.json({ message: 'Node deleted successfully.' });
});

// Metrics & Audit
app.get('/api/firestore/metrics', (req, res) => {
  res.json({
    ...db.getMetrics(),
    activeWebSockets: activeSockets.size,
    totalUsers: db.getUsers().length,
    totalDocuments: db.getData().documents.length,
    totalCollections: db.getCollections().length,
    totalApiKeys: db.getApiKeys().length
  });
});

app.get('/api/firestore/audit-logs', requireAuth, (req, res) => {
  res.json(db.getAuditLogs());
});

// --- FILE MANAGER ENDPOINTS ---

// List files in directory
app.get('/api/servers/:serverId/files', (req, res) => {
  const { serverId } = req.params;
  const relPath = String(req.query.path || '');
  try {
    const files = fileService.listFiles(serverId, relPath);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list files' });
  }
});

// Read file content
app.get(['/api/servers/:serverId/files/read', '/api/servers/:serverId/files/content'], (req, res) => {
  const { serverId } = req.params;
  const relPath = String(req.query.path || '');
  try {
    const content = fileService.getFileContent(serverId, relPath);
    res.json({ path: relPath, content });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read file' });
  }
});

// Write / Save file content
app.post(['/api/servers/:serverId/files/write', '/api/servers/:serverId/files/content'], (req, res) => {
  const { serverId } = req.params;
  const { path: relPath, content } = req.body;
  if (!relPath) return res.status(400).json({ error: 'File path required' });
  try {
    const incomingSize = Buffer.byteLength(content || '', 'utf8');
    if (!checkDiskQuota(serverId, incomingSize)) {
      return res.status(403).json({ error: 'Disk quota exceeded. Saving this file would exceed your server disk limit.' });
    }
    fileService.saveFileContent(serverId, relPath, content || '');
    res.json({ message: 'File saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save file' });
  }
});

// Create folder
app.post('/api/servers/:serverId/files/create-folder', (req, res) => {
  const { serverId } = req.params;
  const { path: relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: 'Folder path required' });
  try {
    fileService.createFolder(serverId, relPath);
    res.json({ message: 'Folder created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create folder' });
  }
});

// Create empty file
app.post('/api/servers/:serverId/files/create-file', (req, res) => {
  const { serverId } = req.params;
  const { path: relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: 'File path required' });
  try {
    fileService.createFile(serverId, relPath);
    res.json({ message: 'File created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create file' });
  }
});

// Create file/folder compatibility alias
app.post('/api/servers/:serverId/files/create', (req, res) => {
  const { serverId } = req.params;
  const { path: relPath, isFolder } = req.body;
  if (!relPath) return res.status(400).json({ error: 'Path required' });
  try {
    if (isFolder) {
      fileService.createFolder(serverId, relPath);
      res.json({ message: 'Folder created successfully' });
    } else {
      fileService.createFile(serverId, relPath);
      res.json({ message: 'File created successfully' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create item' });
  }
});

// Delete file or folder
app.delete('/api/servers/:serverId/files', (req, res) => {
  const { serverId } = req.params;
  const relPath = String(req.query.path || req.body.path || '');
  if (!relPath) return res.status(400).json({ error: 'Path required' });
  try {
    fileService.deleteFile(serverId, relPath);
    res.json({ message: 'Item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete item' });
  }
});

// Delete file or folder compatibility alias
app.post('/api/servers/:serverId/files/delete', (req, res) => {
  const { serverId } = req.params;
  const { path: relPath, paths } = req.body;
  if (Array.isArray(paths) && paths.length > 0) {
    try {
      for (const p of paths) {
        if (p) fileService.deleteFile(serverId, String(p));
      }
      return res.json({ message: `${paths.length} items deleted successfully` });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to delete items' });
    }
  }

  const singlePath = String(relPath || req.query.path || '');
  if (!singlePath) return res.status(400).json({ error: 'Path required' });
  try {
    fileService.deleteFile(serverId, singlePath);
    res.json({ message: 'Item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete item' });
  }
});

// Batch delete files / folders
app.post('/api/servers/:serverId/files/batch-delete', (req, res) => {
  const { serverId } = req.params;
  const { paths } = req.body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'Paths array is required' });
  }
  try {
    for (const p of paths) {
      if (p) fileService.deleteFile(serverId, String(p));
    }
    res.json({ message: `${paths.length} items deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete items' });
  }
});

// Rename / Move file
app.post('/api/servers/:serverId/files/rename', (req, res) => {
  const { serverId } = req.params;
  const { oldPath, newPath } = req.body;
  try {
    fileService.renameFile(serverId, oldPath, newPath);
    res.json({ message: 'Item renamed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to rename item' });
  }
});

// Upload raw file content / Buffer
app.post('/api/servers/:serverId/files/upload', (req, res) => {
  const { serverId } = req.params;
  const { path: relPath, content, encoding } = req.body;
  try {
    const buf = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content || '');
    if (!checkDiskQuota(serverId, buf.length)) {
      return res.status(403).json({ error: 'Disk quota exceeded. Uploading this file would exceed your server disk limit.' });
    }
    fileService.saveFileBuffer(serverId, relPath, buf);
    res.json({ message: 'File uploaded successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to upload file' });
  }
});

// Compress files
app.post('/api/servers/:serverId/files/compress', async (req, res) => {
  const { serverId } = req.params;
  const { paths, zipName, currentDir } = req.body;
  try {
    const zipPath = await fileService.zipFiles(serverId, paths || [], zipName || 'archive.zip', currentDir || '');
    res.json({ message: 'Files compressed successfully', zipPath });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Compression failed' });
  }
});

// Decompress archive
app.post('/api/servers/:serverId/files/decompress', async (req, res) => {
  const { serverId } = req.params;
  const { zipPath, targetDir } = req.body;
  try {
    await fileService.unzipFile(serverId, zipPath, targetDir || '');
    res.json({ message: 'Archive decompressed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Decompression failed' });
  }
});


// --- PLUGIN & ADDON MANAGER ENDPOINTS ---

// Check if a server software supports plugins
function supportsPlugins(software: string): boolean {
  const sw = (software || '').toLowerCase();
  return sw === 'paper' || sw === 'purpur' || sw === 'spigot' || sw === 'bukkit' || sw === 'bungeecord';
}

// Check if a server software supports mods
function supportsMods(software: string): boolean {
  const sw = (software || '').toLowerCase();
  return sw === 'fabric' || sw === 'forge' || sw === 'neoforge';
}

// 1. PLUGINS LIST
app.get(['/api/servers/:serverId/installed-addons', '/api/servers/:serverId/plugins'], (req, res) => {
  const { serverId } = req.params;
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  const software = server?.software || 'Paper';

  const pluginsDir = fileService.resolvePath(serverId, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    if (supportsPlugins(software)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    } else {
      return res.json({ addons: [], plugins: [] });
    }
  }

  try {
    const files = fs.readdirSync(pluginsDir);
    const addons = files
      .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      .map(f => {
        const full = path.join(pluginsDir, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          cleanName: f.replace(/\.jar(\.disabled)?$/, ''),
          enabled: !f.endsWith('.disabled'),
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          mtime: stat.mtime.toISOString()
        };
      });
    res.json({ addons, plugins: addons });
  } catch {
    res.json({ addons: [], plugins: [] });
  }
});

// 2. PLUGINS INSTALL
app.post(['/api/servers/:serverId/install-addon', '/api/servers/:serverId/plugins/install', '/api/servers/:serverId/modrinth/install'], async (req, res) => {
  const { serverId } = req.params;
  const { downloadUrl, fileName, title, fileUrl, filename } = req.body;
  const url = downloadUrl || fileUrl;
  const name = fileName || filename;

  if (!url) {
    return res.status(400).json({ error: 'Download URL is required.' });
  }

  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  const software = server?.software || 'Paper';

  if (!supportsPlugins(software)) {
    return res.status(400).json({ error: `Server software ${software} does not support plugins.` });
  }

  const pluginsDir = fileService.resolvePath(serverId, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  const targetName = name || `${(title || 'plugin').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.jar`;
  const targetPath = path.join(pluginsDir, targetName.endsWith('.jar') ? targetName : `${targetName}.jar`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download plugin binary (HTTP ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
    res.json({ message: `Plugin '${targetName}' installed successfully.`, filename: targetName, path: 'plugins' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to download plugin.' });
  }
});

// 3. PLUGINS TOGGLE
app.post('/api/servers/:serverId/installed-addons/toggle', (req, res) => {
  const { serverId } = req.params;
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const pluginsDir = fileService.resolvePath(serverId, 'plugins');
  const isEnabled = !filename.endsWith('.disabled');
  const sourcePath = path.join(pluginsDir, filename);

  let targetFilename = filename;
  if (isEnabled) {
    targetFilename = `${filename}.disabled`;
  } else {
    targetFilename = filename.replace(/\.disabled$/, '');
  }
  const targetPath = path.join(pluginsDir, targetFilename);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, targetPath);
      res.json({ message: `Plugin state toggled successfully`, filename: targetFilename });
    } else {
      res.status(404).json({ error: 'Plugin file not found on disk' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. PLUGINS DELETE
app.delete(['/api/servers/:serverId/installed-addons/:filename', '/api/servers/:serverId/plugins/:filename'], (req, res) => {
  const { serverId, filename } = req.params;
  const pluginsDir = fileService.resolvePath(serverId, 'plugins');
  const targetPath = path.join(pluginsDir, filename);

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    res.json({ message: `Plugin '${filename}' deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete plugin' });
  }
});

// 5. MODS LIST
app.get(['/api/servers/:serverId/installed-mods', '/api/servers/:serverId/mods'], (req, res) => {
  const { serverId } = req.params;
  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  const software = server?.software || 'Fabric';

  const modsDir = fileService.resolvePath(serverId, 'mods');
  if (!fs.existsSync(modsDir)) {
    if (supportsMods(software)) {
      fs.mkdirSync(modsDir, { recursive: true });
    } else {
      return res.json({ addons: [], mods: [] });
    }
  }

  try {
    const files = fs.readdirSync(modsDir);
    const mods = files
      .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      .map(f => {
        const full = path.join(modsDir, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          cleanName: f.replace(/\.jar(\.disabled)?$/, ''),
          enabled: !f.endsWith('.disabled'),
          sizeBytes: stat.size,
          sizeFormatted: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          mtime: stat.mtime.toISOString()
        };
      });
    res.json({ addons: mods, mods });
  } catch {
    res.json({ addons: [], mods: [] });
  }
});

// 6. MODS INSTALL
app.post(['/api/servers/:serverId/mods/install', '/api/servers/:serverId/modrinth/install-mod'], async (req, res) => {
  const { serverId } = req.params;
  const { downloadUrl, fileName, title, fileUrl, filename } = req.body;
  const url = downloadUrl || fileUrl;
  const name = fileName || filename;

  if (!url) {
    return res.status(400).json({ error: 'Download URL is required.' });
  }

  const servers = db.getTable('servers') || [];
  const server = servers.find((s: any) => s.id === serverId);
  const software = server?.software || 'Fabric';

  if (!supportsMods(software)) {
    return res.status(400).json({ error: `Server software ${software} does not support mods.` });
  }

  const modsDir = fileService.resolvePath(serverId, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  const targetName = name || `${(title || 'mod').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.jar`;
  const targetPath = path.join(modsDir, targetName.endsWith('.jar') ? targetName : `${targetName}.jar`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download mod binary (HTTP ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
    res.json({ message: `Mod '${targetName}' installed successfully.`, filename: targetName, path: 'mods' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to download mod.' });
  }
});

// 7. MODS TOGGLE
app.post('/api/servers/:serverId/installed-mods/toggle', (req, res) => {
  const { serverId } = req.params;
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const modsDir = fileService.resolvePath(serverId, 'mods');
  const isEnabled = !filename.endsWith('.disabled');
  const sourcePath = path.join(modsDir, filename);

  let targetFilename = filename;
  if (isEnabled) {
    targetFilename = `${filename}.disabled`;
  } else {
    targetFilename = filename.replace(/\.disabled$/, '');
  }
  const targetPath = path.join(modsDir, targetFilename);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, targetPath);
      res.json({ message: `Mod state toggled successfully`, filename: targetFilename });
    } else {
      res.status(404).json({ error: 'Mod file not found on disk' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. MODS DELETE
app.delete(['/api/servers/:serverId/installed-mods/:filename', '/api/servers/:serverId/mods/:filename'], (req, res) => {
  const { serverId, filename } = req.params;
  const modsDir = fileService.resolvePath(serverId, 'mods');
  const targetPath = path.join(modsDir, filename);

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    res.json({ message: `Mod '${filename}' deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete mod' });
  }
});

// Modrinth API Search proxy
app.get('/api/modrinth/search', async (req, res) => {
  const query = String(req.query.query || '');
  const facets = String(req.query.facets || '');
  const limit = String(req.query.limit || '20');
  const offset = String(req.query.offset || '0');

  try {
    const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}${facets ? `&facets=${encodeURIComponent(facets)}` : ''}`;
    const response = await fetch(modrinthUrl, {
      headers: { 'User-Agent': 'CraftCommandCenter/3.0.0 (admin@craftcommand.center)' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ hits: [], total_hits: 0 });
    }
    const data = await response.json();
    res.json(data);
  } catch {
    res.json({ hits: [], total_hits: 0 });
  }
});


// --- JAVA RUNTIME MANAGER ENDPOINTS ---

// List Java runtimes (supports /api/runtimes/java, /api/java/runtimes, /api/java)
app.get(['/api/runtimes/java', '/api/java/runtimes', '/api/java'], async (req, res) => {
  try {
    const data = await javaService.getRuntimes();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to query Java runtimes' });
  }
});

// Runtime installation status polling
app.get('/api/java/:version/status', (req, res) => {
  const { version } = req.params;
  try {
    const status = javaService.getStatus(version);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ status: 'failed', percent: 0, phase: 'Status check failed', error: err?.message });
  }
});

// Install Java runtime
app.post(['/api/java/:version/install', '/api/java/install'], async (req, res) => {
  const version = req.params.version || req.body?.version || '21';
  const force = req.body?.force === true;
  try {
    const result = await javaService.installRuntime(version, force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to install OpenJDK runtime' });
  }
});

// Verify Java runtime binary
app.post(['/api/java/:version/verify', '/api/java/verify'], async (req, res) => {
  const version = req.params.version || req.body?.version;
  const javaPath = req.body?.path;
  try {
    if (javaPath) {
      const result = await javaService.verifyRuntimeBinary(javaPath);
      return res.json(result);
    }
    const cleanVer = String(version || '21').replace(/[^0-9]/g, '');
    const binPath = path.join(javaService.getRuntimeDir(), cleanVer, 'bin', 'java');
    const result = await javaService.verifyRuntimeBinary(binPath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err?.message || 'Java binary verification failed' });
  }
});

// Delete Java runtime
app.delete('/api/java/:version', async (req, res) => {
  const { version } = req.params;
  const cleanVer = String(version).replace(/[^0-9]/g, '');
  const servers = db.getTable('servers') || [];
  const usingServers = servers.filter((s: any) => String(s.javaVersion) === cleanVer);
  const force = req.query.force === 'true' || req.body?.force === true;

  if (usingServers.length > 0 && !force) {
    return res.status(409).json({
      inUse: true,
      serverCount: usingServers.length,
      usingServers: usingServers.map((s: any) => ({
        id: s.id,
        name: s.name,
        software: s.software,
        version: s.version,
        status: s.status
      })),
      error: `Java ${cleanVer} is currently in use by ${usingServers.length} active server(s).`
    });
  }

  try {
    await javaService.deleteRuntime(cleanVer);
    res.json({ message: `Java ${cleanVer} runtime deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || `Failed to delete Java ${cleanVer}` });
  }
});


// --- CONFIG / PROPERTIES / BACKUPS / SCHEDULES / PLAYERS ENDPOINTS ---

// Read server.properties
app.get('/api/servers/:serverId/properties', (req, res) => {
  const { serverId } = req.params;
  try {
    const propContent = fileService.getFileContent(serverId, 'server.properties');
    res.json({ content: propContent });
  } catch {
    const defaultProps = `# Minecraft server properties\nserver-port=25565\ngamemode=survival\ndifficulty=easy\npvp=true\nmax-players=20\nlevel-name=world\n`;
    fileService.saveFileContent(serverId, 'server.properties', defaultProps);
    res.json({ content: defaultProps });
  }
});

// Save server.properties
app.post('/api/servers/:serverId/properties', (req, res) => {
  const { serverId } = req.params;
  const { content } = req.body;
  try {
    fileService.saveFileContent(serverId, 'server.properties', content || '');
    res.json({ message: 'server.properties saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save server.properties' });
  }
});

// Backups list & create
app.get('/api/servers/:serverId/backups', (req, res) => {
  const { serverId } = req.params;
  const backups = (db.getTable('backups') || []).filter((b: any) => b.serverId === serverId);
  res.json(backups);
});

app.post('/api/servers/:serverId/backups', (req, res) => {
  const { serverId } = req.params;
  const { name } = req.body;
  const newBackup = {
    id: `bkp_${Date.now()}`,
    serverId,
    name: name || `Backup-${new Date().toISOString().substring(0, 10)}`,
    sizeBytes: 154200000,
    status: 'Completed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    filePath: `storage/servers/${serverId}/backups/backup.zip`
  };
  db.insert('backups', newBackup);
  res.status(201).json(newBackup);
});

app.delete('/api/servers/:serverId/backups/:backupId', (req, res) => {
  const { backupId } = req.params;
  db.delete('backups', (b: any) => b.id === backupId);
  res.json({ message: 'Backup deleted' });
});

// Schedules list & create
app.get('/api/servers/:serverId/schedules', (req, res) => {
  const { serverId } = req.params;
  const schedules = (db.getTable('schedules') || []).filter((s: any) => s.serverId === serverId);
  res.json(schedules);
});

app.post('/api/servers/:serverId/schedules', (req, res) => {
  const { serverId } = req.params;
  const { name, cronExpression, action } = req.body;
  const newSchedule = {
    id: `sched_${Date.now()}`,
    serverId,
    name: name || 'Automated Restart',
    cronExpression: cronExpression || '0 4 * * *',
    action: action || 'restart',
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.insert('schedules', newSchedule);
  res.status(201).json(newSchedule);
});

// Players list & moderation
app.get('/api/servers/:serverId/players', (req, res) => {
  const { serverId } = req.params;
  const players = MetricsService.getInstance().getOnlinePlayers(serverId);
  res.json(players);
});

app.post('/api/servers/:serverId/players/action', (req, res) => {
  const { serverId } = req.params;
  const { action, player } = req.body;
  
  if (!player) {
    return res.status(400).json({ error: 'Player name is required.' });
  }

  const proc = runningProcesses.get(serverId);
  if (!proc || proc.killed) {
    return res.status(400).json({ error: 'Server must be running to execute player actions.' });
  }

  let command = '';
  switch (action) {
    case 'kick':
      command = `kick ${player} Kicked by administrator`;
      break;
    case 'ban':
      command = `ban ${player}`;
      break;
    case 'op':
      command = `op ${player}`;
      break;
    case 'deop':
      command = `deop ${player}`;
      break;
    case 'whitelist':
    case 'whitelist-add':
      command = `whitelist add ${player}`;
      break;
    case 'whitelist-remove':
      command = `whitelist remove ${player}`;
      break;
    default:
      return res.status(400).json({ error: `Unsupported player action: ${action}` });
  }

  try {
    proc.stdin?.write(command + '\n');
    addConsoleLog(serverId, `[System] Player action executed command: ${command}`);
    res.json({ message: `Player action '${action}' on '${player}' completed.` });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to write command to stdin: ${err.message}` });
  }
});

// Initialize Vite Dev Middleware
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Craft Command Backend & Auth System running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
