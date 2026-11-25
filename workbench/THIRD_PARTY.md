# Workbench third-party notices

The Smart Sorter lesson trains in the browser. These are the pieces it redistributes.
Student images are not part of this repository.

## TensorFlow.js 4.22.0

- Package: `@tensorflow/tfjs`
- License: Apache License 2.0
- Project: https://github.com/tensorflow/tfjs
- Copyright: Google LLC and other TensorFlow.js contributors
- The built lesson file `workbench/app.js` includes this library.
- License text: `workbench/vendor/LICENSE-Apache-2.0.txt`

## MobileNet v1, width multiplier 0.25, 224×224 input

- Use: frozen feature extractor. The lesson trains only a small three-class layer on top.
- Source checkpoint: https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json
- Project: TensorFlow.js models, https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
- Paper: Andrew G. Howard, Menglong Zhu, Bo Chen, Dmitry Kalenichenko, Weijun Wang, Tobias Weyand, Marco Andreetto, and Hartwig Adam, “MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications,” 2017.
- License: Apache License 2.0
- Files: `workbench/models/mobilenet-v1-0.25-224/model.json` and `weights.bin`
- The original weight shards are concatenated in manifest order into one `weights.bin` so a school laptop downloads them in a single request. The numbers are unchanged.
- SHA-256 `model.json`: `8ec914f279fff997be57d7deaba22e2c882ec9df8f6cb37e029b04363005fd64`
- SHA-256 `weights.bin`: `eb49857447f6089e7e392f7991f3f4fdce1936efaf83d535f5eb8aaba9538e0b`
- Size: `model.json` 46,994 bytes, `weights.bin` 1,902,176 bytes

## Optional video

The “Optional tutorial” link opens a public YouTube video, Teachable Machine Tutorial 1: Gather:

https://www.youtube.com/watch?v=DFBbSTvtpy4

The page does not load YouTube until a student presses Play. The video is Google’s, not AfroBot’s.

## Site assets reused by the lesson

- AfroBot logo and favicon in `assets/`, already part of this site.
- Public Sans and Outfit in `fonts/`, SIL Open Font License. License files are beside the fonts.

## Practice drawings

`workbench/src/scenes.js` draws the paper, bottle, empty-table, and mixed-object pictures used by the practice button and the tests. They are original geometric drawings, not photographs.
