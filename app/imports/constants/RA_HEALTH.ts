/**
 * Reverent Abyss health: the "Mortality" attribute type
 *
 * A Mortality attribute tracks current HP. Its total (base value plus effects) is the
 * True Maximum HP. It links by variable name to an ordinary attribute holding the
 * creature's Mortality, which caps current HP:
 * - healing or setting current HP can't take it above Mortality
 * - when Mortality drops below current HP, current HP is pulled down to match and stays there
 * - current HP can go negative
 * Everything else (damage maths, rests, death) is left to libraries.
 */
export const MORTALITY_HEALTH_TYPE = 'mortalityHealth';

// Variable name of the Mortality attribute when the property doesn't name one
export const DEFAULT_MORTALITY_VARIABLE = 'mortality';

// Attribute types that take damage and healing like a health bar
export function isHealthBarType(attributeType: string | undefined): boolean {
  return attributeType === 'healthBar' || attributeType === MORTALITY_HEALTH_TYPE;
}

// Can this attribute's value go below zero
export function allowsNegativeValue(prop: { attributeType?: string, ignoreLowerLimit?: boolean }): boolean {
  return !!prop.ignoreLowerLimit || prop.attributeType === MORTALITY_HEALTH_TYPE;
}

export function getMortalityVariableName(prop: { mortalityVariableName?: string }): string {
  return prop.mortalityVariableName || DEFAULT_MORTALITY_VARIABLE;
}
