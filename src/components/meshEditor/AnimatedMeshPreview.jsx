// Plays a retargeted animation clip on the user's rigged mesh inside the
// mesh-editor <Canvas>. Renders the target skinned scene (loaded from the rigged
// GLB) and drives it with an AnimationMixer. Shown in Auto Rig mode while an
// animation is selected, in place of the static EditorMesh.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function AnimatedMeshPreview({ object, mixerRoot, clip, playing = true, timeScale = 1, yOffset = 0 }) {
  const mixerRef = useRef(null)
  const actionRef = useRef(null)

  // Retargeted clips use ".bones[name]" track paths, which the mixer can only
  // resolve against a node that has a `.skeleton` — i.e. the SkinnedMesh, not the
  // wrapping scene. Render the whole scene but drive the SkinnedMesh.
  const root = mixerRoot || object
  const mixer = useMemo(() => (root ? new THREE.AnimationMixer(root) : null), [root])
  useEffect(() => {
    mixerRef.current = mixer
    return () => {
      mixer?.stopAllAction()
      if (mixer && root) mixer.uncacheRoot(root)
    }
  }, [mixer, root])

  // (Re)bind the action whenever the clip changes.
  useEffect(() => {
    const m = mixerRef.current
    if (!m) return undefined
    m.stopAllAction()
    if (!clip) {
      actionRef.current = null
      return undefined
    }
    const action = m.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.play()
    actionRef.current = action
    return () => {
      action.stop()
      m.uncacheAction(clip)
    }
  }, [clip])

  // Keep play/pause + speed in sync without rebinding the action.
  useEffect(() => {
    const action = actionRef.current
    if (action) action.paused = !playing
  }, [playing])
  useEffect(() => {
    if (mixerRef.current) mixerRef.current.timeScale = timeScale
  }, [timeScale])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)
  })

  if (!object) return null
  return (
    <group position={[0, yOffset, 0]}>
      <primitive object={object} />
    </group>
  )
}
