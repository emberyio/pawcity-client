/**
 * This file constains declaration of Engine Class.
 *
 * @author Fernando Serrano, Robert Long
 * @packageDocumentation
 */

import { UserId } from '@xrengine/common/src/interfaces/UserId'
import {
  DirectionalLight,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  WebXRManager,
  XRFrame,
  XRSession
} from 'three'
import { CSM } from '../../assets/csm/CSM'
import { isBot } from '../../common/functions/isBot'
import { InputValue } from '../../input/interfaces/InputValue'
import { EffectComposerWithSchema } from '../../renderer/WebGLRendererSystem'
import { World } from '../classes/World'
import { Entity } from './Entity'

/**
 * This is the base class which holds all the data related to the scene, camera,system etc.
 * Data is holded statically hence will be available everywhere.
 *
 * @author Josh, Vyacheslav, Gheric and the XREngine Team
 */
export class Engine {
  /** The uuid of the logged-in user */
  public static userId: UserId

  public static engineTimer: { start: Function; stop: Function; clear: Function } = null!

  public static xrSupported = false
  public static isBot = 'window' in globalThis ? isBot(window) : false

  public static isHMD = false

  /**
   * The current world
   */
  public static currentWorld: World = null!

  /**
   * All worlds that are currently instantiated
   */
  public static worlds: World[] = []

  /**
   * Reference to the three.js renderer object.
   */
  static renderer: WebGLRenderer = null!
  static effectComposer: EffectComposerWithSchema = null!
  static xrManager: WebXRManager = null!
  static xrSession: XRSession = null!
  static csm: CSM = null!
  static isCSMEnabled = false
  static directionalLights: DirectionalLight[] = []
  /**
   * Reference to the three.js scene object.
   */
  static scene: Scene = null!
  static sceneLoaded = false
  static sceneLoadPromises: Promise<void>[] = []

  /**
   * Map of object lists by layer
   * (automatically updated by the SceneObjectSystem)
   */
  static objectLayerList = {} as { [layer: number]: Set<Object3D> }

  /**
   * Reference to the three.js perspective camera object.
   */
  static camera: PerspectiveCamera | OrthographicCamera = null!
  static activeCameraEntity: Entity
  static activeCameraFollowTarget: Entity | null

  /**
   * Reference to the audioListener.
   * This is a virtual listner for all positional and non-positional audio.
   */
  static audioListener: any = null

  static inputState = new Map<any, InputValue>()
  static prevInputState = new Map<any, InputValue>()

  static isInitialized = false
  static isReady = false

  static hasJoinedWorld = false

  static publicPath: string

  static workers = [] as any[]
  static simpleMaterials = false

  static mouseInputEnabled = true
  static keyboardInputEnabled = true

  static xrFrame: XRFrame

  static isEditor = false
}
