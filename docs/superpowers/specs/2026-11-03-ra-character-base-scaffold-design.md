# RA Character Base v3 and Armoury: scaffold blueprint

Date: 2026-11-03, revised 2026-11-16
Status: approved 2026-11-15; revised to follow the 15-11-2026 rulebook (see the class readiness audit, `2026-11-15-ra-class-readiness-audit.md`)

## 1. Intent

Reverent Abyss (RA) characters are built from in-app DiceCloud library content. The current design, **R.A: Character Base v2**, was made in upstream DiceCloud before this fork existed. It hand-built several systems the fork now does in code (2d10 rolls, stacking advantage, crits, the stat table, turn buttons, Mortality health).

This blueprint rebuilds that base for the fork, adds the equipment and wielding rules, and defines a separate **RA Armoury** library of weapons, shields and armour. It is a **scaffold**: a stable skeleton with named hooks that every class, race and trait in the current rulebook can plug into through slots, without editing the base.

**Source of truth:** where v2 and the rulebook (*Reverent Abyss TTRPG System, 15-11-2026*) disagree, the rulebook wins (the author's decision, 2026-11-16).

The author will build everything by hand in the fork's library editor once the app is deployed. So this document lists every property with its type, variable name, formula and tags.

## 2. Goals, non-goals, anti-goals

**Goals**
- The base works on its own, with nothing in its slots.
- Content joins only through slots (race, traits, class, skills) or the Inventory (Armoury items). Adding or removing any of it never means editing the base.
- Every value other content may touch has a stable variable name or tag, listed in the hook registry (section 7).
- Levels come from classes, not the base. Multiclassing works without changes.
- Weapons and armour live in their own library, and players pick what they want.

**Non-goals (for this scaffold)**
- Designing any race, trait or class. The audit's section 4 lists the patterns they'll use.
- Final numbers for most weapons and armour. Section 8 gives worked examples from the rulebook.
- Spells and spell lists. Spell attacks need only the tags in section 6 and the `scm` hook.

**Anti-goal (the author's hard line)**
- **Nothing in this blueprint may need something the engine can't do.** Every mechanism below is checked against the fork's source (section 3). Rules the engine can't automate are shown as text on the sheet (section 3, last list). Anything not yet confirmed in a running app is marked *verify on deploy* and listed in section 10.

## 3. Engine constraints this design respects

Checked in the fork's source. Paths are under `app/imports/`.

| What the engine can do | Source |
|---|---|
| An item's children (effects, toggles, actions) are active only while the item is equipped and its quantity isn't 0 | `api/engine/computation/buildComputation/computeInactiveStatus.ts:29-34` |
| Effects can `add`, `set` (highest wins), `min`, `max` (smallest wins), `mul`, `base`, `advantage`, `disadvantage` | `api/properties/Effects.ts:19-31`, `aggregate/aggregateEffect.js` |
| Advantage/disadvantage Effects stack numerically and can target an attack action by tag | `RA_FORK_CHANGES.md` "Granting advantage" |
| The attacker's crit target is `20 − critChance`, read from a variable named `critChance` | `api/engine/action/applyProperties/applyActionProperty.ts:221-224` |
| Attribute type `mortalityHealth` caps HP by a linked `mortality` attribute | `api/properties/Attributes.ts:27-37`, `RA_FORK_CHANGES.md` |
| Triggers fire on `turnStart`, `turnEnd`, `shortRest`, `longRest`, `anyRest`, `doActionProperty`, `check`, `damageProperty`; rest "Before" triggers run before resets | `api/properties/Triggers.ts:7-21`, `api/engine/action/tasks/applyResetTask.ts:29-40` |
| `classLevel` properties sum into a creature-wide `level` and into `<classVariable>.level` | `api/engine/computation/buildComputation/linkTypeDependencies.js:123-134` |
| A toggle with **Show on sheet** and no condition is a player switch | `api/properties/Toggles.ts`, `flipToggle.js:26-29` |
| An action with a false resource condition refuses to run and shows its note | `computeAction.ts:14-20`, `applyActionProperty.ts:59-67` |
| An attribute with **Can be incremented above total** works as a counter that starts at 0 | `Attributes.ts:126-129`, `applyDamagePropTask.ts:98,123` |
| A skill's value is `base value + ability modifier` (+ effects), so its base value can multiply the modifier | `computeVariableAsSkill.js` |
| A slot's quantity is a formula; a library node can fill more than one place (`slotQuantityFilled`) | `api/properties/Slots.ts`, `api/library/LibraryNodes.ts` |

What library content **can't** do, so the design avoids it:
- Change whether an item is equipped, flip a toggle, or move an item from an action. Only attribute values, action uses, item quantity and buffs can be written.
- Block equipping. Rule breaks are **flagged**, never blocked (the author's chosen rule).
- Count or sum across items in a formula. Totals are built "push" style: each item's own Effect adds into a shared attribute.
- Keep separate state for two copies of one item. Variable names are creature-wide, so **Armoury items define no variable names** (section 8).
- Reliably read `#item.x` inside attack or damage rolls while the action runs (likely unresolved). The design never uses `#item`.

Rules the engine **can't automate**, which stay as text on the sheet (full list in the audit, section 5):
- "Enemies have crit chance / advantage against you" (Tired, Exhausted, Prone, unarmed and so on). The fork reads both from the attacker only, and the sheet tracks only its own character, so these are left to the table.
- Hit-tier rules such as "ignores parries" or "can't be partially parried", because the defender resolves the hit tier by hand.
- Penalties to "all 2D10 rolls" on **plain ability checks**. Skills, saves and attacks can take them; plain ability checks add only the modifier (`applyCheckTask.ts:37-51`).
- Weapon-specific crit chance (creature-wide `critChance` is used; see 8.6).

## 4. Library layout

| Library | Contains | How it reaches a character |
|---|---|---|
| **RA Core** | The character base folder (section 5), skill templates (5.7), stat-increase fillers (5.8) | The base fills the character's **Ruleset** slot (slot tag `base`); the others fill slots inside the base and class levels |
| **RA Combat Strategies** | The shared combat strategy list (rulebook p73-75) | Fills Combat Strategy slots placed by classes (tag `combatStrategy`) |
| **RA Armoury** | Weapon, shield, armour and ammunition templates (section 8) | Player adds items to their Inventory from the library |
| **RA Races / Traits / Classes** (later) | Ancestry, trait and class content | Fills the Race, Traits and Class slots inside the base |

The character itself keeps two things outside the base:
- A **Ruleset** property slot at the root, slot tags `base`, quantity 1.
- The **Inventory** folder with **Equipment** and **Carried** subfolders. The equip switch moves items into the folder tagged `equipment` or `carried` (`equipItem.js`). These come from the default character properties; *verify on deploy* that they carry those tags.

The RA Core library node for the base folder: **Can fill slots** on, library tags `base`.

## 5. RA Core: the base tree

Each block lists the properties in tree order.

### 5.1 What changes from v2

| v2 part | v3 | Why |
|---|---|---|
| Attack Rolling Engine (Attack Roll and Spell Attack Roll triggers, rolls, crit branches and notes; Net Advantage; Advantage Count; Disadvantage Count) | **Drop** | The fork rolls 2d10 with stacking advantage and crits on every attack |
| Stat Thresholds and Stat Modifiers constants; the eight Tier and eight Modifier attributes | **Drop** | Ability attributes get the RA table modifier as `.modifier` |
| Turn Start and Turn End actions; Action Recharge Rate | **Drop** | The sheet has built-in turn buttons; Action Points now refill fully at turn start (rulebook p2) |
| Critical Hit Target, Critical Chance Bonus | **Replace** with `critChance` | The fork reads `critChance` |
| Lost Max HP and its HP Reduction effect | **Replace** with `mortality` | Mortality health does this natively |
| True Max HP `25`, True Max STA `30` | **Change** to the rulebook formulas with class dice (5.2) | Rulebook p14, p18 |
| Speed `5 + athletics.modifier` | **Change** to `5 + floor(athletics.modifier / 2)` | Rulebook p10, p15 |
| Evasion `4 + agility.modifier` | **Change**: add +2 per empty hand | Rulebook p11 |
| Parry needs `canParry` | **Change**: Weapon Mastery only from a weapon that can parry; shields also give a parry stat | Rulebook p11, p14 |
| Tired / Exhausted | **Change** to the full rulebook penalties (5.5) | Rulebook p5, p8 |
| Weapon-type toggles reading `weaponType` | **Change** to per-type counts | One `weaponType` value breaks with two weapons held |
| Formulas using `athleticsMod` etc. | **Change** to `athletics.modifier` etc. | The Mod attributes are dropped |
| Rest formulas | **Change** to the RA rest rules (5.2) | Rulebook p4 |
| — | **Add** Conditions, Unconscious, general combat actions, skills, stat increases, spellcasting hooks | Needed by every class (the audit, section 3) |

### 5.2 Folder: Base System

**HP and Stamina**

The rulebook's rule (p14, p18): Health = 25 + the max of your health die + Vitality × level, plus one health-die roll per level after the first. Stamina = 30 + the max of your stamina die + (Vitality + Athletics) × level, plus one stamina-die roll per level after the first. Vitality and Athletics mean their modifiers, so a modifier change applies retroactively to every level.

| Property | Type | Variable | Value / formula | Notes |
|---|---|---|---|---|
| Hit Points | Attribute, **Mortality health** | `hitPoints` | Base `trueMaxHp`; Mortality attribute `mortality` | Reset: Long rest (see Rests) |
| Mortality | Attribute, resource | `mortality` | Base `hitPoints.total` | Leave Reset blank. Lower it only with Adjustments |
| Stamina Points | Attribute, health bar | `staminaPoints` | Base `trueMaxSTA` | Reset: Long rest |
| Health Die | Attribute, utility | `healthDie` | `0` | Set by the **starting class** (5.3) with Effect **set**, e.g. `8` for a D8 |
| Stamina Die | Attribute, utility | `staminaDie` | `0` | As above, e.g. `12` |
| True Max HP | Attribute, stat | `trueMaxHp` | `25 + healthDie + vitality.modifier * level` | Races and classes add to it with Effects (e.g. "+1 health per level": add `level`) |
| True Max STA | Attribute, stat | `trueMaxSTA` | `30 + staminaDie + (vitality.modifier + athletics.modifier) * level` | As above |
| Rolled HP | Attribute, resource | `rolledHP` | Base `0`; child Effect **add** `rolledHP` → `trueMaxHp` | The running total of health-die rolls, one per level after the first, each rolled on **the die of the class that level was taken in**. The player adds each roll when they level up. An Effect can't store a dice roll (it would re-roll on every recalculation), so the roll is kept here by hand |
| Rolled STA | Attribute, resource | `rolledSTA` | Base `0`; child Effect **add** `rolledSTA` → `trueMaxSTA` | As above, for stamina |
| Max HP Damage Reduction | Attribute, utility | `maxHpDamageReduction` | `0` | Hook |

With no class, `level` and both dice are 0, so the base shows 25 HP and 30 Stamina.

**Long and Short Rests** (rulebook p4)

- **Short rest:** heal HP equal to (level + Vitality) twice, and regain Stamina equal to level × (Athletics + Vitality).
- **Long rest:** restore all HP and Stamina, and regain Mortality equal to ½ level + Vitality, minimum 3.

| Property | Type | Settings |
|---|---|---|
| Short Rest | Trigger | Event Short rest, timing After, silent |
| ↳ Adjustment | Adjustment | Target self, `hitPoints`, increment, amount `-max(2 * (level + vitality.modifier), 0)` (a negative amount heals; the heal stops at Mortality on its own) |
| ↳ Adjustment | Adjustment | Target self, `staminaPoints`, increment, amount `-max(level * (athletics.modifier + vitality.modifier), 0)` |
| ↳ Note | Note | `You have regained {max(2 * (level + vitality.modifier), 0)} HP and {max(level * (athletics.modifier + vitality.modifier), 0)} Stamina` |
| Long Rest | Trigger | Event Long rest, timing **Before**, silent |
| ↳ Adjustment | Adjustment | Target self, **`mortality`**, increment, amount `-max(floor(level / 2) + vitality.modifier, 3)` (a negative amount regains Mortality) |
| ↳ Note | Note | `You have regained {max(floor(level / 2) + vitality.modifier, 3)} Mortality` |

The Long Rest trigger runs **Before**, so Mortality is regained first. The engine then resets HP and Stamina; the HP refill goes through the same path as healing, so it stops at the new Mortality (`applyResetTask.ts:29-39`). The `max(…, 0)` floors stop a negative modifier from turning a rest into damage.

**Unconscious** (rulebook p5)

| Property | Type | Settings |
|---|---|---|
| Unconscious | Toggle (computed) | Condition `hitPoints.value <= 0` |
| ↳ Folder | Folder | "You are unconscious. An ally can stabilise you with a major action and something to stabilise with, such as bandages." |
| ↳ Dying | Trigger | Event Turn start, timing After |
| ↳↳ Adjustment | Adjustment | Target self, `mortality`, increment, amount `4` |
| ↳↳ Adjustment | Adjustment | Target self, `hitPoints`, increment, amount `4` (HP can go negative under Mortality health) |
| Falling Unconscious | Trigger | Event **Attribute damaged or healed**, target the `hitPoints` attribute, timing After, condition `hitPoints.value <= 0 && hitPoints.value + ~damage > 0` (only on the blow that crosses 0) |
| ↳ Adjustment | Adjustment | Target self, `staminaPoints`, increment, amount `25 + 2 * level` |
| ↳ Adjustment | Adjustment | Target self, `mortality`, increment, amount `10 + floor(level / 2)` ("max health" here is Mortality, the current maximum) |
| ↳ Note | Note | "You fall unconscious." |

*Verify on deploy:* the name and sign of the scope variable for the damage amount in a `damageProperty` trigger (`applyDamagePropTask.ts:28-43` pushes it), and that the Mortality pull-down doesn't fire this trigger twice (`RA_FORK_CHANGES.md`: the pull-down doesn't fire damage triggers). Death (Mortality 0) is judged at the table.

**Stats**

| Property | Type | Variable |
|---|---|---|
| Base Stat Selection | Point buy | Rows as v2: `athletics`, `agility`, `vitality`, `weaponMastery`, `intelligence`, `wisdom`, `charisma`, `spellCastingAbility`. Players enter their rolled 2D6 values (rulebook p13) |
| Athletics … Spell Casting Ability (8) | Attribute, **ability** (was stat) | Same variable names. Races, traits and level-up fillers (5.8) add to them with Effects. Tag the four physical stats `physicalStat` and the four mental ones `mentalStat` |

Read modifiers as `athletics.modifier` and so on. *Verify on deploy* that the point-buy rows still feed the ability attributes as in v2.

**Stat table note:** the rulebook's longer table (p17, p20) gives −5 below 0; the fork gives −4 to anything below 2 (`constants/RA_ABILITY.ts`). Left unchanged (2026-11-16): stats can't realistically fall below 0 in combat.

**Combat**

| Property | Type | Variable | Formula |
|---|---|---|---|
| Action Points | Attribute, resource | `actionPoints` | Base `3`, **Reset: Turn start** (a full refill, rulebook p2). Classes and races add +1s with Effects. Unspent points carry past End Turn as reactions, which needs nothing extra |
| Speed | Attribute, stat | `speed` | `5 + floor(athletics.modifier / 2)`. Armour lowers it with Effects |
| Initiative Bonus | Attribute, modifier | `initiative` | `agility.modifier + wisdom.modifier` |
| Hit Bonus | Attribute, modifier | `toHit` | `0`. Every attack's attack roll adds it |
| Crit Chance | Attribute, utility | `critChance` | `0` (each point lowers the crit target by 1) |
| Attack Stamina Surcharge | Attribute, utility | `attackStaminaSurcharge` | `0`. Added to every weapon attack's stamina cost (plate armour adds 3, rulebook p60) |

**Spellcasting hooks**

| Property | Type | Variable | Formula |
|---|---|---|---|
| Spell Casting Modifier | Attribute, modifier | `scm` | `0`. The class or subclass sets it with an Effect **set**, e.g. `wisdom.modifier` (rulebook p4: SCM is chosen by class) |
| Spell Save DC | Attribute, stat | `spellSaveDC` | `10 + scm` (the author's rule; a spell that says otherwise uses its own DC formula) |

Each class's casting resource (Holy, Scry, charges, mana and so on) belongs to the class, not the base (the audit, section 4).

**Situational Modifiers** (folder under Combat)

| Property | Type | Settings |
|---|---|---|
| Flanking | Toggle, Show on sheet, off by default | Child Effect **advantage**, value `1`, target tag `attackRoll` |
| Ranged with Adjacent Enemy | Toggle, Show on sheet, off by default | Child Effect **disadvantage**, value `3`, target tag `rangedAttack` (rulebook p7) |
| Surprise Round | Toggle, Show on sheet, off by default | Child Effect **advantage**, value `1`, target tag `attackRoll` (rulebook p7) |
| Target Unaware | Toggle, Show on sheet, off by default | Child Effect **advantage**, value `3`, target tag `attackRoll` (rulebook p7) |
| Mounted | Toggle, Show on sheet, off by default, variable `mounted` | No children; weapons read `mounted` in their conditions (Scimitar, Lance, Morning star) |
| Generic Advantage | Attribute, resource, `otherAdvantage`, base 0 | Child Effect **advantage**, value `otherAdvantage`, target tag `attackRoll` |
| Generic Disadvantage | Attribute, resource, `otherDisadvantage`, base 0 | Child Effect **disadvantage**, value `otherDisadvantage`, target tag `attackRoll` |
| Generic Crit Chance | Attribute, resource, `otherCritChance`, base 0 | Child Effect **add** `otherCritChance` → `critChance` |

**Every Effect in this document that targets attacks by tag must have its Target field set to `attackRoll`.** Left blank, the engine picks a default field per property type: `attackRoll` for Actions but nothing for Spells, so spell attacks would silently miss the bonus (`getDefaultCalculationField` in `linkTypeDependencies.js`).

**Defensive Stats** (rulebook p11, p14)

| Property | Type | Variable | Formula |
|---|---|---|---|
| Empty Hands | Attribute, utility | `emptyHands` | `max(hands - handsUsed, 0)` |
| Evasion | Attribute, stat | `evasion` | `4 + agility.modifier + 2 * emptyHands`. Weapons, shields and armour add or subtract with Effects; heavy armour caps it with Effect **max** |
| Parry Ability Modifier | Attribute, utility | `parryAbilityMod` | `weaponMastery.modifier`. The quarterstaff raises it with Effect **set** `max(agility.modifier, weaponMastery.modifier)` |
| Parry Weapons Held | Attribute, utility | `parryWeaponsHeld` | `0`. Each held weapon that can parry adds 1 |
| Can Parry | Attribute, utility | `canParry` | `0`. Each held weapon that can parry **and each shield** adds 1 |
| Parry | Attribute, stat | `parry` | `evasion + (parryWeaponsHeld > 0 ? parryAbilityMod : 0)`. Held weapons and shields add their Parry bonuses with Effects |
| Partial Parry | Attribute, stat | `partialParry` | `parry`. Armour adds its bonus with Effects; some shields too |
| No Parry Stat | Toggle (computed) | — | Condition `canParry == 0`; child folder "You have no parry stat: attacks that clear your Evasion go straight to Partial Parry" |

With nothing held, Parry equals Evasion and Partial Parry equals Evasion plus armour. That is the rulebook's "if you do not have a parry stat, use evasion as the base for partial parry": a roll that clears Evasion also clears an equal Parry, because a tie reaches the higher threshold (p6).

**Prepare** (rulebook p3)

| Property | Type | Variable | Settings |
|---|---|---|---|
| Prepared | Attribute, resource | `prepareStacks` | Base `max(floor(weaponMastery.modifier / 2), 0)` (the most you can take; "½ of your WM", read as the modifier like the rulebook's other formulas), **Reset: Turn start**. Shown as "Prepare actions left" |
| ↳ Effect | Effect | — | add `2 * (prepareStacks.total - prepareStacks.value)` → `parry`, `partialParry` |

Reset: Turn start refills it at your next turn, which ends the bonus on time.

**General Actions** (rulebook p2-3; folder)

| Action | Cost | Settings |
|---|---|---|
| Move | `actionPoints` 1 | Uses 3, Reset: Turn start. Note: "Move up to {speed} hexes" |
| Disengage | `actionPoints` 1 | Note: "+3 Evasion against opportunity attacks for this move" |
| Prepare | `actionPoints` 1 and `prepareStacks` 1 | Spending a Prepare stack raises the bonus by 2; the action refuses on its own when none are left |
| Draw or Stow | `actionPoints` 1 | Note: "Draw or stow one weapon or shield, then flip its equip switch." (No action can equip an item, so the switch is flipped by hand) |
| Control | `actionPoints` 1 | Note with the contested Weapon Mastery rule |
| Dual-Wield Follow-up | (no AP of its own; see note) | Resource condition `weaponsHeld >= 2`; Note: "Attack with your second weapon as a minor action, its cost reduced by 1 (minimum 1). Until the start of your next turn, enemies with melee weapons have +3 to hit you, unless you succeeded a Control action against them." The player then uses that weapon's own attack, paying 1 less AP by hand. The +3 is an opponent bonus, so the sheet only shows it as text (5.5) |

**Wielding**

| Property | Type | Variable | Formula / settings |
|---|---|---|---|
| Hands | Attribute, stat | `hands` | `2` |
| Hands Used | Attribute, utility | `handsUsed` | `0`. Held weapons and shields add to it |
| Weapons Held | Attribute, utility | `weaponsHeld` | `0`. Every held weapon adds 1 |
| Light Weapons Held | Attribute, utility | `lightWeaponsHeld` | `0`. Light weapons, bucklers and parrying daggers add 1 (for the Rapier) |
| Body Armour Worn | Attribute, utility | `bodyArmourWorn` | `0`. Worn body armour adds 1 |
| Too Many Hands | Toggle (computed) | — | Condition `handsUsed > hands`; child folder "You are holding more than you have hands for" |
| Too Much Armour | Toggle (computed) | — | Condition `bodyArmourWorn > 1`; child folder "You are wearing more than one body armour" |

Over the hand limit, every weapon attack also refuses to run (section 8). The equip itself is never blocked.

**Damage Engine** (as v2, with Mortality)

| Property | Changes from v2 |
|---|---|
| Incoming Damage (`incomingDamage`, resource) | None |
| Parry Stamina Reduction (`parryStaminaReduction`, utility, base 0) | Shields add to it (Round shield: `athletics.modifier`) |
| Parry Stamina Floor (`parryStaminaFloor`, utility, base 0) | **New.** Shields raise it with Effect **set** (Round shield `3`, Tear drop and Tower `5`) |
| Stamina Lost roll (in PARRY and Partial Parry) | `max(floor(dmg / 2) - parryStaminaReduction, min(floor(dmg / 2), parryStaminaFloor))`: the reduction never takes the loss below the floor, and the floor never raises it above the unreduced loss |
| **Hit** action | Max Hp Lost roll: replace `hitPoints.total / 2` with `mortality / 2`. Second Adjustment targets **`mortality`** instead of `lostMaxHp`. Heavy Blow branch condition `hpTaken >= mortality / 2`, **moved above the Adjustments** so it measures the same Mortality the roll used |
| **Partial Parry** action | Same changes. **Fix:** rename the Stamina Lost roll's variable from `stamTakenCopy` to `stamTaken` |
| **PARRY** action | The new Stamina Lost formula |

### 5.3 Folder: Character Setup (the slots)

| Slot | Slot type | Slot tags | Quantity |
|---|---|---|---|
| Race | any | `race`, `reverentAbyss` | 1 |
| Traits | any | `characterTrait` | `level >= 18 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : 3` (rulebook p15) |
| Class | **Class** | `reverentAbyss`, `class` | unlimited (0), because multiclassing is allowed |
| Skills | any | `raSkill` | `level >= 24 ? 8 : level >= 18 ? 7 : level >= 12 ? 6 : level >= 6 ? 5 : 4` (rulebook p15) |

All four keep v2's **Unique in slot**, except Skills (a player can take two skills from the same template).

Levels: each class ships as a **Class** property with a variable name (for example `warden`), and its levels as **Class Level** properties with the same variable name. The engine sums them into `level` and `warden.level`. The base reads only `level`.

Rules for class authors, so multiclassing works without changes later:
- Each class has its **own unique** variable name.
- A class's features check that class's own level (`warden.level >= 3`), never `level`.
- Anything tied to character level (HP, rests, traits, skills) stays in the base and reads `level`.
- **Starting class:** each class's Class property holds a player switch, toggle "Starting class" (Show on sheet, off by default), containing Effect **set** on `healthDie` and on `staminaDie` with that class's dice. The player turns it on for the class they took at level 1 only. That gives the rulebook's level 1 maximum (the author's rule: the first class's dice count at level 1). Each Class Level's description names its dice for the player's rolls (5.2 Rolled HP).
- Each Class Level that grants a stat increase holds a **Stat Increase** slot (5.8), and one that grants a combat strategy holds a **Combat Strategy** slot (tag `combatStrategy`).

### 5.4 Folder: Persona

Unchanged: Description, Personality Traits, Ideals, Bonds, Flaws notes.

### 5.5 Folder: System Debuffs and Buffs (rulebook p5, p8)

| Property | Type | Variable | Settings |
|---|---|---|---|
| Low Stamina Multiplier | Attribute, utility | `lowStaminaMultiplier` | `1`. Plate armour adds 1 ("effects from low stamina are doubled", p60) |
| Tired Check | Toggle (computed) | `tiredCheck` | `(staminaPoints.value <= staminaPoints.total / 2) && (staminaPoints.value > 0)` |
| ↳ Effect | Effect | — | add `-2 * lowStaminaMultiplier` → `evasion`, `parry`, `toHit`, `speed` |
| ↳ Effects (3) | Effect | — | add `-2 * lowStaminaMultiplier`, target tags `skill`, then `save`, then `check` (one Effect per tag; skills' default field is their base value) |
| ↳ Folder | Folder | — | "You are tired. −2 also applies to plain ability checks: subtract it by hand." |
| Exhausted Check | Toggle (computed) | — | `staminaPoints.value == 0` |
| ↳ Effect | Effect | — | add `-4 * lowStaminaMultiplier` → `evasion`, `parry`, `toHit`; add `-3 * lowStaminaMultiplier` → `speed` |
| ↳ Effects (3) | Effect | — | add `-4 * lowStaminaMultiplier`, target tags `skill`, `save`, `check` |
| ↳ Effects | Effect | — | **disadvantage** `1`, target tag `attackRoll` (Target field `attackRoll`), and the same on tags `skill`, `save`, `check` |
| ↳ Folder | Folder | — | "You are exhausted. Apply −4 and disadvantage to plain ability checks by hand." |

**The sheet tracks only changes to its own character** (the author's rule, 2026-11-16). Rules that change what opponents get against you, such as the enemy crit chance and advantage from Tired, Exhausted or Prone, aren't on the sheet; the table handles them.

Because Parry is built from Evasion, the −2 to both lowers Parry by 4 while Tired. That follows the rulebook literally ("−2 evasion, −2 parry").

**Conditions** (subfolder; rulebook p8-10)

Each stacking condition is a counter: an attribute with base `0` and **Can be incremented above total** switched on, so it starts at 0 and the player or DM raises it with the attribute's +/− buttons. Use `min(<counter>.value, <cap>)` where a cap applies.

| Condition | Counter / toggle | Effects |
|---|---|---|
| Scorched (cap 10) | Attribute `scorched` | Trigger Turn start → Roll `min(scorched.value, 10)`d6 (variable `scorchedDamage`), Adjustment increment `scorchedDamage` on `hitPoints`; Note with the save and water rules |
| Slowed (cap 5) | Attribute `slowed` | Effect add `-min(slowed.value, 5)` → `evasion`, `parry`, `partialParry`, `toHit`, `speed` |
| Stunned | Attribute `stunned` | Trigger Turn start (timing After, so it runs after the refill) → Adjustment increment `stunned.value` on `actionPoints`; Note with the carry-over rule. The player lowers the counter by the actions it took |
| Prone | Toggle, Show on sheet, variable `prone` | Effect disadvantage `1` on tags `meleeAttack` (Target field `attackRoll`); folder note "Moving costs 3 movement per hex; your melee attacks deal ½ damage" |
| Demoralised | Toggle, Show on sheet | Effect disadvantage `1` on tags `attackRoll`, `skill`, `save`, `check` |
| Rooted | Toggle, Show on sheet | Effect add `-5` on tag `meleeAttack` (Target field `attackRoll`); folder note "Your defensive stats are reduced by half your Evasion, and you can't move" (an Effect on Evasion can't read Evasion itself without a loop, so the halving stays as text) |

### 5.6 Folder: Weapon Type Passives

| Property | Type | Settings |
|---|---|---|
| Weapon Length | Attribute, stat, `weaponLength` | `0`. Each weapon uses an Effect **set** (the longest held weapon counts) |
| Polearms Held | Attribute, utility, `polearmsHeld` | `0` |
| Heavy Piercing Held | Attribute, utility, `heavyPiercingHeld` | `0` |
| Bludgeoning Held | Attribute, utility, `bludgeoningHeld` | `0` |
| Polearms | Toggle, condition `polearmsHeld > 0` | Child: Polearm: Defensive Manoeuvre action as v2 (damage `athletics.modifier`) |
| Heavy Piercing | Toggle, condition `heavyPiercingHeld > 0` | Children: the two v2 triggers unchanged (tags `attackRoll` + `greatAxe`; `attackRoll` + `heavyPiercingAttack` NOT `greatAxe`) |
| Bludgeoning | Toggle, condition `bludgeoningHeld > 0` | Child: the v2 trigger unchanged (tags `attackRoll` + `bludgeoningAttack`) |

A new weapon type later means one more counter, one more toggle, and the tag on its weapons.

### 5.7 RA Core: skill templates (rulebook p12, p16, p20)

Four library nodes, each a **Skill** property (type Skill), library tag `raSkill`, **Can fill slots** on. The player inserts one into the Skills slot, then renames it and picks its ability.

| Template | Skill value | Base value formula | Slot places filled |
|---|---|---|---|
| Specific skill | 2 × modifier | `<ability>.modifier` | 1 |
| Broad skill | 1.5 × modifier, rounded down | `floor(<ability>.modifier / 2)` | 1 |
| Upgraded broad skill | 2 × modifier | `<ability>.modifier` | 2 (an upgrade uses up a new skill) |
| Upgraded specific skill | 3 × modifier | `2 * <ability>.modifier` | 2 |

The engine adds the ability modifier itself, so the base value is the extra on top. The player types the ability's variable name into the formula when they set the skill's ability. *Verify on deploy* how negative modifiers round for broad skills; the rulebook says round down.

### 5.8 RA Core: stat increase fillers (rulebook p17, p19)

Each level grants a physical or mental increase of +1 (levels 2–9), +2 (10–19), +3 (20–29) or +10 (30). Classes put a **Stat Increase** slot in each Class Level, slot tags `statIncrease` plus `physicalStat` or `mentalStat`, quantity 1.

RA Core ships 32 small fillers: one per stat per amount ("Athletics +1", "Athletics +2", "Athletics +3", "Athletics +10", and so on), each holding one Effect add `<amount>` → `<stat>`, library tags `statIncrease` and `physicalStat` or `mentalStat`. The player picks the amount that matches the level. Slot conditions only filter the list; they don't enforce (`LibraryNodes.ts:87-92`).

## 6. Tags

Every attack action, from any source, carries `attackRoll`. Add one of each pair that applies:

| Tag | Meaning |
|---|---|
| `attackRoll` | Every attack |
| `weaponAttack` / `spellAttack` | Weapon or spell attack |
| `meleeAttack` / `rangedAttack` | Melee or ranged |
| `greatAxe`, `heavyPiercingAttack`, `bludgeoningAttack` | Weapon-type attacks (v2 names kept) |

Skills get `skill`, `save` or `check` from their skill type automatically (`getEffectivePropTags.js`); the Tired, Exhausted and condition Effects rely on that.

Armoury items carry `raWeapon`, `raShield`, `raBodyArmour` or `raAmmo`. Stats carry `physicalStat` or `mentalStat`.

## 7. Hook registry (for race, trait, class and Armoury authors)

| Area | Variables |
|---|---|
| Stats | `athletics`, `agility`, `vitality`, `weaponMastery`, `intelligence`, `wisdom`, `charisma`, `spellCastingAbility` (and `.modifier`) |
| Health | `healthDie`, `staminaDie`, `trueMaxHp`, `trueMaxSTA`, `rolledHP`, `rolledSTA`, `hitPoints`, `mortality`, `staminaPoints`, `maxHpDamageReduction` |
| Turn economy | `actionPoints`, `prepareStacks` |
| Offence | `toHit`, `critChance`, `attackStaminaSurcharge`, `otherAdvantage`, `otherDisadvantage`, `otherCritChance`, `mounted` |
| Spellcasting | `scm`, `spellSaveDC` |
| Defence | `emptyHands`, `evasion`, `parryAbilityMod`, `parryWeaponsHeld`, `canParry`, `parry`, `partialParry`, `parryStaminaReduction`, `parryStaminaFloor` |
| Wielding | `hands`, `handsUsed`, `weaponsHeld`, `lightWeaponsHeld`, `bodyArmourWorn`, `weaponLength`, `polearmsHeld`, `heavyPiercingHeld`, `bludgeoningHeld` |
| Low stamina | `lowStaminaMultiplier`, `tiredCheck` |
| Conditions | `scorched`, `slowed`, `stunned`, `prone` |
| Movement | `speed`, `initiative` |
| Damage engine | `incomingDamage` |
| Levels (read only) | `level`, `<classVariable>.level` |
| Slots | Race (`race` + `reverentAbyss`), Traits (`characterTrait`), Class (`class` + `reverentAbyss`), Skills (`raSkill`), Stat Increase (`statIncrease` + `physicalStat`/`mentalStat`), Combat Strategy (`combatStrategy`) |

## 8. RA Armoury templates

**Rule for every Armoury item: no variable names anywhere inside it** (the attack's damage Roll is the one safe exception, 8.1). That lets a player carry two copies of the same weapon without them overwriting each other. Everything an item contributes goes through Effects into the base's shared attributes, and those Effects only count while the item is equipped.

"Equipped" means **in hand** for weapons and shields and **worn** for armour. Drawing and stowing are **minor actions** (rulebook p78; the author's decision 2026-11-16): each weapon and shield has a Draw and a Stow action costing 1 Action Point. The player uses the action to pay, then flips the equip switch, because no action can equip an item (section 3). Changing grip on a versatile weapon is free.

Library nodes: **Searchable** on, library tag `raArmoury`.

### 8.1 One-handed weapon

| Property | Settings |
|---|---|
| **Item** (e.g. Short sword) | Tags `raWeapon` (+ type tag if any). Weight and value as wanted |
| ↳ Effect | add `1` → `handsUsed`, `weaponsHeld` |
| ↳ Effect (if it can parry) | add `1` → `parryWeaponsHeld`, `canParry` |
| ↳ Effects | the weapon's bonuses: add → `parry`, `evasion` (and `speed`, `toHit` if any) |
| ↳ Effect | set `<length>` → `weaponLength` |
| ↳ Effect (light weapons) | add `1` → `lightWeaponsHeld` |
| ↳ Effect (typed weapons) | add `1` → `polearmsHeld` / `heavyPiercingHeld` / `bludgeoningHeld` |
| ↳ **Action** "<Weapon> Attack" | No variable name. Attack roll: the weapon family's formula + `toHit` (8.6). Tags `attackRoll`, `weaponAttack`, `meleeAttack` (+ type attack tag). Resource condition `handsUsed <= hands`, note "Too many hands in use". Attributes consumed: `actionPoints` (the attack's cost, 2 for a moderate attack) and `staminaPoints` (`<stamina cost> + attackStaminaSurcharge`) |
| ↳↳ Branch (on hit) | |
| ↳↳↳ Roll | Variable `weaponDamage` (a Roll's name exists only while its action runs, `linkTypeDependencies.js:242-244`, so copies can't collide). Roll: the weapon's damage formula |
| ↳↳↳ Note | `Deal {weaponDamage} damage. The defender enters it in Incoming Damage and chooses Hit, Partial Parry or PARRY.` plus the weapon's hit-tier rules as text |

Damage reaches the defender by hand (the author's rule): no Damage property, because that would hit HP directly and skip Parry and Mortality.

Drawing and stowing use the base's single **Draw or Stow** action (5.2 General Actions), not one per weapon: an item's child actions are inactive while it's unequipped (`computeInactiveStatus.ts:29-34`), so a Draw action inside a stowed weapon wouldn't show.

A **dagger** adds to `parryWeaponsHeld` with amount `weaponsHeld > 1 ? 1 : 0`, because it gives no Weapon Mastery to Parry when it's your only weapon (p45). Weapons that can't parry (hand axe, work hammer) add nothing to `parryWeaponsHeld` or `canParry`.

### 8.2 Two-handed weapon

Same as 8.1, with Effect add `2` → `handsUsed` and the two-handed bonuses.

### 8.3 Versatile weapon

Same as 8.1 with its **one-handed** values, plus:

| Property | Settings |
|---|---|
| ↳ **Toggle** "Two-handed grip: <weapon name>" | **Show on sheet** on, no condition, no variable name, set to Disabled in the editor |
| ↳↳ Effect | add `1` → `handsUsed` |
| ↳↳ Effects | the **difference** between the two-handed and one-handed bonuses, on each stat that changes |

Worked example, Long sword (p43: "+3 parry (+1 if 1 handed), +2 evasion (no bonus if 1 handed)"): the item adds `+1` parry; the toggle adds `+2` parry and `+2` evasion. Flipping the grip also removes an empty hand, which costs 2 Evasion through `emptyHands`, so the net two-handed Evasion change is 0. That matches the rulebook's per-loadout maths.

For weapons whose **damage** changes with grip (Spear 2D8 / 2D4, Javelin D8 when two-handed), the attack gets one damage Roll per grip under a **choice** branch ("One hand" / "Two hands"), because a toggle can't change a Roll by itself without a variable name.

### 8.4 Shield

| Property | Settings |
|---|---|
| **Item** | Tag `raShield` |
| ↳ Effect | add `1` → `handsUsed`, `canParry` (a shield gives a parry stat, but not Weapon Mastery) |
| ↳ Effects | its bonuses → `parry`, `evasion`, `speed`, or `partialParry` |
| ↳ Effects (if any) | add → `parryStaminaReduction`; set → `parryStaminaFloor` |

Worked examples (p57-58): Buckler: evasion +2, parry +3, `lightWeaponsHeld` +1. Round shield: parry +4, `parryStaminaReduction` + `athletics.modifier`, floor 3. Tear drop: parry +6, evasion −1, speed −2, reduction `2 * athletics.modifier`, floor 5. Tower shield: evasion −5, speed −4, reduction `3 * athletics.modifier`, floor 5, and "+12 parry from attacks coming front on" as a player toggle inside the shield. Parrying dagger: a weapon (8.1) whose parry bonus is `weaponMastery.modifier`, evasion +1, `lightWeaponsHeld` +1.

### 8.5 Body armour

| Property | Settings |
|---|---|
| **Item** | Tag `raBodyArmour` |
| ↳ Effect | add `1` → `bodyArmourWorn` |
| ↳ Effects | add `<armour value>` → `partialParry`; evasion and speed penalties; **max** on `evasion` for heavy armour |
| ↳ Toggle (if it has a requirement) | Condition `athletics < <required>`; folder "You don't meet this armour's Athletics requirement" |

Worked example, Plate (p60): partial parry +12, evasion −5, Effect **max** `8` on `evasion`, speed −2, `attackStaminaSurcharge` +3, `lowStaminaMultiplier` +1, Effect disadvantage `1` → `agility` (ability advantage flows to that ability's checks and skills, `RA_FORK_CHANGES.md`), requirement 14 Athletics, plus notes for its hit-tier rules.

### 8.6 Weapon families (attack roll formulas, rulebook p43-61)

| Family | Attack roll |
|---|---|
| Light weapons | `weaponMastery.modifier + agility.modifier + toHit` |
| Polearms | `2 * weaponMastery.modifier + toHit` |
| Axes and heavy piercing | `weaponMastery.modifier + athletics.modifier + toHit` |
| Bludgeoning | `2 * athletics.modifier + toHit` |
| Bows | `2 * weaponMastery.modifier + toHit` |
| Crossbows | `3 + floor(agility.modifier / 2) + floor(weaponMastery.modifier / 2) + toHit` |
| Firearms | `agility.modifier + weaponMastery.modifier + toHit` |

**Weapon crit chance** (e.g. Halberd +3, bows +½ WM): use Effect add → `critChance` inside the weapon. While held it also raises the other hand's attacks; that is a known approximation. A per-attack version (a before-trigger Roll named `critChance`) might work but is unverified (the audit, section 5).

**Ammunition:** bows and crossbows consume an `raAmmo` item through Attributes consumed → Items, filtered by tag `arrow` or `bolt`. Arrow-type bonuses are applied as one attack per arrow type, or as notes (ammo is chosen after the to-hit is set).

**Crossbow reloading** is left to notes: a "loaded" state would need a variable name inside the item.

## 9. Left to the builder

- Final numbers for every weapon, shield and armour, following the worked examples.
- Each attack's Action Point and stamina cost.
- Which weapons get which family and type tags.
- Folder names and ordering inside the base, as long as variable names and tags match this document.

## 10. Verify on deploy

Build a test character with only the base, then:

1. Point buy feeds the ability attributes, and `.modifier` follows the RA table.
2. Start Turn refills Action Points to full; a Stunned counter of 1 then takes one away.
3. Hit lowers HP and Mortality; healing stops at Mortality; Long Rest regains Mortality first, then HP refills to the **new** Mortality, and Stamina refills fully.
4. Flanking gives an attack tagged `attackRoll` +1 advantage; a spell tagged `attackRoll` gets it too.
5. `critChance` 2 makes an 18 crit.
6. Max HP with no class is 25. With a starting class (D8) at level 3 and Vitality modifier +2: 25 + 8 + 6 = 39, plus Rolled HP. Raising the modifier to +3 makes it 42 (retroactive).
7. Two classes: `level` is their sum; each class's `.level` is separate; only the class with "Starting class" on sets the dice.
8. Evasion rises by 2 per empty hand; equipping a one-handed weapon lowers it by 2 and adds the weapon's own bonus.
9. A versatile Long sword: one hand, then flip the grip: Parry +2 more, net Evasion unchanged, `handsUsed` 2.
10. Two copies of the same weapon equipped: both count, nothing is overwritten.
11. A third weapon: the "too many hands" warning shows and attacks refuse with the note.
12. A shield alone: "No parry stat" clears, Parry = Evasion + shield bonus, no Weapon Mastery.
13. A dagger alone gives no Weapon Mastery to Parry (its Effect amount is `weaponsHeld > 1 ? 1 : 0` on `parryWeaponsHeld`).
14. Two body armours: the warning shows. Plate caps Evasion at 8 and adds 3 stamina to every weapon attack.
15. Tired at half stamina, Exhausted at 0, never both; skills and saves take the penalty.
16. Prepare twice: Parry and Partial Parry +4 until the next Start Turn.
17. Dual-Wield Follow-up refuses with fewer than two weapons held, and shows its note with two.
18. Unconscious at 0 HP: at the next Start Turn, Mortality and HP each drop by 4. Dropping to 0 also costs `25 + 2 × level` stamina and `10 + ½ level` Mortality, once.
19. Scorched 2: at Start Turn, 2d6 damage. Slowed 3: −3 to defences, to-hit and speed.
20. The Traits and Skills slots grow at levels 6, 12, 18 and 24; an upgraded skill uses two Skills places.
21. Draw or Stow costs 1 Action Point.

## 11. Decisions made during review

- **Source of truth:** the 15-11-2026 rulebook, where it disagrees with v2 (2026-11-16).
- **Damage delivery:** entered by hand, as v2 (8.1).
- **Rests:** the rulebook rest rules (5.2).
- **Max HP and Stamina:** the rulebook formulas with class dice; the first class's dice count at level 1; later levels roll the die of the class taken (5.2, 5.3).
- **Action Points:** full refill at turn start; classes add +1s; attacks cost per attack.
- **Drawing and stowing:** a minor action each (8).
- **Spell save DC:** `10 + scm`, unless a spell says otherwise.
- **Shields:** give a parry stat and add to Parry or Partial Parry (8.4).
- **Body armour:** most adds to Partial Parry (8.5).
- **Multiclassing:** allowed but uncommon; class authors follow the rules in 5.3.
- **Casting with full hands:** honour system; the sheet doesn't track free hands for casting (2026-11-16). The quarterstaff's "may cast spells whilst wielding this" (p44) stays as text on the weapon.
- **Opponent-side effects:** the sheet tracks only changes to its own character (2026-11-16).
