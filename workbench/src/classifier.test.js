import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClassifier } from './classifier.js';
import { scenePixels } from './scenes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(root, 'models', 'mobilenet-v1-0.25-224');

function diskModel(dir) {
  return {
    async load() {
      const modelJson = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf8'));
      const bin = fs.readFileSync(path.join(dir, modelJson.weightsManifest[0].paths[0]));
      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs: modelJson.weightsManifest[0].weights,
        weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
      };
    },
  };
}

function examples(variants) {
  const rows = [];
  for (const label of ['paper', 'plastic', 'no-item']) {
    for (const variant of variants) rows.push({ label, pixels: scenePixels(label, variant) });
  }
  return rows;
}

function topClass(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
}

test('the vendored MobileNet weights are a single file', () => {
  const model = JSON.parse(fs.readFileSync(path.join(modelDir, 'model.json'), 'utf8'));
  assert.equal(model.weightsManifest.length, 1);
  assert.deepEqual(model.weightsManifest[0].paths, ['weights.bin']);
  assert.equal(fs.statSync(path.join(modelDir, 'weights.bin')).size, 1902176);
});

test('training learns paper, plastic, and an empty scene, and holds a mixed drawing', async () => {
  const classifier = await createClassifier(diskModel(modelDir));
  const seen = [];
  await classifier.train(examples([0, 1, 2, 3]), {
    onProgress(update) { seen.push(update.phase); },
  });
  assert.equal(classifier.ready, true);
  assert.equal(seen.includes('features'), true);
  assert.equal(seen.includes('epoch'), true);

  const paper = await classifier.predict(scenePixels('paper', 9));
  const bottle = await classifier.predict(scenePixels('plastic', 9));
  const empty = await classifier.predict(scenePixels('no-item', 9));
  const mixed = await classifier.predict(scenePixels('mix', 0));

  assert.equal(topClass(paper.scores)[0], 'paper');
  assert.equal(topClass(bottle.scores)[0], 'plastic');
  assert.equal(topClass(empty.scores)[0], 'no-item');
  assert.ok(paper.scores.paper >= 0.75, JSON.stringify(paper.scores));
  assert.ok(bottle.scores.plastic >= 0.75, JSON.stringify(bottle.scores));
  assert.ok(empty.scores['no-item'] >= 0.85, JSON.stringify(empty.scores));
  assert.ok(Math.max(...Object.values(mixed.scores)) < 0.7, JSON.stringify(mixed.scores));

  const controller = new AbortController();
  const canceled = classifier.train(examples([0, 1, 2, 3]), {
    signal: controller.signal,
    onProgress(update) {
      if (update.phase === 'epoch' && update.epoch === 1) controller.abort();
    },
  });
  await assert.rejects(canceled, /canceled/i);
  const again = await classifier.predict(scenePixels('paper', 9));
  assert.equal(topClass(again.scores)[0], 'paper');
  classifier.dispose();
});

test('too few examples does not start training', async () => {
  const classifier = await createClassifier(diskModel(modelDir));
  await assert.rejects(
    () => classifier.train(examples([0])),
    /at least 4 Paper examples/,
  );
  assert.equal(classifier.ready, false);
  await assert.rejects(() => classifier.predict(scenePixels('paper', 0)), /Train the model/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => classifier.train(examples([0, 1, 2, 3]), { signal: controller.signal }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(classifier.ready, false);
  classifier.dispose();
});
