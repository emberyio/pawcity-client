import { ComponentJson } from '@xrengine/common/src/interfaces/SceneInterface'
import { Color, AmbientLight } from 'three'
import {
  ComponentDeserializeFunction,
  ComponentSerializeFunction,
  ComponentShouldDeserializeFunction,
  ComponentUpdateFunction
} from '../../../common/constants/PrefabFunctionType'
import { isClient } from '../../../common/functions/isClient'
import { Engine } from '../../../ecs/classes/Engine'
import { Entity } from '../../../ecs/classes/Entity'
import { addComponent, getComponentCountOfType, getComponent } from '../../../ecs/functions/ComponentFunctions'
import { DisableTransformTagComponent } from '../../../transform/components/DisableTransformTagComponent'
import { EntityNodeComponent } from '../../components/EntityNodeComponent'
import { AmbientLightComponent, AmbientLightComponentType } from '../../components/AmbientLightComponent'
import { Object3DComponent } from '../../components/Object3DComponent'

export const SCENE_COMPONENT_AMBIENT_LIGHT = 'ambient-light'
export const SCENE_COMPONENT_AMBIENT_LIGHT_DEFAULT_VALUES = {
  color: '#ffffff',
  intensity: 1
}

export const deserializeAmbientLight: ComponentDeserializeFunction = (
  entity: Entity,
  json: ComponentJson<AmbientLightComponentType>
) => {
  const light = new AmbientLight()

  addComponent(entity, Object3DComponent, { value: light })
  addComponent(entity, DisableTransformTagComponent, {})
  addComponent(entity, AmbientLightComponent, {
    ...json.props,
    color: new Color(json.props.color)
  })

  if (Engine.isEditor) getComponent(entity, EntityNodeComponent)?.components.push(SCENE_COMPONENT_AMBIENT_LIGHT)

  updateAmbientLight(entity)
}

export const updateAmbientLight: ComponentUpdateFunction = (entity: Entity) => {
  const component = getComponent(entity, AmbientLightComponent)
  const light = getComponent(entity, Object3DComponent)?.value as AmbientLight

  light.color = component.color
  light.intensity = component.intensity
}

export const serializeAmbientLight: ComponentSerializeFunction = (entity) => {
  const component = getComponent(entity, AmbientLightComponent) as AmbientLightComponentType
  if (!component) return

  return {
    name: SCENE_COMPONENT_AMBIENT_LIGHT,
    props: {
      color: component.color?.getHex(),
      intensity: component.intensity
    }
  }
}

export const shouldDeserializeAmbientLight: ComponentShouldDeserializeFunction = () => {
  return getComponentCountOfType(AmbientLightComponent) <= 0
}
