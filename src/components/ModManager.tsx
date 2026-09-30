// Component: ModManager
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Download, Trash2, Check, RefreshCw,
  FolderOpen, Shield, Globe, Zap, FileCode, AlertCircle,
  ExternalLink, Boxes, Box, CheckCircle2, ChevronRight,
  ToggleLeft, ToggleRight, Upload, X, ArrowLeft, ArrowRight
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

interface InstalledMod {
  filename: string;
  enabled: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  mtime: string;
  cleanName: string;
}

interface ModManagerProps {
  serverId: string;
  token: string;
  software?: string;
  mcVersion?: string;
  isServerRunning?: boolean;
}

export const ModManager: React.FC<ModManagerProps> = ({
  serverId,
  token,
  software = 'Fabric',
  mcVersion = '1.21.1',
  isServerRunning = false
}) => {
  const loaderName = (software || 'Fabric').toLowerCase();

  // Tabs: Marketplace or Installed mods
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed'>('marketplace');

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'>('downloads');
  const [searchResults, setSearchResults] = useState<ModrinthProject[]>([]);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [pageSize, setPageBy] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Installed State
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState<boolean>(false);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installSuccessMessage, setInstallSuccessMessage] = useState<string | null>(null);
  const [deleteModConfirm, setDeleteModConfirm] = useState<string | null>(null);

  // Direct JAR upload
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingMod, setIsUploadingMod] = useState(false);
  const marketplaceTopRef = useRef<HTMLDivElement | null>(null);

  // Fetch installed mods from server disk
  const fetchInstalledMods = async () => {
    try {
      setLoadingInstalled(true);
      const res = await fetch(`/api/servers/${serverId}/installed-mods`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstalledMods(data.mods || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingInstalled(false);
    }
  };

  useEffect(() => {
    fetchInstalledMods();
  }, [serverId]);

  // Search Modrinth API via backend proxy
  const searchModrinth = async () => {
    try {
      setLoading(true);
      setError(null);

      const facetsArray: string[][] = [];
      facetsArray.push(['project_type:mod']);
      
      // Auto filter based on current server loader
      if (loaderName === 'fabric') facetsArray.push(['categories:fabric']);
      else if (loaderName === 'forge') facetsArray.push(['categories:forge']);
      else if (loaderName === 'neoforge') facetsArray.push(['categories:neoforge']);

      if (selectedCategory && selectedCategory !== 'all') {
        facetsArray.push([`categories:${selectedCategory}`]);
      }

      const offset = (currentPage - 1) * pageSize;
      const facetsJson = JSON.stringify(facetsArray);
      const queryParams = new URLSearchParams({
        query: searchQuery,
        facets: facetsJson,
        index: sortBy,
        limit: pageSize.toString(),
        offset: offset.toString()
      });

      const res = await fetch(`/api/modrinth/search?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Modrinth query returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setSearchResults(data.hits || []);
      setTotalHits(data.total_hits || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to search Modrinth');
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
    if (marketplaceTopRef.current) {
      marketplaceTopRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchQuery, selectedCategory, sortBy, pageSize]);

  // Trigger search when query or page changes
  useEffect(() => {
    const timer = setTimeout(() => {
      searchModrinth();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, sortBy, pageSize, currentPage]);

  // Install Project from Modrinth
  const handleInstallMod = async (project: ModrinthProject) => {
    try {
      setInstallingIds(prev => new Set(prev).add(project.project_id));
      setError(null);
      setInstallSuccessMessage(null);

      const loadersParam = loaderName;
      const vRes = await fetch(`https://api.modrinth.com/v2/project/${project.project_id}/version?loaders=${encodeURIComponent(`["${loadersParam}"]`)}&game_versions=${encodeURIComponent(`["${mcVersion}"]`)}`);

      if (!vRes.ok) {
        throw new Error('Failed to fetch compatible version metadata from Modrinth');
      }

      let versions = await vRes.json();
      if (!versions || versions.length === 0) {
        const vResFallback = await fetch(`https://api.modrinth.com/v2/project/${project.project_id}/version?loaders=${encodeURIComponent(`["${loadersParam}"]`)}`);
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

      const instRes = await fetch(`/api/servers/${serverId}/mods/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          downloadUrl: primaryFile.url,
          fileName: primaryFile.filename,
          title: project.title
        })
      });

      const instData = await instRes.json();
      if (!instRes.ok) throw new Error(instData.error || 'Installation failed');

      let successMsg = `Installed ${project.title} (${instData.filename}) into /mods/!`;
      if (isServerRunning) {
        successMsg += ' [Restart required to activate]';
      }
      setInstallSuccessMessage(successMsg);
      fetchInstalledMods();
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

  // Toggle enable/disable mod
  const handleToggleMod = async (filename: string) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/installed-mods/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        fetchInstalledMods();
      }
    } catch {
      // Ignore
    }
  };

  // Delete installed mod
  const executeDeleteMod = async (filename: string) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/installed-mods/${filename}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setDeleteModConfirm(null);
        fetchInstalledMods();
      }
    } catch {
      // Ignore
    }
  };

  // Upload custom mod .jar directly
  const handleCustomModUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingMod(true);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1] || (reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/servers/${serverId}/files/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: `mods/${file.name}`, base64 })
      });

      if (!res.ok) throw new Error('Failed to upload mod');
      let successMsg = `Uploaded ${file.name} to /mods/!`;
      if (isServerRunning) {
        successMsg += ' [Restart required to activate]';
      }
      setInstallSuccessMessage(successMsg);
      fetchInstalledMods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploadingMod(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // Category filters
  const categoryOptions = [
    { id: 'all', label: 'All Categories' },
    { id: 'optimization', label: 'Optimization' },
    { id: 'utility', label: 'Utility' },
    { id: 'technology', label: 'Technology' },
    { id: 'magic', label: 'Magic' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'decoration', label: 'Decoration' },
    { id: 'worldgen', label: 'World Gen' }
  ];

  // Pagination calculation
  const totalPages = Math.ceil(totalHits / pageSize);
  const showPagination = totalPages > 1;

  // Smart sliding window pagination: shows 5 start pages + last pages (~10 buttons max), never direct jumps to last page
  const getPaginationItems = (current: number, total: number): (number | string)[] => {
    if (total <= 10) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // When near the start (e.g. current <= 5): show 1, 2, 3, 4, 5, 6, 7 ... and last 3 pages
    if (current <= 5) {
      const startCount = Math.max(5, current + 2);
      const starts: number[] = [];
      for (let i = 1; i <= Math.min(startCount, total); i++) {
        starts.push(i);
      }
      const ends = [total - 2, total - 1, total].filter(p => !starts.includes(p) && p > 0);
      return [...starts, '...', ...ends];
    }

    // When near the end
    if (current >= total - 4) {
      const starts = [1, 2, 3];
      const endCount = Math.max(5, total - current + 3);
      const ends: number[] = [];
      for (let i = total - endCount + 1; i <= total; i++) {
        if (i > 0 && !starts.includes(i)) ends.push(i);
      }
      return [...starts, '...', ...ends];
    }

    // In the middle: show first pages, window around current page, and last pages
    return [
      1,
      2,
      '...',
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2,
      '...',
      total - 1,
      total
    ];
  };

  const handlePageSelect = (page: number) => {
    setCurrentPage(page);
    if (marketplaceTopRef.current) {
      marketplaceTopRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0 w-full max-w-full">
      {/* Header Banner */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-zinc-950/60 to-indigo-950/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                Mod Manager
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-800 text-purple-300 border border-purple-500/20">
                /mods/
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              {software} Mods & Addons
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mt-1">
              Browse, search, and 1-click install verified Fabric & Forge mods directly from Modrinth. Compatible with Minecraft {mcVersion}.
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
              onClick={() => { setActiveTab('installed'); fetchInstalledMods(); }}
              className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'installed'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Installed Mods</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-purple-300 font-mono">
                {installedMods.length}
              </span>
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

      {/* VIEW 1: MODRINTH MARKETPLACE */}
      {activeTab === 'marketplace' && (
        <div className="space-y-4">
          {/* Search & Filters Controls */}
          <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Modrinth for mods (e.g. Sodium, Lithium, FerriteCore)..."
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

              <select
                value={pageSize}
                onChange={(e) => setPageBy(parseInt(e.target.value, 10))}
                className="px-3 py-2 text-xs glass-input rounded-xl text-zinc-300 focus:outline-none cursor-pointer font-mono"
                title="Results per page"
              >
                <option value="12">12 / page</option>
                <option value="24">24 / page</option>
                <option value="50">50 / page</option>
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

          {/* Results Summary */}
          {!loading && (
            <div className="text-xs text-zinc-400 font-mono flex items-center justify-between px-1">
              <span>Mods: {totalHits.toLocaleString()} available</span>
              <span>Showing {Math.min(totalHits, (currentPage - 1) * pageSize + 1)}–{Math.min(totalHits, currentPage * pageSize)} of {totalHits.toLocaleString()} results</span>
            </div>
          )}

          {/* Contained Scrollable Container (2 items per row, clean layout, no page overscroll) */}
          <div
            ref={marketplaceTopRef}
            className="max-h-[72vh] overflow-y-auto overscroll-contain pr-1 sm:pr-2 space-y-4 rounded-2xl custom-scrollbar"
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-3.5 pb-2">
              {searchResults.map((item) => {
                const isInstalling = installingIds.has(item.project_id);
                const isInstalled = installedMods.some(a => a.filename.toLowerCase().includes(item.slug.toLowerCase()));
                const isFocused = focusedProjectId === item.project_id;

                return (
                  <div
                    key={item.project_id}
                    onClick={() => setFocusedProjectId(item.project_id)}
                    className={`glass-panel rounded-xl sm:rounded-2xl border transition-all duration-200 p-2.5 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3.5 shadow-md animate-fadeIn min-w-0 cursor-pointer ${
                      isFocused
                        ? 'border-purple-400 ring-1 ring-purple-400/50 bg-purple-950/40 shadow-purple-900/20'
                        : 'border-white/5 hover:border-purple-500/40 bg-zinc-950/25'
                    }`}
                  >
                    {/* Top Details */}
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                      {item.icon_url ? (
                        <img
                          src={item.icon_url}
                          alt={item.title}
                          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-zinc-900 border border-white/10 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                          <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="text-xs sm:text-sm font-bold text-white truncate" title={item.title}>
                            {item.title}
                          </h3>
                          {isInstalled && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-purple-400 font-medium truncate">by {item.author}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] sm:text-xs text-zinc-300 leading-snug line-clamp-2 min-h-[28px] sm:min-h-[32px]">
                      {item.description}
                    </p>

                    {/* Tags and Stats */}
                    <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-zinc-400 pt-1.5 sm:pt-2 border-t border-white/5 font-mono gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{(item.downloads || 0).toLocaleString()} dl</span>
                      </div>

                      <a
                        href={`https://modrinth.com/${item.project_type}/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 text-[10px] sm:text-[11px] shrink-0"
                      >
                        <span>Modrinth</span>
                        <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </a>
                    </div>

                    {/* Install Button */}
                    <button
                      onClick={() => handleInstallMod(item)}
                      disabled={isInstalling}
                      className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isInstalled
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/30'
                      } disabled:opacity-50`}
                    >
                      {isInstalling ? (
                        <>
                          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                          <span className="truncate">Installing...</span>
                        </>
                      ) : isInstalled ? (
                        <>
                          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="truncate">Reinstall</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span className="truncate">Install</span>
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
                <p className="text-sm font-semibold text-zinc-300">No matching mods found on Modrinth</p>
                <p className="text-xs text-zinc-500 font-mono">Search term: "{searchQuery}" under loader {software}</p>
              </div>
            )}
          </div>

          {/* Real Pagination Controls with Smart Window */}
          {showPagination && (
            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-white/5 gap-3 mt-2">
              <button
                type="button"
                disabled={currentPage === 1 || loading}
                onClick={() => handlePageSelect(Math.max(1, currentPage - 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 rounded-xl transition disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Prev
              </button>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[calc(100vw-120px)] sm:max-w-none scrollbar-none py-1">
                {getPaginationItems(currentPage, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 sm:px-2 text-zinc-500 font-mono text-xs">
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => handlePageSelect(p as number)}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold transition shrink-0 cursor-pointer ${
                        currentPage === p
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-black/30 hover:bg-black/50 text-zinc-300 hover:text-white border border-white/5'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages || loading}
                onClick={() => handlePageSelect(Math.min(totalPages, currentPage + 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 rounded-xl transition disabled:opacity-40 cursor-pointer"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: INSTALLED MODS LIST */}
      {activeTab === 'installed' && (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-black/40 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-purple-400" />
              Installed Mods on Disk ({installedMods.length})
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".jar"
                ref={uploadInputRef}
                onChange={handleCustomModUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploadingMod}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingMod ? 'Uploading...' : 'Upload Mod .jar'}</span>
              </button>

              <button
                onClick={fetchInstalledMods}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center gap-1 border border-white/10"
                title="Rescan mods directory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInstalled ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {installedMods.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No mods found in /mods/ folder on disk.
              </div>
            ) : (
              installedMods.map((addon) => (
                <div
                  key={addon.filename}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Boxes className="w-5 h-5" />
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
                      onClick={() => handleToggleMod(addon.filename)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {addon.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-zinc-500" />}
                      <span>{addon.enabled ? 'Disable' : 'Enable'}</span>
                    </button>

                    <button
                      onClick={() => setDeleteModConfirm(addon.filename)}
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs transition cursor-pointer"
                      title="Remove mod from disk"
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

      {/* Delete Mod Confirmation Modal */}
      {deleteModConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Remove Mod File
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to permanently delete the mod file <span className="text-white font-mono font-bold">"{deleteModConfirm}"</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModConfirm(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteMod(deleteModConfirm)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
              >
                Delete Mod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
