import { assert } from 'chai';
import {
  allMutations,
  createTestCreature,
  getRandomIds,
  removeAllCreaturesAndProps,
  runActionById,
  TestCreature
} from '/imports/api/engine/action/functions/actionEngineTest.testFn';
import { critInputProvider } from '../functions/userInput/inputProviderForTests.testFn';

const [
  creatureId, targetCreatureId, targetCreature2Id, damageTargetId, damageSelfId, targetCreatureHitPointsId, targetCreature2HitPointsId, selfHitPointsId, damageWithEffectsId, effectId, effect2Id,
] = getRandomIds(20);

const actionTestCreature: TestCreature = {
  _id: creatureId,
  props: [
    {
      _id: damageTargetId,
      type: 'damage',
      target: 'target',
      amount: { calculation: '2d6 + 7' }
    },
    {
      _id: damageSelfId,
      type: 'damage',
      target: 'self',
      amount: { calculation: '1d12 + 7' }
    },
    {
      _id: selfHitPointsId,
      type: 'attribute',
      name: 'Hit Points',
      attributeType: 'healthBar',
      variableName: 'hitPoints',
      baseValue: { calculation: '20' },
    },
    {
      _id: damageWithEffectsId,
      type: 'damage',
      target: 'target',
      amount: { calculation: '1d13 + 3' },
      tags: ['tag']
    },
    {
      _id: effectId,
      type: 'effect',
      operation: 'add',
      amount: { calculation: '1' },
      targetByTags: true,
      targetTags: ['tag'],
    },
    {
      _id: effect2Id,
      type: 'effect',
      operation: 'mul',
      amount: { calculation: '2' },
      targetByTags: true,
      targetTags: ['tag'],
    },
  ],
}

const actionTargetCreature: TestCreature = {
  _id: targetCreatureId,
  props: [
    {
      _id: targetCreatureHitPointsId,
      type: 'attribute',
      name: 'Hit Points',
      attributeType: 'healthBar',
      variableName: 'hitPoints',
      baseValue: { calculation: '33' },
    }
  ]
}

const actionTargetCreature2: TestCreature = {
  _id: targetCreature2Id,
  props: [
    {
      _id: targetCreature2HitPointsId,
      type: 'attribute',
      name: 'Hit Points',
      attributeType: 'healthBar',
      variableName: 'hitPoints',
      baseValue: { calculation: '47' },
    }
  ]
}

describe('Apply Damage Properties', function () {
  // Increase timeout
  this.timeout(8000);

  before(async function () {
    await removeAllCreaturesAndProps();
    await createTestCreature(actionTestCreature);
    await createTestCreature(actionTargetCreature);
    await createTestCreature(actionTargetCreature2);
  });

  it('Damages self', async function () {
    const action = await runActionById(damageSelfId);
    assert.exists(action);
    assert.deepEqual(allMutations(action), [{
      contents: [
        {
          inline: true,
          name: 'Damage',
          value: '1d12 [6] + 7',
        }
      ],
      targetIds: [creatureId],
    }, {
      contents: [{
        inline: true,
        name: 'Health bar damaged',
        value: '−13 Hit Points',
      }],
      updates: [
        {
          propId: selfHitPointsId,
          type: 'attribute',
          inc: { damage: 13, value: -13 },
        },
      ],
      targetIds: [creatureId],
    }]);
  });

  it('Damages a single target', async function () {
    const action = await runActionById(damageTargetId, [targetCreatureId]);
    assert.exists(action);
    assert.deepEqual(allMutations(action), [{
      contents: [
        {
          inline: true,
          name: 'Damage',
          value: '2d6 [3, 4] + 7',
        }
      ],
      targetIds: [targetCreatureId],
    }, {
      contents: [
        {
          inline: true,
          name: 'Health bar damaged',
          value: '−14 Hit Points',
        }
      ],
      targetIds: [targetCreatureId],
      updates: [
        {
          propId: targetCreatureHitPointsId,
          type: 'attribute',
          inc: { damage: 14, value: -14 },
        },
      ],
    }]);
  });

  it('Damages multiple targets', async function () {
    const action = await runActionById(damageTargetId, [
      targetCreatureId, targetCreature2Id
    ]);
    assert.exists(action);
    assert.deepEqual(allMutations(action), [{
      contents: [
        {
          inline: true,
          name: 'Damage',
          value: '2d6 [3, 4] + 7',
        }
      ],
      targetIds: [
        targetCreatureId,
        targetCreature2Id,
      ],
    }, {
      contents: [
        {
          inline: true,
          name: 'Health bar damaged',
          value: '−14 Hit Points',
        }
      ],
      targetIds: [targetCreatureId],
      updates: [
        {
          propId: targetCreatureHitPointsId,
          type: 'attribute',
          inc: { damage: 14, value: -14 },
        },
      ],
    }, {
      contents: [
        {
          inline: true,
          name: 'Health bar damaged',
          value: '−14 Hit Points',
        }
      ],
      targetIds: [targetCreature2Id],
      updates: [
        {
          propId: targetCreature2HitPointsId,
          type: 'attribute',
          inc: { damage: 14, value: -14 },
        },
      ],
    }]);
  });

  it('Applies effects when doing damage', async function () {
    const action = await runActionById(damageWithEffectsId, [targetCreatureId]);
    assert.exists(action);
    assert.deepEqual(allMutations(action), [{
      contents: [
        {
          inline: true,
          name: 'Damage',
          value: '(1d13 [7] + 4) * 2',
        }
      ],
      targetIds: [targetCreatureId],
    }, {
      contents: [
        {
          inline: true,
          name: 'Health bar damaged',
          value: '−22 Hit Points',
        }
      ],
      targetIds: [targetCreatureId],
      updates: [
        {
          propId: targetCreatureHitPointsId,
          type: 'attribute',
          inc: { damage: 22, value: -22 },
        },
      ],
    }]);
  });

  // RA crit damage: each dice term rolls double the dice and keeps the original
  // count, highest first, and the flat (non-dice) part of the formula is doubled.
  // The test roller rolls ascending values, so a 2d8 crit rolls [4, 5]
  async function critDamage(amount: string, extraProps: TestCreature['props'] = [], damageType = 'slashing') {
    const [creatureId, damageId, actionId] = getRandomIds(3);
    await createTestCreature({
      _id: creatureId,
      props: [
        ...extraProps,
        {
          _id: actionId,
          type: 'action',
          attackRoll: { calculation: '10' },
          children: [{
            _id: damageId,
            type: 'damage',
            target: 'target',
            damageType,
            amount: { calculation: amount },
          }],
        },
      ],
    });
    const action = await runActionById(actionId, [], critInputProvider);
    assert.exists(action);
    const mutations = allMutations(action);
    assert.equal(mutations[1].contents[0].name, 'Critical Hit!');
    return mutations[2].contents[0].value;
  }

  it('Keeps the highest dice and doubles the flat part on a critical hit', async function () {
    assert.equal(
      await critDamage('2d6 + 7'),
      '2d6 [~~3~~, ~~4~~, 5, 6] + 7 (flat 7 ×2 → 14)\n**25** critical slashing damage'
    );
  });

  it('Keeps the original number of dice on a critical hit', async function () {
    assert.equal(
      await critDamage('1d8 + 2'),
      '1d8 [~~4~~, 5] + 2 (flat 2 ×2 → 4)\n**9** critical slashing damage'
    );
  });

  it('Doubles stat modifiers in the damage on a critical hit', async function () {
    const value = await critDamage('1d8 + wm.modifier', [{
      _id: getRandomIds(1)[0],
      type: 'attribute',
      name: 'Weapon Mastery',
      attributeType: 'ability',
      variableName: 'wm',
      baseValue: { calculation: '15' },
    }]);
    // wm 15 has an RA modifier of +4
    assert.equal(value, '1d8 [~~4~~, 5] + 4 (flat 4 ×2 → 8)\n**13** critical slashing damage');
  });

  it('Doubles flat-only damage on a critical hit', async function () {
    assert.equal(
      await critDamage('5'),
      '5 (flat 5 ×2 → 10)\n**10** critical slashing damage'
    );
  });

  it('Doubles a negative flat part on a critical hit', async function () {
    assert.equal(
      await critDamage('1d8 - 1'),
      '1d8 [~~4~~, 5] - 1 (flat -1 ×2 → -2)\n**3** critical slashing damage'
    );
  });

  it('Does not crit healing', async function () {
    assert.equal(
      await critDamage('1d8 + 2', [], 'healing'),
      '1d8 [4] + 2\n**6** healing'
    );
  });
});
