# Reverent Abyss fork: handoff (2026-10-11)

Paste this into a new chat to continue. This file is local and untracked. Delete it, or commit it, as you like.

## Where things stand

- **Repo:** `X:\Dicecloud Clone\DiceCloud` (Meteor 2.16 app in `app/`)
- **Fork (mainline):** https://github.com/yologamerz21/DiceCloud-x-Reverent-Abyss
- **Tier 1 is merged** via PR #1 (merge commit `c99422f4`). The fork's mainline branch is now **`ra-main`** (the old `develop` was renamed). PR #2 (ARM deploy kit for Oracle A1, `deploy/arm-poc/`) and PR #3 (bundle build timeout fixes, `.github/workflows/build-bundle.yml`) are merged too; neither changes app code.
- **Local `ra-main`** is at `0bb32320` (2026-10-21) and tracks `origin/ra-main`.
- **Tests:** 130/130 server tests pass on the merged code. Upstream `develop` had 105/105, so there are no pre-existing failures.
- **What changed and why:** see `RA_FORK_CHANGES.md` at the repo root. It lists every file, the new scope variables, how library authors grant advantage, and the merge-conflict hotspots.

### Remotes

| Remote | Repo | Use |
|---|---|---|
| `origin` | `yologamerz21/DiceCloud-x-Reverent-Abyss` | push, PRs, `ra-main` |
| `upstream` | `ThaumRystra/DiceCloud` | DiceCloud updates only. **Never open PRs here.** |

### Git identity

Commits on the fork are authored as `yologamerz21 <47621604+yologamerz21@users.noreply.github.com>`. The repo's git config still says `YoloRegime2 <dazattoh@outlook.com>`, so set `user.name` and `user.email` in this repo before committing new work.

### Leftover local branches

`ra/2d10-core` (merged) and `ra/2d10-core-backup-yolo` (a backup taken before re-authoring) are safe to delete.

## What Tier 1 implemented

- **2d10 core roll** for attacks, checks and saves through `app/imports/api/engine/action/functions/rollCoreDice.ts`. The config lives in `app/imports/constants/RA_DICE.ts`.
- **Numeric, stacking advantage.** Net N rolls `2 + |N|` d10 and keeps the 2 highest or lowest. N is clamped to ±10. Effects sum their amount, and a blank amount counts as 1.
- **Crits** on a kept sum ≥ `20 − critChance`. There are no crit misses. The `~criticalHitTarget` and `~criticalMissTarget` overrides still apply.
- **Saves** show the same advantage prompt as checks and attacks.
- **AdvantageStepper.vue** replaces the advantage toggle in the advantage and check prompts.
- **RA ability modifiers** use the stat table in `app/imports/constants/RA_ABILITY.ts`: highest threshold met, −4 below 2, capped at +15 from 70. The modifier is calculated in one place, `computeVariableAsAttribute.js`.
- **Bug fix:** actions counted advantage effects twice (`computeCalculation.js`). Upstream has the same bug.

## Open issues / next steps

1. **Check rolls may not add the stat's modifier.** Reported, but not yet diagnosed. In one case the check prompt opened with the Ability and Skill dropdowns blank, and the roll added no bonus. My own Athletics check did add its bonus, so the cause depends on which button starts the check. Leads:
   - `CheckInput.vue` builds its dropdown options from `this.value.prop.root.id`, but a check task has no `prop`. That's likely why the dropdowns are blank, and it may lose the selected ability or skill.
   - For an ability card, `AttributeCardContent.vue` passes `skillVariableName: model.variableName` and `abilityVariableName: model.ability`, which is backwards for abilities. Compare with `AbilityListTile.vue`.
   - A check dialog once opened on its own when the character sheet loaded. The cause is unknown.
   - First step: reproduce from each roll button (ability tile, ability card, skill, save) and note which one drops the modifier.
2. **Unverified UI:** the Effect form's Value field for Advantage and Disadvantage, and its new help text, haven't been checked in a browser.
3. **Out of scope for Tier 1:**
   - tiered hit outcomes (evade, parry, partial parry);
   - defender-side advantage and crit modifiers;
   - crit damage mode;
   - `kh`/`kl` dice grammar;
   - deterministic `reroll`/`explode`;
   - passive score UI (still `10 + value`);
   - the Meteor upgrade;
   - library and data changes.

## How to test (Docker; Meteor is not installed on Windows)

The image `dicecloud-test:2.16` (Ubuntu + Meteor 2.16) is already built, and its Dockerfile and `run-tests.sh` are in the Claude scratchpad. The script clones the repo read-only from `/src`, runs `meteor npm ci`, then runs `TEST_CLIENT=0 meteor test --once --driver-package meteortesting:mocha` on each branch you name. It **tests committed code only**, so commit before running.

```
docker run --rm -v "X:\Dicecloud Clone\DiceCloud:/src:ro" -v "<out dir>:/out" dicecloud-test:2.16 ra-main ra-main
```

Pass the branch twice. The first run is cold and can time out on a `before all` hook, which then cascades into other suites; only the warm second run counts.

## How to run the app

Run this in PowerShell. It builds from `ra-main`:

```
docker run -it --rm --name dicecloud-dev -p 3000:3000 -p 3003:3003 -e HMR_URL=localhost:3003 -v "X:\Dicecloud Clone\DiceCloud:/src:ro" -v dicecloud-work:/work --entrypoint bash dicecloud-test:2.16 -c '[ -d /work/.git ] || git clone -q /src /work; cd /work && git fetch -q origin ra-main && git checkout -q -B ra-main FETCH_HEAD && cd app && printf ''{\x22public\x22:{\x22disablePatreon\x22:true}}'' > /tmp/settings.json && meteor npm ci --no-audit --no-fund && meteor run --port 3000 --settings /tmp/settings.json'
```

- **Port 3003 and `HMR_URL` are required.** Without them, component CSS never loads and dialogs render off-centre.
- **Settings go in a file** via `printf` with `\x22`, because Windows PowerShell strips inner double quotes from inline `METEOR_SETTINGS` JSON.
- **Keep the `dicecloud-work` volume.** It holds the local account, characters and build cache; its clone's `origin` is your local repo, so switching branches needs no reset.
- **Local data:** there's a local account you created, and a test character, "RA 2d10 Test", which has abilities, skills, three advantage effects on Athletics, an attack and a save action.

## Environment notes

- **C: drive:** it ran out of space once. Docker's data disk now lives on X:. Keep an eye on free space on C:.
- **Hung Docker:** if Docker Desktop hangs (commands don't respond), quit it from the tray and start it again.
- **`gh` CLI:** not installed. Open PRs in the browser, and on the compare page check that the base repository is the fork, not ThaumRystra/DiceCloud.
- **Upstream merges:** `git fetch upstream`, then `git merge upstream/develop` on `ra-main`, then check the hotspots in `RA_FORK_CHANGES.md`.
