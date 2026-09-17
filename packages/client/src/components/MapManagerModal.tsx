import React, { useState } from 'react';
import { GameMap } from '@oldbear/shared';
import { Map, Plus, Upload, Check, Eye, Trash2, X, Settings } from 'lucide-react';
import { saveAsset } from '../storage/db.js';

interface MapManagerModalProps {
  maps: GameMap[];
  activeMapId: string; // The map players see
  currentGmPreviewMapId: string; // The map GM is currently looking at
  onSelectGmPreviewMap: (mapId: string) => void;
  onSetActiveMapForPlayers: (mapId: string) => void;
  onAddMap: (map: GameMap) => void;
  onUpdateMap: (mapId: string, updates: Partial<GameMap>) => void;
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
  onClose,
}) => {
  const [selectedMapForEdit, setSelectedMapForEdit] = useState<GameMap | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        const newMap: GameMap = {
          id: `map-${crypto.randomUUID()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          imageUrl: dataUrl,
          gridSize: 50,
          gridType: 'square',
          gridColor: 'rgba(255, 255, 255, 0.25)',
          gridOpacity: 0.25,
          width: img.naturalWidth || 2000,
          height: img.naturalHeight || 1500,
          scaleFtPerCell: 5,
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
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
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
          maxWidth: '650px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Map size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem' }}>
              Maps & Scenes Manager
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          You can stage and prepare another map while players remain on the current one. Click "Send Players Here" when ready to transition them.
        </p>

        {/* Upload Map Button */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <Upload size={16} /> Upload New Map (PNG, JPG, WebP)
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>

        {/* Map Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {maps.map((map) => {
            const isPlayersActive = map.id === activeMapId;
            const isGmPreview = map.id === currentGmPreviewMapId;

            return (
              <div
                key={map.id}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: isPlayersActive
                    ? '2px solid #10b981'
                    : isGmPreview
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Thumbnail Preview */}
                <div
                  style={{
                    height: '120px',
                    backgroundColor: '#1e293b',
                    backgroundImage: map.imageUrl ? `url(${map.imageUrl})` : undefined,
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
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{map.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Grid: {map.gridSize}px ({map.gridType}) • {map.width}×{map.height}px
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                      onClick={() => onSelectGmPreviewMap(map.id)}
                    >
                      <Eye size={13} /> GM View
                    </button>

                    {!isPlayersActive && (
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                        onClick={() => {
                          onSelectGmPreviewMap(map.id);
                          onSetActiveMapForPlayers(map.id);
                        }}
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
