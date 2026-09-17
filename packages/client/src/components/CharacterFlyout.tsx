import React, { useState } from 'react';
import { DnDCharacter, Token, Player } from '@oldbear/shared';
import {
  User,
  Heart,
  Shield,
  Zap,
  ExternalLink,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';

interface CharacterFlyoutProps {
  player: Player;
  targetToken?: Token | null;
  ownedTokens?: Token[];
  onSyncToken?: (tokenId: string, updates: Partial<Token>) => void;
  onCreateTokenForCharacter?: (char: DnDCharacter) => void;
  onUpdatePlayerChar?: (char: DnDCharacter) => void;
  onClose: () => void;
  isGm?: boolean;
}

interface SavedCharacterRecord {
  id: string;
  name: string;
  classes?: string;
  avatarUrl?: string;
  charData: DnDCharacter;
  savedAt: number;
}

const LOCAL_STORAGE_KEY = 'oldbear_saved_characters';
const GM_STORAGE_KEY = 'oldbear_gm_saved_characters';

export function getSavedCharacters(isGm: boolean): SavedCharacterRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: SavedCharacterRecord[] = raw ? JSON.parse(raw) : [];
    if (isGm) {
      const gmRaw = localStorage.getItem(GM_STORAGE_KEY);
      const gmList: SavedCharacterRecord[] = gmRaw ? JSON.parse(gmRaw) : [];
      const map = new Map<string, SavedCharacterRecord>();
      for (const item of [...list, ...gmList]) {
        map.set(item.id, item);
      }
      return Array.from(map.values());
    }
    return list;
  } catch {
    return [];
  }
}

export function saveCharacterToStorage(char: DnDCharacter, isGm: boolean) {
  try {
    const record: SavedCharacterRecord = {
      id: char.id,
      name: char.name,
      classes: char.classes,
      avatarUrl: char.avatarUrl,
      charData: char,
      savedAt: Date.now(),
    };
    // Save to player's storage
    const userRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const userList: SavedCharacterRecord[] = userRaw ? JSON.parse(userRaw) : [];
    const updatedUserList = [record, ...userList.filter((c) => c.id !== char.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedUserList.slice(0, 30)));

    // Save to GM storage
    const gmRaw = localStorage.getItem(GM_STORAGE_KEY);
    const gmList: SavedCharacterRecord[] = gmRaw ? JSON.parse(gmRaw) : [];
    const updatedGmList = [record, ...gmList.filter((c) => c.id !== char.id)];
    localStorage.setItem(GM_STORAGE_KEY, JSON.stringify(updatedGmList.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save character to localStorage:', e);
  }
}

export const CharacterFlyout: React.FC<CharacterFlyoutProps> = ({
  player,
  targetToken,
  ownedTokens = [],
  onSyncToken,
  onCreateTokenForCharacter,
  onUpdatePlayerChar,
  onClose,
  isGm = false,
}) => {
  const [charInput, setCharInput] = useState(player.dndBeyondCharacterId || '');
  const [character, setCharacter] = useState<DnDCharacter | null>(
    player.dndBeyondCharacter || null
  );
  const [syncTokenId, setSyncTokenId] = useState<string>(
    targetToken?.id || (ownedTokens.length > 0 ? ownedTokens[0].id : 'create_new')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [showOnlyTrainedSkills, setShowOnlyTrainedSkills] = useState(false);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterRecord[]>(() =>
    getSavedCharacters(isGm)
  );

  // Manual fallback HP
  const [localHp, setLocalHp] = useState(targetToken?.currentHp || 25);
  const [localMaxHp, setLocalMaxHp] = useState(targetToken?.maxHp || 25);

  const refreshSavedCharacters = () => {
    setSavedCharacters(getSavedCharacters(isGm));
  };

  const syncToToken = (char: DnDCharacter, tokenId?: string) => {
    const id = tokenId || targetToken?.id;
    if (!id || !onSyncToken) return;
    const updates: Partial<Token> = {
      name: char.name,
      currentHp: char.currentHp,
      maxHp: char.maxHp,
      speed: char.speed,
    };
    if (char.avatarUrl) {
      updates.imageUrl = char.avatarUrl;
    }
    onSyncToken(id, updates);
  };

  const applyCharacterToBoard = (char: DnDCharacter) => {
    if (syncTokenId === 'create_new' || (!syncTokenId && !targetToken)) {
      onCreateTokenForCharacter?.(char);
    } else {
      const tokenIdToSync = syncTokenId === 'create_new' ? undefined : (syncTokenId || targetToken?.id);
      if (tokenIdToSync) {
        syncToToken(char, tokenIdToSync);
      } else {
        onCreateTokenForCharacter?.(char);
      }
    }
  };

  const handleSelectSavedCharacter = (selectedId: string) => {
    if (!selectedId) return;
    const found = savedCharacters.find((c) => c.id === selectedId);
    if (!found) return;

    setCharacter(found.charData);
    onUpdatePlayerChar?.(found.charData);
    applyCharacterToBoard(found.charData);
    saveCharacterToStorage(found.charData, isGm);
    refreshSavedCharacters();
  };

  const fetchCharacter = async (charId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dndbeyond/${encodeURIComponent(charId)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}: Failed to load character`);
      }
      const data: DnDCharacter = await res.json();
      setCharacter(data);
      onUpdatePlayerChar?.(data);

      saveCharacterToStorage(data, isGm);
      refreshSavedCharacters();

      applyCharacterToBoard(data);
    } catch (err: any) {
      setError(err.message || 'Could not fetch character.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToToken = () => {
    if (!targetToken || !onSyncToken) return;
    if (character) {
      syncToToken(character);
    } else {
      onSyncToken(targetToken.id, {
        currentHp: localHp,
        maxHp: localMaxHp,
      });
    }
  };

  const handleHpChange = (delta: number) => {
    if (character) {
      const newHp = Math.max(0, Math.min(character.maxHp, character.currentHp + delta));
      const updated = { ...character, currentHp: newHp };
      setCharacter(updated);
      onUpdatePlayerChar?.(updated);
      saveCharacterToStorage(updated, isGm);
      if (targetToken && onSyncToken) {
        onSyncToken(targetToken.id, { currentHp: newHp });
      }
    } else if (targetToken && onSyncToken) {
      const newHp = Math.max(0, Math.min(localMaxHp, localHp + delta));
      setLocalHp(newHp);
      onSyncToken(targetToken.id, { currentHp: newHp, maxHp: localMaxHp });
    }
  };

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const proficiencyBonus =
    character?.proficiencyBonus ??
    (character ? Math.floor((character.level - 1) / 4) + 2 : 2);

  return (
    <div
      className="glass-panel-elevated animate-slide-right"
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '420px',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-strong)',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <User size={22} color="var(--accent-primary)" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem' }}>
            Character Sheet
          </h2>
        </div>
        <button className="btn-icon" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* D&D Beyond Link Input */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        {/* Saved Characters Dropdown */}
        {savedCharacters.length > 0 && (
          <div style={{ marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
              LOAD SAVED CHARACTER ({savedCharacters.length})
            </div>
            <select
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              value={character?.id || ''}
              onChange={(e) => handleSelectSavedCharacter(e.target.value)}
            >
              <option value="">-- Choose from saved characters --</option>
              {savedCharacters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.classes ? `(${c.classes})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          LINK D&D BEYOND CHARACTER
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Character ID or URL (or 'demo')"
            value={charInput}
            onChange={(e) => setCharInput(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.8rem',
            }}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '0.5rem 0.8rem' }}
            disabled={loading || !charInput.trim()}
            onClick={() => fetchCharacter(charInput.trim())}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <LinkIcon size={14} />}
            {loading ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {/* Board Token Assignment (Bug #41) */}
        <div style={{ marginTop: '0.6rem', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
            BOARD TOKEN ASSIGNMENT
          </div>
          <select
            style={{
              width: '100%',
              padding: '0.45rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
            value={syncTokenId}
            onChange={(e) => setSyncTokenId(e.target.value)}
          >
            <option value="create_new">➕ Create New Token (Place at bottom of map)</option>
            {targetToken && (
              <option value={targetToken.id}>🎯 Currently Selected: {targetToken.name}</option>
            )}
            {ownedTokens
              .filter((t) => t.id !== targetToken?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  👤 Owned Token: {t.name}
                </option>
              ))}
          </select>
        </div>

        {/* Quick Demo Button */}
        {!character && (
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              marginTop: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onClick={() => {
              setCharInput('demo');
              fetchCharacter('demo');
            }}
          >
            <Sparkles size={12} /> Click here to test with Demo Character
          </button>
        )}

        {error && (
          <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginTop: '0.4rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* Sheet Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* Saved Characters Cards (Bug #44) */}
        {!character && savedCharacters.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              SELECT FROM SAVED CHARACTERS ({savedCharacters.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {savedCharacters.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectSavedCharacter(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img
                      src={
                        c.avatarUrl ||
                        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={c.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-subtle)',
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {c.classes || 'Adventurer'}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSavedCharacter(c.id);
                    }}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {character ? (
          <div>
            {/* Profile Overview */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
              <img
                src={
                  character.avatarUrl ||
                  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&auto=format&fit=crop&q=80'
                }
                alt={character.name}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {character.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {character.race} • {character.classes}
                </div>
              </div>
            </div>

            {/* Combat Vitals (AC, Speed, Prof, Passive) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.4rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.5rem 0.25rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', color: '#38bdf8' }}>
                  <Shield size={12} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>ARMOR</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                  {character.armorClass}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.5rem 0.25rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', color: '#10b981' }}>
                  <Zap size={12} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>SPEED</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                  {character.speed} ft
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.5rem 0.25rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', color: '#a855f7' }}>
                  <Sparkles size={12} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>PROF</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                  +{proficiencyBonus}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.5rem 0.25rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', color: '#f59e0b' }}>
                  <User size={12} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>PASSIVE</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                  {character.passivePerception}
                </div>
              </div>
            </div>

            {/* Live Interactive HP Tracker */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Heart size={16} color="#ef4444" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>HIT POINTS</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {character.currentHp} / {character.maxHp}
                  {character.tempHp > 0 && <span style={{ color: '#38bdf8' }}> (+{character.tempHp})</span>}
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  marginBottom: '0.75rem',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (character.currentHp / character.maxHp) * 100)}%`,
                    backgroundColor: character.currentHp <= character.maxHp * 0.25 ? '#ef4444' : '#10b981',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Quick Health Adjustments */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.35rem' }} onClick={() => handleHpChange(-5)}>
                  -5
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.35rem' }} onClick={() => handleHpChange(-1)}>
                  -1
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.35rem' }} onClick={() => handleHpChange(1)}>
                  +1
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.35rem' }} onClick={() => handleHpChange(5)}>
                  +5
                </button>
              </div>
            </div>

            {/* Ability Scores Grid (Modifier Large, Score Small) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                ABILITY SCORES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.35rem' }}>
                {Object.entries(character.stats).map(([stat, score]) => (
                  <div
                    key={stat}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.2rem 0.35rem 0.2rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {stat.toUpperCase()}
                    </div>
                    {/* MODIFIER LARGE */}
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, marginTop: '2px' }}>
                      {getModifier(score)}
                    </div>
                    {/* SCORE SMALL */}
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        backgroundColor: 'rgba(255, 255, 255, 0.07)',
                        borderRadius: '999px',
                        padding: '1px 5px',
                        marginTop: '2px',
                      }}
                    >
                      {score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills & Proficiencies Section */}
            {character.skills && character.skills.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    SKILLS ({character.skills.filter((s) => s.proficiency !== 'none').length} Trained)
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                    onClick={() => setShowOnlyTrainedSkills((v) => !v)}
                  >
                    {showOnlyTrainedSkills ? 'Show All Skills' : 'Trained Only'}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    background: 'var(--bg-surface-elevated)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {(showOnlyTrainedSkills
                    ? character.skills.filter((s) => s.proficiency !== 'none')
                    : character.skills
                  ).map((skill) => (
                    <div
                      key={skill.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0.4rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor:
                          skill.proficiency === 'expertise'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : skill.proficiency === 'proficient'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor:
                              skill.proficiency === 'expertise'
                                ? '#f59e0b'
                                : skill.proficiency === 'proficient'
                                ? '#10b981'
                                : 'transparent',
                            border:
                              skill.proficiency === 'none'
                                ? '1.5px solid var(--text-muted)'
                                : 'none',
                          }}
                          title={skill.proficiency.toUpperCase()}
                        />
                        <span style={{ fontSize: '0.8rem', fontWeight: skill.proficiency !== 'none' ? 600 : 400 }}>
                          {skill.name}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          ({skill.stat})
                        </span>
                        {skill.proficiency === 'expertise' && (
                          <span
                            style={{
                              fontSize: '0.6rem',
                              color: '#f59e0b',
                              fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.2)',
                              padding: '1px 4px',
                              borderRadius: '4px',
                            }}
                          >
                            EXP
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: skill.proficiency !== 'none' ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {skill.modifier >= 0 ? `+${skill.modifier}` : skill.modifier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spells & Features Section */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                SPELLS & ACTIONS ({character.spells.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {character.spells.map((spell) => {
                  const isExpanded = expandedSpell === spell.id;
                  return (
                    <div
                      key={spell.id}
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.6rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedSpell(isExpanded ? null : spell.id)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{spell.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} • {spell.castingTime}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <a
                            href={spell.dndBeyondUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={(e) => e.stopPropagation()}
                            title="View on D&D Beyond"
                          >
                            <ExternalLink size={14} />
                          </a>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '4px' }}>
                            <div>Range: {spell.range}</div>
                            <div>Duration: {spell.duration}</div>
                          </div>
                          <div style={{ lineHeight: 1.4 }}>{spell.description}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Manual Player HP Editor (No sheet linked) */
          <div>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem 0' }}>
              No D&D Beyond character linked.
              <br />
              You can still track and edit your token HP below:
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Current HP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="btn-icon" onClick={() => handleHpChange(-1)}>
                    -
                  </button>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', minWidth: '32px', textAlign: 'center' }}>
                    {localHp}
                  </span>
                  <button className="btn-icon" onClick={() => handleHpChange(1)}>
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Max HP</span>
                <input
                  type="number"
                  value={localMaxHp}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLocalMaxHp(val);
                    if (targetToken && onSyncToken) {
                      onSyncToken(targetToken.id, { currentHp: localHp, maxHp: val });
                    }
                  }}
                  style={{
                    width: '60px',
                    padding: '0.3rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'white',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {targetToken ? (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSyncToToken}>
            <RefreshCw size={14} /> Sync with Token ({targetToken.name})
          </button>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.35rem' }}>
            Sets token name, avatar, HP, and speed.
          </div>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Select a token on the map to sync this character to it.
        </div>
      )}
    </div>
  );
};
