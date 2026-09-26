import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Download, Trash2, Check, RefreshCw,
  FolderOpen, Shield, Globe, Coins, Zap, Activity, FileCode,
  Lock, Smartphone, Network, AlertCircle, ExternalLink, HardDrive,
  Filter, Sparkles, Layers, Box, CheckCircle2, ChevronRight, ToggleLeft,
  ToggleRight, AlertTriangle, Upload, Plus, Server as ServerIcon, X
} from 'lucide-react';

interface ModrinthProject {
  project_id: string;
  project_type: 'mod' | 'plugin';
  slug: string;
  author: string;
  title: string;
  description: string;
  categories: string[];
  display_categories?: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url?: string;
  date_created: string;
  date_modified: string;
  latest_version?: string;
  client_side?: string;
  server_side?: string;
}

interface InstalledAddon {
  filename: string;
  enabled: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  mtime: string;
  cleanName: string;
}

interface PluginManagerProps {
  serverId: string;
  token: string;
  software?: string;
  mcVersion?: string;
}

export const PluginManager: React.FC<PluginManagerProps> = ({
  serverId,
  token,
  software = 'Paper',
  mcVersion = '1.21.1'
}) => {
  const isVanilla = software.toLowerCase() === 'vanilla';
  const isModLoader = software.toLowerCase() === 'fabric' || software.toLowerCase() === 'forge' || software.toLowerCase() === 'neoforge';
  const loaderName = software.toLowerCase();

  // Tabs: Marketplace, Installed, or Software Engine
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed' | 'software'>('marketplace');

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'>('downloads');
  const [searchResults, setSearchResults] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Installed State
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState<boolean>(false);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installSuccessMessage, setInstallSuccessMessage] = useState<string | null>(null);
  const [deleteAddonConfirm, setDeleteAddonConfirm] = useState<string | null>(null);

  // Direct JAR upload
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAddon, setIsUploadingAddon] = useState(false);

  // Fetch installed addons from server disk
  const fetchInstalledAddons = async () => {
    try {
      setLoadingInstalled(true);
      const res = await fetch(`/api/servers/${serverId}/installed-addons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstalledAddons(data.addons || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingInstalled(false);
    }
  };

  useEffect(() => {
    fetchInstalledAddons();
  }, [serverId]);

  // Search Modrinth API via backend proxy
  const searchModrinth = async () => {
    if (isVanilla) return;
    try {
      setLoading(true);
      setError(null);

      const facetsArray: string[][] = [];

      if (isModLoader) {
        facetsArray.push(['project_type:mod']);
        if (loaderName === 'fabric') facetsArray.push(['categories:fabric']);
        else if (loaderName === 'forge') facetsArray.push(['categories:forge']);
        else if (loaderName === 'neoforge') facetsArray.push(['categories:neoforge']);
      } else {
        facetsArray.push(['project_type:plugin']);
        facetsArray.push(['categories:paper', 'categories:spigot', 'categories:purpur', 'categories:bukkit']);
      }

      if (selectedCategory && selectedCategory !== 'all') {
        facetsArray.push([`categories:${selectedCategory}`]);
      }

      const facetsJson = JSON.stringify(facetsArray);
      const queryParams = new URLSearchParams({
        query: searchQuery,
        facets: facetsJson,
        index: sortBy,
        limit: '24'
      });

      const res = await fetch(`/api/modrinth/search?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Modrinth query returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch (err: any) {
      setError(err.message || 'Failed to search Modrinth');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isVanilla) {
      const timer = setTimeout(() => {
        searchModrinth();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, selectedCategory, sortBy, software]);

  // Install Project from Modrinth
  const handleInstallProject = async (project: ModrinthProject) => {
    try {
      setInstallingIds(prev => new Set(prev).add(project.project_id));
      setError(null);
      setInstallSuccessMessage(null);

      const loadersParam = isModLoader ? loaderName : 'paper,spigot,purpur,bukkit';
      const vRes = await fetch(`/api/modrinth/project/${project.project_id}/version?loaders=${encodeURIComponent(loadersParam)}&game_versions=${encodeURIComponent(mcVersion)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!vRes.ok) {
        throw new Error('Failed to fetch compatible version metadata from Modrinth');
      }

      let versions = await vRes.json();
      if (!versions || versions.length === 0) {
        const vResFallback = await fetch(`/api/modrinth/project/${project.project_id}/version?loaders=${encodeURIComponent(loadersParam)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (vResFallback.ok) {
          versions = await vResFallback.json();
        }
      }

      if (!versions || versions.length === 0) {
        throw new Error(`No compatible release found on Modrinth for ${software} ${mcVersion}`);
      }

      const primaryVersion = versions[0];
      const primaryFile = primaryVersion.files?.find((f: any) => f.primary) || primaryVersion.files?.[0];

      if (!primaryFile || !primaryFile.url) {
        throw new Error('No downloadable JAR file found in version release');
      }

      const instRes = await fetch(`/api/servers/${serverId}/modrinth/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileUrl: primaryFile.url,
          filename: primaryFile.filename,
          projectId: project.project_id,
          projectName: project.title,
          versionId: primaryVersion.id,
          dependencies: primaryVersion.dependencies || []
        })
      });

      const instData = await instRes.json();
      if (!instRes.ok) throw new Error(instData.error || 'Installation failed');

      setInstallSuccessMessage(`Installed ${project.title} (${instData.filename}) into ${instData.path}!`);
      fetchInstalledAddons();
    } catch (err: any) {
      setError(err.message || `Failed to install ${project.title}`);
    } finally {
      setInstallingIds(prev => {
        const next = new Set(prev);
        next.delete(project.project_id);
        return next;
      });
    }
  };

  // Toggle enable/disable addon
  const handleToggleAddon = async (filename: string) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/installed-addons/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        fetchInstalledAddons();
      }
    } catch {
      // Ignore
    }
  };

  // Delete installed addon
  const executeDeleteAddon = async (filename: string) => {
    try {
      const targetSubdir = isModLoader ? 'mods' : 'plugins';
      const res = await fetch(`/api/servers/${serverId}/files/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: `${targetSubdir}/${filename}` })
      });
      if (res.ok) {
        setDeleteAddonConfirm(null);
        fetchInstalledAddons();
      }
    } catch {
      // Ignore
    }
  };

  // Upload custom .jar directly
  const handleCustomJarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAddon(true);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1] || (reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const targetSubdir = isModLoader ? 'mods' : 'plugins';
      const targetPath = `${targetSubdir}/${file.name}`;

      const res = await fetch(`/api/servers/${serverId}/files/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: targetPath, base64 })
      });

      if (!res.ok) throw new Error('Failed to upload addon');
      setInstallSuccessMessage(`Uploaded ${file.name} to /${targetSubdir}/`);
      fetchInstalledAddons();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploadingAddon(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // Category filters
  const categoryOptions = isModLoader ? [
    { id: 'all', label: 'All Categories' },
    { id: 'optimization', label: 'Optimization' },
    { id: 'utility', label: 'Utility' },
    { id: 'technology', label: 'Technology' },
    { id: 'magic', label: 'Magic' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'decoration', label: 'Decoration' },
    { id: 'worldgen', label: 'World Gen' }
  ] : [
    { id: 'all', label: 'All Categories' },
    { id: 'management', label: 'Management' },
    { id: 'utility', label: 'Utility' },
    { id: 'economy', label: 'Economy' },
    { id: 'security', label: 'Security' },
    { id: 'chat', label: 'Chat & Social' },
    { id: 'minigame', label: 'Minigames' },
    { id: 'worldgen', label: 'World Generation' }
  ];

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Header Banner */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-zinc-950/60 to-indigo-950/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Official Modrinth API v2
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {isModLoader ? '/mods/' : '/plugins/'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              {isModLoader ? `${software} Mod Manager` : 'Paper & Spigot Plugin Manager'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mt-1">
              Search and 1-click install verified {isModLoader ? 'mods' : 'plugins'} directly from Modrinth. Compatible with Minecraft {mcVersion}.
            </p>
          </div>

          {/* Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/60 border border-white/10 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'marketplace'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Modrinth Catalog
            </button>
            <button
              onClick={() => { setActiveTab('installed'); fetchInstalledAddons(); }}
              className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'installed'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Installed</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-purple-300 font-mono">
                {installedAddons.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('software')}
              className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'software'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Server Engines
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 font-mono">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {installSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{installSuccessMessage}</span>
          </div>
          <button onClick={() => setInstallSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: MODRINTH CATALOG / MARKETPLACE */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6">
          {/* Search & Filters Controls */}
          <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search Modrinth for ${isModLoader ? 'mods' : 'plugins'} (e.g. Essentials, LuckPerms, WorldEdit, ViaVersion)...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs glass-input rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs glass-input rounded-xl text-zinc-300 focus:outline-none cursor-pointer"
              >
                {categoryOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs glass-input rounded-xl text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="downloads">Most Downloaded</option>
                <option value="relevance">Highest Relevance</option>
                <option value="follows">Most Followed</option>
                <option value="updated">Recently Updated</option>
                <option value="newest">Newest</option>
              </select>

              <button
                onClick={searchModrinth}
                disabled={loading}
                className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs transition cursor-pointer disabled:opacity-50"
                title="Refresh Search"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {searchResults.map((item) => {
              const isInstalling = installingIds.has(item.project_id);
              const isInstalled = installedAddons.some(a => a.filename.toLowerCase().includes(item.slug.toLowerCase()));

              return (
                <div
                  key={item.project_id}
                  className="glass-panel rounded-2xl border border-white/5 hover:border-purple-500/40 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-md"
                >
                  {/* Top Details */}
                  <div className="flex items-start gap-3">
                    {item.icon_url ? (
                      <img
                        src={item.icon_url}
                        alt={item.title}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-zinc-900 border border-white/10 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-sm font-bold text-white truncate" title={item.title}>
                          {item.title}
                        </h3>
                        {isInstalled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            Installed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-purple-400 font-medium truncate">by {item.author}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2 min-h-[32px]">
                    {item.description}
                  </p>

                  {/* Tags and Stats */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 font-mono">
                      <span>{(item.downloads || 0).toLocaleString()} dl</span>
                      <span>·</span>
                      <span className="capitalize">{item.project_type}</span>
                    </div>

                    <a
                      href={`https://modrinth.com/${item.project_type}/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-[11px]"
                    >
                      <span>Modrinth</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Install Button */}
                  <button
                    onClick={() => handleInstallProject(item)}
                    disabled={isInstalling}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      isInstalled
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/30'
                    } disabled:opacity-50`}
                  >
                    {isInstalling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Downloading from Modrinth...</span>
                      </>
                    ) : isInstalled ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reinstall / Update</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Install Compatible Version</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {searchResults.length === 0 && !loading && (
            <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center space-y-2">
              <Box className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">No matching projects found on Modrinth</p>
              <p className="text-xs text-zinc-500">Try adjusting your search query or category filter.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: INSTALLED ADDONS LIST */}
      {activeTab === 'installed' && (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-black/40 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-purple-400" />
              Installed {isModLoader ? 'Mods' : 'Plugins'} on Disk ({installedAddons.length})
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".jar"
                ref={uploadInputRef}
                onChange={handleCustomJarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploadingAddon}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingAddon ? 'Uploading...' : 'Upload .jar'}</span>
              </button>

              <button
                onClick={fetchInstalledAddons}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center gap-1 border border-white/10"
                title="Rescan Directory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInstalled ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {installedAddons.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No {isModLoader ? 'mods' : 'plugins'} found in /{isModLoader ? 'mods' : 'plugins'}. Browse the Modrinth catalog to install one.
              </div>
            ) : (
              installedAddons.map((addon) => (
                <div
                  key={addon.filename}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{addon.cleanName}</span>
                        {addon.enabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-zinc-400 mt-0.5 truncate">
                        {addon.filename} · {addon.sizeFormatted}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleAddon(addon.filename)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {addon.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-zinc-500" />}
                      <span>{addon.enabled ? 'Disable' : 'Enable'}</span>
                    </button>

                    <button
                      onClick={() => setDeleteAddonConfirm(addon.filename)}
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs transition cursor-pointer"
                      title="Remove from server"
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

      {/* VIEW 3: SERVER ENGINE SELECTOR */}
      {activeTab === 'software' && (
        <div className="glass-panel p-6 rounded-2xl sm:rounded-3xl border border-white/5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ServerIcon className="w-5 h-5 text-purple-400" /> Supported Minecraft Software Engines
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Craft Command Center natively manages official engine jars with verified OpenJDK 17, 21, and 25 runtimes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: 'Paper',
                badge: 'Recommended',
                desc: 'Ultra high-performance Spigot fork with asynchronous chunk loading, timings v2, and full Bukkit/Spigot plugin compatibility.',
                active: software.toLowerCase() === 'paper'
              },
              {
                name: 'Purpur',
                badge: 'Customizable',
                desc: 'Drop-in Paper replacement designed for extensive gameplay customization, rideable mobs, and TPS optimizations.',
                active: software.toLowerCase() === 'purpur'
              },
              {
                name: 'Fabric',
                badge: 'Modding',
                desc: 'Lightweight, modern, modular mod loader with near-instant updates for modern Minecraft versions.',
                active: software.toLowerCase() === 'fabric'
              },
              {
                name: 'Velocity',
                badge: 'Proxy',
                desc: 'Next-generation Minecraft proxy with unmatched performance and robust DDoS mitigation.',
                active: software.toLowerCase() === 'velocity'
              },
              {
                name: 'Forge',
                badge: 'Classic Mods',
                desc: 'The traditional heavy-modding platform supporting massive technology and magic modpacks.',
                active: software.toLowerCase() === 'forge'
              },
              {
                name: 'Vanilla',
                badge: 'Mojang Core',
                desc: 'Official unaltered Minecraft server binary directly from Mojang Studios.',
                active: software.toLowerCase() === 'vanilla'
              }
            ].map((eng) => (
              <div
                key={eng.name}
                className={`p-4 rounded-2xl border transition-all ${
                  eng.active
                    ? 'bg-purple-950/40 border-purple-500/60 shadow-lg'
                    : 'bg-black/30 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{eng.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    eng.active ? 'bg-purple-500/30 text-purple-300' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {eng.active ? 'CURRENT ACTIVE' : eng.badge}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{eng.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Addon Confirmation Modal */}
      {deleteAddonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Remove Addon
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to remove <span className="text-white font-mono font-bold">"{deleteAddonConfirm}"</span> from the server?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteAddonConfirm(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteAddon(deleteAddonConfirm)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
