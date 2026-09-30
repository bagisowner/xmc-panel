import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import {
  Sliders, Save, Check, RotateCcw, Search, Plus, Trash2,
  AlertCircle, Boxes, Code, Download, FileText,
  X, FileCode, ChevronDown, CheckCircle2, Swords, Globe2, Users, Cpu, Settings2
} from 'lucide-react';

import { craftCommandCenterTheme } from './editor/MinecraftConfigTheme';
import {
  KNOWN_PROPERTIES,
  PropertyDefinition,
  getPropertiesLanguageSupport,
} from './editor/MinecraftConfigExtensions';
import { FileOption, SaveState } from './editor/VSCodeEditorCore';

interface ConfigEditorProps {
  serverId: string;
  token: string;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onSaved?: () => void;
}

const CONFIG_FILES: FileOption[] = [
  {
    id: 'server.properties',
    name: 'server.properties',
    path: 'server.properties',
    language: 'properties',
    description: 'Core Minecraft server engine settings, network, & game rules',
  },
  {
    id: 'spigot.yml',
    name: 'spigot.yml',
    path: 'spigot.yml',
    language: 'yaml',
    description: 'Spigot performance tweaks, entity tracking, & world options',
  },
  {
    id: 'bukkit.yml',
    name: 'bukkit.yml',
    path: 'bukkit.yml',
    language: 'yaml',
    description: 'Bukkit core tick limits, spawn rates, & connection thresholds',
  },
  {
    id: 'paper-global.yml',
    name: 'paper-global.yml',
    path: 'config/paper-global.yml',
    language: 'yaml',
    description: 'Paper modern global engine, asynchronous chunks, & watchdog',
  },
  {
    id: 'pufferfish.yml',
    name: 'pufferfish.yml',
    path: 'pufferfish.yml',
    language: 'yaml',
    description: 'Pufferfish async mob pathfinding & optimized tick loops',
  },
  {
    id: 'purpur.yml',
    name: 'purpur.yml',
    path: 'purpur.yml',
    language: 'yaml',
    description: 'Purpur gameplay features, mob riding, & performance options',
  },
];

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  serverId,
  token,
  showToast,
  onSaved,
}) => {
  const [selectedFile, setSelectedFile] = useState<FileOption>(CONFIG_FILES[0]);
  const [content, setContent] = useState('');
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);

  // Visual Controls filter & category
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'gameplay' | 'world' | 'players' | 'performance' | 'advanced'>('all');

  const editorRef = useRef<ReactCodeMirrorRef | null>(null);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // ----------------------------------------------------
  // LOAD FILE CONTENT FROM BACKEND API
  // ----------------------------------------------------
  const loadFileContent = useCallback(async (file: FileOption) => {
    setLoading(true);
    try {
      let text = '';
      if (file.path === 'server.properties') {
        const res = await fetch(`/api/servers/${serverId}/properties`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        text = data.content || '';
      } else {
        const res = await fetch(`/api/servers/${serverId}/files/content?path=${encodeURIComponent(file.path)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          text = `# ${file.name} - Configuration\n# Created by Craft Command Center\n`;
        } else {
          const data = await res.json();
          text = data.content || '';
        }
      }

      setContent(text);
      setLastSavedContent(text);
      setSaveState('saved');
    } catch (err: any) {
      showToastRef.current('error', err?.message || 'Failed to load configuration file.');
      setSaveState('failed');
    } finally {
      setLoading(false);
    }
  }, [serverId, token]);

  useEffect(() => {
    loadFileContent(selectedFile);
  }, [selectedFile.id, loadFileContent]);

  // ----------------------------------------------------
  // SAVE FILE CONTENT
  // ----------------------------------------------------
  const handleSave = useCallback(async () => {
    setSaveState('saving');
    try {
      let res: Response;
      if (selectedFile.path === 'server.properties') {
        res = await fetch(`/api/servers/${serverId}/properties`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        });
      } else {
        res = await fetch(`/api/servers/${serverId}/files/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ path: selectedFile.path, content }),
        });
      }

      if (!res.ok) throw new Error('Save failed');

      setLastSavedContent(content);
      setSaveState('saved');
      showToastRef.current('success', `${selectedFile.name} saved successfully.`);
      onSaved?.();
    } catch (err: any) {
      setSaveState('failed');
      showToastRef.current('error', err?.message || 'Failed to save configuration.');
    }
  }, [content, selectedFile, serverId, token, onSaved]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // ----------------------------------------------------
  // PARSE PROPERTIES FOR VISUAL CONTROLS
  // ----------------------------------------------------
  const propertiesMap = useMemo(() => {
    const map: Record<string, string> = {};
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('//')) continue;
      const delimiterIdx = selectedFile.language === 'yaml' ? trimmed.indexOf(':') : trimmed.indexOf('=');
      if (delimiterIdx !== -1) {
        const key = trimmed.slice(0, delimiterIdx).trim();
        const value = trimmed.slice(delimiterIdx + 1).trim();
        if (key) map[key] = value;
      }
    }
    return map;
  }, [content, selectedFile.language]);

  const handlePropertyChange = (key: string, value: string) => {
    const lines = content.split('\n');
    let replaced = false;
    const delimiter = selectedFile.language === 'yaml' ? ': ' : '=';

    const newLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('//')) return line;
      const delimiterIdx = selectedFile.language === 'yaml' ? trimmed.indexOf(':') : trimmed.indexOf('=');
      if (delimiterIdx !== -1) {
        const currentKey = trimmed.slice(0, delimiterIdx).trim();
        if (currentKey.toLowerCase() === key.toLowerCase()) {
          replaced = true;
          return `${currentKey}${delimiter}${value}`;
        }
      }
      return line;
    });

    if (!replaced) {
      newLines.push(`${key}${delimiter}${value}`);
    }

    const updatedText = newLines.join('\n');
    setContent(updatedText);
    setSaveState('unsaved');
  };

  // Filter properties based on active category & search query
  const filteredProperties = useMemo(() => {
    const isProps = selectedFile.language === 'properties' || selectedFile.name === 'server.properties';
    if (!isProps) {
      const keys = Object.keys(propertiesMap);
      return keys
        .filter(k => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return k.toLowerCase().includes(q) || (propertiesMap[k] || '').toLowerCase().includes(q);
        })
        .map(k => ({
          key: k,
          label: k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: `Configuration property: ${k}`,
          category: 'advanced' as const,
          type: propertiesMap[k] === 'true' || propertiesMap[k] === 'false' ? ('boolean' as const) : ('text' as const),
          defaultVal: propertiesMap[k],
        }));
    }

    const knownKeys = new Set(KNOWN_PROPERTIES.map(p => p.key.toLowerCase()));
    const customKeys = Object.keys(propertiesMap).filter(k => !knownKeys.has(k.toLowerCase()));

    const customDefs: PropertyDefinition[] = customKeys.map(k => ({
      key: k,
      label: k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: `Custom or plugin setting for ${k}`,
      category: 'advanced',
      type: propertiesMap[k] === 'true' || propertiesMap[k] === 'false' ? 'boolean' : 'text',
      defaultVal: propertiesMap[k],
    }));

    const allDefs = [...KNOWN_PROPERTIES, ...customDefs];

    return allDefs.filter(p => {
      // Category filter
      if (activeCategory !== 'all') {
        if (activeCategory === 'advanced' && p.category !== 'advanced') return false;
        if (activeCategory !== 'advanced' && p.category !== activeCategory) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.key.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedFile, propertiesMap, activeCategory, searchQuery]);

  // CodeMirror Extensions for Raw mode
  const codeMirrorExtensions = useMemo(() => {
    const base = [
      craftCommandCenterTheme,
      foldGutter(),
      EditorView.lineWrapping,
    ];

    if (selectedFile.language === 'properties') {
      base.push(getPropertiesLanguageSupport());
    } else if (selectedFile.language === 'yaml') {
      base.push(yaml());
    } else if (selectedFile.language === 'json') {
      base.push(json());
    }

    return base;
  }, [selectedFile.language]);

  return (
    <div className="w-full space-y-4 font-sans animate-fadeIn">
      {/* ======================================================== */}
      {/* 1. TOP HEADER BANNER (Exactly matching Screenshot 2)      */}
      {/* ======================================================== */}
      <div className="glass-panel p-5 rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/40 via-zinc-950/70 to-indigo-950/40 shadow-2xl space-y-4">
        {/* Badges & File Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-950/80 border border-purple-500/40 text-purple-300 shadow-sm">
              Server Engine Config
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
                className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-black/60 hover:bg-black/90 border border-purple-500/30 text-purple-200 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <span>{selectedFile.name}</span>
                <ChevronDown className="w-3 h-3 text-purple-400" />
              </button>

              {fileDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 glass-modal rounded-2xl p-2 border border-purple-500/40 shadow-2xl z-50 space-y-1 animate-fadeIn">
                  <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider px-2 py-1">
                    Select Server Configuration File
                  </div>
                  {CONFIG_FILES.map(file => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setFileDropdownOpen(false);
                        setSelectedFile(file);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition text-xs flex items-center justify-between cursor-pointer ${
                        file.id === selectedFile.id
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-[11px]">{file.name}</div>
                        <div className="text-[10px] text-zinc-400 line-clamp-1">{file.description}</div>
                      </div>
                      {file.id === selectedFile.id && (
                        <Check className="w-3.5 h-3.5 text-purple-200 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Real Backend Save Badge */}
          <div className="flex items-center gap-2">
            {saveState === 'saved' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Saved ✓
              </span>
            )}
            {saveState === 'saving' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 whitespace-nowrap animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Saving...
              </span>
            )}
            {saveState === 'unsaved' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ● Unsaved
              </span>
            )}
            {saveState === 'failed' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 whitespace-nowrap">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Save Failed
              </span>
            )}
          </div>
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-purple-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Config Editor
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300">
            Modify gameplay rules, world generation, difficulty, and network variables. Saved changes apply upon server restart.
          </p>
        </div>

        {/* View Toggle (Visual Controls vs Raw Editor) & Save Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
          {/* Visual Controls vs Raw Editor Tabs */}
          <div className="flex items-center p-1 bg-black/60 border border-purple-500/30 rounded-2xl shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'visual'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Visual Controls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'raw'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Raw Editor</span>
            </button>
          </div>

          {/* Save Configuration Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-90 rounded-2xl shadow-lg border border-purple-400/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Save className={`w-4 h-4 ${saveState === 'saving' ? 'animate-spin' : ''}`} />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. VISUAL CONTROLS TAB                                   */}
      {/* ======================================================== */}
      {activeTab === 'visual' ? (
        <div className="space-y-4">
          {/* Search & Category Filter Card */}
          <div className="glass-panel p-4 rounded-3xl border border-purple-500/20 bg-black/40 space-y-3 shadow-xl">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search settings (e.g. pvp, difficulty, motd, port, flight)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-xs glass-input rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-none pt-1">
              {[
                { id: 'all', label: 'All Settings', icon: Sliders },
                { id: 'gameplay', label: 'Gameplay', icon: Swords },
                { id: 'world', label: 'World & Mobs', icon: Globe2 },
                { id: 'players', label: 'Players & Access', icon: Users },
                { id: 'performance', label: 'Performance', icon: Cpu },
                { id: 'advanced', label: 'Advanced', icon: Settings2 },
              ].map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50 border border-purple-400/40'
                        : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Properties Grid Cards */}
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs rounded-3xl glass-panel border border-white/5 animate-pulse">
              Loading configuration settings...
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs rounded-3xl glass-panel border border-white/5">
              No configuration settings found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredProperties.map(prop => {
                const currentValue = propertiesMap[prop.key] ?? prop.defaultVal ?? '';
                const isBool = prop.type === 'boolean' || currentValue === 'true' || currentValue === 'false';
                const isEnabled = currentValue === 'true';

                return (
                  <div
                    key={prop.key}
                    className="glass-card p-4 rounded-2xl border border-purple-500/15 bg-gradient-to-br from-purple-950/25 via-zinc-950/60 to-black/40 hover:border-purple-500/40 transition shadow-lg flex flex-col justify-between space-y-3"
                  >
                    {/* Top Row: Label & Key Badge */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                          {prop.label}
                        </span>
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
                          {prop.key}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug">
                        {prop.description}
                      </p>
                    </div>

                    {/* Bottom Control Row */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                      {isBool ? (
                        <>
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            {isEnabled ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <span>✓</span> Enabled (true)
                              </span>
                            ) : (
                              <span className="text-zinc-500 flex items-center gap-1">
                                <span>✕</span> Disabled (false)
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePropertyChange(prop.key, isEnabled ? 'false' : 'true')}
                            className={`px-3.5 py-1 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              isEnabled
                                ? 'bg-purple-950/70 hover:bg-purple-900 border-purple-500/40 text-purple-200'
                                : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                            }`}
                          >
                            {isEnabled ? 'Toggle OFF' : 'Toggle ON'}
                          </button>
                        </>
                      ) : prop.type === 'select' ? (
                        <div className="w-full">
                          <select
                            value={currentValue}
                            onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs glass-input rounded-xl text-white font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            {(prop.options || []).map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                                {opt.label} ({opt.value})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="w-full">
                          <input
                            type={prop.type === 'number' ? 'number' : 'text'}
                            value={currentValue}
                            min={'min' in prop ? (prop as any).min : undefined}
                            max={'max' in prop ? (prop as any).max : undefined}
                            onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                            placeholder={prop.defaultVal || 'Enter value...'}
                            className="w-full px-3 py-1.5 text-xs glass-input rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* 3. RAW CODE EDITOR TAB                                   */
        /* ======================================================== */
        <div className="glass-panel rounded-3xl border border-purple-500/25 overflow-hidden shadow-2xl h-[550px] sm:h-[650px] flex flex-col bg-[#070514]">
          <div className="flex-1 min-w-0 h-full overflow-hidden">
            <CodeMirror
              ref={editorRef}
              value={content}
              height="100%"
              className="h-full text-left font-mono"
              theme={craftCommandCenterTheme}
              extensions={codeMirrorExtensions}
              onChange={(val) => {
                setContent(val);
                setSaveState('unsaved');
              }}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightActiveLine: true,
                defaultKeymap: true,
                historyKeymap: true,
              }}
              style={{
                fontSize: '13px',
                height: '100%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
