import { ComponentJson } from '@xrengine/common/src/interfaces/SceneInterface'
import { Vector2, Color, SpotLight, MeshBasicMaterial, Mesh, TorusGeometry, ConeGeometry, DoubleSide } from 'three'
import {
  ComponentDeserializeFunction,
  ComponentPrepareForGLTFExportFunction,
  ComponentSerializeFunction,
  ComponentUpdateFunction
} from '../../../common/constants/PrefabFunctionType'
import { Engine } from '../../../ecs/classes/Engine'
import { Entity } from '../../../ecs/classes/Entity'
import { addComponent, getComponent } from '../../../ecs/functions/ComponentFunctions'
import { EntityNodeComponent } from '../../components/EntityNodeComponent'
import { Object3DComponent } from '../../components/Object3DComponent'
import { SpotLightComponent, SpotLightComponentType } from '../../components/SpotLightComponent'

export const SCENE_COMPONENT_SPOT_LIGHT = 'spot-light'
export const SCENE_COMPONENT_SPOT_LIGHT_DEFAULT_VALUES = {
  color: '#ffffff',
  intensity: 10,
  range: 0,
  decay: 2,
  angle: Math.PI / 2,
  penumbra: 1,
  castShadow: true,
  shadowMapResolution: [256, 256],
  shadowBias: 0.5,
  shadowRadius: 1
}

export const deserializeSpotLight: ComponentDeserializeFunction = (
  entity: Entity,
  json: ComponentJson<SpotLightComponentType>
) => {
  const light = new SpotLight()

  light.target.position.set(0, -1, 0)
  light.target.name = 'light-target'
  light.add(light.target)

  if (Engine.isEditor) {
    const ring = new Mesh(new TorusGeometry(0.1, 0.025, 8, 12), new MeshBasicMaterial({ fog: false }))
    const cone = new Mesh(
      new ConeGeometry(0.25, 0.5, 8, 1, true),
      new MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.5, side: DoubleSide })
    )
    light.add(ring)
    light.add(cone)
    cone.userData.isHelper = true
    ring.userData.isHelper = true
    light.userData.ring = ring
    light.userData.cone = cone

    ring.rotateX(Math.PI / 2)
    cone.position.setY(-0.25)
  }

  addComponent(entity, Object3DComponent, { value: light })
  addComponent(entity, SpotLightComponent, {
    ...json.props,
    color: new Color(json.props.color),
    shadowMapResolution: new Vector2().fromArray(
      (json.props.shadowMapResolution as any) || SCENE_COMPONENT_SPOT_LIGHT_DEFAULT_VALUES.shadowMapResolution
    )
  })

  if (Engine.isEditor) getComponent(entity, EntityNodeComponent)?.components.push(SCENE_COMPONENT_SPOT_LIGHT)

  updateSpotLight(entity)
}

export const updateSpotLight: ComponentUpdateFunction = (entity: Entity) => {
  const component = getComponent(entity, SpotLightComponent)
  const light = getComponent(entity, Object3DComponent)?.value as SpotLight

  light.color.set(component.color)
  light.intensity = component.intensity
  light.distance = component.range
  light.decay = component.decay
  light.penumbra = component.penumbra
  light.angle = component.angle
  light.shadow.bias = component.shadowBias
  light.shadow.radius = component.shadowRadius
  // light.castShadow = component.castShadow

  light.shadow.mapSize.copy(component.shadowMapResolution)
  light.shadow.map?.dispose()
  light.shadow.map = null as any

  light.shadow.camera.updateProjectionMatrix()
  light.shadow.needsUpdate = true

  if (Engine.isEditor) {
    light.userData.ring.material.color = component.color
    light.userData.cone.material.color = component.color
  }
}

export const serializeSpotLight: ComponentSerializeFunction = (entity) => {
  const component = getComponent(entity, SpotLightComponent) as SpotLightComponentType
  if (!component) return

  return {
    name: SCENE_COMPONENT_SPOT_LIGHT,
    props: {
      color: component.color?.getHex(),
      intensity: component.intensity,
      range: component.range,
      decay: component.decay,
      angle: component.angle,
      penumbra: component.penumbra,
      castShadow: component.castShadow,
      shadowMapResolution: component.shadowMapResolution?.toArray(),
      shadowBias: component.shadowBias,
      shadowRadius: component.shadowRadius
    }
  }
}

export const prepareSpotLightForGLTFExport: ComponentPrepareForGLTFExportFunction = (light) => {
  if (light.userData.ring) {
    if (light.userData.ring.parent) light.userData.ring.removeFromParent()
    delete light.userData.ring
  }

  if (light.userData.cone) {
    if (light.userData.cone.parent) light.userData.cone.removeFromParent()
    delete light.userData.cone
  }
}
