import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, File, FileText, FileCode, Archive, Image, Upload, Plus,
  Trash2, Download, Edit3, CornerUpLeft, RefreshCw, Search, Check,
  X, AlertCircle, Copy, Move, ArrowUpDown, ChevronRight, MoreVertical,
  CheckSquare, Square, Save, Eye, FolderPlus, FilePlus, Sparkles,
  Sliders, Type, WrapText, CheckCircle2
} from 'lucide-react';

interface FileItem {
  name: string;
  size: number;
  isDirectory: boolean;
  mtime: string;
  type: string;
}

interface FileManagerProps {
  serverId: string;
  token: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ serverId, token }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'mtime'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals & Editors
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string; originalContent: string } | null>(null);
  const [editorFontSize, setEditorFontSize] = useState<number>(13);
  const [editorWordWrap, setEditorWordWrap] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal dialog states
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [renamingItem, setRenamingItem] = useState<{ oldName: string; newName: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<boolean>(false);

  // Upload state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; size: number; progress: number; status: 'pending' | 'uploading' | 'completed' | 'failed'; error?: string }>>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = async (targetPath = currentPath) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/servers/${serverId}/files?path=${encodeURIComponent(targetPath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(`Failed to load directory (HTTP ${res.status})`);
      }
      const data = await res.json();
      setFiles(data || []);
      setSelectedFiles(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to list files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [serverId, currentPath]);

  // Navigate folder
  const navigateTo = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const navigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    setCurrentPath(parts.slice(0, index + 1).join('/'));
  };

  // Selection toggle
  const toggleSelect = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.name)));
    }
  };

  // Upload handler with base64 streaming
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    processFilesForUpload(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFilesForUpload = async (fileArray: File[]) => {
    setIsUploading(true);
    const queue = fileArray.map(f => ({
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'pending' as const
    }));
    setUploadQueue(queue);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading', progress: 10 } : item));

      try {
        const reader = new FileReader();
        const fileContent = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(',')[1] || res;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, progress: 60 } : item));

        const targetRelative = currentPath ? `${currentPath}/${file.name}` : file.name;
        const res = await fetch(`/api/servers/${serverId}/files/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            path: targetRelative,
            base64: fileContent
          })
        });

        if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);

        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'completed', progress: 100 } : item));
      } catch (err: any) {
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'failed', error: err.message } : item));
      }
    }

    setIsUploading(false);
    fetchFiles(currentPath);
    setSuccessMsg(`Uploaded ${fileArray.length} item(s) successfully.`);
    setTimeout(() => {
      setUploadQueue([]);
      setSuccessMsg(null);
    }, 4000);
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFilesForUpload(Array.from(e.dataTransfer.files));
    }
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const targetRelative = currentPath ? `${currentPath}/${newItemName.trim()}` : newItemName.trim();
    try {
      const res = await fetch(`/api/servers/${serverId}/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: targetRelative, isFolder: true })
      });
      if (!res.ok) throw new Error('Failed to create directory');
      setShowNewFolderModal(false);
      setNewItemName('');
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Create file
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const targetRelative = currentPath ? `${currentPath}/${newItemName.trim()}` : newItemName.trim();
    try {
      const res = await fetch(`/api/servers/${serverId}/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: targetRelative, isFolder: false })
      });
      if (!res.ok) throw new Error('Failed to create file');
      setShowNewFileModal(false);
      setNewItemName('');
      fetchFiles(currentPath);
      openEditor(newItemName.trim());
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open editor
  const openEditor = async (fileName: string) => {
    const targetRelative = currentPath ? `${currentPath}/${fileName}` : fileName;
    try {
      setLoading(true);
      const res = await fetch(`/api/servers/${serverId}/files/content?path=${encodeURIComponent(targetRelative)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to read file content');
      const data = await res.json();
      setEditingFile({
        path: targetRelative,
        name: fileName,
        content: data.content || '',
        originalContent: data.content || ''
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save edited file
  const handleSaveEdit = async () => {
    if (!editingFile) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/servers/${serverId}/files/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: editingFile.path,
          content: editingFile.content
        })
      });
      if (!res.ok) throw new Error('Failed to save file');
      setEditingFile(prev => prev ? { ...prev, originalContent: prev.content } : null);
      setSuccessMsg(`File "${editingFile.name}" saved successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single file/folder
  const executeDeleteItem = async (itemName: string) => {
    const targetRelative = currentPath ? `${currentPath}/${itemName}` : itemName;
    try {
      const res = await fetch(`/api/servers/${serverId}/files/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: targetRelative })
      });
      if (!res.ok) throw new Error('Failed to delete item');
      setDeleteConfirmItem(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Batch delete
  const executeBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    const paths = Array.from(selectedFiles).map(name => currentPath ? `${currentPath}/${name}` : name);
    try {
      const res = await fetch(`/api/servers/${serverId}/files/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ paths })
      });
      if (!res.ok) throw new Error('Batch delete failed');
      setSelectedFiles(new Set());
      setBatchDeleteConfirm(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Rename item
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renamingItem.newName.trim()) return;
    const oldRel = currentPath ? `${currentPath}/${renamingItem.oldName}` : renamingItem.oldName;
    const newRel = currentPath ? `${currentPath}/${renamingItem.newName.trim()}` : renamingItem.newName.trim();
    try {
      const res = await fetch(`/api/servers/${serverId}/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPath: oldRel, newPath: newRel })
      });
      if (!res.ok) throw new Error('Failed to rename item');
      setRenamingItem(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ZIP selected
  const handleZipSelected = async () => {
    if (selectedFiles.size === 0) return;
    const items = Array.from(selectedFiles).map(name => currentPath ? `${currentPath}/${name}` : name);
    const defaultZipName = `archive_${Date.now()}.zip`;
    try {
      setLoading(true);
      const res = await fetch(`/api/servers/${serverId}/files/zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items,
          zipName: defaultZipName,
          currentDir: currentPath
        })
      });
      if (!res.ok) throw new Error('Failed to create archive');
      setSelectedFiles(new Set());
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // UNZIP archive
  const handleUnzipItem = async (itemName: string) => {
    const targetRelative = currentPath ? `${currentPath}/${itemName}` : itemName;
    try {
      setLoading(true);
      const res = await fetch(`/api/servers/${serverId}/files/unzip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: targetRelative,
          destDir: currentPath
        })
      });
      if (!res.ok) throw new Error('Failed to extract archive');
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download item
  const handleDownload = (itemName: string) => {
    const targetRelative = currentPath ? `${currentPath}/${itemName}` : itemName;
    const url = `/api/servers/${serverId}/files/download?path=${encodeURIComponent(targetRelative)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = itemName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filter & Sort
  const filteredFiles = files
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string, isDirectory: boolean) => {
    if (isDirectory) return <Folder className="w-4 h-4 text-purple-400 shrink-0" />;
    switch (type) {
      case 'properties':
      case 'yaml':
      case 'json':
        return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'jar':
        return <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'image':
        return <Image className="w-4 h-4 text-pink-400 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full">
      {/* Top Action Bar */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => { setShowNewFolderModal(true); setNewItemName(''); }}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
            <span>New Folder</span>
          </button>

          <button
            type="button"
            onClick={() => { setShowNewFileModal(true); setNewItemName(''); }}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New File</span>
          </button>

          {selectedFiles.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleZipSelected}
                className="px-3 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zip ({selectedFiles.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setBatchDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete ({selectedFiles.size})</span>
              </button>
            </>
          )}
        </div>

        {/* Right: Search & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs glass-input rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchFiles(currentPath)}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs transition cursor-pointer disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Queue Overlay Status */}
      {uploadQueue.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-200">
            <span>Uploading Files ({uploadQueue.filter(u => u.status === 'completed').length}/{uploadQueue.length})</span>
            {isUploading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />}
          </div>
          <div className="space-y-1.5">
            {uploadQueue.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] text-zinc-300 font-mono">
                <span className="truncate max-w-[200px]">{item.name} ({formatSize(item.size)})</span>
                <span>{item.status === 'completed' ? '✓ Uploaded' : `${item.progress}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumbs Navigation Bar */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigateBreadcrumb(-1)}
            className={`px-2 py-1 rounded-lg hover:bg-white/5 transition cursor-pointer shrink-0 ${!currentPath ? 'text-purple-400 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            /root
          </button>
          {currentPath.split('/').filter(Boolean).map((segment, idx, arr) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              <button
                onClick={() => navigateBreadcrumb(idx)}
                className={`px-2 py-1 rounded-lg hover:bg-white/5 transition cursor-pointer truncate max-w-[120px] sm:max-w-[180px] shrink-0 ${
                  idx === arr.length - 1 ? 'text-purple-400 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </div>

        {currentPath && (
          <button
            onClick={navigateUp}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-white/10 shrink-0 ml-2 cursor-pointer"
          >
            <CornerUpLeft className="w-3 h-3" /> Up
          </button>
        )}
      </div>

      {/* Drop Zone & File List Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`glass-panel rounded-2xl border transition-all duration-200 overflow-hidden relative ${
          isDragging ? 'border-purple-500 bg-purple-950/30' : 'border-white/5'
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 bg-purple-950/80 backdrop-blur-sm border-2 border-dashed border-purple-400 flex flex-col items-center justify-center p-6 text-center">
            <Upload className="w-10 h-10 text-purple-300 animate-bounce mb-2" />
            <p className="text-base font-bold text-white">Drop files to upload instantly</p>
            <p className="text-xs text-purple-200 mt-1">Files will be placed into /{currentPath || 'root'}</p>
          </div>
        )}

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden sm:block w-full overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-black/40 text-zinc-400 font-semibold select-none">
                <th className="p-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-white"
                  onClick={() => { setSortBy('name'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-white w-28"
                  onClick={() => { setSortBy('size'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center gap-1">
                    <span>Size</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                  </div>
                </th>
                <th
                  className="p-3 hidden md:table-cell cursor-pointer hover:text-white w-44"
                  onClick={() => { setSortBy('mtime'); setSortAsc(!sortAsc); }}
                >
                  <div className="flex items-center gap-1">
                    <span>Modified</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                  </div>
                </th>
                <th className="p-3 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500 text-xs">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Loading files...</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Folder className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="font-semibold text-zinc-400">Directory is empty</p>
                        <p className="text-[11px] text-zinc-600">Drag files here or use the Upload button above.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = selectedFiles.has(file.name);
                  const isZip = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
                  const isEditable = !file.isDirectory && (
                    file.type === 'properties' ||
                    file.type === 'yaml' ||
                    file.type === 'json' ||
                    file.type === 'text' ||
                    file.name.endsWith('.yml') ||
                    file.name.endsWith('.yaml') ||
                    file.name.endsWith('.json') ||
                    file.name.endsWith('.properties') ||
                    file.name.endsWith('.env') ||
                    file.name.endsWith('.cfg') ||
                    file.name.endsWith('.conf') ||
                    file.name.endsWith('.txt') ||
                    file.name.endsWith('.toml') ||
                    file.name.endsWith('.log')
                  );

                  return (
                    <tr
                      key={file.name}
                      className={`hover:bg-white/5 transition-colors group ${
                        isSelected ? 'bg-purple-950/25' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelect(file.name)}
                          className="text-zinc-400 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileIcon(file.type, file.isDirectory)}
                          {file.isDirectory ? (
                            <button
                              type="button"
                              onClick={() => navigateTo(file.name)}
                              className="font-semibold text-purple-300 hover:text-purple-200 hover:underline truncate text-left cursor-pointer"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => isEditable ? openEditor(file.name) : handleDownload(file.name)}
                              className="text-zinc-200 hover:text-white hover:underline truncate text-left cursor-pointer"
                            >
                              {file.name}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-zinc-400 font-mono text-[11px]">
                        {file.isDirectory ? '-' : formatSize(file.size)}
                      </td>

                      <td className="p-3 hidden md:table-cell text-zinc-400 text-[11px]">
                        {new Date(file.mtime).toLocaleDateString()} {new Date(file.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => openEditor(file.name)}
                              className="p-1.5 rounded-lg hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300 transition cursor-pointer"
                              title="Edit text file"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isZip && (
                            <button
                              type="button"
                              onClick={() => handleUnzipItem(file.name)}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 transition cursor-pointer"
                              title="Extract ZIP"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!file.isDirectory && (
                            <button
                              type="button"
                              onClick={() => handleDownload(file.name)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setRenamingItem({ oldName: file.name, newName: file.name })}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                            title="Rename"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmItem(file.name)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD / ROW VIEW */}
        <div className="block sm:hidden divide-y divide-white/5">
          {filteredFiles.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              {loading ? 'Loading...' : 'Directory is empty'}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isSelected = selectedFiles.has(file.name);
              const isZip = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
              const isEditable = !file.isDirectory && (
                file.type === 'properties' ||
                file.type === 'yaml' ||
                file.type === 'json' ||
                file.type === 'text' ||
                file.name.endsWith('.yml') ||
                file.name.endsWith('.yaml') ||
                file.name.endsWith('.json') ||
                file.name.endsWith('.properties') ||
                file.name.endsWith('.txt')
              );

              return (
                <div
                  key={file.name}
                  className={`p-3 flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-purple-950/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSelect(file.name)}
                      className="text-zinc-400 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {getFileIcon(file.type, file.isDirectory)}

                    <div className="min-w-0 flex-1">
                      {file.isDirectory ? (
                        <button
                          onClick={() => navigateTo(file.name)}
                          className="text-xs font-semibold text-purple-300 truncate block text-left w-full"
                        >
                          {file.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => isEditable ? openEditor(file.name) : handleDownload(file.name)}
                          className="text-xs text-zinc-200 truncate block text-left w-full"
                        >
                          {file.name}
                        </button>
                      )}
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {file.isDirectory ? 'folder' : formatSize(file.size)}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditable && (
                      <button
                        onClick={() => openEditor(file.name)}
                        className="p-1.5 rounded-lg bg-purple-500/10 text-purple-300"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isZip && (
                      <button
                        onClick={() => handleUnzipItem(file.name)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-300"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!file.isDirectory && (
                      <button
                        onClick={() => handleDownload(file.name)}
                        className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirmItem(file.name)}
                      className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* In-Browser Full Code Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-5xl h-[92vh] glass-modal rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col shadow-2xl overflow-hidden border border-purple-500/30">
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                  {editingFile.name}
                </span>
                {editingFile.content !== editingFile.originalContent && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    Unsaved
                  </span>
                )}
              </div>

              {/* Editor controls */}
              <div className="flex items-center gap-2">
                {/* Font Size Selector */}
                <div className="hidden sm:flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1 text-[11px] font-mono text-zinc-300">
                  <Type className="w-3 h-3 text-zinc-500" />
                  <button
                    onClick={() => setEditorFontSize(11)}
                    className={`px-1.5 py-0.5 rounded ${editorFontSize === 11 ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
                  >
                    11
                  </button>
                  <button
                    onClick={() => setEditorFontSize(13)}
                    className={`px-1.5 py-0.5 rounded ${editorFontSize === 13 ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
                  >
                    13
                  </button>
                  <button
                    onClick={() => setEditorFontSize(15)}
                    className={`px-1.5 py-0.5 rounded ${editorFontSize === 15 ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
                  >
                    15
                  </button>
                </div>

                {/* Wrap text toggle */}
                <button
                  type="button"
                  onClick={() => setEditorWordWrap(!editorWordWrap)}
                  className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    editorWordWrap ? 'bg-purple-600 text-white border-purple-500' : 'bg-black/40 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                  title="Toggle Word Wrap"
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Editor Workspace with Line Numbers */}
            <div className="flex-1 flex overflow-hidden rounded-xl bg-black/60 border border-white/5 mt-3 font-mono">
              {/* Line numbers gutter */}
              <div className="py-3 px-2 text-right text-zinc-600 select-none bg-black/40 border-r border-white/5 text-xs overflow-hidden">
                {editingFile.content.split('\n').map((_, i) => (
                  <div key={i} style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.5rem' }}>
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Text Area */}
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className={`flex-1 p-3 bg-transparent text-zinc-100 resize-none focus:outline-none scrollbar-thin scrollbar-thumb-zinc-800 ${
                  editorWordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'
                }`}
                style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.5rem' }}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleCreateFolder} className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-purple-400" /> Create Directory
            </h3>
            <input
              type="text"
              placeholder="Folder name (e.g. world_nether, config)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleCreateFile} className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-indigo-400" /> Create File
            </h3>
            <input
              type="text"
              placeholder="File name (e.g. ops.json, server.properties)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFileModal(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleRename} className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Rename Item</h3>
            <input
              type="text"
              value={renamingItem.newName}
              onChange={(e) => setRenamingItem({ ...renamingItem, newName: e.target.value })}
              autoFocus
              className="w-full px-3 py-2 text-xs glass-input rounded-xl text-white focus:outline-none font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renamingItem.newName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Confirm Deletion
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <span className="text-white font-mono font-bold">"{deleteConfirmItem}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteItem(deleteConfirmItem)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {batchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Delete Selected Items
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to permanently delete <span className="text-white font-bold">{selectedFiles.size} items</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBatchDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={executeBatchDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
