import { CAM_VIDEO_SIMULCAST_ENCODINGS } from '@xrengine/engine/src/networking/constants/VideoConstants'
import { MessageTypes } from '@xrengine/engine/src/networking/enums/MessageTypes'
import { MediaStreams } from '@xrengine/engine/src/networking/systems/MediaStreamSystem'
import { DataProducer, Transport as MediaSoupTransport } from 'mediasoup-client/lib/types'
import { EngineEvents } from '@xrengine/engine/src/ecs/classes/EngineEvents'
import { Network, TransportTypes, TransportType } from '@xrengine/engine/src/networking/classes/Network'
import { SocketWebRTCClientMediaTransport, SocketWebRTCClientTransport } from './SocketWebRTCClientTransport'
import { dispatchLocal } from '@xrengine/engine/src/networking/functions/dispatchFrom'
import { EngineActions } from '@xrengine/engine/src/ecs/classes/EngineService'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Action } from '@xrengine/engine/src/networking/interfaces/Action'
import { accessAuthState } from '../user/services/AuthService'
import { MediaStreamService } from '../media/services/MediaStreamService'
import { InstanceConnectionAction } from '../common/services/InstanceConnectionService'
import { useDispatch } from '../store'
import { ChannelConnectionAction } from '../common/services/ChannelConnectionService'

export async function onConnectToInstance(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport
) {
  const dispatch = useDispatch()

  const isWorldConnection = !(networkTransport as SocketWebRTCClientMediaTransport).channelType

  if (isWorldConnection) {
    dispatch(InstanceConnectionAction.instanceServerConnected())
  } else {
    dispatch(ChannelConnectionAction.channelServerConnected())
  }

  const authState = accessAuthState()
  const token = authState.authUser.accessToken.value
  const payload = { userId: Engine.userId, accessToken: token }

  const { success } = await new Promise<any>((resolve) => {
    const interval = setInterval(async () => {
      const response = await networkTransport.request(MessageTypes.Authorization.toString(), payload)
      clearInterval(interval)
      resolve(response)
    }, 1000)
  })

  if (!success) return console.error('Unable to connect with credentials')

  let ConnectToWorldResponse
  try {
    ConnectToWorldResponse = await Promise.race([
      await networkTransport.request(MessageTypes.ConnectToWorld.toString()),
      new Promise((resolve, reject) => {
        setTimeout(() => !ConnectToWorldResponse && reject(new Error('Connect timed out')), 10000)
      })
    ])
  } catch (err) {
    console.log(err)
    dispatchLocal(EngineActions.connectToWorldTimeout() as any)
    return
  }
  const { routerRtpCapabilities } = ConnectToWorldResponse as any
  dispatchLocal(EngineActions.connectToWorld() as any)

  if (networkTransport.mediasoupDevice.loaded !== true)
    await networkTransport.mediasoupDevice.load({ routerRtpCapabilities })

  networkTransport.socket.on(MessageTypes.ActionData.toString(), (message) => {
    if (!message) return
    const actions = message as any as Required<Action>[]
    // const actions = decode(new Uint8Array(message)) as IncomingActionType[]
    for (const a of actions) {
      Engine.currentWorld!.incomingActions.add(a)
    }
  })

  // use sendBeacon to tell the server we're disconnecting when
  // the page unloads
  window.addEventListener('unload', async () => {
    // TODO: Handle this as a full disconnect
    networkTransport.socket.emit(MessageTypes.LeaveWorld.toString())
  })

  networkTransport.socket.on(MessageTypes.Kick.toString(), async (message) => {
    // console.log("TODO: SNACKBAR HERE");
    await endVideoChat(networkTransport as SocketWebRTCClientMediaTransport, { endConsumers: true })
    await leave(networkTransport, true)
    EngineEvents.instance.dispatchEvent({
      type: SocketWebRTCClientTransport.EVENTS.INSTANCE_KICKED,
      message: message
    })
    console.log('Client has been kicked from the world')
  })

  // Get information for how to consume data from server and init a data consumer
  networkTransport.socket.on(MessageTypes.WebRTCConsumeData.toString(), async (options) => {
    console.log('WebRTCConsumeData', options)
    const dataConsumer = await networkTransport.recvTransport.consumeData(options)

    // Firefox uses blob as by default hence have to convert binary type of data consumer to 'arraybuffer' explicitly.
    dataConsumer.binaryType = 'arraybuffer'
    Network.instance.dataConsumers.set(options.dataProducerId, dataConsumer)

    dataConsumer.on('message', (message: any) => {
      try {
        Network.instance.incomingMessageQueueUnreliable.add(message)
        Network.instance.incomingMessageQueueUnreliableIDs.add(options.dataProducerId)
      } catch (error) {
        console.warn('Error handling data from consumer:')
        console.warn(error)
      }
    }) // Handle message received
    dataConsumer.on('close', () => {
      dataConsumer.close()
      Network.instance.dataConsumers.delete(options.dataProducerId)
    })
  })

  networkTransport.socket.on(
    MessageTypes.WebRTCCreateProducer.toString(),
    async (socketId, mediaTag, producerId, channelType, channelId) => {
      console.log('WebRTCCreateProducer', socketId, mediaTag, producerId, channelType, channelId)
      const selfProducerIds = [MediaStreams.instance?.camVideoProducer?.id, MediaStreams.instance?.camAudioProducer?.id]

      if (
        producerId != null &&
        // channelType === self.channelType &&
        selfProducerIds.indexOf(producerId) < 0 &&
        // (MediaStreams.instance?.consumers?.find(
        //   c => c?.appData?.peerId === socketId && c?.appData?.mediaTag === mediaTag
        // ) == null /*&&
        (channelType === TransportTypes.instance
          ? (networkTransport as any).channelType === TransportTypes.instance
          : (networkTransport as any).channelType === channelType && (networkTransport as any).channelId === channelId)
      ) {
        // that we don't already have consumers for...
        await subscribeToTrack(networkTransport as SocketWebRTCClientMediaTransport, socketId, mediaTag)
      }
    }
  )

  if (isWorldConnection) await onConnectToWorldInstance(networkTransport as SocketWebRTCClientTransport)
  else await onConnectToMediaInstance(networkTransport as SocketWebRTCClientMediaTransport)
}

export async function onConnectToWorldInstance(networkTransport: SocketWebRTCClientTransport) {
  networkTransport.socket.on('disconnect', async () => {
    EngineEvents.instance.dispatchEvent({ type: SocketWebRTCClientTransport.EVENTS.INSTANCE_DISCONNECTED })
    networkTransport.reconnecting = true
  })
  networkTransport.socket.io.on('reconnect', async () => {
    EngineEvents.instance.dispatchEvent({ type: SocketWebRTCClientTransport.EVENTS.INSTANCE_RECONNECTED })
    networkTransport.reconnecting = true
    console.log('socket reconnect')
  })

  EngineEvents.instance.addEventListener(MediaStreams.EVENTS.UPDATE_NEARBY_LAYER_USERS, async () => {
    const { userIds } = await networkTransport.request(MessageTypes.WebRTCRequestNearbyUsers.toString())
    await networkTransport.request(MessageTypes.WebRTCRequestCurrentProducers.toString(), {
      userIds: userIds || [],
      channelType: TransportTypes.instance
    })
    MediaStreamService.triggerUpdateNearbyLayerUsers()
  })
  await Promise.all([initSendTransport(networkTransport), initReceiveTransport(networkTransport)])
  await createDataProducer(networkTransport, TransportTypes.instance)
}

export async function onConnectToMediaInstance(networkTransport: SocketWebRTCClientMediaTransport) {
  networkTransport.socket.on('disconnect', async () => {
    EngineEvents.instance.dispatchEvent({ type: SocketWebRTCClientTransport.EVENTS.CHANNEL_DISCONNECTED })
    networkTransport.reconnecting = true
  })
  networkTransport.socket.io.on('reconnect', async () => {
    EngineEvents.instance.dispatchEvent({ type: SocketWebRTCClientTransport.EVENTS.CHANNEL_RECONNECTED })
  })

  networkTransport.socket.on(MessageTypes.WebRTCPauseConsumer.toString(), async (consumerId) => {
    if (MediaStreams.instance) {
      const consumer = MediaStreams.instance.consumers.find((c) => c.id === consumerId)
      consumer.pause()
    }
  })

  networkTransport.socket.on(MessageTypes.WebRTCResumeConsumer.toString(), async (consumerId) => {
    if (MediaStreams.instance) {
      const consumer = MediaStreams.instance.consumers.find((c) => c.id === consumerId)
      consumer.resume()
    }
  })

  networkTransport.socket.on(MessageTypes.WebRTCCloseConsumer.toString(), async (consumerId) => {
    if (MediaStreams.instance)
      MediaStreams.instance.consumers = MediaStreams.instance.consumers.filter((c) => c.id !== consumerId)
    EngineEvents.instance.dispatchEvent({ type: MediaStreams.EVENTS.TRIGGER_UPDATE_CONSUMERS })
  })

  EngineEvents.instance.addEventListener(MediaStreams.EVENTS.CLOSE_CONSUMER, (consumer) =>
    closeConsumer(networkTransport, consumer.consumer)
  )

  await initRouter(networkTransport)
  await Promise.all([initSendTransport(networkTransport), initReceiveTransport(networkTransport)])
  const { userIds } = await networkTransport.request(MessageTypes.WebRTCRequestNearbyUsers.toString())

  await networkTransport.request(MessageTypes.WebRTCRequestCurrentProducers.toString(), {
    userIds: userIds || [],
    channelType: TransportTypes.media,
    channelId: networkTransport.channelId
  })
}

export async function createDataProducer(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport,
  channel,
  type = 'raw',
  customInitInfo: any = {}
): Promise<void> {
  const sendTransport = networkTransport.sendTransport
  // else if (MediaStreams.instance.dataProducers.get(channel)) return Promise.reject(new Error('Data channel already exists!'))
  const dataProducer = await sendTransport.produceData({
    appData: { data: customInitInfo },
    ordered: false,
    label: channel,
    maxPacketLifeTime: 3000,
    // maxRetransmits: 3,
    protocol: type // sub-protocol for type of data to be transmitted on the channel e.g. json, raw etc. maybe make type an enum rather than string
  })
  // dataProducer.on("open", () => {
  //     networkTransport.dataProducer.send(JSON.stringify({ info: 'init' }));
  // });
  dataProducer.on('transportclose', () => {
    networkTransport.dataProducer?.close()
  })
  networkTransport.dataProducer = dataProducer
}
// utility function to create a transport and hook up signaling logic
// appropriate to the transport's direction

export async function createTransport(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport,
  direction: string
) {
  const request = networkTransport.request
  if (request === null) return null!

  const channelType = (networkTransport as SocketWebRTCClientMediaTransport).channelType ?? 'instance'
  const channelId = (networkTransport as SocketWebRTCClientMediaTransport).channelId ?? null

  // ask the server to create a server-side transport object and send
  // us back the info we need to create a client-side transport
  let transport: MediaSoupTransport

  console.log('Requesting transport creation', direction, channelType, channelId)

  const { transportOptions } = await networkTransport.request(MessageTypes.WebRTCTransportCreate.toString(), {
    direction,
    sctpCapabilities: networkTransport.mediasoupDevice.sctpCapabilities,
    channelType: channelType,
    channelId: channelId
  })

  if (direction === 'recv') transport = await networkTransport.mediasoupDevice.createRecvTransport(transportOptions)
  else if (direction === 'send')
    transport = await networkTransport.mediasoupDevice.createSendTransport(transportOptions)
  else throw new Error(`bad transport 'direction': ${direction}`)

  console.log(transport)

  // mediasoup-client will emit a connect event when media needs to
  // start flowing for the first time. send dtlsParameters to the
  // server, then call callback() on success or errback() on failure.
  transport.on('connect', async ({ dtlsParameters }: any, callback: () => void, errback: () => void) => {
    console.log('\n\n\n\nWebRTCTransportConnect', direction, dtlsParameters, transportOptions, '\n\n\n')
    const connectResult = await networkTransport.request(MessageTypes.WebRTCTransportConnect.toString(), {
      transportId: transportOptions.id,
      dtlsParameters
    })

    if (connectResult.error) {
      console.log('Transport connect error')
      console.log(connectResult.error)
      return errback()
    }

    callback()
  })

  if (direction === 'send') {
    transport.on(
      'produce',
      async ({ kind, rtpParameters, appData }: any, callback: (arg0: { id: any }) => void, errback: () => void) => {
        let paused = false
        if (appData.mediaTag === 'cam-video') paused = MediaStreams.instance.videoPaused
        else if (appData.mediaTag === 'cam-audio') paused = MediaStreams.instance.audioPaused

        // tell the server what it needs to know from us in order to set
        // up a server-side producer object, and get back a
        // producer.id. call callback() on success or errback() on
        // failure.
        const { error, id } = await networkTransport.request(MessageTypes.WebRTCSendTrack.toString(), {
          transportId: transportOptions.id,
          kind,
          rtpParameters,
          paused,
          appData
        })
        if (error) {
          errback()
          console.log(error)
          return
        }
        callback({ id })
      }
    )

    transport.on('producedata', async (parameters: any, callback: (arg0: { id: any }) => void, errback: () => void) => {
      console.log('producedata', parameters)
      const { sctpStreamParameters, label, protocol, appData } = parameters
      const { error, id } = await networkTransport.request(MessageTypes.WebRTCProduceData, {
        transportId: transport.id,
        sctpStreamParameters,
        label,
        protocol,
        appData
      })

      if (error) {
        console.log(error)
        errback()
        return
      }

      return callback({ id })
    })
  }

  // any time a transport transitions to closed,
  // failed, or disconnected, leave the  and reset
  transport.on('connectionstatechange', async (state: string) => {
    if (networkTransport.leaving !== true && (state === 'closed' || state === 'failed' || state === 'disconnected')) {
      EngineEvents.instance.dispatchEvent({ type: SocketWebRTCClientTransport.EVENTS.INSTANCE_DISCONNECTED })
      console.error('Transport', transport, ' transitioned to state', state)
      console.error(
        'If this occurred unexpectedly shortly after joining a world, check that the gameserver nodegroup has public IP addresses.'
      )
      console.log('Waiting 5 seconds to make a new transport')
      setTimeout(async () => {
        console.log(
          'Re-creating transport',
          direction,
          channelType,
          channelId,
          ' after unexpected closing/fail/disconnect'
        )
        await createTransport(networkTransport, direction)
        console.log('Re-created transport', direction, channelType, channelId)
      }, 5000)
      // await request(MessageTypes.WebRTCTransportClose.toString(), {transportId: transport.id});
    }
    // if (networkTransport.leaving !== true && state === 'connected' && transport.direction === 'recv') {
    //   console.log('requesting current producers for', channelType, channelId)
    //   await request(MessageTypes.WebRTCRequestCurrentProducers.toString(), {
    //     channelType: channelType,
    //     channelId: channelId
    //   })
    // }
  })
  ;(transport as any).channelType = channelType
  ;(transport as any).channelId = channelId

  return transport
}

export async function initReceiveTransport(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport
): Promise<void> {
  networkTransport.recvTransport = await createTransport(networkTransport, 'recv')
}

export async function initSendTransport(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport
): Promise<void> {
  networkTransport.sendTransport = await createTransport(networkTransport, 'send')
}

export async function initRouter(networkTransport: SocketWebRTCClientMediaTransport): Promise<void> {
  await networkTransport.request(MessageTypes.InitializeRouter.toString(), {
    channelType: networkTransport.channelType,
    channelId: networkTransport.channelId
  })
}

export async function configureMediaTransports(
  networkTransport: SocketWebRTCClientMediaTransport,
  mediaTypes: string[]
): Promise<boolean> {
  if (mediaTypes.indexOf('video') > -1 && MediaStreams.instance.videoStream == null) {
    await MediaStreams.instance.startCamera()

    if (MediaStreams.instance.videoStream == null) {
      console.warn('Video stream is null, camera must have failed or be missing')
      return false
    }
  }

  if (mediaTypes.indexOf('audio') > -1 && MediaStreams.instance.audioStream == null) {
    await MediaStreams.instance.startMic()

    if (MediaStreams.instance.audioStream == null) {
      console.warn('Audio stream is null, mic must have failed or be missing')
      return false
    }
  }

  //This probably isn't needed anymore with channels handling all audio and video, but left it in and commented
  //just in case.
  // if (
  //   networkTransport.sendTransport == null ||
  //     networkTransport.sendTransport.closed === true ||
  //     networkTransport.sendTransport.connectionState === 'disconnected'
  // ) {
  //   await initRouter(networkTransport)
  //   await Promise.all([initSendTransport(networkTransport), initReceiveTransport(networkTransport)])
  // }
  return true
}

export async function createCamVideoProducer(networkTransport: SocketWebRTCClientMediaTransport): Promise<void> {
  const channelType = networkTransport.channelType
  const channelId = networkTransport.channelId
  if (MediaStreams.instance.videoStream !== null && networkTransport.videoEnabled === true) {
    if (networkTransport.sendTransport == null) {
      await new Promise((resolve) => {
        const waitForTransportReadyInterval = setInterval(() => {
          if (networkTransport.sendTransport) {
            clearInterval(waitForTransportReadyInterval)
            resolve(true)
          }
        }, 100)
      })
    }

    const transport = networkTransport.sendTransport
    try {
      MediaStreams.instance.camVideoProducer = await transport.produce({
        track: MediaStreams.instance.videoStream.getVideoTracks()[0],
        encodings: CAM_VIDEO_SIMULCAST_ENCODINGS,
        appData: { mediaTag: 'cam-video', channelType: channelType, channelId: channelId }
      })

      if (MediaStreams.instance.videoPaused) await MediaStreams.instance?.camVideoProducer.pause()
      else await resumeProducer(networkTransport, MediaStreams.instance.camVideoProducer)
    } catch (err) {
      console.log('error producing video', err)
    }
  }
}

export async function createCamAudioProducer(networkTransport: SocketWebRTCClientMediaTransport): Promise<void> {
  const channelType = networkTransport.channelType
  const channelId = networkTransport.channelId
  if (MediaStreams.instance.audioStream !== null) {
    //To control the producer audio volume, we need to clone the audio track and connect a Gain to it.
    //This Gain is saved on MediaStreamSystem so it can be accessed from the user's component and controlled.
    const audioTrack = MediaStreams.instance.audioStream.getAudioTracks()[0]
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]))
    const dst = ctx.createMediaStreamDestination()
    const gainNode = ctx.createGain()
    gainNode.gain.value = 1
    ;[src, gainNode, dst].reduce((a, b) => a && (a.connect(b) as any))
    MediaStreams.instance.audioGainNode = gainNode
    MediaStreams.instance.audioStream.removeTrack(audioTrack)
    MediaStreams.instance.audioStream.addTrack(dst.stream.getAudioTracks()[0])
    // same thing for audio, but we can use our already-created

    if (networkTransport.sendTransport == null) {
      await new Promise((resolve) => {
        const waitForTransportReadyInterval = setInterval(() => {
          if (networkTransport.sendTransport) {
            clearInterval(waitForTransportReadyInterval)
            resolve(true)
          }
        }, 100)
      })
    }

    const transport = networkTransport.sendTransport
    try {
      // Create a new transport for audio and start producing
      MediaStreams.instance.camAudioProducer = await transport.produce({
        track: MediaStreams.instance.audioStream.getAudioTracks()[0],
        appData: { mediaTag: 'cam-audio', channelType: channelType, channelId: channelId }
      })

      if (MediaStreams.instance.audioPaused) MediaStreams.instance?.camAudioProducer.pause()
      else await resumeProducer(networkTransport, MediaStreams.instance.camAudioProducer)
    } catch (err) {
      console.log('error producing audio', err)
    }
  }
}

export async function endVideoChat(
  networkTransport: SocketWebRTCClientMediaTransport,
  options: { leftParty?: boolean; endConsumers?: boolean }
): Promise<boolean> {
  if (networkTransport) {
    try {
      const request = networkTransport.request
      const socket = networkTransport.socket
      if (MediaStreams.instance?.camVideoProducer) {
        if (socket.connected === true && typeof request === 'function')
          await request(MessageTypes.WebRTCCloseProducer.toString(), {
            producerId: MediaStreams.instance?.camVideoProducer.id
          })
        await MediaStreams.instance?.camVideoProducer?.close()
      }

      if (MediaStreams.instance?.camAudioProducer) {
        if (socket.connected === true && typeof request === 'function')
          await request(MessageTypes.WebRTCCloseProducer.toString(), {
            producerId: MediaStreams.instance?.camAudioProducer.id
          })
        await MediaStreams.instance?.camAudioProducer?.close()
      }

      if (MediaStreams.instance?.screenVideoProducer) {
        if (socket.connected === true && typeof request === 'function')
          await request(MessageTypes.WebRTCCloseProducer.toString(), {
            producerId: MediaStreams.instance.screenVideoProducer.id
          })
        await MediaStreams.instance.screenVideoProducer?.close()
      }
      if (MediaStreams.instance?.screenAudioProducer) {
        if (socket.connected === true && typeof request === 'function')
          await request(MessageTypes.WebRTCCloseProducer.toString(), {
            producerId: MediaStreams.instance.screenAudioProducer.id
          })
        await MediaStreams.instance.screenAudioProducer?.close()
      }

      if (options?.endConsumers === true) {
        MediaStreams.instance?.consumers.map(async (c) => {
          if (request && typeof request === 'function')
            await request(MessageTypes.WebRTCCloseConsumer.toString(), {
              consumerId: c.id
            })
          await c.close()
        })
      }

      if (networkTransport.recvTransport != null && networkTransport.recvTransport.closed !== true)
        await networkTransport.recvTransport.close()
      if (networkTransport.sendTransport != null && networkTransport.sendTransport.closed !== true)
        await networkTransport.sendTransport.close()

      resetProducer()
      return true
    } catch (err) {
      console.log('EndvideoChat error')
      console.log(err)
    }
  }
  return true // should this return true or false??
}

export function resetProducer(): void {
  if (MediaStreams) {
    if (MediaStreams.instance.audioStream) {
      const audioTracks = MediaStreams.instance.audioStream?.getTracks()
      audioTracks.forEach((track) => track.stop())
    }
    if (MediaStreams.instance.videoStream) {
      const videoTracks = MediaStreams.instance.videoStream?.getTracks()
      videoTracks.forEach((track) => track.stop())
    }
    MediaStreams.instance.camVideoProducer = null
    MediaStreams.instance.camAudioProducer = null
    MediaStreams.instance.screenVideoProducer = null
    MediaStreams.instance.screenAudioProducer = null
    MediaStreams.instance.audioStream = null!
    MediaStreams.instance.videoStream = null!
    MediaStreams.instance.localScreen = null
    // MediaStreams.instance.instance?.consumers = [];
  }
}

export async function subscribeToTrack(
  networkTransport: SocketWebRTCClientMediaTransport,
  peerId: string,
  mediaTag: string
) {
  const socket = networkTransport.socket
  if (!socket?.connected) return

  const channelType = networkTransport.channelType
  const channelId = networkTransport.channelId
  // if we do already have a consumer, we shouldn't have called this method
  let consumer = MediaStreams.instance?.consumers.find(
    (c: any) => c.appData.peerId === peerId && c.appData.mediaTag === mediaTag
  )

  // ask the server to create a server-side consumer object and send us back the info we need to create a client-side consumer
  const consumerParameters = await networkTransport.request(MessageTypes.WebRTCReceiveTrack.toString(), {
    mediaTag,
    mediaPeerId: peerId,
    rtpCapabilities: networkTransport.mediasoupDevice.rtpCapabilities,
    channelType: channelType,
    channelId: channelId
  })

  // Only continue if we have a valid id
  if (consumerParameters?.id == null) return

  consumer = await networkTransport.recvTransport.consume({
    ...consumerParameters,
    appData: { peerId, mediaTag, channelType },
    paused: true
  })

  const existingConsumer = MediaStreams.instance?.consumers?.find(
    (c) => c?.appData?.peerId === peerId && c?.appData?.mediaTag === mediaTag
  )
  if (existingConsumer == null) {
    MediaStreams.instance?.consumers.push(consumer)
    EngineEvents.instance.dispatchEvent({ type: MediaStreams.EVENTS.TRIGGER_UPDATE_CONSUMERS })
    MediaStreamService.triggerUpdateNearbyLayerUsers()

    // okay, we're ready. let's ask the peer to send us media
    await resumeConsumer(networkTransport, consumer)
  } else if (existingConsumer?._track?.muted) {
    await closeConsumer(networkTransport, existingConsumer)
    console.log('consumers before splice', MediaStreams.instance?.consumers)
    // MediaStreams.instance?.consumers.splice(existingConsumerIndex, 0, consumer) // existingConsumerIndex is undefined...
    console.log('consumers after splice', MediaStreams.instance?.consumers)
    EngineEvents.instance.dispatchEvent({ type: MediaStreams.EVENTS.TRIGGER_UPDATE_CONSUMERS })
    MediaStreamService.triggerUpdateNearbyLayerUsers()

    // okay, we're ready. let's ask the peer to send us media
    await resumeConsumer(networkTransport, consumer)
  } else await closeConsumer(networkTransport, consumer)
}

export async function unsubscribeFromTrack(transport: SocketWebRTCClientMediaTransport, peerId: any, mediaTag: any) {
  const consumer = MediaStreams.instance?.consumers.find(
    (c) => c.appData.peerId === peerId && c.appData.mediaTag === mediaTag
  )
  await closeConsumer(transport, consumer)
}

export async function pauseConsumer(
  transport: SocketWebRTCClientMediaTransport,
  consumer: { appData: { peerId: any; mediaTag: any }; id: any; pause: () => any }
) {
  await transport.request(MessageTypes.WebRTCPauseConsumer.toString(), {
    consumerId: consumer.id
  })
  await consumer.pause()
}

export async function resumeConsumer(
  transport: SocketWebRTCClientMediaTransport,
  consumer: {
    appData: { peerId: any; mediaTag: any }
    id: any
    resume: () => any
  }
) {
  await transport.request(MessageTypes.WebRTCResumeConsumer.toString(), {
    consumerId: consumer.id
  })
  await consumer.resume()
}

export async function pauseProducer(
  transport: SocketWebRTCClientMediaTransport,
  producer: { appData: { mediaTag: any }; id: any; pause: () => any }
) {
  await transport.request(MessageTypes.WebRTCPauseProducer.toString(), {
    producerId: producer.id
  })
  await producer.pause()
}

export async function resumeProducer(
  transport: SocketWebRTCClientMediaTransport,
  producer: { appData: { mediaTag: any }; id: any; resume: () => any }
) {
  await transport.request(MessageTypes.WebRTCResumeProducer.toString(), {
    producerId: producer.id
  })
  await producer.resume()
}

export async function globalMuteProducer(transport: SocketWebRTCClientMediaTransport, producer: { id: any }) {
  await transport.request(MessageTypes.WebRTCPauseProducer.toString(), {
    producerId: producer.id,
    globalMute: true
  })
}

export async function globalUnmuteProducer(transport: SocketWebRTCClientMediaTransport, producer: { id: any }) {
  await transport.request(MessageTypes.WebRTCResumeProducer.toString(), {
    producerId: producer.id
  })
}

export async function closeConsumer(transport: SocketWebRTCClientMediaTransport, consumer: any) {
  await transport.request(MessageTypes.WebRTCCloseConsumer.toString(), {
    consumerId: consumer.id
  })
  await consumer.close()

  MediaStreams.instance.consumers = MediaStreams.instance?.consumers.filter(
    (c: any) => !(c.id === consumer.id)
  ) as any[]
}

export async function leave(
  networkTransport: SocketWebRTCClientTransport | SocketWebRTCClientMediaTransport,
  kicked?: boolean
) {
  try {
    networkTransport.leaving = true
    const socket = networkTransport.socket
    if (kicked !== true && socket.connected === true) {
      // close everything on the server-side (transports, producers, consumers)
      const result = await Promise.race([
        await networkTransport.request(MessageTypes.LeaveWorld.toString()),
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Connect timed out')), 10000)
        })
      ])
      if (result?.error) console.error(result.error)
      dispatchLocal(EngineActions.leaveWorld() as any)
    }

    networkTransport.leaving = false
    networkTransport.left = true

    //Leaving the world should close all transports from the server side.
    //This will also destroy all the associated producers and consumers.
    //All we need to do on the client is null all references.
    networkTransport.close()
    // TODO // networkTransport.close(instance, !instance)

    if (socket && socket.close) socket.close()
  } catch (err) {
    console.log('Error with leave()')
    console.log(err)
    networkTransport.leaving = false
  }
}

// async startScreenshare(): Promise<boolean> {
//   console.log("start screen share");
//
//   // make sure we've joined the  and that we have a sending transport
//   if (!transport.sendTransport) transport.sendTransport = await transport.createTransport("send");
//
//   // get a screen share track
//   MediaStreamSystem.localScreen = await (navigator.mediaDevices as any).getDisplayMedia(
//     { video: true, audio: true }
//   );
//
//   // create a producer for video
//   MediaStreamSystem.screenVideoProducer = await transport.sendTransport.produce({
//     track: MediaStreamSystem.localScreen.getVideoTracks()[0],
//     encodings: [], // TODO: Add me
//     appData: { mediaTag: "screen-video" }
//   });
//
//   // create a producer for audio, if we have it
//   if (MediaStreamSystem.localScreen.getAudioTracks().length) {
//     MediaStreamSystem.screenAudioProducer = await transport.sendTransport.produce({
//       track: MediaStreamSystem.localScreen.getAudioTracks()[0],
//       appData: { mediaTag: "screen-audio" }
//     });
//   }
//
//   // handler for screen share stopped event (triggered by the
//   // browser's built-in screen sharing ui)
//   MediaStreamSystem.screenVideoProducer.track.onended = async () => {
//     console.log("screen share stopped");
//     await MediaStreamSystem.screenVideoProducer.pause();
//
//     const { error } = await transport.request(MessageTypes.WebRTCCloseProducer.toString(), {
//       producerId: MediaStreamSystem.screenVideoProducer.id
//     });
//
//     await MediaStreamSystem.screenVideoProducer.close();
//     MediaStreamSystem.screenVideoProducer = null;
//     if (MediaStreamSystem.screenAudioProducer) {
//       const { error: screenAudioProducerError } = await transport.request(MessageTypes.WebRTCCloseProducer.toString(), {
//         producerId: MediaStreamSystem.screenAudioProducer.id
//       });
//
//       await MediaStreamSystem.screenAudioProducer.close();
//       MediaStreamSystem.screenAudioProducer = null;
//     }
//   };
//   return true;
// }
