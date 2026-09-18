import React, { useState, useEffect } from 'react';
import { Upload, Map as MapIcon, Shield, Music, FileJson } from 'lucide-react';
import { GameMap, Token } from '@oldbear/shared';
import { saveAsset } from '../storage/db.js';
import { importAllData } from '../storage/BackupManager.js';
import { TOAST_DURATION_MS } from '../config/toast.js';

interface GlobalDropOverlayProps {
  isGm: boolean;
  activeMapId: string;
  gridSize: number;
  onAddMap: (map: GameMap) => void;
  onAddToken: (token: Token) => void;
  onDataRestored?: () => void;
}

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({
  isGm,
  activeMapId,
  gridSize,
  onAddMap,
  onAddToken,
  onDataRestored,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[] | null>(null);
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number }>({ x: 400, y: 400 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
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

      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      setDropPosition({ x: mouseX, y: mouseY });

      // 1. JSON Backup Files
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      if (jsonFiles.length > 0) {
        try {
          const text = await jsonFiles[0].text();
          const res = await importAllData(text);
          showToast(`Restored backup with ${res.assetCount} asset(s)!`);
          onDataRestored?.();
        } catch (err: any) {
          showToast(`Backup error: ${err.message}`);
        }
        return;
      }

      // 2. Audio Files
      const audioFiles = files.filter(
        (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
      );
      if (audioFiles.length > 0) {
        for (const file of audioFiles) {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            await saveAsset({
              id: `audio-${crypto.randomUUID()}`,
              name: cleanName,
              type: 'audio',
              dataUrl,
              createdAt: Date.now(),
            });
          };
          reader.readAsDataURL(file);
        }
        showToast(`Saved ${audioFiles.length} sound track(s) to Soundboard!`);
        return;
      }

      // 3. Image Files
      const imageFiles = files.filter(
        (f) => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i)
      );
      if (imageFiles.length > 0) {
        if (isGm) {
          // Ask GM whether to import as Token or Map
          setPendingImages(imageFiles);
        } else {
          // Directly import as token for players
          importImagesAsTokens(imageFiles, mouseX, mouseY);
        }
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
  }, [isGm, activeMapId, gridSize]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  };

  const importImagesAsTokens = (files: File[], startX = 400, startY = 400) => {
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const tokenId = `token-${crypto.randomUUID()}`;

        await saveAsset({
          id: tokenId,
          name: cleanName,
          type: 'token',
          dataUrl,
          createdAt: Date.now(),
        });

        const newToken: Token = {
          id: tokenId,
          mapId: activeMapId,
          name: cleanName,
          imageUrl: dataUrl,
          x: startX + index * gridSize,
          y: startY,
          size: 1,
          rotation: 0,
          ringColor: '#6366f1',
          fillColor: '#1e293b',
          clipCircle: true,
          currentHp: 25,
          maxHp: 25,
          tempHp: 0,
          speed: 30,
          conditions: [],
          isProp: false,
          layer: 'token',
        };

        onAddToken(newToken);
      };
      reader.readAsDataURL(file);
    });
    showToast(`Added ${files.length} token(s) to the map!`);
    setPendingImages(null);
  };

  const importImagesAsMaps = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = async () => {
          const width = img.naturalWidth || 2000;
          const height = img.naturalHeight || 1500;
          const defaultTilesX = Math.max(10, Math.round(width / 70));
          const defaultTilesY = Math.max(10, Math.round(height / 70));

          const mapId = `map-${crypto.randomUUID()}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');

          const newMap: GameMap = {
            id: mapId,
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
            id: mapId,
            name: cleanName,
            type: 'map',
            dataUrl,
            width,
            height,
            createdAt: Date.now(),
          });

          onAddMap(newMap);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
    showToast(`Added ${files.length} map(s)!`);
    setPendingImages(null);
  };

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
                <MapIcon size={16} /> Maps & Tokens
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Music size={16} /> Audio & SFX
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileJson size={16} /> Backup (.json)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GM Choice Modal: Import as Map or Token */}
      {pendingImages && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 95,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setPendingImages(null)}
        >
          <div
            className="glass-panel-elevated animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Import {pendingImages.length} Image{pendingImages.length > 1 ? 's' : ''}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                How would you like to add the dropped image{pendingImages.length > 1 ? 's' : ''}?
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', height: 'auto' }}
                onClick={() => importImagesAsTokens(pendingImages, dropPosition.x, dropPosition.y)}
              >
                <Shield size={20} />
                <span style={{ fontWeight: 700 }}>Add as Token{pendingImages.length > 1 ? 's' : ''}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Place on current map</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', height: 'auto' }}
                onClick={() => importImagesAsMaps(pendingImages)}
              >
                <MapIcon size={20} />
                <span style={{ fontWeight: 700 }}>Add as Map{pendingImages.length > 1 ? 's' : ''}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Add to Map Manager</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPendingImages(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
