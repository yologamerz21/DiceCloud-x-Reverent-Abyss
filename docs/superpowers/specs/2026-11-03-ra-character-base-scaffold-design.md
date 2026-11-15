# RA Character Base v3 and Armoury: scaffold blueprint

Date: 2026-11-03
Status: draft for review

## 1. Intent

Reverent Abyss (RA) characters are built from in-app DiceCloud library content. The current design, **R.A: Character Base v2**, was made in upstream DiceCloud before this fork existed. It hand-built several systems the fork now does in code (2d10 rolls, stacking advantage, crits, the stat table, turn buttons, Mortality health).

This blueprint rebuilds that base for the fork, adds the agreed equipment and wielding rules, and defines a separate **RA Armoury** library of weapons, shields and armour. It is a **scaffold**: a stable skeleton with named hooks. The next step after building it is to go through every class and work out which hooks each needs; races, traits and classes plug in through slots and never edit the base.

The author will build everything by hand in the fork's library editor once the app is deployed. So this document lists every property with its type, variable name, formula and tags.

## 2. Goals, non-goals, anti-goals

**Goals**
- The base works on its own, with nothing in its slots.
- Content joins only through slots (race, traits, class) or the Inventory (Armoury items). Adding or removing any of it never means editing the base.
- Every value other content may touch has a stable variable name or tag, listed in the hook registry (section 7).
- Levels come from classes, not the base.
- Weapons and armour live in their own library, and players pick what they want.

**Non-goals (for this scaffold)**
- Designing any race, trait or class.
- Final numbers for weapons and armour (Parry bonuses, armour values). Templates use placeholders.
- Spells and spell lists. Spell attacks only need the `attackRoll` and `spellAttack` tags (section 6); the spell-attack bonus formula is left to the class phase (v2's `spellAttackBonus` and `scm` were never defined).

**Anti-goal (the author's hard line)**
- **Nothing in this blueprint may need something the engine can't do.** Every mechanism below is checked against the fork's source (section 3). Anything not yet confirmed in a running app is marked *verify on deploy* and listed in section 10.

## 3. Engine constraints this design respects

Checked in the fork's source on branch `ra/turn-buttons`. Paths are under `app/imports/`.

| What the engine can do | Source |
|---|---|
| An item's children (effects, toggles, actions) are active only while the item is equipped and its quantity isn't 0 | `api/engine/computation/buildComputation/computeInactiveStatus.ts:29-34` |
| Effects can `add`, `set` (highest wins), `min`, `max`, `mul`, `base`, `advantage`, `disadvantage` | `api/properties/Effects.ts:19-31`, `aggregate/aggregateEffect.js` |
| Advantage/disadvantage Effects stack numerically and can target an attack action by tag | `RA_FORK_CHANGES.md` "Granting advantage" |
| The attacker's crit target is `20 − critChance`, read from a variable named `critChance` | `RA_FORK_CHANGES.md` scope variables |
| Attribute type `mortalityHealth` caps HP by a linked `mortality` attribute | `api/properties/Attributes.ts:27-37`, `RA_FORK_CHANGES.md` |
| Triggers fire on `turnStart`, `turnEnd`, `shortRest`, `longRest`, `anyRest`, `doActionProperty`, `check`, `damageProperty` | `api/properties/Triggers.ts:7-21` |
| `classLevel` properties sum into a creature-wide `level` and into `<classVariable>.level` | `api/engine/computation/buildComputation/linkTypeDependencies.js:123-134` |
| A toggle with **Show on sheet** and no condition is a player switch | `api/properties/Toggles.ts`, `flipToggle.js:26-29` |
| An action with a false resource condition refuses to run and shows its note | `computeAction.ts:14-20`, `applyActionProperty.ts:59-67` |

What library content **can't** do, so the design avoids it:
- Change whether an item is equipped, flip a toggle, or move an item from an action. Only attribute values, action uses, item quantity and buffs can be written.
- Block equipping. Rule breaks are **flagged**, never blocked (the author's chosen rule).
- Count or sum across items in a formula. Totals are built "push" style: each item's own Effect adds into a shared attribute.
- Keep separate state for two copies of one item. Variable names are creature-wide, so **Armoury items define no variable names** (section 8).
- Reliably read `#item.x` inside attack or damage rolls while the action runs (likely unresolved). The design never does this; `#item` is not used at all.

## 4. Library layout

Three libraries (names are my call):

| Library | Contains | How it reaches a character |
|---|---|---|
| **RA Core** | The character base folder (section 5) | Fills the character's **Ruleset** slot (slot tag `base`) |
| **RA Armoury** | Weapon, shield and body-armour item templates (section 8) | Player adds items to their Inventory from the library |
| **RA Races / Traits / Classes** (later) | Ancestry, trait and class content | Fills the Race, Traits and Class slots inside the base |

The character itself keeps two things outside the base, as today:
- A **Ruleset** property slot at the root, slot tags `base`, quantity 1.
- The **Inventory** folder with **Equipment** and **Carried** subfolders. The equip switch moves items into the folder tagged `equipment` or `carried`, so those two subfolders must carry those tags. *Verify on deploy* that new characters get them.

The RA Core library node for the base folder: **Can fill slots** on, library tags `base`.

## 5. RA Core: the base tree

Each block lists the properties in tree order. "Drop" means remove it from v2 because the fork now does the job.

### 5.1 What changes from v2

| v2 part | v3 | Why |
|---|---|---|
| Attack Rolling Engine (Attack Roll and Spell Attack Roll triggers, their rolls, crit branches and notes; Net Advantage; Advantage Count; Disadvantage Count) | **Drop** | The fork rolls 2d10 with stacking advantage and crits on every attack |
| Stat Thresholds and Stat Modifiers constants; all eight Tier and eight Modifier attributes | **Drop** | Ability attributes get the RA table modifier as `.modifier` |
| Turn Start and Turn End actions | **Drop**; replaced by a `turnStart` trigger | The sheet has built-in Start Turn and End Turn buttons |
| Critical Hit Target, Critical Chance Bonus | **Replace** with one attribute `critChance` | The fork reads `critChance` |
| Lost Max HP and its HP Reduction effect | **Replace** with the `mortality` attribute | Mortality health does this natively |
| Weapon-type toggles reading `weaponType` | **Change** to per-type counts | One `weaponType` value breaks with two weapons held |
| Formulas using `athleticsMod` etc. | **Change** to `athletics.modifier` etc. | The Mod attributes are dropped |
| `level` in rest formulas | Keep the name; it now comes from class levels | Levels belong to classes |
| Rest formulas | **Change** to the current RA rest rules (5.2 Rests) | v2's formulas were older |

### 5.2 Folder: Base System

**HP and Stamina**

| Property | Type | Variable | Value / formula | Notes |
|---|---|---|---|---|
| Hit Points | Attribute, **Mortality health** | `hitPoints` | Base `trueMaxHp`; Mortality attribute `mortality` | Reset: Long rest (see Rests) |
| Mortality | Attribute, resource | `mortality` | Base `hitPoints.total` | Leave Reset blank. Lower it only with Adjustments |
| Stamina Points | Attribute, health bar | `staminaPoints` | Base `trueMaxSTA` | Reset: Long rest |
| True Max HP | Attribute, stat | `trueMaxHp` | Base `25 + vitality.modifier * max(level - 1, 0)` | The RA HP rule: 25, plus the Vitality modifier for every level after the first. It's recalculated whenever the modifier changes, so it applies retroactively. Classes and races can add to it with Effects |
| True Max STA | Attribute, stat | `trueMaxSTA` | Base `30` | Classes and races add to it with Effects |
| Rolled HP | Attribute, resource | `rolledHP` | Base `0`; child Effect **add** `rolledHP` → `trueMaxHp` | The running total of the HP rolls, one per level after the first. The player adds each new roll when they level up. An Effect can't store a dice roll (it would re-roll every time the sheet recalculates), so the roll is kept here by hand |
| Rolled STA | Attribute, resource | `rolledSTA` | Base `0`; child Effect **add** `rolledSTA` → `trueMaxSTA` | As v2 |
| Max HP Damage Reduction | Attribute, utility | `maxHpDamageReduction` | Base `0` | Hook |

**Long and Short Rests**

| Property | Type | Settings |
|---|---|---|
The RA rest rules (from the author):
- **Short rest:** heal HP equal to (level + Vitality) twice, and regain Stamina equal to level × (Athletics + Vitality).
- **Long rest:** restore all HP and Stamina, and regain Mortality equal to ½ level + Vitality, minimum 3.

"Vitality" and "Athletics" here mean the stat modifiers, as in v2's formulas.

| Property | Type | Settings |
|---|---|---|
| Short Rest | Trigger | Event Short rest, timing After, silent |
| ↳ Adjustment | Adjustment | Target self, `hitPoints`, increment, amount `-max(2 * (level + vitality.modifier), 0)` (a negative amount heals; the HP heal stops at Mortality on its own) |
| ↳ Adjustment | Adjustment | Target self, `staminaPoints`, increment, amount `-max(level * (athletics.modifier + vitality.modifier), 0)` |
| ↳ Note | Note | `You have regained {max(2 * (level + vitality.modifier), 0)} HP and {max(level * (athletics.modifier + vitality.modifier), 0)} Stamina` (v2's note was an empty placeholder) |
| Long Rest | Trigger | Event Long rest, timing **Before**, silent |
| ↳ Adjustment | Adjustment | Target self, **`mortality`**, increment, amount `-max(floor(level / 2) + vitality.modifier, 3)` (a negative amount regains Mortality) |
| ↳ Note | Note | `You have regained {max(floor(level / 2) + vitality.modifier, 3)} Mortality` |

Set **Hit Points** and **Stamina Points** to **Reset: Long rest**, and leave Mortality's Reset blank. The Long Rest trigger runs **Before** so Mortality is regained first. The engine then resets HP and Stamina, and the HP refill goes through the same path as healing, so it stops at the new Mortality (`applyResetTask.ts:29-39`, resets use the `damageProp` task). The `max(…, 0)` floors stop a negative modifier from turning a rest into damage.

With no class, `level` is 0, so a short rest heals only from Vitality and a long rest regains at least 3. That is expected for an empty base.

**Turn Management**

| Property | Type | Settings |
|---|---|---|
| Action Point Recharge | Trigger | Event **Turn start**, timing After, silent |
| ↳ Adjustment | Adjustment | Target self, `actionPoints`, increment, amount `-actionRechargeRate` (refills up to the max; the engine clamps at the total) |

**Stats** (folder, as v2 minus the Modifiers folder)

| Property | Type | Variable |
|---|---|---|
| Base Stat Selection | Point buy | Rows as v2: `athletics`, `agility`, `vitality`, `weaponMastery`, `intelligence`, `wisdom`, `charisma`, `spellCastingAbility` |
| Athletics … Spell Casting Ability (8) | Attribute, **ability** (was stat) | Same variable names |

Read modifiers as `athletics.modifier`, `agility.modifier`, and so on. *Verify on deploy* that the point-buy rows still feed the ability attributes as they did in v2.

**Combat**

| Property | Type | Variable | Formula |
|---|---|---|---|
| Action Points | Attribute, resource | `actionPoints` | Base `3`, Reset blank |
| Action Recharge Rate | Attribute, utility | `actionRechargeRate` | `3` |
| Speed | Attribute, stat | `speed` | `5 + athletics.modifier` |
| Initiative Bonus | Attribute, modifier | `initiative` | `agility.modifier + wisdom.modifier` |
| Hit Bonus | Attribute, modifier | `toHit` | `0` |
| Crit Chance | Attribute, utility | `critChance` | `0` (each point lowers the crit target by 1) |

**Situational Modifiers** (folder under Combat)

| Property | Type | Settings |
|---|---|---|
| Flanking | Toggle, Show on sheet, off by default | Child Effect **advantage**, value `1`, target tag `attackRoll` |
| Ranged with Adjacent Enemy | Toggle, Show on sheet, off by default | Child Effect **disadvantage**, value `3`, target tag `rangedAttack` |
| Generic Advantage | Attribute, resource, `otherAdvantage`, base 0 | Child Effect **advantage**, value `otherAdvantage`, target tag `attackRoll` |
| Generic Disadvantage | Attribute, resource, `otherDisadvantage`, base 0 | Child Effect **disadvantage**, value `otherDisadvantage`, target tag `attackRoll` |
| Generic Crit Chance | Attribute, resource, `otherCritChance`, base 0 | Child Effect **add** `otherCritChance` → `critChance` |

**Every Effect in this document that targets attacks by tag must have its Target field set to `attackRoll`.** Left blank, the engine picks a default field per property type: `attackRoll` for Actions but nothing for Spells, so spell attacks would silently miss the bonus (`getDefaultCalculationField` in `linkTypeDependencies.js`). This applies to the four tag Effects above and to the Exhausted disadvantage in 5.5.

**Defensive Stats**

| Property | Type | Variable | Formula |
|---|---|---|---|
| Evasion | Attribute, stat | `evasion` | `4 + agility.modifier` |
| Can Parry | Attribute, utility | `canParry` | `0`. Each equipped weapon adds 1 |
| Parry | Attribute, stat | `parry` | `evasion + (canParry > 0 ? weaponMastery.modifier : 0)`. Equipped weapons add their Parry bonus with Effects |
| Partial Parry | Attribute, stat | `partialParry` | `parry`. Shields and most body armour add to it with Effects |

This is the agreed Parry rule: base Parry only counts with a weapon equipped, and every held weapon's bonus adds on top, so bonuses from both hands sum.

Because Partial Parry starts from Parry, anything that raises Parry also raises Partial Parry. A bonus aimed at `partialParry` raises only Partial Parry.

**Wielding** (new folder)

| Property | Type | Variable | Formula / settings |
|---|---|---|---|
| Hands | Attribute, stat | `hands` | `2` |
| Hands Used | Attribute, utility | `handsUsed` | `0`. Equipped weapons and shields add to it |
| Body Armour Worn | Attribute, utility | `bodyArmourWorn` | `0`. Equipped body armour adds 1 |
| Too Many Hands | Toggle (computed, not shown as a switch) | — | Condition `handsUsed > hands`; child folder named "You are holding more than you have hands for" (same pattern as v2's "You are tired") |
| Too Much Armour | Toggle (computed) | — | Condition `bodyArmourWorn > 1`; child folder named "You are wearing more than one body armour" |

Over the hand limit, every weapon attack also refuses to run (section 8). The equip itself is never blocked.

**Damage Engine** (as v2, with Mortality)

| Property | Changes from v2 |
|---|---|
| Incoming Damage (`incomingDamage`, resource) | None |
| Parry Stamina Reduction (`parryStaminaReduction`, utility) | None |
| **Hit** action | Max Hp Lost roll: replace `hitPoints.total / 2` with `mortality / 2` (keeps v2's meaning: v2's total was the reduced max). Second Adjustment targets **`mortality`** instead of `lostMaxHp`. Heavy Blow branch condition: `hpTaken >= mortality / 2`, and **move the branch above the Adjustments** so it measures against Mortality before this blow, the same value the roll used. |
| **Partial Parry** action | Same changes. **Fix:** the Stamina Lost roll is named `stamTakenCopy` but the Adjustment and note read `stamTaken`; rename the roll's variable to `stamTaken`. |
| **PARRY** action | None |

### 5.3 Folder: Character Setup (the slots)

| Slot | Slot type | Slot tags | Quantity |
|---|---|---|---|
| Race | any | `race`, `reverentAbyss` | 1 |
| Traits | any | `characterTrait` | 3 (as v2) |
| Class | **Class** | `reverentAbyss`, `class` | unlimited (0), because multiclassing is allowed |

All three slots keep v2's uniqueness setting **Unique in slot**, so the same trait can't be taken twice, and the same class can't be added twice.

Levels: each class ships as a **Class** property with a variable name (for example `warden`), and its levels as **Class Level** properties with the same variable name. The engine sums them into `level` and `warden.level` (`linkTypeDependencies.js:123-134`). The base reads only `level`, the total across all classes, so a multiclassed character needs nothing extra from the base.

Rules for class authors, so multiclassing works without changes later:
- Each class has its **own unique** variable name.
- A class's features check that class's own level (`warden.level >= 3`), never `level`.
- Anything tied to character level (HP, rests) stays in the base and reads `level`. "The first level" in the HP rule means the character's first level, whichever class it came from.

### 5.4 Folder: Persona

Unchanged: Description, Personality Traits, Ideals, Bonds, Flaws notes.

### 5.5 Folder: System Debuffs and Buffs

| Toggle | Condition | Children |
|---|---|---|
| Tired Check (`tiredCheck`) | `(staminaPoints.value <= staminaPoints.total / 2) && (staminaPoints.value > 0)` (as v2, so Tired and Exhausted never overlap) | Effect add `-2` → `evasion`, `parry`, `toHit`; folder "You are tired" |
| Exhausted Check | `staminaPoints.value == 0` (v2 used a single `=`; use `==`) | Effect add `-4` → `evasion`, `parry`, `toHit`; Effect **disadvantage** `1`, target tag `attackRoll`, Target field `attackRoll`; folder "You are exhausted" |

Because Parry is built from Evasion, the −2 to both means Parry drops by 4 while Tired (−8 while Exhausted). That is v2's behaviour, kept as is.

### 5.6 Folder: Weapon Type Passives

| Property | Type | Settings |
|---|---|---|
| Weapon Length | Attribute, stat, `weaponLength` | `0`. Each weapon uses an Effect **set** (the highest wins, so the longest held weapon counts) |
| Polearms Held | Attribute, utility, `polearmsHeld` | `0` |
| Heavy Piercing Held | Attribute, utility, `heavyPiercingHeld` | `0` |
| Bludgeoning Held | Attribute, utility, `bludgeoningHeld` | `0` |
| Polearms | Toggle, condition `polearmsHeld > 0` | Child: Polearm: Defensive Manoeuvre action as v2 (damage `athletics.modifier`) |
| Heavy Piercing | Toggle, condition `heavyPiercingHeld > 0` | Children: the two v2 triggers unchanged (tags `attackRoll` + `greatAxe`; `attackRoll` + `heavyPiercingAttack` NOT `greatAxe`) |
| Bludgeoning | Toggle, condition `bludgeoningHeld > 0` | Child: the v2 trigger unchanged (tags `attackRoll` + `bludgeoningAttack`) |

A new weapon type later means one more counter, one more toggle, and the tag on its weapons.

## 6. Tags

Every attack action, from any source, carries `attackRoll`. Add one of each pair that applies:

| Tag | Meaning |
|---|---|
| `attackRoll` | Every attack. Situational advantage, exhaustion and weapon-type triggers target this |
| `weaponAttack` / `spellAttack` | Weapon or spell attack |
| `meleeAttack` / `rangedAttack` | Melee or ranged |
| `greatAxe`, `heavyPiercingAttack`, `bludgeoningAttack` | Weapon-type attacks (v2 names kept) |

Armoury items carry `raWeapon`, `raShield` or `raBodyArmour`.

## 7. Hook registry (for race, trait, class and Armoury authors)

Target these by variable name with Effects, or with Adjustments for current values.

| Area | Variables |
|---|---|
| Stats | `athletics`, `agility`, `vitality`, `weaponMastery`, `intelligence`, `wisdom`, `charisma`, `spellCastingAbility` (and their `.modifier`) |
| Health | `trueMaxHp`, `trueMaxSTA`, `rolledHP`, `rolledSTA`, `hitPoints`, `mortality`, `staminaPoints`, `maxHpDamageReduction` |
| Turn economy | `actionPoints`, `actionRechargeRate` |
| Offence | `toHit`, `critChance`, `otherAdvantage`, `otherDisadvantage`, `otherCritChance` |
| Defence | `evasion`, `canParry`, `parry`, `partialParry`, `parryStaminaReduction` |
| Wielding | `hands`, `handsUsed`, `bodyArmourWorn`, `weaponLength`, `polearmsHeld`, `heavyPiercingHeld`, `bludgeoningHeld` |
| Movement | `speed`, `initiative` |
| Damage engine | `incomingDamage` |
| Levels (read only) | `level`, `<classVariable>.level` |
| Slots | Race (`race` + `reverentAbyss`), Traits (`characterTrait`), Class (`class` + `reverentAbyss`) |

## 8. RA Armoury templates

**Rule for every Armoury item: no variable names anywhere inside it**, not on the item's actions, toggles or anything else (the damage Roll in 8.1 is the one safe exception). That is what lets a player carry two copies of the same weapon without them overwriting each other. Everything an item contributes goes through Effects into the base's shared attributes, and those Effects only count while the item is equipped.

"Equipped" means **in hand** for weapons and shields and **worn** for armour. There is no separate drawn or stowed state; drawing, stowing and changing grip are free.

Library nodes: **Searchable** on, library tag `raArmoury`.

### 8.1 One-handed weapon

| Property | Settings |
|---|---|
| **Item** (e.g. Arming Sword) | Tags `raWeapon` (+ type tag if any). Weight and value as wanted |
| ↳ Effect | add `1` → `handsUsed` |
| ↳ Effect | add `1` → `canParry` |
| ↳ Effect | add `<Parry bonus, one hand>` → `parry` |
| ↳ Effect | set `<length>` → `weaponLength` |
| ↳ Effect (only for typed weapons) | add `1` → `polearmsHeld` / `heavyPiercingHeld` / `bludgeoningHeld` |
| ↳ **Action** (e.g. "Arming Sword Attack") | No variable name. Attack roll `weaponMastery.modifier + toHit`. Tags `attackRoll`, `weaponAttack`, `meleeAttack` (+ type attack tag). Resource condition `handsUsed <= hands`, note "Too many hands in use". Action point cost in Attributes consumed: `actionPoints`, quantity set per attack (each attack has its own cost) |
| ↳↳ Branch (on hit) | |
| ↳↳↳ Roll | A Roll always has a variable name (`Rolls.ts:31-37`); call it `weaponDamage`. This is the one allowed exception to "no variable names": a Roll's name exists only while its action runs and never becomes a creature variable (`linkTypeDependencies.js:242-244`), so copies can't collide. Roll: the weapon's damage formula |
| ↳↳↳ Note | `Deal {weaponDamage} damage. The defender enters it in Incoming Damage and chooses Hit, Partial Parry or PARRY.` |

Damage reaches the defender by hand, as in v2 (the author's rule): the attack never uses a Damage property, because that would hit the defender's HP directly and skip Parry and Mortality.

### 8.2 Two-handed weapon

Same as 8.1, with Effect add `2` → `handsUsed` and the two-handed Parry bonus.

### 8.3 Versatile weapon

Same as 8.1 (one hand, one-handed Parry bonus), plus:

| Property | Settings |
|---|---|
| ↳ **Toggle** "Two-handed grip: <weapon name>" | **Show on sheet** on, no condition, no variable name, set to Disabled in the editor (a toggle with a condition can't be flipped by the player). The weapon name tells two equipped switches apart |
| ↳↳ Effect | add `1` → `handsUsed` |
| ↳↳ Effect | add `<two-handed bonus − one-handed bonus>` → `parry` |

Flipping the switch moves the weapon from one hand to two and raises its Parry. Damage doesn't change (the agreed rule). The switch only counts while the weapon is equipped.

### 8.4 Shield

| Property | Settings |
|---|---|
| **Item** | Tag `raShield` |
| ↳ Effect | add `1` → `handsUsed` |
| ↳ Effect | add `<shield value>` → `parry` **or** `partialParry`, depending on the shield |

A shield doesn't add to `canParry`, so on its own it doesn't switch on base Parry; only a weapon does. A shield aimed at `parry` also raises Partial Parry (5.2 Defensive Stats).

### 8.5 Body armour

| Property | Settings |
|---|---|
| **Item** | Tag `raBodyArmour` |
| ↳ Effect | add `1` → `bodyArmourWorn` |
| ↳ Effect | add `<armour value>` → `partialParry` (most armour; leave it out for armour that doesn't) |
| ↳ Effects | Any other effect a particular armour has |

## 9. Left to the builder

- Exact Parry bonuses, shield and armour values, weapon lengths and damage per weapon.
- Each attack's action point cost.
- Whether each shield adds to Parry or Partial Parry.
- Which weapons get which type tags.
- Folder names and ordering inside the base, as long as variable names and tags match this document.

## 10. Verify on deploy

Build a test character with only the base, then:

1. Point buy feeds the ability attributes and `.modifier` follows the RA table.
2. Start Turn refills Action Points by the recharge rate, capped at the max.
3. Hit lowers HP and Mortality; healing stops at Mortality; Long Rest regains Mortality.
4. Flanking gives an attack tagged `attackRoll` +1 advantage in the roll prompt.
5. `critChance` 2 makes an 18 crit.
6. Add a versatile weapon from the Armoury into the Inventory (confirm that flow), equip it: `handsUsed` 1, Parry up. Flip "Two-handed grip": `handsUsed` 2, Parry higher.
7. Add a second copy of the same weapon and equip both: both count, nothing is overwritten.
8. Equip a third weapon: the "too many hands" folder appears and attacks refuse with the note. Check how a refused action looks on the sheet.
9. Equip two body armours: the warning appears.
10. A polearm turns on the Polearms toggle; unequipping it turns it off.
11. `staminaPoints.value == 0` turns on Exhausted (confirms `==`).
12. Long rest on a wounded character with lost Mortality: Mortality goes up first, then HP refills to the **new** Mortality, not the old one, and Stamina refills fully.
13. A weapon attack's note shows the rolled damage, with two copies of the weapon equipped.
14. A spell tagged `attackRoll` gets Flanking's advantage (confirms the Target field setting).
15. Max HP: with no class it's 25; add two class levels and a Vitality modifier of +2, and it's 27 plus Rolled HP. Raise the modifier to +3 and it becomes 28 (retroactive).
16. Add two different classes: `level` is their sum, and each class's own `.level` is separate.
17. Equip a shield that adds to Partial Parry: only Partial Parry goes up, and Parry doesn't switch on without a weapon.

## 11. Decisions made during review

All earlier open questions are answered:
- **Damage delivery:** entered by hand, as v2 (8.1).
- **Rests:** follow the current RA rest rules (5.2).
- **Shields:** add to Parry or Partial Parry, depending on the shield (8.4).
- **Body armour:** most adds to Partial Parry (8.5).
- **Multiclassing:** allowed but uncommon. The Class slot is unlimited, and class authors follow the rules in 5.3.
- **Action points:** attacks cost them, and the cost differs per attack (8.1).
- **Max HP:** 25 + Vitality modifier × (level − 1), applied retroactively, plus one rolled amount per level after the first (5.2).
