import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle,
  AlertTriangle,
  X,
  FileJson,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  Play,
  Pause,
  Map,
  User,
  Music,
  Plus,
  Layers,
  Skull,
  Shield,
  Package,
  ChevronDown,
} from 'lucide-react';
import { useDraggableWindow } from '../hooks/useDraggableWindow.js';
import { GameSession, GameMap, Token, DnDCharacter } from '@oldbear/shared';
import { exportAllData, downloadBackupFile, importAllData } from '../storage/BackupManager.js';
import {
  StoredAsset,
  getAllAssets,
  saveAsset,
  updateAsset,
  deleteAsset,
  deleteMultipleAssets,
  computeContentHash,
  findDuplicateAsset,
  ASSET_UPDATED_EVENT,
} from '../storage/db.js';
import {
  isTetraCubeMonsterFile,
  parseTetraCubeMonster,
  createMonsterToken,
} from '../utils/monsterParser.js';
import {
  getSavedCharacters,
  saveCharacterToStorage,
  SavedCharacterRecord,
} from './CharacterFlyout.js';

function deleteSavedCharacter(id: string, isGm: boolean) {
  try {
    const LOCAL_STORAGE_KEY = 'oldbear_saved_characters';
    const GM_STORAGE_KEY = 'oldbear_gm_saved_characters';
    const userRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (userRaw) {
      const list = JSON.parse(userRaw).filter((c: any) => c.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    }
    if (isGm) {
      const gmRaw = localStorage.getItem(GM_STORAGE_KEY);
      if (gmRaw) {
        const gmList = JSON.parse(gmRaw).filter((c: any) => c.id !== id);
        localStorage.setItem(GM_STORAGE_KEY, JSON.stringify(gmList));
      }
    }
  } catch (e) {
    console.error('Failed to delete character from localStorage:', e);
  }
}

import { MapManagerModal } from './MapManagerModal.js';

interface DataBackupModalProps {
  session?: GameSession | null;
  isGm: boolean;
  tokens?: Record<string, Token> | Token[];
  activeMapId?: string;
  initialTab?: AssetTab;
  maps?: GameMap[];
  currentGmPreviewMapId?: string;
  onSelectGmPreviewMap?: (mapId: string) => void;
  onSetActiveMapForPlayers?: (mapId: string) => void;
  onSendPlayersWithTokens?: (mapId: string) => void;
  onOpenBatchTokenTransfer?: () => void;
  onUpdateMap?: (mapId: string, updates: Partial<GameMap>) => void;
  onDeleteMap?: (mapId: string) => void;
  onRestoreSession?: (session: GameSession) => void;
  onAddMap?: (map: GameMap) => void;
  onSpawnToken?: (asset: StoredAsset) => void;
  onAddToken?: (token: Token) => void;
  onClose: () => void;
}

export type AssetTab = 'tokens' | 'props' | 'monsters' | 'characters' | 'maps' | 'scenes' | 'audio';

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  session,
  isGm,
  tokens,
  activeMapId,
  initialTab,
  maps,
  currentGmPreviewMapId,
  onSelectGmPreviewMap,
  onSetActiveMapForPlayers,
  onSendPlayersWithTokens,
  onOpenBatchTokenTransfer,
  onUpdateMap,
  onDeleteMap,
  onRestoreSession,
  onAddMap,
  onSpawnToken,
  onAddToken,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AssetTab>(initialTab || 'tokens');
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Backup & Restore State
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draggable window state (Task #112)
  const [isMinimized, setIsMinimized] = useState(false);
  const { windowRef, position, isDragging: isWindowDragging, handleMouseDown } = useDraggableWindow({
    storageKey: 'obr_asset_manager_pos',
    initialX: typeof window !== 'undefined' ? Math.max(20, Math.min(window.innerWidth - 750, 80)) : 80,
    initialY: 80,
  });

  const handleAssetDragStart = (e: React.DragEvent, asset: StoredAsset, type: 'token' | 'prop' | 'monster' | 'character') => {
    const isProp = type === 'prop' || Boolean(asset.isProp);
    const payload = {
      ...asset,
      type,
      isProp,
      propWidth: asset.propWidth ?? (isProp ? asset.size ?? 1 : undefined),
      propHeight: asset.propHeight ?? (isProp ? asset.size ?? 1 : undefined),
    };
    e.dataTransfer.setData('application/oldbear-asset', JSON.stringify(payload));
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCharacterDragStart = (e: React.DragEvent, charRecord: SavedCharacterRecord) => {
    const char = charRecord.charData;
    const assetLike = {
      id: charRecord.id,
      name: charRecord.name || char?.name || 'Character',
      type: 'character',
      dataUrl: charRecord.avatarUrl || char?.avatarUrl || '',
      character: char,
      hp: char?.currentHp ?? char?.maxHp ?? 10,
      maxHp: char?.maxHp ?? 10,
      speed: char?.speed || 30,
      size: 1,
      createdAt: Date.now(),
    };
    e.dataTransfer.setData('application/oldbear-asset', JSON.stringify(assetLike));
    e.dataTransfer.setData('application/json', JSON.stringify(assetLike));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetUploadRef = useRef<HTMLInputElement | null>(null);

  const loadAssets = async () => {
    try {
      const all = await getAllAssets();
      setAssets(all);
      setSavedCharacters(getSavedCharacters(isGm));
    } catch (err) {
      console.warn('Failed to load assets:', err);
    }
  };

  useEffect(() => {
    loadAssets();
    const handleAssetUpdated = () => {
      loadAssets();
    };
    window.addEventListener(ASSET_UPDATED_EVENT, handleAssetUpdated);
    window.addEventListener('storage', handleAssetUpdated);
    return () => {
      window.removeEventListener(ASSET_UPDATED_EVENT, handleAssetUpdated);
      window.removeEventListener('storage', handleAssetUpdated);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, [isGm]);

  const handleDeployMonster = (asset: StoredAsset) => {
    if (!onAddToken) return;
    const existingList = tokens
      ? Array.isArray(tokens)
        ? [...tokens]
        : Object.values(tokens)
      : [];
    const mapId = activeMapId || session?.activeMapId || (session?.maps[0]?.id) || 'map-default';
    const spawnX = 400 + (existingList.length % 5) * 60;
    const spawnY = 400 + (existingList.length % 5) * 60;
    const newToken = createMonsterToken(asset, mapId, spawnX, spawnY, existingList);
    onAddToken(newToken);
    setResultMessage({
      type: 'success',
      text: `Spawned monster "${newToken.name}" onto the battlemap!`,
    });
  };

  const handleDeployCharacter = (charRecord: SavedCharacterRecord) => {
    if (!onAddToken) return;
    const existingList = tokens
      ? Array.isArray(tokens)
        ? [...tokens]
        : Object.values(tokens)
      : [];
    const mapId = activeMapId || session?.activeMapId || (session?.maps[0]?.id) || 'map-default';
    const char = charRecord.charData;
    const spawnX = 350 + (existingList.length % 5) * 60;
    const spawnY = 350 + (existingList.length % 5) * 60;
    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId,
      name: char.name || charRecord.name || 'Hero',
      imageUrl: char.avatarUrl || charRecord.avatarUrl || undefined,
      x: Math.round(spawnX),
      y: Math.round(spawnY),
      size: 1,
      rotation: 0,
      ringColor: '#3b82f6',
      fillColor: '#1e3a8a',
      clipCircle: true,
      clipShape: 'circle',
      currentHp: char.currentHp ?? char.maxHp ?? 20,
      maxHp: char.maxHp ?? 20,
      tempHp: char.tempHp ?? 0,
      speed: char.speed ?? 30,
      conditions: [],
      isProp: false,
      layer: 'token',
      initiativeBonus: char.initiativeBonus ?? 0,
      character: char,
    };
    onAddToken(newToken);
    setResultMessage({
      type: 'success',
      text: `Spawned character "${newToken.name}" onto the battlemap!`,
    });
  };

  const handleDeployToken = (asset: StoredAsset) => {
    if (!onAddToken) return;
    const existingList = tokens
      ? Array.isArray(tokens)
        ? [...tokens]
        : Object.values(tokens)
      : [];
    const mapId = activeMapId || session?.activeMapId || (session?.maps[0]?.id) || 'map-default';
    const spawnX = 350 + (existingList.length % 5) * 60;
    const spawnY = 350 + (existingList.length % 5) * 60;
    const isProp = asset.type === 'prop' || Boolean(asset.isProp);
    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId,
      name: asset.name || (isProp ? 'Prop' : 'Token'),
      imageUrl: asset.dataUrl,
      x: Math.round(spawnX),
      y: Math.round(spawnY),
      size: asset.size || 1,
      rotation: asset.rotation || 0,
      ringColor: isProp ? (asset.ringColor || '#94a3b8') : (asset.ringColor || '#3b82f6'),
      fillColor: asset.fillColor || (isProp ? '#1e293b' : '#1e3a8a'),
      clipCircle: !isProp,
      clipShape: isProp ? 'square' : (asset.ringColor ? 'circle' : 'circle'),
      currentHp: isProp ? (asset.maxHp || 0) : (asset.maxHp || 20),
      maxHp: isProp ? (asset.maxHp || 0) : (asset.maxHp || 20),
      tempHp: 0,
      speed: isProp ? (asset.speed || 0) : (asset.speed || 30),
      conditions: [],
      isProp,
      layer: isProp ? 'prop' : 'token',
      propWidth: asset.propWidth,
      propHeight: asset.propHeight,
      locked: asset.locked,
    };
    onAddToken(newToken);
    setResultMessage({
      type: 'success',
      text: `Spawned ${isProp ? 'prop' : 'token'} "${newToken.name}" onto the battlemap!`,
    });
  };

  const monsterAssets = assets.filter((a) => Boolean(a.monsterData || (a.type as string) === 'monster' || (a.character && a.character.actions)));
  const mapAssets = assets.filter((a) => a.type === 'map');
  const audioAssets = assets.filter((a) => a.type === 'audio');
  const propAssets = assets.filter((a) => (a.type === 'prop' || a.isProp) && !a.monsterData && (!a.character || !a.character.actions));
  const tokenAssets = assets.filter((a) => a.type === 'token' && !a.isProp && !a.monsterData && (!a.character || !a.character.actions));

  const filteredAssets =
    activeTab === 'maps'
      ? mapAssets
      : activeTab === 'monsters'
        ? monsterAssets
        : activeTab === 'audio'
          ? audioAssets
          : activeTab === 'props'
            ? propAssets
            : tokenAssets;

  // Multiselect toggles
  const toggleSelect = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedAssetIds(filteredAssets.map((a) => a.id));
  };

  const deselectAll = () => {
    setSelectedAssetIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedAssetIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedAssetIds.length} asset(s)?`)) return;
    await deleteMultipleAssets(selectedAssetIds);
    setSelectedAssetIds([]);
    await loadAssets();
  };

  const handleStartRename = (asset: StoredAsset) => {
    setEditingId(asset.id);
    setEditingName(asset.name);
  };

  const handleSaveRename = async (id: string) => {
    if (editingName.trim()) {
      await updateAsset(id, { name: editingName.trim() });
      await loadAssets();
    }
    setEditingId(null);
  };

  // Upload Asset with Deduplication Check (Bug #30) & TetraCube .monster import (Bug #73)
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setDuplicateWarning(null);

    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.monster') || (file.name.endsWith('.json') && !file.name.includes('backup'))) {
        try {
          const text = await file.text();
          if (isTetraCubeMonsterFile(text, file.name)) {
            const { asset } = parseTetraCubeMonster(text);
            await saveAsset(asset);
            await loadAssets();
            setResultMessage({
              type: 'success',
              text: `Saved monster "${asset.name}" to Asset Manager library for encounter prep!`,
            });
            continue;
          } else {
            // Check for character or monster JSON
            try {
              const parsed = JSON.parse(text);
              if (parsed && (parsed.classes || parsed.character || parsed.stats || activeTab === 'characters')) {
                const char = parsed.character || parsed;
                if (char && char.name) {
                  saveCharacterToStorage(char, isGm);
                  await loadAssets();
                  setResultMessage({
                    type: 'success',
                    text: `Imported character "${char.name}" to Asset Manager!`,
                  });
                  continue;
                }
              }
            } catch { }
          }
        } catch (err) {
          console.warn('Failed parsing JSON file:', err);
        }
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const hash = computeContentHash(dataUrl);
        const existing = await findDuplicateAsset(file.size, hash);

        if (existing) {
          setDuplicateWarning(`Asset already exists: "${existing.name}". Using existing asset without creating a duplicate.`);
          return;
        }

        let assetType: 'map' | 'token' | 'prop' | 'audio' = 'token';
        if (activeTab === 'maps' || file.name.includes('map')) assetType = 'map';
        else if (activeTab === 'audio' || file.type.startsWith('audio/')) assetType = 'audio';
        else if ((activeTab as string) === 'props' || file.name.toLowerCase().includes('prop')) assetType = 'prop';

        await saveAsset({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: assetType,
          dataUrl,
          fileSize: file.size,
          fileHash: hash,
          isProp: assetType === 'prop',
          layer: assetType === 'prop' ? 'prop' : 'token',
          ringColor: assetType === 'prop' ? '#94a3b8' : undefined,
          clipCircle: assetType !== 'prop',
          monsterData: activeTab === 'monsters' ? { name: file.name.replace(/\.[^/.]+$/, '') } : undefined,
          createdAt: Date.now(),
        });
        await loadAssets();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleModalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.monster') || (file.name.endsWith('.json') && !file.name.includes('backup'))) {
        try {
          const text = await file.text();
          if (isTetraCubeMonsterFile(text, file.name)) {
            const { asset } = parseTetraCubeMonster(text);
            await saveAsset(asset);
            await loadAssets();
            setResultMessage({
              type: 'success',
              text: `Saved monster "${asset.name}" to Asset Manager library!`,
            });
            continue;
          }
        } catch (err: any) {
          setResultMessage({ type: 'error', text: `Failed to import monster: ${err.message}` });
          continue;
        }
      }

      if (file.name.endsWith('.json') && file.name.includes('backup')) {
        try {
          const text = await file.text();
          await importAllData(text);
          await loadAssets();
          setResultMessage({ type: 'success', text: 'Restored backup successfully!' });
          continue;
        } catch (err: any) {
          setResultMessage({ type: 'error', text: `Failed to restore backup: ${err.message}` });
          continue;
        }
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const hash = computeContentHash(dataUrl);
        const existing = await findDuplicateAsset(file.size, hash);

        if (existing) {
          setDuplicateWarning(`Asset already exists: "${existing.name}".`);
          return;
        }

        let assetType: 'map' | 'token' | 'prop' | 'audio' = 'token';
        if (activeTab === 'maps' || file.name.includes('map')) assetType = 'map';
        else if (activeTab === 'audio' || file.type.startsWith('audio/')) assetType = 'audio';
        else if ((activeTab as string) === 'props' || file.name.toLowerCase().includes('prop')) assetType = 'prop';

        await saveAsset({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: assetType,
          dataUrl,
          fileSize: file.size,
          fileHash: hash,
          isProp: assetType === 'prop',
          layer: assetType === 'prop' ? 'prop' : 'token',
          ringColor: assetType === 'prop' ? '#94a3b8' : undefined,
          clipCircle: assetType !== 'prop',
          createdAt: Date.now(),
        });
        await loadAssets();
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePlayAudio = (asset: StoredAsset) => {
    if (playingAudioId === asset.id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(asset.dataUrl);
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      audioPlayerRef.current = audio;
      setPlayingAudioId(asset.id);
    }
  };

  const handleMakeScene = (asset: StoredAsset) => {
    if (!onAddMap) return;
    const newScene: GameMap = {
      id: `map-${crypto.randomUUID()}`,
      name: `${asset.name} Scene`,
      imageUrl: asset.dataUrl,
      gridSize: 50,
      gridType: 'square',
      gridColor: '#ffffff',
      gridOpacity: 0.4,
      width: asset.width || 2000,
      height: asset.height || 1500,
      scaleFtPerCell: 5,
      showGrid: true,
      baseMapId: asset.id,
      baseMapName: asset.name,
    };
    onAddMap(newScene);
    setResultMessage({
      type: 'success',
      text: `Created new scene "${newScene.name}" from map asset!`,
    });
  };

  // Export / Import
  const handleExport = async () => {
    setExporting(true);
    setResultMessage(null);
    try {
      const blob = await exportAllData(session);
      downloadBackupFile(blob);
      setResultMessage({
        type: 'success',
        text: 'Backup file successfully created and downloaded!',
      });
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Export failed: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleProcessFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setResultMessage({
        type: 'error',
        text: 'Please select a valid .json Old Bear Rodeo backup file.',
      });
      return;
    }

    setImporting(true);
    setResultMessage(null);

    try {
      const text = await file.text();
      const result = await importAllData(text);

      setResultMessage({
        type: 'success',
        text: `Import complete! Restored ${result.assetCount} asset(s) and character data.`,
      });
      await loadAssets();

      if (isGm && result.session && onRestoreSession) {
        onRestoreSession(result.session);
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Import failed: ${err.message || 'Invalid backup format'}`,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      ref={windowRef}
      className="glass-panel-elevated animate-scale-up"
      style={{
        position: 'fixed',
        left: position ? `${position.x}px` : 'calc(50% - 370px)',
        top: position ? `${position.y}px` : '80px',
        width: '740px',
        maxWidth: '95vw',
        maxHeight: isMinimized ? '58px' : '88vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: isWindowDragging ? '0 24px 48px rgba(0,0,0,0.75)' : '0 16px 36px rgba(0,0,0,0.55)',
        zIndex: 55,
        transition: isWindowDragging
          ? 'none'
          : 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '0.9rem 1.25rem',
          borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)',
          cursor: isWindowDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Database size={20} color="var(--accent-primary)" />
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>
              Asset Manager
            </h2>
            {!isMinimized && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Drag items onto battlemap or deploy with 1-click
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Minimize / Expand button */}
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized((v) => !v);
            }}
            title={isMinimized ? 'Expand Asset Manager' : 'Minimize Asset Manager'}
            style={{ width: '28px', height: '28px' }}
          >
            <ChevronDown
              size={18}
              className={`chevron-minimize ${isMinimized ? 'minimized' : ''}`}
            />
          </button>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Close Asset Manager"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Window Body (collapses when minimized) */}
      <div
        className={`draggable-window-body ${isMinimized ? 'minimized' : ''}`}
        style={{
          display: isMinimized ? 'none' : 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '0 1rem',
            overflowX: 'auto',
          }}
        >
          <button
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tokens');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'tokens' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'tokens' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <User size={16} /> Tokens ({tokenAssets.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'props' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('props');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'props' ? '#eab308' : 'var(--text-secondary)',
              borderBottom: activeTab === 'props' ? '2px solid #eab308' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Package size={16} /> Props ({propAssets.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'monsters' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('monsters');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'monsters' ? 'var(--accent-rose)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'monsters' ? '2px solid var(--accent-rose)' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Skull size={16} /> Monsters ({monsterAssets.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('characters');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'characters' ? '#818cf8' : 'var(--text-secondary)',
              borderBottom: activeTab === 'characters' ? '2px solid #818cf8' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Shield size={16} /> Characters ({savedCharacters.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'maps' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('maps');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'maps' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'maps' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Map size={16} /> Maps ({mapAssets.length})
          </button>

          {isGm && (
            <button
              className={`tab-btn ${activeTab === 'scenes' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('scenes');
                setSelectedAssetIds([]);
              }}
              style={{
                padding: '0.75rem 1.1rem',
                border: 'none',
                background: 'none',
                color: activeTab === 'scenes' ? '#38bdf8' : 'var(--text-secondary)',
                borderBottom: activeTab === 'scenes' ? '2px solid #38bdf8' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={16} /> Scenes ({(maps || session?.maps || []).length})
            </button>
          )}

          <button
            className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('audio');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.1rem',
              border: 'none',
              background: 'none',
              color: activeTab === 'audio' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'audio' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Music size={16} /> Sounds ({audioAssets.length})
          </button>
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{duplicateWarning}</span>
            <button
              style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}
              onClick={() => setDuplicateWarning(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Body: Asset Previews with Multiselect */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Asset Action Controls */}
          {activeTab !== 'scenes' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Plus size={14} /> Upload {activeTab === 'monsters' ? 'Monster (.monster, .json)' : activeTab === 'characters' ? 'Character (.json)' : activeTab === 'maps' ? 'Map' : activeTab === 'audio' ? 'Sound' : activeTab === 'props' ? 'Prop' : 'Token'}...
                  <input
                    ref={assetUploadRef}
                    type="file"
                    multiple
                    accept={
                      activeTab === 'audio'
                        ? 'audio/*'
                        : activeTab === 'monsters'
                          ? '.monster,.json,image/*'
                          : activeTab === 'characters'
                            ? '.json,image/*'
                            : 'image/*'
                    }
                    style={{ display: 'none' }}
                    onChange={handleAssetUpload}
                  />
                </label>

                {activeTab !== 'characters' && filteredAssets.length > 0 && (
                  <>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }} onClick={selectAll}>
                      Select All
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }} onClick={deselectAll}>
                      Deselect All
                    </button>
                  </>
                )}
              </div>

              {selectedAssetIds.length > 0 && activeTab !== 'characters' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {activeTab === 'maps' && onAddMap && (
                    <button
                      className="btn btn-primary"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      onClick={() => {
                        selectedAssetIds.forEach((id) => {
                          const asset = assets.find((a) => a.id === id);
                          if (asset) handleMakeScene(asset);
                        });
                        setSelectedAssetIds([]);
                      }}
                      title="Make scenes from selected maps"
                    >
                      <Layers size={14} /> Make Scene from Selected ({selectedAssetIds.length})
                    </button>
                  )}
                  <button
                    className="btn"
                    style={{
                      backgroundColor: 'rgba(244, 63, 94, 0.2)',
                      color: '#f43f5e',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 size={14} /> Delete Selected ({selectedAssetIds.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scenes Tab Grid (Scene Manager moved into Asset Manager per Task #108) */}
          {activeTab === 'scenes' ? (
            <MapManagerModal
              embedded={true}
              maps={maps || session?.maps || []}
              activeMapId={activeMapId || session?.activeMapId || ''}
              currentGmPreviewMapId={currentGmPreviewMapId || activeMapId || ''}
              onSelectGmPreviewMap={onSelectGmPreviewMap || (() => { })}
              onSetActiveMapForPlayers={onSetActiveMapForPlayers || (() => { })}
              onSendPlayersWithTokens={onSendPlayersWithTokens}
              onOpenBatchTokenTransfer={onOpenBatchTokenTransfer}
              onAddMap={onAddMap || (() => { })}
              onUpdateMap={onUpdateMap || (() => { })}
              onDeleteMap={onDeleteMap || (() => { })}
              onClose={onClose}
            />
          ) : activeTab === 'characters' ? (
            savedCharacters.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No imported characters yet. Click Upload Character (.json) above or import a character from D&D Beyond in the Character Sheet!
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                {savedCharacters.map((charRecord) => {
                  const char = charRecord.charData;
                  const hp = char.currentHp ?? char.maxHp ?? 20;
                  const ac = char.armorClass ?? 10;
                  const speed = char.speed ?? 30;

                  return (
                    <div
                      key={charRecord.id}
                      draggable={true}
                      onDragStart={(e) => handleCharacterDragStart(e, charRecord)}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        cursor: 'grab',
                      }}
                    >
                      {/* Class Pill */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          zIndex: 2,
                          backgroundColor: 'rgba(99, 102, 241, 0.9)',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          maxWidth: '90px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={charRecord.classes}
                      >
                        {charRecord.classes || 'Hero'}
                      </div>

                      {/* Thumbnail Preview */}
                      <div
                        style={{
                          height: '95px',
                          backgroundImage: charRecord.avatarUrl ? `url("${charRecord.avatarUrl}")` : 'none',
                          backgroundSize: 'cover',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center top',
                          backgroundColor: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!charRecord.avatarUrl && <Shield size={36} color="#818cf8" />}
                      </div>

                      {/* Character Details */}
                      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e0e7ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={charRecord.name}>
                          {charRecord.name}
                        </div>

                        {/* Quick Stats Badges */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            HP {hp}
                          </span>
                          <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            AC {ac}
                          </span>
                          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            {speed}ft
                          </span>
                        </div>
                      </div>

                      {/* Actions: Deploy Token & Delete */}
                      <div style={{ padding: '0 6px 6px 6px', display: 'flex', gap: '4px' }}>
                        {onAddToken && (
                          <button
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.35rem 0.5rem',
                            }}
                            onClick={() => handleDeployCharacter(charRecord)}
                            title="Spawn character token onto the battlemap"
                          >
                            <Plus size={12} /> Deploy to Map
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#f43f5e' }}
                          onClick={() => {
                            if (confirm(`Delete character ${charRecord.name}?`)) {
                              deleteSavedCharacter(charRecord.id, isGm);
                              setSavedCharacters(getSavedCharacters(isGm));
                            }
                          }}
                          title="Delete Character"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'monsters' ? (
            monsterAssets.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No imported monsters yet. Click Upload Monster (.monster, .json) above or drag monster files onto the board!
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                {monsterAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  const cr = asset.monsterData?.cr || asset.character?.cr || (asset.monsterData?.challenge_rating ? `${asset.monsterData.challenge_rating}` : null);
                  const hp = asset.maxHp || asset.character?.maxHp || asset.monsterData?.hit_points || 20;
                  const ac = asset.armorClass || asset.character?.armorClass || asset.monsterData?.armor_class || 10;
                  const speed = asset.speed || asset.character?.speed || 30;

                  return (
                    <div
                      key={asset.id}
                      draggable={true}
                      onDragStart={(e) => handleAssetDragStart(e, asset, 'monster')}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: isSelected ? '2px solid var(--accent-rose)' : '1px solid rgba(244, 63, 94, 0.3)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        boxShadow: isSelected ? '0 0 10px rgba(244, 63, 94, 0.4)' : 'none',
                        cursor: 'grab',
                      }}
                    >
                      {/* Checkbox badge */}
                      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(asset.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </div>

                      {/* CR Pill */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          zIndex: 2,
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                        }}
                      >
                        {cr ? `CR ${cr}` : 'Monster'}
                      </div>

                      {/* Thumbnail / Monster Icon Preview */}
                      <div
                        style={{
                          height: '95px',
                          backgroundImage: asset.dataUrl ? `url("${asset.dataUrl}")` : 'none',
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundColor: '#1a0b12',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!asset.dataUrl && <Skull size={36} color="#f43f5e" />}
                      </div>

                      {/* Monster Details */}
                      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fecdd3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={asset.name}>
                          {asset.name}
                        </div>

                        {/* Quick Stats Badges */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', fontSize: '0.7rem' }}>
                          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            HP {hp}
                          </span>
                          <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            AC {ac}
                          </span>
                          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                            {speed}ft
                          </span>
                        </div>
                      </div>

                      {/* Actions: Deploy Token & Delete */}
                      <div style={{ padding: '0 6px 6px 6px', display: 'flex', gap: '4px' }}>
                        {onAddToken && (
                          <button
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.35rem 0.5rem',
                              backgroundColor: '#e11d48',
                              borderColor: '#be123c',
                            }}
                            onClick={() => handleDeployMonster(asset)}
                            title="Spawn monster token onto the battlemap"
                          >
                            <Plus size={12} /> Deploy to Map
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#f43f5e' }}
                          onClick={async () => {
                            if (confirm(`Delete monster ${asset.name}?`)) {
                              await deleteAsset(asset.id);
                              await loadAssets();
                            }
                          }}
                          title="Delete Monster"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredAssets.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No {activeTab} uploaded yet. Click Upload above or drag files onto the board!
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: activeTab === 'audio' ? '1fr' : 'repeat(auto-fill, minmax(135px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetIds.includes(asset.id);
                const isEditing = editingId === asset.id;

                if (activeTab === 'audio') {
                  return (
                    <div
                      key={asset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-elevated)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(asset.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <button
                          className="btn-icon"
                          onClick={() => togglePlayAudio(asset)}
                          style={{ width: '32px', height: '32px' }}
                        >
                          {playingAudioId === asset.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              style={{ padding: '2px 6px', fontSize: '0.8rem', background: '#000', color: '#fff', border: '1px solid var(--accent-primary)' }}
                            />
                            <button className="btn-icon" onClick={() => handleSaveRename(asset.id)}>
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{asset.name}</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="btn-icon" onClick={() => handleStartRename(asset)} title="Rename">
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={async () => {
                            if (confirm(`Delete ${asset.name}?`)) {
                              await deleteAsset(asset.id);
                              await loadAssets();
                            }
                          }}
                          title="Delete"
                          style={{ color: '#f43f5e' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                }

                // Image Asset (Tokens & Maps)
                return (
                  <div
                    key={asset.id}
                    draggable={activeTab === 'tokens' || activeTab === 'props'}
                    onDragStart={(e) => {
                      if (activeTab === 'tokens') {
                        handleAssetDragStart(e, asset, 'token');
                      } else if (activeTab === 'props') {
                        handleAssetDragStart(e, asset, 'prop');
                      }
                    }}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none',
                      cursor: (activeTab === 'tokens' || activeTab === 'props') ? 'grab' : 'default',
                    }}
                  >
                    {/* Checkbox badge */}
                    <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(asset.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </div>

                    {/* Thumbnail Preview */}
                    <div
                      style={{
                        height: '90px',
                        backgroundImage: `url("${asset.dataUrl}")`,
                        backgroundSize: activeTab === 'maps' ? 'cover' : 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundColor: '#0f172a',
                      }}
                    />

                    {/* Footer Info & Rename */}
                    <div style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '2px', width: '100%' }}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            style={{ flex: 1, padding: '2px 4px', fontSize: '0.75rem', background: '#000', color: '#fff', border: '1px solid var(--accent-primary)', borderRadius: '2px' }}
                          />
                          <button className="btn-icon" style={{ width: '22px', height: '22px' }} onClick={() => handleSaveRename(asset.id)}>
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }} title={asset.name}>
                            {asset.name}
                          </span>
                          <button className="btn-icon" style={{ width: '22px', height: '22px' }} onClick={() => handleStartRename(asset)} title="Rename">
                            <Edit2 size={11} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Dimension Controls for Props (Task #113) */}
                    {activeTab === 'props' && (
                      <div
                        style={{
                          padding: '0.2rem 0.5rem 0.35rem 0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary)',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(0,0,0,0.25)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontWeight: 600, color: '#eab308' }}>Size:</span>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          defaultValue={asset.propWidth ?? asset.size ?? 1}
                          onBlur={async (e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0 && val !== asset.propWidth) {
                              await updateAsset(asset.id, { propWidth: val });
                              await loadAssets();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          style={{
                            width: '44px',
                            padding: '1px 3px',
                            fontSize: '0.72rem',
                            borderRadius: '3px',
                            background: '#090d16',
                            border: '1px solid rgba(234, 179, 8, 0.4)',
                            color: '#fff',
                            textAlign: 'center',
                          }}
                          title="Prop Width in tiles (e.g. 1.5)"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          defaultValue={asset.propHeight ?? asset.size ?? 1}
                          onBlur={async (e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0 && val !== asset.propHeight) {
                              await updateAsset(asset.id, { propHeight: val });
                              await loadAssets();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          style={{
                            width: '44px',
                            padding: '1px 3px',
                            fontSize: '0.72rem',
                            borderRadius: '3px',
                            background: '#090d16',
                            border: '1px solid rgba(234, 179, 8, 0.4)',
                            color: '#fff',
                            textAlign: 'center',
                          }}
                          title="Prop Height in tiles (e.g. 3.24)"
                        />
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>tiles</span>
                      </div>
                    )}

                    {(activeTab === 'tokens' || activeTab === 'props') && onAddToken && (
                      <button
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.35rem 0.5rem',
                          margin: '0 6px 6px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                        onClick={() => handleDeployToken(asset)}
                        title={activeTab === 'props' ? 'Spawn prop onto the battlemap' : 'Spawn token onto the battlemap'}
                      >
                        <Plus size={12} /> Deploy to Map
                      </button>
                    )}

                    {activeTab === 'maps' && onAddMap && (
                      <button
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.35rem 0.6rem',
                          margin: '0 6px 6px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                        onClick={() => handleMakeScene(asset)}
                        title="Create a playable scene from this map directly in this session"
                      >
                        <Layers size={13} /> Make Scene
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Section: Export & Import under Asset Manager (Bug #31) */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          {resultMessage && (
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                backgroundColor: resultMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: resultMessage.type === 'success' ? '#10b981' : '#f43f5e',
                border: `1px solid ${resultMessage.type === 'success' ? '#10b981' : '#f43f5e'}`,
              }}
            >
              {resultMessage.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              {exporting ? 'Exporting...' : 'Export All Data to File'}
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? 'Importing...' : 'Import Data from File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleProcessFile(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
