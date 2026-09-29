import React, { useState, useEffect, useRef } from 'react';
import {
  X, Check, AlertCircle, Server, HardDrive, Cpu, Activity, Sliders, Globe,
  Terminal, Plus, ChevronLeft, ChevronRight, Clock, Settings, CheckCircle2,
  Trash2, Play, Sparkles, RefreshCw, AlertTriangle, BookOpen, KeyRound, Shield,
  MapPin, Tag, HelpCircle, Network
} from 'lucide-react';
import {
  MinecraftLogo, PaperLogo, PurpurLogo, FabricLogo,
  ForgeLogo, VelocityLogo, BungeeCordLogo,
  RustLogo, PalworldLogo, ValheimLogo
} from './BrandLogos';

interface CreateServerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  servers: any[];
  allAllocations: any[];
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onDeploySuccess: (serverId: string) => void;
}

interface EngineCard {
  id: 'Paper' | 'Fabric' | 'Forge' | 'Purpur' | 'Velocity' | 'BungeeCord';
  name: string;
  type: 'server' | 'proxy';
  description: string;
  features: string[];
  recommendedVersion: string;
  logo: React.FC<{ className?: string; size?: number }>;
}

const ENGINES: EngineCard[] = [
  {
    id: 'Paper',
    name: 'Paper',
    type: 'server',
    description: 'High performance, secure, and highly customizable Minecraft server engine. Fully Spigot & Bukkit plugin compatible.',
    features: ['Premium performance patches', 'Asynchronous chunk loading', 'Spigot/Bukkit plugin ecosystem support', 'Exploit mitigation'],
    recommendedVersion: '1.21.1',
    logo: PaperLogo
  },
  {
    id: 'Purpur',
    name: 'Purpur',
    type: 'server',
    description: 'A drop-in replacement for Paper, designed for extreme configuration and extensive customized gameplay settings.',
    features: ['Ultra-customizable configuration', 'Spigot/Paper plugin support', 'Optimized tick mechanics', 'Hundreds of extra toggles'],
    recommendedVersion: '1.21.1',
    logo: PurpurLogo
  },
  {
    id: 'Fabric',
    name: 'Fabric',
    type: 'server',
    description: 'Modern, lightweight, and highly modular modding toolchain. Perfect for vanilla-adjacent and highly custom-coded servers.',
    features: ['Modern modpack support', 'Extremely lightweight core', 'Instant version updates', 'Clean mod execution'],
    recommendedVersion: '1.21.1',
    logo: FabricLogo
  },
  {
    id: 'Forge',
    name: 'Forge',
    type: 'server',
    description: 'The classic, heavy-duty modding API. Essential for large custom modpacks and complex mechanical gameplay.',
    features: ['Massive traditional mod catalog', 'Server-side mod extraction tool', 'Classic modpack compatibility', 'Custom rendering support'],
    recommendedVersion: '1.20.1',
    logo: ForgeLogo
  },
  {
    id: 'Velocity',
    name: 'Velocity',
    type: 'proxy',
    description: 'Next-generation, high-performance proxy server. Distributes players across multiple backend server instances smoothly.',
    features: ['High-concurrency proxy routing', 'Built-in flood protection', 'Ultra-fast packet forwarding', 'Velocity plugins support'],
    recommendedVersion: '3.3.0-SNAPSHOT',
    logo: VelocityLogo
  },
  {
    id: 'BungeeCord',
    name: 'BungeeCord',
    type: 'proxy',
    description: 'The standard suite for chaining Minecraft servers together. Essential for legacy networks and standard multi-server setups.',
    features: ['Standard lobby-server portals', 'Chained server connections', 'Vast proxy plugin library', 'Stable legacy operation'],
    recommendedVersion: 'latest',
    logo: BungeeCordLogo
  }
];

interface GameTitle {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'soon';
  logo: React.FC<{ className?: string; size?: number }>;
}

const GAMES: GameTitle[] = [
  { id: 'minecraft', name: 'Minecraft', description: 'Deploy vanilla, modded, or proxy server instances with active upstream API verification.', category: 'Sandbox', status: 'active', logo: MinecraftLogo },
  { id: 'rust', name: 'Rust Dedicated', description: 'High-performance post-apocalyptic multiplayer survival network. Coming soon.', category: 'Survival', status: 'soon', logo: RustLogo },
  { id: 'palworld', name: 'Palworld', description: 'Multiplayer open-world monster-collecting survival server. Coming soon.', category: 'Co-op', status: 'soon', logo: PalworldLogo },
  { id: 'valheim', name: 'Valheim Dedicated', description: 'Viking exploration and building simulator sandbox. Coming soon.', category: 'Action RPG', status: 'soon', logo: ValheimLogo }
];

export const CreateServerWizard: React.FC<CreateServerWizardProps> = ({
  isOpen,
  onClose,
  token,
  servers,
  allAllocations,
  showToast,
  onDeploySuccess
}) => {
  const [step, setStep] = useState(1);
  const [candidateId, setCandidateId] = useState('');
  
  // Wizard States
  const [selectedGame, setSelectedGame] = useState<string>('minecraft');
  const [selectedEngine, setSelectedEngine] = useState<EngineCard>(ENGINES[0]);
  const [versionInput, setVersionInput] = useState('1.21.1');
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [serverPort, setServerPort] = useState(25565);
  const [selectedLocation, setSelectedLocation] = useState<string>('us-dallas');

  // Nodes state variables
  const [nodes, setNodes] = useState<any[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  
  // Resource Allocation States
  const [ramLimitGb, setRamLimitGb] = useState(4);
  const [cpuCores, setCpuCores] = useState(2);
  const [diskLimitGb, setDiskLimitGb] = useState(15);
  
  // Advanced Configuration States
  const [difficulty, setDifficulty] = useState<'peaceful' | 'easy' | 'normal' | 'hard'>('easy');
  const [gamemode, setGamemode] = useState<'survival' | 'creative' | 'adventure' | 'spectator'>('survival');
  const [viewDistance, setViewDistance] = useState(10);
  const [simulationDistance, setSimulationDistance] = useState(10);
  const [pvp, setPvp] = useState(true);
  const [onlineMode, setOnlineMode] = useState(true);
  const [timezone, setTimezone] = useState('UTC');
  const [minRamGb, setMinRamGb] = useState('512M');
  const [customStartupCommand, setCustomStartupCommand] = useState('');
  const [customJavaVersion, setCustomJavaVersion] = useState('21');
  
  // EULA Consent
  const [acceptEula, setAcceptEula] = useState(false);
  
  // API Validation / Resolution
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    supported?: boolean;
    engine?: string;
    minecraftVersion?: string;
    resolvedBuild: string;
    downloadUrl?: string;
    javaVersion: string;
    isProxy?: boolean;
    error?: string;
  } | null>(null);
  
  // Real managed Java runtimes from panel
  const [installedJavas, setInstalledJavas] = useState<any[]>([]);
  const [loadingJavas, setLoadingJavas] = useState(false);

  // Live upstream versions queried from backend
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const lastValidationRequestId = useRef<number>(0);
  
  // Live deployment tracking
  const [deploymentServerId, setDeploymentServerId] = useState<string | null>(null);
  const [deployProgress, setDeploymentProgress] = useState<any>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize candidate ID and available port allocation on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      const uniqueId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setCandidateId(uniqueId);
      
      // Auto-allocate first unused port starting at 25565
      const ports = [25565, ...servers.map(s => Number(s.primaryPort) || 0), ...allAllocations.map(a => Number(a.port) || 0)];
      let nextPort = 25565;
      while (ports.includes(nextPort)) {
        nextPort++;
      }
      setServerPort(nextPort);
      
      // Load Java runtimes
      fetchJavaRuntimes();
      // Load nodes from real-time backend API
      fetchNodes();
      // Load versions for default engine
      fetchVersionsForEngine(selectedEngine.id);
    }
  }, [isOpen]);

  // Adjust prefilled default version and validation when engine changes
  useEffect(() => {
    setVersionInput(selectedEngine.recommendedVersion);
    setValidationResult(null);
    setAcceptEula(false);
    
    // Set Java version default depending on engine
    if (selectedEngine.id === 'Velocity') {
      setCustomJavaVersion('21');
    } else if (selectedEngine.id === 'BungeeCord') {
      setCustomJavaVersion('17');
    } else {
      setCustomJavaVersion('21');
    }

    if (isOpen) {
      fetchVersionsForEngine(selectedEngine.id);
    }
  }, [selectedEngine]);

  // Fetch real available versions from backend
  const fetchVersionsForEngine = async (engineId: string) => {
    try {
      setLoadingVersions(true);
      const res = await fetch(`/api/engines/${engineId.toLowerCase()}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.versions)) {
          setAvailableVersions(data.versions);
        }
      }
    } catch (e) {
      console.error(`Failed to fetch versions for ${engineId}:`, e);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Debounced auto-verification on versionInput and selectedEngine changes
  useEffect(() => {
    if (!isOpen) return;
    if (!versionInput.trim()) {
      setValidationResult(null);
      return;
    }

    setValidationResult(null); // Clear the old result immediately on change

    const timer = setTimeout(() => {
      handleValidateVersionDirectly(selectedEngine.id, versionInput.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [versionInput, selectedEngine.id, isOpen]);

  // Auto-generate startup execution command dynamically
  useEffect(() => {
    const isProxy = selectedEngine.type === 'proxy';
    const nogui = isProxy ? '' : ' nogui';
    const jarName = isProxy ? `${selectedEngine.id.toLowerCase()}.jar` : 'server.jar';
    setCustomStartupCommand(`java -Xms${minRamGb} -Xmx${ramLimitGb}G -jar ${jarName}${nogui}`);
  }, [ramLimitGb, minRamGb, selectedEngine]);

  const fetchNodes = async () => {
    try {
      setLoadingNodes(true);
      const res = await fetch('/api/nodes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNodes(data || []);
        const activeNode = data.find((n: any) => n.status === 'ONLINE') || data[0];
        if (activeNode) {
          setSelectedNode(activeNode);
          setSelectedLocation(activeNode.id);
        }
      }
    } catch (e) {
      console.error('Failed to load nodes:', e);
    } finally {
      setLoadingNodes(false);
    }
  };

  const fetchJavaRuntimes = async () => {
    try {
      setLoadingJavas(true);
      const res = await fetch('/api/runtimes/java', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstalledJavas(data.runtimes || []);
      }
    } catch {
      // fallback if API is unresponsive
    } finally {
      setLoadingJavas(false);
    }
  };

  const handleValidateVersionDirectly = async (engineId: string, version: string) => {
    if (!version.trim()) {
      setValidationResult(null);
      setIsValidating(false);
      return;
    }

    const currentReqId = ++lastValidationRequestId.current;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const res = await fetch('/api/servers/validate-version', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          software: engineId,
          version: version.trim(),
          requestId: String(currentReqId)
        })
      });

      const data = await res.json();

      // Only apply if this response corresponds to the latest requested version & request ID
      if (currentReqId === lastValidationRequestId.current) {
        setValidationResult(data);
        if (data.valid) {
          setCustomJavaVersion(data.javaVersion || '21');
        }
      }
    } catch {
      if (currentReqId === lastValidationRequestId.current) {
        setValidationResult({
          valid: false,
          resolvedBuild: '',
          javaVersion: '17',
          error: 'Network connection interrupted during version verification.'
        });
      }
    } finally {
      if (currentReqId === lastValidationRequestId.current) {
        setIsValidating(false);
      }
    }
  };

  // Trigger Version Validation API
  const handleValidateVersion = async () => {
    if (!versionInput.trim()) return;
    handleValidateVersionDirectly(selectedEngine.id, versionInput.trim());
  };

  // Run deployment
  const handleDeployServer = async () => {
    if (selectedEngine.type !== 'proxy' && !acceptEula) {
      showToast('error', 'You must explicitly accept the Minecraft EULA.');
      return;
    }

    if (selectedNode && selectedNode.status === 'OFFLINE') {
      showToast('error', `Selected node "${selectedNode.name}" is currently OFFLINE and cannot accept new server deployments.`);
      setStep(5);
      return;
    }

    setStep(8);
    setDeployError(null);
    setDeploymentServerId(candidateId);

    const payload = {
      name: serverName.trim() || `${selectedEngine.id} Server`,
      description: serverDescription.trim() || `${selectedEngine.type === 'proxy' ? 'Proxy' : 'Dedicated'} ${selectedEngine.id} server running ${versionInput}`,
      software: selectedEngine.id,
      version: versionInput.trim(),
      javaVersion: customJavaVersion,
      memoryLimitGb: ramLimitGb,
      cpuLimitCores: cpuCores,
      diskLimitGb: diskLimitGb,
      acceptEula: selectedEngine.type === 'proxy' ? true : acceptEula,
      port: serverPort,
      difficulty,
      gamemode,
      viewDistance: String(viewDistance),
      simulationDistance: String(simulationDistance),
      pvp: pvp ? 'true' : 'false',
      onlineMode: onlineMode ? 'true' : 'false',
      minRamGb,
      timezone,
      startupCommand: customStartupCommand,
      location: selectedNode?.location || selectedLocation,
      nodeId: selectedNode?.id || selectedLocation
    };

    try {
      const res = await fetch('/api/servers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.server?.id) {
          setDeploymentServerId(data.server.id);
        }
        showToast('success', 'Server deployment initiated safely.');
        // Begin polling for progress
        setDeploymentProgress({
          status: 'installing',
          currentStep: 0,
          steps: Array(9).fill(null).map((_, i) => ({ name: 'Provisioning...', status: 'pending' })),
          logs: ['[System] Connecting to daemon logs stream...']
        });
      } else {
        setDeployError(data.error || 'Daemon rejected the deployment request.');
        showToast('error', data.error || 'Failed to initialize server build.');
      }
    } catch {
      setDeployError('Failed to establish contact with backend deployment services.');
      showToast('error', 'Network error dispatching build sequence.');
    }
  };

  // Poll progress state
  useEffect(() => {
    let interval: any;
    if (step === 8 && deploymentServerId && !deployError) {
      const poll = async () => {
        try {
          const res = await fetch(`/api/servers/${deploymentServerId}/install-progress`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setDeploymentProgress(data);
            
            // Auto scroll log terminal
            setTimeout(() => {
              if (terminalBottomRef.current) {
                terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 50);

            if (data.status === 'completed' || data.state === 'READY') {
              showToast('success', `🚀 Server deployed and started successfully!`);
              clearInterval(interval);
              setTimeout(() => {
                onDeploySuccess(deploymentServerId);
              }, 200);
            } else if (data.status === 'failed' || data.state === 'FAILED') {
              setDeployError(data.error || 'Upstream server assembly failed.');
              clearInterval(interval);
            }
          }
        } catch {
          // ignore transient network drops
        }
      };

      poll();
      interval = setInterval(poll, 1500);
    }
    return () => clearInterval(interval);
  }, [step, deploymentServerId, deployError]);

  if (!isOpen) return null;

  // Step names in sidebar
  const stepsList = [
    { id: 1, name: 'Game' },
    { id: 2, name: 'Software' },
    { id: 3, name: 'Version' },
    { id: 4, name: 'Resources' },
    { id: 5, name: 'Node' },
    { id: 6, name: 'Name' },
    { id: 7, name: 'Review' },
    { id: 8, name: 'Deploy' }
  ];

  const progressPercentages: { [key: number]: number } = {
    1: 12,
    2: 25,
    3: 37,
    4: 50,
    5: 62,
    6: 75,
    7: 87,
    8: 100
  };

  const currentPercent = progressPercentages[step] || 12;

  const getBlockProgressBar = (percentage: number) => {
    const totalBlocks = 16;
    const activeBlocks = Math.round((percentage / 100) * totalBlocks);
    const inactiveBlocks = Math.max(0, totalBlocks - activeBlocks);
    const filled = '█'.repeat(activeBlocks);
    const empty = '░'.repeat(inactiveBlocks);
    return `${filled}${empty} ${percentage}%`;
  };

  // Validation per step
  const canContinueStep = () => {
    if (step === 1) return selectedGame === 'minecraft';
    if (step === 2) return !!selectedEngine;
    if (step === 3) return !isValidating && validationResult?.valid === true && validationResult?.minecraftVersion === versionInput.trim();
    if (step === 4) {
      // Validate RAM, CPU, Disk are chosen, and selected Java is compatible
      const isPortTaken = servers.some(s => Number(s.primaryPort) === serverPort);
      const isPortAllocated = allAllocations.some(a => Number(a.port) === serverPort && a.serverId && a.serverId !== candidateId);
      const isJavaCompatible = customJavaVersion === (validationResult?.javaVersion || '21') || customJavaVersion === '21' || customJavaVersion === '17';
      return ramLimitGb >= 1 && cpuCores >= 1 && diskLimitGb >= 2 && serverPort >= 1024 && serverPort <= 65535 && !isPortTaken && !isPortAllocated && isJavaCompatible;
    }
    if (step === 5) return !!selectedNode && selectedNode.status === 'ONLINE';
    if (step === 6) return serverName.trim().length >= 3;
    if (step === 7) return selectedEngine.type === 'proxy' || acceptEula;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 overflow-y-auto">
      <div className="relative w-full max-w-5xl glass-modal rounded-3xl overflow-hidden shadow-2xl border border-purple-500/20 bg-gradient-to-b from-[#0e0926] to-[#05040f] flex flex-col md:flex-row h-auto md:h-[600px] max-h-[94vh]">
        
        {/* LEFT COLUMN: PIXELFORGE SIDEBAR PROGRESS */}
        <div className="w-full md:w-60 bg-[#070514]/90 border-b md:border-b-0 md:border-r border-white/10 p-3.5 sm:p-4 flex flex-col shrink-0 justify-between md:h-full overflow-hidden">
          <div className="space-y-2.5 flex-1 flex flex-col overflow-hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                <span className="text-[10px] font-mono tracking-wider text-purple-400 font-bold uppercase">
                  PixelForge Engine
                </span>
              </div>
              <h3 className="text-sm font-black text-white tracking-wider uppercase font-mono mt-0.5">
                Setup Wizard
              </h3>
            </div>

            {/* Sidebar list - compact, balanced, evenly distributed without huge gaps */}
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto py-1 md:py-1.5 flex-1 justify-between scrollbar-none">
              {stepsList.map((st) => {
                const isActive = step === st.id;
                const isCompleted = step > st.id;
                const isFuture = step < st.id;

                let stateClasses = "";
                if (isActive) {
                  stateClasses = "bg-purple-600/25 border-purple-500/80 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.35)] ring-1 ring-purple-500/50";
                } else if (isCompleted) {
                  stateClasses = "text-emerald-400 hover:text-emerald-300 font-medium hover:bg-emerald-950/20 border-transparent";
                } else {
                  stateClasses = "text-zinc-500/70 hover:text-zinc-400 border-transparent opacity-60";
                }

                return (
                  <button
                    key={st.id}
                    disabled={isFuture && step < 8}
                    onClick={() => {
                      if (step < 8 && st.id < step) {
                        setStep(st.id);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border transition text-left font-mono shrink-0 md:shrink ${stateClasses} ${isCompleted ? 'cursor-pointer' : ''} ${isFuture ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-mono text-xs font-bold shrink-0 ${isActive ? 'text-purple-300' : isCompleted ? 'text-emerald-400' : 'text-zinc-600'}`}>
                        {st.id}.
                      </span>
                      <span className="truncate">
                        {st.name}
                      </span>
                    </div>
                    {isCompleted && (
                      <span className="text-emerald-400 font-black text-xs shrink-0 ml-1.5">✓</span>
                    )}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.9)] shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Monospace Progress Indicator */}
          <div className="pt-3 border-t border-white/10 shrink-0 mt-auto font-mono">
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              INSTALLATION STREAM
            </div>
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-purple-400 font-semibold tracking-wider uppercase">
                PROGRESS
              </div>
              <div className="text-[11px] tracking-tight text-purple-300 font-bold select-none whitespace-pre font-mono">
                {getBlockProgressBar(currentPercent)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STEP CONTENTS */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header Zone */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                Provisioning Node &bull; {candidateId.substring(0, 12)}
              </span>
              <h2 className="text-base font-black text-white tracking-tight mt-0.5">
                {stepsList.find(s => s.id === step)?.name} Configuration
              </h2>
            </div>
            {step < 8 && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Main content body scrollable viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* STEP 1: GAME TITLE */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">01. Select Game Service</h4>
                  <p className="text-xs text-zinc-500 mt-1">Choose the primary game title you wish to provision on this dedicated sandboxed node.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {GAMES.map((gm) => {
                    const isSelected = selectedGame === gm.id;
                    const isActive = gm.status === 'active';
                    const LogoComponent = gm.logo;
                    return (
                      <button
                        key={gm.id}
                        type="button"
                        disabled={!isActive}
                        onClick={() => setSelectedGame(gm.id)}
                        className={`flex flex-col text-left p-5 rounded-2xl border transition relative overflow-hidden group ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500/80 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/40'
                            : isActive
                            ? 'bg-zinc-950/30 border-white/5 hover:border-purple-500/25 cursor-pointer'
                            : 'bg-zinc-950/10 border-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <div className="w-12 h-12 rounded-xl bg-purple-900/20 border border-white/10 flex items-center justify-center p-1.5 shadow-md group-hover:scale-105 transition-transform">
                            <LogoComponent className="w-9 h-9" />
                          </div>
                          {isActive ? (
                            <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                              SUPPORTED
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded border border-white/5">
                              SOON
                            </span>
                          )}
                        </div>
                        <h5 className="text-sm font-extrabold text-white mt-4">{gm.name}</h5>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{gm.category} Instance</div>
                        <p className="text-xs text-zinc-400 mt-2 leading-relaxed flex-1">
                          {gm.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: SOFTWARE ENGINE */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">02. Select Software Engine</h4>
                  <p className="text-xs text-zinc-500 mt-1">Select the core execution framework. We distinguish Minecraft game engines from high-performance proxy aggregators.</p>
                </div>

                {/* Game Engines group */}
                <div className="space-y-3">
                  <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <Server className="w-3 h-3 text-purple-400" /> Minecraft Game Servers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ENGINES.filter(e => e.type === 'server').map((engine) => {
                      const EngineLogo = engine.logo;
                      return (
                        <button
                          key={engine.id}
                          type="button"
                          onClick={() => setSelectedEngine(engine)}
                          className={`flex flex-col text-left p-4 rounded-2xl border transition cursor-pointer group ${
                            selectedEngine?.id === engine.id
                              ? 'bg-purple-950/45 border-purple-500/80 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30'
                              : 'bg-zinc-950/40 border-white/5 hover:border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-white/10 flex items-center justify-center p-1 shadow group-hover:scale-105 transition-transform">
                                <EngineLogo className="w-7 h-7" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-white font-mono">{engine.name}</div>
                                <div className="text-[9px] font-mono text-zinc-500">Official Release</div>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 font-semibold">
                              Server
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed flex-1">
                            {engine.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
                            {engine.features.slice(0, 2).map((f, i) => (
                              <span key={i} className="text-[9px] font-mono text-zinc-500">&bull; {f}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Proxies group */}
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-indigo-400" /> Proxies & Edge Routers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ENGINES.filter(e => e.type === 'proxy').map((engine) => {
                      const EngineLogo = engine.logo;
                      return (
                        <button
                          key={engine.id}
                          type="button"
                          onClick={() => setSelectedEngine(engine)}
                          className={`flex flex-col text-left p-4 rounded-2xl border transition cursor-pointer group ${
                            selectedEngine?.id === engine.id
                              ? 'bg-indigo-950/45 border-indigo-500/80 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500/30'
                              : 'bg-zinc-950/40 border-white/5 hover:border-indigo-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-white/10 flex items-center justify-center p-1 shadow group-hover:scale-105 transition-transform">
                                <EngineLogo className="w-7 h-7" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-white font-mono">{engine.name}</div>
                                <div className="text-[9px] font-mono text-zinc-500">Edge Gateway</div>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-semibold">
                              Proxy
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed flex-1">
                            {engine.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
                            {engine.features.slice(0, 2).map((f, i) => (
                              <span key={i} className="text-[9px] font-mono text-zinc-500">&bull; {f}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: MINECRAFT / PROXY VERSION */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
                        03. {selectedEngine.type === 'proxy' ? 'Proxy Release Version' : 'Software Release Version'}
                      </h4>
                      {selectedEngine.type === 'proxy' && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                          PROXY SERVER
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {selectedEngine.type === 'proxy'
                        ? 'Specify your target proxy software distribution. We resolve builds directly from official upstream registries.'
                        : 'Specify your target Minecraft release. We resolve the version from real upstream API builders.'}
                    </p>
                  </div>
                </div>

                {/* Suggested upstream versions */}
                {availableVersions.length > 0 && (
                  <div className="p-3 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                      <span>Live Upstream Releases ({selectedEngine.name})</span>
                      {loadingVersions && <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" />}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableVersions.slice(0, 10).map((v) => {
                        const isSelected = versionInput.trim() === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              setVersionInput(v);
                              handleValidateVersionDirectly(selectedEngine.id, v);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-md shadow-purple-950/50'
                                : 'bg-black/40 border-white/5 text-zinc-300 hover:border-purple-500/30 hover:text-white'
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-2 font-mono uppercase tracking-wider">
                      {selectedEngine.type === 'proxy' ? 'Target Proxy Version' : 'Minecraft Version'}
                    </label>
                    <input
                      type="text"
                      value={versionInput}
                      onChange={(e) => {
                        setVersionInput(e.target.value);
                        setValidationResult(null);
                      }}
                      placeholder={selectedEngine.recommendedVersion}
                      className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none mb-3"
                    />
                    <button
                      type="button"
                      onClick={handleValidateVersion}
                      disabled={isValidating || !versionInput.trim()}
                      className="w-full py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer font-mono"
                    >
                      {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>{isValidating ? 'Validating Upstream...' : 'Verify Version'}</span>
                    </button>
                  </div>
                </div>

                {/* Validation Progress Card */}
                {isValidating && (
                  <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-center gap-3 font-mono animate-pulse">
                    <RefreshCw className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-white">Checking version...</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Querying official {selectedEngine.name} metadata service for {versionInput}
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Results Card */}
                {!isValidating && validationResult && (
                  <div className={`p-4 rounded-2xl border ${validationResult.valid ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'} space-y-3 font-mono`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        {validationResult.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-white">
                          {validationResult.valid ? '✓ Version verified & compatible' : '✕ Version unavailable'}
                        </span>
                      </div>
                      {validationResult.valid && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          Build #{validationResult.resolvedBuild}
                        </span>
                      )}
                    </div>

                    {validationResult.valid ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                            <div className="text-[10px] text-zinc-500">Release</div>
                            <div className="text-white font-bold">{validationResult.minecraftVersion}</div>
                          </div>
                          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                            <div className="text-[10px] text-zinc-500">Resolved Build</div>
                            <div className="text-purple-400 font-bold truncate">#{validationResult.resolvedBuild}</div>
                          </div>
                          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                            <div className="text-[10px] text-zinc-500">Required Java</div>
                            <div className="text-emerald-400 font-bold">Java {validationResult.javaVersion}</div>
                          </div>
                          <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                            <div className="text-[10px] text-zinc-500">Architecture</div>
                            <div className="text-cyan-400 font-bold">{selectedEngine.type === 'proxy' ? 'Proxy Routing' : 'Game Server'}</div>
                          </div>
                        </div>

                        {/* Checklist */}
                        <div className="space-y-1 pt-1 border-t border-white/5 text-[11px] text-emerald-300">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Version available in official registry</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Build resolved: #{validationResult.resolvedBuild}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download available from official upstream</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Java {validationResult.javaVersion} required & configured</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Engine compatible with host daemon</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-300 leading-relaxed">
                        {validationResult.error || `The selected version '${versionInput}' is unsupported or invalid on ${selectedEngine.name}.`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: RESOURCE ALLOCATION */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">04. Hardware Specs & Port Allocations</h4>
                  <p className="text-xs text-zinc-500 mt-1">Specify dedicated memory, CPU threads, SSD limits, JDK version, and port bindings. Disk quotas are strictly enforced.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* RAM */}
                  <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                        MEMORY (RAM)
                      </span>
                      <div className="text-xl font-bold text-white font-mono mt-1.5">{ramLimitGb} GB</div>
                    </div>
                    <div className="py-1">
                      <input
                        type="range"
                        min="1"
                        max="16"
                        step="1"
                        value={ramLimitGb}
                        onChange={(e) => setRamLimitGb(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                      JVM heap size constraints applied to the virtual thread environment.
                    </p>
                  </div>

                  {/* CPU Cores */}
                  <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                        CPU
                      </span>
                      <div className="text-xl font-bold text-white font-mono mt-1.5">{cpuCores} Cores</div>
                    </div>
                    <div className="py-1">
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={cpuCores}
                        onChange={(e) => setCpuCores(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                      Isolates process threads dynamically using Linux CPU shares constraints.
                    </p>
                  </div>

                  {/* Enforced Disk Storage */}
                  <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">
                        NVMe SSD
                      </span>
                      <div className="text-xl font-bold text-white font-mono mt-1.5">{diskLimitGb} GB</div>
                    </div>
                    <div className="py-1">
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={diskLimitGb}
                        onChange={(e) => setDiskLimitGb(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                      REAL limit enforced on container storage. Used: 0 GB / Limit: {diskLimitGb} GB
                    </p>
                  </div>
                </div>

                {/* Additional Core Resources parameters: JDK selection & Port Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Java Compatibility */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-purple-400" /> Java compatibility
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">Required: Java {validationResult?.javaVersion || '21'}</span>
                    </div>

                    <div className="space-y-2">
                      {loadingJavas ? (
                        <div className="text-xs text-zinc-400 font-mono italic">Loading runtimes...</div>
                      ) : (
                        installedJavas.map((j) => {
                          const isSelected = customJavaVersion === String(j.major);
                          const isRequired = String(j.major) === (validationResult?.javaVersion || '21');
                          return (
                            <button
                              key={j.version}
                              type="button"
                              onClick={() => setCustomJavaVersion(String(j.major))}
                              className={`w-full flex items-center justify-between p-2 rounded-xl border text-left cursor-pointer transition text-xs font-mono ${
                                isSelected
                                  ? 'bg-purple-950/50 border-purple-500/80 text-white'
                                  : 'bg-black/35 border-white/5 text-zinc-400 hover:border-white/10'
                              }`}
                            >
                              <span>OpenJDK {j.major} (LTS)</span>
                              {isRequired && (
                                <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                  COMPATIBLE
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {customJavaVersion !== (validationResult?.javaVersion || '21') && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                        <AlertTriangle className="w-3 h-3 shrink-0" /> Incompatible Java version warning
                      </p>
                    )}
                  </div>

                  {/* Network Port allocation */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-indigo-400" /> Port Allocation
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">0.0.0.0</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500">Manual Allocation override:</label>
                      <input
                        type="number"
                        min="1024"
                        max="65535"
                        value={serverPort}
                        onChange={(e) => setServerPort(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono glass-input rounded-xl text-white focus:outline-none"
                      />
                      {(() => {
                        const isPortTaken = servers.some(s => Number(s.primaryPort) === serverPort);
                        const isPortAllocated = allAllocations.some(a => Number(a.port) === serverPort && a.serverId && a.serverId !== candidateId);
                        if (isPortTaken || isPortAllocated) {
                          return <p className="text-[9px] text-rose-400 font-mono">&bull; Selected Port already bound to another server node.</p>;
                        }
                        return <p className="text-[9px] text-emerald-400 font-mono">&bull; Address bindings are clear and allocatable.</p>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: NODE SELECTION */}
            {step === 5 && (
              <div className="space-y-4 font-mono">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">05. Node</h4>
                  <p className="text-xs text-zinc-500 mt-1">Select an active hosting hardware node cluster connected via real daemon heartbeat.</p>
                </div>

                {loadingNodes ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                    <span className="text-xs font-mono text-zinc-400">Querying real node daemon heartbeat...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {nodes.map((node) => {
                      const isSelected = selectedLocation === node.id || selectedNode?.id === node.id;
                      const isOnline = node.status === 'ONLINE' && node.daemonStatus !== 'Unreachable';

                      return (
                        <div
                          key={node.id}
                          onClick={() => {
                            if (!isOnline) {
                              showToast('error', `Selected node "${node.name}" is currently OFFLINE and cannot accept new server deployments.`);
                              return;
                            }
                            setSelectedNode(node);
                            setSelectedLocation(node.id);
                          }}
                          className={`flex flex-col text-left p-4.5 rounded-2xl border transition relative overflow-hidden h-full ${
                            isSelected && isOnline
                              ? 'bg-purple-950/45 border-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/50 cursor-pointer'
                              : isOnline
                              ? 'bg-zinc-950/50 border-white/10 hover:border-purple-500/30 cursor-pointer'
                              : 'bg-zinc-950/20 border-white/5 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {/* Header: Name and Online/Offline State */}
                          <div className="flex items-center justify-between w-full border-b border-white/10 pb-2.5 mb-3">
                            <span className="text-sm font-bold text-white font-mono">{node.name}</span>
                            <span
                              className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                isOnline
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                          
                          {/* Body details */}
                          <div className="space-y-2.5 text-xs font-mono flex-1 mb-3">
                            <div>
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Location:</div>
                              <div className="text-white font-semibold text-xs mt-0.5">{node.location || 'India'}</div>
                            </div>

                            <div>
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Description:</div>
                              <div className="text-zinc-300 text-xs mt-0.5 leading-relaxed">{node.description || 'Primary Minecraft hosting node'}</div>
                            </div>

                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Resources:</div>
                              <div className="text-xs text-zinc-300">
                                RAM: <span className="text-purple-300 font-bold">{node.allocatedMemoryGb || 0} GB</span> / {node.maxMemoryGb || 32} GB
                              </div>
                              <div className="text-xs text-zinc-300">
                                CPU: <span className="text-indigo-300 font-bold">{node.allocatedCpuCores || 0}</span> / {node.maxCpuCores || 16} cores
                              </div>
                              <div className="text-xs text-zinc-300">
                                Disk: <span className="text-emerald-300 font-bold">{node.allocatedDiskGb || 0} GB</span> / {node.maxDiskGb || 500} GB
                              </div>
                            </div>
                          </div>

                          {/* Footer Daemon State & Selection Tag */}
                          <div className="text-[10px] text-zinc-500 font-mono w-full flex justify-between border-t border-white/5 pt-2 mt-auto">
                            <span>Daemon: {node.daemonStatus || (isOnline ? 'Connected' : 'Unreachable')}</span>
                            {isSelected && isOnline ? (
                              <span className="text-purple-400 font-bold">Selected Node ✓</span>
                            ) : !isOnline ? (
                              <span className="text-rose-400 font-semibold">Offline (Cannot Deploy)</span>
                            ) : (
                              <span className="text-zinc-500 hover:text-white">Click to Select</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: SERVER DETAILS */}
            {step === 6 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">06. Server Identity & Allocation Metadata</h4>
                  <p className="text-xs text-zinc-500 mt-1">Configure public identifiers. The background daemon creates a private sandboxed namespace.</p>
                </div>

                <div className="space-y-4 bg-zinc-950/60 p-5 rounded-2xl border border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1.5 font-mono">SERVER NAME *</label>
                      <input
                        type="text"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="Ultimate Craft SMP"
                        className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white font-mono placeholder-zinc-700 focus:outline-none"
                      />
                      <p className="text-[9px] text-zinc-500 mt-1">Must be at least 3 characters. Appears in navigation headers.</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1.5 font-mono">SERVER INSTANCE ID (AUTO)</label>
                      <div className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/5 rounded-xl text-purple-300 font-mono flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>{candidateId}</span>
                      </div>
                      <p className="text-[9px] text-zinc-500 mt-1">Cryptographic node reference assigned automatically.</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1.5 font-mono">SERVER DESCRIPTION</label>
                    <input
                      type="text"
                      value={serverDescription}
                      onChange={(e) => setServerDescription(e.target.value)}
                      placeholder="Survival world with plugins and administrative safeguards."
                      className="w-full px-3 py-2.5 text-xs glass-input rounded-xl text-white placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Advanced configuration options (Specific to selected engine type) */}
                <div className="p-4 rounded-xl bg-zinc-950/30 border border-white/5 space-y-3">
                  <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-white/5">
                    {selectedEngine.type === 'server' ? 'Minecraft Settings Tuning' : 'Proxy Routing Options'}
                  </div>

                  {selectedEngine.type === 'server' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Difficulty</label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none"
                        >
                          <option value="peaceful">Peaceful</option>
                          <option value="easy">Easy</option>
                          <option value="normal">Normal</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Gamemode</label>
                        <select
                          value={gamemode}
                          onChange={(e) => setGamemode(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none"
                        >
                          <option value="survival">Survival</option>
                          <option value="creative">Creative</option>
                          <option value="adventure">Adventure</option>
                          <option value="spectator">Spectator</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">View Dist.</label>
                        <input
                          type="number"
                          value={viewDistance}
                          min="3"
                          max="32"
                          onChange={(e) => setViewDistance(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Simulation</label>
                        <input
                          type="number"
                          value={simulationDistance}
                          min="3"
                          max="32"
                          onChange={(e) => setSimulationDistance(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlineMode}
                          onChange={(e) => setOnlineMode(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 bg-zinc-900 border-zinc-700"
                        />
                        <span>Mojang Bungee Authentication (Online-Mode)</span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1 font-mono">Timezone (JVM Environment)</label>
                      <input
                        type="text"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1 font-mono">Min heap size (e.g. 512M)</label>
                      <input
                        type="text"
                        value={minRamGb}
                        onChange={(e) => setMinRamGb(e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-950 border border-white/5 text-white rounded focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: REVIEW */}
            {step === 7 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">07. Review Configuration & EULA</h4>
                  <p className="text-xs text-zinc-500 mt-1">Double check specified parameters. Click Deploy Server once EULA is checked.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Meta Table */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-3">
                    <div className="text-[10px] text-zinc-400 font-bold border-b border-white/5 pb-1 flex items-center gap-2">
                      <MinecraftLogo className="w-4 h-4" />
                      <span>SERVER CONFIGURATION</span>
                    </div>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Server Name:</span>
                        <span className="text-white font-bold">{serverName || `${selectedEngine.id} Server`}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Engine:</span>
                        <span className="text-purple-400 font-bold flex items-center gap-1.5">
                          {React.createElement(selectedEngine.logo, { className: 'w-4 h-4' })}
                          <span>{selectedEngine.name}</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Minecraft Version:</span>
                        <span className="text-white font-bold">{versionInput}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Resolved Build:</span>
                        <span className="text-emerald-400 font-bold">#{validationResult?.resolvedBuild || 'Latest'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Java Runtime:</span>
                        <span className="text-white font-bold">Java {customJavaVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Location:</span>
                        <span className="text-indigo-400 font-bold">
                          {nodes.find(n => n.id === selectedLocation)?.location || selectedNode?.location || 'India'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Target Node:</span>
                        <span className="text-purple-300 font-bold">
                          {nodes.find(n => n.id === selectedLocation)?.name || selectedNode?.name || 'Node 01'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Server Port:</span>
                        <span className="text-emerald-400 font-bold">:{serverPort}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hardware Alloc summary */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-3">
                    <div className="text-[10px] text-zinc-400 font-bold border-b border-white/5 pb-1">HARDWARE ALLOCATIONS</div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="p-2.5 bg-black/40 rounded-xl border border-white/5">
                        <div className="text-zinc-500 font-mono">RAM</div>
                        <div className="text-purple-400 font-black text-sm mt-1">{ramLimitGb} GB</div>
                      </div>
                      <div className="p-2.5 bg-black/40 rounded-xl border border-white/5">
                        <div className="text-zinc-500 font-mono">CPU</div>
                        <div className="text-indigo-400 font-black text-sm mt-1">{cpuCores} Cores</div>
                      </div>
                      <div className="p-2.5 bg-black/40 rounded-xl border border-white/5">
                        <div className="text-zinc-500 font-mono">Disk Limit</div>
                        <div className="text-emerald-400 font-black text-sm mt-1">{diskLimitGb} GB</div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-[9px] text-zinc-500 font-mono">Startup Command:</span>
                      <div className="p-2 bg-black/60 rounded border border-white/5 text-[10px] text-zinc-400 break-all leading-relaxed whitespace-pre-wrap max-h-16 overflow-y-auto font-mono">
                        {customStartupCommand}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Minecraft EULA Agree */}
                {selectedEngine.type === 'proxy' ? (
                  <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-2 font-mono">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-cyan-400 shrink-0" /> Proxy Network Distribution Mode
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {selectedEngine.name} operates as a high-performance network proxy. Proxy instances route player traffic to backend game nodes and do not require Minecraft world EULA consent.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-3">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-purple-400 shrink-0" /> End-User License Agreement Consent
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">
                      To start a Minecraft server, you must explicitly accept Mojang's official End-User License Agreement. By checking this option, you authorize the daemon to accept EULA terms automatically.
                    </p>

                    <label className="flex items-start gap-3 p-3 bg-zinc-950/85 rounded-xl cursor-pointer hover:bg-zinc-900 border border-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={acceptEula}
                        onChange={(e) => setAcceptEula(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-purple-600 focus:ring-purple-500 bg-zinc-900 border-zinc-700 shrink-0 accent-purple-600 cursor-pointer"
                      />
                      <div className="text-xs text-zinc-200">
                        <div className="font-semibold text-white">I agree to the Minecraft EULA terms</div>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">Authorize daemon installation mechanisms.</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* STEP 8: DEDEPLOY */}
            {step === 8 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center p-1.5 shadow-md shrink-0">
                    {React.createElement(selectedEngine.logo, { className: 'w-8 h-8' })}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      08. Real Server Daemon Provisioning Stream
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                      Deploying {selectedEngine.name} {versionInput} to {nodes.find(n => n.id === selectedLocation)?.name || selectedNode?.name || 'Node 01'} ({nodes.find(n => n.id === selectedLocation)?.location || selectedNode?.location || 'India'}).
                    </p>
                  </div>
                </div>

                {/* Download stream telemetry */}
                {deployProgress?.formattedDownload && (
                  <div className="p-3 bg-purple-950/25 border border-purple-500/30 rounded-2xl flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
                      <span className="text-zinc-300">Streaming upstream binary:</span>
                      <span className="text-purple-300 font-bold truncate">{deployProgress.formattedDownload}</span>
                    </div>
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-purple-500/20 shrink-0">
                      {deployProgress.percent}%
                    </span>
                  </div>
                )}

                {/* checklist steps */}
                {deployProgress && (
                  <div className="p-4 bg-zinc-950/45 border border-white/5 rounded-2xl text-xs space-y-2">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-white/5 mb-1.5 font-mono">
                      DEPLOYMENT PHASE LIST
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                      {deployProgress.steps.map((st: any, i: number) => {
                        let icon = <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />;
                        let color = 'text-zinc-500';
                        if (st.status === 'completed') {
                          icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                          color = 'text-emerald-400 font-semibold';
                        } else if (st.status === 'active') {
                          icon = <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />;
                          color = 'text-purple-300 font-bold';
                        } else if (st.status === 'failed') {
                          icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
                          color = 'text-rose-400 font-semibold';
                        }
                        return (
                          <div key={i} className={`flex items-center gap-2 text-xs truncate p-1 rounded-lg ${st.status === 'active' ? 'bg-purple-950/15 border border-purple-500/10' : ''}`}>
                            {icon}
                            <span className={`${color} truncate`}>{st.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* logs terminal stream */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                    Real-time Daemon Stdout Output Log
                  </div>
                  <div className="font-mono text-zinc-300 text-[11px] bg-black/90 p-4 rounded-2xl h-52 overflow-y-auto leading-relaxed border border-white/5 space-y-1 flex flex-col">
                    {deployProgress?.logs?.map((l: string, i: number) => {
                      let color = 'text-zinc-300';
                      if (l.includes('[ERROR]') || l.includes('failed')) color = 'text-rose-400 font-bold';
                      else if (l.includes('[Installer]')) color = 'text-purple-300';
                      else if (l.includes('[Minecraft stdout]')) color = 'text-zinc-400';
                      return <div key={i} className={`whitespace-pre-wrap break-all ${color}`}>{l}</div>;
                    })}
                    {(!deployProgress?.logs || deployProgress.logs.length === 0) && (
                      <div className="text-zinc-500 italic text-center py-20">Initializing daemon connection log stream...</div>
                    )}
                    <div ref={terminalBottomRef} />
                  </div>
                </div>

                {/* Successful state */}
                {deployProgress?.status === 'completed' && (
                  <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex flex-col items-center text-center space-y-2.5 animate-fadeIn">
                    <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
                    <div className="text-sm font-extrabold text-white font-mono">🚀 Sandboxed Minecraft Node Running!</div>
                    <p className="text-xs text-emerald-300/95 leading-relaxed font-mono">
                      Allocation complete on port :{serverPort}. Background deployment succeeded.
                    </p>
                    <button
                      type="button"
                      onClick={() => onDeploySuccess(deploymentServerId || candidateId)}
                      className="mt-2 px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer font-mono active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ OPEN SERVER CONSOLE / DASHBOARD NOW →</span>
                    </button>
                  </div>
                )}

                {/* Error screen */}
                {deployError && (
                  <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col items-center text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                    <div className="text-sm font-extrabold text-white font-mono">⚠ Deployment Process Interrupted</div>
                    <p className="text-xs text-rose-300 max-w-lg leading-relaxed font-mono">
                      {deployError}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(7);
                        setDeployError(null);
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl mt-1 cursor-pointer font-mono"
                    >
                      Adjust specs and retry
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Control Buttons */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-black/20 shrink-0 font-mono">
            {step < 8 ? (
              <>
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-mono"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : <div />}

                {step < 7 ? (
                  <button
                    type="button"
                    disabled={!canContinueStep()}
                    onClick={() => setStep(step + 1)}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-mono"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canContinueStep()}
                    onClick={handleDeployServer}
                    className="px-6 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer font-mono"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>🚀 DEPLOY SERVER</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-mono text-zinc-400">
                  {deployProgress?.status === 'completed'
                    ? '✓ Deployment complete. Ready for console control.'
                    : deployError
                    ? '✕ Deployment interrupted.'
                    : '⚡ Daemon executing server setup...'}
                </span>
                {deployProgress?.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => onDeploySuccess(deploymentServerId || candidateId)}
                    className="px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer font-mono active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>GO TO SERVER DASHBOARD →</span>
                  </button>
                )}
                {deployError && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(7);
                      setDeployError(null);
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition cursor-pointer font-mono"
                  >
                    Retry Configuration
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
