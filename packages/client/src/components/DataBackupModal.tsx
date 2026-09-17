import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle,
  AlertTriangle,
  X,
  FileJson,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { GameSession } from '@oldbear/shared';
import { exportAllData, downloadBackupFile, importAllData } from '../storage/BackupManager.js';
import { getDB } from '../storage/db.js';

interface DataBackupModalProps {
  session?: GameSession | null;
  isGm: boolean;
  onRestoreSession?: (session: GameSession) => void;
  onClose: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  session,
  isGm,
  onRestoreSession,
  onClose,
}) => {
  const [stats, setStats] = useState<{ assetsCount: number; charCount: number }>({
    assetsCount: 0,
    charCount: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDB();
        const assets = await db.getAll('assets');
        const charRaw = localStorage.getItem('oldbear_saved_characters');
        const chars = charRaw ? JSON.parse(charRaw) : [];
        if (mounted) {
          setStats({
            assetsCount: assets.length,
            charCount: chars.length,
          });
        }
      } catch (e) {
        console.warn('Failed to load storage stats:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setResultMessage(null);
    try {
      const blob = await exportAllData(session);
      downloadBackupFile(blob);
      setResultMessage({
        type: 'success',
        text: 'Backup file successfully created and downloaded!',
      });
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Export failed: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleProcessFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setResultMessage({
        type: 'error',
        text: 'Please select a valid .json Old Bear Rodeo backup file.',
      });
      return;
    }

    setImporting(true);
    setResultMessage(null);

    try {
      const text = await file.text();
      const result = await importAllData(text);

      setResultMessage({
        type: 'success',
        text: `Import complete! Restored ${result.assetCount} asset(s) and character data.`,
      });

      // Update displayed stats
      setStats((prev) => ({
        ...prev,
        assetsCount: prev.assetsCount + result.assetCount,
      }));

      // If GM and session exists in backup, offer or apply restore
      if (isGm && result.session && onRestoreSession) {
        onRestoreSession(result.session);
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `Import failed: ${err.message || 'Invalid backup format'}`,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '520px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem' }}>
              Backup & Transfer Data
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Local Storage Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HardDrive size={18} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Stored in this Browser:</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            {stats.assetsCount} Map/Audio/Token Assets • {stats.charCount} Characters
          </div>
        </div>

        {/* Result Message */}
        {resultMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              backgroundColor:
                resultMessage.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${
                resultMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
              }`,
              color: resultMessage.type === 'success' ? '#10b981' : '#f43f5e',
            }}
          >
            {resultMessage.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Action Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Export Section */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                <Download size={16} color="#10b981" />
                Export
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Download all your maps, audio, tokens, characters, and current session as a single JSON file.
              </p>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? 'Exporting...' : 'Export to File'}
            </button>
          </div>

          {/* Import Section */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: isDragging ? '1px dashed var(--accent-primary)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleProcessFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                <Upload size={16} color="#38bdf8" />
                Import
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Restore a backup file to quickly switch to this computer or browser.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <button
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importing...' : 'Import from File'}
            </button>
          </div>
        </div>

        {/* Drag & Drop Hint */}
        <div
          style={{
            padding: '0.8rem',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <FileJson size={16} />
          <span>Tip: You can also drag and drop a backup .json file anywhere onto the board at any time!</span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
