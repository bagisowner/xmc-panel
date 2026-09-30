import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon, FolderOpen, Users, Archive, Calendar, Globe, LineChart, HardDrive,
  Settings, Activity, Plus, Search, Power, Play, Square, RotateCw, Trash2, Edit2,
  Save, Undo, Check, FileText, ChevronRight, ChevronLeft, Menu, X, Lock, User, Grid, Cpu, Layers,
  Wifi, UserX, AlertCircle, Eye, LogOut, Command, ShieldAlert, KeyRound, ArrowRight,
  RefreshCw, FolderPlus, FilePlus, EyeOff, Sliders, Network, Boxes, HelpCircle,
  FileCode, Database, CheckSquare, Clock, Upload, Volume2, VolumeX, AlertTriangle,
  Image as ImageIcon, Server as ServerIcon, Shield, Smartphone, ChevronDown, Filter,
  RotateCcw, LayoutDashboard, Download, Hammer
} from 'lucide-react';
import { sounds } from './utils/sound';
import { BackgroundSystem, BackgroundSettings, DEFAULT_BACKGROUND_SETTINGS, WALLPAPER_PRESET_OPTIONS } from './components/BackgroundSystem';
import { ThemeModal } from './components/ThemeModal';
import { AuthCard } from './components/AuthCard';
import { ServerCard } from './components/ServerCard';
import { ServerHero } from './components/ServerHero';
import { PluginManager } from './components/PluginManager';
import { ModManager } from './components/ModManager';
import { JavaRuntimeManager } from './components/JavaRuntimeManager';
import { FileManager } from './components/FileManager';
import { CreateServerWizard } from './components/CreateServerWizard';
import { ConfigEditor } from './components/ConfigEditor';
import { AdminPanel } from './components/AdminPanel';
import { LoadingScreen } from './components/LoadingScreen';
import { ConsoleViewer } from './components/ConsoleViewer';
import { BackupManager } from './components/BackupManager';
import { SchedulesManager } from './components/SchedulesManager';
import { PortsManager } from './components/PortsManager';
import { StartupSettingsManager } from './components/StartupSettingsManager';
import { NginxProxiesManager } from './components/NginxProxiesManager';
import { PlayersManager } from './components/PlayersManager';
import { ServerDashboard } from './components/ServerDashboard';
import { AdminUsers } from './components/admin/AdminUsers';
import { initGlobalTouchSystem } from './utils/touchSystem';
import { NavigationService, RouteState } from './services/NavigationService';
import { StorageService } from './services/StorageService';

const API_BASE = '/api';
const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws';

export default function App() {
  const storageService = StorageService.getInstance();
  const [customLogosMap, setCustomLogosMap] = useState<Record<string, string>>({});

  // Layout & Navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [panelBrandName, setPanelBrandName] = useState<string>('Xorvila');
  const [panelBrandLogo, setPanelBrandLogo] = useState<string>('');
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);

  // Initial load: Fetch system branding, user preferences, and run safe legacy migration
  useEffect(() => {
    initGlobalTouchSystem();
    
    // 1. Fetch system branding settings
    storageService.getSystemSettings().then(data => {
      if (data && typeof data === 'object') {
        if (data.brandName) setPanelBrandName(data.brandName);
        if (data.brandLogo !== undefined) setPanelBrandLogo(data.brandLogo);
        if (data.customLogos) setCustomLogosMap(data.customLogos);
        if (data.bgSettings) setBgSettings(data.bgSettings);
        else if (data.theme) setBgSettings(data.theme);
      }
    });

    const handleSystemSettingsUpdate = (e: any) => {
      const detail = e.detail;
      if (detail && typeof detail === 'object') {
        if (detail.panelBrandName) setPanelBrandName(detail.panelBrandName);
        if (detail.panelBrandLogo !== undefined) setPanelBrandLogo(detail.panelBrandLogo);
        if (detail.bgSettings) setBgSettings(detail.bgSettings);
        else if (detail.theme) setBgSettings(detail.theme);
        setCustomLogosMap(prev => ({ ...prev, ...detail }));
      }
    };
    window.addEventListener('system_settings_updated', handleSystemSettingsUpdate);
    return () => window.removeEventListener('system_settings_updated', handleSystemSettingsUpdate);
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
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; username: string; role: string; permissions: string[] } | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Registration States
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{ checked: boolean; taken: boolean; message?: string }>({ checked: false, taken: false });
  const [emailAvailability, setEmailAvailability] = useState<{ checked: boolean; taken: boolean; message?: string }>({ checked: false, taken: false });

  // Safe migration and user settings synchronization
  useEffect(() => {
    storageService.migrateLegacyLocalStorage(token);

    if (token) {
      storageService.getUserSettings(token).then(data => {
        if (data && typeof data === 'object') {
          if (data.theme && Object.keys(data.theme).length > 0) {
            setBgSettings(prev => ({ ...prev, ...data.theme }));
          }
          if (data.sidebarCollapsed !== undefined) {
            setSidebarCollapsed(data.sidebarCollapsed);
          }
        }
      });
    }
  }, [token]);

  // Background & Theme Customization (10 Settings Matrix) - 8K Custom Theme
  const [showThemeModal, setShowThemeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateBgSettings = (updated: Partial<BackgroundSettings>) => {
    setBgSettings(prev => {
      const next = { ...prev, ...updated };
      storageService.updateUserSettings({ theme: next }, token);
      storageService.updateSystemSettings({ bgSettings: next, theme: next }, token);
      window.dispatchEvent(new CustomEvent('system_settings_updated', { detail: { bgSettings: next, theme: next } }));
      return next;
    });
  };

  const resetBgSettings = () => {
    setBgSettings(DEFAULT_BACKGROUND_SETTINGS);
    storageService.updateUserSettings({ theme: DEFAULT_BACKGROUND_SETTINGS }, token);
    storageService.updateSystemSettings({ bgSettings: DEFAULT_BACKGROUND_SETTINGS, theme: DEFAULT_BACKGROUND_SETTINGS }, token);
    window.dispatchEvent(new CustomEvent('system_settings_updated', { detail: { bgSettings: DEFAULT_BACKGROUND_SETTINGS, theme: DEFAULT_BACKGROUND_SETTINGS } }));
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

  const handleUpdateBrandName = (name: string) => {
    setPanelBrandName(name);
    storageService.updateSystemSettings({ brandName: name }, token);
  };

  const handleUpdateBrandLogo = (logo: string) => {
    setPanelBrandLogo(logo);
    storageService.updateSystemSettings({ brandLogo: logo }, token);
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      storageService.updateUserSettings({ sidebarCollapsed: next }, token);
      return next;
    });
  };

  const navService = NavigationService.getInstance();
  const initialRoute = navService.getRoute();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<any>(initialRoute.tab);
  const [selectedServerId, setSelectedServerIdState] = useState<string | null>(initialRoute.serverId);
  const [selectedServerTab, setSelectedServerTabState] = useState<any>(initialRoute.serverTab);

  const mainContentRef = useRef<HTMLElement | null>(null);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);

  const handleBrandLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleUpdateBrandLogo(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab, selectedServerId]);

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

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStepText, setBackupStepText] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [newSchedule, setNewSchedule] = useState({ name: '', cronExpression: '*/5 * * * *', action: 'backup' });
  const [players, setPlayers] = useState<any[]>([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', displayName: '', password: '', role: 'Administrator' });
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
    if (!u) {
      return !!token;
    }
    const username = String(u.username || '').toLowerCase().trim();
    const role = String(u.role || '').toLowerCase().trim();

    if (username === 'admin' || username === 'owner' || username === 'administrator') return true;
    if (role === 'admin' || role === 'administrator' || role === 'owner' || role === 'superuser') return true;
    if (Array.isArray(u.permissions) && (u.permissions.includes('admin') || u.permissions.includes('*') || u.permissions.includes('all'))) return true;

    return false;
  };

  const openAdminArea = () => {
    if (!isAdminUser(user)) {
      showToast('error', 'Access Denied: Administrator permissions required.');
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

  const safeFetchJson = async <T = any>(url: string, init?: RequestInit): Promise<T | null> => {
    try {
      const res = await fetch(url, init);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  // Fetch initial setup status and show loading animation
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const data = await safeFetchJson<{ setupNeeded: boolean }>(`${API_BASE}/auth/setup-status`);
        if (data && data.setupNeeded !== undefined) {
          setSetupNeeded(!!data.setupNeeded);
        }
      } catch (err) {
        showToast('error', 'Failed to connect to the panel backend.');
      } finally {
        setTimeout(() => {
          setIsAppLoading(false);
        }, 1200);
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
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              setUser(data.user);
              if (!token && data.sessionId) {
                setToken(data.sessionId);
              }
            }
          }
        } else if (res.status === 401 && token) {
          setUser(null);
          setToken(null);
        }
      } catch {
        // Do NOT destroy session token on network glitch or tab wake up
      }
    };
    fetchMe();
  }, [token]);

  // Periodic statistics loader
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        const hData = await safeFetchJson(`${API_BASE}/stats/host`, { headers: { Authorization: `Bearer ${token}` } });
        if (hData) {
          setHostStats(hData);
        }

        const sData = await safeFetchJson<any[]>(`${API_BASE}/servers`, { headers: { Authorization: `Bearer ${token}` } });
        if (Array.isArray(sData)) {
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

        const jData = await safeFetchJson<any[]>(`${API_BASE}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (Array.isArray(jData)) {
          setJobs(jData);
        }
      } catch {
        // Telemetry errors handled gracefully without logging unexpected HTML tokens
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [token, selectedServerId]);

  // Immediate serverDetails resolution upon selectedServerId change
  useEffect(() => {
    if (selectedServerId) {
      const match = servers.find((s: any) => s.id === selectedServerId);
      if (match) {
        setServerDetails(match);
      } else {
        fetch(`${API_BASE}/servers/${selectedServerId}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) setServerDetails(data);
          })
          .catch(() => {});
      }
    } else {
      setServerDetails(null);
    }
  }, [selectedServerId, servers, token]);

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

    // Immediately fetch existing log buffer over REST for instant rendering
    if (selectedServerId) {
      fetch(`${API_BASE}/servers/${selectedServerId}/logs`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!isUnmounted && data?.logs && Array.isArray(data.logs)) {
            setConsoleLogs(data.logs);
          }
        })
        .catch(() => {});
    }

    // Secondary log sync interval to ensure console logs stay updated for all users
    const logSyncInterval = setInterval(() => {
      if (isUnmounted || !selectedServerId) return;
      fetch(`${API_BASE}/servers/${selectedServerId}/logs`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!isUnmounted && data?.logs && Array.isArray(data.logs)) {
            setConsoleLogs(prev => {
              if (data.logs.length !== prev.length || (data.logs.length > 0 && prev.length === 0)) {
                return data.logs;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 2500);

    const connectConsoleWs = () => {
      if (isUnmounted || !selectedServerId) return;

      const wsToken = token || '';
      const wsUrl = `${WS_SCHEME}://${window.location.host}/api/servers/${selectedServerId}/console${wsToken ? `?token=${encodeURIComponent(wsToken)}` : ''}`;
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
        if (!isUnmounted && selectedServerId) {
          reconnectTimeout = setTimeout(connectConsoleWs, 2000);
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
      clearInterval(logSyncInterval);
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
        setToken(data.token);
        if (data.user) {
          setUser(data.user);
        }
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

  const checkFieldAvailability = async (field: 'username' | 'email', value: string) => {
    if (!value.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/auth/check-availability?${field}=${encodeURIComponent(value.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (field === 'username') {
          setUsernameAvailability({
            checked: true,
            taken: data.usernameTaken,
            message: data.usernameTaken ? 'Username is already taken' : 'Username is available'
          });
        } else {
          setEmailAvailability({
            checked: true,
            taken: data.emailTaken,
            message: data.emailTaken ? 'An account with this email already exists' : 'Email is available'
          });
        }
      }
    } catch {}
  };

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!termsAccepted) {
      setAuthError('You must agree to the Terms and Conditions to register.');
      return;
    }

    const cleanUsername = regUsername.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanUsername || !cleanEmail || !regPassword || !regConfirmPassword) {
      setAuthError('All fields (Username, Email, Password, Confirm Password) are required.');
      return;
    }

    if (cleanUsername.length < 3) {
      setAuthError('Username must be at least 3 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    if (regPassword.length < 7) {
      setAuthError('Password must be at least 7 characters long.');
      return;
    }

    if (!/[A-Z]/.test(regPassword)) {
      setAuthError('Password must contain at least 1 uppercase letter (A-Z).');
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword)) {
      setAuthError('Password must contain at least 1 special character (e.g. ! @ # $ %).');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setAuthError('Password and Confirm Password do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          password: regPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Account registered successfully! Redirecting to login...');
        setAuthSuccess('Account registered successfully! Please log in with your credentials.');
        setUsernameInput(cleanUsername);
        setPasswordInput('');
        setRegUsername('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setUsernameAvailability({ checked: false, taken: false });
        setEmailAvailability({ checked: false, taken: false });
        setTimeout(() => {
          setAuthMode('login');
          setAuthSuccess('');
        }, 1800);
      } else {
        setAuthError(data.error || 'Registration failed. Please check your inputs.');
      }
    } catch {
      setAuthError('Connection error during registration. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    navService.navigateToLogin();
    showToast('info', 'Secure session terminated.');
  };

  const promptLogout = () => {
    setConfirmModal({
      title: 'Log Out of Xorvila',
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
    setIsCreatingBackup(true);
    setBackupProgress(15);
    setBackupStepText('Initializing server snapshot & directory scan...');

    const timer1 = setTimeout(() => {
      setBackupProgress(45);
      setBackupStepText('Compressing all server files, plugins & worlds...');
    }, 400);

    const timer2 = setTimeout(() => {
      setBackupProgress(80);
      setBackupStepText('Writing ultra-secure ZIP archive to disk...');
    }, 900);

    try {
      const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newBackupName || 'Automated Snapshot' })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (res.ok) {
        setBackupProgress(100);
        setBackupStepText('Backup successfully generated & verified!');
        setTimeout(() => {
          setIsCreatingBackup(false);
          showToast('success', 'Archive snapshot generated successfully.');
          setNewBackupName('');
          loadBackups();
        }, 600);
      } else {
        throw new Error('Failed');
      }
    } catch {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsCreatingBackup(false);
      showToast('error', 'Backup compression failed.');
    }
  };

  const downloadBackup = (b: any) => {
    try {
      showToast('info', 'Downloading .tar.gz backup archive...');
      const url = `${API_BASE}/servers/${selectedServerId}/backup-download/${b.id}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${b.name || 'backup'}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('success', 'Backup download started.');
    } catch {
      showToast('error', 'Failed to download backup archive.');
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
          const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backup-restore/${bId}`, {
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
          const res = await fetch(`${API_BASE}/servers/${selectedServerId}/backup-delete/${bId}`, {
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
    if (!newUserData.username.trim() || !newUserData.email.trim() || !newUserData.password.trim()) {
      showToast('error', 'Username, email address, and password are all required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserData.email.trim())) {
      showToast('error', 'Please provide a valid email address.');
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
        showToast('success', `User account "${data.username}" (${data.email}) created.`);
        setNewUserData({ username: '', email: '', displayName: '', password: '', role: 'Administrator' });
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
    if (!deleteConfirmModalServer || deleteTypedInput.trim().toUpperCase() !== 'DELETE') return;
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
    const command = commandInput.trim();
    if (!command) return;
    sounds.playClick();
    
    // Add command to local history log for immediate visual feedback
    setConsoleLogs(prev => [...prev, `> ${command}`]);
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setCommandInput('');

    if (wsRef.current && wsConnected && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command }));
    } else if (selectedServerId) {
      fetch(`${API_BASE}/servers/${selectedServerId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ command })
      }).catch(() => {
        setConsoleLogs(prev => [...prev, `[System] Server console is currently offline.`]);
      });
    }

    setTimeout(() => {
      commandInputRef.current?.focus({ preventScroll: true });
    }, 10);
  };

  const sendQuickCommand = (cmd: string) => {
    sounds.playClick();
    setConsoleLogs(prev => [...prev, `> ${cmd}`]);
    
    if (wsRef.current && wsConnected && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    } else if (selectedServerId) {
      fetch(`${API_BASE}/servers/${selectedServerId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ command: cmd })
      }).catch(() => {
        setConsoleLogs(prev => [...prev, `[System] Server console is currently offline.`]);
      });
    }
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

  if (isAppLoading) {
    return <LoadingScreen />;
  }

  // If not authenticated, render AuthCard with Google & Discord OAuth support
  if (!token) {
    const handleOAuthSuccess = (authToken: string, authUser: any) => {
      setToken(authToken);
      if (authUser) setUser(authUser);
      showToast('success', 'Logged in via social account successfully!');
    };

    return (
      <AuthCard
        setupNeeded={setupNeeded}
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        usernameInput={usernameInput}
        setUsernameInput={setUsernameInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        authError={authError}
        setAuthError={setAuthError}
        authSuccess={authSuccess}
        setAuthSuccess={setAuthSuccess}
        authLoading={authLoading}
        authMode={authMode}
        setAuthMode={setAuthMode}
        handleLogin={handleLogin}
        handleRegisterAdmin={handleRegisterAdmin}
        handleUserRegister={handleUserRegister}
        checkFieldAvailability={checkFieldAvailability}
        regUsername={regUsername}
        setRegUsername={setRegUsername}
        regEmail={regEmail}
        setRegEmail={setRegEmail}
        regPassword={regPassword}
        setRegPassword={setRegPassword}
        regConfirmPassword={regConfirmPassword}
        setRegConfirmPassword={setRegConfirmPassword}
        showRegPassword={showRegPassword}
        setShowRegPassword={setShowRegPassword}
        showRegConfirmPassword={showRegConfirmPassword}
        setShowRegConfirmPassword={setShowRegConfirmPassword}
        usernameAvailability={usernameAvailability}
        setUsernameAvailability={setUsernameAvailability}
        emailAvailability={emailAvailability}
        setEmailAvailability={setEmailAvailability}
        onOAuthSuccess={handleOAuthSuccess}
        bgSettings={bgSettings}
        panelBrandName={panelBrandName}
        panelBrandLogo={panelBrandLogo}
        showThemeModal={showThemeModal}
        setShowThemeModal={setShowThemeModal}
        updateBgSettings={updateBgSettings}
        resetBgSettings={resetBgSettings}
      />
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-sm overflow-hidden">
                <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-colors">
                  {panelBrandLogo ? (
                    <img src={panelBrandLogo} alt="Logo" className="w-full h-full object-cover rounded-[10px]" />
                  ) : (
                    <ServerIcon className="w-4 h-4" />
                  )}
                </div>
              </div>
              <span className="text-sm font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors whitespace-nowrap">
                {panelBrandName}
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
            className={`hidden md:flex flex-col justify-between ${sidebarCollapsed ? 'w-20 p-2.5' : 'w-64 p-4'} shrink-0 transition-all duration-300 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-20 ${
              bgSettings.sidebarStyle === 'transparent'
                ? 'glass-sidebar-transparent'
                : 'glass-sidebar'
            }`}
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
                          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-semibold rounded-xl transition-all border cursor-pointer ${
                            showWizard
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border-purple-400/40 font-bold'
                              : 'text-zinc-200 hover:text-white hover:bg-purple-500/15 border-transparent'
                          }`}
                        >
                          <Hammer className={`w-4 h-4 shrink-0 ${showWizard ? 'text-white' : 'text-purple-300'}`} />
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
                              { id: 'plugins', label: isModded(serverDetails?.software) ? 'Mod Manager' : 'Plugin Manager', icon: isModded(serverDetails?.software) ? Layers : Boxes },
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

                  {/* SINGLE ADMIN AREA ENTRY AT BOTTOM (Only visible to Admin users) */}
                  {isAdminUser(user) && (
                    <div className="pt-4 border-t border-white/10">
                      <button
                        type="button"
                        onClick={openAdminArea}
                        title="Admin Area"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3.5 py-2.5'} text-xs font-bold text-purple-200 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer`}
                      >
                        <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
                        {!sidebarCollapsed && <span>⚙ ADMIN AREA</span>}
                      </button>
                    </div>
                  )}
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

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerId(null);
                          setActiveTab('admin-settings');
                        }}
                        title="Deploy UI Logos"
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} text-xs font-medium rounded-xl transition-all ${
                          activeTab === 'admin-settings' && !selectedServerId
                            ? 'bg-purple-600 text-white shadow-md font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4 shrink-0 text-purple-400" />
                        {!sidebarCollapsed && <span>Deploy UI Logos</span>}
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

            {/* SYSTEM INFRASTRUCTURE MONITOR */}
            <div className={`p-3 bg-gradient-to-br from-[#100b2b] to-[#1a1147] border border-purple-500/30 rounded-2xl shadow-xl space-y-2.5 relative overflow-hidden group ${sidebarCollapsed ? 'text-center' : ''}`}>
              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all duration-500" />
              
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} text-[11px]`}>
                <span className="text-purple-300 font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
                  {!sidebarCollapsed && 'Core Engine'}
                </span>
                {!sidebarCollapsed && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase tracking-widest animate-pulse">
                    Secure
                  </span>
                )}
              </div>

              {!sidebarCollapsed && (
                <div className="space-y-2 text-[10px]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-400 font-mono">
                      <span>Panel CPU</span>
                      <span className="text-purple-300 font-bold">12.4%</span>
                    </div>
                    <div className="w-full bg-zinc-950/60 rounded-full h-1 overflow-hidden border border-white/5">
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full w-[12.4%]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-400 font-mono">
                      <span>Nodes RAM</span>
                      <span className="text-indigo-300 font-bold">2.4 / 16 GB</span>
                    </div>
                    <div className="w-full bg-zinc-950/60 rounded-full h-1 overflow-hidden border border-white/5">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full w-[15%]" />
                    </div>
                  </div>
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
              <div className={`relative w-72 p-5 flex flex-col justify-between overflow-y-auto z-50 shadow-2xl transition-all ${
                bgSettings.sidebarStyle === 'transparent'
                  ? 'glass-sidebar-transparent'
                  : 'glass-sidebar'
              }`}>
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
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all border ${
                            showWizard
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border-purple-400/40 font-bold'
                              : 'text-zinc-200 hover:text-white hover:bg-purple-500/15 border-transparent'
                          }`}
                        >
                          <Hammer className={`w-4 h-4 shrink-0 ${showWizard ? 'text-white' : 'text-purple-400'}`} />
                          <span>Create Server</span>
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
                              { id: 'plugins', label: isModded(serverDetails?.software) ? 'Mod Manager' : 'Plugin Manager', icon: isModded(serverDetails?.software) ? Layers : Boxes },
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
                        <button
                          onClick={() => {
                            setSelectedServerId(null);
                            setActiveTab('admin-settings');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                            activeTab === 'admin-settings' && !selectedServerId
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'text-zinc-200 hover:bg-white/5'
                          }`}
                        >
                          <ImageIcon className="w-4 h-4 text-purple-400" /> Deploy UI Logos
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

                 {/* Mobile Drawer Bottom System Monitor */}
                 <div className="pt-3 mt-4 border-t border-purple-500/20">
                   <div className="p-3 bg-gradient-to-br from-[#100b2b] to-[#1a1147] border border-purple-500/30 rounded-2xl shadow-xl space-y-2 relative overflow-hidden">
                     <div className="flex items-center justify-between text-[11px]">
                       <span className="text-purple-300 font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                         <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
                         Core Engine
                       </span>
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase tracking-widest animate-pulse">
                         Secure
                       </span>
                     </div>
                     <div className="space-y-1.5 text-[10px] mt-1.5">
                       <div className="space-y-1">
                         <div className="flex justify-between text-zinc-400 font-mono">
                           <span>Panel CPU</span>
                           <span className="text-purple-300 font-bold">12.4%</span>
                         </div>
                         <div className="w-full bg-zinc-950/60 rounded-full h-1 overflow-hidden border border-white/5">
                           <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full w-[12.4%]" />
                         </div>
                       </div>
                       <div className="space-y-1">
                         <div className="flex justify-between text-zinc-400 font-mono">
                           <span>Nodes RAM</span>
                           <span className="text-indigo-300 font-bold">2.4 / 16 GB</span>
                         </div>
                         <div className="w-full bg-zinc-950/60 rounded-full h-1 overflow-hidden border border-white/5">
                           <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full w-[15%]" />
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {/* MAIN CONTENT AREA */}
          <main ref={mainContentRef} className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-6 sm:pb-8 max-w-7xl mx-auto w-full space-y-5 h-[calc(100vh-4rem)] overflow-y-auto">
            {/* IF SERVER IS SELECTED -> RENDER SERVER DASHBOARD */}
            {selectedServerId && serverDetails ? (
              <ServerDashboard
                serverDetails={serverDetails}
                executeLifecycle={executeLifecycle}
                hostStats={hostStats}
                serverRealtimeMetrics={serverRealtimeMetrics}
                metricsStatus={metricsStatus}
                selectedServerTab={selectedServerTab}
                wsConnected={wsConnected}
                consoleSearch={consoleSearch}
                setConsoleSearch={setConsoleSearch}
                autoScroll={autoScroll}
                setAutoScroll={setAutoScroll}
                setConsoleLogs={setConsoleLogs}
                filteredConsoleLogs={filteredConsoleLogs}
                consoleViewportRef={consoleViewportRef}
                handleConsoleScroll={handleConsoleScroll}
                sendQuickCommand={sendQuickCommand}
                sendConsoleCommand={sendConsoleCommand}
                commandInput={commandInput}
                setCommandInput={setCommandInput}
                commandInputRef={commandInputRef}
                handleConsoleKeyDown={handleConsoleKeyDown}
                cpuHistory={cpuHistory}
                ramHistory={ramHistory}
                diskHistory={diskHistory}
                netRxHistory={netRxHistory}
                netTxHistory={netTxHistory}
                token={token!}
                refreshServerStorageStats={refreshServerStorageStats}
                backups={backups}
                createBackup={createBackup}
                downloadBackup={downloadBackup}
                restoreBackup={restoreBackup}
                deleteBackup={deleteBackup}
                schedules={schedules}
                newSchedule={newSchedule}
                setNewSchedule={setNewSchedule}
                createSchedule={createSchedule}
                newPortNumber={newPortNumber}
                setNewPortNumber={setNewPortNumber}
                newPortLabel={newPortLabel}
                setNewPortLabel={setNewPortLabel}
                allocateExtraPort={allocateExtraPort}
                allocatingPort={allocatingPort}
                releaseExtraPort={releaseExtraPort}
                editingStartup={editingStartup}
                setEditingStartup={setEditingStartup}
                saveStartupSettings={saveStartupSettings}
                proxies={proxies}
                newProxyDomain={newProxyDomain}
                setNewProxyDomain={setNewProxyDomain}
                newProxyPort={newProxyPort}
                setNewProxyPort={setNewProxyPort}
                createProxy={createProxy}
                deleteProxy={deleteProxy}
                showToast={showToast}
                loadProperties={loadProperties}
              />
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
                            Welcome to Xorvila
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
                            onDeleteServer={isAdminUser(user) ? (s) => setDeleteConfirmModalServer(s) : undefined}
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
                  <AdminUsers
                    usersList={usersList}
                    setShowCreateUserModal={setShowCreateUserModal}
                    token={token}
                    currentUser={user}
                    onRefreshUsers={() => {
                      fetch(`${API_BASE}/users`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        credentials: 'include'
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (Array.isArray(data)) setUsersList(data);
                        })
                        .catch(() => {});
                    }}
                    showToast={showToast}
                  />
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

                {/* ADMIN SETTINGS / DEPLOY UI SOFTWARE LOGO CUSTOMIZER */}
                {activeTab === 'admin-settings' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                          <Sliders className="w-7 h-7" />
                        </div>
                        <div>
                          <h1 className="text-2xl font-extrabold text-white tracking-tight">Deploy UI Software Logo Customizer</h1>
                          <p className="text-xs text-zinc-300 mt-0.5">Customize or upload custom icons/logos for each deployment software (Paper, Purpur, Fabric, Forge, etc.) instantly across the panel.</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono bg-purple-950/80 text-purple-300 px-3 py-1.5 rounded-xl border border-purple-500/30 font-bold">
                        Global Persistence Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {['Paper', 'Purpur', 'Fabric', 'Forge', 'Velocity', 'BungeeCord', 'Rust', 'Palworld', 'Valheim'].map((sw) => {
                        const currentUrl = customLogosMap[sw] || '';

                        const persistToServer = async (nextMap: Record<string, string>) => {
                          try {
                            await storageService.updateSystemSettings({ customLogos: nextMap }, token);
                          } catch {}
                        };

                        const handleLogoUrlChange = (softwareName: string, url: string) => {
                          const next = { ...customLogosMap, [softwareName]: url };
                          setCustomLogosMap(next);
                          persistToServer(next);
                        };

                        const handleLogoFileUpload = (softwareName: string, e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            if (dataUrl) {
                              handleLogoUrlChange(softwareName, dataUrl);
                            }
                          };
                          reader.readAsDataURL(file);
                        };

                        const handleResetLogo = (softwareName: string) => {
                          const next = { ...customLogosMap };
                          delete next[softwareName];
                          setCustomLogosMap(next);
                          persistToServer(next);
                        };

                        return (
                          <div key={sw} className="glass-card rounded-2xl p-5 border border-white/10 space-y-4 hover:border-purple-500/40 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-white/10 flex items-center justify-center p-1.5 shadow">
                                  {currentUrl ? (
                                    <img src={currentUrl} alt={sw} className="w-full h-full object-contain rounded-lg" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-purple-400" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white font-mono">{sw}</h4>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {currentUrl ? 'Custom Branded' : 'Default Vector'}
                                  </span>
                                </div>
                              </div>
                              {currentUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleResetLogo(sw)}
                                  className="px-2 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg transition cursor-pointer"
                                >
                                  Reset Default
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                                Image URL or Asset Link
                              </label>
                              <input
                                type="text"
                                placeholder="https://example.com/logo.png"
                                value={currentUrl}
                                onChange={(e) => handleLogoUrlChange(sw, e.target.value)}
                                className="w-full px-3 py-1.5 text-xs glass-input rounded-xl text-white placeholder-zinc-600 focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/30 rounded-xl text-xs font-semibold text-purple-200 transition cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleLogoFileUpload(sw, e)}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SETTINGS / APPEARANCE VIEW (All 10 Background Controls Inline) */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 shadow-2xl">
                      <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-wrap gap-4">
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

                        <div className="flex items-center gap-2">
                          <button
                            onClick={resetBgSettings}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-zinc-400 hover:text-zinc-200 bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset to Default</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (showToast) showToast('success', 'All system appearance and branding settings saved successfully!');
                            }}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-900/40 transition cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>Save Changes</span>
                          </button>
                        </div>
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
                                  <Boxes className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-white">Custom Upload / URL</div>
                                  <div className="text-xs text-zinc-400">Use your own Minecraft artwork</div>
                                </div>
                              </button>
                            </div>

                            {/* Always render custom URL and upload inputs so they can easily use it at any time! */}
                            <div className="mt-4 p-4 bg-black/45 border border-white/10 rounded-2xl space-y-3">
                              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                Custom Wallpaper URL or File Upload
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="text"
                                  placeholder="https://example.com/minecraft-wallpaper.png"
                                  value={bgSettings.customUrl.startsWith('data:') ? 'Custom uploaded image (stored locally)' : bgSettings.customUrl}
                                  onChange={(e) => updateBgSettings({ preset: 'custom', customUrl: e.target.value })}
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
                                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>Upload File</span>
                                </button>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                <span>Default 8K Theme URL</span>
                                <button
                                  type="button"
                                  onClick={() => updateBgSettings({ preset: 'custom', customUrl: 'https://rough-morning-940.linkyhost.com' })}
                                  className="text-purple-400 hover:text-purple-300 underline font-mono cursor-pointer"
                                >
                                  Restore 8K Link
                                </button>
                              </div>
                            </div>
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

                          {/* 9. Sidebar Customization */}
                          <div className="p-4 bg-black/35 border border-white/5 rounded-2xl space-y-3">
                            <div>
                              <span className="text-xs font-semibold text-zinc-200">9. Sidebar Layout Style</span>
                              <p className="text-[10px] text-zinc-400 mt-0.5">Toggle between completely transparent borderless design or traditional premium glassmorphism sidebar.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => updateBgSettings({ sidebarStyle: 'normal' })}
                                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  (bgSettings.sidebarStyle || 'normal') === 'normal'
                                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                }`}
                              >
                                Normal Glassmorphism
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBgSettings({ sidebarStyle: 'transparent' })}
                                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  bgSettings.sidebarStyle === 'transparent'
                                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                }`}
                              >
                               Completely Transparent
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 11. System Branding Customization */}
                    <div className="p-6 sm:p-8 rounded-3xl glass-panel space-y-6 shadow-2xl">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">System Branding</h2>
                          <p className="text-xs text-zinc-400">
                            Personalize the panel name and global brand logo (Upload or URL)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Brand Name Input */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            Panel Brand Name
                          </label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-400 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </div>
                            <input
                              type="text"
                              value={panelBrandName}
                              onChange={(e) => handleUpdateBrandName(e.target.value)}
                              placeholder="Enter panel name..."
                              className="w-full pl-10 pr-4 py-2.5 glass-input rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            />
                          </div>
                        </div>

                        {/* Brand Logo URL & Upload */}
                        <div className="space-y-3">
                          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            Global Logo (Image URL or File Upload)
                          </label>
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative flex-1 w-full">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                placeholder="https://example.com/logo.png"
                                value={panelBrandLogo.startsWith('data:') ? 'Custom uploaded image' : panelBrandLogo}
                                onChange={(e) => handleUpdateBrandLogo(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 glass-input rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                              />
                            </div>
                            
                            <input
                              type="file"
                              ref={brandLogoInputRef}
                              onChange={handleBrandLogoUpload}
                              accept="image/*"
                              className="hidden"
                            />
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => brandLogoInputRef.current?.click()}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl transition-all cursor-pointer shadow-sm"
                              >
                                <Upload className="w-4 h-4" />
                                <span>Upload Logo</span>
                              </button>
                              
                              {panelBrandLogo && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBrandLogo('')}
                                  className="p-2.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl transition-all cursor-pointer shadow-sm"
                                  title="Reset to default logo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Live Preview */}
                          {panelBrandLogo && (
                            <div className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-md">
                                <div className="w-full h-full bg-zinc-950 rounded-[9px] overflow-hidden flex items-center justify-center">
                                  <img src={panelBrandLogo} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                <span className="font-bold text-zinc-300 block mb-0.5">Live Preview</span>
                                This logo will be displayed in the top-left corner of the sidebar.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Save Changes Bar */}
                    <div className="p-6 rounded-3xl glass-panel flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-purple-950/70 via-black/90 to-purple-950/70 border border-purple-500/50 shadow-2xl">
                      <div>
                        <h3 className="text-sm font-bold text-white">Ready to save all appearance & branding?</h3>
                        <p className="text-xs text-zinc-400">Click below to commit and apply changes globally across the panel.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (showToast) showToast('success', 'All system appearance and branding settings saved successfully!');
                        }}
                        className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-2xl shadow-xl shadow-purple-900/60 transition cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-5 h-5" />
                        <span>Save Changes</span>
                      </button>
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
                disabled={deleteTypedInput.trim().toUpperCase() !== 'DELETE' || deletingInAdmin}
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

      {/* ULTRA 4K BACKUP PROGRESS MODAL */}
      {isCreatingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md glass-modal rounded-3xl p-6 shadow-2xl border border-purple-500/30 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center mx-auto text-purple-400 shadow-lg animate-pulse">
              <Archive className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Generating Backup Snapshot</h3>
              <p className="text-xs text-zinc-400 mt-1">{backupStepText || 'Compressing server files...'}</p>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-white/10 p-0.5">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-md shadow-purple-600/50"
                  style={{ width: `${backupProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono font-bold text-purple-300">
                <span>Compressing ZIP Archive</span>
                <span>{backupProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMMAND PALETTE MODAL (Ctrl+K) */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowCommandPalette(false)}>
          <div className="w-full max-w-xl glass-modal rounded-3xl overflow-hidden shadow-2xl border border-purple-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 bg-purple-950/40 border-b border-white/10 flex items-center gap-3">
              <Search className="w-5 h-5 text-purple-400" />
              <input
                type="text"
                autoFocus
                placeholder="Type a command, server name, or jump to..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none font-medium"
              />
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white/10 rounded text-zinc-400">ESC</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {/* Quick Action: Create New Server */}
              <button
                type="button"
                onClick={() => {
                  setShowCommandPalette(false);
                  setCommandQuery('');
                  setShowWizard(true);
                  setWizardStep(1);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-purple-600/20 text-left transition group border border-transparent hover:border-purple-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">Create New Minecraft Server</div>
                    <div className="text-[10px] text-zinc-400">Deploy Paper, Fabric, Forge, Purpur, or Proxy</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-500/30">Action</span>
              </button>

              {/* Servers list */}
              {servers
                .filter(s => s.name.toLowerCase().includes(commandQuery.toLowerCase()) || s.software.toLowerCase().includes(commandQuery.toLowerCase()))
                .map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setShowCommandPalette(false);
                      setCommandQuery('');
                      setSelectedServerId(s.id);
                      setSelectedServerTab('console');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 text-left transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                        <ServerIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-purple-300">{s.name}</div>
                        <div className="text-[10px] text-zinc-400">{s.software} · Port :{s.primaryPort || 25565} · {s.status || 'Offline'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Open Console →</span>
                  </button>
                ))}
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
            {toast.type === 'info' && <Boxes className="w-4 h-4 text-purple-400" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
