/**
 * Image classifier for the Smart Sorter lesson.
 *
 * A small MobileNet v1 (width 0.25) turns each 224×224 image into a feature
 * vector. Training fits a three-class layer on those vectors. Prediction uses
 * that trained layer. Nothing here decides which bin the flap should use.
 */
import * as tf from '@tensorflow/tfjs';
import { CLASS_IDS, CLASS_LABELS, MIN_EXAMPLES_PER_CLASS } from './classes.js';

export const TRAIN_EPOCHS = 25;

export function runtimeBackend() {
  const name = tf.getBackend();
  if (name === 'webgl') return 'WebGL';
  if (name === 'cpu') return "this computer's processor";
  return name || 'this browser';
}
const SMOOTHING = 0.75;
const L2 = 0.02;
const LEARNING_RATE = 0.005;
const SEED = 1;
export const IMAGE_EDGE = 224;

function canceled() {
  const error = new Error('Training was canceled.');
  error.name = 'AbortError';
  return error;
}

function shuffle(items, seed) {
  let state = seed >>> 0;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

export async function createClassifier(source) {
  if (!source) throw new Error('The image model location is missing.');
  tf.enableProdMode();
  let full;
  try {
    full = await tf.loadLayersModel(source);
  } catch (error) {
    const detail = error && error.message ? error.message : 'unknown error';
    throw new Error(`The image model could not be loaded. The first training needs a connection to this website so the browser can download it. ${detail}`);
  }
  const pooling = full.getLayer('global_average_pooling2d_1');
  const featureModel = tf.model({ inputs: full.inputs, outputs: pooling.output });
  let head = null;
  let running = false;

  async function embed(pixels) {
    if (!(pixels instanceof Uint8Array) || pixels.length !== IMAGE_EDGE * IMAGE_EDGE * 3) {
      throw new Error('Each example needs a 224 by 224 color image.');
    }
    const image = tf.tensor3d(pixels, [IMAGE_EDGE, IMAGE_EDGE, 3], 'float32');
    let vector;
    try {
      vector = tf.tidy(() => featureModel.predict(image.div(127.5).sub(1).expandDims(0)).squeeze());
      return new Float32Array(await vector.data());
    } finally {
      image.dispose();
      if (vector) vector.dispose();
    }
  }

  return {
    get ready() {
      return head != null;
    },
    async train(examples, options = {}) {
      if (running) throw new Error('Training is already running.');
      const signal = options.signal;
      const onProgress = options.onProgress;
      const epochs = options.epochs || TRAIN_EPOCHS;
      if (signal?.aborted) throw canceled();
      if (!Array.isArray(examples) || examples.length === 0) {
        throw new Error(`Add at least ${MIN_EXAMPLES_PER_CLASS} examples of each class before training.`);
      }
      const counts = Object.fromEntries(CLASS_IDS.map((id) => [id, 0]));
      for (const example of examples) {
        if (!CLASS_IDS.includes(example.label)) throw new Error('Unknown class.');
        counts[example.label] += 1;
      }
      for (const id of CLASS_IDS) {
        if (counts[id] < MIN_EXAMPLES_PER_CLASS) {
          throw new Error(`Add at least ${MIN_EXAMPLES_PER_CLASS} ${CLASS_LABELS[id]} examples before training. This class has ${counts[id]}.`);
        }
      }

      running = true;
      try {
        const embeddings = [];
        const labels = [];
        for (let i = 0; i < examples.length; i += 1) {
          if (signal?.aborted) throw canceled();
          onProgress?.({ phase: 'features', index: i + 1, total: examples.length, epochs });
          embeddings.push(await embed(examples[i].pixels));
          labels.push(CLASS_IDS.indexOf(examples[i].label));
          await tf.nextFrame();
        }
        const order = shuffle(embeddings.map((_, index) => index), SEED);
        const xs = tf.tensor2d(order.map((index) => embeddings[index]));
        const ys = tf.tidy(() => {
          const hard = tf.oneHot(tf.tensor1d(order.map((index) => labels[index]), 'int32'), CLASS_IDS.length);
          return hard.mul(SMOOTHING).add((1 - SMOOTHING) / CLASS_IDS.length);
        });
        const next = tf.sequential({
          layers: [
            tf.layers.dense({
              inputShape: [embeddings[0].length],
              units: CLASS_IDS.length,
              activation: 'softmax',
              kernelInitializer: tf.initializers.glorotUniform({ seed: SEED }),
              kernelRegularizer: tf.regularizers.l2({ l2: L2 }),
            }),
          ],
        });
        next.compile({ optimizer: tf.train.adam(LEARNING_RATE), loss: 'categoricalCrossentropy' });
        let aborted = false;
        try {
          await next.fit(xs, ys, {
            epochs,
            batchSize: Math.max(1, Math.min(16, examples.length)),
            shuffle: false,
            verbose: 0,
            yieldEvery: 'epoch',
            callbacks: {
              onEpochEnd: async (epoch, logs) => {
                onProgress?.({
                  phase: 'epoch',
                  epoch: epoch + 1,
                  epochs,
                  loss: typeof logs?.loss === 'number' ? logs.loss : 0,
                });
                if (signal?.aborted) {
                  aborted = true;
                  next.stopTraining = true;
                }
              },
            },
          });
        } catch (error) {
          next.dispose();
          const detail = error && error.message ? error.message : 'unknown error';
          throw new Error(`Training stopped before it finished. You can try again. ${detail}`);
        } finally {
          xs.dispose();
          ys.dispose();
        }
        if (aborted || signal?.aborted) {
          next.dispose();
          throw canceled();
        }
        if (head) head.dispose();
        head = next;
      } finally {
        running = false;
      }
    },
    async predict(pixels) {
      if (!head) throw new Error('Train the model before testing an image.');
      const vector = await embed(pixels);
      const scoresTensor = tf.tidy(() => head.predict(tf.tensor2d(vector, [1, vector.length])).squeeze());
      try {
        const data = await scoresTensor.data();
        const scores = {};
        CLASS_IDS.forEach((id, index) => {
          scores[id] = data[index];
        });
        return { scores };
      } finally {
        scoresTensor.dispose();
      }
    },
    dispose() {
      if (head) head.dispose();
      head = null;
      full.dispose();
    },
  };
}
