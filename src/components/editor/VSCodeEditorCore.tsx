import React, { useState, useEffect, useMemo, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import {
  Save, AlertCircle, FileCode, X, Sliders, CheckCircle2, ChevronDown, Check
} from 'lucide-react';

import { craftCommandCenterTheme } from './MinecraftConfigTheme';
import { getPropertiesLanguageSupport } from './MinecraftConfigExtensions';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

export interface FileOption {
  id: string;
  name: string;
  path: string;
  description?: string;
  language?: 'properties' | 'yaml' | 'json' | 'text';
}

export interface VSCodeEditorCoreProps {
  fileName: string;
  filePath?: string;
  content: string;
  onChange: (newContent: string) => void;
  onSave: (contentToSave: string) => Promise<boolean | void>;
  onClose?: () => void;
  saveState: SaveState;
  lastSavedContent: string;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  isModal?: boolean;
  title?: string;
  subtitle?: string;
  availableFiles?: FileOption[];
  selectedFileId?: string;
  onSelectFile?: (file: FileOption) => void;
  defaultView?: 'visual' | 'editor';
}

export const VSCodeEditorCore: React.FC<VSCodeEditorCoreProps> = ({
  fileName,
  filePath,
  content,
  onChange,
  onSave,
  onClose,
  saveState,
  lastSavedContent,
  showToast,
  isModal = false,
  title,
  subtitle,
  availableFiles,
  selectedFileId,
  onSelectFile,
}) => {
  // Determine file language mode
  const fileLanguage = useMemo<'properties' | 'yaml' | 'json' | 'text'>(() => {
    const fn = (fileName || '').toLowerCase();
    if (fn === 'server.properties' || fn.endsWith('.properties') || fn.endsWith('.ini') || fn.endsWith('.cfg') || fn.endsWith('.conf')) {
      return 'properties';
    }
    if (fn.endsWith('.yml') || fn.endsWith('.yaml')) {
      return 'yaml';
    }
    if (fn.endsWith('.json') || fn.endsWith('.mcmeta')) {
      return 'json';
    }
    return 'text';
  }, [fileName]);

  // CodeMirror instance refs
  const editorRef = useRef<ReactCodeMirrorRef | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);

  // Keyboard Shortcuts (Ctrl+S / Cmd+S for saving, Esc to close confirmation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave(content);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, onSave]);

  // CodeMirror Extensions (simple, highly performant syntax highlighting)
  const extensions = useMemo(() => {
    const base = [
      craftCommandCenterTheme,
      foldGutter(),
      EditorView.lineWrapping, // Clean auto word wrap by default for best mobile and tablet usability
    ];

    if (fileLanguage === 'properties') {
      base.push(getPropertiesLanguageSupport());
    } else if (fileLanguage === 'yaml') {
      base.push(yaml());
    } else if (fileLanguage === 'json') {
      base.push(json());
    }

    return base;
  }, [fileLanguage]);

  // Close attempt handler with unsaved changes dialog
  const handleAttemptClose = () => {
    if (content !== lastSavedContent) {
      setShowCloseConfirm(true);
    } else {
      onClose?.();
    }
  };

  return (
    <div
      className={`min-w-0 max-w-full w-full flex flex-col space-y-3 font-sans transition-all duration-200 ${
        isModal ? 'h-full flex flex-col min-h-0' : ''
      }`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* ======================================================== */}
      {/* 1. SIMPLE HEADER CARD (Title, File dropdown, Save Badge) */}
      {/* ======================================================== */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-zinc-950/60 to-indigo-950/40 flex flex-wrap items-center justify-between gap-3 shadow-xl shrink-0 min-w-0">
        {/* Left Section: Title & Details */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 shrink-0">
              {fileName.toLowerCase() === 'server.properties' ? <Sliders className="w-4.5 h-4.5" /> : <FileCode className="w-4.5 h-4.5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                {title || 'File Editor'}
              </h2>
              <p className="text-[11px] text-zinc-400 truncate max-w-xs sm:max-w-md hidden xs:block">
                {subtitle || filePath || fileName}
              </p>
            </div>
          </div>

          {/* File Switcher Dropdown (If multiple files available) */}
          {availableFiles && availableFiles.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
                className="px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-900/80 border border-purple-400/30 text-white font-mono text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer select-none"
                title="Switch file"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[160px]">{fileName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-purple-300 shrink-0" />
              </button>

              {fileDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 glass-modal rounded-2xl p-2 border border-purple-500/30 shadow-2xl z-50 space-y-1 animate-fadeIn">
                  <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider px-2 py-1">
                    Select File to Edit
                  </div>
                  {availableFiles.map(file => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setFileDropdownOpen(false);
                        onSelectFile?.(file);
                      }}
                      className={`w-full text-left p-2 rounded-xl transition text-xs flex items-center justify-between cursor-pointer ${
                        file.id === selectedFileId || file.name === fileName
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-200 hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-[11px]">{file.name}</div>
                        {file.description && (
                          <div className="text-[10px] text-zinc-400 line-clamp-1">{file.description}</div>
                        )}
                      </div>
                      {(file.id === selectedFileId || file.name === fileName) && (
                        <Check className="w-3.5 h-3.5 text-purple-200 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-purple-500/20 font-mono text-xs text-white">
              <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-xs font-semibold">{fileName}</span>
            </div>
          )}

          {/* Simple Real Backend Save State */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saveState === 'saved' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 whitespace-nowrap animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Saved ✓
              </span>
            )}
            {saveState === 'saving' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 whitespace-nowrap animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Saving...
              </span>
            )}
            {saveState === 'unsaved' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ● Unsaved
              </span>
            )}
            {saveState === 'failed' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 whitespace-nowrap">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                Save Failed
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Save (Ctrl+S) */}
          <button
            type="button"
            onClick={() => onSave(content)}
            disabled={saveState === 'saving'}
            className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md border border-purple-400/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap active:scale-95"
            title="Save changes (Ctrl+S)"
          >
            <Save className={`w-3.5 h-3.5 ${saveState === 'saving' ? 'animate-spin' : ''}`} />
            <span>{saveState === 'saving' ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={handleAttemptClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SIMPLE CODE WORKSPACE                                 */}
      {/* ======================================================== */}
      <div
        className={`relative glass-panel rounded-2xl sm:rounded-3xl border border-purple-500/25 overflow-hidden shadow-2xl flex flex-col min-w-0 flex-1 ${
          isModal ? 'min-h-[350px]' : 'h-[500px] sm:h-[600px]'
        }`}
      >
        <div className="flex-1 min-w-0 h-full overflow-hidden bg-[#070514]">
          <CodeMirror
            ref={editorRef}
            value={content}
            height="100%"
            className="h-full text-left font-mono"
            theme={craftCommandCenterTheme}
            extensions={extensions}
            onChange={(val) => onChange(val)}
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

      {/* ======================================================== */}
      {/* 3. UNSAVED CHANGES CLOSE CONFIRMATION DIALOG             */}
      {/* ======================================================== */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-fadeIn">
          <div className="w-full max-w-md glass-modal rounded-3xl p-6 border border-amber-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Unsaved Changes</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You have unsaved changes in <span className="text-white font-mono font-bold">{fileName}</span>. Discard these edits and close anyway?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  onClose?.();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl transition cursor-pointer"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
