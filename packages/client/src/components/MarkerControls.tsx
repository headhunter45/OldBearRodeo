import React from 'react';
import { ScreenMarker } from '@oldbear/shared';
import { Lock, Unlock, Trash2, X, Circle, Square, ArrowUpRight, Crosshair, Sparkles } from 'lucide-react';

interface MarkerControlsProps {
  marker: ScreenMarker;
  onDelete: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onClose: () => void;
  canControl: boolean;
}

export const MarkerControls: React.FC<MarkerControlsProps> = ({
  marker,
  onDelete,
  onToggleLock,
  onClose,
  canControl,
}) => {
  if (!canControl) return null;

  const typeLabel =
    marker.type === 'circle'
      ? 'Circle Area'
      : marker.type === 'rectangle'
      ? 'Rectangle Zone'
      : marker.type === 'arrow'
      ? 'Arrow Marker'
      : marker.type === 'cone'
      ? 'Cone Template'
      : marker.type === 'crosshair'
      ? 'Target Ping'
      : 'Drawing Shape';

  const renderIcon = () => {
    switch (marker.type) {
      case 'circle':
        return <Circle size={16} color={marker.color} />;
      case 'rectangle':
        return <Square size={16} color={marker.color} />;
      case 'arrow':
        return <ArrowUpRight size={16} color={marker.color} />;
      case 'crosshair':
        return <Crosshair size={16} color={marker.color} />;
      default:
        return <Sparkles size={16} color={marker.color} />;
    }
  };

  return (
    <div
      className="floating-hud glass-panel animate-fade-in"
      style={{
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        maxWidth: '92vw',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {renderIcon()}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {typeLabel}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Created by {marker.userName}
          </span>
        </div>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

      {/* Lock / Unlock Toggle */}
      <button
        className={`btn btn-secondary ${marker.locked ? 'active' : ''}`}
        onClick={() => onToggleLock(marker.id, !marker.locked)}
        title={marker.locked ? 'Unlock Shape (Allow moving)' : 'Lock Shape (Prevent accidental movement)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem',
          fontSize: '0.8rem',
        }}
      >
        {marker.locked ? <Lock size={15} color="#f59e0b" /> : <Unlock size={15} />}
        <span>{marker.locked ? 'Locked' : 'Unlocked'}</span>
      </button>

      {/* Delete Shape */}
      <button
        className="btn btn-danger"
        onClick={() => onDelete(marker.id)}
        title="Delete Shape (Delete / Backspace)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem',
          fontSize: '0.8rem',
        }}
      >
        <Trash2 size={15} />
        <span>Delete</span>
      </button>

      {/* Deselect / Close */}
      <button
        className="btn-icon"
        onClick={onClose}
        title="Deselect (Escape)"
        style={{ padding: '0.3rem' }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
