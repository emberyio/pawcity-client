import { AppAction, GeneralStateList } from '@xrengine/client-core/src/common/services/AppService'
import { useLocationState } from '@xrengine/client-core/src/social/services/LocationService'
import { useAuthState } from '@xrengine/client-core/src/user/services/AuthService'
import { AuthService } from '@xrengine/client-core/src/user/services/AuthService'
import { UserService } from '@xrengine/client-core/src/user/services/UserService'
import { useUserState } from '@xrengine/client-core/src/user/services/UserService'
import { EngineEvents } from '@xrengine/engine/src/ecs/classes/EngineEvents'
import { InitializeOptions } from '@xrengine/engine/src/initializationOptions'
import { shutdownEngine } from '@xrengine/engine/src/initializeEngine'
import querystring from 'querystring'
import React, { useEffect } from 'react'
import { useDispatch } from '@xrengine/client-core/src/store'
import url from 'url'
import { retriveLocationByName } from './LocationLoadHelper'
import { useChatState } from '@xrengine/client-core/src/social/services/ChatService'
import { useInstanceConnectionState } from '@xrengine/client-core/src/common/services/InstanceConnectionService'
import { InstanceConnectionService } from '@xrengine/client-core/src/common/services/InstanceConnectionService'
import { ChannelConnectionService } from '@xrengine/client-core/src/common/services/ChannelConnectionService'

interface Props {
  locationName: string
  history?: any
  engineInitializeOptions?: InitializeOptions
  //doLoginAuto?: typeof doLoginAuto

  showTouchpad?: boolean
  children?: any
  chatState?: any
  sceneId: any
  //reinit: any
  isUserBanned: any
  setIsValidLocation: any
}

export const NetworkInstanceProvisioning = (props: Props) => {
  const { sceneId, isUserBanned, setIsValidLocation } = props

  const authState = useAuthState()
  const selfUser = authState.user
  const userState = useUserState()
  const dispatch = useDispatch()
  const chatState = useChatState()
  const locationState = useLocationState()
  const instanceConnectionState = useInstanceConnectionState()
  useEffect(() => {
    if (selfUser?.instanceId.value != null && userState.layerUsersUpdateNeeded.value === true)
      UserService.getLayerUsers(true)
    if (selfUser?.channelInstanceId.value != null && userState.channelLayerUsersUpdateNeeded.value === true)
      UserService.getLayerUsers(false)
  }, [selfUser, userState.layerUsersUpdateNeeded.value, userState.channelLayerUsersUpdateNeeded.value])

  useEffect(() => {
    AuthService.doLoginAuto(true)
    EngineEvents.instance.addEventListener(EngineEvents.EVENTS.RESET_ENGINE, async (ev: any) => {
      if (!ev.instance) return

      await shutdownEngine()
      InstanceConnectionService.resetInstanceServer()

      if (!isUserBanned) {
        retriveLocationByName(authState, props.locationName, history)
      }
    })
  }, [])

  useEffect(() => {
    const currentLocation = locationState.currentLocation.location

    if (currentLocation.id?.value) {
      if (
        !isUserBanned &&
        !instanceConnectionState.instanceProvisioned.value &&
        !instanceConnectionState.instanceProvisioning.value
      ) {
        const search = window.location.search
        let instanceId

        if (search != null) {
          const parsed = url.parse(window.location.href)
          const query = querystring.parse(parsed.query!)
          instanceId = query.instanceId
        }

        InstanceConnectionService.provisionInstanceServer(currentLocation.id.value, instanceId || undefined, sceneId)
      }
    } else {
      if (!locationState.currentLocationUpdateNeeded.value && !locationState.fetchingCurrentLocation.value) {
        setIsValidLocation(false)
        dispatch(AppAction.setAppSpecificOnBoardingStep(GeneralStateList.FAILED, false))
      }
    }
  }, [locationState.currentLocation.location.value])

  useEffect(() => {
    if (
      instanceConnectionState.instanceProvisioned.value &&
      instanceConnectionState.updateNeeded.value &&
      !instanceConnectionState.instanceServerConnecting.value &&
      !instanceConnectionState.connected.value
    ) {
      // TODO: fix up reinitialisation - we need to handle this more gently
      // reinit()
    }
  }, [instanceConnectionState])

  useEffect(() => {
    if (chatState.instanceChannelFetched.value) {
      const channels = chatState.channels.channels.value
      const instanceChannel = Object.values(channels).find((channel) => channel.channelType === 'instance')
      ChannelConnectionService.provisionChannelServer(instanceChannel?.id)
    }
  }, [chatState.instanceChannelFetched.value])

  return <></>
}

const connector = NetworkInstanceProvisioning

export default connector
