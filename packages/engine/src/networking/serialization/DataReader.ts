import { NetworkId } from '@xrengine/common/src/interfaces/NetworkId'
import { UserId } from '@xrengine/common/src/interfaces/UserId'
import { TypedArray } from 'bitecs'
import { Engine } from '../../ecs/classes/Engine'
import { Entity } from '../../ecs/classes/Entity'
import { World } from '../../ecs/classes/World'
import { VelocityComponent } from '../../physics/components/VelocityComponent'
import { TransformComponent } from '../../transform/components/TransformComponent'
import { XRInputSourceComponent } from '../../xr/components/XRInputSourceComponent'
import { flatten, Vector3SoA, Vector4SoA } from './Utils'
import {
  createViewCursor,
  ViewCursor,
  readProp,
  readUint16,
  readUint32,
  readUint8,
  readUint64,
  scrollViewCursor
} from './ViewCursor'
import { hasComponent } from '../../ecs/functions/ComponentFunctions'
import { NetworkObjectAuthorityTag } from '../components/NetworkObjectAuthorityTag'

export const checkBitflag = (mask: number, flag: number) => (mask & flag) === flag

/**
 * Reads a component dynamically
 * (less efficient than statically due to inner loop)
 *
 * @param  {any} component
 */
export const readComponent = (component: any) => {
  // todo: test performance of using flatten in the inner scope vs outer scope
  const props = flatten(component)

  const readChanged =
    props.length <= 8 ? readUint8 : props.length <= 16 ? readUint16 : props.length <= 32 ? readUint32 : readUint64

  return (v: ViewCursor, entity: Entity) => {
    const changeMask = readChanged(v)

    for (let i = 0; i < props.length; i++) {
      // skip reading property if not in the change mask
      if (!checkBitflag(changeMask, 2 ** i)) {
        continue
      }
      const prop = props[i]
      const val = readProp(v, prop)
      prop[entity] = val
    }
  }
}

export const readComponentProp = (v: ViewCursor, prop: TypedArray, entity: Entity) => {
  if (entity !== undefined) prop[entity] = readProp(v, prop)
  else readProp(v, prop)
}

export const readVector3 = (vector3: Vector3SoA) => (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint8(v)
  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector3.x, entity)
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector3.y, entity)
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector3.z, entity)
}

export const readVector4 = (vector4: Vector4SoA) => (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint8(v)
  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector4.x, entity)
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector4.y, entity)
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector4.z, entity)
  if (checkBitflag(changeMask, 1 << b++)) readComponentProp(v, vector4.w, entity)
}

export const readPosition = readVector3(TransformComponent.position)
export const readLinearVelocity = readVector3(VelocityComponent.velocity)
export const readRotation = readVector4(TransformComponent.rotation)

export const readTransform = (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint8(v)
  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readRotation(v, entity)
}

export const readVelocity = (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint8(v)
  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readLinearVelocity(v, entity)
  // if (checkBitflag(changeMask, 1 << b++)) readAngularVelocity(v, entity)
}

export const readXRContainerPosition = readVector3(XRInputSourceComponent.container.position)
export const readXRContainerRotation = readVector4(XRInputSourceComponent.container.quaternion)

export const readXRHeadPosition = readVector3(XRInputSourceComponent.head.position)
export const readXRHeadRotation = readVector4(XRInputSourceComponent.head.quaternion)

export const readXRControllerLeftPosition = readVector3(XRInputSourceComponent.controllerLeftParent.position)
export const readXRControllerLeftRotation = readVector4(XRInputSourceComponent.controllerLeftParent.quaternion)

export const readXRControllerGripLeftPosition = readVector3(XRInputSourceComponent.controllerGripLeftParent.position)
export const readXRControllerGripLeftRotation = readVector4(XRInputSourceComponent.controllerGripLeftParent.quaternion)

export const readXRControllerRightPosition = readVector3(XRInputSourceComponent.controllerRightParent.position)
export const readXRControllerRightRotation = readVector4(XRInputSourceComponent.controllerRightParent.quaternion)

export const readXRControllerGripRightPosition = readVector3(XRInputSourceComponent.controllerGripRightParent.position)
export const readXRControllerGripRightRotation = readVector4(
  XRInputSourceComponent.controllerGripRightParent.quaternion
)

export const readXRInputs = (v: ViewCursor, entity: Entity) => {
  const changeMask = readUint16(v)
  let b = 0

  if (checkBitflag(changeMask, 1 << b++)) readXRContainerPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRContainerRotation(v, entity)

  if (checkBitflag(changeMask, 1 << b++)) readXRHeadPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRHeadRotation(v, entity)

  if (checkBitflag(changeMask, 1 << b++)) readXRControllerLeftPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRControllerLeftRotation(v, entity)

  if (checkBitflag(changeMask, 1 << b++)) readXRControllerGripLeftPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRControllerGripLeftRotation(v, entity)

  if (checkBitflag(changeMask, 1 << b++)) readXRControllerRightPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRControllerRightRotation(v, entity)

  if (checkBitflag(changeMask, 1 << b++)) readXRControllerGripRightPosition(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRControllerGripRightRotation(v, entity)
}

const Vector3ByteLength = Float32Array.BYTES_PER_ELEMENT * 3
const Vector4ByteLength = Float32Array.BYTES_PER_ELEMENT * 3

const EntityDataByteLength =
  16 + // changemask
  +(8 * Vector3ByteLength) + // position + velocity + 6 XR position
  7 * Vector4ByteLength // rotation + 6 XR rotation

export const readEntity = (v: ViewCursor, world: World) => {
  const userIndex = readUint32(v)
  const userId = world.userIndexToUserId.get(userIndex)!
  const netId = readUint32(v) as NetworkId

  const entity = world.getNetworkObject(userId, netId)

  if (!entity) {
    scrollViewCursor(v, EntityDataByteLength)
    return
  }

  // don't apply input state if we have authority
  const weHaveAuthority = hasComponent(entity, NetworkObjectAuthorityTag)
  if (weHaveAuthority) {
    scrollViewCursor(v, EntityDataByteLength)
    return
  }

  const changeMask = readUint8(v)

  let b = 0
  if (checkBitflag(changeMask, 1 << b++)) readTransform(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readVelocity(v, entity)
  if (checkBitflag(changeMask, 1 << b++)) readXRInputs(v, entity)
}

export const readEntities = (v: ViewCursor, world: World, byteLength: number) => {
  while (v.cursor < byteLength) {
    const count = readUint32(v)
    for (let i = 0; i < count; i++) {
      readEntity(v, world)
    }
  }
}

export const readMetadata = (v: ViewCursor, world: World) => {
  world.fixedTick = readUint32(v)
  // const time = readUint32(v)
}

export const createDataReader = () => {
  return (world: World, packet: ArrayBuffer) => {
    const view = createViewCursor(packet)
    readMetadata(view, world)
    readEntities(view, world, packet.byteLength)
  }
}
