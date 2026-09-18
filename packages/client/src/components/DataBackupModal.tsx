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
} from 'lucide-react';
import { GameSession, GameMap, Token } from '@oldbear/shared';
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
} from '../storage/db.js';
import {
  isTetraCubeMonsterFile,
  parseTetraCubeMonster,
} from '../utils/monsterParser.js';

interface DataBackupModalProps {
  session?: GameSession | null;
  isGm: boolean;
  tokens?: Record<string, Token> | Token[];
  activeMapId?: string;
  onRestoreSession?: (session: GameSession) => void;
  onAddMap?: (map: GameMap) => void;
  onSpawnToken?: (asset: StoredAsset) => void;
  onClose: () => void;
}

type AssetTab = 'maps' | 'tokens' | 'audio';

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  session,
  isGm,
  tokens,
  activeMapId,
  onRestoreSession,
  onAddMap,
  onSpawnToken,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('tokens');
  const [assets, setAssets] = useState<StoredAsset[]>([]);
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assetUploadRef = useRef<HTMLInputElement | null>(null);

  const loadAssets = async () => {
    try {
      const all = await getAllAssets();
      setAssets(all);
    } catch (err) {
      console.warn('Failed to load assets:', err);
    }
  };

  useEffect(() => {
    loadAssets();
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const filteredAssets = assets.filter((a) => {
    if (activeTab === 'maps') return a.type === 'map';
    if (activeTab === 'tokens') return a.type === 'token' || a.type === 'prop';
    if (activeTab === 'audio') return a.type === 'audio';
    return true;
  });

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
          }
        } catch (err) {
          console.warn('Failed parsing monster file:', err);
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

        let assetType: 'map' | 'token' | 'audio' = 'token';
        if (activeTab === 'maps' || file.name.includes('map')) assetType = 'map';
        else if (activeTab === 'audio' || file.type.startsWith('audio/')) assetType = 'audio';

        await saveAsset({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: assetType,
          dataUrl,
          fileSize: file.size,
          fileHash: hash,
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
      if (file.name.toLowerCase().endsWith('.monster') || file.name.toLowerCase().endsWith('.json')) {
        try {
          const text = await file.text();
          if (isTetraCubeMonsterFile(text, file.name)) {
            const { asset } = parseTetraCubeMonster(text);
            await saveAsset(asset);
            await loadAssets();
            setResultMessage({
              type: 'success',
              text: `Saved monster "${asset.name}" to library for encounter prep!`,
            });
            return;
          }
        } catch (err: any) {
          setResultMessage({ type: 'error', text: `Failed to import monster: ${err.message}` });
          return;
        }
      }
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={22} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>
                Asset Manager & Backup
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Manage uploaded tokens, maps, sounds, and export/import data
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '0 1rem',
          }}
        >
          <button
            className={`tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tokens');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.25rem',
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
            <User size={16} /> Tokens ({assets.filter((a) => a.type === 'token' || a.type === 'prop').length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'maps' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('maps');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.25rem',
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
            <Map size={16} /> Maps ({assets.filter((a) => a.type === 'map').length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('audio');
              setSelectedAssetIds([]);
            }}
            style={{
              padding: '0.75rem 1.25rem',
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
            <Music size={16} /> Sounds ({assets.filter((a) => a.type === 'audio').length})
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
                <Plus size={14} /> Upload {activeTab === 'maps' ? 'Map' : activeTab === 'audio' ? 'Sound' : 'Token'}...
                <input
                  ref={assetUploadRef}
                  type="file"
                  multiple
                  accept={activeTab === 'audio' ? 'audio/*' : 'image/*'}
                  style={{ display: 'none' }}
                  onChange={handleAssetUpload}
                />
              </label>

              {filteredAssets.length > 0 && (
                <>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }} onClick={selectAll}>
                    Select All
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }} onClick={deselectAll}>
                    Clear
                  </button>
                </>
              )}
            </div>

            {selectedAssetIds.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

          {/* Assets Grid */}
          {filteredAssets.length === 0 ? (
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
                    style={{
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none',
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
