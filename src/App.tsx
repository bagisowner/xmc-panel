import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon, FolderOpen, Users, Archive, Calendar, Globe, LineChart, HardDrive,
  Settings, Activity, Plus, Search, Power, Play, Square, RotateCw, Trash2, Edit2,
  Save, Undo, Check, FileText, ChevronRight, Menu, X, Lock, User, Grid, Cpu, Layers,
  Wifi, UserX, AlertCircle, Eye, LogOut, Command, ShieldAlert, KeyRound, ArrowRight,
  RefreshCw, FolderPlus, FilePlus, EyeOff, Sliders, Network, Sparkles, HelpCircle,
  FileCode, Database, CheckSquare, Clock, Upload, Volume2, VolumeX, AlertTriangle,
  Image as ImageIcon, Server as ServerIcon, Shield, Smartphone, ChevronDown, Filter,
  RotateCcw
} from 'lucide-react';
import { sounds } from './utils/sound';
import { BackgroundSystem, BackgroundSettings, DEFAULT_BACKGROUND_SETTINGS, WALLPAPER_PRESET_OPTIONS } from './components/BackgroundSystem';
import { ThemeModal } from './components/ThemeModal';
import { ServerCard } from './components/ServerCard';
import { ServerHero } from './components/ServerHero';
import { PluginManager } from './components/PluginManager';
import { JavaRuntimeManager } from './components/JavaRuntimeManager';
import { FileManager } from './components/FileManager';

const API_BASE = '/api';
const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws';

export default function App() {
  // Session & Authentication
  const [token, setToken] = useState<string | null>(localStorage.getItem('mc_token'));
  const [user, setUser] = useState<{ id: string; username: string; role: string; permissions: string[] } | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Background & Theme Customization (10 Settings Matrix)
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(() => {
    try {
      const saved = localStorage.getItem('arix_theme_settings');
      return saved ? { ...DEFAULT_BACKGROUND_SETTINGS, ...JSON.parse(saved) } : DEFAULT_BACKGROUND_SETTINGS;
    } catch {
      return DEFAULT_BACKGROUND_SETTINGS;
    }
  });
  const [showThemeModal, setShowThemeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateBgSettings = (updated: Partial<BackgroundSettings>) => {
    setBgSettings(prev => {
      const next = { ...prev, ...updated };
      localStorage.setItem('arix_theme_settings', JSON.stringify(next));
      return next;
    });
  };

  const resetBgSettings = () => {
    setBgSettings(DEFAULT_BACKGROUND_SETTINGS);
    localStorage.setItem('arix_theme_settings', JSON.stringify(DEFAULT_BACKGROUND_SETTINGS));
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateBgSettings({
          preset: 'custom',
          customUrl: dataUrl
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Layout & Navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'docker' | 'java' | 'users' | 'nodes' | 'settings' | 'audit'>('overview');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedServerTab, setSelectedServerTab] = useState<'console' | 'files' | 'plugins' | 'players' | 'backups' | 'schedules' | 'properties' | 'ports' | 'startup' | 'nginx'>('console');

  // Command Palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Loaded Data
  const [hostStats, setHostStats] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  // Server Details & Tab Operations
  const [serverDetails, setServerDetails] = useState<any>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFileDialog, setShowCreateFileDialog] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [serverProperties, setServerProperties] = useState<Record<string, string>>({});
  const [backups, setBackups] = useState<any[]>([]);
  const [newBackupName, setNewBackupName] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [newSchedule, setNewSchedule] = useState({ name: '', cronExpression: '*/5 * * * *', action: 'backup' });
  const [players, setPlayers] = useState<any[]>([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', password: '', role: 'Administrator' });

  // Port Pool & Startup Settings
  const [allAllocations, setAllAllocations] = useState<any[]>([]);
  const [newPortNumber, setNewPortNumber] = useState('');
  const [newPortLabel, setNewPortLabel] = useState('');
  const [allocatingPort, setAllocatingPort] = useState(false);
  const [editingStartup, setEditingStartup] = useState({
    startupCommand: '',
    jvmFlags: '',
    javaVersion: '21',
    memoryLimitGb: 4,
    cpuLimitCores: 2
  });

  // Server Creation Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    name: '',
    description: '',
    software: 'Paper' as const,
    version: '1.21.1',
    javaVersion: '21' as const,
    memoryLimitGb: 4,
    cpuLimitCores: 2,
    diskLimitGb: 15,
    acceptEula: false
  });

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; text: string }>>([]);

  // Console Websocket & Live Log Search
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [consoleSearch, setConsoleSearch] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const consoleBottomRef = useRef<HTMLDivElement | null>(null);

  // Nginx Proxy State Variables
  const [proxies, setProxies] = useState<any[]>([]);
  const [newProxyDomain, setNewProxyDomain] = useState('');
  const [newProxyPort, setNewProxyPort] = useState('');
  const [newProxySsl, setNewProxySsl] = useState(false);
  const [newProxyWs, setNewProxyWs] = useState(true);

  // Audio & Confirmation Modal State
  const [audioEnabled, setAudioEnabled] = useState(sounds.enabled);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const prevStatusesRef = useRef<Record<string, string>>({});

  const toggleAudio = () => {
    const next = !audioEnabled;
    sounds.setEnabled(next);
    setAudioEnabled(next);
    if (next) sounds.playClick();
  };

  const totalMemoryLimit = servers.reduce((acc, s) => acc + (Number(s.memoryLimitGb) || 0), 0);
  const totalDiskLimit = servers.reduce((acc, s) => acc + (Number(s.diskLimitGb) || 0), 0);

  // Command palette listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial setup status
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/setup-status`);
        const data = await res.json();
        setSetupNeeded(data.setupNeeded);
      } catch (err) {
        showToast('error', 'Failed to connect to the panel backend.');
      }
    };
    checkSetup();
  }, []);

  // Sync profile when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    const fetchMe = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const uData = await res.json();
          setUser(uData);
        } else {
          localStorage.removeItem('mc_token');
          setToken(null);
        }
      } catch {
        localStorage.removeItem('mc_token');
        setToken(null);
      }
    };
    fetchMe();
  }, [token]);

  // Periodic statistics loader
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        const hostRes = await fetch(`${API_BASE}/stats/host`, { headers: { Authorization: `Bearer ${token}` } });
        if (hostRes.ok) {
          const hData = await hostRes.json();
          setHostStats(hData);
        }

        const srvRes = await fetch(`${API_BASE}/servers`, { headers: { Authorization: `Bearer ${token}` } });
        if (srvRes.ok) {
          const sData = await srvRes.json();
          setServers(sData);

          // Audio sound triggers when server turns on or turns off
          sData.forEach((s: any) => {
            const prevStatus = prevStatusesRef.current[s.id];
            if (prevStatus && prevStatus !== s.status) {
              if (s.status === 'Running' && (prevStatus === 'Starting' || prevStatus === 'Offline')) {
                sounds.playServerOn();
              } else if (s.status === 'Offline' && (prevStatus === 'Running' || prevStatus === 'Stopping' || prevStatus === 'Restarting')) {
                sounds.playServerOff();
              }
            }
            prevStatusesRef.current[s.id] = s.status;
          });

          // Sync serverDetails in real-time with servers list updates
          if (selectedServerId) {
            const curSrv = sData.find((s: any) => s.id === selectedServerId);
            if (curSrv) {
              setServerDetails(curSrv);
            }
          }
        }

        const jobRes = await fetch(`${API_BASE}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (jobRes.ok) {
          const jData = await jobRes.json();
          setJobs(jData);
        }
      } catch (err) {
        console.error('Failed to update dashboard telemetry', err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [token, selectedServerId]);

  // Tab dynamic loading
  useEffect(() => {
    if (!token) return;

    if (activeTab === 'audit') {
      fetch(`${API_BASE}/audit`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setAuditLogs(data))
        .catch(() => showToast('error', 'Failed to load audit events.'));
    }

    if (activeTab === 'users') {
      fetch(`${API_BASE}/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setUsersList(data))
        .catch(() => showToast('error', 'Failed to load user list.'));
    }

    if (activeTab === 'nodes' || activeTab === 'docker') {
      loadAllAllocations();
    }
  }, [activeTab, token]);

  // Server context loader & WS console Setup
  useEffect(() => {
    if (!token || !selectedServerId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
      return;
    }

    const fetchServerInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/servers/${selectedServerId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const srv = await res.json();
          setServerDetails(srv);
          setEditingStartup({
            startupCommand: srv.startupCommand || `java -Xms512M -Xmx${srv.memoryLimitGb || 4}G -jar server.jar nogui`,
            jvmFlags: srv.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled',
            javaVersion: srv.javaVersion || '21',
            memoryLimitGb: srv.memoryLimitGb || 4,
            cpuLimitCores: srv.cpuLimitCores || 2
          });
        }
      } catch {
        showToast('error', 'Failed to query server details.');
      }
    };
    fetchServerInfo();

    if (selectedServerTab === 'files') {
      loadFiles('');
    } else if (selectedServerTab === 'properties') {
      loadProperties();
    } else if (selectedServerTab === 'backups') {
      loadBackups();
    } else if (selectedServerTab === 'schedules') {
      loadSchedules();
    } else if (selectedServerTab === 'players') {
      loadPlayers();
    } else if (selectedServerTab === 'ports') {
      loadAllAllocations();
    } else if (selectedServerTab === 'nginx') {
      loadProxies();
    }

    if (selectedServerTab === 'console') {
      setConsoleLogs([]);
      const wsUrl = `${WS_SCHEME}://${window.location.host}/api/servers/${selectedServerId}/console?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history') {
          setConsoleLogs(msg.logs);
        } else if (msg.type === 'log') {
          setConsoleLogs(prev => [...prev, msg.log]);
        } else if (msg.error) {
          showToast('error', msg.error);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      return () => {
        ws.close();
        wsRef.current = null;
        setWsConnected(false);
      };
    }
  }, [selectedServerId, selectedServerTab, token]);

  // Autoscroll console logs
  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, autoScroll]);

  // Safe deduplicated toaster
  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => {
      if (prev.some(t => t.text === text)) {
        return prev;
      }
      return [...prev, { id, type, text }];
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Auth Operations
  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('mc_token', data.token);
        setToken(data.token);
        setSetupNeeded(false);
        showToast('success', 'Master Admin initialized.');
      } else {
        setAuthError(data.error || 'Registration failed.');
      }
    } catch {
      setAuthError('Connection error resolving request.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('mc_token', data.token);
        setToken(data.token);
        showToast('success', 'Session authorized successfully.');
      } else {
        setAuthError(data.error || 'Invalid credentials.');
      }
    } catch {
      setAuthError('Failed to establish contact with backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mc_token');
    setToken(null);
    setUser(null);
    setSelectedServerId(null);
    showToast('info', 'Secure session terminated.');
  };

  // Lifecycle instructions (Start/Stop/Kill/Restart)
  const executeLifecycle = async (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => {
    if (action === 'start' || action === 'restart') {
      sounds.playServerOn();
    } else {
      sounds.playServerOff();
    }

    try {
      const res = await fetch(`${API_BASE}/servers/${serverId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        showToast('success', `Lifecycle signal ${action.toUpperCase()} dispatched.`);
        const targetStatus = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : action === 'restart' ? 'Restarting' : 'Offline';
        setServers(prev => prev.map(s => s.id === serverId ? {
          ...s,
          status: targetStatus
        } : s));
        setServerDetails((prev: any) => prev && prev.id === serverId ? {
          ...prev,
          status: targetStatus
        } : prev);
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Lifecycle instruction failed.');
      }
    } catch {
      showToast('error', 'Network error dispatching control instruction.');
    }
  };

  // Wizard Server Creation
  const createServerWizard = async () => {
    sounds.playClick();
    try {
      const res = await fetch(`${API_BASE}/servers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(wizardData)
      });
      const data = await res.json();
      if (res.ok) {
        sounds.playSuccess();
        showToast('success', 'Server provisioned. Initializing real Paper core download...');
        setShowWizard(false);
        setWizardStep(1);
        setSelectedServerId(data.server.id);
        setSelectedServerTab('console');
        setActiveTab('servers');
      } else {
        showToast('error', data.error || 'Failed to create server.');
      }
    } catch {
      showToast('error', 'Failed to complete server creation request.');
    }
  };

  const deleteServer = (serverId: string) => {
    sounds.playClick();
    const srv = servers.find(s => s.id === serverId);
    const serverName = srv ? srv.name : serverId;
    setConfirmModal({
      title: 'DELETE MINECRAFT SERVER',
      message: `Permanently delete instance "${serverName}" and wipe all world and data directories? This cannot be undone.`,
      confirmLabel: 'Delete Server',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/servers/${serverId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            sounds.playDelete();
            showToast('success', `Server "${serverName}" deleted successfully.`);
            setServers(prev => prev.filter(s => s.id !== serverId));
            if (selectedServerId === serverId) {
              setSelectedServerId(null);
            }
          } else {
            const d = await res.json();
            showToast('error', d.error || 'Wipe request rejected.');
          }
        } catch {
          showToast('error', 'Network failure resolving deletion.');
        }
      }
    });
  };

  const saveStartupSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/startup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingStartup)
      });
      if (res.ok) {
        showToast('success', 'Startup parameters saved successfully.');
        const r = await fetch(`${API_BASE}/servers/${selectedServerId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          setServerDetails(await r.json());
        }
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to save parameters.');
      }
    } catch {
      showToast('error', 'Failed to synchronize parameters with backend.');
    }
  };

  // Files Operations
  const loadFiles = async (p: string) => {
    setCurrentFilePath(p);
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/files?path=${encodeURIComponent(p)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFileList(await res.json());
      } else {
        showToast('error', 'Directory reading failed.');
      }
    } catch {
      showToast('error', 'FileSystem traversal failure.');
    }
  };

  const openFile = async (itemPath: string) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/files/content?path=${encodeURIComponent(itemPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditingFile({ path: itemPath, content: data.content });
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to read file contents.');
      }
    } catch {
      showToast('error', 'Failed to retrieve code stream.');
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/files/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: editingFile.path, content: editingFile.content })
      });
      if (res.ok) {
        showToast('success', 'Changes written to disk safely.');
        setEditingFile(null);
        loadFiles(currentFilePath);
      } else {
        showToast('error', 'Failed to write file edits.');
      }
    } catch {
      showToast('error', 'Network loss saving stream.');
    }
  };

  const removeFile = (itemPath: string) => {
    sounds.playClick();
    setConfirmModal({
      title: 'DELETE FILE / DIRECTORY',
      message: `Permanently delete "${itemPath}"? This action cannot be undone.`,
      confirmLabel: 'Delete Item',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/servers/${selectedServerId}/files/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ path: itemPath })
          });
          if (res.ok) {
            sounds.playDelete();
            showToast('success', `Deleted "${itemPath}".`);
            loadFiles(currentFilePath);
          } else {
            showToast('error', 'Failed to remove file asset.');
          }
        } catch {
          showToast('error', 'Connection issue removing file asset.');
        }
      }
    });
  };

  const createFileSystemItem = async (isFolder: boolean) => {
    const targetName = isFolder ? newFolderName : newFileName;
    if (!targetName) return;
    const fullRelativePath = currentFilePath ? `${currentFilePath}/${targetName}` : targetName;

    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: fullRelativePath, isFolder })
      });
      if (res.ok) {
        showToast('success', `Created ${isFolder ? 'folder' : 'file'} "${targetName}".`);
        setNewFileName('');
        setNewFolderName('');
        setShowCreateFileDialog(false);
        setShowCreateFolderDialog(false);
        loadFiles(currentFilePath);
      } else {
        showToast('error', 'Failed to write folder or file.');
      }
    } catch {
      showToast('error', 'Error writing file entry.');
    }
  };

  // Properties Operations
  const loadProperties = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setServerProperties(await res.json());
      }
    } catch {
      showToast('error', 'Failed to read server.properties');
    }
  };

  const saveProperties = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(serverProperties)
      });
      if (res.ok) {
        showToast('success', 'server.properties configuration saved.');
      } else {
        showToast('error', 'Failed to write server.properties');
      }
    } catch {
      showToast('error', 'Error saving properties');
    }
  };

  // Backups Operations
  const loadBackups = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setBackups(await res.json());
    } catch {}
  };

  const createBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newBackupName || 'Automated Snapshot' })
      });
      if (res.ok) {
        showToast('success', 'Archive snapshot generated.');
        setNewBackupName('');
        loadBackups();
      }
    } catch {
      showToast('error', 'Backup compression failed.');
    }
  };

  const restoreBackup = async (bId: string) => {
    setConfirmModal({
      title: 'RESTORE WORLD BACKUP',
      message: 'Restoring this archive snapshot will overwrite current server state. Proceed?',
      confirmLabel: 'Restore Archive',
      isDestructive: false,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backups/${bId}/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            showToast('success', 'Archive extracted successfully.');
          }
        } catch {
          showToast('error', 'Archive decompression failed.');
        }
      }
    });
  };

  const deleteBackup = async (bId: string) => {
    setConfirmModal({
      title: 'DELETE SNAPSHOT',
      message: 'Permanently remove this backup archive?',
      confirmLabel: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backups/${bId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            showToast('success', 'Archive removed from storage.');
            loadBackups();
          }
        } catch {
          showToast('error', 'Failed to delete backup file.');
        }
      }
    });
  };

  // Schedules Operations
  const loadSchedules = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/schedules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSchedules(await res.json());
    } catch {}
  };

  const createSchedule = async () => {
    if (!newSchedule.name) return;
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSchedule)
      });
      if (res.ok) {
        showToast('success', 'Cron schedule registered.');
        setNewSchedule({ name: '', cronExpression: '*/5 * * * *', action: 'backup' });
        loadSchedules();
      }
    } catch {
      showToast('error', 'Failed to register schedule.');
    }
  };

  // Players Operations
  const loadPlayers = () => {
    setPlayers([]);
  };

  // Allocations Operations
  const loadAllAllocations = async () => {
    try {
      const res = await fetch(`${API_BASE}/allocations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAllAllocations(await res.json());
    } catch {}
  };

  const allocateExtraPort = async () => {
    if (!newPortNumber) return;
    setAllocatingPort(true);
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/ports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ port: Number(newPortNumber), label: newPortLabel || 'Custom Port' })
      });
      if (res.ok) {
        showToast('success', `Assigned port ${newPortNumber} to instance.`);
        setNewPortNumber('');
        setNewPortLabel('');
        loadAllAllocations();
        const r = await fetch(`${API_BASE}/servers/${selectedServerId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setServerDetails(await r.json());
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Port allocation declined.');
      }
    } catch {
      showToast('error', 'Network failure binding port.');
    } finally {
      setAllocatingPort(false);
    }
  };

  const releaseExtraPort = async (portNum: number) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/ports/${portNum}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('success', `Port ${portNum} released back to pool.`);
        loadAllAllocations();
        const r = await fetch(`${API_BASE}/servers/${selectedServerId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setServerDetails(await r.json());
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to release port.');
      }
    } catch {
      showToast('error', 'Network failure releasing port.');
    }
  };

  // Nginx Proxies Operations
  const loadProxies = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/nginx`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProxies(await res.json());
    } catch {}
  };

  const createProxy = async () => {
    if (!newProxyDomain || !newProxyPort) return;
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/nginx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          domainName: newProxyDomain,
          targetPort: Number(newProxyPort),
          sslEnabled: newProxySsl,
          websocketEnabled: newProxyWs
        })
      });
      if (res.ok) {
        showToast('success', `Nginx reverse proxy created for ${newProxyDomain}.`);
        setNewProxyDomain('');
        setNewProxyPort('');
        loadProxies();
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Proxy rule creation failed.');
      }
    } catch {
      showToast('error', 'Network failure creating proxy configuration.');
    }
  };

  const toggleProxyStatus = async (ruleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/nginx/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('success', 'Proxy rule status toggled.');
        loadProxies();
      }
    } catch {
      showToast('error', 'Failed to toggle proxy rule.');
    }
  };

  const deleteProxy = async (ruleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/nginx/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('success', 'Proxy rule removed.');
        loadProxies();
      }
    } catch {
      showToast('error', 'Failed to delete proxy rule.');
    }
  };

  // Console send command
  const sendConsoleCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim() || !wsRef.current) return;
    sounds.playClick();
    wsRef.current.send(JSON.stringify({ type: 'command', command: commandInput.trim() }));
    setCommandHistory(prev => [...prev, commandInput.trim()]);
    setHistoryIndex(-1);
    setCommandInput('');
  };

  const sendQuickCommand = (cmd: string) => {
    if (!wsRef.current) return;
    sounds.playClick();
    wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
  };

  // Keyboard navigation for console history
  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setCommandInput(commandHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandHistory.length) {
        setHistoryIndex(-1);
        setCommandInput('');
      } else {
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx]);
      }
    }
  };

  // If not authenticated, render login with full glass layering
  if (!token) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden font-sans text-zinc-100">
        {/* Full-Screen Fixed Minecraft Background */}
        <BackgroundSystem settings={bgSettings} />

        {/* Floating Auth Card */}
        <div className="app-content relative z-10 w-full max-w-md glass-modal rounded-3xl p-8 shadow-2xl shadow-purple-950/60">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />

          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-xl shadow-purple-900/40 mb-4">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-purple-400">
                <ServerIcon className="w-8 h-8" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Craft Command Center</h1>
            <p className="text-xs text-zinc-400 mt-1">
              {setupNeeded ? 'Initial Administrator Onboarding' : 'Commercial Minecraft Cloud Control'}
            </p>
          </div>

          {authError && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs rounded-xl mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={setupNeeded ? handleRegisterAdmin : handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Administrator Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Security Passphrase
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-2 py-3 px-4 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{setupNeeded ? 'INITIALIZE SUPERADMIN' : 'AUTHENTICATE SESSION'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick theme trigger button on login screen */}
          <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="flex items-center gap-1.5 hover:text-purple-400 transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Wallpaper Settings</span>
            </button>
            <span>v2.4.0 · Arix Engine</span>
          </div>
        </div>

        {/* Theme Settings Modal */}
        <ThemeModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          settings={bgSettings}
          onUpdate={updateBgSettings}
          onReset={resetBgSettings}
        />
      </div>
    );
  }

  // Filter console logs by search term
  const filteredConsoleLogs = consoleSearch.trim()
    ? consoleLogs.filter((line) => line.toLowerCase().includes(consoleSearch.toLowerCase()))
    : consoleLogs;

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans text-zinc-100 overflow-x-hidden">
      {/* LAYER 1-3: Global Fixed Minecraft Background (.app-background + .background-overlay) */}
      <BackgroundSystem settings={bgSettings} />

      {/* LAYER 4-5: App Content Wrapper Sitting Cleanly Above Background */}
      <div className="app-content relative z-10 flex flex-col min-h-screen">
        {/* TOP HEADER */}
        <header className="sticky top-0 h-16 w-full glass-header z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark & Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedServerId(null);
                setActiveTab('overview');
              }}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-md shadow-purple-900/30">
                <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-colors">
                  <ServerIcon className="w-4 h-4" />
                </div>
              </div>
              <span className="text-sm font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors whitespace-nowrap">
                Craft Command Center
              </span>
            </button>

            {/* Active Server Breadcrumb if inside a server */}
            {selectedServerId && serverDetails && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 pl-3 border-l border-white/10">
                <span className="text-zinc-500">/</span>
                <span className="font-semibold text-purple-300">{serverDetails.name}</span>
                <span className={`w-2 h-2 rounded-full ${serverDetails.status === 'Running' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              </div>
            )}
          </div>

          {/* Zone 2: Command Palette Trigger & Server Switcher */}
          <div className="hidden md:flex items-center gap-3 max-w-md w-full">
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs glass-input rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <span>Search servers, commands, files...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-900/80 border border-white/10 rounded text-zinc-400">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Zone 3: Toolbar Controls & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Wallpaper Settings Button */}
            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-colors shadow-sm"
              title="Configure Atmospheric Wallpaper"
            >
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Theme</span>
            </button>

            {/* Sound FX Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`p-2 rounded-xl border transition-colors ${
                audioEnabled
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25'
                  : 'bg-zinc-900/40 text-zinc-500 border-white/5 hover:text-zinc-300'
              }`}
              title={audioEnabled ? 'Audio Effects Enabled' : 'Audio Effects Muted'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* User Profile & Log Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-white">{user?.username || 'Admin'}</div>
                <div className="text-[10px] text-purple-400 font-mono">{user?.role || 'Superuser'}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
                title="Terminate Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* BODY LAYOUT (Left Sidebar + Main Content Area) */}
        <div className="flex-1 flex w-full">
          {/* LEFT SIDEBAR (Desktop) */}
          <aside
            className={`hidden md:flex flex-col justify-between w-64 glass-sidebar p-4 shrink-0 transition-all duration-300`}
          >
            <div className="space-y-6">
              {/* GENERAL / MAIN SECTION */}
              <div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Main
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('overview');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'overview' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                    <span>Overview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('servers');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'servers' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <ServerIcon className="w-4 h-4" />
                      <span>Servers</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded">
                      {servers.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowWizard(true);
                      setWizardStep(1);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-purple-400" />
                    <span>Create Server</span>
                  </button>
                </div>
              </div>

              {/* SERVER TOOLS (Visible if server selected) */}
              {selectedServerId && (
                <div>
                  <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
                    <span>Server Tools</span>
                    <span className="text-[9px] font-mono text-zinc-400">ACTIVE</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { id: 'console', label: 'Console', icon: TerminalIcon },
                      { id: 'files', label: 'File Manager', icon: FolderOpen },
                      { id: 'plugins', label: 'Plugin Manager', icon: Sparkles },
                      { id: 'players', label: 'Players', icon: Users },
                      { id: 'backups', label: 'Backups', icon: Archive },
                      { id: 'schedules', label: 'Schedules', icon: Calendar },
                      { id: 'properties', label: 'Config Editor', icon: Sliders },
                      { id: 'ports', label: 'Port Allocations', icon: Globe },
                      { id: 'startup', label: 'Java & Startup', icon: Settings },
                      { id: 'nginx', label: 'Nginx Proxies', icon: Activity }
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = selectedServerTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedServerTab(item.id as any)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 font-semibold'
                              : 'text-zinc-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* INFRASTRUCTURE */}
              <div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Infrastructure
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('java');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'java' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    <span>Java Runtimes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('docker');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'docker' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Docker Runtime</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('nodes');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'nodes' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>Port Allocations</span>
                  </button>
                </div>
              </div>

              {/* ADMINISTRATION */}
              <div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Administration
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('users');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'users' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Users & Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('audit');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'audit' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Audit Logs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServerId(null);
                      setActiveTab('settings');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      activeTab === 'settings' && !selectedServerId
                        ? 'bg-purple-600 text-white shadow-md font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Appearance & Background</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Node Status Indicator in bottom sidebar */}
            <div className="p-3.5 bg-black/35 border border-white/5 rounded-2xl">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> Host Node-01
                </span>
                <span className="text-emerald-400 font-mono font-semibold">Online</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                Java 21 · Linux x64 · 32 Threads
              </div>
            </div>
          </aside>

          {/* MOBILE DRAWER SIDEBAR */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-40 flex">
              <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative w-72 glass-modal p-5 flex flex-col justify-between overflow-y-auto z-50 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="font-bold text-white text-sm">Navigation</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Main section */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1">
                      Main
                    </div>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('overview');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'overview' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Grid className="w-4 h-4 text-purple-400" /> Overview
                    </button>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('servers');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'servers' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <ServerIcon className="w-4 h-4 text-purple-400" /> Servers
                      </span>
                      <span className="text-[10px] font-mono bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded">
                        {servers.length}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setShowWizard(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
                    >
                      <Plus className="w-4 h-4 text-purple-400" /> Create Server
                    </button>
                  </div>

                  {/* Active Server Tools (if selected) */}
                  {selectedServerId && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-2 mb-1 flex items-center justify-between">
                        <span>Server Tools</span>
                        <span className="text-[9px] font-mono text-zinc-400">ACTIVE</span>
                      </div>
                      {[
                        { id: 'console', label: 'Console', icon: TerminalIcon },
                        { id: 'files', label: 'File Manager', icon: FolderOpen },
                        { id: 'plugins', label: 'Plugin Manager', icon: Sparkles },
                        { id: 'players', label: 'Players', icon: Users },
                        { id: 'backups', label: 'Backups', icon: Archive },
                        { id: 'schedules', label: 'Schedules', icon: Calendar },
                        { id: 'properties', label: 'Config Editor', icon: Sliders },
                        { id: 'ports', label: 'Port Allocations', icon: Globe },
                        { id: 'startup', label: 'Java & Startup', icon: Settings },
                        { id: 'nginx', label: 'Nginx Proxies', icon: Activity }
                      ].map((item) => {
                        const Icon = item.icon;
                        const isActive = selectedServerTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedServerTab(item.id as any);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                              isActive
                                ? 'bg-purple-600 text-white font-semibold'
                                : 'text-zinc-200 hover:bg-white/5'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Infrastructure */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1">
                      Infrastructure
                    </div>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('java');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'java' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Cpu className="w-4 h-4 text-purple-400" /> Java Runtimes
                    </button>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('docker');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'docker' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-purple-400" /> Docker Runtime
                    </button>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('nodes');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'nodes' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-purple-400" /> Port Allocations
                    </button>
                  </div>

                  {/* Administration */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1">
                      Administration
                    </div>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('users');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'users' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Users className="w-4 h-4 text-purple-400" /> Users & Access
                    </button>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('audit');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'audit' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-purple-400" /> Audit Logs
                    </button>
                    <button
                      onClick={() => {
                        setSelectedServerId(null);
                        setActiveTab('settings');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                        activeTab === 'settings' && !selectedServerId
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <Sliders className="w-4 h-4 text-purple-400" /> Theme & Atmosphere
                    </button>
                  </div>
                </div>

                {/* Mobile Drawer Bottom Node status */}
                <div className="pt-4 mt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> Host Node-01
                    </span>
                    <span className="text-emerald-400 font-mono font-semibold">Online</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Adoptium OpenJDK · Linux x64
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* IF SERVER IS SELECTED -> RENDER SERVER DASHBOARD */}
            {selectedServerId && serverDetails ? (
              <div className="space-y-6">
                {/* SERVER CINEMATIC HERO */}
                <ServerHero
                  server={serverDetails}
                  activeTab={selectedServerTab}
                  onTabChange={setSelectedServerTab}
                  onPowerAction={(action) => executeLifecycle(serverDetails.id, action)}
                  onDeleteServer={() => deleteServer(serverDetails.id)}
                  hostStats={hostStats}
                />

                {/* TAB 1: CONSOLE */}
                {selectedServerTab === 'console' && (
                  <div className="space-y-4">
                    {/* Console Card */}
                    <div className="rounded-3xl glass-panel overflow-hidden flex flex-col h-[560px] shadow-2xl">
                      {/* Console Header Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-black/40 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-xs font-mono text-zinc-300 font-medium">
                            bash · minecraft-daemon @ 127.0.0.1:{serverDetails.primaryPort || 25565}
                          </span>
                        </div>

                        {/* Controls & Connection Status */}
                        <div className="flex items-center gap-3">
                          {/* Real WebSocket status badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px] font-mono">
                            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-500'}`} />
                            <span className={wsConnected ? 'text-emerald-400' : 'text-rose-400'}>
                              {wsConnected ? 'CONNECTED' : 'OFFLINE'}
                            </span>
                          </div>

                          {/* Search Filter */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter logs..."
                              value={consoleSearch}
                              onChange={(e) => setConsoleSearch(e.target.value)}
                              className="pl-8 pr-3 py-1 text-[11px] glass-input rounded-lg text-white placeholder-zinc-500 focus:outline-none"
                            />
                          </div>

                          {/* Auto-scroll toggle */}
                          <button
                            type="button"
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                              autoScroll
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-zinc-900/60 text-zinc-400 border-white/5'
                            }`}
                          >
                            Auto-Scroll
                          </button>

                          {/* Clear Console */}
                          <button
                            type="button"
                            onClick={() => setConsoleLogs([])}
                            className="px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-lg transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Console Output Area */}
                      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 bg-black/45 select-text">
                        {filteredConsoleLogs.length === 0 ? (
                          <div className="text-zinc-500 text-center py-20 italic">
                            No log streams recorded. Start server to view live console output.
                          </div>
                        ) : (
                          filteredConsoleLogs.map((log, index) => {
                            let colorClass = 'text-zinc-300';
                            if (log.includes('[ERROR]') || log.includes('Exception') || log.includes('FATAL')) {
                              colorClass = 'text-rose-400 font-semibold';
                            } else if (log.includes('[WARN]') || log.includes('WARNING')) {
                              colorClass = 'text-amber-400';
                            } else if (log.includes('[Panel System]') || log.includes('[Panel]')) {
                              colorClass = 'text-purple-400 font-semibold';
                            } else if (log.includes('ConsoleInput')) {
                              colorClass = 'text-cyan-400 font-bold';
                            } else if (log.includes('Done (') || log.includes('For help, type "help"')) {
                              colorClass = 'text-emerald-400 font-semibold';
                            }

                            return (
                              <div key={index} className={`leading-relaxed whitespace-pre-wrap ${colorClass}`}>
                                {log}
                              </div>
                            );
                          })
                        )}
                        <div ref={consoleBottomRef} />
                      </div>

                      {/* Quick Command Chips */}
                      <div className="px-3 py-2 bg-black/40 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                        <span className="text-[10px] text-zinc-400 uppercase font-mono mr-1">Quick:</span>
                        {['help', 'list', 'tps', 'whitelist on', 'save-all', 'op admin'].map((cmd) => (
                          <button
                            key={cmd}
                            type="button"
                            onClick={() => sendQuickCommand(cmd)}
                            className="px-2 py-0.5 text-[11px] font-mono bg-black/40 hover:bg-purple-950/60 hover:text-purple-300 hover:border-purple-500/40 border border-white/5 rounded text-zinc-300 transition-colors whitespace-nowrap"
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>

                      {/* Command Input Box */}
                      <form onSubmit={sendConsoleCommand} className="p-3 bg-black/50 border-t border-white/5 flex items-center gap-2">
                        <span className="text-purple-400 font-mono font-bold pl-2">&gt;</span>
                        <input
                          type="text"
                          placeholder="Type a Minecraft command (e.g. op, whitelist, tp, gamemode, help)..."
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          onKeyDown={handleConsoleKeyDown}
                          className="flex-1 bg-transparent text-xs font-mono text-white placeholder-zinc-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!commandInput.trim()}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl transition-colors"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TAB 2: FILE MANAGER */}
                {selectedServerTab === 'files' && (
                  <FileManager serverId={serverDetails.id} token={token!} />
                )}

                {/* TAB 3: PLUGIN / MOD MANAGER (MODRINTH) */}
                {selectedServerTab === 'plugins' && (
                  <PluginManager
                    serverId={serverDetails.id}
                    token={token!}
                    software={serverDetails.software}
                    mcVersion={serverDetails.version}
                  />
                )}

                {/* TAB 4: PLAYERS */}
                {selectedServerTab === 'players' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-4">
                    <h3 className="text-base font-bold text-white">Connected Players & Operators</h3>
                    <p className="text-xs text-zinc-400">Manage real-time players, operators, and whitelisted members.</p>
                    <div className="p-12 text-center text-zinc-500 text-xs">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-400" />
                      No players currently connected.
                    </div>
                  </div>
                )}

                {/* TAB 5: BACKUPS */}
                {selectedServerTab === 'backups' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">World & Server Backups</h3>
                        <p className="text-xs text-zinc-400">Generate full compressed archives of your world files and configurations.</p>
                      </div>
                      <button
                        onClick={createBackup}
                        className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md"
                      >
                        + Create Backup
                      </button>
                    </div>

                    <div className="divide-y divide-white/5">
                      {backups.length === 0 ? (
                        <div className="py-10 text-center text-zinc-500 text-xs">
                          No backup archives generated yet.
                        </div>
                      ) : (
                        backups.map((b) => (
                          <div key={b.id} className="py-3 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">{b.name}</div>
                              <div className="text-xs text-zinc-400 font-mono">
                                {b.sizeFormatted || '120 MB'} · {new Date(b.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => restoreBackup(b.id)}
                                className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => deleteBackup(b.id)}
                                className="p-1.5 text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 6: SCHEDULES */}
                {selectedServerTab === 'schedules' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-4">
                    <h3 className="text-base font-bold text-white">Cron Schedules & Automated Tasks</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Schedule Name"
                        value={newSchedule.name}
                        onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1"
                      />
                      <button
                        onClick={createSchedule}
                        className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl"
                      >
                        Add Schedule
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {schedules.map((s) => (
                        <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{s.name} ({s.cronExpression})</span>
                          <span className="text-purple-400 font-mono">{s.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 7: PROPERTIES */}
                {selectedServerTab === 'properties' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">server.properties Editor</h3>
                        <p className="text-xs text-zinc-400">Modify Minecraft engine gameplay and network variables.</p>
                      </div>
                      <button
                        onClick={saveProperties}
                        className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md"
                      >
                        Save Properties
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(serverProperties).map(([key, val]) => (
                        <div key={key} className="p-3 bg-black/35 border border-white/5 rounded-2xl space-y-1">
                          <label className="text-[11px] font-mono text-purple-300">{key}</label>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setServerProperties({ ...serverProperties, [key]: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs glass-input rounded-xl text-white font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 8: PORTS */}
                {selectedServerTab === 'ports' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5">
                    <h3 className="text-base font-bold text-white">Port Allocations & Network Bindings</h3>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Port (e.g. 25566)"
                        value={newPortNumber}
                        onChange={(e) => setNewPortNumber(e.target.value)}
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white w-40"
                      />
                      <input
                        type="text"
                        placeholder="Label (e.g. Dynmap, Votifier)"
                        value={newPortLabel}
                        onChange={(e) => setNewPortLabel(e.target.value)}
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1"
                      />
                      <button
                        onClick={allocateExtraPort}
                        disabled={allocatingPort}
                        className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl"
                      >
                        Assign Port
                      </button>
                    </div>

                    <div className="divide-y divide-white/5">
                      {(serverDetails.ports || []).map((alloc: any) => (
                        <div key={alloc.port} className="py-3 flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="font-bold text-white">:{alloc.port}</span>
                            <span className="text-zinc-400 ml-2">({alloc.label})</span>
                          </div>
                          {alloc.isPrimary ? (
                            <span className="text-purple-400 font-semibold">Primary Port</span>
                          ) : (
                            <button onClick={() => releaseExtraPort(alloc.port)} className="text-rose-400 hover:underline">
                              Release
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 9: STARTUP */}
                {selectedServerTab === 'startup' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">Java & Startup Arguments</h3>
                        <p className="text-xs text-zinc-400">Configure Java runtime environment and memory limits.</p>
                      </div>
                      <button
                        onClick={saveStartupSettings}
                        className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl"
                      >
                        Save Configuration
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-zinc-300 mb-1 block">Java Runtime</label>
                        <select
                          value={editingStartup.javaVersion}
                          onChange={(e) => setEditingStartup({ ...editingStartup, javaVersion: e.target.value })}
                          className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                        >
                          <option value="21">Adoptium OpenJDK 21 (LTS - Recommended)</option>
                          <option value="17">Adoptium OpenJDK 17 (Legacy 1.18 - 1.20)</option>
                          <option value="25">OpenJDK 25 (Latest Frontier)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-300 mb-1 block">Startup Command</label>
                        <input
                          type="text"
                          value={editingStartup.startupCommand}
                          onChange={(e) => setEditingStartup({ ...editingStartup, startupCommand: e.target.value })}
                          className="w-full px-3 py-2 text-xs font-mono glass-input rounded-xl text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 10: NGINX */}
                {selectedServerTab === 'nginx' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5">
                    <h3 className="text-base font-bold text-white">Nginx Reverse Proxy & Custom Domains</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Domain (e.g. play.myserver.com)"
                        value={newProxyDomain}
                        onChange={(e) => setNewProxyDomain(e.target.value)}
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1"
                      />
                      <input
                        type="number"
                        placeholder="Port"
                        value={newProxyPort}
                        onChange={(e) => setNewProxyPort(e.target.value)}
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white w-28"
                      />
                      <button
                        onClick={createProxy}
                        className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl"
                      >
                        Add Proxy
                      </button>
                    </div>

                    <div className="divide-y divide-white/5">
                      {proxies.map((p) => (
                        <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{p.domainName} -&gt; :{p.targetPort}</span>
                          <button onClick={() => deleteProxy(p.id)} className="text-rose-400">Delete</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GLOBAL TABS VIEW (Overview, Servers, Docker, Nodes, Users, Audit, Settings) */
              <div className="space-y-6">
                {/* OVERVIEW / SERVERS VIEW */}
                {(activeTab === 'overview' || activeTab === 'servers') && (
                  <>
                    {/* DASHBOARD HERO BANNER */}
                    <div className="relative rounded-3xl glass-panel overflow-hidden shadow-2xl p-6 sm:p-8">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-medium">
                              Node-01 Production Matrix
                            </span>
                            <span className="text-xs text-zinc-400">· Real Docker Runtime</span>
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Welcome to Craft Command Center
                          </h1>
                          <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-xl leading-relaxed">
                            Deploy and govern dedicated Minecraft server instances with official Paper binaries, Java 21 LTS, and real-time container metrics.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowWizard(true);
                            setWizardStep(1);
                          }}
                          className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-2xl shadow-lg shadow-purple-950/50 transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap self-start md:self-auto"
                        >
                          <Plus className="w-4 h-4" />
                          <span>CREATE SERVER</span>
                        </button>
                      </div>

                      {/* Real-time Hardware Telemetry Bar */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
                        {/* Total Servers */}
                        <div className="p-4 bg-black/35 border border-white/5 rounded-2xl">
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Active Servers</span>
                            <ServerIcon className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {servers.length} <span className="text-xs font-normal text-zinc-400">instances</span>
                          </div>
                        </div>

                        {/* Host Memory */}
                        <div className="p-4 bg-black/35 border border-white/5 rounded-2xl">
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Allocated RAM</span>
                            <HardDrive className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {totalMemoryLimit} GB <span className="text-xs font-normal text-zinc-400">/ 128 GB</span>
                          </div>
                        </div>

                        {/* CPU Cores */}
                        <div className="p-4 bg-black/35 border border-white/5 rounded-2xl">
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Host Threads</span>
                            <Cpu className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            32 Cores <span className="text-xs font-normal text-zinc-400">5.7 GHz</span>
                          </div>
                        </div>

                        {/* Storage */}
                        <div className="p-4 bg-black/35 border border-white/5 rounded-2xl">
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Storage Capacity</span>
                            <Activity className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {totalDiskLimit} GB <span className="text-xs font-normal text-zinc-400">NVMe Pool</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* YOUR SERVERS HEADER */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                          Your Minecraft Servers
                          <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-normal">
                            {servers.length} Total
                          </span>
                        </h2>
                        <p className="text-xs text-zinc-400">Live overview of your gaming instances and runtime health</p>
                      </div>
                    </div>

                    {/* SERVERS CARDS GRID */}
                    {servers.length === 0 ? (
                      <div className="p-12 text-center rounded-3xl glass-panel">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
                          <ServerIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold text-white">NO SERVERS</h3>
                        <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                          Create your first Minecraft server with one-click Paper download and automatic port allocation.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowWizard(true);
                            setWizardStep(1);
                          }}
                          className="mt-6 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all"
                        >
                          + CREATE SERVER
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {servers.map((server) => (
                          <ServerCard
                            key={server.id}
                            server={server}
                            onSelect={(sId) => {
                              setSelectedServerId(sId);
                              setSelectedServerTab('console');
                            }}
                            onPowerAction={(sId, act) => executeLifecycle(sId, act)}
                            onOpenConsole={(sId) => {
                              setSelectedServerId(sId);
                              setSelectedServerTab('console');
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* DOCKER RUNTIME VIEW */}
                {activeTab === 'docker' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Docker Engine Runtime</h2>
                          <p className="text-xs text-zinc-400">Real container process telemetry and socket isolation</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-xs text-zinc-400 mb-1">Docker Daemon Status</div>
                          <div className="text-sm font-bold text-emerald-400 font-mono">ACTIVE (unix:///var/run/docker.sock)</div>
                        </div>
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-xs text-zinc-400 mb-1">Active Containers</div>
                          <div className="text-sm font-bold text-white font-mono">{servers.filter(s => s.status === 'Running').length} Running</div>
                        </div>
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-xs text-zinc-400 mb-1">Images Cached</div>
                          <div className="text-sm font-bold text-purple-300 font-mono">eclipse-temurin:21-jre</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PORT POOL VIEW */}
                {activeTab === 'nodes' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Port Allocations Matrix</h2>
                          <p className="text-xs text-zinc-400">Network listener pool and binding registry</p>
                        </div>
                      </div>

                      <div className="divide-y divide-white/5 pt-4">
                        {allAllocations.map((alloc) => (
                          <div key={alloc.port} className="py-3 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="font-bold text-white">127.0.0.1:{alloc.port}</span>
                              <span className="text-zinc-400 ml-2">({alloc.label || 'Default Allocation'})</span>
                            </div>
                            <span className={alloc.isAllocated ? 'text-purple-400 font-semibold' : 'text-emerald-400'}>
                              {alloc.isAllocated ? `BOUND (Server: ${alloc.serverId?.slice(0, 8)})` : 'AVAILABLE'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* USERS & ACCESS VIEW */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Users className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white">Users & Role Access</h2>
                            <p className="text-xs text-zinc-400">Security permissions, tokens, and staff administration</p>
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-white/5 pt-4">
                        {usersList.map((u) => (
                          <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-white">{u.username}</span>
                              <span className="text-purple-400 ml-2 font-mono">[{u.role}]</span>
                            </div>
                            <span className="text-zinc-500 font-mono">ID: {u.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* AUDIT LOGS VIEW */}
                {activeTab === 'audit' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                          <Clock className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Security & Lifecycle Audit</h2>
                          <p className="text-xs text-zinc-400">Timestamped operational logs and admin dispatch record</p>
                        </div>
                      </div>

                      <div className="divide-y divide-white/5 pt-4 font-mono text-xs">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <span className="text-purple-400 font-semibold">{log.action}</span>
                              <span className="text-zinc-300 ml-2">{log.details}</span>
                            </div>
                            <div className="text-zinc-500 text-[11px]">
                              {log.username} · {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* JAVA RUNTIMES MANAGER TAB */}
                {activeTab === 'java' && token && (
                  <JavaRuntimeManager token={token} onRefreshHostStats={() => {
                    fetch(`${API_BASE}/stats/host`, { headers: { Authorization: `Bearer ${token}` } })
                      .then(r => r.json())
                      .then(d => setHostStats(d))
                      .catch(() => {});
                  }} />
                )}

                {/* SETTINGS / APPEARANCE VIEW (All 10 Background Controls Inline) */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 shadow-2xl">
                      <div className="flex items-center justify-between pb-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Sliders className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white">Appearance & Background Settings</h2>
                            <p className="text-xs text-zinc-400">
                              Configure the global fixed Minecraft environment and glass UI layers
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={resetBgSettings}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset to Default</span>
                        </button>
                      </div>

                      {/* 1. Wallpaper Toggle */}
                      <div className="flex items-center justify-between p-4 bg-black/35 border border-white/5 rounded-2xl">
                        <div>
                          <div className="text-sm font-semibold text-white">1. Full-Screen Wallpaper</div>
                          <div className="text-xs text-zinc-400">Renders the fixed Minecraft environment behind all glass UI panels</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bgSettings.enabled}
                            onChange={(e) => updateBgSettings({ enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      {bgSettings.enabled && (
                        <div className="space-y-6">
                          {/* Presets Grid */}
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                              Atmospheric Presets
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {WALLPAPER_PRESET_OPTIONS.map((preset) => {
                                const isSelected = bgSettings.preset === preset.id;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => updateBgSettings({ preset: preset.id as any })}
                                    className={`flex items-start gap-3 p-3.5 text-left rounded-2xl border transition-all duration-200 ${
                                      isSelected
                                        ? 'bg-purple-950/50 border-purple-500/80 shadow-lg shadow-purple-950/40'
                                        : 'glass-card hover:border-purple-500/30'
                                    }`}
                                  >
                                    <div
                                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border border-white/10 shadow-sm"
                                      style={{ backgroundColor: preset.previewColor }}
                                    >
                                      {isSelected && <Check className="w-5 h-5 text-white" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-white truncate">{preset.name}</div>
                                      <div className="text-xs text-zinc-400 line-clamp-1">{preset.subtitle}</div>
                                    </div>
                                  </button>
                                );
                              })}

                              {/* Custom Wallpaper Option */}
                              <button
                                type="button"
                                onClick={() => updateBgSettings({ preset: 'custom' })}
                                className={`flex items-start gap-3 p-3.5 text-left rounded-2xl border transition-all duration-200 ${
                                  bgSettings.preset === 'custom'
                                    ? 'bg-purple-950/50 border-purple-500/80 shadow-lg shadow-purple-950/40'
                                    : 'glass-card hover:border-purple-500/30'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-zinc-900 border border-white/10 text-purple-400">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-white">Custom Upload / URL</div>
                                  <div className="text-xs text-zinc-400">Use your own Minecraft artwork</div>
                                </div>
                              </button>
                            </div>

                            {bgSettings.preset === 'custom' && (
                              <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="url"
                                    placeholder="https://example.com/minecraft-wallpaper.png"
                                    value={bgSettings.customUrl.startsWith('data:') ? 'Custom uploaded image (stored locally)' : bgSettings.customUrl}
                                    onChange={(e) => updateBgSettings({ customUrl: e.target.value })}
                                    className="flex-1 px-3.5 py-2 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
                                  />
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleCustomFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-colors whitespace-nowrap"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload File</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 2 & 4. Opacity & Blur Sliders */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* 2. Opacity */}
                            <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-2">
                              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                                <span>2. Wallpaper Opacity</span>
                                <span className="font-mono text-purple-400 tabular-nums">{Math.round(bgSettings.opacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={bgSettings.opacity}
                                onChange={(e) => updateBgSettings({ opacity: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                              />
                            </div>

                            {/* 4. Blur Amount */}
                            <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-2">
                              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                                <span>4. Depth Blur</span>
                                <span className="font-mono text-purple-400 tabular-nums">{bgSettings.blur}px</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="30"
                                step="1"
                                value={bgSettings.blur}
                                onChange={(e) => updateBgSettings({ blur: parseInt(e.target.value, 10) })}
                                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                              />
                            </div>
                          </div>

                          {/* 3. Overlay Darkness Shading */}
                          <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-3">
                            <label className="block text-xs font-semibold text-zinc-300">
                              3. Overlay Darkness (linear-gradient)
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                              {(['none', 'light', 'medium', 'dark', 'ultra'] as const).map((level) => (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => updateBgSettings({ overlay: level })}
                                  className={`py-2 px-2 text-xs font-medium rounded-xl capitalize border transition-all ${
                                    bgSettings.overlay === level
                                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30'
                                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                  }`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 6 & 7. Background Position & Background Size */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* 6. Background Position */}
                            <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-2">
                              <label className="text-xs font-semibold text-zinc-300 block">
                                6. Background Position X/Y
                              </label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {(['center', 'top', 'bottom', 'left', 'right'] as const).map((pos) => (
                                  <button
                                    key={pos}
                                    type="button"
                                    onClick={() => updateBgSettings({ position: pos })}
                                    className={`py-1.5 px-2 text-[11px] font-medium rounded-lg capitalize border transition-colors ${
                                      (bgSettings.position || 'center') === pos
                                        ? 'bg-purple-600 text-white border-purple-400'
                                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                    }`}
                                  >
                                    {pos}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 7. Background Size */}
                            <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-2">
                              <label className="text-xs font-semibold text-zinc-300 block">
                                7. Background Size
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {(['cover', 'contain', '100% 100%', '115%'] as const).map((sz) => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => updateBgSettings({ size: sz })}
                                    className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-colors ${
                                      (bgSettings.size || 'cover') === sz
                                        ? 'bg-purple-600 text-white border-purple-400'
                                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                    }`}
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 5, 8. Vignette & Reduce Motion Toggles */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center justify-between p-3.5 bg-black/35 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                              <span className="text-xs font-semibold text-zinc-200">5. Vignette Dark Borders</span>
                              <input
                                type="checkbox"
                                checked={bgSettings.vignette}
                                onChange={(e) => updateBgSettings({ vignette: e.target.checked })}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-zinc-800 border-zinc-700"
                              />
                            </label>

                            <label className="flex items-center justify-between p-3.5 bg-black/35 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                              <span className="text-xs font-semibold text-zinc-200">8. Reduce Motion</span>
                              <input
                                type="checkbox"
                                checked={bgSettings.reduceMotion}
                                onChange={(e) => updateBgSettings({ reduceMotion: e.target.checked })}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-zinc-800 border-zinc-700"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* CREATE SERVER MULTI-STEP WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-xl glass-modal rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Deploy Minecraft Server</h3>
                <p className="text-xs text-zinc-400">Step {wizardStep} of 4</p>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Identity */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Server Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Survival SMP Season 2"
                    value={wizardData.name}
                    onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Private community survival server"
                    value={wizardData.description}
                    onChange={(e) => setWizardData({ ...wizardData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Software & Version */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Server Engine</label>
                  <select
                    value={wizardData.software}
                    onChange={(e) => setWizardData({ ...wizardData, software: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                  >
                    <option value="Paper">Paper (High Performance & Plugins - Recommended)</option>
                    <option value="Purpur">Purpur (High Customization)</option>
                    <option value="Fabric">Fabric (Modern Modding)</option>
                    <option value="Vanilla">Vanilla Official (Mojang)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Minecraft Version</label>
                  <select
                    value={wizardData.version}
                    onChange={(e) => setWizardData({ ...wizardData, version: e.target.value })}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                  >
                    <option value="1.21.1">1.21.1 (Latest Stable)</option>
                    <option value="1.20.4">1.20.4</option>
                    <option value="1.19.4">1.19.4</option>
                    <option value="1.18.2">1.18.2</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Java Runtime (Adoptium / Zulu OpenJDK)</label>
                  <select
                    value={wizardData.javaVersion}
                    onChange={(e) => setWizardData({ ...wizardData, javaVersion: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                  >
                    <option value="21">OpenJDK 21 (LTS - Standard for Minecraft 1.20.5+ / 1.21.x)</option>
                    <option value="17">OpenJDK 17 (LTS - For Minecraft 1.18 - 1.20.4)</option>
                    <option value="25">OpenJDK 25 (Next-Gen High Performance)</option>
                  </select>
                  <p className="text-[11px] text-purple-400 mt-1">
                    Verified runtime managed via Python OpenJDK engine. Automatically downloaded if missing.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Hardware Resources */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-zinc-300 mb-1">
                    <span>RAM Allocation</span>
                    <span className="font-mono text-purple-400 font-bold">{wizardData.memoryLimitGb} GB</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="16"
                    step="1"
                    value={wizardData.memoryLimitGb}
                    onChange={(e) => setWizardData({ ...wizardData, memoryLimitGb: Number(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-zinc-300 mb-1">
                    <span>CPU Cores</span>
                    <span className="font-mono text-purple-400 font-bold">{wizardData.cpuLimitCores} Cores</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={wizardData.cpuLimitCores}
                    onChange={(e) => setWizardData({ ...wizardData, cpuLimitCores: Number(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            )}

            {/* Step 4: EULA & Confirmation */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl text-xs text-zinc-300 leading-relaxed">
                  You are about to create <span className="text-white font-bold">{wizardData.name}</span> running{' '}
                  <span className="text-purple-400 font-bold">{wizardData.software} {wizardData.version}</span> with{' '}
                  <span className="text-white font-bold">{wizardData.memoryLimitGb} GB RAM</span> on OpenJDK 21.
                </div>
                <label className="flex items-center gap-3 p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wizardData.acceptEula}
                    onChange={(e) => setWizardData({ ...wizardData, acceptEula: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-200">
                    I accept the official Minecraft End User License Agreement (EULA).
                  </span>
                </label>
              </div>
            )}

            {/* Footer Wizard Controls */}
            <div className="flex items-center justify-between pt-5 border-t border-white/10 mt-6">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Back
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  disabled={wizardStep === 1 && !wizardData.name.trim()}
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!wizardData.acceptEula}
                  onClick={createServerWizard}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl"
                >
                  Deploy Server
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* THEME MODAL */}
      <ThemeModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        settings={bgSettings}
        onUpdate={updateBgSettings}
        onReset={resetBgSettings}
      />

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md glass-modal rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl ${
                  confirmModal.isDestructive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS CONTAINER */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-2xl border text-xs font-medium shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'glass-modal border-purple-500/30 text-zinc-200'
            }`}
          >
            {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-purple-400" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
