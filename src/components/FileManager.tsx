// Component: FileManager
import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, FileText, FileCode, Archive, Image, Upload,
  Trash2, Download, Edit3, RefreshCw, Search,
  X, AlertCircle, ArrowUpDown, CheckSquare, Square,
  FolderPlus, FilePlus, Sparkles, Sliders, CheckCircle2, ArrowLeft,
  XCircle, Layers
} from 'lucide-react';
import { VSCodeEditorCore } from './editor/VSCodeEditorCore';
import { sounds } from '../utils/sound';

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
  diskUsedFormatted?: string;
  diskLimitGb?: number;
  onStorageChange?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  serverId,
  token,
  diskUsedFormatted,
  diskLimitGb,
  onStorageChange
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeFocusedItem, setActiveFocusedItem] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'mtime'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals & Editors
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string; originalContent: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal dialog states
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [renamingItem, setRenamingItem] = useState<{ oldName: string; newName: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Upload state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; size: number; progress: number; status: 'pending' | 'uploading' | 'completed' | 'failed'; error?: string }>>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const breadcrumbContainerRef = useRef<HTMLDivElement | null>(null);

  // Touch & Long-Press gesture management (with 10px scroll cancellation)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (breadcrumbContainerRef.current) {
      breadcrumbContainerRef.current.scrollLeft = breadcrumbContainerRef.current.scrollWidth;
    }
  }, [currentPath]);

  const triggerHaptic = (durationMs = 35) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate(durationMs);
      }
    } catch {}
  };

  const handleTouchStart = (fileName: string, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Trigger long-press after 450ms
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      triggerHaptic(45);
      sounds.playClick();
      toggleSelect(fileName);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // 10px movement threshold: immediately cancels long-press for buttery-smooth scrolling
    if (Math.hypot(deltaX, deltaY) > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
    isLongPressTriggeredRef.current = false;
  };

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
    sounds.playClick();
    triggerHaptic(20);
    setActiveFocusedItem(null);
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    sounds.playClick();
    triggerHaptic(20);
    setActiveFocusedItem(null);
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const navigateBreadcrumb = (index: number) => {
    sounds.playClick();
    triggerHaptic(20);
    setActiveFocusedItem(null);
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
    sounds.playClick();
    triggerHaptic(20);
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
    onStorageChange?.();
    sounds.playSuccess();
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
      sounds.playSuccess();
      fetchFiles(currentPath);
      onStorageChange?.();
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
      const createdName = newItemName.trim();
      setNewItemName('');
      sounds.playSuccess();
      fetchFiles(currentPath);
      onStorageChange?.();
      openEditor(createdName);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open editor
  const openEditor = async (fileName: string) => {
    sounds.playClick();
    triggerHaptic(20);
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
  const handleSaveEdit = async (contentToSave?: string): Promise<boolean> => {
    if (!editingFile) return false;
    const textToSave = contentToSave !== undefined ? contentToSave : editingFile.content;
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
          content: textToSave
        })
      });
      if (!res.ok) throw new Error('Failed to save file');
      setEditingFile(prev => prev ? { ...prev, content: textToSave, originalContent: textToSave } : null);
      onStorageChange?.();
      sounds.playSuccess();
      setSuccessMsg(`File "${editingFile.name}" saved successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single file/folder
  const executeDeleteItem = async (itemName: string) => {
    const targetRelative = currentPath ? `${currentPath}/${itemName}` : itemName;
    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/api/servers/${serverId}/files/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: targetRelative })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete item');
      }
      setDeleteConfirmItem(null);
      sounds.playDelete();
      triggerHaptic(50);
      setSuccessMsg(`"${itemName}" was deleted.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      await fetchFiles(currentPath);
      onStorageChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  // Batch delete
  const executeBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    const count = selectedFiles.size;
    const paths = Array.from(selectedFiles).map(name => currentPath ? `${currentPath}/${name}` : name);
    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/api/servers/${serverId}/files/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ paths })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Batch delete failed');
      }
      setSelectedFiles(new Set());
      setBatchDeleteConfirm(false);
      sounds.playDelete();
      triggerHaptic(60);
      setSuccessMsg(`${count} items deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      await fetchFiles(currentPath);
      onStorageChange?.();
    } catch (err: any) {
      setError(err.message || 'Batch delete failed');
    } finally {
      setIsDeleting(false);
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
      sounds.playSuccess();
      fetchFiles(currentPath);
      onStorageChange?.();
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
      sounds.playSuccess();
      fetchFiles(currentPath);
      onStorageChange?.();
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
      sounds.playSuccess();
      fetchFiles(currentPath);
      onStorageChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download item
  const handleDownload = (itemName: string) => {
    sounds.playClick();
    triggerHaptic(20);
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

  const isEditableFile = (file: FileItem) => {
    return !file.isDirectory && (
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
  };

  // Row / Card Tap action handler (handles regular click vs multi-selection mode)
  const handleItemTap = (file: FileItem) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    // Set persistent active focused highlight on tapped element
    setActiveFocusedItem(file.name);

    if (selectedFiles.size > 0) {
      sounds.playClick();
      triggerHaptic(20);
      toggleSelect(file.name);
      return;
    }
    if (file.isDirectory) {
      navigateTo(file.name);
    } else if (isEditableFile(file)) {
      openEditor(file.name);
    } else {
      handleDownload(file.name);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full max-w-full touch-manipulation select-none sm:select-auto">
      {/* Top Action Bar */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
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
            onClick={() => {
              sounds.playClick();
              triggerHaptic(20);
              fileInputRef.current?.click();
            }}
            disabled={isUploading}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all duration-150 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              triggerHaptic(20);
              setShowNewFolderModal(true);
              setNewItemName('');
            }}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
            <span>New Folder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              triggerHaptic(20);
              setShowNewFileModal(true);
              setNewItemName('');
            }}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New File</span>
          </button>

          {selectedFiles.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  handleZipSelected();
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zip ({selectedFiles.size})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setBatchDeleteConfirm(true);
                }}
                className="px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete ({selectedFiles.size})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedFiles(new Set());
                }}
                className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 text-xs transition cursor-pointer"
                title="Deselect all"
              >
                <X className="w-3.5 h-3.5" />
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
            onClick={() => {
              sounds.playClick();
              fetchFiles(currentPath);
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Selection Banner on Active Selection */}
      {selectedFiles.size > 0 && (
        <div className="glass-panel p-2.5 sm:p-3 rounded-xl border border-purple-500/40 bg-purple-950/40 flex items-center justify-between gap-2 text-xs shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 font-mono text-purple-200 font-semibold pl-1">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>{selectedFiles.size} item{selectedFiles.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-[11px] font-medium transition active:scale-95 cursor-pointer"
            >
              {selectedFiles.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              type="button"
              onClick={handleZipSelected}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Archive className="w-3 h-3" />
              <span>Zip</span>
            </button>
            <button
              type="button"
              onClick={() => setBatchDeleteConfirm(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-[11px] font-medium transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedFiles(new Set())}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Cancel Selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
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
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
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
      <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono gap-2 overflow-hidden relative shadow-inner">
        {/* Left Side: Back Button & Scrollable Breadcrumbs Path Trail */}
        <div
          ref={breadcrumbContainerRef}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none no-scrollbar whitespace-nowrap py-0.5 pr-1"
        >
          {/* Back Button on Left of /home when inside any subdirectory */}
          {currentPath ? (
            <button
              type="button"
              onClick={navigateUp}
              title="Go back to parent directory"
              className="px-2 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 hover:text-white flex items-center gap-1 transition-all duration-150 active:scale-95 cursor-pointer text-xs font-sans font-bold shrink-0 shadow-sm mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-300" />
              <span>Back</span>
            </button>
          ) : null}

          {/* Root /home button */}
          <button
            onClick={() => navigateBreadcrumb(-1)}
            className={`px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-all duration-150 active:scale-95 cursor-pointer shrink-0 ${
              !currentPath ? 'text-purple-400 font-bold bg-purple-950/40 border border-purple-500/30' : 'text-zinc-400 hover:text-white'
            }`}
          >
            /home
          </button>

          {/* Subdirectory Breadcrumb Path Items */}
          {currentPath.split('/').filter(Boolean).map((segment, idx, arr) => (
            <React.Fragment key={idx}>
              <span className="text-zinc-600 select-none text-[11px] px-0.5 font-bold">/</span>
              <button
                onClick={() => navigateBreadcrumb(idx)}
                className={`px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-all duration-150 active:scale-95 cursor-pointer truncate max-w-[100px] sm:max-w-[140px] shrink-0 ${
                  idx === arr.length - 1 ? 'text-purple-300 font-bold bg-purple-950/40 border border-purple-500/30' : 'text-zinc-400 hover:text-white'
                }`}
                title={segment}
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Right Side: Disk Usage Badge (Firmly anchored with z-10 and shrink-0) */}
        {diskUsedFormatted && (
          <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-[#0e0a22] border border-purple-500/40 text-[10px] sm:text-[11px] font-mono text-purple-300 shrink-0 whitespace-nowrap shadow-md z-10">
            <span className="hidden xs:inline">Disk:</span> {diskUsedFormatted} / {diskLimitGb || 15} GB
          </div>
        )}
      </div>

      {/* Drop Zone & File List Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`glass-panel rounded-2xl border transition-all duration-200 overflow-hidden relative h-auto min-h-0 flex flex-col justify-start scrollbar-none no-scrollbar ${
          isDragging ? 'border-purple-500 bg-purple-950/30' : 'border-white/5'
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 bg-purple-950/90 border-2 border-dashed border-purple-400 flex flex-col items-center justify-center p-6 text-center">
            <Upload className="w-10 h-10 text-purple-300 animate-bounce mb-2" />
            <p className="text-base font-bold text-white">Drop files to upload instantly</p>
            <p className="text-xs text-purple-200 mt-1">Files will be placed into /{currentPath ? `home/${currentPath}` : 'home'}</p>
          </div>
        )}

        {/* DESKTOP TABLE VIEW */}
        <div 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="hidden sm:block w-full overflow-x-auto min-w-0 scrollbar-none no-scrollbar"
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-black/40 text-zinc-400 font-semibold select-none">
                <th className="p-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-zinc-400 hover:text-white cursor-pointer transition active:scale-95"
                  >
                    {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-white transition"
                  onClick={() => {
                    sounds.playClick();
                    setSortBy('name');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-white transition w-28"
                  onClick={() => {
                    sounds.playClick();
                    setSortBy('size');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Size</span>
                    <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                  </div>
                </th>
                <th
                  className="p-3 hidden md:table-cell cursor-pointer hover:text-white transition w-44"
                  onClick={() => {
                    sounds.playClick();
                    setSortBy('mtime');
                    setSortAsc(!sortAsc);
                  }}
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
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3 w-10 text-center">
                      <div className="w-4 h-4 bg-white/10 rounded mx-auto" />
                    </td>
                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 bg-purple-500/20 rounded" />
                        <div className="h-3.5 bg-white/10 rounded w-36 sm:w-48" />
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="h-3.5 bg-white/10 rounded w-14" />
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="h-3.5 bg-white/10 rounded w-28" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="h-3.5 bg-white/10 rounded w-20 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500 text-xs">
                    <div className="space-y-1">
                      <Folder className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                      <p className="font-semibold text-zinc-400">Directory is empty</p>
                      <p className="text-[11px] text-zinc-600">Drag files here or use the Upload button above.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = selectedFiles.has(file.name);
                  const isFocused = activeFocusedItem === file.name;
                  const isZip = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
                  const isEditable = isEditableFile(file);

                  return (
                    <tr
                      key={file.name}
                      onClick={() => handleItemTap(file)}
                      onTouchStart={(e) => handleTouchStart(file.name, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchCancel}
                      className={`transition-all duration-150 group cursor-pointer active:scale-[0.995] active:bg-purple-500/25 active:ring-1 active:ring-purple-400/40 ${
                        isSelected
                          ? 'bg-purple-950/50 ring-1 ring-inset ring-purple-500/60 shadow-sm'
                          : isFocused
                          ? 'bg-purple-500/20 ring-1 ring-inset ring-purple-400/50 shadow-sm'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            triggerHaptic(20);
                            toggleSelect(file.name);
                          }}
                          className="text-zinc-400 hover:text-white cursor-pointer transition active:scale-95"
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
                          <span className={`truncate text-left font-medium ${
                            file.isDirectory
                              ? 'text-purple-300 group-hover:text-purple-200 group-hover:underline'
                              : 'text-zinc-200 group-hover:text-white group-hover:underline'
                          }`}>
                            {file.name}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-zinc-400 font-mono text-[11px]">
                        {file.isDirectory ? '-' : formatSize(file.size)}
                      </td>

                      <td className="p-3 hidden md:table-cell text-zinc-400 text-[11px]">
                        {new Date(file.mtime).toLocaleDateString()} {new Date(file.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => openEditor(file.name)}
                              className="p-1.5 rounded-lg hover:bg-purple-500/20 text-zinc-400 hover:text-purple-300 transition-all duration-150 active:scale-90 cursor-pointer"
                              title="Edit text file"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isZip && (
                            <button
                              type="button"
                              onClick={() => handleUnzipItem(file.name)}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 transition-all duration-150 active:scale-90 cursor-pointer"
                              title="Extract ZIP"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!file.isDirectory && (
                            <button
                              type="button"
                              onClick={() => handleDownload(file.name)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setRenamingItem({ oldName: file.name, newName: file.name });
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
                            title="Rename"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playClick();
                              setDeleteConfirmItem(file.name);
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all duration-150 active:scale-90 cursor-pointer"
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

        {/* MOBILE CARD / ROW VIEW (Touch-Optimized, Long-Press & Press feedback) */}
        <div 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="block sm:hidden divide-y divide-white/5 w-full overflow-x-auto scrollbar-none no-scrollbar"
        >
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="p-3 flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-4 h-4 bg-white/10 rounded shrink-0" />
                  <div className="w-4 h-4 bg-purple-500/20 rounded shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="h-3.5 bg-white/10 rounded w-28 sm:w-36" />
                    <div className="h-2.5 bg-white/10 rounded w-16" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-white/10 rounded-lg shrink-0" />
              </div>
            ))
          ) : filteredFiles.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              <div className="space-y-1">
                <Folder className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="font-semibold text-zinc-400">Directory is empty</p>
                <p className="text-[11px] text-zinc-600">Drag files here or use the Upload button above.</p>
              </div>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isSelected = selectedFiles.has(file.name);
              const isFocused = activeFocusedItem === file.name;
              const isZip = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
              const isEditable = isEditableFile(file);

              return (
                <div
                  key={file.name}
                  onClick={() => handleItemTap(file)}
                  onTouchStart={(e) => handleTouchStart(file.name, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                  className={`p-3 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer active:scale-[0.985] active:bg-purple-500/25 active:border-l-4 active:border-purple-400 ${
                    isSelected
                      ? 'bg-purple-950/50 border-l-4 border-purple-500 shadow-sm ring-1 ring-purple-500/30'
                      : isFocused
                      ? 'bg-purple-500/20 border-l-4 border-purple-400 shadow-sm ring-1 ring-purple-400/40'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        triggerHaptic(20);
                        toggleSelect(file.name);
                      }}
                      className="text-zinc-400 shrink-0 p-1 active:scale-90 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {getFileIcon(file.type, file.isDirectory)}

                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-medium truncate ${
                        file.isDirectory ? 'text-purple-300 font-semibold' : 'text-zinc-200'
                      }`}>
                        {file.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                        <span>{file.isDirectory ? 'folder' : formatSize(file.size)}</span>
                        <span>•</span>
                        <span>{new Date(file.mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => openEditor(file.name)}
                        className="p-1.5 rounded-lg bg-purple-500/15 text-purple-300 active:scale-90 transition"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isZip && (
                      <button
                        type="button"
                        onClick={() => handleUnzipItem(file.name)}
                        className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 active:scale-90 transition"
                        title="Extract"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!file.isDirectory && (
                      <button
                        type="button"
                        onClick={() => handleDownload(file.name)}
                        className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 active:scale-90 transition"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        setDeleteConfirmItem(file.name);
                      }}
                      className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 active:scale-90 transition cursor-pointer"
                      title="Delete"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85">
          <div className="relative w-full max-w-6xl h-[92vh] glass-modal rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex flex-col shadow-2xl overflow-hidden border border-purple-500/30">
            <VSCodeEditorCore
              title="File Editor"
              subtitle={editingFile.path}
              fileName={editingFile.name}
              filePath={editingFile.path}
              content={editingFile.content}
              onChange={(newVal) => setEditingFile(prev => prev ? { ...prev, content: newVal } : null)}
              onSave={handleSaveEdit}
              onClose={() => {
                sounds.playClick();
                setEditingFile(null);
              }}
              saveState={isSaving ? 'saving' : editingFile.content === editingFile.originalContent ? 'saved' : 'unsaved'}
              lastSavedContent={editingFile.originalContent}
              isModal={true}
              defaultView="visual"
              showToast={(type, msg) => {
                if (type === 'error') {
                  setError(msg);
                } else {
                  setSuccessMsg(msg);
                  setTimeout(() => setSuccessMsg(null), 3000);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
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
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40 transition active:scale-95 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
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
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40 transition active:scale-95 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <form onSubmit={handleRename} className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" /> Rename Item
            </h3>
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
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renamingItem.newName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40 transition active:scale-95 cursor-pointer"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteConfirmItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => !isDeleting && setDeleteConfirmItem(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl border border-rose-500/20"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Confirm Deletion
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <span className="text-white font-mono font-bold">"{deleteConfirmItem}"</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-40 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => executeDeleteItem(deleteConfirmItem)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {batchDeleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => !isDeleting && setBatchDeleteConfirm(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm glass-modal rounded-2xl p-5 space-y-4 shadow-2xl border border-rose-500/20"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Delete Selected Items
            </h3>
            <p className="text-xs text-zinc-300">
              Are you sure you want to permanently delete <span className="text-white font-bold">{selectedFiles.size} items</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBatchDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-40 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBatchDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
