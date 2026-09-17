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
  CloudFog,
  CloudOff,
  Grid,
} from 'lucide-react';
import { ActiveTool } from '../engine/CanvasEngine.js';

import { COLOR_VALUES } from '../config/colors.js';

interface ToolBarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  isGm: boolean;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  userColor: string;
  onChangeColor: (color: string) => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  onCoverAllFog?: () => void;
  onClearAllFog?: () => void;
}

const COLORS = COLOR_VALUES;

export const ToolBar: React.FC<ToolBarProps> = ({
  activeTool,
  onSelectTool,
  isGm,
  snapEnabled,
  onToggleSnap,
  userColor,
  onChangeColor,
  showGrid,
  onToggleGrid,
  onCoverAllFog,
  onClearAllFog,
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
        title="Select & Move Token (V)"
      >
        <MousePointer size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'pan' ? 'active' : ''}`}
        onClick={() => onSelectTool('pan')}
        title="Pan Viewport (H)"
      >
        <Hand size={18} />
      </button>

      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

      {/* Ephemeral Screen Indicators */}
      <button
        className={`btn-icon ${activeTool === 'laser' ? 'active' : ''}`}
        onClick={() => onSelectTool('laser')}
        title="Laser Pointer (1)"
      >
        <Sparkles size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => onSelectTool('arrow')}
        title="Arrow Marker (2)"
      >
        <ArrowUpRight size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'crosshair' ? 'active' : ''}`}
        onClick={() => onSelectTool('crosshair')}
        title="Crosshair Ping (3)"
      >
        <Crosshair size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'circle' ? 'active' : ''}`}
        onClick={() => onSelectTool('circle')}
        title="Circle Radius Area (4)"
      >
        <Circle size={18} />
      </button>

      <button
        className={`btn-icon ${activeTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => onSelectTool('rectangle')}
        title="Rectangle Zone (5)"
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
            title="Fog Reveal - Drag rectangle to clear fog (R)"
            style={{ color: '#10b981' }}
          >
            <Eye size={18} />
          </button>
          <button
            className={`btn-icon ${activeTool === 'fog-hide' ? 'active' : ''}`}
            onClick={() => onSelectTool('fog-hide')}
            title="Fog Hide - Drag rectangle to obscure fog (F)"
            style={{ color: '#f43f5e' }}
          >
            <EyeOff size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={onCoverAllFog}
            title="Cover Entire Map with Fog"
            style={{ color: '#94a3b8' }}
          >
            <CloudFog size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={onClearAllFog}
            title="Clear All Fog from Map (Reveal All)"
            style={{ color: '#38bdf8' }}
          >
            <CloudOff size={18} />
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

      {/* Grid Overlay Visibility Toggle */}
      {onToggleGrid && (
        <button
          className={`btn-icon ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title={`Map Grid Overlay: ${showGrid ? 'VISIBLE' : 'HIDDEN'}`}
          style={{
            color: showGrid ? 'var(--accent-emerald)' : 'var(--text-muted)',
            backgroundColor: showGrid ? 'rgba(16, 185, 129, 0.15)' : undefined,
          }}
        >
          <Grid size={16} />
        </button>
      )}

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
