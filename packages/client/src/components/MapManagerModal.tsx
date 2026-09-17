import React, { useState, useEffect } from 'react';
import { GameMap, GridType } from '@oldbear/shared';
import { Map, Plus, Upload, Check, Eye, Trash2, X, Settings, Sliders, Grid, ArrowRightLeft, Copy, Layers } from 'lucide-react';
import { saveAsset, getAssetsByType, StoredAsset } from '../storage/db.js';
import { MapSettingsModal } from './MapSettingsModal.js';

interface MapManagerModalProps {
  maps: GameMap[];
  activeMapId: string; // The map players see
  currentGmPreviewMapId: string; // The map GM is currently looking at
  onSelectGmPreviewMap: (mapId: string) => void;
  onSetActiveMapForPlayers: (mapId: string) => void;
  onSendPlayersWithTokens?: (mapId: string) => void;
  onOpenBatchTokenTransfer?: () => void;
  onAddMap: (map: GameMap) => void;
  onUpdateMap: (mapId: string, updates: Partial<GameMap>) => void;
  onDeleteMap: (mapId: string) => void;
  onClose: () => void;
}

export const MapManagerModal: React.FC<MapManagerModalProps> = ({
  maps,
  activeMapId,
  currentGmPreviewMapId,
  onSelectGmPreviewMap,
  onSetActiveMapForPlayers,
  onSendPlayersWithTokens,
  onOpenBatchTokenTransfer,
  onAddMap,
  onUpdateMap,
  onDeleteMap,
  onClose,
}) => {
  const [selectedMapForEdit, setSelectedMapForEdit] = useState<GameMap | null>(null);
  const [showNewSceneModal, setShowNewSceneModal] = useState(false);
  const [mapAssets, setMapAssets] = useState<StoredAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [newSceneName, setNewSceneName] = useState<string>('');

  useEffect(() => {
    if (showNewSceneModal) {
      getAssetsByType('map').then((assets) => {
        setMapAssets(assets);
        if (assets.length > 0) {
          setSelectedAssetId(assets[0].id);
          setNewSceneName(`${assets[0].name} Scene`);
        } else if (maps.length > 0) {
          setSelectedAssetId(maps[0].id);
          setNewSceneName(`${maps[0].name} Scene`);
        }
      });
    }
  }, [showNewSceneModal, maps]);

  const handleDuplicateScene = (scene: GameMap) => {
    const duplicated: GameMap = {
      ...scene,
      id: `map-${crypto.randomUUID()}`,
      name: `${scene.name} (Copy)`,
      baseMapId: scene.baseMapId || scene.id,
      baseMapName: scene.baseMapName || scene.name,
    };
    onAddMap(duplicated);
    onSelectGmPreviewMap(duplicated.id);
  };

  const handleCreateSceneFromSelectedMap = () => {
    const asset = mapAssets.find((a) => a.id === selectedAssetId);
    const existingMap = maps.find((m) => m.id === selectedAssetId);

    if (!asset && !existingMap) return;

    const sourceName = asset?.name || existingMap?.name || 'Map';
    const imageUrl = asset?.dataUrl || existingMap?.imageUrl || '';
    const width = asset?.width || existingMap?.width || 2000;
    const height = asset?.height || existingMap?.height || 1500;
    const gridSize = existingMap?.gridSize || 50;
    const gridType = existingMap?.gridType || 'square';
    const gridColor = existingMap?.gridColor || '#ffffff';
    const gridOpacity = existingMap?.gridOpacity ?? 0.4;
    const backgroundColor = existingMap?.backgroundColor;

    const newScene: GameMap = {
      id: `map-${crypto.randomUUID()}`,
      name: newSceneName.trim() || `${sourceName} Scene`,
      imageUrl,
      gridSize,
      gridType,
      gridColor,
      gridOpacity,
      width,
      height,
      scaleFtPerCell: 5,
      showGrid: true,
      baseMapId: asset?.id || existingMap?.id,
      baseMapName: sourceName,
      backgroundColor,
    };

    onAddMap(newScene);
    onSelectGmPreviewMap(newScene.id);
    setShowNewSceneModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = async () => {
          const width = img.naturalWidth || 2000;
          const height = img.naturalHeight || 1500;
          const defaultTilesX = Math.max(10, Math.round(width / 70));
          const defaultTilesY = Math.max(10, Math.round(height / 70));
          const newMap: GameMap = {
            id: `map-${crypto.randomUUID()}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: dataUrl,
            gridSize: Math.round(width / defaultTilesX),
            gridType: 'square',
            gridColor: '#ffffff',
            gridOpacity: 0.4,
            showGrid: true,
            width,
            height,
            scaleFtPerCell: 5,
            tilesX: defaultTilesX,
            tilesY: defaultTilesY,
            gridOffsetX: 0,
            gridOffsetY: 0,
          };

          // Save to browser IndexedDB
          await saveAsset({
            id: newMap.id,
            name: newMap.name,
            type: 'map',
            dataUrl,
            width: newMap.width,
            height: newMap.height,
            createdAt: Date.now(),
          });

          onAddMap(newMap);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateEditMap = (updates: Partial<GameMap>) => {
    if (!selectedMapForEdit) return;
    const updated = { ...selectedMapForEdit, ...updates };
    setSelectedMapForEdit(updated);
    onUpdateMap(selectedMapForEdit.id, updates);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid var(--border-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Map size={24} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>
              Maps & Scenes Manager
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Upload Map Button with Multiple Select */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <Upload size={16} /> Upload Maps (Select Multiple)
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowNewSceneModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            title="Create a new scene using an existing map image"
          >
            <Layers size={16} /> New Scene from Map...
          </button>

          {onOpenBatchTokenTransfer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenBatchTokenTransfer}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowRightLeft size={16} /> Batch Move Tokens...
            </button>
          )}
        </div>

        {/* Map Settings Modal Dialog (Items 24, 25, 26, 27, 28, 34) */}
        {selectedMapForEdit && (
          <MapSettingsModal
            map={selectedMapForEdit}
            canDelete={maps.length > 1}
            onSave={(updates) => handleUpdateEditMap(updates)}
            onDelete={(mapId) => {
              onDeleteMap(mapId);
              setSelectedMapForEdit(null);
            }}
            onClose={() => setSelectedMapForEdit(null)}
          />
        )}

        {/* Map Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {maps.map((map) => {
            const isPlayersActive = map.id === activeMapId;
            const isGmPreview = map.id === currentGmPreviewMapId;

            return (
              <div
                key={map.id}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: isPlayersActive
                    ? '2px solid #10b981'
                    : isGmPreview
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    height: '140px',
                    backgroundImage: map.imageUrl ? `url("${map.imageUrl}")` : 'none',
                    backgroundColor: '#1e293b',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!map.imageUrl && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Default Grid</span>
                  )}

                  {/* Badges */}
                  <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                    {isPlayersActive && (
                      <span
                        style={{
                          backgroundColor: '#10b981',
                          color: '#000',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        PLAYERS HERE
                      </span>
                    )}
                    {isGmPreview && !isPlayersActive && (
                      <span
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        GM STAGING
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Controls */}
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={map.name}>
                        {map.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', opacity: 0.85 }}>
                        Map: {map.baseMapName || map.name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        className="btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        onClick={() => handleDuplicateScene(map)}
                        title="Duplicate this Scene (same map)"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        onClick={() => setSelectedMapForEdit(map)}
                        title="Configure Grid & Sizing"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Grid: {map.gridSize}px ({map.gridType}) • {map.width}×{map.height}px
                    {map.showGrid === false && <span style={{ color: 'var(--accent-rose)', marginLeft: '4px' }}>[Grid Hidden]</span>}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                      onClick={() => onSelectGmPreviewMap(map.id)}
                    >
                      <Eye size={13} /> GM View
                    </button>

                    {isPlayersActive ? (
                      <div
                        style={{
                          flex: 1,
                          fontSize: '0.75rem',
                          padding: '0.35rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: 'var(--accent-emerald)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                      >
                        <Check size={13} /> Active for Players
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.2rem' }}
                          onClick={() => {
                            onSelectGmPreviewMap(map.id);
                            onSetActiveMapForPlayers(map.id);
                          }}
                          title="Send all players to this map"
                        >
                          <Check size={13} /> Send Players
                        </button>
                        {onSendPlayersWithTokens && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                            onClick={() => {
                              onSelectGmPreviewMap(map.id);
                              onSendPlayersWithTokens(map.id);
                            }}
                            title="Send all players and move all player tokens to this map"
                          >
                            + Tokens
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Scene from Map Dialog (Bug #29) */}
        {showNewSceneModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              zIndex: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setShowNewSceneModal(false)}
          >
            <div
              className="glass-panel-elevated animate-fade-in"
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '1.5rem',
                backgroundColor: 'rgba(17, 24, 39, 0.98)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem' }}>
                  <Layers size={20} color="var(--accent-primary)" /> Create Scene from Map
                </h3>
                <button className="btn-icon" onClick={() => setShowNewSceneModal(false)}>
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Scenes allow you to use the same map across multiple encounters with independent tokens, fog, and settings.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Scene Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                    placeholder="e.g. Castle Courtyard - Night Ambush"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Choose Base Map Asset
                  </label>
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    {[
                      ...mapAssets.map((a) => ({ id: a.id, name: a.name, imageUrl: a.dataUrl })),
                      ...maps
                        .filter((m) => !mapAssets.some((a) => a.id === m.baseMapId || a.id === m.id))
                        .map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl })),
                    ].map((m) => {
                      const isSelected = selectedAssetId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedAssetId(m.id);
                            if (!newSceneName || newSceneName.endsWith(' Scene')) {
                              setNewSceneName(`${m.name} Scene`);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              width: '44px',
                              height: '32px',
                              borderRadius: '4px',
                              backgroundImage: m.imageUrl ? `url("${m.imageUrl}")` : 'none',
                              backgroundColor: '#1e293b',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{m.name}</span>
                          {isSelected && <Check size={16} color="var(--accent-primary)" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowNewSceneModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateSceneFromSelectedMap}
                    disabled={!selectedAssetId}
                  >
                    <Check size={14} /> Create Scene
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
