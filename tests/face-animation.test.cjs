/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const THREE = require('three')

function compile(path, imports) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const compiledModule = { exports: {} }
  const math = Object.create(Math)
  math.random = () => 0.5
  vm.runInNewContext(source, { exports: compiledModule.exports, module: compiledModule, Math: math, require: name => name in imports ? imports[name] : require(name) }, { filename: path })
  return compiledModule.exports
}
const motion = compile('src/lib/face-motion.ts', {})
const bytes = fs.readFileSync('public/models/facecap.glb')
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
const channels = [...new Set(gltf.meshes.flatMap(mesh => mesh.extras?.targetNames || []))]
const zero = { amplitude: 0, sharpness: 0, low: 0, mid: 0, high: 0, dominantBand: 'mid', mouthOpen: 0, mouthWide: 0, mouthRound: 0, mouthClosed: 0, mouthPress: 0, mouthDental: 0 }

function simulate(props = {}, fps = 60, seconds = 5, meshCount = 1) {
  let frame
  const scene = new THREE.Group()
  const meshes = Array.from({ length: meshCount }, () => {
    const mesh = new THREE.Mesh()
    mesh.morphTargetDictionary = Object.fromEntries(channels.map((name, index) => [name, index]))
    mesh.morphTargetInfluences = channels.map(() => 0.7) // Asset's captured pose must be cleared.
    scene.add(mesh)
    return mesh
  })
  const group = new THREE.Group()
  const react = {
    useRef: value => ({ current: value === null ? group : value }),
    useState: initializer => [typeof initializer === 'function' ? initializer() : initializer, () => {}],
    useEffect: effect => effect(),
  }
  const component = compile('src/components/canvas/FaceModel.tsx', {
    react,
    '@react-three/drei': { useGLTF: () => ({ scene, animations: [] }), useAnimations: () => ({ actions: {} }) },
    '@react-three/fiber': { useThree: () => ({ gl: {} }), useFrame: callback => { frame = callback } },
    '@/lib/face-motion': motion,
  }).default
  component({ isSpeaking: false, isListening: false, loading: false, faceCoords: { x: 0.5, y: 0.5 }, expression: 'neutral', inputLevel: 0, audioMetrics: zero, ...props })
  for (let i = 0; i < seconds * fps; i++) {
    frame({ clock: { elapsedTime: i / fps } }, 1 / fps)
    for (const mesh of meshes) for (const weight of mesh.morphTargetInfluences) assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1, `Invalid morph: ${weight}`)
  }
  return { weights: Object.fromEntries(channels.map((name, i) => [name, meshes[0].morphTargetInfluences[i]])), rotation: group.rotation, meshes }
}

test('all 52 asset controls have an explicit animation or neutral release', () => {
  const source = fs.readFileSync('src/components/canvas/FaceModel.tsx', 'utf8')
  const driven = [...source.matchAll(/setMorph\(inf, dict, '([^']+)'/g)].map(match => match[1])
  assert.equal(channels.length, 52)
  assert.deepEqual(channels.filter(name => !driven.includes(name)), [])
  assert.deepEqual(driven.filter(name => !channels.includes(name)), [])
})

test('neutral, smile, sad, listening, thinking and speech remain bounded at 30/60/144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    for (const props of [{}, { expression: 'smile' }, { expression: 'sad' }, { isListening: true, inputLevel: 0.7 }, { loading: true }, { isSpeaking: true, audioMetrics: { ...zero, amplitude: 0.8, mouthOpen: 0.8 } }]) simulate(props, fps)
  }
  const neutral = simulate().weights, smile = simulate({ expression: 'smile' }).weights, sad = simulate({ expression: 'sad' }).weights
  assert.ok(smile.mouthSmile_L > neutral.mouthSmile_L + 0.2, JSON.stringify({ smile, neutral }))
  assert.ok(sad.mouthFrown_L > 0.2)
  assert.ok(neutral.jawOpen < 0.001)
})

test('bilabial seal closes the jaw and speech returns to rest', () => {
  const live = { current: { ...zero, amplitude: 0.8, mouthOpen: 0.1, mouthPress: 0.85, mouthClosed: 0.8 } }
  const sealed = simulate({ isSpeaking: true, audioMetricsLiveRef: live }).weights
  assert.ok(sealed.jawOpen < 0.01)
  assert.ok(sealed.mouthClose > 0.5, JSON.stringify(sealed))
  live.current = { ...zero, amplitude: 0.7, mouthOpen: 0.7 }
  const vowel = simulate({ isSpeaking: true, audioMetricsLiveRef: live }).weights
  assert.ok(vowel.jawOpen > 0.4)
  live.current = zero
  const pause = simulate({ isSpeaking: true, audioMetricsLiveRef: live }).weights
  assert.ok(pause.jawOpen < 0.001)
})

test('shared rig advances once per frame and motion does not depend on mesh count', () => {
  const one = simulate({ expression: 'smile' }, 60, 1, 1)
  const two = simulate({ expression: 'smile' }, 60, 1, 2)
  assert.deepEqual(one.weights, two.weights)
  assert.deepEqual(two.meshes[0].morphTargetInfluences, two.meshes[1].morphTargetInfluences)
})

test('camera gaze drives the eyes ahead of thinking and head position', () => {
  const tracked = simulate({ gaze: { x: 0.7, y: 0.4 }, loading: true, faceCoords: { x: 0, y: 1 } }).weights
  assert.ok(tracked.eyeLookOut_R > 0.4)
  assert.ok(tracked.eyeLookUp_L > 0.2)
  assert.ok(tracked.eyeLookDown_L < 0.001)
  assert.ok(tracked.eyeLookIn_R < 0.001)
})

test('blends preserve timing across refresh rates and blink fully closes/reopens', () => {
  const result = fps => { let value = 0; for (let i = 0; i < fps; i++) value = motion.morphBlend(value, 0.8, 0.1, 1 / fps); return value }
  assert.ok(Math.abs(result(30) - result(144)) < 1e-10)
  assert.equal(motion.blinkEnvelope(0), 0)
  assert.equal(motion.blinkEnvelope(0.06), 1)
  assert.equal(motion.blinkEnvelope(0.18), 0)
  assert.equal(motion.morphBlend(0, -1, 1, 1 / 60), 0)
  assert.equal(motion.morphBlend(0, Infinity, 1, 1 / 60), 0)
})
