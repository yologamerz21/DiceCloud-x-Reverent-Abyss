import { EngineAction } from '/imports/api/engine/action/EngineActions';
import TaskResult from '/imports/api/engine/action/tasks/TaskResult';
import { getPropertiesByFilter } from '/imports/api/engine/loadCreatures';
import getPropertyTitle from '/imports/api/utility/getPropertyTitle';
import numberToSignedString from '/imports/api/utility/numberToSignedString';
import { MORTALITY_HEALTH_TYPE, getMortalityVariableName } from '/imports/constants/RA_HEALTH';

/**
 * Reverent Abyss Mortality rules, see /imports/constants/RA_HEALTH.ts
 * Called from applyDamagePropTask whenever an attribute is damaged, healed or set.
 */

// Attributes that are the active definition of their variable
function isActiveAttribute(prop): boolean {
  return prop.type === 'attribute' && !prop.removed && !prop.inactive && !prop.overridden;
}

/**
 * The value of an attribute after the updates already made earlier in this action.
 * Updates are only written to the creature when the action finishes, so the loaded
 * property can be out of date mid-action.
 */
export function getEffectiveAttributeValue(action: EngineAction, prop): number {
  let value = prop.value ?? 0;
  for (const result of action.results) {
    for (const mutation of result.mutations) {
      for (const update of mutation.updates ?? []) {
        if (update.propId !== prop._id) continue;
        if (update.set && 'value' in update.set) value = update.set.value;
        if (update.inc && 'value' in update.inc) value += update.inc.value;
      }
    }
  }
  return value;
}

// The Mortality attribute a Mortality-type health property is capped by
function getMortalityProp(creatureId: string, healthProp) {
  const variableName = getMortalityVariableName(healthProp);
  return getPropertiesByFilter(
    creatureId,
    prop => isActiveAttribute(prop) && prop.variableName === variableName,
    { type: 'attribute', variableName, removed: { $ne: true } },
  ).find(isActiveAttribute);
}

/**
 * Limit a change to a Mortality-type health property so healing or setting it can't take
 * current HP above Mortality. Returns the value to use instead: a damage increment
 * (negative for healing) or the value to set. Damage is never changed.
 */
export function capToMortality(
  action: EngineAction, creatureId: string, healthProp, operation: 'increment' | 'set', value: number
): number {
  if (healthProp?.attributeType !== MORTALITY_HEALTH_TYPE) return value;
  if (!Number.isFinite(value)) return value;
  const mortalityProp = getMortalityProp(creatureId, healthProp);
  if (!mortalityProp) return value;
  const mortality = getEffectiveAttributeValue(action, mortalityProp);

  if (operation === 'set') {
    return Math.min(value, mortality);
  }
  // Only healing (a negative damage increment) is limited
  if (value >= 0) return value;
  const current = getEffectiveAttributeValue(action, healthProp);
  // Heal at most up to Mortality, and never turn healing into damage
  const maxHealing = Math.min(0, current - mortality);
  return Math.max(value, maxHealing);
}

/**
 * After an attribute changes, if it is the Mortality of any Mortality-type health property
 * and is now below that property's current HP, pull the current HP down to match.
 * This writes the update directly instead of applying damage, so damage triggers don't
 * fire for it and libraries can't loop between HP damage and Mortality loss.
 */
export function pullDownToMortality(
  action: EngineAction, result: TaskResult, creatureId: string, changedProp
) {
  if (!isActiveAttribute(changedProp) || !changedProp.variableName) return;
  const isLinkedHealth = prop => isActiveAttribute(prop)
    && prop.attributeType === MORTALITY_HEALTH_TYPE
    && getMortalityVariableName(prop) === changedProp.variableName;
  // The mongo filter is only used when the creature isn't loaded, filter again either way
  const healthProps = getPropertiesByFilter(
    creatureId,
    isLinkedHealth,
    { type: 'attribute', attributeType: MORTALITY_HEALTH_TYPE, removed: { $ne: true } },
  ).filter(isLinkedHealth);
  if (!healthProps.length) return;
  const mortality = getEffectiveAttributeValue(action, changedProp);
  for (const healthProp of healthProps) {
    const current = getEffectiveAttributeValue(action, healthProp);
    const excess = current - mortality;
    if (!(excess > 0)) continue;
    result.mutations.push({
      targetIds: [creatureId],
      updates: [{
        propId: healthProp._id,
        inc: { damage: excess, value: -excess },
        type: healthProp.type,
      }],
      contents: [{
        name: `${getPropertyTitle(healthProp)} capped by ${getPropertyTitle(changedProp)}`,
        value: `${numberToSignedString(-excess)} ${getPropertyTitle(healthProp)}`,
        inline: true,
      }],
    });
    // Keep the acting creature's scope in step, like applyDamagePropTask does
    if (creatureId === action.creatureId && healthProp.variableName && !healthProp.overridden) {
      if (!result.scope) result.scope = {};
      const value = current - excess;
      result.scope[healthProp.variableName] = {
        ...EJSON.clone(healthProp),
        value,
        damage: (healthProp.total || 0) - value,
      };
    }
  }
}
