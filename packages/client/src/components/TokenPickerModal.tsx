import React, { useState, useEffect } from 'react';
import { X, Upload, User, Sparkles, Check } from 'lucide-react';
import { StoredAsset, getAssetsByType, saveAsset } from '../storage/db.js';

interface TokenPickerModalProps {
  onClose: () => void;
  onCreateToken: (tokenData: { name: string; imageUrl?: string; size: number }) => void;
}

const PRESET_TOKENS = [
  { name: 'Knight Warrior', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80' },
  { name: 'Elven Wizard', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80' },
  { name: 'Shadow Rogue', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&auto=format&fit=crop&q=80' },
  { name: 'Holy Cleric', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&auto=format&fit=crop&q=80' },
  { name: 'Forest Ranger', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { name: 'Orc Berserker', url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=150&auto=format&fit=crop&q=80' },
  { name: 'Dragon Wyrmling', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&auto=format&fit=crop&q=80' },
  { name: 'Goblin Scout', url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80' },
];

export const TokenPickerModal: React.FC<TokenPickerModalProps> = ({ onClose, onCreateToken }) => {
  const [tokenName, setTokenName] = useState('Hero');
  const [size, setSize] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [savedAssets, setSavedAssets] = useState<StoredAsset[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const assets = await getAssetsByType('token');
        setSavedAssets(assets);
      } catch (err) {
        console.warn('Failed to load token assets:', err);
      }
    })();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSelectedImage(dataUrl);
      if (!tokenName || tokenName === 'Hero') {
        setTokenName(file.name.replace(/\.[^/.]+$/, ''));
      }
      // Persist to indexedDB asset library
      await saveAsset({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'token',
        dataUrl,
        createdAt: Date.now(),
      });
      const updated = await getAssetsByType('token');
      setSavedAssets(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    onCreateToken({
      name: tokenName.trim() || 'New Token',
      imageUrl: selectedImage || undefined,
      size,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
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
        className="glass-panel-elevated animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <User size={22} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>
              Add New Token
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Token Name & Size Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. Valeros, Goblin Archer"
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'white',
                  marginTop: '0.35rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size</label>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'white',
                  marginTop: '0.35rem',
                }}
              >
                <option value={1}>1x1 (Medium)</option>
                <option value={2}>2x2 (Large)</option>
                <option value={3}>3x3 (Huge)</option>
                <option value={4}>4x4 (Gargantuan)</option>
              </select>
            </div>
          </div>

          {/* Upload Button */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Upload Custom Image
            </div>
            <label
              className="btn btn-secondary"
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1rem',
              }}
            >
              <Upload size={16} /> Choose Image File...
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>

          {/* Saved Assets Library */}
          {savedAssets.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Your Uploaded Token Library
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
                  gap: '0.6rem',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  padding: '4px',
                }}
              >
                {savedAssets.map((asset) => {
                  const isSel = selectedImage === asset.dataUrl;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedImage(asset.dataUrl);
                        if (!tokenName || tokenName === 'Hero') setTokenName(asset.name);
                      }}
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: 'var(--radius-md)',
                        border: isSel ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        backgroundImage: `url("${asset.dataUrl}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: isSel ? '0 0 10px var(--accent-primary)' : 'none',
                      }}
                      title={asset.name}
                    >
                      {isSel && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            backgroundColor: 'var(--accent-primary)',
                            borderRadius: '50%',
                            width: 18,
                            height: 18,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={12} color="#fff" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preset Fantasy Avatars */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Or Choose Preset Portrait
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
                gap: '0.6rem',
              }}
            >
              {PRESET_TOKENS.map((preset) => {
                const isSel = selectedImage === preset.url;
                return (
                  <div
                    key={preset.name}
                    onClick={() => {
                      setSelectedImage(preset.url);
                      if (!tokenName || tokenName === 'Hero') setTokenName(preset.name);
                    }}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: 'var(--radius-md)',
                      border: isSel ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundImage: `url("${preset.url}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isSel ? '0 0 10px var(--accent-primary)' : 'none',
                    }}
                    title={preset.name}
                  >
                    {isSel && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          backgroundColor: 'var(--accent-primary)',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={12} color="#fff" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => {
              onCreateToken({
                name: tokenName.trim() || 'New Token',
                size,
              });
              onClose();
            }}
          >
            Create without Image
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              Place on Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
