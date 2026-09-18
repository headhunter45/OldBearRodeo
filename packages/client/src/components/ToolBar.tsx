import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Hand,
  BoxSelect,
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
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const selectMenuRef = useRef<HTMLDivElement>(null);

  const [showFogMenu, setShowFogMenu] = useState(false);
  const fogMenuRef = useRef<HTMLDivElement>(null);

  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const highlightMenuRef = useRef<HTMLDivElement>(null);

  const [showGridMenu, setShowGridMenu] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement>(null);

  const isSelectTool = ['select', 'box-select', 'pan'].includes(activeTool);
  const isHighlightTool = ['laser', 'arrow', 'crosshair', 'circle', 'rectangle'].includes(activeTool);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (selectMenuRef.current && !selectMenuRef.current.contains(target)) {
        setShowSelectMenu(false);
      }
      if (fogMenuRef.current && !fogMenuRef.current.contains(target)) {
        setShowFogMenu(false);
      }
      if (highlightMenuRef.current && !highlightMenuRef.current.contains(target)) {
        setShowHighlightMenu(false);
      }
      if (gridMenuRef.current && !gridMenuRef.current.contains(target)) {
        setShowGridMenu(false);
      }
    };
    if (showSelectMenu || showFogMenu || showHighlightMenu || showGridMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSelectMenu, showFogMenu, showHighlightMenu, showGridMenu]);
  return (
    <div
      className="floating-hud floating-hud-toolbar glass-panel"
      style={{
        left: '1rem',
        top: '5rem',
      }}
    >
      {/* Selection Tools Sub-menu (Flyout) */}
      <div ref={selectMenuRef} style={{ position: 'relative' }}>
        <button
          className={`btn-icon ${isSelectTool || showSelectMenu ? 'active' : ''}`}
          onClick={() => {
            setShowSelectMenu((v) => !v);
            setShowHighlightMenu(false);
            setShowFogMenu(false);
            setShowGridMenu(false);
          }}
          title="Selection Tools (S / B / G)"
        >
          {activeTool === 'box-select' ? (
            <BoxSelect size={18} />
          ) : activeTool === 'pan' ? (
            <Hand size={18} />
          ) : (
            <MousePointer size={18} />
          )}
        </button>

        {showSelectMenu && (
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
              minWidth: '160px',
            }}
          >
            <button
              className={`btn btn-secondary ${activeTool === 'select' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('select');
                setShowSelectMenu(false);
              }}
              title="Select Token (S)"
            >
              <MousePointer size={16} />
              <span>Select (S)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'box-select' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('box-select');
                setShowSelectMenu(false);
              }}
              title="Box Select Multiple Tokens (B)"
            >
              <BoxSelect size={16} />
              <span>Box Select (B)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'pan' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('pan');
                setShowSelectMenu(false);
              }}
              title="Grab / Pan Map (G)"
            >
              <Hand size={16} />
              <span>Grab / Pan (G)</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

      {/* Ephemeral Screen Indicators Sub-menu (Bug #59) */}
      <div ref={highlightMenuRef} style={{ position: 'relative' }}>
        <button
          className={`btn-icon ${isHighlightTool || showHighlightMenu ? 'active' : ''}`}
          onClick={() => {
            setShowHighlightMenu((v) => !v);
            setShowSelectMenu(false);
            setShowFogMenu(false);
            setShowGridMenu(false);
          }}
          title="Highlights & Markers (1-5)"
        >
          {activeTool === 'arrow' ? (
            <ArrowUpRight size={18} />
          ) : activeTool === 'crosshair' ? (
            <Crosshair size={18} />
          ) : activeTool === 'circle' ? (
            <Circle size={18} />
          ) : activeTool === 'rectangle' ? (
            <Square size={18} />
          ) : (
            <Sparkles size={18} />
          )}
        </button>

        {showHighlightMenu && (
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
              minWidth: '160px',
            }}
          >
            <button
              className={`btn btn-secondary ${activeTool === 'laser' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('laser');
                setShowHighlightMenu(false);
              }}
              title="Laser Pointer (1)"
            >
              <Sparkles size={16} />
              <span>Laser Pointer (1)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'arrow' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('arrow');
                setShowHighlightMenu(false);
              }}
              title="Arrow Marker (2)"
            >
              <ArrowUpRight size={16} />
              <span>Arrow Marker (2)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'crosshair' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('crosshair');
                setShowHighlightMenu(false);
              }}
              title="Crosshair Ping (3)"
            >
              <Crosshair size={16} />
              <span>Crosshair Ping (3)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'circle' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('circle');
                setShowHighlightMenu(false);
              }}
              title="Circle Radius Area (4)"
            >
              <Circle size={16} />
              <span>Circle Radius (4)</span>
            </button>

            <button
              className={`btn btn-secondary ${activeTool === 'rectangle' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={() => {
                onSelectTool('rectangle');
                setShowHighlightMenu(false);
              }}
              title="Rectangle Zone (5)"
            >
              <Square size={16} />
              <span>Rectangle Zone (5)</span>
            </button>
          </div>
        )}
      </div>

      {/* GM Fog of War Tools Sub-menu (Bug #58) */}
      {isGm && (
        <>
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />
          <div ref={fogMenuRef} style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${activeTool === 'fog-reveal' || activeTool === 'fog-hide' || showFogMenu ? 'active' : ''}`}
              onClick={() => {
                setShowFogMenu((v) => !v);
                setShowSelectMenu(false);
                setShowHighlightMenu(false);
                setShowGridMenu(false);
              }}
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

      {/* Grid Controls Sub-menu (Flyout) */}
      <div ref={gridMenuRef} style={{ position: 'relative' }}>
        <button
          className={`btn-icon ${snapEnabled || showGrid || showGridMenu ? 'active' : ''}`}
          onClick={() => {
            setShowGridMenu((v) => !v);
            setShowSelectMenu(false);
            setShowHighlightMenu(false);
            setShowFogMenu(false);
          }}
          title="Grid Controls (Snap & Visibility)"
          style={{
            color: showGrid ? 'var(--accent-emerald)' : undefined,
          }}
        >
          <Grid size={18} />
        </button>

        {showGridMenu && (
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
              minWidth: '170px',
            }}
          >
            <button
              className={`btn btn-secondary ${snapEnabled ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem',
                justifyContent: 'flex-start',
              }}
              onClick={onToggleSnap}
              title={`Grid Snap: ${snapEnabled ? 'ON' : 'OFF'}`}
            >
              <Grid size={16} />
              <span>Snap to Grid ({snapEnabled ? 'ON' : 'OFF'})</span>
            </button>

            {onToggleGrid && (
              <button
                className={`btn btn-secondary ${showGrid ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8rem',
                  justifyContent: 'flex-start',
                  color: showGrid ? 'var(--accent-emerald)' : undefined,
                }}
                onClick={onToggleGrid}
                title={`Map Grid Overlay: ${showGrid ? 'VISIBLE' : 'HIDDEN'}`}
              >
                {showGrid ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
              </button>
            )}
          </div>
        )}
      </div>

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
