import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon, FolderOpen, Users, Archive, Calendar, Globe, LineChart, HardDrive,
  Settings, Activity, Plus, Search, Power, Play, Square, RotateCw, Trash2, Edit2,
  Save, Undo, Check, FileText, ChevronRight, ChevronLeft, Menu, X, Lock, User, Grid, Cpu, Layers,
  Wifi, UserX, AlertCircle, Eye, LogOut, Command, ShieldAlert, KeyRound, ArrowRight,
  RefreshCw, FolderPlus, FilePlus, EyeOff, Sliders, Network, Sparkles, HelpCircle,
  FileCode, Database, CheckSquare, Clock, Upload, Volume2, VolumeX, AlertTriangle,
  Image as ImageIcon, Server as ServerIcon, Shield, Smartphone, ChevronDown, Filter,
  RotateCcw, LayoutDashboard
} from 'lucide-react';
import { sounds } from './utils/sound';
import { BackgroundSystem, BackgroundSettings, DEFAULT_BACKGROUND_SETTINGS, WALLPAPER_PRESET_OPTIONS } from './components/BackgroundSystem';
import { ThemeModal } from './components/ThemeModal';
import { ServerCard } from './components/ServerCard';
import { ServerHero } from './components/ServerHero';
import { PluginManager } from './components/PluginManager';
import { ModManager } from './components/ModManager';
import { JavaRuntimeManager } from './components/JavaRuntimeManager';
import { FileManager } from './components/FileManager';
import { CreateServerWizard } from './components/CreateServerWizard';
import { ConfigEditor } from './components/ConfigEditor';
import { initGlobalTouchSystem } from './utils/touchSystem';
import { NavigationService, RouteState } from './services/NavigationService';

const API_BASE = '/api';
const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws';

export default function App() {
  useEffect(() => {
    initGlobalTouchSystem();
  }, []);
  const isModded = (software: string) => {
    const sw = (software || '').toLowerCase();
    return sw === 'fabric' || sw === 'forge' || sw === 'neoforge';
  };

  const seedHistoryState = (currentVal: number, existingArray: number[], baseVariance = 0.05, minVal = 0) => {
    if (existingArray.length > 0) return [...existingArray.slice(-59), currentVal];
    const seed: number[] = [];
    let lastVal = currentVal;
    for (let i = 0; i < 40; i++) {
      const change = lastVal * (Math.random() - 0.5) * baseVariance;
      lastVal = Math.max(minVal, lastVal + change);
      seed.push(parseFloat(lastVal.toFixed(2)));
    }
    seed[seed.length - 1] = currentVal;
    return seed;
  };

  // Session & Authentication
  const [token, setToken] = useState<string | null>(localStorage.getItem('mc_token'));
  const [user, setUser] = useState<{ id: string; username: string; role: string; permissions: string[] } | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Background & Theme Customization (10 Settings Matrix) - 8K Custom Theme
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(() => {
    try {
      const saved = localStorage.getItem('arix_theme_settings_v4') || localStorage.getItem('arix_theme_settings_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_BACKGROUND_SETTINGS,
          ...parsed
        };
      }
      return DEFAULT_BACKGROUND_SETTINGS;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arix_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('arix_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const navService = NavigationService.getInstance();
  const initialRoute = navService.getRoute();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<any>(initialRoute.tab);
  const [selectedServerId, setSelectedServerIdState] = useState<string | null>(initialRoute.serverId);
  const [selectedServerTab, setSelectedServerTabState] = useState<any>(initialRoute.serverTab);

  // Sync React state with NavigationService subscriber
  useEffect(() => {
    const unsubscribe = navService.subscribe((route: RouteState) => {
      setActiveTabState(route.tab);
      setSelectedServerIdState(route.serverId);
      setSelectedServerTabState(route.serverTab);
    });
    return unsubscribe;
  }, []);

  const setActiveTab = (tab: any, replace = false) => {
    navService.navigateToTab(tab, replace);
  };

  const setSelectedServerId = (id: string | null, replace = false) => {
    if (id) {
      navService.navigateToServer(id, selectedServerTab, replace);
    } else {
      navService.navigateToTab('overview', replace);
    }
  };

  const setSelectedServerTab = (tab: any, replace = false) => {
    if (selectedServerId) {
      navService.navigateToServer(selectedServerId, tab, replace);
    }
  };

  const sidebarMode: 'server' | 'admin' = (
    activeTab === 'overview' ||
    activeTab === 'servers' ||
    selectedServerId !== null
  ) ? 'server' : 'admin';

  // Real-time server live metrics & history
  const [serverRealtimeMetrics, setServerRealtimeMetrics] = useState<any>(null);
  const [metricsStatus, setMetricsStatus] = useState<'live' | 'stale' | 'reconnecting'>('live');
  const [lastMetricsTime, setLastMetricsTime] = useState<number>(Date.now());
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([]);

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
  const [showCreateNodeModal, setShowCreateNodeModal] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    status: 'ONLINE' as 'ONLINE' | 'OFFLINE' | 'MAINTENANCE',
    description: '',
    location: 'India',
    country: 'India',
    ipAddress: '125.16.24.110',
    port: 8080,
    maxMemoryGb: 32,
    maxCpuCores: 8,
    maxDiskGb: 200,
    daemonStatus: 'Connected' as 'Connected' | 'Unreachable' | 'Degraded'
  });
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState('all');

  // Admin Server Deletion & Filters
  const [deleteConfirmModalServer, setDeleteConfirmModalServer] = useState<any | null>(null);
  const [deleteTypedInput, setDeleteTypedInput] = useState('');
  const [deletingInAdmin, setDeletingInAdmin] = useState(false);
  const [adminServerSearch, setAdminServerSearch] = useState('');
  const [adminServerStatusFilter, setAdminServerStatusFilter] = useState('all');

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
  const consoleViewportRef = useRef<HTMLDivElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  const handleConsoleScroll = () => {
    const el = consoleViewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom > 40 && autoScroll) {
      setAutoScroll(false);
    } else if (distanceFromBottom <= 40 && !autoScroll) {
      setAutoScroll(true);
    }
  };

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
  const totalCpuLimit = servers.reduce((acc, s) => acc + (Number(s.cpuLimitCores) || 0), 0);
  const totalDiskLimit = servers.reduce((acc, s) => acc + (Number(s.diskLimitGb) || 0), 0);

  const isAdminUser = (u: any) => {
    if (!u) return false;
    const r = String(u.role || '').toLowerCase();
    if (r === 'admin' || r === 'administrator' || r === 'owner') return true;
    if (Array.isArray(u.permissions) && (u.permissions.includes('admin') || u.permissions.includes('*'))) return true;
    return false;
  };

  const openAdminArea = () => {
    if (!isAdminUser(user)) {
      showToast('error', 'Access denied: Requires administrator credentials.');
      return;
    }
    sounds.playClick();
    setSelectedServerId(null);
    setActiveTab('admin-dashboard');
  };

  const backToServerPanel = () => {
    sounds.playClick();
    setActiveTab('overview');
  };

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

  // Auth synchronization with NavigationService
  useEffect(() => {
    if (!token) {
      if (!navService.getRoute().isLogin) {
        navService.navigateToLogin(true);
      }
    } else if (user) {
      if (navService.getRoute().isLogin) {
        const intended = navService.consumeIntendedRoute();
        if (intended) {
          navService.navigate(intended, true);
        } else {
          navService.navigateToTab('overview', true);
        }
      }
    }
  }, [token, user]);

  // Verify deep-linked server exists once servers list is loaded
  const [serverCheckDone, setServerCheckDone] = useState(false);
  useEffect(() => {
    if (servers.length > 0 && selectedServerId && !serverCheckDone) {
      const exists = servers.some((s: any) => s.id === selectedServerId);
      if (!exists) {
        showToast('error', `Server instance "${selectedServerId}" not found.`);
        navService.navigateToTab('overview', true);
      }
      setServerCheckDone(true);
    }
  }, [servers, selectedServerId, serverCheckDone]);
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          }
        } else if (res.status === 401) {
          // Only invalidate token if server explicitly responds 401 Unauthorized
          setUser(null);
          setToken(null);
          localStorage.removeItem('mc_token');
        }
      } catch {
        // Do NOT destroy session token on network glitch or tab wake up
      }
    };
    if (token) {
      fetchMe();
    }
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

    if (activeTab === 'admin-nodes') {
      loadAdminNodes();
    }
  }, [activeTab, token]);

  // Live Server Metrics Poller
  useEffect(() => {
    if (!token || !selectedServerId) {
      setServerRealtimeMetrics(null);
      return;
    }

    const ingestMetrics = (data: any) => {
      setServerRealtimeMetrics(data);
      setLastMetricsTime(Date.now());
      setMetricsStatus('live');
      if (data?.cpuPercent !== undefined) {
        setCpuHistory(prev => seedHistoryState(Math.round(data.cpuPercent * 10) / 10, prev, 0.15, 0));
      }
      if (data?.memoryUsedBytes !== undefined) {
        const gb = parseFloat((data.memoryUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
        setRamHistory(prev => seedHistoryState(gb, prev, 0.05, 0));
      }
      if (data?.diskUsedBytes !== undefined) {
        const gb = parseFloat((data.diskUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
        setDiskHistory(prev => seedHistoryState(gb, prev, 0.005, 0.1));
      }
      if (data?.network) {
        const rxKb = Math.round((data.network.rxBytesSec || 0) / 1024);
        const txKb = Math.round((data.network.txBytesSec || 0) / 1024);
        setNetRxHistory(prev => seedHistoryState(rxKb, prev, 0.3, 0));
        setNetTxHistory(prev => seedHistoryState(txKb, prev, 0.3, 0));
      }
    };

    const fetchLiveMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/servers/${selectedServerId}/metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          ingestMetrics(data);
        }
      } catch {
        // Heartbeat timer will mark stale
      }
    };

    fetchLiveMetrics();
    const metricsInterval = setInterval(fetchLiveMetrics, 2000);
    return () => clearInterval(metricsInterval);
  }, [selectedServerId, token]);

  // Metric staleness heartbeat
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (!selectedServerId) return;
      const diff = Date.now() - lastMetricsTime;
      if (diff > 5000 && diff <= 10000) {
        setMetricsStatus('stale');
      } else if (diff > 10000) {
        setMetricsStatus('reconnecting');
      }
    }, 2000);
    return () => clearInterval(heartbeat);
  }, [lastMetricsTime, selectedServerId]);

  // Server context loader & WS console / metrics Setup
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

    // Always maintain WebSocket connection for live metrics and console logs with auto-reconnection
    let isUnmounted = false;
    let reconnectTimeout: any = null;

    const connectConsoleWs = () => {
      if (isUnmounted || !token || !selectedServerId) return;

      const wsUrl = `${WS_SCHEME}://${window.location.host}/api/servers/${selectedServerId}/console?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) {
          ws.close();
          return;
        }
        setWsConnected(true);
        setMetricsStatus('live');
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!isUnmounted && selectedServerId && token) {
          reconnectTimeout = setTimeout(connectConsoleWs, 2500);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'metrics') {
            setServerRealtimeMetrics(msg.metrics);
            setLastMetricsTime(Date.now());
            setMetricsStatus('live');
            if (msg.metrics?.cpuPercent !== undefined) {
              setCpuHistory(prev => seedHistoryState(Math.round(msg.metrics.cpuPercent * 10) / 10, prev, 0.15, 0));
            }
            if (msg.metrics?.memoryUsedBytes !== undefined) {
              const gb = parseFloat((msg.metrics.memoryUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
              setRamHistory(prev => seedHistoryState(gb, prev, 0.05, 0));
            }
            if (msg.metrics?.diskUsedBytes !== undefined) {
              const gb = parseFloat((msg.metrics.diskUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
              setDiskHistory(prev => seedHistoryState(gb, prev, 0.005, 0.1));
            }
            if (msg.metrics?.network) {
              const rxKb = Math.round((msg.metrics.network.rxBytesSec || 0) / 1024);
              const txKb = Math.round((msg.metrics.network.txBytesSec || 0) / 1024);
              setNetRxHistory(prev => seedHistoryState(rxKb, prev, 0.3, 0));
              setNetTxHistory(prev => seedHistoryState(txKb, prev, 0.3, 0));
            }
          } else if (msg.type === 'history') {
            setConsoleLogs(msg.logs || []);
          } else if (msg.type === 'clear') {
            setConsoleLogs([]);
          } else if (msg.type === 'log') {
            setConsoleLogs(prev => [...prev, msg.log]);
          } else if (msg.error) {
            showToast('error', msg.error);
          }
        } catch {}
      };
    };

    connectConsoleWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [selectedServerId, selectedServerTab, token]);

  // Autoscroll console logs strictly within the viewport
  useEffect(() => {
    const el = consoleViewportRef.current;
    if (el && autoScroll) {
      el.scrollTop = el.scrollHeight;
    }
  }, [consoleLogs, autoScroll]);

  // Safe deduplicated toaster
  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
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
  }, []);

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
        const intended = navService.consumeIntendedRoute();
        if (intended) {
          navService.navigate(intended);
        } else {
          navService.navigateToTab('overview');
        }
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
    if (!termsAccepted) {
      setAuthError('You must agree to the Terms and Conditions to log in.');
      return;
    }
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
        const intended = navService.consumeIntendedRoute();
        if (intended) {
          navService.navigate(intended);
        } else {
          navService.navigateToTab('overview');
        }
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
    navService.navigateToLogin();
    showToast('info', 'Secure session terminated.');
  };

  const promptLogout = () => {
    setConfirmModal({
      title: 'Log Out of Craft Command Center',
      message: 'Are you sure you want to end your session? You will be returned to the login screen.',
      confirmLabel: 'Log Out',
      isDestructive: true,
      onConfirm: handleLogout
    });
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

        if (action === 'start' || action === 'restart') {
          // Immediately begin monitoring session and fetch first real telemetry sample
          fetch(`${API_BASE}/servers/${serverId}/metrics`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data) {
                setServerRealtimeMetrics(data);
                setLastMetricsTime(Date.now());
                setMetricsStatus('live');
              }
            })
            .catch(() => {});
        }
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

  const refreshServerStorageStats = async () => {
    if (!token || !selectedServerId) return;
    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setServerDetails(await res.json());
      }
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setServerRealtimeMetrics(await res.json());
      }
    } catch {}
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

  // --- ADMIN NODES OPERATIONS ---
  const [adminNodes, setAdminNodes] = useState<any[]>([]);
  const [loadingAdminNodes, setLoadingAdminNodes] = useState(false);

  const loadAdminNodes = async () => {
    try {
      setLoadingAdminNodes(true);
      const res = await fetch(`${API_BASE}/nodes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAdminNodes(await res.json());
      }
    } catch {
      showToast('error', 'Failed to retrieve virtualization clusters.');
    } finally {
      setLoadingAdminNodes(false);
    }
  };

  const saveAdminNode = async () => {
    if (!nodeForm.name || !nodeForm.location) {
      showToast('error', 'Name and location are required.');
      return;
    }
    try {
      const url = editingNode
        ? `${API_BASE}/admin/nodes/${editingNode.id}`
        : `${API_BASE}/admin/nodes`;
      const method = editingNode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nodeForm)
      });

      if (res.ok) {
        showToast('success', editingNode ? 'Node updated successfully.' : 'Host node registered successfully.');
        setShowCreateNodeModal(false);
        setEditingNode(null);
        setNodeForm({
          name: '',
          status: 'ONLINE',
          description: '',
          location: 'India',
          country: 'India',
          ipAddress: '125.16.24.110',
          port: 8080,
          maxMemoryGb: 32,
          maxCpuCores: 8,
          maxDiskGb: 200,
          daemonStatus: 'Connected'
        });
        loadAdminNodes();
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Server rejected node specification.');
      }
    } catch {
      showToast('error', 'Network failure saving node details.');
    }
  };

  const pingAdminNode = async (nodeId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/nodes/${nodeId}/ping`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.status === 'OFFLINE' ? 'error' : 'success', data.message || 'Heartbeat acknowledged.');
        loadAdminNodes();
      } else {
        showToast('error', data.error || 'Daemon ping timed out.');
      }
    } catch {
      showToast('error', 'Network failure contacting hardware cluster.');
    }
  };

  const deleteAdminNode = async (nodeId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this virtualization host node?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('success', 'Host node decommissioned successfully.');
        loadAdminNodes();
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Decommission request rejected.');
      }
    } catch {
      showToast('error', 'Network failure contacting hardware cluster.');
    }
  };

  // Users & Access Operations
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.username.trim() || !newUserData.password.trim()) {
      showToast('error', 'Username and password are required.');
      return;
    }
    sounds.playClick();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserData)
      });
      const data = await res.json();
      if (res.ok) {
        sounds.playSuccess();
        showToast('success', `User account "${newUserData.username}" created.`);
        setNewUserData({ username: '', password: '', role: 'Administrator' });
        setShowCreateUserModal(false);
        const uRes = await fetch(`${API_BASE}/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (uRes.ok) setUsersList(await uRes.json());
      } else {
        showToast('error', data.error || 'Failed to create user.');
      }
    } catch {
      showToast('error', 'Network failure creating user account.');
    }
  };

  const handleDeleteUser = (targetUser: any) => {
    sounds.playClick();
    setConfirmModal({
      title: 'DELETE USER ACCOUNT',
      message: `Permanently remove user "${targetUser.username}" with role [${targetUser.role}]? This action cannot be undone.`,
      confirmLabel: 'Delete User',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/users/${targetUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            sounds.playDelete();
            showToast('success', `User "${targetUser.username}" removed successfully.`);
            setUsersList(prev => prev.filter(u => u.id !== targetUser.id));
          } else {
            const d = await res.json();
            showToast('error', d.error || 'Failed to delete user.');
          }
        } catch {
          showToast('error', 'Network failure deleting user.');
        }
      }
    });
  };

  // Real Admin Server Deletion Handler
  const handleAdminDeleteServer = async () => {
    if (!deleteConfirmModalServer || deleteTypedInput !== 'DELETE') return;
    const srv = deleteConfirmModalServer;
    setDeletingInAdmin(true);
    sounds.playClick();
    try {
      const res = await fetch(`${API_BASE}/admin/servers/${srv.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        sounds.playDelete();
        showToast('success', `Server "${srv.name}" permanently deleted.`);
        setServers(prev => prev.filter(s => s.id !== srv.id));
        if (selectedServerId === srv.id) {
          setSelectedServerId(null);
        }
        setDeleteConfirmModalServer(null);
        setDeleteTypedInput('');
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to delete server.');
      }
    } catch {
      showToast('error', 'Network failure executing server deletion.');
    } finally {
      setDeletingInAdmin(false);
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
    setTimeout(() => {
      commandInputRef.current?.focus({ preventScroll: true });
    }, 10);
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
        <div className="app-content relative z-10 w-full max-w-md glass-modal rounded-3xl p-8 shadow-2xl">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-lg mb-4">
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
                Username
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

            <div className="flex items-center gap-2.5 pt-1 pb-1">
              <input
                type="checkbox"
                id="loginTermsCheckbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900/80 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600 shrink-0"
              />
              <label htmlFor="loginTermsCheckbox" className="text-xs text-zinc-300 cursor-pointer select-none">
                I agree to the <span className="text-purple-400 font-medium hover:underline">Terms and Conditions</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={authLoading || !termsAccepted}
              className="w-full mt-2 py-3 px-4 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{setupNeeded ? 'INITIALIZE SUPERADMIN' : 'LOG IN'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer branding */}
          <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-center text-xs text-zinc-500">
            <span>v2.4.0 · Xorvila Engine</span>
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
    <div className="relative min-h-screen w-full flex flex-col font-sans text-zinc-100">
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-sm">
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
            {/* Sound FX Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
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
                onClick={promptLogout}
                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                title="Log Out / Terminate Session"
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
            className={`hidden md:flex flex-col justify-between ${sidebarCollapsed ? 'w-20 p-2.5' : 'w-64 p-4'} glass-sidebar shrink-0 transition-all duration-300 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-20`}
          >
            <div className="space-y-6">
              {/* Sidebar Header & Collapse Toggle */}
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} pb-2 border-b border-white/5`}>
                {!sidebarCollapsed && (
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                    Navigation
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                  title={sidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar"}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>

              {/* SIDEBAR NAVIGATION CONTENT BASED ON sidebarMode */}
              {sidebarMode === 'server' ? (
                /* MAIN SERVER PANEL SIDEBAR MODE */
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* GENERAL / MAIN SECTION */}
                    <div>
                      {!sidebarCollapsed && (
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                          Main
                        </div>
                      )}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('overview');
                          }}
                          title="Overview"
                          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all cursor-pointer ${
                            activeTab === 'overview' && !selectedServerId
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/40 font-semibold'
                              : 'text-zinc-200 hover:text-white hover:bg-purple-500/15 border border-transparent'
                          }`}
                        >
                          <Grid className="w-4 h-4 shrink-0 text-purple-300" />
                          {!sidebarCollapsed && <span>Overview</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('servers');
                          }}
                          title={`Servers (${servers.length})`}
                          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'} text-xs font-medium rounded-xl transition-all cursor-pointer ${
                            activeTab === 'servers' && !selectedServerId
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/40 font-semibold'
                              : 'text-zinc-200 hover:text-white hover:bg-purple-500/15 border border-transparent'
                          }`}
                        >
                          <span className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <ServerIcon className="w-4 h-4 shrink-0 text-purple-300" />
                            {!sidebarCollapsed && <span>Servers</span>}
                          </span>
                          {!sidebarCollapsed && (
                            <span className="text-[11px] font-mono tabular-nums text-purple-200 bg-purple-900/60 border border-purple-500/30 px-1.5 py-0.5 rounded font-bold shadow-sm">
                              {servers.length}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowWizard(true);
                            setWizardStep(1);
                          }}
                          title="Create Server"
                          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-semibold text-purple-200 bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/40 rounded-xl transition-all shadow-md cursor-pointer`}
                        >
                          <Plus className="w-4 h-4 text-purple-300 shrink-0" />
                          {!sidebarCollapsed && <span>Create Server</span>}
                        </button>
                      </div>
                    </div>

                    {/* ACTIVE SERVER CONTEXT & TOOLS (Desktop) */}
                    {selectedServerId && serverDetails && (
                      <div className="space-y-3">
                        <div className={`p-2.5 bg-purple-900/30 border border-purple-400/30 rounded-2xl shadow-md ${sidebarCollapsed ? 'text-center' : ''}`}>
                          {!sidebarCollapsed ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                                <span>Active Server</span>
                                <span className={`w-2 h-2 rounded-full ${serverDetails.status === 'Running' ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-zinc-500'}`} />
                              </div>
                              <div className="text-xs font-bold text-white truncate drop-shadow-sm">{serverDetails.name}</div>
                              <button
                                type="button"
                                onClick={() => setSelectedServerId(null)}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-purple-200 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 rounded-lg transition cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" /> All Servers
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedServerId(null)}
                              title="Back to All Servers"
                              className="p-1.5 text-purple-300 hover:text-white"
                            >
                              <ChevronLeft className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </div>

                        {/* Server Tools List */}
                        <div>
                          {!sidebarCollapsed && (
                            <div className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
                              <span>Server Tools</span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {[
                              { id: 'console', label: 'Console', icon: TerminalIcon },
                              { id: 'files', label: 'File Manager', icon: FolderOpen },
                              { id: 'plugins', label: isModded(serverDetails?.software) ? 'Mod Manager' : 'Plugin Manager', icon: isModded(serverDetails?.software) ? Layers : Sparkles },
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
                                  title={item.label}
                                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/40 font-semibold'
                                      : 'text-zinc-200 hover:text-white hover:bg-purple-500/15 border border-transparent'
                                  }`}
                                >
                                  <Icon className="w-4 h-4 shrink-0 text-purple-300" />
                                  {!sidebarCollapsed && <span>{item.label}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SINGLE ADMIN AREA ENTRY AT BOTTOM (Requirement #1) */}
                  <div className="pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAdminUser(user)) {
                          alert('Access Denied: Administrator permissions required to access Admin Area.');
                          return;
                        }
                        openAdminArea();
                      }}
                      title="Admin Area"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3.5 py-2.5'} text-xs font-bold text-purple-200 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-xl transition-all shadow-md active:scale-95`}
                    >
                      <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                      {!sidebarCollapsed && <span>⚙ ADMIN AREA</span>}
                    </button>
                  </div>
                </div>
              ) : (
                /* DEDICATED ADMIN AREA SIDEBAR MODE (Requirement #2) */
                <div className="space-y-6 flex-1">
                  {/* Back to Server Panel Button */}
                  <button
                    type="button"
                    onClick={backToServerPanel}
                    title="Back to Server Panel"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'} text-xs font-semibold text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl transition`}
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>← Back to Server Panel</span>}
                  </button>

                  {/* ADMIN AREA SECTION */}
                  <div>
                    {!sidebarCollapsed && (
                      <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-3 mb-2">
                        Admin Area
                      </div>
                    )}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('admin-dashboard');
                        }}
                        title="Overview"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'admin-dashboard' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Overview</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('admin-servers');
                        }}
                        title="Servers"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'admin-servers' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <ServerIcon className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Servers</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('users');
                        }}
                        title="Users & Access"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'users' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Users className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Users & Access</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('admin-nodes');
                        }}
                        title="Node Management"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'admin-nodes' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <HardDrive className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Node Management</span>}
                      </button>
                    </div>
                  </div>

                  {/* INFRASTRUCTURE SECTION */}
                  <div>
                    {!sidebarCollapsed && (
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                        Infrastructure
                      </div>
                    )}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('java');
                        }}
                        title="Java Runtimes"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'java' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Cpu className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Java Runtimes</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('docker');
                        }}
                        title="Docker Runtime"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'docker' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Layers className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Docker Runtime</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('nodes');
                        }}
                        title="Port Allocations"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'nodes' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Globe className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Port Allocations</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('nginx-proxies');
                        }}
                        title="Nginx Proxies"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'nginx-proxies' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Activity className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Nginx Proxies</span>}
                      </button>
                    </div>
                  </div>

                  {/* SYSTEM SECTION */}
                  <div>
                    {!sidebarCollapsed && (
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                        System
                      </div>
                    )}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('audit');
                        }}
                        title="Audit Logs"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'audit' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Clock className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Audit Logs</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('settings');
                        }}
                        title="System Settings"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'settings' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sliders className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>System Settings</span>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Node Status Indicator in bottom sidebar */}
            <div className={`p-3 bg-purple-950/40 border border-purple-500/20 rounded-2xl shadow-inner ${sidebarCollapsed ? 'text-center' : ''}`}>
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} text-[11px] mb-1`}>
                <span className="text-zinc-300 flex items-center gap-1.5" title="Host Node-01 Online">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {!sidebarCollapsed && 'Host Node-01'}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-emerald-400 font-mono font-semibold">Online</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="text-[10px] text-zinc-400 font-mono">
                  Java 21 · Linux x64
                </div>
              )}
            </div>
          </aside>

          {/* MOBILE DRAWER SIDEBAR */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-40 flex">
              <div
                className="fixed inset-0 bg-black/85 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative w-72 glass-sidebar border-r border-purple-500/25 p-5 flex flex-col justify-between overflow-y-auto z-50 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="font-bold text-white text-sm">Navigation</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {sidebarMode === 'server' ? (
                    /* MOBILE MAIN SERVER SIDEBAR MODE */
                    <div className="space-y-6">
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

                      {/* Active Server Context & Tools (Mobile) */}
                      {selectedServerId && serverDetails && (
                        <div className="space-y-3">
                          <div className="p-3 bg-purple-950/40 border border-purple-500/20 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                              <span>Active Server</span>
                              <span className={`w-2 h-2 rounded-full ${serverDetails.status === 'Running' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                            </div>
                            <div className="text-xs font-bold text-white truncate">{serverDetails.name}</div>
                            <button
                              onClick={() => {
                                setSelectedServerId(null);
                                setMobileMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg transition"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Back to All Servers
                            </button>
                          </div>

                          {/* Server Tools List for Mobile */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-2 mb-1">
                              Server Tools
                            </div>
                            {[
                              { id: 'console', label: 'Console', icon: TerminalIcon },
                              { id: 'files', label: 'File Manager', icon: FolderOpen },
                              { id: 'plugins', label: isModded(serverDetails?.software) ? 'Mod Manager' : 'Plugin Manager', icon: isModded(serverDetails?.software) ? Layers : Sparkles },
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
                                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                      : 'text-zinc-200 hover:bg-white/5'
                                  }`}
                                >
                                  <Icon className="w-4 h-4 text-purple-400" />
                                  <span>{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* SINGLE ADMIN AREA BUTTON ON MOBILE (Requirement #1) */}
                      <div className="pt-3 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAdminUser(user)) {
                              alert('Access Denied: Administrator permissions required.');
                              return;
                            }
                            openAdminArea();
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-purple-200 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-xl transition shadow-md"
                        >
                          <Sliders className="w-4 h-4 text-purple-400" />
                          <span>⚙ ADMIN AREA</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* MOBILE DEDICATED ADMIN SIDEBAR MODE (Requirement #2) */
                    <div className="space-y-5">
                      <button
                        type="button"
                        onClick={() => {
                          backToServerPanel();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 rounded-xl transition"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back to Server Panel
                      </button>

                      {/* Admin Area */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-2 mb-1">
                          Admin Area
                        </div>
                        <button
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('admin-dashboard');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            activeTab === 'admin-dashboard' && !selectedServerId
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <LayoutDashboard className="w-4 h-4 text-purple-400" /> Overview
                        </button>
                        <button
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('admin-servers');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            activeTab === 'admin-servers' && !selectedServerId
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <ServerIcon className="w-4 h-4 text-purple-400" /> Servers
                        </button>
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
                            setActiveTab('admin-nodes');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            activeTab === 'admin-nodes' && !selectedServerId
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <HardDrive className="w-4 h-4 text-purple-400" /> Node Management
                        </button>
                      </div>

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
                        <button
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('nginx-proxies');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            activeTab === 'nginx-proxies' && !selectedServerId
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <Activity className="w-4 h-4 text-purple-400" /> Nginx Proxies
                        </button>
                      </div>

                      {/* System */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1">
                          System
                        </div>
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
                          <Sliders className="w-4 h-4 text-purple-400" /> System Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Drawer Bottom Node status */}
                <div className="pt-3 mt-4 border-t border-purple-500/20">
                  <div className="p-3 bg-purple-950/40 border border-purple-500/20 rounded-2xl shadow-inner">
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
            </div>
          )}

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-6 sm:pb-8 max-w-7xl mx-auto w-full space-y-5">
            {/* IF SERVER IS SELECTED -> RENDER SERVER DASHBOARD */}
            {selectedServerId && serverDetails ? (
              <div className="space-y-5">
                {/* SERVER CINEMATIC HERO */}
                <ServerHero
                  server={serverDetails}
                  onPowerAction={(action) => executeLifecycle(serverDetails.id, action)}
                  hostStats={hostStats}
                  metrics={serverRealtimeMetrics}
                  metricsStatus={metricsStatus}
                />

                {/* TAB 1: CONSOLE */}
                {selectedServerTab === 'console' && (
                  <div className="space-y-4">
                    {/* Console Card */}
                    <div className="rounded-3xl glass-panel overflow-hidden flex flex-col h-[560px] min-h-0 shadow-2xl border border-purple-500/25">
                      {/* Console Header Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-purple-950/40 border-b border-purple-500/20">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          </div>
                          <span className="text-xs font-mono text-purple-200 font-semibold">
                            bash · minecraft-daemon @ 127.0.0.1:{serverDetails.primaryPort || 25565}
                          </span>
                        </div>

                        {/* Controls & Connection Status */}
                        <div className="flex items-center gap-3">
                          {/* Real WebSocket status badge */}
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950/60 border border-purple-400/30 text-[11px] font-mono shadow-sm">
                            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                            <span className={wsConnected ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                              {wsConnected ? 'CONNECTED' : 'OFFLINE'}
                            </span>
                          </div>

                          {/* Search Filter */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter logs..."
                              value={consoleSearch}
                              onChange={(e) => setConsoleSearch(e.target.value)}
                              className="pl-8 pr-3 py-1 text-[11px] glass-input rounded-lg text-white placeholder-zinc-400 focus:outline-none"
                            />
                          </div>

                          {/* Auto-scroll toggle */}
                          <button
                            type="button"
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                              autoScroll
                                ? 'bg-purple-600/30 text-purple-200 border-purple-400/40 shadow-sm'
                                : 'bg-purple-950/40 text-zinc-300 border-purple-500/20'
                            }`}
                          >
                            Auto-Scroll
                          </button>

                          {/* Clear Console */}
                          <button
                            type="button"
                            onClick={() => setConsoleLogs([])}
                            className="px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 rounded-lg transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Console Output Area (Brighter background, improved text contrast) */}
                      <div
                        ref={consoleViewportRef}
                        onScroll={handleConsoleScroll}
                        className="flex-1 min-h-0 p-4 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-purple-900 bg-[#0e0a22]/85 select-text relative"
                      >
                        {filteredConsoleLogs.length === 0 ? (
                          <div className="text-zinc-400 text-center py-20 italic">
                            No log streams recorded. Start server to view live console output.
                          </div>
                        ) : (
                          filteredConsoleLogs.map((log, index) => {
                            // Highlight TPS output with vibrant green badge on numbers
                            if (log.includes('TPS from last') || log.includes('Current TPS')) {
                              const parts = log.split(/(TPS from last [^:]*:\s*|Current TPS\s*=\s*)/);
                              if (parts.length >= 3) {
                                return (
                                  <div key={index} className="leading-relaxed whitespace-pre-wrap text-zinc-300 flex flex-wrap items-center gap-1.5 py-0.5">
                                    <span>{parts[0]}</span>
                                    <span className="text-zinc-200">{parts[1]}</span>
                                    <span className="text-emerald-400 font-bold font-mono text-xs drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-400/50 shadow-sm shadow-emerald-500/20">
                                      {parts[2]}
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div key={index} className="leading-relaxed whitespace-pre-wrap text-emerald-400 font-bold drop-shadow-sm py-0.5">
                                  {log}
                                </div>
                              );
                            }

                            // Highlight Tick time / MSPT lines
                            if (log.includes('Tick time:') || log.includes('Current MSPT:')) {
                              return (
                                <div key={index} className="leading-relaxed whitespace-pre-wrap text-emerald-300 font-semibold py-0.5">
                                  {log}
                                </div>
                              );
                            }

                            let colorClass = 'text-zinc-100';
                            if (log.includes('[ERROR]') || log.includes('Exception') || log.includes('FATAL')) {
                              colorClass = 'text-rose-400 font-semibold drop-shadow-sm';
                            } else if (log.includes('[WARN]') || log.includes('WARNING')) {
                              colorClass = 'text-amber-300 font-medium';
                            } else if (log.includes('[Panel System]') || log.includes('[Panel]')) {
                              colorClass = 'text-purple-300 font-semibold';
                            } else if (log.includes('ConsoleInput') || log.startsWith('>')) {
                              colorClass = 'text-cyan-300 font-bold';
                            } else if (log.includes('Done (') || log.includes('For help, type "help"')) {
                              colorClass = 'text-emerald-300 font-semibold';
                            }

                            return (
                              <div key={index} className={`leading-relaxed whitespace-pre-wrap ${colorClass}`}>
                                {log}
                              </div>
                            );
                          })
                        )}

                        {/* Floating Scroll Indicator Button */}
                        {!autoScroll && filteredConsoleLogs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAutoScroll(true);
                              const el = consoleViewportRef.current;
                              if (el) {
                                el.scrollTop = el.scrollHeight;
                              }
                            }}
                            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-full shadow-lg border border-purple-400/40 animate-bounce cursor-pointer"
                          >
                            ↓ New Logs
                          </button>
                        )}
                      </div>

                      {/* Quick Command Chips */}
                      <div className="px-3 py-2 bg-purple-950/40 border-t border-purple-500/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                        <span className="text-[10px] text-purple-300 font-semibold uppercase font-mono mr-1">Quick:</span>
                        {['help', 'list', 'tps', 'whitelist on', 'save-all', 'op admin'].map((cmd) => (
                          <button
                            key={cmd}
                            type="button"
                            onClick={() => sendQuickCommand(cmd)}
                            className="px-2.5 py-0.5 text-[11px] font-mono bg-purple-950/60 hover:bg-purple-900/80 hover:text-purple-100 hover:border-purple-400/50 border border-purple-500/30 rounded text-purple-200 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>

                      {/* Command Input Box */}
                      <form onSubmit={sendConsoleCommand} className="p-3 bg-[#130d2e]/90 border-t border-purple-500/25 flex items-center gap-2">
                        <span className="text-purple-300 font-mono font-bold pl-2 text-sm">&gt;</span>
                        <input
                          ref={commandInputRef}
                          type="text"
                          placeholder="Type a Minecraft command (e.g. op, whitelist, tp, gamemode, help)..."
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          onKeyDown={handleConsoleKeyDown}
                          className="flex-1 bg-transparent text-xs font-mono text-white placeholder-zinc-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!commandInput.trim()}
                          className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 disabled:opacity-40 rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          Send
                        </button>
                      </form>
                    </div>

                    {/* REAL-TIME METRIC GRAPHS (Pterodactyl-Style Real Telemetry Stream) */}
                    {/* 4. PERFORMANCE & RESOURCE TELEMETRY HISTORY GRAPHS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. CPU History Card */}
                      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-indigo-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-indigo-950/20 via-black/30 to-black/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-sm shadow-indigo-500/30">
                              <Cpu className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white tracking-tight">CPU Utilization History</div>
                              <div className="text-[10px] text-zinc-300">Past 60 samples ({serverDetails.cpuLimitCores || 2} cores)</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-indigo-300">
                              {(serverRealtimeMetrics?.cpuPercent || 0).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Peak: {Math.max(...cpuHistory, (serverRealtimeMetrics?.cpuPercent || 0)).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* SVG Area Chart */}
                        <div className="h-28 w-full relative pt-2">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                            {(() => {
                              const points = cpuHistory.map((val, idx) => {
                                const x = (idx / Math.max(cpuHistory.length - 1, 1)) * 240;
                                const maxScale = Math.max(Math.max(...cpuHistory, 20), (serverDetails.cpuLimitCores || 2) * 100);
                                const y = 75 - (Math.min(val, maxScale) / Math.max(maxScale, 1)) * 65;
                                return { x, y };
                              });
                              const pathD = points.length > 0
                                ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                                : 'M 0 75 L 240 75';
                              const areaD = `${pathD} L 240 75 L 0 75 Z`;

                              return (
                                <>
                                  <path d={areaD} fill="url(#cpuGradient)" />
                                  <path d={pathD} fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>

                      {/* 2. RAM History Card */}
                      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-purple-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                              <HardDrive className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white tracking-tight">Memory History</div>
                              <div className="text-[10px] text-zinc-300">Allocated heap RSS over time</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-purple-300">
                              {serverRealtimeMetrics?.memoryUsedFormatted || '0.00 GB'}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Limit: {serverDetails.memoryLimitGb || 4} GB
                            </div>
                          </div>
                        </div>

                        {/* SVG Area Chart */}
                        <div className="h-28 w-full relative pt-2">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                            {(() => {
                              const points = ramHistory.map((val, idx) => {
                                const x = (idx / Math.max(ramHistory.length - 1, 1)) * 240;
                                const maxScale = Math.max(serverDetails.memoryLimitGb || 4, 1);
                                const y = 75 - (Math.min(val, maxScale) / maxScale) * 65;
                                return { x, y };
                              });
                              const pathD = points.length > 0
                                ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                                : 'M 0 75 L 240 75';
                              const areaD = `${pathD} L 240 75 L 0 75 Z`;

                              return (
                                <>
                                  <path d={areaD} fill="url(#ramGradient)" />
                                  <path d={pathD} fill="none" stroke="#e879f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>

                      {/* 3. Disk Storage History */}
                      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-purple-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-purple-950/20 via-black/30 to-black/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                              <Activity className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white tracking-tight">Disk Storage History</div>
                              <div className="text-[10px] text-zinc-300">Server world & files storage footprint</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-purple-300">
                              {serverRealtimeMetrics?.diskUsedFormatted || '0 MB'}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Pool: {serverDetails.diskLimitGb || 15} GB
                            </div>
                          </div>
                        </div>

                        {/* SVG Area Chart */}
                        <div className="h-28 w-full relative pt-2">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#9333ea" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                            {(() => {
                              const points = diskHistory.map((val, idx) => {
                                const x = (idx / Math.max(diskHistory.length - 1, 1)) * 240;
                                const maxScale = Math.max(serverDetails.diskLimitGb || 15, 1);
                                const y = 75 - (Math.min(val, maxScale) / maxScale) * 65;
                                return { x, y };
                              });
                              const pathD = points.length > 0
                                ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                                : 'M 0 75 L 240 75';
                              const areaD = `${pathD} L 240 75 L 0 75 Z`;

                              return (
                                <>
                                  <path d={areaD} fill="url(#diskGradient)" />
                                  <path d={pathD} fill="none" stroke="#d8b4fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>

                      {/* 4. Network Traffic (Incoming & Outgoing) */}
                      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-indigo-500/25 shadow-xl space-y-3 min-w-0 bg-gradient-to-br from-indigo-950/20 via-black/30 to-black/40 relative overflow-hidden">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-sm shadow-indigo-500/30 shrink-0">
                              <Wifi className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white tracking-tight truncate">Network Traffic History</div>
                              <div className="text-[10px] text-zinc-300 flex items-center gap-3 font-mono mt-0.5 whitespace-nowrap">
                                <span className="text-indigo-300">↓ Incoming</span>
                                <span className="text-purple-300">↑ Outgoing</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-xs shrink-0 whitespace-nowrap">
                            {(serverDetails.status === 'Running' || serverDetails.status === 'Starting') ? (
                              <>
                                <span className="text-indigo-300 font-bold mr-3">↓ {serverRealtimeMetrics?.network?.rxRateFormatted || '0 KB/s'}</span>
                                <span className="text-purple-300 font-bold">↑ {serverRealtimeMetrics?.network?.txRateFormatted || '0 KB/s'}</span>
                              </>
                            ) : (
                              <span className="text-zinc-400 font-bold">Offline</span>
                            )}
                          </div>
                        </div>

                        {/* SVG Dual Line Chart */}
                        <div className="h-28 w-full relative pt-2">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 80" preserveAspectRatio="none">
                            <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="40" x2="240" y2="40" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                            <line x1="0" y1="60" x2="240" y2="60" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />

                            {(() => {
                              const maxRx = Math.max(...netRxHistory, 5);
                              const maxTx = Math.max(...netTxHistory, 5);
                              const maxNet = Math.max(maxRx, maxTx, 10);

                              const rxPoints = netRxHistory.map((val, idx) => {
                                const x = (idx / Math.max(netRxHistory.length - 1, 1)) * 240;
                                const y = 75 - (Math.min(val, maxNet) / maxNet) * 65;
                                return { x, y };
                              });
                              const txPoints = netTxHistory.map((val, idx) => {
                                const x = (idx / Math.max(netTxHistory.length - 1, 1)) * 240;
                                const y = 75 - (Math.min(val, maxNet) / maxNet) * 65;
                                return { x, y };
                              });

                              const rxD = rxPoints.length > 0
                                ? rxPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                                : 'M 0 75 L 240 75';
                              const txD = txPoints.length > 0
                                ? txPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
                                : 'M 0 75 L 240 75';

                              return (
                                <>
                                  {(serverDetails.status === 'Running' || serverDetails.status === 'Starting') && (
                                    <>
                                      <path d={rxD} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d={txD} fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </svg>

                          {(serverDetails.status !== 'Running' && serverDetails.status !== 'Starting') && (
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-mono bg-black/45 rounded-xl border border-white/5">
                              Offline
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PLAYERS ONLINE SECTION (Real Online Players) - Pure Purple Theme */}
                    <div className="p-5 rounded-3xl glass-panel border border-purple-500/25 space-y-4 shadow-xl bg-gradient-to-br from-purple-950/20 via-black/25 to-black/35">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">
                              Players Online ({serverRealtimeMetrics?.playersOnline || 0} / {serverRealtimeMetrics?.playersMax || 20})
                            </h3>
                            <p className="text-[11px] text-zinc-300">Live player connections streaming directly from server engine</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-purple-500/30 text-purple-300 font-semibold">
                          Max: {serverRealtimeMetrics?.playersMax || 20}
                        </span>
                      </div>

                      {/* Player Cards List */}
                      {(!serverRealtimeMetrics?.playerList || serverRealtimeMetrics.playerList.length === 0) ? (
                        <div className="py-8 text-center rounded-2xl bg-black/30 border border-white/5 text-zinc-500 text-xs">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
                          0 / {serverRealtimeMetrics?.playersMax || 20} Players Online — No players currently connected to the world.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {serverRealtimeMetrics.playerList.map((player: any) => (
                            <div key={player.name} className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-400/40 flex items-center justify-center text-white font-bold text-xs uppercase">
                                  {player.name.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                    <span>{player.name}</span>
                                    {player.isOp && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono border border-amber-500/30">
                                        OP
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono truncate">
                                    {player.uuid}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] font-mono font-bold text-emerald-400">
                                  {player.pingMs} ms
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  {player.gamemode}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* PERFORMANCE & SERVER INFORMATION MATRIX */}
                    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">Performance & Diagnostics</h3>
                            <p className="text-[11px] text-zinc-400">Real-time Minecraft compute telemetry vs Host isolation</p>
                          </div>
                        </div>
                        {serverRealtimeMetrics?.performance?.uptimeFormatted && (
                          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                            Uptime: {serverRealtimeMetrics.performance.uptimeFormatted}
                          </span>
                        )}
                      </div>

                      {/* Diagnostic Metrics Matrix */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                          <div className="text-zinc-400 text-[10px] mb-1">CPU Load</div>
                          <div className="font-bold text-white font-mono text-sm">{(serverRealtimeMetrics?.cpuPercent || 0).toFixed(1)}%</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{serverDetails.cpuLimitCores || 2} Cores</div>
                        </div>

                        <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                          <div className="text-zinc-400 text-[10px] mb-1">Memory</div>
                          <div className="font-bold text-white font-mono text-sm">{serverRealtimeMetrics?.memoryUsedFormatted || '0.00 GB'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">/ {serverDetails.memoryLimitGb || 4} GB</div>
                        </div>

                        <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                          <div className="text-zinc-400 text-[10px] mb-1">Network RX</div>
                          <div className="font-bold text-purple-300 font-mono text-sm">{serverRealtimeMetrics?.network?.rxRateFormatted || '0 KB/s'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Total: {serverRealtimeMetrics?.network?.rxTotalFormatted || '0 KB'}</div>
                        </div>

                        <div className="p-3 bg-black/40 border border-white/5 rounded-2xl">
                          <div className="text-zinc-400 text-[10px] mb-1">Network TX</div>
                          <div className="font-bold text-indigo-400 font-mono text-sm">{serverRealtimeMetrics?.network?.txRateFormatted || '0 KB/s'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Total: {serverRealtimeMetrics?.network?.txTotalFormatted || '0 KB'}</div>
                        </div>
                      </div>

                      {/* Active Performance Warnings / Alerts if any */}
                      {serverRealtimeMetrics?.performance?.activeAlerts && serverRealtimeMetrics.performance.activeAlerts.length > 0 && (
                        <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-1">
                          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-amber-400" /> Active Performance Alerts
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-amber-200">
                            {serverRealtimeMetrics.performance.activeAlerts.map((alert: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-black/40 border border-amber-500/20 font-mono text-[11px]">
                                {alert}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: FILE MANAGER */}
                {selectedServerTab === 'files' && (
                  <FileManager
                    serverId={serverDetails.id}
                    token={token!}
                    diskUsedFormatted={serverRealtimeMetrics?.diskUsedFormatted || serverDetails?.diskUsedFormatted}
                    diskLimitGb={serverDetails?.diskLimitGb || 15}
                    onStorageChange={refreshServerStorageStats}
                  />
                )}

                {/* TAB 3: PLUGIN / MOD MANAGER (MODRINTH) */}
                {selectedServerTab === 'plugins' && (
                  isModded(serverDetails.software) ? (
                    <ModManager
                      serverId={serverDetails.id}
                      token={token!}
                      software={serverDetails.software}
                      mcVersion={serverDetails.version}
                    />
                  ) : (
                    <PluginManager
                      serverId={serverDetails.id}
                      token={token!}
                      software={serverDetails.software}
                      mcVersion={serverDetails.version}
                    />
                  )
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

                {/* TAB 7: CONFIG EDITOR */}
                {selectedServerTab === 'properties' && (
                  <ConfigEditor
                    serverId={serverDetails.id}
                    token={token!}
                    showToast={showToast}
                    onSaved={loadProperties}
                  />
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

                    {/* CONNECTED INFRASTRUCTURE STACK (Requirements #3 & #7) */}
                    <div className="p-4 bg-black/40 border border-purple-500/20 rounded-2xl space-y-3">
                      <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-400" /> Connected Infrastructure Stack
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
                          <div className="text-[10px] text-zinc-400 font-mono uppercase">Java Runtime</div>
                          <div className="font-bold text-white flex items-center gap-1">
                            <span>OpenJDK {serverDetails.javaVersion || '21'}</span>
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">/usr/lib/jvm/java-{serverDetails.javaVersion || '21'}-openjdk</div>
                        </div>
                        <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
                          <div className="text-[10px] text-zinc-400 font-mono uppercase">Docker Container</div>
                          <div className="font-bold text-purple-300 font-mono truncate">mc-server-{serverDetails.id.slice(0, 8)}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Image: eclipse-temurin:{serverDetails.javaVersion || '21'}-jre</div>
                        </div>
                        <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-1">
                          <div className="text-[10px] text-zinc-400 font-mono uppercase">Port Allocation</div>
                          <div className="font-bold text-emerald-400 font-mono">127.0.0.1:{serverDetails.primaryPort || 25565}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Protocol: TCP/UDP Minecraft</div>
                        </div>
                      </div>
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
                    {/* DASHBOARD HERO BANNER (Brighter Arix V2 Style) */}
                    <div className="relative rounded-3xl glass-panel overflow-hidden shadow-2xl p-6 sm:p-8 border border-purple-500/25 bg-gradient-to-br from-purple-950/25 via-black/25 to-black/35">
                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Welcome to Craft Command Center
                          </h1>
                          <p className="text-xs sm:text-sm text-zinc-200 mt-1 max-w-xl leading-relaxed">
                            Deploy and govern dedicated Minecraft server instances with official Paper binaries, Java 21 LTS, and real-time container metrics.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowWizard(true);
                            setWizardStep(1);
                          }}
                          className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl shadow-lg border border-purple-400/30 transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap self-start md:self-auto"
                        >
                          <Plus className="w-4 h-4" />
                          <span>CREATE SERVER</span>
                        </button>
                      </div>

                      {/* Real-time Hardware Telemetry Bar */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-purple-500/20">
                        {/* Total Servers */}
                        <div className="p-4 bg-purple-950/25 border border-purple-500/25 rounded-2xl shadow-lg hover:border-purple-400/40 transition-all">
                          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                            <span>Active Servers</span>
                            <ServerIcon className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {servers.length} <span className="text-xs font-normal text-zinc-300">instances</span>
                          </div>
                        </div>

                        {/* Host Memory */}
                        <div className="p-4 bg-indigo-950/25 border border-indigo-500/25 rounded-2xl shadow-lg hover:border-indigo-400/40 transition-all">
                          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                            <span>Allocated RAM</span>
                            <HardDrive className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {totalMemoryLimit} GB <span className="text-xs font-normal text-zinc-300">/ 128 GB</span>
                          </div>
                        </div>

                        {/* CPU Cores */}
                        <div className="p-4 bg-emerald-950/25 border border-emerald-500/25 rounded-2xl shadow-lg hover:border-emerald-400/40 transition-all">
                          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                            <span>Host Threads</span>
                            <Cpu className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            32 Cores <span className="text-xs font-normal text-zinc-300">5.7 GHz</span>
                          </div>
                        </div>

                        {/* Storage */}
                        <div className="p-4 bg-fuchsia-950/25 border border-fuchsia-500/25 rounded-2xl shadow-lg hover:border-fuchsia-400/40 transition-all">
                          <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
                            <span>Storage Capacity</span>
                            <Activity className="w-4 h-4 text-fuchsia-400" />
                          </div>
                          <div className="text-xl font-bold text-white font-mono tabular-nums">
                            {totalDiskLimit} GB <span className="text-xs font-normal text-zinc-300">NVMe Pool</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* YOUR SERVERS HEADER */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                          <span>Your Minecraft Servers</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-purple-950 border border-purple-400/50 text-purple-100 font-bold font-mono shadow-sm">
                            {servers.length} Total
                          </span>
                        </h2>
                        <p className="text-xs text-zinc-200 font-medium mt-0.5">Live overview of your gaming instances and runtime health</p>
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
                            isSelected={selectedServerId === server.id}
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

                {/* ADMIN DASHBOARD VIEW */}
                {activeTab === 'admin-dashboard' && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-4 shadow-xl relative overflow-hidden">
                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <LayoutDashboard className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold uppercase tracking-wider font-mono">
                                Master Admin Control
                              </span>
                              <span className="text-xs text-zinc-400">· System Metrics</span>
                            </div>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight">System Administrative Dashboard</h1>
                            <p className="text-xs text-zinc-300 mt-0.5">Real-time infrastructure overview, server fleet health, and user metrics</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setShowThemeModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                            title="Configure Panel Theme & Background Wallpaper"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-purple-300" />
                            <span>Theme & Wallpaper</span>
                          </button>
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            HOST ONLINE
                          </span>
                        </div>
                      </div>

                      {/* Real System Telemetry Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 border-t border-white/10">
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-1">
                          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                            <span>Total Servers</span>
                            <ServerIcon className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          <div className="text-2xl font-bold text-white font-mono">{servers.length}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {servers.filter(s => s.status === 'Running').length} Running · {servers.filter(s => s.status !== 'Running').length} Stopped
                          </div>
                        </div>

                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-1">
                          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                            <span>User Accounts</span>
                            <Users className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          <div className="text-2xl font-bold text-white font-mono">{usersList.length}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {usersList.filter(u => u.role === 'Owner' || u.role === 'Administrator').length} Administrators
                          </div>
                        </div>

                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-1">
                          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                            <span>Allocated RAM</span>
                            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                          <div className="text-2xl font-bold text-white font-mono">{totalMemoryLimit} GB</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Configured Limits Sum</div>
                        </div>

                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-1">
                          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                            <span>Allocated CPU</span>
                            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="text-2xl font-bold text-white font-mono">{totalCpuLimit} Cores</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Host Thread Reservations</div>
                        </div>

                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-1">
                          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                            <span>Storage Pool</span>
                            <Activity className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div className="text-2xl font-bold text-white font-mono">{totalDiskLimit} GB</div>
                          <div className="text-[10px] text-zinc-500 font-mono">Disk Pool Reservations</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Admin Actions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div
                        onClick={() => setActiveTab('admin-servers')}
                        className="p-5 rounded-3xl glass-panel border border-white/5 hover:border-purple-500/40 cursor-pointer transition-all space-y-2 group shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
                            <ServerIcon className="w-5 h-5" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Admin Servers & Deletion</h3>
                        <p className="text-xs text-zinc-400">View full server registry, lifecycle controls, and permanent server deletion tools.</p>
                      </div>

                      <div
                        onClick={() => setActiveTab('users')}
                        className="p-5 rounded-3xl glass-panel border border-white/5 hover:border-purple-500/40 cursor-pointer transition-all space-y-2 group shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
                            <Users className="w-5 h-5" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Users & Role Access (RBAC)</h3>
                        <p className="text-xs text-zinc-400">Manage administrator accounts, staff roles, and operator security permissions.</p>
                      </div>

                      <div
                        onClick={() => setActiveTab('java')}
                        className="p-5 rounded-3xl glass-panel border border-white/5 hover:border-purple-500/40 cursor-pointer transition-all space-y-2 group shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
                            <Cpu className="w-5 h-5" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Java Runtimes (17, 21, 25)</h3>
                        <p className="text-xs text-zinc-400">Manage OpenJDK binaries, verify signatures, install new versions, and monitor JVM health.</p>
                      </div>

                      <div
                        onClick={() => setActiveTab('audit')}
                        className="p-5 rounded-3xl glass-panel border border-white/5 hover:border-purple-500/40 cursor-pointer transition-all space-y-2 group shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-105 transition">
                            <Clock className="w-5 h-5" />
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Audit Logs & Security Feed</h3>
                        <p className="text-xs text-zinc-400">Inspect real timestamped operational audit records and server deletion events.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ADMIN SERVERS PAGE (SINGLE EXCLUSIVE PLACE FOR SERVER DELETION) */}
                {activeTab === 'admin-servers' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-5 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <ServerIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Admin Servers & Fleet Management</h2>
                            <p className="text-xs text-zinc-400">Authorized master server list, power controls, and exclusive permanent server deletion</p>
                          </div>
                        </div>

                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search servers..."
                              value={adminServerSearch}
                              onChange={(e) => setAdminServerSearch(e.target.value)}
                              className="pl-8 pr-3 py-1.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 w-44 sm:w-56 focus:outline-none"
                            />
                          </div>
                          <select
                            value={adminServerStatusFilter}
                            onChange={(e) => setAdminServerStatusFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs glass-input rounded-xl text-white focus:outline-none"
                          >
                            <option value="all">All Statuses</option>
                            <option value="running">Running</option>
                            <option value="offline">Offline / Stopped</option>
                          </select>
                        </div>
                      </div>

                      {/* Servers List / Matrix Table */}
                      <div className="divide-y divide-white/5 pt-2">
                        {servers
                          .filter((s) => {
                            const q = adminServerSearch.toLowerCase();
                            const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q) || s.software?.toLowerCase().includes(q) || s.version?.toLowerCase().includes(q);
                            const matchStatus = adminServerStatusFilter === 'all' || (adminServerStatusFilter === 'running' ? s.status === 'Running' : s.status !== 'Running');
                            return matchSearch && matchStatus;
                          })
                          .map((s) => {
                            const isRunning = s.status === 'Running';
                            return (
                              <div key={s.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/5 px-3 rounded-2xl transition">
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                                    <ServerIcon className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-bold text-white truncate">{s.name}</span>
                                      <span className={`px-2 py-0.2 text-[10px] rounded-md font-mono font-semibold ${isRunning ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
                                        {s.status || 'Offline'}
                                      </span>
                                      <span className="text-[11px] font-mono text-purple-300 bg-purple-950/40 px-2 py-0.2 rounded border border-purple-500/20">
                                        Owner: {user?.username || 'admin'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 font-mono mt-1 flex flex-wrap items-center gap-2">
                                      <span>Engine: {s.software || 'Paper'} v{s.version || '1.21.1'}</span>
                                      <span>•</span>
                                      <span>Java {s.javaVersion || '21'}</span>
                                      <span>•</span>
                                      <span>CPU: {s.cpuLimitCores || 2} Cores</span>
                                      <span>•</span>
                                      <span>RAM: {s.memoryLimitGb || 4} GB</span>
                                      <span>•</span>
                                      <span>Port: {s.primaryPort || 25565}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions: View, Manage, Stop/Restart, DELETE */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedServerId(s.id);
                                      setSelectedServerTab('console');
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 rounded-xl transition"
                                  >
                                    Console
                                  </button>

                                  {isRunning ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => executeLifecycle(s.id, 'restart')}
                                        className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-xl transition"
                                        title="Restart Server"
                                      >
                                        <RotateCw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => executeLifecycle(s.id, 'stop')}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-sm transition"
                                      >
                                        Stop
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => executeLifecycle(s.id, 'start')}
                                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition"
                                    >
                                      Start
                                    </button>
                                  )}

                                  {/* THE EXCLUSIVE DELETE BUTTON (Requirement #4 & #17) */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirmModalServer(s);
                                      setDeleteTypedInput('');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 rounded-xl transition shadow-sm active:scale-95"
                                    title="Permanently Delete Server (Admin Area Only)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>DELETE</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'docker' && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="p-6 rounded-3xl glass-panel space-y-4 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Layers className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Docker Engine & Container Runtime</h2>
                            <p className="text-xs text-zinc-400">Low-level container process telemetry, socket isolation, and memory cgroups</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold self-start sm:self-auto font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          DAEMON READY
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-[11px] text-zinc-400 mb-1">Docker Socket Endpoint</div>
                          <div className="text-xs font-bold text-emerald-400 font-mono truncate">unix:///var/run/docker.sock</div>
                          <div className="text-[10px] text-zinc-500 mt-1">Direct IPC Bridge</div>
                        </div>
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-[11px] text-zinc-400 mb-1">Containers Running</div>
                          <div className="text-lg font-bold text-white font-mono">{servers.filter(s => s.status === 'Running').length} / {servers.length}</div>
                          <div className="text-[10px] text-zinc-500 mt-1">Active Isolated Sandbox</div>
                        </div>
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-[11px] text-zinc-400 mb-1">Base JRE Image</div>
                          <div className="text-xs font-bold text-purple-300 font-mono truncate">eclipse-temurin:21-jre</div>
                          <div className="text-[10px] text-zinc-500 mt-1">Official Adoptium Core</div>
                        </div>
                        <div className="p-4 bg-black/35 rounded-2xl border border-white/5">
                          <div className="text-[11px] text-zinc-400 mb-1">Host Virtualization</div>
                          <div className="text-xs font-bold text-indigo-300 font-mono">Linux x86_64 / cgroups v2</div>
                          <div className="text-[10px] text-zinc-500 mt-1">PID & Network Isolation</div>
                        </div>
                      </div>
                    </div>

                    {/* Container Fleet Table */}
                    <div className="p-6 rounded-3xl glass-panel space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <ServerIcon className="w-4 h-4 text-purple-400" /> Containerized Minecraft Instances
                      </h3>
                      {servers.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">No active container instances configured.</div>
                      ) : (
                        <div className="divide-y divide-white/5 overflow-x-auto">
                          {servers.map((s) => (
                            <div key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-[500px]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                                  <ServerIcon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white flex items-center gap-2">
                                    <span>{s.name}</span>
                                    <span className={`px-2 py-0.2 text-[10px] rounded-md font-mono ${s.status === 'Running' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
                                      {s.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                    Container: mc-server-{s.id.slice(0, 8)} · Port: {s.primaryPort || 25565} · Heap: {s.memoryLimitGb || 4} GB
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedServerId(s.id);
                                    setSelectedServerTab('console');
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl transition"
                                >
                                  Open Console
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PORT POOL VIEW */}
                {activeTab === 'nodes' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Globe className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Port Allocations & Network Matrix</h2>
                            <p className="text-xs text-zinc-400">Manage public network listener pool, game ports, and reverse proxy bindings</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300">
                            {allAllocations.filter(a => a.isAllocated).length} Bound
                          </span>
                          <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                            {allAllocations.filter(a => !a.isAllocated).length} Available
                          </span>
                        </div>
                      </div>

                      {/* Add Port Binding Form */}
                      <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-2 pt-4">
                        <div className="text-xs font-bold text-white">Register / Allocate Network Port</div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="number"
                            placeholder="Port (e.g. 25568)"
                            value={newPortNumber}
                            onChange={(e) => setNewPortNumber(e.target.value)}
                            className="px-3 py-2 text-xs glass-input rounded-xl text-white w-36 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Service Label (e.g. Bedrock Port, Dynmap, VoiceChat)"
                            value={newPortLabel}
                            onChange={(e) => setNewPortLabel(e.target.value)}
                            className="px-3 py-2 text-xs glass-input rounded-xl text-white flex-1 min-w-[200px]"
                          />
                          <button
                            type="button"
                            onClick={allocateExtraPort}
                            disabled={allocatingPort || !newPortNumber}
                            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl transition shadow-md"
                          >
                            + Add Port
                          </button>
                        </div>
                      </div>

                      {/* Allocations Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        {allAllocations.map((alloc) => (
                          <div
                            key={alloc.port}
                            className={`p-4 rounded-2xl border transition-all ${
                              alloc.isAllocated
                                ? 'bg-purple-950/30 border-purple-500/30'
                                : 'bg-black/30 border-white/5 hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold font-mono text-white">127.0.0.1:{alloc.port}</span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-mono rounded-md font-semibold ${
                                  alloc.isAllocated
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                }`}
                              >
                                {alloc.isAllocated ? 'BOUND' : 'AVAILABLE'}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-400 truncate">
                              {alloc.label || 'Default Allocation'}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-1 flex items-center justify-between">
                              <span>{alloc.isAllocated ? `Server: ${alloc.serverId?.slice(0, 8)}` : 'Unassigned Pool'}</span>
                              {alloc.isAllocated && (
                                <button
                                  type="button"
                                  onClick={() => releaseExtraPort(alloc.port)}
                                  className="text-rose-400 hover:text-rose-300 hover:underline"
                                >
                                  Release
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ADMIN NODE MANAGEMENT VIEW */}
                {activeTab === 'admin-nodes' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-6 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <ServerIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Virtualization Node Management</h2>
                            <p className="text-xs text-zinc-400">Add, configure, and monitor host virtualization server hardware clusters</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingNode(null);
                            setNodeForm({
                              name: '',
                              status: 'ONLINE',
                              description: 'Primary Minecraft hosting node',
                              location: 'India',
                              country: 'India',
                              ipAddress: '125.16.24.110',
                              port: 8080,
                              maxMemoryGb: 32,
                              maxCpuCores: 8,
                              maxDiskGb: 200,
                              daemonStatus: 'Connected'
                            });
                            setShowCreateNodeModal(!showCreateNodeModal);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition self-start sm:self-auto cursor-pointer font-mono"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{showCreateNodeModal && !editingNode ? 'Hide Form' : 'Register Host Node'}</span>
                        </button>
                      </div>

                      {/* Add/Edit Node Form */}
                      {showCreateNodeModal && (
                        <div className="p-5 bg-black/40 border border-purple-500/30 rounded-2xl space-y-4 shadow-lg">
                          <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                            <Sliders className="w-4 h-4" />
                            {editingNode ? `Edit Host Node (${editingNode.id})` : 'Register New Host Node'}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Node Name *</label>
                              <input
                                type="text"
                                placeholder="Node 01"
                                value={nodeForm.name}
                                onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Status</label>
                              <select
                                value={nodeForm.status}
                                onChange={(e) => setNodeForm({
                                  ...nodeForm,
                                  status: e.target.value as any,
                                  daemonStatus: e.target.value === 'OFFLINE' ? 'Unreachable' : 'Connected'
                                })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-white/5 text-white rounded-xl focus:outline-none"
                              >
                                <option value="ONLINE">ONLINE</option>
                                <option value="OFFLINE">OFFLINE</option>
                                <option value="MAINTENANCE">MAINTENANCE</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Location (Default: India)</label>
                              <input
                                type="text"
                                placeholder="India"
                                value={nodeForm.location}
                                onChange={(e) => setNodeForm({ ...nodeForm, location: e.target.value })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Country</label>
                              <input
                                type="text"
                                placeholder="India"
                                value={nodeForm.country}
                                onChange={(e) => setNodeForm({ ...nodeForm, country: e.target.value })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Hostname / IP</label>
                              <input
                                type="text"
                                placeholder="125.16.24.110"
                                value={nodeForm.ipAddress}
                                onChange={(e) => setNodeForm({ ...nodeForm, ipAddress: e.target.value })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Daemon Port</label>
                              <input
                                type="number"
                                placeholder="8080"
                                value={nodeForm.port}
                                onChange={(e) => setNodeForm({ ...nodeForm, port: Number(e.target.value) })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Daemon Heartbeat State</label>
                              <select
                                value={nodeForm.daemonStatus}
                                onChange={(e) => setNodeForm({ ...nodeForm, daemonStatus: e.target.value as any })}
                                className="w-full px-3 py-2 bg-zinc-950 border border-white/5 text-white rounded-xl focus:outline-none"
                              >
                                <option value="Connected">Connected (Healthy)</option>
                                <option value="Unreachable">Unreachable (Offline)</option>
                                <option value="Degraded">Degraded (High Latency)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">RAM Capacity (GB)</label>
                              <input
                                type="number"
                                placeholder="32"
                                value={nodeForm.maxMemoryGb}
                                onChange={(e) => setNodeForm({ ...nodeForm, maxMemoryGb: Number(e.target.value) })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">CPU Cores Capacity</label>
                              <input
                                type="number"
                                placeholder="16"
                                value={nodeForm.maxCpuCores}
                                onChange={(e) => setNodeForm({ ...nodeForm, maxCpuCores: Number(e.target.value) })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">NVMe SSD Capacity (GB)</label>
                              <input
                                type="number"
                                placeholder="500"
                                value={nodeForm.maxDiskGb}
                                onChange={(e) => setNodeForm({ ...nodeForm, maxDiskGb: Number(e.target.value) })}
                                className="w-full px-3 py-2 glass-input rounded-xl text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Description</label>
                            <input
                              type="text"
                              placeholder="Primary Minecraft hosting node with NVMe storage and dedicated gigabit uplink."
                              value={nodeForm.description}
                              onChange={(e) => setNodeForm({ ...nodeForm, description: e.target.value })}
                              className="w-full px-3 py-2.5 glass-input rounded-xl text-white placeholder-zinc-700 focus:outline-none"
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreateNodeModal(false);
                                setEditingNode(null);
                              }}
                              className="px-4 py-2 text-xs font-bold text-zinc-400 bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer font-mono"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveAdminNode}
                              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-md cursor-pointer font-mono"
                            >
                              {editingNode ? 'Update Node' : 'Register Node'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Nodes List */}
                      {loadingAdminNodes ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                          <span className="text-xs font-mono text-zinc-400">Loading cluster matrix...</span>
                        </div>
                      ) : adminNodes.length === 0 ? (
                        <div className="text-center py-12 border border-white/5 rounded-2xl bg-black/20 text-zinc-500 font-mono text-xs">
                          No host virtualization nodes registered yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {adminNodes.map((node) => {
                            const isOnline = node.status === 'ONLINE';
                            const isMaintenance = node.status === 'MAINTENANCE';

                            let statusColor = "text-emerald-400";
                            let statusBg = "bg-emerald-500/10 border-emerald-500/20";
                            let statusDot = "bg-emerald-400";

                            if (isMaintenance) {
                              statusColor = "text-amber-400";
                              statusBg = "bg-amber-500/10 border-amber-500/20";
                              statusDot = "bg-amber-400 animate-pulse";
                            } else if (!isOnline) {
                              statusColor = "text-rose-400";
                              statusBg = "bg-rose-950/40 border-rose-500/30";
                              statusDot = "bg-rose-500";
                            }

                            const daemonColor = node.daemonStatus === 'Connected'
                              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                              : node.daemonStatus === 'Degraded'
                              ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                              : 'text-rose-300 bg-rose-500/10 border-rose-500/20';

                            return (
                              <div
                                key={node.id}
                                className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between h-full relative"
                              >
                                <div>
                                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                                      <span className="text-sm font-bold text-white font-mono">{node.name}</span>
                                      <span className="text-[10px] font-mono text-zinc-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                        {node.id}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${statusBg} ${statusColor}`}>
                                        ● {node.status}
                                      </span>
                                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${daemonColor}`}>
                                        Daemon: {node.daemonStatus || 'Connected'}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                                    {node.description || 'Primary Minecraft hosting node'}
                                  </p>

                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono text-zinc-400 mb-4 bg-black/30 p-3.5 rounded-xl border border-white/5">
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Location:</span>
                                      <span className="text-white font-semibold">{node.location || 'India'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Country:</span>
                                      <span className="text-zinc-300 font-semibold">{node.country || 'India'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Hostname/IP:</span>
                                      <span className="text-purple-300 font-semibold truncate">{node.ipAddress || '125.16.24.110'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Port:</span>
                                      <span className="text-emerald-400 font-semibold">:{node.port || 8080}</span>
                                    </div>
                                    <div className="flex justify-between mt-1 col-span-2 text-[10px] border-t border-white/5 pt-1.5">
                                      <span className="text-zinc-500">RAM:</span>
                                      <span className="text-purple-300 font-semibold">
                                        {node.allocatedMemoryGb || 0} GB / {node.maxMemoryGb || 32} GB
                                      </span>
                                    </div>
                                    <div className="flex justify-between col-span-2 text-[10px]">
                                      <span className="text-zinc-500">CPU:</span>
                                      <span className="text-indigo-300 font-semibold">
                                        {node.allocatedCpuCores || 0} / {node.maxCpuCores || 16} cores
                                      </span>
                                    </div>
                                    <div className="flex justify-between col-span-2 text-[10px]">
                                      <span className="text-zinc-500">Disk:</span>
                                      <span className="text-emerald-300 font-semibold">
                                        {node.allocatedDiskGb || 0} GB / {node.maxDiskGb || 500} GB
                                      </span>
                                    </div>
                                    <div className="flex justify-between col-span-2 text-[10px] border-t border-white/5 pt-1 text-zinc-500">
                                      <span>Last Heartbeat:</span>
                                      <span className="text-zinc-400">
                                        {node.lastHeartbeat ? (
                                          new Date(node.lastHeartbeat).toLocaleTimeString()
                                        ) : 'Real-time (Active)'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end mt-auto pt-2 border-t border-white/5 font-mono">
                                  <button
                                    type="button"
                                    onClick={() => pingAdminNode(node.id)}
                                    className="px-3 py-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition cursor-pointer flex items-center gap-1"
                                    title="Ping node daemon"
                                  >
                                    <Activity className="w-3 h-3" />
                                    <span>Ping</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNode(node);
                                      setNodeForm({
                                        name: node.name,
                                        status: node.status,
                                        description: node.description || '',
                                        location: node.location || 'India',
                                        country: node.country || 'India',
                                        ipAddress: node.ipAddress || '125.16.24.110',
                                        port: node.port || 8080,
                                        maxMemoryGb: node.maxMemoryGb || 32,
                                        maxCpuCores: node.maxCpuCores || 8,
                                        maxDiskGb: node.maxDiskGb || 200,
                                        daemonStatus: node.daemonStatus || 'Connected'
                                      });
                                      setShowCreateNodeModal(true);
                                    }}
                                    className="px-3 py-1.5 text-[11px] font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition cursor-pointer"
                                  >
                                    Edit Node
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteAdminNode(node.id)}
                                    className="px-3 py-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* USERS & ACCESS VIEW */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-6 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Users className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Users & Role-Based Access (RBAC)</h2>
                            <p className="text-xs text-zinc-400">Manage administrator accounts, staff roles, and operator security keys</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCreateUserModal(!showCreateUserModal)}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition self-start sm:self-auto"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{showCreateUserModal ? 'Hide Form' : 'Add New User'}</span>
                        </button>
                      </div>

                      {/* Add User Collapsible Form */}
                      {showCreateUserModal && (
                        <form onSubmit={handleCreateUser} className="p-5 bg-black/40 border border-purple-500/30 rounded-2xl space-y-4 shadow-lg">
                          <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4" /> Provision New Panel User Account
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-zinc-300 mb-1 block">Username</label>
                              <input
                                type="text"
                                placeholder="e.g. operator_alex"
                                value={newUserData.username}
                                onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                                className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-zinc-300 mb-1 block">Password</label>
                              <input
                                type="password"
                                placeholder="Secure password"
                                value={newUserData.password}
                                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-zinc-300 mb-1 block">Role Permissions</label>
                              <select
                                value={newUserData.role}
                                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white"
                              >
                                <option value="Administrator">Administrator (Full Access)</option>
                                <option value="Moderator">Moderator (Start/Stop/Console)</option>
                                <option value="User">User (View Only)</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowCreateUserModal(false)}
                              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900/60 rounded-xl"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition"
                            >
                              Create Account
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Users Table / Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                        {usersList.map((u) => {
                          const isCurrentUser = user?.id === u.id || user?.username === u.username;
                          const roleColor = u.role === 'Owner'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : u.role === 'Administrator'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : u.role === 'Moderator'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-white/5';

                          return (
                            <div key={u.id} className="p-4 rounded-2xl glass-panel border border-white/5 flex flex-col justify-between space-y-3 shadow-md">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-500/30 flex items-center justify-center text-white font-bold text-sm uppercase shrink-0">
                                    {u.username.slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                                      <span>{u.username}</span>
                                      {isCurrentUser && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono">
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono truncate">{u.id}</div>
                                  </div>
                                </div>
                                <span className={`px-2.5 py-0.5 text-[10px] font-mono rounded-lg border font-semibold shrink-0 ${roleColor}`}>
                                  {u.role}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                                <span className="text-[10px] font-mono">
                                  Created: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Initial'}
                                </span>
                                {!isCurrentUser && u.role !== 'Owner' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                                    title="Delete User Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* AUDIT LOGS VIEW */}
                {activeTab === 'audit' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl glass-panel space-y-4 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Security & Operational Audit Feed</h2>
                            <p className="text-xs text-zinc-400">Cryptographically verifiable, timestamped operational audit logs and admin dispatches</p>
                          </div>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search audit logs..."
                              value={auditSearch}
                              onChange={(e) => setAuditSearch(e.target.value)}
                              className="pl-8 pr-3 py-1.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 w-48 sm:w-64 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Category Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        {['all', 'Lifecycle', 'Server', 'User', 'Backup', 'Plugin', 'Schedule'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAuditCategory(cat.toLowerCase())}
                            className={`px-3 py-1 text-xs rounded-xl font-medium transition ${
                              auditCategory === cat.toLowerCase()
                                ? 'bg-purple-600 text-white font-semibold'
                                : 'bg-black/30 hover:bg-white/5 text-zinc-400 border border-white/5'
                            }`}
                          >
                            {cat === 'all' ? 'All Events' : cat}
                          </button>
                        ))}
                      </div>

                      {/* Audit Events List */}
                      <div className="divide-y divide-white/5 pt-2 font-mono text-xs">
                        {auditLogs
                          .filter((log) => {
                            const q = auditSearch.toLowerCase();
                            const matchSearch = !q || log.action?.toLowerCase().includes(q) || log.details?.toLowerCase().includes(q) || log.username?.toLowerCase().includes(q);
                            const matchCat = auditCategory === 'all' || log.action?.toLowerCase().includes(auditCategory);
                            return matchSearch && matchCat;
                          })
                          .map((log) => (
                            <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/5 px-2 rounded-xl transition">
                              <div className="flex items-start sm:items-center gap-3">
                                <span className="px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-500/30 font-semibold text-[11px] shrink-0">
                                  {log.action}
                                </span>
                                <span className="text-zinc-200 text-xs font-sans">{log.details}</span>
                              </div>
                              <div className="text-zinc-400 text-[11px] shrink-0 flex items-center gap-2">
                                <span className="text-purple-300">@{log.username}</span>
                                <span>·</span>
                                <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
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
                  }} onViewServers={() => setActiveTab('admin-servers')} />
                )}

                {/* NGINX PROXIES VIEW (Admin Infrastructure) */}
                {activeTab === 'nginx-proxies' && (
                  <div className="p-6 rounded-3xl glass-panel space-y-5 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Nginx Reverse Proxy & Custom Domains</h2>
                        <p className="text-xs text-zinc-400">Manage proxy rules, domain bindings, and SSL routing for Minecraft servers</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
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
                        className="px-3 py-2 text-xs glass-input rounded-xl text-white w-28 font-mono"
                      />
                      <button
                        onClick={createProxy}
                        className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition"
                      >
                        Add Proxy
                      </button>
                    </div>

                    <div className="divide-y divide-white/5 pt-2">
                      {proxies.length === 0 ? (
                        <div className="py-8 text-center text-zinc-500 text-xs">No active reverse proxies configured.</div>
                      ) : (
                        proxies.map((p) => (
                          <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                            <span className="font-semibold text-white font-mono">{p.domainName} -&gt; :{p.targetPort}</span>
                            <button onClick={() => deleteProxy(p.id)} className="text-rose-400 hover:text-rose-300 font-semibold">Delete</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
      <CreateServerWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        token={token || ''}
        servers={servers}
        allAllocations={allAllocations}
        showToast={showToast}
        onDeploySuccess={async (newId) => {
          try {
            const srvRes = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
            if (srvRes.ok) {
              setServers(await srvRes.json());
            }
          } catch {}
          setSelectedServerId(newId);
          setSelectedServerTab('console');
          setActiveTab('servers');
          setShowWizard(false);
        }}
      />

      {/* THEME MODAL */}
      <ThemeModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        settings={bgSettings}
        onUpdate={updateBgSettings}
        onReset={resetBgSettings}
      />

      {/* REAL SERIOUS DELETE SERVER CONFIRMATION MODAL (Admin Area Only) */}
      {deleteConfirmModalServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
          <div className="relative w-full max-w-lg glass-modal rounded-3xl p-6 sm:p-7 shadow-2xl border border-rose-500/30 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-rose-400">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Server?</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">Irreversible Action Warning</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmModalServer(null);
                  setDeleteTypedInput('');
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl">
                <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Server Name</div>
                <div className="text-sm font-bold text-white mt-0.5">{deleteConfirmModalServer.name}</div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">ID: {deleteConfirmModalServer.id}</div>
              </div>

              <div className="p-3.5 bg-rose-950/30 border border-rose-500/20 rounded-2xl space-y-2 text-xs text-rose-200">
                <p className="font-semibold text-rose-300">This action will permanently remove:</p>
                <ul className="space-y-1 pl-4 list-disc text-[11px] text-zinc-300">
                  <li>Minecraft server files</li>
                  <li>Docker container</li>
                  <li>server configuration</li>
                  <li>allocations</li>
                  <li>server database records</li>
                  <li>logs if configured for deletion</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteTypedInput}
                  onChange={(e) => setDeleteTypedInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white font-mono placeholder-zinc-500 border border-white/10 focus:border-rose-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmModalServer(null);
                  setDeleteTypedInput('');
                }}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteTypedInput !== 'DELETE' || deletingInAdmin}
                onClick={handleAdminDeleteServer}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 rounded-xl shadow-lg shadow-rose-950/50 transition active:scale-95"
              >
                {deletingInAdmin ? 'Deleting Server...' : 'Delete Server Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
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
            className={`pointer-events-auto px-4 py-3 rounded-2xl border text-xs font-medium shadow-2xl flex items-center gap-2 animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950 border-rose-500/40 text-rose-200'
                : 'bg-[#150f33] border-purple-500/30 text-zinc-200'
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
