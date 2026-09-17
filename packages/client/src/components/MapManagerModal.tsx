import React, { useState } from 'react';
import { GameMap, GridType } from '@oldbear/shared';
import { Map, Plus, Upload, Check, Eye, Trash2, X, Settings, Sliders, Grid } from 'lucide-react';
import { saveAsset } from '../storage/db.js';
import { MapSettingsModal } from './MapSettingsModal.js';

interface MapManagerModalProps {
  maps: GameMap[];
  activeMapId: string; // The map players see
  currentGmPreviewMapId: string; // The map GM is currently looking at
  onSelectGmPreviewMap: (mapId: string) => void;
  onSetActiveMapForPlayers: (mapId: string) => void;
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
  onAddMap,
  onUpdateMap,
  onDeleteMap,
  onClose,
}) => {
  const [selectedMapForEdit, setSelectedMapForEdit] = useState<GameMap | null>(null);

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
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{map.name}</div>
                    <button
                      className="btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => setSelectedMapForEdit(map)}
                      title="Configure Grid & Sizing"
                    >
                      <Settings size={15} />
                    </button>
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
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                        onClick={() => {
                          onSelectGmPreviewMap(map.id);
                          onSetActiveMapForPlayers(map.id);
                        }}
                        title="Send all players to this map"
                      >
                        <Check size={13} /> Send Players
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
