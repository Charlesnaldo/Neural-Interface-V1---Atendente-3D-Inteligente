/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const output = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/gaze.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: output.exports })
const { estimateGaze } = output.exports
function face(x = 0, y = 0) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  for (const [a,b,up,down,iris,center] of [[33,133,159,145,468,0.3],[362,263,386,374,473,0.7]]) {
    points[a] = { x: center - 0.1, y: 0.5 }; points[b] = { x: center + 0.1, y: 0.5 }
    points[up] = { x: center, y: 0.46 }; points[down] = { x: center, y: 0.54 }
    points[iris] = { x: center + x, y: 0.5 + y }
  }
  return points
}
test('iris displacement follows both axes and stays bounded', () => {
  assert.ok(Math.abs(estimateGaze(face()).x) < 1e-10)
  assert.ok(estimateGaze(face(0.03)).x > 0.8)
  assert.ok(estimateGaze(face(-0.03)).x < -0.8)
  assert.ok(estimateGaze(face(0, -0.02)).y > 0.5)
  assert.ok(estimateGaze(face(0, 0.02)).y < -0.5)
  assert.equal(estimateGaze(face(0.1)).x, 1)
})
test('closed eyes, missing irises and invalid detections produce no direction', () => {
  assert.equal(estimateGaze([]), null)
  const points = face(); points[159] = points[145]
  assert.equal(estimateGaze(points), null)
  const invalid = face(); invalid[468].x = NaN
  assert.equal(estimateGaze(invalid), null)
})
test('eye-local axes tolerate head roll', () => {
  const angle = 0.25
  const rotate = p => ({ x: 0.5 + (p.x - 0.5) * Math.cos(angle) - (p.y - 0.5) * Math.sin(angle), y: 0.5 + (p.x - 0.5) * Math.sin(angle) + (p.y - 0.5) * Math.cos(angle) })
  const normal = estimateGaze(face(0.02, -0.01)), rolled = estimateGaze(face(0.02, -0.01).map(rotate))
  assert.ok(Math.abs(normal.x - rolled.x) < 1e-10)
  assert.ok(Math.abs(normal.y - rolled.y) < 1e-10)
})
test('worker suppresses multiple people and closes every processed bitmap', async () => {
  const messages = []; let closed = 0, detected = [face()]
  const scope = { self: { postMessage: message => messages.push(message) }, importScripts: () => {}, Vision: { FilesetResolver: { forVisionTasks: async () => ({}) }, FaceLandmarker: { createFromOptions: async () => ({ detectForVideo: () => ({ faceLandmarks: detected }) }) } } }
  vm.runInNewContext(fs.readFileSync('public/gaze-worker.js', 'utf8'), scope)
  await scope.self.onmessage({ data: { type: 'init' } })
  assert.equal(messages.pop().type, 'ready')
  for (const faces of [[face()], [face(),face()], []]) {
    detected = faces
    await scope.self.onmessage({ data: { type: 'frame', bitmap: { close: () => { closed++ } }, timestamp: 1 } })
    assert.equal(Boolean(messages.pop().landmarks), faces.length === 1)
  }
  assert.equal(closed, 3)
})
