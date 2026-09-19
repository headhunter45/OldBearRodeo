import React, { useState, useEffect } from 'react';
import { X, Upload, User, Sparkles, Check, Package, Skull, Shield, Search } from 'lucide-react';
import { StoredAsset, getAllAssets, saveAsset } from '../storage/db.js';
import { getSavedCharacters, SavedCharacterRecord } from './CharacterFlyout.js';

export interface TokenSpawnData {
  name: string;
  imageUrl?: string;
  size: number;
  isProp?: boolean;
  layer?: 'token' | 'prop';
  character?: any;
  monsterData?: any;
  currentHp?: number;
  maxHp?: number;
  speed?: number;
  armorClass?: number;
  ringColor?: string;
  fillColor?: string;
  clipCircle?: boolean;
  clipShape?: 'circle' | 'square' | 'rounded' | 'hexagon' | 'octagon';
  propWidth?: number;
  propHeight?: number;
}

interface TokenPickerModalProps {
  onClose: () => void;
  onCreateToken: (tokenData: TokenSpawnData) => void;
  isGm?: boolean;
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

type CategoryTab = 'tokens' | 'props' | 'monsters' | 'characters';

export const TokenPickerModal: React.FC<TokenPickerModalProps> = ({ onClose, onCreateToken, isGm = true }) => {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('tokens');
  const [tokenName, setTokenName] = useState('Hero');
  const [size, setSize] = useState(1);
  const [isProp, setIsProp] = useState(false);
  const [currentHp, setCurrentHp] = useState<number | undefined>(20);
  const [maxHp, setMaxHp] = useState<number | undefined>(20);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Attached metadata from selected card
  const [selectedCharacter, setSelectedCharacter] = useState<any>(undefined);
  const [selectedMonster, setSelectedMonster] = useState<any>(undefined);
  const [propWidth, setPropWidth] = useState<number | undefined>(undefined);
  const [propHeight, setPropHeight] = useState<number | undefined>(undefined);

  const [allAssets, setAllAssets] = useState<StoredAsset[]>([]);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const assets = await getAllAssets();
        setAllAssets(assets);
        setSavedCharacters(getSavedCharacters(isGm));
      } catch (err) {
        console.warn('Failed to load assets for token picker:', err);
      }
    })();
  }, [isGm]);

  // Derived asset lists
  const tokenAssets = allAssets.filter(
    (a) => a.type === 'token' && !a.monsterData && (!a.character || !a.character.actions)
  );
  const propAssets = allAssets.filter((a) => a.type === 'prop' || a.isProp);
  const monsterAssets = allAssets.filter(
    (a) => Boolean(a.monsterData || (a.type as string) === 'monster' || (a.character && a.character.actions))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSelectedImage(dataUrl);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      if (!tokenName || tokenName === 'Hero') {
        setTokenName(cleanName);
      }
      const shouldBeProp = activeCategory === 'props';
      setIsProp(shouldBeProp);

      // Persist to indexedDB asset library
      await saveAsset({
        id: crypto.randomUUID(),
        name: cleanName,
        type: shouldBeProp ? 'prop' : 'token',
        dataUrl,
        isProp: shouldBeProp,
        layer: shouldBeProp ? 'prop' : 'token',
        createdAt: Date.now(),
      });
      const updated = await getAllAssets();
      setAllAssets(updated);
    };
    reader.readAsDataURL(file);
  };

  const selectPreset = (preset: { name: string; url: string }) => {
    setSelectedImage(preset.url);
    setTokenName(preset.name);
    setIsProp(false);
    setSelectedCharacter(undefined);
    setSelectedMonster(undefined);
  };

  const selectAsset = (asset: StoredAsset) => {
    setSelectedImage(asset.dataUrl);
    setTokenName(asset.name);
    const assetIsProp = asset.type === 'prop' || Boolean(asset.isProp);
    setIsProp(assetIsProp);
    if (asset.size) setSize(asset.size);
    if (asset.maxHp !== undefined) {
      setMaxHp(asset.maxHp);
      setCurrentHp(asset.maxHp);
    } else if (assetIsProp) {
      setMaxHp(0);
      setCurrentHp(0);
    }
    if (asset.propWidth) setPropWidth(asset.propWidth);
    if (asset.propHeight) setPropHeight(asset.propHeight);
    setSelectedMonster(asset.monsterData);
    setSelectedCharacter(asset.character);
  };

  const selectCharacter = (charRecord: SavedCharacterRecord) => {
    const char = charRecord.charData;
    setSelectedImage(char.avatarUrl || charRecord.avatarUrl || '');
    setTokenName(char.name || charRecord.name || 'Hero');
    setIsProp(false);
    setSize(1);
    const hp = char.currentHp ?? char.maxHp ?? 20;
    setCurrentHp(hp);
    setMaxHp(char.maxHp ?? 20);
    setSelectedCharacter(char);
    setSelectedMonster(undefined);
  };

  const handleConfirm = () => {
    onCreateToken({
      name: tokenName.trim() || 'New Token',
      imageUrl: selectedImage || undefined,
      size,
      isProp,
      layer: isProp ? 'prop' : 'token',
      currentHp,
      maxHp,
      character: selectedCharacter,
      monsterData: selectedMonster,
      propWidth,
      propHeight,
    });
    onClose();
  };

  const q = searchQuery.toLowerCase().trim();

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
          maxWidth: '640px',
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
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <User size={22} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>
                Add Token or Prop
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Add tokens, props, monsters, or characters to the active map
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Categories Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '0 0.5rem',
            overflowX: 'auto',
          }}
        >
          <button
            className={`tab-btn ${activeCategory === 'tokens' ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory('tokens');
              setIsProp(false);
            }}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'none',
              background: 'none',
              color: activeCategory === 'tokens' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeCategory === 'tokens' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.85rem',
            }}
          >
            <User size={15} /> Tokens ({tokenAssets.length + PRESET_TOKENS.length})
          </button>

          <button
            className={`tab-btn ${activeCategory === 'props' ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory('props');
              setIsProp(true);
            }}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'none',
              background: 'none',
              color: activeCategory === 'props' ? '#eab308' : 'var(--text-secondary)',
              borderBottom: activeCategory === 'props' ? '2px solid #eab308' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.85rem',
            }}
          >
            <Package size={15} /> Props ({propAssets.length})
          </button>

          {(isGm || monsterAssets.length > 0) && (
            <button
              className={`tab-btn ${activeCategory === 'monsters' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('monsters');
                setIsProp(false);
              }}
              style={{
                padding: '0.65rem 0.9rem',
                border: 'none',
                background: 'none',
                color: activeCategory === 'monsters' ? 'var(--accent-rose)' : 'var(--text-secondary)',
                borderBottom: activeCategory === 'monsters' ? '2px solid var(--accent-rose)' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.85rem',
              }}
            >
              <Skull size={15} /> Monsters ({monsterAssets.length})
            </button>
          )}

          <button
            className={`tab-btn ${activeCategory === 'characters' ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory('characters');
              setIsProp(false);
            }}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'none',
              background: 'none',
              color: activeCategory === 'characters' ? '#818cf8' : 'var(--text-secondary)',
              borderBottom: activeCategory === 'characters' ? '2px solid #818cf8' : '2px solid transparent',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.85rem',
            }}
          >
            <Shield size={15} /> Characters ({savedCharacters.length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          {/* Selected Preview & Custom Details */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              background: 'var(--bg-surface-elevated)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: isProp ? 'var(--radius-sm)' : '50%',
                backgroundColor: 'var(--bg-surface)',
                border: '2px solid var(--accent-primary)',
                backgroundImage: selectedImage ? `url("${selectedImage}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {!selectedImage && (isProp ? <Package size={22} color="var(--text-muted)" /> : <User size={22} color="var(--text-muted)" />)}
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. Hero, Barrel, Ankheg"
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    fontSize: '0.85rem',
                    marginTop: '2px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size (Tiles)</label>
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    fontSize: '0.85rem',
                    marginTop: '2px',
                  }}
                >
                  <option value={1}>1×1 (Medium)</option>
                  <option value={2}>2×2 (Large)</option>
                  <option value={3}>3×3 (Huge)</option>
                  <option value={4}>4×4 (Gargantuan)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search & Upload Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={`Search ${activeCategory}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem 0.4rem 2rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                }}
              />
            </div>

            <label
              className="btn btn-secondary"
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
              }}
            >
              <Upload size={14} /> Upload Custom Image...
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>

          {/* Grid Selection by Tab */}
          {activeCategory === 'tokens' && (
            <div>
              {/* Uploaded Token Library */}
              {tokenAssets.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Your Saved Tokens
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.6rem' }}>
                    {tokenAssets
                      .filter((a) => !q || a.name.toLowerCase().includes(q))
                      .map((asset) => {
                        const isSel = selectedImage === asset.dataUrl;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => selectAsset(asset)}
                            onDoubleClick={handleConfirm}
                            style={{
                              width: '70px',
                              height: '70px',
                              borderRadius: '50%',
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
                              <div style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'var(--accent-primary)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={12} color="#fff" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Preset Tokens */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Preset Portraits
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.6rem' }}>
                  {PRESET_TOKENS
                    .filter((p) => !q || p.name.toLowerCase().includes(q))
                    .map((preset) => {
                      const isSel = selectedImage === preset.url;
                      return (
                        <div
                          key={preset.name}
                          onClick={() => selectPreset(preset)}
                          onDoubleClick={handleConfirm}
                          style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
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
                            <div style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'var(--accent-primary)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={12} color="#fff" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'props' && (
            <div>
              {propAssets.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No props uploaded yet. Click Upload Custom Image above or drag props into the Asset Manager!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.6rem' }}>
                  {propAssets
                    .filter((a) => !q || a.name.toLowerCase().includes(q))
                    .map((asset) => {
                      const isSel = selectedImage === asset.dataUrl;
                      return (
                        <div
                          key={asset.id}
                          onClick={() => selectAsset(asset)}
                          onDoubleClick={handleConfirm}
                          style={{
                            width: '75px',
                            height: '75px',
                            borderRadius: 'var(--radius-sm)',
                            border: isSel ? '2px solid #eab308' : '1px solid var(--border-subtle)',
                            backgroundImage: `url("${asset.dataUrl}")`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            cursor: 'pointer',
                            position: 'relative',
                            boxShadow: isSel ? '0 0 10px #eab308' : 'none',
                          }}
                          title={asset.name}
                        >
                          {isSel && (
                            <div style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#eab308', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={12} color="#000" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {activeCategory === 'monsters' && (
            <div>
              {monsterAssets.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No monsters uploaded yet. Drag a TetraCube .monster file into the board or Asset Manager!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem' }}>
                  {monsterAssets
                    .filter((a) => !q || a.name.toLowerCase().includes(q))
                    .map((asset) => {
                      const isSel = selectedImage === asset.dataUrl;
                      return (
                        <div
                          key={asset.id}
                          onClick={() => selectAsset(asset)}
                          onDoubleClick={handleConfirm}
                          style={{
                            borderRadius: 'var(--radius-md)',
                            border: isSel ? '2px solid var(--accent-rose)' : '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              backgroundImage: `url("${asset.dataUrl}")`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundColor: '#3f1d24',
                            }}
                          />
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {asset.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            HP {asset.maxHp || 20} • AC {asset.armorClass || 12}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {activeCategory === 'characters' && (
            <div>
              {savedCharacters.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No characters saved yet. Create or import a character sheet in the Characters menu!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem' }}>
                  {savedCharacters
                    .filter((c) => !q || (c.name || '').toLowerCase().includes(q))
                    .map((charRecord) => {
                      const char = charRecord.charData;
                      const avatar = char.avatarUrl || charRecord.avatarUrl;
                      const isSel = selectedImage === avatar;
                      return (
                        <div
                          key={charRecord.id}
                          onClick={() => selectCharacter(charRecord)}
                          onDoubleClick={handleConfirm}
                          style={{
                            borderRadius: 'var(--radius-md)',
                            border: isSel ? '2px solid #818cf8' : '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              backgroundImage: avatar ? `url("${avatar}")` : 'none',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundColor: '#1e1b4b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {!avatar && <User size={20} color="#818cf8" />}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {char.name || charRecord.name || 'Hero'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            HP {char.currentHp ?? char.maxHp ?? 20} • {char.classes?.[0] || 'Hero'}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.9rem 1.25rem',
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
                isProp,
                layer: isProp ? 'prop' : 'token',
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
