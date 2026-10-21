/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const root = path.dirname(require.resolve('@mediapipe/tasks-vision'))
const output = path.resolve('public/mediapipe')
fs.mkdirSync(output, { recursive: true })
fs.copyFileSync(path.join(root, 'vision_bundle.js'), path.join(output, 'vision_bundle.js'))
fs.cpSync(path.join(root, 'wasm'), path.join(output, 'wasm'), { recursive: true })
