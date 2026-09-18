import React, { useState, useRef, useEffect } from 'react';
import { Player, ChatMessage, DiceRollResult, DnDCharacter, DieType, DnDAction } from '@oldbear/shared';
import { MessageSquare, Send, X, Dices, Sword, Sparkles, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface ChatPanelProps {
  player: Player;
  character?: DnDCharacter | null;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  onBroadcastRoll?: (roll: DiceRollResult) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function parseDiceExpression(expr: string, advMode?: 'normal' | 'advantage' | 'disadvantage') {
  const match = expr.match(/^(\d*)d(\d+)(?:([+-])(\d+))?$/i);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const sign = match[3] === '-' ? -1 : 1;
  const modVal = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = sign * modVal;

  const rolls: number[] = [];
  let total = 0;
  let keptRoll: number | undefined;

  if (sides === 20 && count === 1 && advMode && advMode !== 'normal') {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    rolls.push(r1, r2);
    keptRoll = advMode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
    total = keptRoll + modifier;
  } else {
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      total += r;
    }
    total += modifier;
  }

  const validDice: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
  const diceType: DieType = validDice.includes(`d${sides}` as DieType) ? (`d${sides}` as DieType) : 'd20';

  return {
    count,
    sides,
    modifier,
    rolls,
    total,
    keptRoll,
    diceType,
  };
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  player,
  character,
  messages,
  onSendMessage,
  onBroadcastRoll,
  isOpen,
  onToggleOpen,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleCommand = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    // Check for slash commands
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // 1. /help
      if (cmd === 'help') {
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: 'system',
          senderName: 'VTT Guide',
          senderColor: '#6366f1',
          text: `Available commands:\n• /roll [count]d[sides][+/-mod] [adv|dis] - Roll any dice (e.g. /roll 1d20+5 adv)\n• /attack [weapon] [adv|dis] - Roll to-hit & damage from sheet (e.g. /attack Longsword)\n• /skill [skill] [adv|dis] - Roll a character skill check (e.g. /skill Stealth dis)\n• /spell [spell] [adv|dis] - Roll a spell attack from character sheet`,
          timestamp: Date.now(),
          isCommand: true,
        });
        return;
      }

      // 2. /roll [expr] [adv|dis]
      if (cmd === 'roll') {
        let expr = args[0] || '1d20';
        if (expr.toLowerCase() === 'init' || expr.toLowerCase() === 'initiative') {
          const bonus = character?.initiativeBonus ?? 0;
          expr = `1d20${bonus >= 0 ? `+${bonus}` : bonus}`;
        }
        const advArg = args[1]?.toLowerCase();
        const advMode = advArg === 'adv' || advArg === 'advantage' ? 'advantage' : advArg === 'dis' || advArg === 'disadvantage' ? 'disadvantage' : 'normal';

        const parsed = parseDiceExpression(expr, advMode);
        if (!parsed) {
          onSendMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            senderColor: '#f43f5e',
            text: `Invalid roll syntax: "${expr}". Use /roll 1d20+4 or /roll 2d6+2 adv`,
            timestamp: Date.now(),
            isCommand: true,
          });
          return;
        }

        const rollResult: DiceRollResult = {
          id: crypto.randomUUID(),
          userId: player.id,
          userName: player.name,
          userColor: player.color,
          diceType: parsed.diceType,
          count: parsed.count,
          modifier: parsed.modifier,
          rolls: parsed.rolls,
          total: parsed.total,
          advantageMode: advMode,
          keptRoll: parsed.keptRoll,
          timestamp: Date.now(),
        };

        onBroadcastRoll?.(rollResult);
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `rolled ${expr}${advMode !== 'normal' ? ` (${advMode})` : ''} = ${parsed.total} [${parsed.rolls.join(', ')}]`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return;
      }

      // 3. /attack [name] [adv|dis] or /spell [name] [adv|dis]
      if (cmd === 'attack' || cmd === 'spell') {
        if (!character) {
          onSendMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            senderColor: '#f43f5e',
            text: `Please link or select a D&D Beyond character sheet first to use /${cmd}`,
            timestamp: Date.now(),
            isCommand: true,
          });
          return;
        }

        const lastArg = args[args.length - 1]?.toLowerCase();
        let advMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
        let attackQuery = args.join(' ');

        if (lastArg === 'adv' || lastArg === 'advantage') {
          advMode = 'advantage';
          attackQuery = args.slice(0, -1).join(' ');
        } else if (lastArg === 'dis' || lastArg === 'disadvantage') {
          advMode = 'disadvantage';
          attackQuery = args.slice(0, -1).join(' ');
        }

        const strMod = Math.floor(((character.stats?.str ?? 10) - 10) / 2);
        const dexMod = Math.floor(((character.stats?.dex ?? 10) - 10) / 2);
        const intMod = Math.floor(((character.stats?.int ?? 10) - 10) / 2);
        const prof = character.proficiencyBonus ?? 2;

        const defaultActions: DnDAction[] = [
          { name: 'Melee Attack', type: 'melee', toHitModifier: strMod + prof, damageDice: `1d8+${strMod}` },
          { name: 'Ranged Attack', type: 'ranged', toHitModifier: dexMod + prof, damageDice: `1d6+${dexMod}` },
          ...(character.spells || []).map((s) => ({
            name: s.name,
            type: 'spell',
            toHitModifier: intMod + prof,
            damageDice: `${s.level > 0 ? s.level : 1}d10`,
          })),
        ];

        // Search character actions / spells / attacks
        const actions: DnDAction[] = character.actions && character.actions.length > 0 ? character.actions : defaultActions;
        const found = (attackQuery.trim()
          ? actions.find((a) => a.name.toLowerCase().includes(attackQuery.toLowerCase()))
          : actions[0]) || actions[0];

        if (!found) {
          onSendMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            senderColor: '#f43f5e',
            text: `Could not find attack or spell matching "${attackQuery}" on ${character.name}'s sheet.`,
            timestamp: Date.now(),
            isCommand: true,
          });
          return;
        }

        // Roll to hit (d20 + toHitModifier)
        const toHitMod = found.toHitModifier ?? 5;
        const hitRoll = parseDiceExpression('1d20', advMode)!;
        const hitTotal = (hitRoll.keptRoll ?? hitRoll.rolls[0]) + toHitMod;

        // Roll damage
        const dmgExpr = found.damageDice || '1d8+3';
        const dmgParsed = parseDiceExpression(dmgExpr) || { total: 5, rolls: [5] };

        const rollResult: DiceRollResult = {
          id: crypto.randomUUID(),
          userId: player.id,
          userName: player.name,
          userColor: player.color,
          diceType: 'd20',
          count: 1,
          modifier: toHitMod,
          rolls: hitRoll.rolls,
          total: hitTotal,
          advantageMode: advMode,
          keptRoll: hitRoll.keptRoll,
          timestamp: Date.now(),
        };

        onBroadcastRoll?.(rollResult);
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `attacks with ${found.name}! To Hit: ${hitTotal} (${hitRoll.rolls.join('/')}${toHitMod >= 0 ? `+${toHitMod}` : toHitMod}) | Damage: ${dmgParsed.total} [${dmgExpr}]`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return;
      }

      // 4. /skill [name] [adv|dis]
      if (cmd === 'skill') {
        if (!character) {
          onSendMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            senderColor: '#f43f5e',
            text: `Please link or select a D&D Beyond character sheet first to use /skill`,
            timestamp: Date.now(),
            isCommand: true,
          });
          return;
        }

        const lastArg = args[args.length - 1]?.toLowerCase();
        let advMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
        let skillQuery = args.join(' ');

        if (lastArg === 'adv' || lastArg === 'advantage') {
          advMode = 'advantage';
          skillQuery = args.slice(0, -1).join(' ');
        } else if (lastArg === 'dis' || lastArg === 'disadvantage') {
          advMode = 'disadvantage';
          skillQuery = args.slice(0, -1).join(' ');
        }

        const skill = character.skills?.find((s) => s.name.toLowerCase().includes(skillQuery.toLowerCase()));
        if (!skill) {
          onSendMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            senderColor: '#f43f5e',
            text: `Could not find skill matching "${skillQuery}" on ${character.name}'s sheet.`,
            timestamp: Date.now(),
            isCommand: true,
          });
          return;
        }

        const skillMod = skill.modifier ?? 0;
        const d20 = parseDiceExpression('1d20', advMode)!;
        const total = (d20.keptRoll ?? d20.rolls[0]) + skillMod;

        const rollResult: DiceRollResult = {
          id: crypto.randomUUID(),
          userId: player.id,
          userName: player.name,
          userColor: player.color,
          diceType: 'd20',
          count: 1,
          modifier: skillMod,
          rolls: d20.rolls,
          total,
          advantageMode: advMode,
          keptRoll: d20.keptRoll,
          timestamp: Date.now(),
        };

        onBroadcastRoll?.(rollResult);
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `checks ${skill.name}! Result: ${total} (${d20.rolls.join('/')}${skillMod >= 0 ? `+${skillMod}` : skillMod})`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return;
      }
    }

    // Regular Chat message
    onSendMessage({
      id: crypto.randomUUID(),
      senderId: player.id,
      senderName: player.name,
      senderColor: player.color,
      text,
      timestamp: Date.now(),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleCommand(inputText);
    setInputText('');
  };

  return (
    <>
      {/* Floating Chat Trigger Button in Bottom Left */}
      <div
        className="floating-hud"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 45,
        }}
      >
        <button
          className="btn glass-panel"
          onClick={onToggleOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
          }}
        >
          <MessageSquare size={17} color={isOpen ? 'var(--accent-primary)' : 'white'} />
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Chat & Commands</span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Expanded Chat & Commands Drawer */}
      {isOpen && (
        <div
          className="glass-panel-elevated animate-slide-up"
          style={{
            position: 'fixed',
            bottom: '4.25rem',
            left: '1.25rem',
            width: '360px',
            height: '420px',
            zIndex: 46,
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Table Chat & Dice</span>
            </div>
            <button className="btn-icon" onClick={onToggleOpen} style={{ width: '24px', height: '24px' }}>
              <X size={15} />
            </button>
          </div>

          {/* Quick Command Hints */}
          <div
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
            }}
          >
            <span
              style={{ cursor: 'pointer', color: 'var(--accent-indigo)' }}
              onClick={() => setInputText('/roll 1d20+5 adv')}
            >
              /roll 1d20+5 adv
            </span>
            <span>•</span>
            <span
              style={{ cursor: 'pointer', color: 'var(--accent-emerald)' }}
              onClick={() => setInputText('/attack ')}
            >
              /attack
            </span>
            <span>•</span>
            <span
              style={{ cursor: 'pointer', color: '#f59e0b' }}
              onClick={() => setInputText('/skill ')}
            >
              /skill
            </span>
            <span>•</span>
            <span
              style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => handleCommand('/help')}
            >
              /help
            </span>
          </div>

          {/* Message List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No messages yet. Type a message or try <code>/roll 1d20+4 adv</code>
              </div>
            ) : (
              messages.map((m) => {
                const isSelf = m.senderId === player.id;
                const isSys = m.senderId === 'system';

                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSys
                        ? 'rgba(99, 102, 241, 0.12)'
                        : isSelf
                        ? 'rgba(30, 41, 59, 0.8)'
                        : 'rgba(15, 23, 42, 0.8)',
                      borderLeft: `3px solid ${m.senderColor || '#6366f1'}`,
                      fontSize: '0.8rem',
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, color: m.senderColor || 'white', fontSize: '0.75rem' }}>
                        {m.senderName}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '0.5rem 0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <input
              type="text"
              placeholder="Chat or /roll, /attack, /skill..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{
                flex: 1,
                padding: '0.45rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                fontSize: '0.8rem',
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.75rem' }}
              disabled={!inputText.trim()}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
