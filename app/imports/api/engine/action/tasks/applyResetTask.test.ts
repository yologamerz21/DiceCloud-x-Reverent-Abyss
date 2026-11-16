import { assert } from 'chai';
import {
  allLogContent,
  allUpdates,
  createTestCreature,
  getRandomIds,
  removeAllCreaturesAndProps,
  TestCreature
} from '/imports/api/engine/action/functions/actionEngineTest.testFn';
import EngineActions, { EngineAction } from '/imports/api/engine/action/EngineActions';
import applyAction from '/imports/api/engine/action/functions/applyAction';
import inputProvider from '/imports/api/engine/action/functions/userInput/inputProviderForTests.testFn';

const [
  creatureId, shortRestAttId, turnStartAttId, turnEndAttId, turnStartActionId,
] = getRandomIds(5);

function trigger(event: string, timing = 'after', extra = {}) {
  return {
    type: 'trigger',
    name: `${timing} ${event} trigger`,
    event,
    timing,
    ...extra,
  };
}

const resetTestCreature: TestCreature = {
  _id: creatureId,
  props: [
    {
      _id: shortRestAttId,
      type: 'attribute',
      name: 'Short Rest Stat',
      attributeType: 'stat',
      variableName: 'shortRestStat',
      baseValue: { calculation: '5' },
      damage: 2,
      reset: 'shortRest',
    },
    {
      _id: turnStartAttId,
      type: 'attribute',
      name: 'Action Points',
      attributeType: 'stat',
      variableName: 'actionPoints',
      baseValue: { calculation: '3' },
      damage: 3,
      reset: 'turnStart',
    },
    {
      _id: turnEndAttId,
      type: 'attribute',
      name: 'Reactions',
      attributeType: 'stat',
      variableName: 'reactions',
      baseValue: { calculation: '1' },
      damage: 1,
      reset: 'turnEnd',
    },
    {
      _id: turnStartActionId,
      type: 'action',
      name: 'Once Per Turn',
      uses: { calculation: '1' },
      usesUsed: 1,
      reset: 'turnStart',
    },
    trigger('anyRest'),
    trigger('shortRest'),
    trigger('shortRest', 'before'),
    trigger('longRest'),
    trigger('turnStart'),
    trigger('turnStart', 'before'),
    trigger('turnStart', 'after', { name: 'disabled turnStart trigger', disabled: true }),
    trigger('turnEnd'),
  ],
};

// Run a reset event the same way the sheet buttons do
async function runReset(eventName: string) {
  const actionId = await EngineActions.insertAsync({
    creatureId,
    results: [],
    taskCount: 0,
    task: {
      subtaskFn: 'reset',
      targetIds: [creatureId],
      eventName,
    },
  } as EngineAction);
  const action = await EngineActions.findOneAsync(actionId);
  if (!action) throw 'Action is expected to exist';
  await applyAction(action, inputProvider, { simulate: true });
  return action;
}

const logNames = (action: EngineAction) => allLogContent(action).map(content => content.name);
const updatedIds = (action: EngineAction) => allUpdates(action).map(update => update.propId);

describe('Reset events', function () {
  this.timeout(8000);

  before(async function () {
    await removeAllCreaturesAndProps();
    await createTestCreature(resetTestCreature);
  });

  it('Fires short rest and any rest triggers around a short rest', async function () {
    const action = await runReset('shortRest');
    assert.deepEqual(logNames(action), [
      'Short Rest',
      'before shortRest trigger',
      'Stat restored',
      'after anyRest trigger',
      'after shortRest trigger',
    ]);
    assert.deepEqual(updatedIds(action), [shortRestAttId]);
  });

  it('Fires long rest and any rest triggers on a long rest', async function () {
    const action = await runReset('longRest');
    const names = logNames(action);
    assert.equal(names[0], 'Long Rest');
    assert.include(names, 'after anyRest trigger');
    assert.include(names, 'after longRest trigger');
    assert.notInclude(names, 'after shortRest trigger');
    assert.notInclude(names, 'before shortRest trigger');
  });

  it('Resets turn start properties and fires turn start triggers', async function () {
    const action = await runReset('turnStart');
    assert.deepEqual(logNames(action), [
      'Turn Start',
      'before turnStart trigger',
      'Stat restored',
      'Once Per Turn',
      'after turnStart trigger',
    ]);
    assert.deepEqual(updatedIds(action), [turnStartAttId, turnStartActionId]);
  });

  it('Resets turn end properties and fires turn end triggers', async function () {
    const action = await runReset('turnEnd');
    assert.deepEqual(logNames(action), [
      'Turn End',
      'Stat restored',
      'after turnEnd trigger',
    ]);
    assert.deepEqual(updatedIds(action), [turnEndAttId]);
  });

  it('Does not reset turn properties on a long rest', async function () {
    const action = await runReset('longRest');
    assert.deepEqual(updatedIds(action), [shortRestAttId]);
  });
});
