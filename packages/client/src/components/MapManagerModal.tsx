import React, { useState } from 'react';
import { GameMap, GridType } from '@oldbear/shared';
import { Map, Plus, Upload, Check, Eye, Trash2, X, Settings, Sliders, Grid } from 'lucide-react';
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

        {/* Map Grid / Tile Settings Editor Modal View */}
        {selectedMapForEdit ? (
          <div
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} color="var(--accent-primary)" />
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  Configure Map & Grid: {selectedMapForEdit.name}
                </h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setSelectedMapForEdit(null)}>
                Back to Maps List
              </button>
            </div>

            {/* Grid Visibility & Color Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Show Grid Overlay */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  id="showGridCheck"
                  checked={selectedMapForEdit.showGrid !== false}
                  onChange={(e) => handleUpdateEditMap({ showGrid: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="showGridCheck" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Show Grid on Map (under tokens)
                </label>
              </div>

              {/* Grid Type */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GRID TYPE</label>
                <select
                  value={selectedMapForEdit.gridType || 'square'}
                  onChange={(e) => handleUpdateEditMap({ gridType: e.target.value as GridType })}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                >
                  <option value="square">Square Grid</option>
                  <option value="hex">Hexagonal Grid</option>
                  <option value="none">No Grid</option>
                </select>
              </div>

              {/* Grid Color */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GRID COLOR</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {['#ffffff', '#000000', '#f59e0b', '#3b82f6', '#10b981'].map((c) => (
                    <div
                      key={c}
                      onClick={() => handleUpdateEditMap({ gridColor: c })}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '4px',
                        backgroundColor: c,
                        border: selectedMapForEdit.gridColor === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                        cursor: 'pointer',
                        transform: selectedMapForEdit.gridColor === c ? 'scale(1.1)' : 'none',
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Grid Opacity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span>GRID OPACITY</span>
                  <span>{Math.round((selectedMapForEdit.gridOpacity ?? 0.4) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={selectedMapForEdit.gridOpacity ?? 0.4}
                  onChange={(e) => handleUpdateEditMap({ gridOpacity: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', marginTop: '0.25rem' }}
                />
              </div>
            </div>

            {/* Tile Size & Grid Offset Sizing Row (Item 20) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TILES WIDE (X)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={selectedMapForEdit.tilesX || Math.round(selectedMapForEdit.width / selectedMapForEdit.gridSize)}
                  onChange={(e) => {
                    const tilesX = Math.max(1, parseInt(e.target.value, 10) || 1);
                    const newGridSize = Math.round(selectedMapForEdit.width / tilesX);
                    handleUpdateEditMap({ tilesX, gridSize: newGridSize });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TILES HIGH (Y)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={selectedMapForEdit.tilesY || Math.round(selectedMapForEdit.height / selectedMapForEdit.gridSize)}
                  onChange={(e) => {
                    const tilesY = Math.max(1, parseInt(e.target.value, 10) || 1);
                    handleUpdateEditMap({ tilesY });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TILE SIZE (PX)</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={selectedMapForEdit.gridSize}
                  onChange={(e) => {
                    const size = Math.max(10, parseInt(e.target.value, 10) || 50);
                    handleUpdateEditMap({
                      gridSize: size,
                      tilesX: Math.round(selectedMapForEdit.width / size),
                      tilesY: Math.round(selectedMapForEdit.height / size),
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GRID OFFSET X (PX)</label>
                <input
                  type="number"
                  value={selectedMapForEdit.gridOffsetX || 0}
                  onChange={(e) => handleUpdateEditMap({ gridOffsetX: parseInt(e.target.value, 10) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GRID OFFSET Y (PX)</label>
                <input
                  type="number"
                  value={selectedMapForEdit.gridOffsetY || 0}
                  onChange={(e) => handleUpdateEditMap({ gridOffsetY: parseInt(e.target.value, 10) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.25rem',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.4rem 1rem' }}
                onClick={() => setSelectedMapForEdit(null)}
              >
                Save Settings
              </button>
            </div>
          </div>
        ) : null}

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
