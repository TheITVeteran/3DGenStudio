// Renders a skeleton as an overlay inside the mesh-editor <Canvas>: orange bone
// segments (parent→child) plus a dot at each joint, drawn on top of the mesh so
// the rig is visible through the surface (like a DCC armature view). Fed by the
// plain data from utils/meshEditor.js `extractSkeletonFromObject`.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

const BONE_COLOR = '#f0913c'
const JOINT_COLOR = '#ffd9a0'

export default function SkeletonOverlay({ skeleton, visible = true }) {
  const lineGeometry = useMemo(() => {
    if (!skeleton?.segments?.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(skeleton.segments, 3))
    return geo
  }, [skeleton])

  const jointGeometry = useMemo(() => {
    if (!skeleton?.joints?.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(skeleton.joints, 3))
    return geo
  }, [skeleton])

  // Size joint dots relative to the skeleton's extent so they read on any scale.
  const jointSize = useMemo(() => Math.max((skeleton?.size || 1) * 0.02, 1e-4), [skeleton])

  useEffect(() => () => {
    lineGeometry?.dispose()
    jointGeometry?.dispose()
  }, [lineGeometry, jointGeometry])

  if (!visible || (!lineGeometry && !jointGeometry)) return null

  return (
    <group renderOrder={40}>
      {lineGeometry && (
        <lineSegments geometry={lineGeometry} renderOrder={40}>
          <lineBasicMaterial
            color={BONE_COLOR}
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </lineSegments>
      )}
      {jointGeometry && (
        <points geometry={jointGeometry} renderOrder={41}>
          <pointsMaterial
            color={JOINT_COLOR}
            size={jointSize}
            sizeAttenuation
            transparent
            opacity={1}
            depthTest={false}
            depthWrite={false}
          />
        </points>
      )}
    </group>
  )
}
