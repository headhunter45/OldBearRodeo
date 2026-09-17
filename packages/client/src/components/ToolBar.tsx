import React from 'react';
import {
  MousePointer,
  Hand,
  Sparkles,
  ArrowUpRight,
  Crosshair,
  Circle,
  Square,
  Eye,
  EyeOff,
  Grid,
} from 'lucide-react';
import { ActiveTool } from '../engine/CanvasEngine.js';

interface ToolBarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  isGm: boolean;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  userColor: string;
  onChangeColor: (color: string) => void;
}

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899'];

export const ToolBar: React.FC<ToolBarProps> = ({
  activeTool,
  onSelectTool,
  isGm,
  snapEnabled,
  onToggleSnap,
  userColor,
  onChangeColor,
}) => {
  return (
    <div
      className="floating-hud floating-hud-toolbar glass-panel"
      style={{
        left: '1rem',
        top: '5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        padding: '0.4rem',
      }}
    >
      <button
        className={`btn-icon ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => onSelectTool('select')}
        title="Select & Move Token"
      >
        <MousePointer size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'pan' ? 'active' : ''}`}
        onClick={() => onSelectTool('pan')}
        title="Pan Viewport"
      >
        <Hand size={18} />
      </button>

      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

      {/* Ephemeral Screen Indicators */}
      <button
        className={`btn-icon ${activeTool === 'laser' ? 'active' : ''}`}
        onClick={() => onSelectTool('laser')}
        title="Laser Pointer (Click and drag cursor)"
      >
        <Sparkles size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => onSelectTool('arrow')}
        title="Arrow Marker (Drag to point)"
      >
        <ArrowUpRight size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'crosshair' ? 'active' : ''}`}
        onClick={() => onSelectTool('crosshair')}
        title="Crosshair Ping"
      >
        <Crosshair size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'circle' ? 'active' : ''}`}
        onClick={() => onSelectTool('circle')}
        title="Circle Radius Area (Center & drag outward)"
      >
        <Circle size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => onSelectTool('rectangle')}
        title="Rectangle Zone"
      >
        <Square size={18} />
      </button>

      {/* GM Fog of War Tools */}
      {isGm && (
        <>
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />
          <button
            className={`btn-icon ${activeTool === 'fog-reveal' ? 'active' : ''}`}
            onClick={() => onSelectTool('fog-reveal')}
            title="Fog Reveal (Drag rectangle to clear fog)"
            style={{ color: '#10b981' }}
          >
            <Eye size={18} />
          </button>
          <button
            className={`btn-icon ${activeTool === 'fog-hide' ? 'active' : ''}`}
            onClick={() => onSelectTool('fog-hide')}
            title="Fog Hide (Drag rectangle to obscure fog)"
            style={{ color: '#f43f5e' }}
          >
            <EyeOff size={18} />
          </button>
        </>
      )}

      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

      {/* Snap to Grid Toggle */}
      <button
        className={`btn-icon ${snapEnabled ? 'active' : ''}`}
        onClick={onToggleSnap}
        title={`Grid Snap: ${snapEnabled ? 'ON' : 'OFF'}`}
      >
        <Grid size={18} />
      </button>

      {/* User Color Selector */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          marginTop: '0.2rem',
        }}
      >
        <div
          title="Change Indicator Color"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: userColor,
            border: '2px solid white',
            cursor: 'pointer',
          }}
          onClick={() => {
            const nextIdx = (COLORS.indexOf(userColor) + 1) % COLORS.length;
            onChangeColor(COLORS[nextIdx]);
          }}
        />
      </div>
    </div>
  );
};
