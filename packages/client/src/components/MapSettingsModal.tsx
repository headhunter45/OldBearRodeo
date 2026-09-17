import React, { useState, useEffect, useRef } from 'react';
import { GameMap, GridType } from '@oldbear/shared';
import { X, Sliders, Trash2, Check, AlertCircle } from 'lucide-react';

interface MapSettingsModalProps {
  map: GameMap;
  canDelete: boolean;
  onSave: (updates: Partial<GameMap>) => void;
  onDelete: (mapId: string) => void;
  onClose: () => void;
}

const PRESET_GRID_COLORS = ['#ffffff', '#000000', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];
const PRESET_BG_COLORS = ['#090d16', '#1e293b', '#0f172a', '#18181b', '#2e1065', '#064e3b', '#451a03', '#27272a'];

export const MapSettingsModal: React.FC<MapSettingsModalProps> = ({
  map,
  canDelete,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState(map.name);
  const [showGrid, setShowGrid] = useState(map.showGrid !== false);
  const [gridType, setGridType] = useState<GridType>(map.gridType || 'square');
  const [gridColor, setGridColor] = useState(map.gridColor || '#ffffff');
  const [gridOpacity, setGridOpacity] = useState(map.gridOpacity ?? 0.4);
  const [backgroundColor, setBackgroundColor] = useState(map.backgroundColor || '#090d16');

  // String state for inputs to allow smooth backspacing without auto-snapping to 1
  const initialTilesX = map.tilesX || Math.max(1, Math.round(map.width / (map.gridSize || 50)));
  const initialTilesY = map.tilesY || Math.max(1, Math.round(map.height / (map.gridSize || 50)));
  const [tilesXStr, setTilesXStr] = useState(String(initialTilesX));
  const [tilesYStr, setTilesYStr] = useState(String(initialTilesY));
  const [gridSizeStr, setGridSizeStr] = useState(String(map.gridSize || 50));
  const [gridOffsetXStr, setGridOffsetXStr] = useState(String(map.gridOffsetX ?? 0));
  const [gridOffsetYStr, setGridOffsetYStr] = useState(String(map.gridOffsetY ?? 0));

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tilesXInputRef = useRef<HTMLInputElement | null>(null);

  // Focus on Tiles Wide on open and select all text
  useEffect(() => {
    if (tilesXInputRef.current) {
      tilesXInputRef.current.focus();
      tilesXInputRef.current.select();
    }
  }, []);

  const handleFocusSelect = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
  };

  const handleTilesXChange = (val: string) => {
    setTilesXStr(val);
    setError(null);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const calculatedGridSize = Math.max(5, Math.round(map.width / parsed));
      setGridSizeStr(String(calculatedGridSize));
    }
  };

  const handleGridSizeChange = (val: string) => {
    setGridSizeStr(val);
    setError(null);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const calculatedTilesX = Math.max(1, Math.round(map.width / parsed));
      const calculatedTilesY = Math.max(1, Math.round(map.height / parsed));
      setTilesXStr(String(calculatedTilesX));
      setTilesYStr(String(calculatedTilesY));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Map name cannot be empty.');
      return;
    }

    const parsedTilesX = parseInt(tilesXStr, 10);
    const parsedTilesY = parseInt(tilesYStr, 10);
    const parsedGridSize = parseInt(gridSizeStr, 10);
    const parsedOffsetX = parseInt(gridOffsetXStr, 10);
    const parsedOffsetY = parseInt(gridOffsetYStr, 10);

    if (isNaN(parsedTilesX) || parsedTilesX < 1 || parsedTilesX > 1000) {
      setError('Tiles wide must be a valid number between 1 and 1000.');
      return;
    }

    if (isNaN(parsedTilesY) || parsedTilesY < 1 || parsedTilesY > 1000) {
      setError('Tiles high must be a valid number between 1 and 1000.');
      return;
    }

    if (isNaN(parsedGridSize) || parsedGridSize < 5 || parsedGridSize > 1000) {
      setError('Tile size must be a valid number between 5px and 1000px.');
      return;
    }

    onSave({
      name: name.trim(),
      showGrid,
      gridType,
      gridColor,
      gridOpacity,
      backgroundColor,
      tilesX: parsedTilesX,
      tilesY: parsedTilesY,
      gridSize: parsedGridSize,
      gridOffsetX: isNaN(parsedOffsetX) ? 0 : parsedOffsetX,
      gridOffsetY: isNaN(parsedOffsetY) ? 0 : parsedOffsetY,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 60,
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
          maxWidth: '760px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sliders size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: '#f8fafc' }}>
              Edit Map Settings
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Two-Column Flow Layout (Item 26) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* COLUMN 1: Grid Styling & Visibility */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--accent-primary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.35rem',
                }}
              >
                1. Grid Display & Appearance
              </div>

              {/* 1. Checkbox First */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <input
                  type="checkbox"
                  id="modalShowGrid"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="modalShowGrid" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: '#f8fafc' }}>
                  Show Grid on Map (under tokens)
                </label>
              </div>

              {/* 2. Grid Type Next */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>GRID TYPE</label>
                <select
                  value={gridType}
                  onChange={(e) => setGridType(e.target.value as GridType)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.3rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="square">Square Grid</option>
                  <option value="hex">Hexagonal Grid</option>
                  <option value="none">No Grid</option>
                </select>
              </div>

              {/* 3. Grid Color */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>GRID COLOR</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {PRESET_GRID_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGridColor(c)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '4px',
                        backgroundColor: c,
                        border: gridColor === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                        cursor: 'pointer',
                        transform: gridColor === c ? 'scale(1.15)' : 'none',
                        transition: 'transform 0.1s ease',
                      }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={gridColor}
                    onChange={(e) => setGridColor(e.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    title="Custom Color"
                  />
                </div>
              </div>

              {/* 4. Grid Opacity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <span>GRID OPACITY</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{Math.round(gridOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={gridOpacity}
                  onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', marginTop: '0.4rem', cursor: 'pointer' }}
                />
              </div>

              {/* 5. Map Background Color (Item 34) */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  MAP BACKGROUND COLOR (OUTSIDE & GRID)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {PRESET_BG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBackgroundColor(c)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '4px',
                        backgroundColor: c,
                        border: backgroundColor === c ? '2px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                        cursor: 'pointer',
                        transform: backgroundColor === c ? 'scale(1.15)' : 'none',
                        transition: 'transform 0.1s ease',
                      }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    title="Custom Background Color"
                  />
                </div>
              </div>
            </div>

            {/* COLUMN 2: Map Name, Layout & Offsets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--accent-primary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.35rem',
                }}
              >
                2. Dimensions & Coordinates
              </div>

              {/* Map Name (Item 28) */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>MAP NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onClick={handleFocusSelect}
                  onFocus={handleFocusSelect}
                  placeholder="Enter map name..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    marginTop: '0.3rem',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Layout: Tiles Wide, Tiles High, Tile Size side by side */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                  GRID LAYOUT
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TILES WIDE (X)</label>
                    <input
                      ref={tilesXInputRef}
                      type="number"
                      min="1"
                      max="1000"
                      value={tilesXStr}
                      onChange={(e) => handleTilesXChange(e.target.value)}
                      onClick={handleFocusSelect}
                      onFocus={handleFocusSelect}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        marginTop: '0.2rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TILES HIGH (Y)</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={tilesYStr}
                      onChange={(e) => {
                        setTilesYStr(e.target.value);
                        setError(null);
                      }}
                      onClick={handleFocusSelect}
                      onFocus={handleFocusSelect}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        marginTop: '0.2rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TILE SIZE (PX)</label>
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      value={gridSizeStr}
                      onChange={(e) => handleGridSizeChange(e.target.value)}
                      onClick={handleFocusSelect}
                      onFocus={handleFocusSelect}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        marginTop: '0.2rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Offset: Offset X & Offset Y side by side */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                  GRID OFFSET
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OFFSET X (PX)</label>
                    <input
                      type="number"
                      value={gridOffsetXStr}
                      onChange={(e) => setGridOffsetXStr(e.target.value)}
                      onClick={handleFocusSelect}
                      onFocus={handleFocusSelect}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        marginTop: '0.2rem',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OFFSET Y (PX)</label>
                    <input
                      type="number"
                      value={gridOffsetYStr}
                      onChange={(e) => setGridOffsetYStr(e.target.value)}
                      onClick={handleFocusSelect}
                      onFocus={handleFocusSelect}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        marginTop: '0.2rem',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Delete Map (Item 26 & 28) */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                {confirmDelete ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ flex: 1, backgroundColor: 'var(--accent-rose)', color: 'white', fontSize: '0.8rem', padding: '0.45rem' }}
                      onClick={() => {
                        onDelete(map.id);
                        onClose();
                      }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem' }}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      color: 'var(--accent-rose)',
                      borderColor: 'rgba(244, 63, 94, 0.3)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      opacity: canDelete ? 1 : 0.4,
                      cursor: canDelete ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canDelete}
                    onClick={() => setConfirmDelete(true)}
                    title={canDelete ? 'Delete this map from session' : 'Cannot delete the only remaining map'}
                  >
                    <Trash2 size={14} /> Delete Map
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions (Item 27) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-strong)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Check size={16} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
