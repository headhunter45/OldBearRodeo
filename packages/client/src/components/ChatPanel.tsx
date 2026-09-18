import React, { useState, useRef, useEffect } from 'react';
import { Player, ChatMessage, DiceRollResult, DnDCharacter, DieType, DnDAction, DnDSpell, Token, getActivationCategory } from '@oldbear/shared';
import { MessageSquare, Send, X, Dices, Sword, Sparkles, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useDraggableWindow } from '../hooks/useDraggableWindow.js';

export interface ChatPanelProps {
  player: Player;
  character?: DnDCharacter | null;
  tokens?: Token[];
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  onBroadcastRoll?: (roll: DiceRollResult) => void;
  onSyncToken?: (tokenId: string, updates: Partial<Token>) => void;
  onUpdatePlayerChar?: (char: DnDCharacter) => void;
  fetchCharacterFn?: (charIdOrUrl: string) => Promise<DnDCharacter>;
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

export interface ProcessSlashCommandContext {
  player: Player;
  character?: DnDCharacter;
  tokens?: Token[];
  onSendMessage: (msg: ChatMessage) => void;
  onBroadcastRoll?: (roll: DiceRollResult) => void;
  onSyncToken?: (tokenId: string, updates: Partial<Token>) => void;
  onUpdatePlayerChar?: (char: DnDCharacter) => void;
  fetchCharacterFn?: (charIdOrUrl: string) => Promise<DnDCharacter>;
}

export function processSlashCommand(
  raw: string,
  context: ProcessSlashCommandContext
): boolean {
  const text = raw.trim();
  if (!text || !text.startsWith('/')) return false;

  const parts = text.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const { player, character, onSendMessage, onBroadcastRoll } = context;

  // Helper to send client-only ephemeral messages for caller
  const sendPrivateSystemMessage = (msgText: string, title = 'VTT Guide', color = '#6366f1') => {
    onSendMessage({
      id: crypto.randomUUID(),
      senderId: 'system',
      senderName: title,
      senderColor: color,
      text: msgText,
      timestamp: Date.now(),
      isCommand: true,
      isEphemeral: true,
      recipientId: player.id,
    });
  };

  // 1. /help
  if (cmd === 'help') {
    sendPrivateSystemMessage(
      `Available commands:\n• /roll [count]d[sides][+/-mod] [adv|dis] - Roll any dice (e.g. /roll 1d20+5 adv)\n• /attack [weapon or index] [adv|dis] - Roll to-hit & damage from sheet (e.g. /attack 1 or /attack Longsword)\n• /skill [skill or index] [adv|dis] - Roll a character skill check (e.g. /skill 1 or /skill Stealth dis)\n• /spell [spell or index] [adv|dis] - Roll a spell attack from character sheet (e.g. /spell 1)\n• /item [item or index] - Use/inspect item from inventory (e.g. /item 1)\n• /sync [url or id] [token index] - Sync character sheet and token with D&D Beyond\n• /tokens - List all tokens and their index number available to sync`
    );
    return true;
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
          sendPrivateSystemMessage(
            `Invalid roll syntax: "${expr}". Use /roll 1d20+4 or /roll 2d6+2 adv`,
            'System',
            '#f43f5e'
          );
          return true;
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
        return true;
      }

      // 3. /attack [name] [adv|dis]
      if (cmd === 'attack') {
        const lastArg = args[args.length - 1]?.toLowerCase();
        let advMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
        let attackQuery = args.join(' ').trim();

        if (lastArg === 'adv' || lastArg === 'advantage') {
          advMode = 'advantage';
          attackQuery = args.slice(0, -1).join(' ').trim();
        } else if (lastArg === 'dis' || lastArg === 'disadvantage') {
          advMode = 'disadvantage';
          attackQuery = args.slice(0, -1).join(' ').trim();
        }

        const availableAttacks: DnDAction[] = (character?.actions && character.actions.length > 0)
          ? character.actions
          : [
              { name: 'Melee Attack', type: 'melee', toHitModifier: 5, damageDice: '1d8+3' },
              { name: 'Ranged Attack', type: 'ranged', toHitModifier: 5, damageDice: '1d6+3' },
              { name: 'Unarmed Strike', type: 'melee', toHitModifier: 5, damageDice: '4' },
            ];

        // Bug #54 & #71: No name provided -> list options, do not roll
        if (!attackQuery) {
          const listText = availableAttacks
            .map((a, idx) => {
              const cat = getActivationCategory(a);
              const badge = cat === 'bonus' ? ' [Bonus Action]' : cat === 'reaction' ? ' [Reaction]' : '';
              return `${idx + 1}. ${a.name}${badge}${a.reach ? ` (${a.reach})` : a.range ? ` (${a.range})` : ''} [${a.toHitModifier !== undefined ? (a.toHitModifier >= 0 ? `+${a.toHitModifier}` : a.toHitModifier) + ' to hit' : ''}${a.damage ? `, ${a.damage}` : a.damageDice ? `, ${a.damageDice}` : ''}]`;
            })
            .join('\n');
          sendPrivateSystemMessage(
            `No attack specified. Available attacks${character ? ` for ${character.name}` : ''}:\n${listText}\n\nUsage: /attack [name or index] [adv|dis]`
          );
          return true;
        }

        // Search matching attack by 1-based index or name
        let found: DnDAction | undefined;
        const numIdx = parseInt(attackQuery, 10);
        if (!isNaN(numIdx) && String(numIdx) === attackQuery && numIdx >= 1 && numIdx <= availableAttacks.length) {
          found = availableAttacks[numIdx - 1];
        } else {
          found = availableAttacks.find((a) =>
            a.name.toLowerCase().includes(attackQuery.toLowerCase())
          );
        }

        if (!found) {
          const listText = availableAttacks
            .map((a, idx) => {
              const cat = getActivationCategory(a);
              const badge = cat === 'bonus' ? ' [Bonus Action]' : cat === 'reaction' ? ' [Reaction]' : '';
              return `${idx + 1}. ${a.name}${badge}`;
            })
            .join('\n');
          sendPrivateSystemMessage(
            `Could not find attack matching "${attackQuery}". Available options:\n${listText}`,
            'System',
            '#f43f5e'
          );
          return true;
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

        const attackCat = getActivationCategory(found);
        const attackTag = attackCat === 'bonus' ? ' (Bonus Action)' : attackCat === 'reaction' ? ' (Reaction)' : '';

        onBroadcastRoll?.(rollResult);
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `attacks with ${found.name}${attackTag}! To Hit: ${hitTotal} (${hitRoll.rolls.join('/')}${toHitMod >= 0 ? `+${toHitMod}` : toHitMod}) | Damage: ${dmgParsed.total} [${dmgExpr}]`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return true;
      }

      // 4. /spell [name] [adv|dis]
      if (cmd === 'spell') {
        const lastArg = args[args.length - 1]?.toLowerCase();
        let advMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
        let spellQuery = args.join(' ').trim();

        if (lastArg === 'adv' || lastArg === 'advantage') {
          advMode = 'advantage';
          spellQuery = args.slice(0, -1).join(' ').trim();
        } else if (lastArg === 'dis' || lastArg === 'disadvantage') {
          advMode = 'disadvantage';
          spellQuery = args.slice(0, -1).join(' ').trim();
        }

        const availableSpells = character?.spells || [];

        // Bug #54 & #71: No spell name provided -> list options, do not roll
        if (!spellQuery) {
          if (availableSpells.length === 0) {
            sendPrivateSystemMessage(
              character
                ? `No spells found on ${character.name}'s sheet.`
                : 'Please link a character sheet with spells first.',
              'System',
              '#f43f5e'
            );
            return true;
          }
          const listText = availableSpells
            .map((s, idx) => {
              const cat = getActivationCategory(s);
              const badge = cat === 'bonus' ? ' [Bonus Action]' : cat === 'reaction' ? ' [Reaction]' : '';
              return `${idx + 1}. ${s.name}${badge} (${s.level === 0 ? 'Cantrip' : `Level ${s.level}`}${s.school ? `, ${s.school}` : ''}${s.castingTime ? ` • ${s.castingTime}` : ''})`;
            })
            .join('\n');
          sendPrivateSystemMessage(
            `No spell specified. Available spells for ${character?.name || 'character'}:\n${listText}\n\nUsage: /spell [name or index] [adv|dis]`
          );
          return true;
        }

        // Search matching spell by 1-based index or name
        let found: DnDSpell | undefined;
        const numIdx = parseInt(spellQuery, 10);
        if (!isNaN(numIdx) && String(numIdx) === spellQuery && numIdx >= 1 && numIdx <= availableSpells.length) {
          found = availableSpells[numIdx - 1];
        } else {
          found = availableSpells.find((s) =>
            s.name.toLowerCase().includes(spellQuery.toLowerCase())
          );
        }

        if (!found) {
          const listText = availableSpells.length > 0
            ? availableSpells
                .map((s, idx) => {
                  const cat = getActivationCategory(s);
                  const badge = cat === 'bonus' ? ' [Bonus Action]' : cat === 'reaction' ? ' [Reaction]' : '';
                  return `${idx + 1}. ${s.name}${badge}`;
                })
                .join('\n')
            : '(No spells available)';
          sendPrivateSystemMessage(
            `Could not find spell matching "${spellQuery}". Available options:\n${listText}`,
            'System',
            '#f43f5e'
          );
          return true;
        }

        const intMod = Math.floor(((character?.stats?.int ?? 10) - 10) / 2);
        const prof = character?.proficiencyBonus ?? 2;
        const spellToHitMod = intMod + prof;

        const hitRoll = parseDiceExpression('1d20', advMode)!;
        const hitTotal = (hitRoll.keptRoll ?? hitRoll.rolls[0]) + spellToHitMod;
        const dmgExpr = `${found.level > 0 ? found.level : 1}d10`;
        const dmgParsed = parseDiceExpression(dmgExpr) || { total: 5, rolls: [5] };

        const rollResult: DiceRollResult = {
          id: crypto.randomUUID(),
          userId: player.id,
          userName: player.name,
          userColor: player.color,
          diceType: 'd20',
          count: 1,
          modifier: spellToHitMod,
          rolls: hitRoll.rolls,
          total: hitTotal,
          advantageMode: advMode,
          keptRoll: hitRoll.keptRoll,
          timestamp: Date.now(),
        };

        const spellCat = getActivationCategory(found);
        const spellTag = spellCat === 'bonus' ? ' (Bonus Action)' : spellCat === 'reaction' ? ' (Reaction)' : '';

        onBroadcastRoll?.(rollResult);
        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `casts ${found.name}${spellTag}! Attack: ${hitTotal} (${hitRoll.rolls.join('/')}${spellToHitMod >= 0 ? `+${spellToHitMod}` : spellToHitMod}) | Effect/Damage: ${dmgParsed.total} [${dmgExpr}]`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return true;
      }

      // 5. /skill [name] [adv|dis]
      if (cmd === 'skill') {
        const lastArg = args[args.length - 1]?.toLowerCase();
        let advMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
        let skillQuery = args.join(' ').trim();

        if (lastArg === 'adv' || lastArg === 'advantage') {
          advMode = 'advantage';
          skillQuery = args.slice(0, -1).join(' ').trim();
        } else if (lastArg === 'dis' || lastArg === 'disadvantage') {
          advMode = 'disadvantage';
          skillQuery = args.slice(0, -1).join(' ').trim();
        }

        const ALL_SKILLS = [
          'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
          'Deception', 'History', 'Insight', 'Intimidation',
          'Investigation', 'Medicine', 'Nature', 'Perception',
          'Performance', 'Persuasion', 'Religion', 'Sleight of Hand',
          'Stealth', 'Survival'
        ];

        const skillsList = character?.skills && character.skills.length > 0
          ? character.skills
          : ALL_SKILLS.map((s) => ({ name: s, modifier: 0, proficiency: 'none' as const }));

        // Bug #54 & #91: No skill specified -> list options with 1-based index, do not roll
        if (!skillQuery) {
          const listText = skillsList
            .map((s, idx) => `${idx + 1}. ${s.name} (${s.modifier >= 0 ? `+${s.modifier}` : s.modifier}${s.proficiency !== 'none' ? ' • Proficient' : ''})`)
            .join('\n');
          sendPrivateSystemMessage(
            `No skill specified. Available skills${character ? ` for ${character.name}` : ''}:\n${listText}\n\nUsage: /skill [skill or index] [adv|dis]`
          );
          return true;
        }

        // Search matching skill by 1-based index or name
        let foundSkill: { name: string; modifier: number; proficiency: string } | undefined;
        const numIdx = parseInt(skillQuery, 10);
        if (!isNaN(numIdx) && String(numIdx) === skillQuery && numIdx >= 1 && numIdx <= skillsList.length) {
          foundSkill = skillsList[numIdx - 1];
        } else {
          foundSkill = skillsList.find((s) =>
            s.name.toLowerCase().includes(skillQuery.toLowerCase())
          );
        }

        if (!foundSkill) {
          const listText = skillsList.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
          sendPrivateSystemMessage(
            `Could not find skill matching "${skillQuery}". Available skills:\n${listText}`,
            'System',
            '#f43f5e'
          );
          return true;
        }

        const skillName = foundSkill.name;
        const skillMod = foundSkill.modifier;
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
          text: `checks ${skillName}! Result: ${total} (${d20.rolls.join('/')}${skillMod >= 0 ? `+${skillMod}` : skillMod})${advMode !== 'normal' ? ` (${advMode})` : ''}`,
          timestamp: Date.now(),
          roll: rollResult,
        });
        return true;
      }

      // 5.5 /item [name or index]
      if (cmd === 'item') {
        const itemQuery = args.join(' ').trim();
        const availableItems: Array<{ id?: string; name: string; description?: string; quantity?: number }> =
          (character?.items && character.items.length > 0)
            ? character.items
            : [
                { name: 'Potion of Healing', description: 'Regains 2d4 + 2 hit points when consumed.', quantity: 2 },
                { name: 'Rope (hempen, 50 feet)', description: '50 feet of hempen rope, burst DC 17.', quantity: 1 },
                { name: 'Torch', description: 'Burns for 1 hour, shedding bright light in 20ft radius.', quantity: 5 },
                { name: 'Rations (1 day)', description: 'Consists of dry foods suitable for travel.', quantity: 10 },
              ];

        // Bare command -> list options with 1-based index
        if (!itemQuery) {
          const listText = availableItems
            .map((it, idx) => `${idx + 1}. ${it.name}${it.quantity ? ` (x${it.quantity})` : ''}${it.description ? ` - ${it.description}` : ''}`)
            .join('\n');
          sendPrivateSystemMessage(
            `No item specified. Available items${character ? ` for ${character.name}` : ''}:\n${listText}\n\nUsage: /item [name or index]`
          );
          return true;
        }

        // Search matching item by 1-based index or name
        let found: typeof availableItems[0] | undefined;
        const numIdx = parseInt(itemQuery, 10);
        if (!isNaN(numIdx) && String(numIdx) === itemQuery && numIdx >= 1 && numIdx <= availableItems.length) {
          found = availableItems[numIdx - 1];
        } else {
          found = availableItems.find((it) => it.name.toLowerCase().includes(itemQuery.toLowerCase()));
        }

        if (!found) {
          const listText = availableItems.map((it, idx) => `${idx + 1}. ${it.name}`).join('\n');
          sendPrivateSystemMessage(
            `Could not find item matching "${itemQuery}". Available options:\n${listText}`,
            'System',
            '#f43f5e'
          );
          return true;
        }

        onSendMessage({
          id: crypto.randomUUID(),
          senderId: player.id,
          senderName: player.name,
          senderColor: player.color,
          text: `uses/inspects item: ${found.name}${found.quantity ? ` (x${found.quantity})` : ''}${found.description ? `\n"${found.description}"` : ''}`,
          timestamp: Date.now(),
        });
        return true;
      }

      // 6. /sync [urlOrId] [tokenIndex]
      if (cmd === 'sync') {
        let urlOrId = args[0];
        let tokenIndexArg = args[1];

        const knownCharId =
          context.player?.dndBeyondCharacterId ||
          context.player?.dndBeyondCharacter?.id ||
          (context.tokens && context.tokens[0]?.character?.id);

        if (!urlOrId && knownCharId) {
          urlOrId = /^\d+$/.test(knownCharId) ? `https://www.dndbeyond.com/characters/${knownCharId}` : knownCharId;
        }

        if (!urlOrId) {
          sendPrivateSystemMessage(
            `Usage: /sync <dndbeyond url or id> [token index]\nExample: /sync 47804290 or /sync https://www.dndbeyond.com/characters/47804290 1\nUse /tokens to view your available tokens.`,
            'D&D Beyond Sync'
          );
          return true;
        }

        const syncTokens = context.tokens || [];

        let targetToken: Token | undefined;
        let tokenIndexNum: number | undefined;

        if (syncTokens.length === 1) {
          targetToken = syncTokens[0];
          tokenIndexNum = 1;
        } else if (syncTokens.length > 1) {
          if (!tokenIndexArg) {
            sendPrivateSystemMessage(
              `You have ${syncTokens.length} tokens. Please specify the token index to sync:\n/sync ${urlOrId} <token index>\n\nUse /tokens to view your token list.`,
              'D&D Beyond Sync',
              '#f59e0b'
            );
            return true;
          }

          const parsedIdx = parseInt(tokenIndexArg, 10);
          if (isNaN(parsedIdx) || parsedIdx < 1 || parsedIdx > syncTokens.length) {
            sendPrivateSystemMessage(
              `Invalid token index "${tokenIndexArg}". Please choose an index between 1 and ${syncTokens.length}.\nUse /tokens to view your token list.`,
              'D&D Beyond Sync',
              '#f43f5e'
            );
            return true;
          }
          targetToken = syncTokens[parsedIdx - 1];
          tokenIndexNum = parsedIdx;
        }

        sendPrivateSystemMessage(
          `Fetching character data from D&D Beyond...`,
          'D&D Beyond Sync',
          '#3b82f6'
        );

        const fetchFn = context.fetchCharacterFn || (async (query: string) => {
          const idMatch = query.match(/characters\/(\d+)/) || query.match(/^(\d+)$/);
          const charId = idMatch ? idMatch[1] : query.trim();
          const res = await fetch(`/api/dndbeyond/${encodeURIComponent(charId)}`);
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP error ${res.status}`);
          }
          return res.json();
        });

        fetchFn(urlOrId)
          .then((char) => {
            context.onUpdatePlayerChar?.(char);

            if (targetToken) {
              const updates: Partial<Token> = {
                name: char.name,
                currentHp: char.currentHp,
                maxHp: char.maxHp,
                speed: char.speed,
                initiativeBonus: char.initiativeBonus,
                character: char,
              };
              if (char.avatarUrl) {
                updates.imageUrl = char.avatarUrl;
              }
              context.onSyncToken?.(targetToken.id, updates);

              sendPrivateSystemMessage(
                `Successfully synced "${char.name}" to token #${tokenIndexNum} (${targetToken.name}) and your player sheet!`,
                'D&D Beyond Sync',
                '#10b981'
              );
            } else {
              sendPrivateSystemMessage(
                `Successfully synced "${char.name}" to your character sheet! (No tokens on map to sync)`,
                'D&D Beyond Sync',
                '#10b981'
              );
            }
          })
          .catch((err: any) => {
            sendPrivateSystemMessage(
              `Failed to sync character: ${err.message || err}`,
              'D&D Beyond Sync',
              '#f43f5e'
            );
          });

        return true;
      }

      // 7. /tokens
      if (cmd === 'tokens') {
        const syncTokens = context.tokens || [];
        if (syncTokens.length === 0) {
          sendPrivateSystemMessage(
            `No controllable tokens found on the map to sync.`,
            'Tokens'
          );
          return true;
        }

        const lines = syncTokens.map((t, idx) => {
          const hpStr = t.maxHp ? ` [HP: ${t.currentHp ?? 0}/${t.maxHp}]` : '';
          const charStr = t.character ? ` (${t.character.classes || t.character.name})` : '';
          return `${idx + 1}. ${t.name}${charStr}${hpStr}`;
        });

        sendPrivateSystemMessage(
          `Controllable tokens available to sync:\n${lines.join('\n')}\n\nUse /sync <url or id> <index> to sync a character.`,
          'Tokens'
        );
        return true;
      }
  return false;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  player,
  character,
  tokens,
  messages,
  onSendMessage,
  onBroadcastRoll,
  onSyncToken,
  onUpdatePlayerChar,
  fetchCharacterFn,
  isOpen,
  onToggleOpen,
}) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const { windowRef, position, isDragging, handleMouseDown } = useDraggableWindow({
    storageKey: 'obr_chat_pos',
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleCommand = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    if (text.startsWith('/')) {
      processSlashCommand(text, {
        player,
        character: character || undefined,
        tokens,
        onSendMessage,
        onBroadcastRoll,
        onSyncToken,
        onUpdatePlayerChar,
        fetchCharacterFn,
      });
      return;
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
      {/* Expanded Chat & Commands Drawer */}
      {isOpen && (
        <div
          ref={windowRef}
          className="glass-panel-elevated animate-slide-up draggable-window"
          style={{
            position: 'fixed',
            left: position ? `${position.x}px` : '1.25rem',
            top: position ? `${position.y}px` : undefined,
            bottom: position ? undefined : '1.25rem',
            width: '360px',
            maxHeight: isMinimized ? '46px' : '440px',
            height: isMinimized ? '46px' : '420px',
            zIndex: 46,
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: isDragging ? '0 24px 48px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.7)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            transition: isDragging ? 'none' : 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: '0.75rem 1rem',
              borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface)',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Table Chat & Dice</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                className="btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized((v) => !v);
                }}
                title={isMinimized ? 'Expand Chat' : 'Minimize Chat'}
                style={{ width: '24px', height: '24px' }}
              >
                <ChevronDown
                  size={16}
                  className={`chevron-minimize ${isMinimized ? 'minimized' : ''}`}
                />
              </button>
              <button className="btn-icon" onClick={onToggleOpen} style={{ width: '24px', height: '24px' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div
            className={`draggable-window-body ${isMinimized ? 'minimized' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
            }}
          >

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
              style={{ cursor: 'pointer', color: '#a855f7' }}
              onClick={() => setInputText('/spell ')}
            >
              /spell
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
                      color: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, color: m.senderColor || 'white', fontSize: '0.75rem' }}>
                        {m.senderName}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ color: '#ffffff', whiteSpace: 'pre-wrap' }}>
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
        </div>
      )}
    </>
  );
};
