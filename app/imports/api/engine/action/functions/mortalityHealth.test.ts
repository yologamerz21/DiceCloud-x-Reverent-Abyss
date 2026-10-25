import { assert } from 'chai';
import {
  allLogContent,
  allUpdates,
  createTestCreature,
  getRandomIds,
  removeAllCreaturesAndProps,
  runActionById,
  TestCreature
} from '/imports/api/engine/action/functions/actionEngineTest.testFn';

const [
  damageCreatureId, damageHpId, damage10Id, damage50Id,
  healCreatureId, healHpId, heal20Id, setHp40Id,
  fullCreatureId, fullHpId, heal5Id,
  loseCreatureId, loseHpId, loseMortalityId, loseMortality10Id,
  gainCreatureId, gainHpId, gainMortalityId, gainMortality10Id,
  comboCreatureId, comboHpId, comboMortalityId, comboActionId,
  noMortalityCreatureId, noMortalityHpId, noMortalityHealId,
] = getRandomIds(100);

// Hit Points of the new type, linked to the default `mortality` variable
function hitPoints(_id: string, damage = 0) {
  return {
    _id,
    type: 'attribute',
    name: 'Hit Points',
    attributeType: 'mortalityHealth',
    variableName: 'hitPoints',
    baseValue: { calculation: '40' },
    damage,
  };
}

// Mortality as an ordinary attribute, maximum equal to the True Maximum HP
function mortality(damage = 0, _id?: string) {
  return {
    ...(_id && { _id }),
    type: 'attribute',
    name: 'Mortality',
    attributeType: 'resource',
    variableName: 'mortality',
    baseValue: { calculation: 'hitPoints.total' },
    damage,
  };
}

function damageSelf(_id: string, amount: string, damageType = 'slashing') {
  return { _id, type: 'damage', target: 'self', damageType, amount: { calculation: amount } };
}

function adjustSelf(_id: string, stat: string, amount: string, operation = 'increment') {
  return { _id, type: 'adjustment', target: 'self', stat, operation, amount: { calculation: amount } };
}

const creatures: TestCreature[] = [{
  // 40 / 40 HP, 40 Mortality
  _id: damageCreatureId,
  props: [
    hitPoints(damageHpId),
    mortality(),
    damageSelf(damage10Id, '10'),
    damageSelf(damage50Id, '50'),
  ],
}, {
  // 10 / 40 HP, 25 Mortality
  _id: healCreatureId,
  props: [
    hitPoints(healHpId, 30),
    mortality(15),
    damageSelf(heal20Id, '20', 'healing'),
    adjustSelf(setHp40Id, 'hitPoints', '40', 'set'),
  ],
}, {
  // 25 HP, already at its 25 Mortality
  _id: fullCreatureId,
  props: [
    hitPoints(fullHpId, 15),
    mortality(15),
    damageSelf(heal5Id, '5', 'healing'),
  ],
}, {
  // 35 HP, 40 Mortality
  _id: loseCreatureId,
  props: [
    hitPoints(loseHpId, 5),
    mortality(0, loseMortalityId),
    adjustSelf(loseMortality10Id, 'mortality', '10'),
  ],
}, {
  // 20 HP, 25 Mortality
  _id: gainCreatureId,
  props: [
    hitPoints(gainHpId, 20),
    mortality(15, gainMortalityId),
    adjustSelf(gainMortality10Id, 'mortality', '-10'),
  ],
}, {
  // 40 HP, 40 Mortality, one action that deals damage then reduces Mortality
  _id: comboCreatureId,
  props: [
    hitPoints(comboHpId),
    mortality(0, comboMortalityId),
    {
      _id: comboActionId,
      type: 'action',
      children: [
        damageSelf(getRandomIds(1)[0], '10'),
        adjustSelf(getRandomIds(1)[0], 'mortality', '15'),
      ],
    },
  ],
}, {
  // 10 / 40 HP, no Mortality attribute
  _id: noMortalityCreatureId,
  props: [
    hitPoints(noMortalityHpId, 30),
    damageSelf(noMortalityHealId, '20', 'healing'),
  ],
}];

describe('Mortality health', function () {
  // Increase timeout
  this.timeout(8000);

  before(async function () {
    await removeAllCreaturesAndProps();
    for (const creature of creatures) {
      await createTestCreature(creature);
    }
  });

  it('takes damage like a health bar without changing Mortality', async function () {
    const action = await runActionById(damage10Id);
    assert.deepEqual(allUpdates(action), [{
      propId: damageHpId,
      type: 'attribute',
      inc: { damage: 10, value: -10 },
    }]);
  });

  it('can go negative', async function () {
    const action = await runActionById(damage50Id);
    assert.deepEqual(allUpdates(action), [{
      propId: damageHpId,
      type: 'attribute',
      inc: { damage: 50, value: -50 },
    }]);
  });

  it('heals no higher than Mortality', async function () {
    // 10 HP healed by 20 stops at 25 Mortality
    const action = await runActionById(heal20Id);
    assert.deepEqual(allUpdates(action), [{
      propId: healHpId,
      type: 'attribute',
      inc: { damage: -15, value: 15 },
    }]);
  });

  it('does not heal at all when already at Mortality', async function () {
    const action = await runActionById(heal5Id);
    assert.deepEqual(allUpdates(action), []);
  });

  it('sets no higher than Mortality', async function () {
    const action = await runActionById(setHp40Id);
    assert.deepEqual(allUpdates(action), [{
      propId: healHpId,
      type: 'attribute',
      set: { damage: 15, value: 25 },
    }]);
  });

  it('pulls current HP down when Mortality drops below it', async function () {
    // 35 HP, Mortality 40 → 30
    const action = await runActionById(loseMortality10Id);
    assert.deepEqual(allUpdates(action), [{
      propId: loseMortalityId,
      type: 'attribute',
      inc: { damage: 10, value: -10 },
    }, {
      propId: loseHpId,
      type: 'attribute',
      inc: { damage: 5, value: -5 },
    }]);
    assert.deepInclude(allLogContent(action), {
      name: 'Hit Points capped by Mortality',
      value: '−5 Hit Points',
      inline: true,
    });
  });

  it('does not raise current HP when Mortality is regained', async function () {
    const action = await runActionById(gainMortality10Id);
    assert.deepEqual(allUpdates(action), [{
      propId: gainMortalityId,
      type: 'attribute',
      inc: { damage: -10, value: 10 },
    }]);
  });

  it('uses values changed earlier in the same action', async function () {
    // Damage 40 → 30 HP, then Mortality 40 → 25 pulls HP down by 5 more
    const action = await runActionById(comboActionId);
    assert.deepEqual(allUpdates(action), [{
      propId: comboHpId,
      type: 'attribute',
      inc: { damage: 10, value: -10 },
    }, {
      propId: comboMortalityId,
      type: 'attribute',
      inc: { damage: 15, value: -15 },
    }, {
      propId: comboHpId,
      type: 'attribute',
      inc: { damage: 5, value: -5 },
    }]);
  });

  it('heals normally when there is no Mortality attribute', async function () {
    const action = await runActionById(noMortalityHealId);
    assert.deepEqual(allUpdates(action), [{
      propId: noMortalityHpId,
      type: 'attribute',
      inc: { damage: -20, value: 20 },
    }]);
  });
});
