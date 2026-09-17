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
  assignedToken?: Token | null;
  onUpdateTokenHp?: (tokenId: string, currentHp: number, maxHp: number, speed: number) => void;
  onUpdatePlayerChar?: (char: DnDCharacter) => void;
  onClose: () => void;
}

export const CharacterFlyout: React.FC<CharacterFlyoutProps> = ({
  player,
  assignedToken,
  onUpdateTokenHp,
  onUpdatePlayerChar,
  onClose,
}) => {
  const [charInput, setCharInput] = useState(player.dndBeyondCharacterId || '');
  const [character, setCharacter] = useState<DnDCharacter | null>(
    player.dndBeyondCharacter || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  // Manual fallback HP
  const [localHp, setLocalHp] = useState(assignedToken?.currentHp || 25);
  const [localMaxHp, setLocalMaxHp] = useState(assignedToken?.maxHp || 25);

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

      // Automatically sync HP & Speed with assigned token
      if (assignedToken && onUpdateTokenHp) {
        onUpdateTokenHp(assignedToken.id, data.currentHp, data.maxHp, data.speed);
      }
    } catch (err: any) {
      setError(err.message || 'Could not fetch character.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToToken = () => {
    if (!assignedToken || !onUpdateTokenHp) return;
    if (character) {
      onUpdateTokenHp(assignedToken.id, character.currentHp, character.maxHp, character.speed);
    } else {
      onUpdateTokenHp(assignedToken.id, localHp, localMaxHp, assignedToken.speed);
    }
  };

  const handleHpChange = (delta: number) => {
    if (character) {
      const newHp = Math.max(0, Math.min(character.maxHp, character.currentHp + delta));
      const updated = { ...character, currentHp: newHp };
      setCharacter(updated);
      onUpdatePlayerChar?.(updated);
      if (assignedToken && onUpdateTokenHp) {
        onUpdateTokenHp(assignedToken.id, newHp, character.maxHp, character.speed);
      }
    } else if (assignedToken && onUpdateTokenHp) {
      const newHp = Math.max(0, Math.min(localMaxHp, localHp + delta));
      setLocalHp(newHp);
      onUpdateTokenHp(assignedToken.id, newHp, localMaxHp, assignedToken.speed);
    }
  };

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

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
                }}
              />
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{character.name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {character.race} • {character.classes}
                </div>
              </div>
            </div>

            {/* Combat Vitals (AC, Speed, HP) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                  <Shield size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>ARMOR</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  {character.armorClass}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                  <Zap size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>SPEED</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  {character.speed} ft
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                  <User size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>PASSIVE</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
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

            {/* Ability Scores Grid */}
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
                      padding: '0.4rem 0.2rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {stat.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{score}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {getModifier(score)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                    if (assignedToken && onUpdateTokenHp) {
                      onUpdateTokenHp(assignedToken.id, localHp, val, assignedToken.speed);
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
      {assignedToken && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSyncToToken}>
            <RefreshCw size={14} /> Sync with Assigned Token ({assignedToken.name})
          </button>
        </div>
      )}
    </div>
  );
};
