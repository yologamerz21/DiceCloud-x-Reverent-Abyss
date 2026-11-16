# RA class readiness audit

Date: 2026-11-15
Status: answered 2026-11-16; the blueprint now follows these decisions
Companion to: `2026-11-03-ra-character-base-scaffold-design.md` (the blueprint)

## Purpose

Before any more classes are built, check that the blueprint's base can take **every** kind of mechanic the current rules use. That covers all classes, not just the ones being built first. The sources are the main rulebook (*Reverent Abyss TTRPG System, 15-11-2026*, 304 pages) and the *Draconian Descendant* class sheet (15-11-2026). Each mechanic is sorted into:

- **Hook exists**: the blueprint already has the variable, tag or slot.
- **Hook to add**: the base needs a new variable, tag, slot or folder (section 3).
- **Content pattern**: the class builds it itself with standard engine tools (section 4).
- **Can't automate**: the engine can't do it, so the sheet shows the rule as text and the table applies it (section 5).

Engine claims cite the fork's source under `app/imports/`.

## 1. Where the rulebook disagrees with the blueprint (author to decide)

These change base formulas, so they need answers before the blueprint is updated.

| # | Topic | Blueprint (from v2 or earlier answers) | Rulebook |
|---|---|---|---|
| C1 | Action points at turn start | Recharge by `actionRechargeRate` (3) | "You gain your maximum action number at the start of your turn" (p2): a full refill |
| C2 | Speed | `5 + athletics.modifier` | `5 + ½ athletics`, minus armour penalties (p10, p15) |
| C3 | Evasion | `4 + agility.modifier` | `4 + agility + 2 for each empty hand` + equipment (p11) |
| C4 | Who can parry | Base Parry only with a weapon; shields don't switch it on | Parry exists if you hold a weapon **or a shield**; Weapon Mastery is added only with a weapon that can parry (p11, p14). Some weapons can't parry (hand axe, work hammer); the dagger gives no WM if it's your only weapon |
| C5 | Max HP | `25 + vitality × (level − 1)` + rolls (your answer) | `25 + max of the class health die + vitality × level` + one roll per level after the first (p14, p18) |
| C6 | Max Stamina | `30` flat | `30 + max of the class stamina die + (vitality + athletics) × level` + one roll per level after the first (p14, p18) |
| C7 | Tired / Exhausted | −2 / −4 to Evasion, Parry, to-hit; Exhausted disadvantage on attacks | Also −2 / −4 to **all 2D10 rolls**, −2 / −3 speed; Exhausted gives disadvantage −1 on everything; enemies get crit chance and advantage against you. The enemy crit values differ between p5 (+1 / +2) and p8 (+3 / +6) |
| C8 | Drawing and stowing | Free (your answer) | "Holstering a weapon is still a minor action" (Warrior, p78), so drawing and stowing cost an action |
| C9 | Casting with full hands | No requirement (your answer) | The quarterstaff says "You may cast spells whilst wielding this" (p44), which implies a free hand is normally needed |
| C10 | Spell save DC | (not in v2) | `10 + SCM` (p7) and `10 + SCA` (p11, p15, p19) both appear. SCM is set per class: "Druid's SCM is Wisdom" (p4), "Brigand: your SCM is Charisma" |
| C11 | Stat modifier below 2 | Fork code: anything below 2 is −4 | Table on p17/p20: below 0 is −5, 0–1 is −4 (`constants/RA_ABILITY.ts`) |
| C12 | Dual wielding | Off hand works the same as main hand | Main attack, then the second weapon attacks as a minor action with its cost reduced by 1; afterwards enemies with melee weapons get +3 to hit you until your next turn (p3) |

### Decisions (2026-11-16)

- **C1–C7:** the rulebook wins. The blueprint follows it.
- **C8:** drawing and stowing are a minor action each (1 Action Point). The base has one Draw or Stow action.
- **C9:** honour system; the sheet doesn't track free hands for casting.
- **C10:** spell save DC is `10 + SCM`, unless a spell states otherwise.
- **C11: left unchanged.** Stats can't realistically drop below 0 in combat, so the fork's −4 floor stays. Background: pages 17 and 20 extend the stat table with "<0 → −5" and "0 → −4"; pages 1 and 13 show the shorter table starting at 2. The fork was built from the short table and gives −4 to everything below 2 (`constants/RA_ABILITY.ts:5`). Stats of 0–1 already match; only negative stats differ. If that ever matters, it's a one-line fork change plus a test.
- **C12:** the dual-wield follow-up is a base action. Its "+3 to hit you" for enemies is a note only.
- **Opponent-side effects:** the sheet tracks only changes to its own character. Enemy crit chance and advantage against you aren't shown (this also settles the p5 / p8 mismatch for the sheet).
- **Q1 (multiclass dice):** the first class's dice count at level 1; each later level rolls the die of the class taken at that level.
- **Action points by level (H21):** classes grant their own +1s at different levels (Warrior 5 / 15 / 25, Druid and Rogue on other schedules), so the base keeps 3 and classes add the rest. The p19 table is treated as a guideline, not a base formula.

## 2. What the base already covers

| Mechanic | Where it lives |
|---|---|
| 8 core stats, RA modifier table | Ability attributes, fork modifier (5.2 Stats) |
| 2D10, stacking advantage, crits on 20 − crit chance | Fork code; `critChance`, tag `attackRoll` |
| Mortality, heavy blows, Hit / Partial Parry / PARRY | 5.2 HP and Stamina, Damage Engine |
| Short and long rests | 5.2 Rests |
| Action points as a resource | `actionPoints` |
| Weapons, shields, armour, hands, Parry bonuses | Wielding folder, Armoury templates |
| Levels from classes, multiclassing | Class slot, Class Level properties (5.3) |
| Race and trait slots | 5.3 |
| Flanking, ranged with an adjacent enemy | Situational Modifiers |

## 3. Hooks the base should add

Each row is something several classes, races, items or general rules touch, so it belongs in the base rather than in any one class.

| # | Hook | Why (rulebook source) | How (engine) |
|---|---|---|---|
| H1 | `healthDie`, `staminaDie` (attributes, base 0) | Dice are class-dependent; the max of the first class's dice is added at level 1 (p14, p18) | Each class sets them with an Effect **set** (highest wins, so a multiclass takes the larger; see question Q1). Max HP and Stamina add `healthDie` / `staminaDie` |
| H2 | `emptyHands` = `max(hands - handsUsed, 0)` | Evasion +2 per empty hand; Rapier bonus "if your other hand is empty" (p11, p43) | Utility attribute |
| H3 | `weaponsHeld`, `parryWeaponsHeld` counters | WM to Parry needs a weapon that can parry; dagger alone gives no WM; some weapons can't parry (p11, p45, p48, p51) | Armoury items add 1 to `weaponsHeld`, and to `parryWeaponsHeld` only if they can parry. Parry = `evasion + (parryWeaponsHeld > 0 ? parryAbilityMod : 0)` + held-item bonuses. With no parry source, Parry equals Evasion, which works as "no parry stat": a roll that clears Evasion also clears Parry (p6 tie rule) |
| H4 | `parryAbilityMod` (base `weaponMastery.modifier`) | Quarterstaff: "use agi instead of WM for parrying" (p44) | The quarterstaff adds an Effect **set** `max(agility.modifier, weaponMastery.modifier)`. Set takes the highest value (`aggregateEffect.js:58-63`) |
| H5 | `lightWeaponsHeld` (and the same per weapon family as needed) | Rapier "+1 evasion if your other hand has a light weapon"; dueler conditions (p43, p74) | Counter pattern, like `polearmsHeld` |
| H6 | `attackStaminaSurcharge` (base 0) | Plate: "attacking with a weapon costs an additional 3 stamina" (p60) | Every weapon attack's stamina cost is `<cost> + attackStaminaSurcharge` (Attributes consumed takes a formula) |
| H7 | `lowStaminaMultiplier` (base 1) | Plate: "Effects from low stamina are doubled" (p60) | The Tired and Exhausted Effect amounts are multiplied by it |
| H8 | `parryStaminaReduction`, `parryStaminaFloor` | Shields: reduce parry stamina damage by athletics (×1/×2/×3), "to a minimum of 3/5" (p57-58) | The damage engine's stamina roll becomes `max(floor(dmg / 2) - parryStaminaReduction, min(floor(dmg / 2), parryStaminaFloor))` |
| H9 | `scm` (spell casting modifier) and `spellSaveDC` | SCM is chosen by class or subclass (p4, Brigand, Draconian casting method) | Base `scm` = 0; a class sets it with an Effect **set** (e.g. `wisdom.modifier`). `spellSaveDC` = `10 + scm` or `10 + spellCastingAbility.modifier` per C10 |
| H10 | **Conditions** folder: Scorched, Slowed, Stunned, Prone, Demoralised, Rooted, Unconscious | General rules any class or monster can apply (p8-10) | Stack counters (`scorched`, `slowed`, `stunned`), toggles with their effects, and Turn start triggers. Examples: Scorched deals `scorched`d6; Stunned reduces Action Points by `stunned`; Slowed gives −1 per stack to defences, to-hit and speed. Players and DMs change counters with the attribute's +/− buttons |
| H11 | **Unconscious** at 0 HP | Lose 4 Mortality and HP at turn start; when dropping, lose `25 + 2 × level` stamina and `10 + ½ level` max health (p5) | Toggle `hitPoints.value <= 0` holding a Turn start trigger (Adjustments on `mortality` and `hitPoints`). The drop itself can be a Damage-property trigger on `hitPoints` with a condition. Verify on deploy |
| H12 | **Prepare** action | +2 Parry and Partial Parry per action, up to ½ WM times, until your next turn (p3) | Attribute `prepareStacks` (max `floor(weaponMastery / 2)`, Reset: Turn start) raised by the Prepare action (cost 1 AP); Effect add `2 * prepareStacks` to both |
| H13 | General combat actions | Move (minor, 3 per turn), Disengage, Control, dual-wield second attack (p2-3) | Actions in the base, costing Action Points. Uses with Reset: Turn start enforce "3 times per turn" |
| H14 | `mounted` toggle | Scimitar, Lance, Morning star bonuses (p44, p47, p49) | Situational toggle; weapons read it in their conditions |
| H15 | `maxEvasion` handling | Heavy armour "Maximum evasion is 8 / 11" (p60) | Armour uses an Effect **max** on `evasion` (the smallest max wins). No base change, but listed so armour authors know |
| H16 | Combat Strategy slot type | Warrior L1, Draconian L2 and other classes learn "a combat strategy" from one shared list (p73-75) | A shared library of strategy fillers (tag `combatStrategy`). Classes put a Combat Strategy slot in the right Class Level |
| H17 | Stat increase per level | Physical or mental +1 (2–9), +2 (10–19), +3 (20–29), +10 (30) (p17, p19) | Each Class Level holds a slot (tag `statIncreasePhysical` / `statIncreaseMental`). Fillers in RA Core ("Athletics +1", "+2", "+3", "+10") add to the stat. The player picks the right amount; slot conditions only filter, they don't enforce (`LibraryNodes.ts:87-92`) |
| H18 | Skills (specific ×2, broad ×1.5, upgraded ×2 / ×3) | p12, p16 | Skill properties: a skill's value is `baseValue + ability modifier` (`computeVariableAsSkill.js`). So a specific skill uses base value `<ability>.modifier` (2×); broad uses `floor(<ability>.modifier / 2)`; upgraded specific uses `2 * <ability>.modifier`. RA Core ships these as three templates |
| H19 | Traits slot count by level | 3 at L1–5, up to 4 / 5 / 6 at L6 / 12 / 18 (p15) | The Traits slot's quantity is a formula: `level >= 18 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : 3` |
| H20 | Racial features at L6 / 12 / 18 / 24 (+ a skill each) | p20, p22 | Races gate features with `level >= 6` etc. No base change; listed for race authors |
| H21 | Action count by level | 3 / 4 / 5 / 6 / 7 / 8 at levels 1 / 5 / 10 / 15 / 20 / 25 (p19), which matches the classes' "Additional Action Point" features | Classes add +1 to `actionPoints` at those levels. The base keeps 3 |

## 4. Content patterns for class authors

All of these use only engine tools that exist today.

| Pattern | Used by | Recipe |
|---|---|---|
| Level-gated feature | Every class | Put the feature in the Class Level for that level, or under a toggle `<class>.level >= N` |
| Choice ("choose one") | Combat strategies, L5 scaling stat, subclass, traits like "+2 SCA or WM" | A slot with library fillers, or player switches (toggles shown on the sheet) |
| Class resource | Holy, Scry, Draconian charges and empowering charges, rage, mana | A resource attribute with Reset Long rest or Turn start, plus Turn start triggers for regeneration |
| Shrinking maximum | Draconian: max charges drop by 1 per 3 charges used | Resource total `base - floor(chargesSpent / 3)`; casting adds to `chargesSpent` with an Adjustment; `chargesSpent` resets on a long rest |
| Tiered penalties | Draconian fatigue (1 / 5 / 10 / 15+), conditions | Counter attribute + one toggle per tier + Turn start decay trigger |
| Pay-or-force casting | Draconian forced casting, warlocks spending health | A **choice** branch in the spell ("Pay charges" / "Force"), with Adjustments for the cost instead of Attributes consumed (Adjustments don't refuse at 0) |
| Upkeep / concentration | Chilling Winds, many caster features | Casting applies a **Buff** to the caster that holds a Turn start trigger paying the upkeep (Action Points and resource). Ending it uses a Buff Remover. Triggers inside a buff work like any other |
| Once per turn | Many features | An action with Uses 1 and Reset: Turn start |
| Level-banded numbers | "+1 / +2 / +3 / +5 at 1–9 / 10–19 / 20–29 / 30" | One formula with nested `? :` on `level` or `<class>.level` |
| Transformation | Druid forms (bear table, p223) | A Buff that sets stats with Effect **set** and adds a form health attribute |
| Weapon modifications | Artificer "up to 3 modifications onto weapons" | Folders inserted from the library **inside** a weapon item; they only count while the weapon is equipped |
| Jam / misfire chance | Belt-fed and repeating crossbows, musket | A Roll inside the attack and a branch on its result |
| Applying a debuff to a target | Warhammer, Lance, many spells | A Buff with target "target", when both creatures are on a tabletop; otherwise a note |
| Summons and companions | Beast Master, druid birds, Artificer machines | Separate creatures (characters or tabletop creatures). Verify on deploy whether a summon property suits this; otherwise they're their own sheets |
| Crossbow loaded state | Crossbows | An attribute that needs a variable name, so the "no variable names" Armoury rule breaks here. Two identical crossbows would share it. Accept, or leave reloading as a note |

## 5. Can't automate (shown as text on the sheet)

The engine can't do these. They stay table rules, written in the relevant note or action description.

| Rule | Why not | Source |
|---|---|---|
| "Enemies have crit chance / advantage against you" (Tired, Exhausted, Prone, unarmed, Tower shield flanking, Striker) | The fork reads crit chance and advantage from the **attacker** only; defender-side modifiers were left out of the fork's Tier 1 (`RA_HANDOFF.md`) | p5, p8, p58, p75 |
| Hit-tier rules: ignore parries, can't be partially parried, ignore light/medium armour, "if you score a hit, you crit" (axes), firearms clearing 14 / 17 evasion | The defender resolves the hit tier by hand (blueprint 8.1) | p48-53, p61 |
| Weapon-specific crit chance (e.g. Halberd +3, bows +½ WM) | `critChance` is creature-wide. A before-trigger Roll named `critChance` might raise it for one attack, because a Roll writes into the action's scope and the attack reads crit chance from that scope (`applyActionProperty.ts:221-224`). This is **unverified**. The fallback is a creature-wide Effect while the weapon is held, which also boosts the other hand | p44-62 |
| −2 / −4 "to all 2D10 rolls" on **plain ability checks** | A plain ability check adds only the ability's modifier (`applyCheckTask.ts:37-51`); lowering the modifier would also lower Evasion, Parry and so on. Skills, saves and attacks *can* take the penalty by tag. The workaround is to roll checks from skills (H18) | p5, p8 |
| Carrying unspent actions past the maximum (bows, crossbows) | An attribute's value can't exceed its total | p54-55 |
| Free movement at the start of combat | There's no "combat start" event | p2 |
| Facing, range bands, cover, adjacency | Positional; players flip situational toggles | p2, p61 |
| Opportunity-attack eligibility (shorter weapon, ranged, casting) | Positional; `weaponLength` is shown to help | p3-4 |
| Arrow-type bonuses (+1 to hit, upgraded dice) | Ammo is chosen as the attack runs, after the to-hit is already set (`spendResources.ts`). Use one attack per arrow type, or notes | p53 |

## 6. Notes on the Draconian Descendant sheet

It is a full class (level table, D8 health and D12 stamina dice), not just a race. Everything in it fits sections 3 and 4:
- Charges = `spellCastingAbility.modifier + scm`, +1 per turn (Turn start trigger), max shrinking as spent (section 4).
- Casting method sets `scm` to Wisdom (Flow) or enables forced casting with fatigue (section 4).
- Level-banded spell hit bonus (section 4).
- "Hardened Scales: +3 partial parry", "+1 HP per level, +2 stamina per level": Effects on hooks that exist.
- Prepared spells = default action count + SCA, where the default count is "3, increasing by 1 every 5 levels". The class defines that itself, e.g. an attribute `draconianPreparedSpells` = `min(3 + floor(draconian.level / 5), 8) + spellCastingAbility.modifier`. The base doesn't need it, because other classes add action points on their own schedules (H21).

## 7. Where each hook landed in the blueprint

| Hook | Blueprint section |
|---|---|
| H1 class dice, "Starting class" switch | 5.2 HP and Stamina, 5.3 |
| H2 `emptyHands`, H3 parry counters, H4 `parryAbilityMod` | 5.2 Defensive Stats |
| H5 `lightWeaponsHeld` | 5.2 Wielding |
| H6 `attackStaminaSurcharge` | 5.2 Combat |
| H7 `lowStaminaMultiplier` | 5.5 |
| H8 parry stamina reduction and floor | 5.2 Damage Engine |
| H9 `scm`, `spellSaveDC` | 5.2 Spellcasting hooks |
| H10 Conditions | 5.5 Conditions |
| H11 Unconscious | 5.2 Unconscious |
| H12 Prepare, H13 general actions (dual-wield +3 to enemies is a note only) | 5.2 Prepare, General Actions |
| H14 `mounted` | 5.2 Situational Modifiers |
| H15 Evasion caps | 8.5 |
| H16 Combat Strategy slot | 4, 5.3 |
| H17 stat increases | 5.8 |
| H18 skills, H19 trait count | 5.7, 5.3 |
| H20 racial feature levels | Race content (no base change) |
| H21 action points | Classes add +1s (no base formula) |
