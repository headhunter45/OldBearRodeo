import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Map as MapIcon,
  Shield,
  Music,
  FileJson,
  Skull,
  CheckSquare,
  Square,
  ChevronDown,
  Package,
} from 'lucide-react';
import { GameMap, Token } from '@oldbear/shared';
import { saveAsset, StoredAsset } from '../storage/db.js';
import { importAllData } from '../storage/BackupManager.js';
import { TOAST_DURATION_MS } from '../config/toast.js';
import {
  isTetraCubeMonsterFile,
  parseTetraCubeMonster,
  createMonsterToken,
} from '../utils/monsterParser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AssetKind = 'token' | 'map' | 'prop';

interface PendingImageEntry {
  file: File;
  previewUrl: string;
  kind: AssetKind;
  selected: boolean;
}

interface GlobalDropOverlayProps {
  isGm: boolean;
  activeMapId: string;
  gridSize: number;
  tokens?: Record<string, Token> | Token[];
  screenToWorld?: (x: number, y: number) => { x: number; y: number };
  onAddMap: (map: GameMap) => void;
  onAddToken: (token: Token) => void;
  onDataRestored?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({
  isGm,
  activeMapId,
  gridSize,
  tokens,
  screenToWorld,
  onAddMap,
  onAddToken,
  onDataRestored,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<PendingImageEntry[] | null>(null);
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number }>({ x: 400, y: 400 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }, []);

  // ── drag event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (
        (e.dataTransfer && e.dataTransfer.types.includes('Files')) ||
        e.dataTransfer?.types.includes('application/oldbear-asset')
      ) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
        dragCounter = 0;
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const worldPos = screenToWorld ? screenToWorld(mouseX, mouseY) : { x: mouseX, y: mouseY };
      const existingList = Array.isArray(tokens) ? tokens : Object.values(tokens || {});

      // 0. Internal asset drag from Asset Manager (Bug #73 & Task #112)
      const internalAssetJson =
        e.dataTransfer?.getData('application/oldbear-asset') ||
        e.dataTransfer?.getData('application/json');
      if (internalAssetJson) {
        try {
          const asset = JSON.parse(internalAssetJson);
          if (asset && (asset.id || asset.name) && (asset.type || asset.dataUrl)) {
            let newToken: Token;
            if (asset.isProp || asset.type === 'prop') {
              newToken = {
                id: `token-${crypto.randomUUID()}`,
                name: asset.name || 'Prop',
                mapId: activeMapId,
                x: worldPos.x,
                y: worldPos.y,
                size: asset.size || 1,
                imageUrl: asset.dataUrl,
                ringColor: asset.ringColor || '#10b981',
                currentHp: asset.hp || 10,
                maxHp: asset.maxHp || asset.hp || 10,
                conditions: [],
                rotation: 0,
                fillColor: 'transparent',
                clipCircle: false,
                tempHp: 0,
                speed: 0,
                elevation: 0,
                isProp: true,
                layer: 'prop',
                propWidth: asset.propWidth,
                propHeight: asset.propHeight,
                locked: asset.locked,
              };
            } else if (asset.type === 'monster' || asset.monsterData) {
              newToken = createMonsterToken(asset, activeMapId, worldPos.x, worldPos.y, existingList);
            } else if (asset.type === 'character' && asset.character) {
              const char = asset.character;
              newToken = {
                id: `token-${crypto.randomUUID()}`,
                name: char.name || asset.name || 'Character',
                mapId: activeMapId,
                x: worldPos.x,
                y: worldPos.y,
                size: 1,
                rotation: 0,
                imageUrl: char.avatarUrl || asset.dataUrl || '',
                ringColor: '#6366f1',
                fillColor: '#1e293b',
                clipCircle: true,
                currentHp: char.currentHp ?? char.maxHp ?? 10,
                maxHp: char.maxHp ?? 10,
                tempHp: 0,
                conditions: [],
                speed: char.speed || 30,
                elevation: 0,
                isProp: false,
                layer: 'token',
                character: char,
              };
            } else {
              newToken = {
                id: `token-${crypto.randomUUID()}`,
                name: asset.name || 'Token',
                mapId: activeMapId,
                x: worldPos.x,
                y: worldPos.y,
                size: asset.size || 1,
                rotation: 0,
                imageUrl: asset.dataUrl,
                ringColor: asset.ringColor || '#6366f1',
                fillColor: '#1e293b',
                clipCircle: true,
                currentHp: asset.hp || 10,
                maxHp: asset.maxHp || asset.hp || 10,
                tempHp: 0,
                conditions: [],
                speed: asset.speed || 30,
                elevation: 0,
                isProp: false,
                layer: 'token',
              };
            }
            onAddToken(newToken);
            showToast(`Spawned "${newToken.name}" onto the battlemap!`);
            return;
          }
        } catch (err) {
          // not an internal asset, proceed to files
        }
      }

      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      setDropPosition({ x: mouseX, y: mouseY });

      // 1. TetraCube .monster files (Bug #73)
      const monsterFiles = files.filter((f) => f.name.toLowerCase().endsWith('.monster'));
      if (monsterFiles.length > 0) {
        for (let i = 0; i < monsterFiles.length; i++) {
          const file = monsterFiles[i];
          try {
            const text = await file.text();
            const { asset } = parseTetraCubeMonster(text);
            await saveAsset(asset);
            const offset = i * gridSize;
            const newToken = createMonsterToken(
              asset,
              activeMapId,
              worldPos.x + offset,
              worldPos.y,
              existingList
            );
            onAddToken(newToken);
            existingList.push(newToken);
            showToast(`Spawned "${newToken.name}" on battlemap & saved to Asset Manager!`);
          } catch (err: any) {
            showToast(`Error importing monster: ${err.message}`);
          }
        }
        return;
      }

      // 2. JSON files (Backups or Monster JSON)
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      if (jsonFiles.length > 0) {
        for (const jsonFile of jsonFiles) {
          try {
            const text = await jsonFile.text();
            if (isTetraCubeMonsterFile(text, jsonFile.name)) {
              const { asset } = parseTetraCubeMonster(text);
              await saveAsset(asset);
              const newToken = createMonsterToken(asset, activeMapId, worldPos.x, worldPos.y, existingList);
              onAddToken(newToken);
              existingList.push(newToken);
              showToast(`Spawned "${newToken.name}" on battlemap & saved to Asset Manager!`);
              return;
            }

            const res = await importAllData(text);
            showToast(`Restored backup with ${res.assetCount} asset(s)!`);
            onDataRestored?.();
            return;
          } catch (err: any) {
            showToast(`Backup error: ${err.message}`);
          }
        }
        return;
      }

      // 3. Audio files
      const audioFiles = files.filter(
        (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
      );
      if (audioFiles.length > 0) {
        for (const file of audioFiles) {
          const dataUrl = await readFileAsDataUrl(file);
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          await saveAsset({
            id: `audio-${crypto.randomUUID()}`,
            name: cleanName,
            type: 'audio',
            dataUrl,
            createdAt: Date.now(),
          });
        }
        showToast(`Saved ${audioFiles.length} sound track(s) to Soundboard!`);
        return;
      }

      // 4. Image files — open unified multi-file import modal (Bug #74)
      const imageFiles = files.filter(
        (f) => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i)
      );
      if (imageFiles.length > 0) {
        // Build preview entries; default to Token for non-GMs, else smart-guess
        const defaultKind: AssetKind = isGm ? 'token' : 'token';
        const entries: PendingImageEntry[] = await Promise.all(
          imageFiles.map(async (file) => {
            const previewUrl = await readFileAsDataUrl(file);
            return { file, previewUrl, kind: defaultKind, selected: true };
          })
        );
        setPendingEntries(entries);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [isGm, activeMapId, gridSize, screenToWorld, tokens, showToast]);

  // ── pending entries helpers ────────────────────────────────────────────────

  const updateEntry = (index: number, patch: Partial<PendingImageEntry>) => {
    setPendingEntries((prev) =>
      prev ? prev.map((e, i) => (i === index ? { ...e, ...patch } : e)) : prev
    );
  };

  const setAllKind = (kind: AssetKind) => {
    setPendingEntries((prev) => prev?.map((e) => ({ ...e, kind })) ?? null);
  };

  const toggleAllSelected = () => {
    setPendingEntries((prev) => {
      if (!prev) return prev;
      const allChecked = prev.every((e) => e.selected);
      return prev.map((e) => ({ ...e, selected: !allChecked }));
    });
  };

  // ── import logic ──────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!pendingEntries) return;
    setIsImporting(true);

    const selected = pendingEntries.filter((e) => e.selected);
    let tokenCount = 0;
    let mapCount = 0;
    let propCount = 0;
    let tokenIndex = 0;

    for (const entry of selected) {
      const dataUrl = entry.previewUrl; // already loaded
      const cleanName = entry.file.name.replace(/\.[^/.]+$/, '');
      const assetId = `${entry.kind}-${crypto.randomUUID()}`;

      if (entry.kind === 'map') {
        // Determine image dimensions
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = async () => {
            const width = img.naturalWidth || 2000;
            const height = img.naturalHeight || 1500;
            const defaultTilesX = Math.max(10, Math.round(width / 70));
            const defaultTilesY = Math.max(10, Math.round(height / 70));

            const newMap: GameMap = {
              id: assetId,
              name: cleanName,
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

            await saveAsset({
              id: assetId,
              name: cleanName,
              type: 'map',
              dataUrl,
              width,
              height,
              createdAt: Date.now(),
            });

            onAddMap(newMap);
            mapCount++;
            resolve();
          };
          img.src = dataUrl;
        });
      } else {
        // Token or Prop
        const isProp = entry.kind === 'prop';
        await saveAsset({
          id: assetId,
          name: cleanName,
          type: isProp ? 'prop' : 'token',
          dataUrl,
          createdAt: Date.now(),
        });

        const newToken: Token = {
          id: assetId,
          mapId: activeMapId,
          name: cleanName,
          imageUrl: dataUrl,
          x: dropPosition.x + tokenIndex * gridSize,
          y: dropPosition.y,
          size: 1,
          rotation: 0,
          ringColor: isProp ? '#94a3b8' : '#6366f1',
          fillColor: '#1e293b',
          clipCircle: !isProp,
          currentHp: isProp ? 0 : 25,
          maxHp: isProp ? 0 : 25,
          tempHp: 0,
          speed: 30,
          conditions: [],
          isProp,
          layer: isProp ? 'prop' : 'token',
        };

        onAddToken(newToken);
        tokenIndex++;
        isProp ? propCount++ : tokenCount++;
      }
    }

    setIsImporting(false);
    setPendingEntries(null);

    const parts: string[] = [];
    if (tokenCount > 0) parts.push(`${tokenCount} token${tokenCount > 1 ? 's' : ''}`);
    if (propCount > 0) parts.push(`${propCount} prop${propCount > 1 ? 's' : ''}`);
    if (mapCount > 0) parts.push(`${mapCount} map${mapCount > 1 ? 's' : ''}`);
    showToast(`Imported ${parts.join(', ')}!`);
  };

  // ── derived state ─────────────────────────────────────────────────────────

  const allSelected = pendingEntries?.every((e) => e.selected) ?? false;
  const someSelected = pendingEntries?.some((e) => e.selected) ?? false;
  const selectedCount = pendingEntries?.filter((e) => e.selected).length ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '999px',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            fontSize: '0.85rem',
            fontWeight: 600,
            zIndex: 200,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Global Dragging Overlay Indicator */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 13, 22, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            border: '4px dashed var(--accent-primary)',
            margin: '0.5rem',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--accent-primary)',
              }}
            >
              <Upload size={36} color="var(--accent-primary)" />
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800 }}>
              Drop Files to Import
            </h2>

            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapIcon size={16} /> Maps &amp; Tokens
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Skull size={16} /> Monsters (.monster)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Music size={16} /> Audio &amp; SFX
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileJson size={16} /> Backup (.json)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-file Image Import Modal (Bug #74) ── */}
      {pendingEntries && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 95,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !isImporting && setPendingEntries(null)}
        >
          <div
            className="glass-panel-elevated animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem 1rem',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  marginBottom: '0.25rem',
                }}
              >
                Import {pendingEntries.length} Image{pendingEntries.length > 1 ? 's' : ''}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Choose how each file should be added. Use bulk actions to set all at once.
              </p>
            </div>

            {/* Bulk action bar */}
            <div
              style={{
                padding: '0.65rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                backgroundColor: 'rgba(255,255,255,0.02)',
                flexShrink: 0,
              }}
            >
              {/* Select all checkbox */}
              <button
                onClick={toggleAllSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'none',
                  border: 'none',
                  color: allSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.3rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'color 0.15s ease',
                }}
                title={allSelected ? 'Deselect all' : 'Select all'}
              >
                {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                Check all
              </button>

              <div
                style={{
                  width: '1px',
                  height: '18px',
                  backgroundColor: 'var(--border-subtle)',
                  margin: '0 0.25rem',
                }}
              />

              {/* Bulk kind setters */}
              {(
                [
                  { kind: 'token' as AssetKind, icon: <Shield size={14} />, label: 'Set all to Tokens' },
                  { kind: 'map' as AssetKind, icon: <MapIcon size={14} />, label: 'Set all to Maps' },
                  { kind: 'prop' as AssetKind, icon: <Package size={14} />, label: 'Set all to Props' },
                ] as const
              ).map(({ kind, icon, label }) => (
                <button
                  key={kind}
                  onClick={() => setAllKind(kind)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* File list */}
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '0.5rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {pendingEntries.map((entry, index) => (
                <FileImportRow
                  key={`${entry.file.name}-${index}`}
                  entry={entry}
                  isGm={isGm}
                  onToggleSelected={() => updateEntry(index, { selected: !entry.selected })}
                  onKindChange={(kind) => updateEntry(index, { kind })}
                />
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {selectedCount} of {pendingEntries.length} selected
              </span>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPendingEntries(null)}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={isImporting || !someSelected}
                  style={{ minWidth: '110px' }}
                >
                  {isImporting ? 'Importing…' : `Import ${selectedCount > 0 ? selectedCount : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FileImportRow sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface FileImportRowProps {
  entry: PendingImageEntry;
  isGm: boolean;
  onToggleSelected: () => void;
  onKindChange: (kind: AssetKind) => void;
}

const KIND_OPTIONS: { value: AssetKind; label: string; icon: React.ReactNode }[] = [
  { value: 'token', label: 'Token', icon: <Shield size={13} /> },
  { value: 'map', label: 'Map', icon: <MapIcon size={13} /> },
  { value: 'prop', label: 'Prop', icon: <Package size={13} /> },
];

const FileImportRow: React.FC<FileImportRowProps> = ({ entry, isGm, onToggleSelected, onKindChange }) => {
  const displayName = entry.file.name.replace(/\.[^/.]+$/, '');
  const fileSizeKb = (entry.file.size / 1024).toFixed(0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.55rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${entry.selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        backgroundColor: entry.selected ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255,255,255,0.02)',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        opacity: entry.selected ? 1 : 0.5,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelected}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: entry.selected ? 'var(--accent-primary)' : 'var(--text-tertiary)',
          padding: 0,
          display: 'flex',
          flexShrink: 0,
          transition: 'color 0.15s ease',
        }}
        title={entry.selected ? 'Deselect' : 'Select'}
      >
        {entry.selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      {/* Thumbnail */}
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: entry.kind === 'token' ? '50%' : '6px',
          overflow: 'hidden',
          flexShrink: 0,
          border: '2px solid var(--border-subtle)',
          transition: 'border-radius 0.2s ease',
        }}
      >
        <img
          src={entry.previewUrl}
          alt={displayName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={entry.file.name}
        >
          {displayName}
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)' }}>
          {fileSizeKb} KB · {entry.file.type || 'image'}
        </div>
      </div>

      {/* Kind toggle (only full options for GM, players just get token) */}
      {isGm ? (
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          {KIND_OPTIONS.map(({ value, label, icon }) => {
            const active = entry.kind === value;
            return (
              <button
                key={value}
                onClick={() => onKindChange(value)}
                title={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: active
                    ? '1.5px solid var(--accent-primary)'
                    : '1.5px solid var(--border-subtle)',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <Shield size={13} /> Token
        </span>
      )}
    </div>
  );
};
