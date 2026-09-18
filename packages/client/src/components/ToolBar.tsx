import React, { useState, useRef, useEffect } from 'react';
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
  const [showFogMenu, setShowFogMenu] = useState(false);
  const fogMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fogMenuRef.current && !fogMenuRef.current.contains(e.target as Node)) {
        setShowFogMenu(false);
      }
    };
    if (showFogMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFogMenu]);
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

      {/* GM Fog of War Tools Sub-menu (Bug #58) */}
      {isGm && (
        <>
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />
          <div ref={fogMenuRef} style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${activeTool === 'fog-reveal' || activeTool === 'fog-hide' || showFogMenu ? 'active' : ''}`}
              onClick={() => setShowFogMenu((v) => !v)}
              title="Fog of War Controls"
              style={{
                color: activeTool === 'fog-reveal' ? '#10b981' : activeTool === 'fog-hide' ? '#f43f5e' : undefined,
              }}
            >
              {activeTool === 'fog-reveal' ? <Eye size={18} /> : activeTool === 'fog-hide' ? <EyeOff size={18} /> : <CloudFog size={18} />}
            </button>

            {showFogMenu && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 8px)',
                  top: '0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  padding: '0.4rem',
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  minWidth: '150px',
                }}
              >
                <button
                  className={`btn btn-secondary ${activeTool === 'fog-reveal' ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    justifyContent: 'flex-start',
                    color: '#10b981',
                  }}
                  onClick={() => {
                    onSelectTool('fog-reveal');
                    setShowFogMenu(false);
                  }}
                  title="Drag rectangle to reveal fog (R)"
                >
                  <Eye size={16} />
                  <span>Reveal Fog (R)</span>
                </button>

                <button
                  className={`btn btn-secondary ${activeTool === 'fog-hide' ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    justifyContent: 'flex-start',
                    color: '#f43f5e',
                  }}
                  onClick={() => {
                    onSelectTool('fog-hide');
                    setShowFogMenu(false);
                  }}
                  title="Drag rectangle to hide fog (F)"
                >
                  <EyeOff size={16} />
                  <span>Hide Fog (F)</span>
                </button>

                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.1rem 0' }} />

                <button
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    justifyContent: 'flex-start',
                    color: '#94a3b8',
                  }}
                  onClick={() => {
                    onCoverAllFog?.();
                    setShowFogMenu(false);
                  }}
                  title="Cover entire map with fog"
                >
                  <CloudFog size={16} />
                  <span>Cover All Fog</span>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8rem',
                    justifyContent: 'flex-start',
                    color: '#38bdf8',
                  }}
                  onClick={() => {
                    onClearAllFog?.();
                    setShowFogMenu(false);
                  }}
                  title="Clear all fog from map (Reveal all)"
                >
                  <CloudOff size={16} />
                  <span>Clear All Fog</span>
                </button>
              </div>
            )}
          </div>
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
