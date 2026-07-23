/*
===============================================
  ● 파일명: AcsCanvas 기능 정의 스토어
  ● 설  명: AcsCanvas.vue에 적용할 기능을 정의
  ● 작성자: 여강동
  ● 작성일: 2025-08-26
===============================================
*/
import * as THREE from 'three'
import { defineStore } from 'pinia'
import { ref, computed, markRaw, toRaw, watch } from 'vue'
import { stores as Stores } from '@ifacts/ui-core'
import API from '@/views/Apis'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useNodeStore } from '@/stores/monitoring/map/nodeStore'
import { usePathStore } from '@/stores/monitoring/map/pathStore'
import { usePortStore } from '@/stores/monitoring/map/portStore'
import { useShelfStore } from '@/stores/monitoring/map/shelfStore'
import { useVehicle2dStore } from '@/stores/monitoring/map/vehicle2dStore'
import { useVehicle3dStore } from '@/stores/monitoring/map/vehicle3dStore'
import { useMonitoringStore } from '@/stores/monitoring/monitoringStore'
import { commonConst } from '@/constants/commonConst'
import { createGridHelper } from '@/constants/gridHelper'
import { commonColor } from '@/constants/commonColor'
import { useOnOffSetStore } from '@/stores/monitoring/onOffSetStore'
import { SHAPE_GROUP_NAME, clearMapShapeRendererCaches, disposeShapeGroup, renderMapShapeGroup } from '@/utils/mapShapeRenderer'

export const useMapStore = defineStore('map', () => {
  const MAX_RENDER_PIXEL_RATIO = 1.45
  const TARGET_RENDER_FPS = 40
  const TARGET_FRAME_MS = 1000 / TARGET_RENDER_FPS

  const authStore = Stores.useAuthStore()
  const nodeStore = useNodeStore()
  const pathStore = usePathStore()
  const portStore = usePortStore()
  const shelfStore = useShelfStore()
  const vehicle2dStore = useVehicle2dStore()
  const vehicle3dStore = useVehicle3dStore()
  const monitoringStore = useMonitoringStore()
  const onOffSetStore = useOnOffSetStore()

  // 3D Scene을 담을 변수 (장면 생성)
  let scene = markRaw(new THREE.Scene()),
    camera, // 카메라를 담을 변수 (시점을 설정)
    renderer, // 렌더러를 담을 변수 (장면을 화면에 출력)
    controls // 사용자 조작을 위한 컨트롤 변수

  const renderTargetElement = ref(null)

  // 초기 카메라 위치
  const initCameraPosition = markRaw(new THREE.Vector3(0, 400, 300))

  // 카메라 정보 (OrbitControls 관련 상태)
  const cameraInfo = ref(null)

  // 컨트롤 정보 (OrbitControls 상태 관리)
  const controlsInfo = ref(null)

  // Default camera state saved on first render — used to reset zoom on zone search
  // 3D: { type: '3d', dist: number }  2D: { type: '2d', zoom: number }
  const defaultCameraState = ref(null)

  // 렌더러 정보 (Three.js Renderer 상태)
  const rendererInfo = ref(null)

  // 맵 준비 완료 여부
  const isMapReady = ref(false)

  const cameraTarget = ref(null)
  const sceneZoom = ref(0)

  const backgroundColor = ref('#DFDFDF')

  //맵 뷰 모드
  const isPerspective = ref('2d')

  // 애니메이션 타이밍 계산을 위한 시계 객체
  const clock = new THREE.Clock()
  const lastRenderTimestamp = ref(0)

  // [Optimization 1] Track RAF to prevent duplicate animate loops
  let animationFrameId = null
  // [Optimization 4] Throttle mousemove: allow only one update per frame
  let mouseMoveThrottled = true
  // [Optimization 4] Cache interactive object array; update only when scene changes
  let cachedInteractiveObjects = []
  let cachedInteractiveObjectsVersion = -1
  let interactiveCacheEpoch = 0

  const invalidateInteractiveObjectCache = () => {
    cachedInteractiveObjects = []
    cachedInteractiveObjectsVersion = -1
    interactiveCacheEpoch += 1
  }

  const getRaycastInteractiveObjects = () => {
    const rawNodeMeshes = Array.isArray(toRaw(nodeMeshes.value)) ? toRaw(nodeMeshes.value) : []
    const rawPortMeshes = Array.isArray(toRaw(portMeshes.value)) ? toRaw(portMeshes.value) : []
    const rawVhlMeshes = Array.isArray(toRaw(agvVehicles.value)) ? toRaw(agvVehicles.value) : []
    const rawLinkMeshes = Array.isArray(toRaw(linkMeshes.value)) ? toRaw(linkMeshes.value) : []
    const rawVhlLabelMeshes = Array.isArray(toRaw(vhlLabelMeshes.value)) ? toRaw(vhlLabelMeshes.value) : []
    const rawShelfMeshes = Array.isArray(toRaw(shelfMeshes.value)) ? toRaw(shelfMeshes.value) : []

    const currentVersion = [
      interactiveCacheEpoch,
      rawNodeMeshes.length,
      rawPortMeshes.length,
      rawVhlMeshes.length,
      rawLinkMeshes.length,
      rawVhlLabelMeshes.length,
      rawShelfMeshes.length
    ].join('|')

    if (
      cachedInteractiveObjectsVersion !== currentVersion ||
      cachedInteractiveObjects.length === 0
    ) {
      cachedInteractiveObjects = [
        ...rawVhlLabelMeshes,
        ...rawVhlMeshes,
        ...rawShelfMeshes,
        ...rawPortMeshes,
        ...rawNodeMeshes,
        ...rawLinkMeshes
      ]
      cachedInteractiveObjectsVersion = currentVersion
    }

    return {
      interactiveObjects: cachedInteractiveObjects,
      rawNodeMeshes,
      rawPortMeshes,
      rawVhlMeshes,
      rawLinkMeshes,
      rawVhlLabelMeshes,
      rawShelfMeshes
    }
  }

  const agvVehicles = ref([])
  const selectedVhl = ref([])
  const selectedVhlName = ref('')
  const selectedVhlPropsData = ref([])

  const acsMapVersion = ref('')
  const mapVersion = ref('')

  // 경로 및 노드 데이터
  const pathData = ref([])

  // 포트 데이터
  const portData = ref([])

  // AGV 타입 데이터
  const agvTypeData = ref([])

  // SCMD 데이터
  const scmdData = ref([])

  // SCMD 그룹 데이터
  const scmdGroupData = ref([])

  // POF 데이터
  const pofData = ref([])

  // 링크 비활성 설정 데이터 (SdOLinkDisable)
  const disableSettingData = ref([])

  // 알람 마스터 데이터 (SdOAlarmMst)
  const sdoAlaramMstData = ref([])

  // 센서 데이터
  const sensorData = ref([])

  // 맵 Shape 데이터
  const shapeData = ref([])

  // 공통 코드 데이터
  const commonCodeData = ref([])

  // 맵 유닛 데이터
  const mapUnitData = ref([])

  // 고정 차량 데이터 (SDO 기준)
  const sdoVhlData = ref([])

  // 실시간 차량 데이터 (RTK 기준)
  const mapRtkVhlData = ref([])

  // 실시간 서버 대시보드 데이터
  const dashboardData = ref([])

  // 이전 실시간 차량 데이터 (변경 감지용)
  const preMapRtkVhlData = ref([])

  // 지도 회전 각도 값
  const sceneAngle = 0

  // 화재 발생 상태값
  const fireState = ref('')

  // 메쉬 배열
  const gridMeshes = ref([]) // 격자 메쉬
  const nodeMeshes = ref([])
  const nodeIdMeshes = ref([])
  const nodeVirtualIdMeshes = ref([])
  const pathMeshes = ref([])
  const portMeshes = ref([])
  const portIdMeshes = ref([])
  const portNameMeshes = ref([])
  const linkMeshes = ref([])
  const vhlLabelMeshes = ref([])
  const shelfMeshes = ref([])
  const clearShelfOverlay = () => shelfStore.clearShelfOverlay()
  const rebuildShelfOverlay = () => shelfStore.rebuildShelfOverlay()
  const syncShelfOverlayIfNeeded = () => shelfStore.syncShelfOverlayIfNeeded()
  const getShelfByIntersection = (intersection) => shelfStore.getShelfByIntersection(intersection)
  const setHoveredShelfId = (shelfId) => shelfStore.setHoveredShelfId(shelfId)
  const setFocusedShelfId = (shelfId) => shelfStore.setFocusedShelfId(shelfId)
  const setHoveredShelfTooltip = (shelfHit) => shelfStore.setHoveredShelfTooltip(shelfHit)
  const clearHoveredShelfTooltip = () => shelfStore.clearHoveredShelfTooltip()
  const focusShelfGroupByShelfId = (shelfId) => shelfStore.focusShelfGroupByShelfId(shelfId)
  const getShelfFocusTargetByShelfId = (shelfId) => shelfStore.getShelfFocusTargetByShelfId(shelfId)

  const zoomToShelfGroupByShelfId = (shelfId) => {
    if (!camera || !controls) return

    const targetPos = getShelfFocusTargetByShelfId(shelfId)
    if (!targetPos) return

    const target = new THREE.Vector3(targetPos.x, 0, targetPos.z)

    if (camera instanceof THREE.OrthographicCamera) {
      controls.target.copy(target)
      camera.position.set(target.x, camera.position.y, target.z)
      camera.zoom = Math.max(camera.zoom, 1.5)
      camera.updateProjectionMatrix()
      controls.update()
      sceneZoom.value = camera.zoom
      return
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const offset = new THREE.Vector3(0, 100, 0)
      camera.position.copy(target.clone().add(offset))
      camera.lookAt(target)
      controls.target.copy(target)
      controls.update()
    }
  }

  watch(
    () => monitoringStore.selectedShelfContext,
    (ctx) => {
      const shelfId = String(ctx?.shelfId ?? '')
      if (!shelfId) {
        focusShelfGroupByShelfId(null)
        return
      }

      // selectedShelfContext is the cross-view selection source (grid/panel/map),
      // so map highlight must follow it consistently.
      focusShelfGroupByShelfId(shelfId)

      // Only grid-driven focus should trigger camera zoom-in in 2D mode.
      if (ctx?.source === 'grid' && camera instanceof THREE.OrthographicCamera) {
        zoomToShelfGroupByShelfId(shelfId)
      }
    },
    { deep: true }
  )

  // 베이 리스트
  const bayList = ref('all')

  // 차량 목적지 라인
  const sendGoalLine = ref(null)
  const subGoalLine = ref(null)
  const srcPortLine = ref(null)

  const contextMenuVisible = ref(false)
  let contextMenuX = ref(0)
  let contextMenuY = ref(0)
  let contextMenuHeight = ref(0)
  let clickedObject = ref(null)

  // 노드 정보 출력 여부
  const isShowNodeInfo = ref(false)

  // 포트 정보 출력 여부
  const isShowPortInfo = ref(false)

  const shelfTooltip = ref({ visible: false, id: null, x: 0, y: 0, portIds: [], portNames: [] })

  // 차량 정보 출력 여부
  const isShowAgvInfo = ref(false)

  // 시뮬레이션 활성화
  const isSimActive = ref(false)
  // 기본 맵
  const selectedMap = ref(import.meta.env.VITE_DEFUALT_MAP_FILE)

  const mouse = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()

  const nodePositions = new Map()

  // updateAgvView Name
  const updateAgvViewNm = ref('')

  let mouseDownPos = { x: 0, y: 0 }
  // [Leak fix] Store-scoped drag start coordinates (3D mode) instead of mutating DOM
  let dragStartX = 0
  let dragStartY = 0
  // 노드 클릭시 하이라이트 객체
  const pathIndexMap = new Map()

  let selectedNode = ref(null)
  let selectedPaths = ref([])

  // 포트 클릭시 하이라이트 객체
  let selectedPort = ref(null)

  const selectedLink = ref(null)

  // 전역 캐싱용 맵 (초기 1회 생성)
  const rtkMap = new Map()

  // 맵의 최소 거리 (AGV 위치 계산용)
  const minDistance = ref(100)
  // 맵의 최대 거리 (AGV 위치 계산용)
  const maxDistance = ref(2000)

  /**
   *  알람 및 포커스 관련 데이터
   * - isVisibleAlarmSound: 알람 사운드 활성화 여부
   * - isVisibleVehicleAlarm: 차량 알람 활성화 여부
   * - isVisibleMultiView: 멀티뷰 활성화 여부
   */
  const isVisibleAlarmSound = ref(null)
  const isVisibleVehicleAlarm = ref(null)
  const isVisibleMultiView = ref(null)

  // 현재 알람 발생 차량명 (포커싱 및 멀티뷰 연동용)
  const currentAlarmVhl = ref('')

  // 포커스 사운드 데이터
  const focusSoundData = ref(null)

  //시스템 시간
  const systemTime = ref(null)
  const systemTimeUTC = ref(null)
  const showSystemTime = ref(
    onOffSetStore.getStorageValue('systemTime') ?? false
  )

  // 전역 알람 건수
  const globalAlarmCnt = ref(0)
  const globalWarningCnt = ref(0)

  // 사용자별 레이아웃 색상 설정 리스트
  const layoutColorNodeObj = ref({})
  const layoutColorLinkObj = ref({})
  const layoutColorPortObj = ref({})
  const layoutColorVehicleObj = ref({})
  const layoutColorShelfObj = computed(() => {
    const colorMap = shelfStore.categoryColorMap
    return colorMap instanceof Map ? Object.fromEntries(colorMap) : {}
  })

  // 차량 애니메이션 실행 여부(OnOffSet.vue)
  const enableAnimation = ref(onOffSetStore.getStorageValue('animation') ?? true)

  // 공통 코드
  const getCommonCode = async () => {
    await API.AcsApi.getCommonAllCode()
      .then((res) => {
        commonCodeData.value = res.data
      })
      .catch(() => {
        return null
      })
  }

  // 사용자별 노드 색상 정보
  const searchUserNodeColorInfo = async () => {
    const payload = { userId: authStore.user?.userId }

    try {
      const res = await API.AcsApi.getLayoutSetNode(payload)
      const userColorList = Array.isArray(res.data) ? res.data : []

      // NODE / LINK 분리
      const nodeList = userColorList.filter((item) => item.category === 'NODE')
      const linkList = userColorList.filter((item) => item.category === 'LINK')

      // 사용자 데이터 객체화 { optionType: colorCode }
      const userNodeColor = nodeList.reduce((acc, cur) => {
        acc[cur.optionType] = cur.colorCode
        return acc
      }, {})

      const userLinkColor = linkList.reduce((acc, cur) => {
        acc[cur.optionType] = cur.colorCode
        return acc
      }, {})

      // COMMON_COLOR와 병합: API 우선, 동일 값 제거
      const finalNodeColor = { ...commonColor.NODE }
      Object.keys(userNodeColor).forEach((key) => {
        if (commonColor.NODE[key] !== userNodeColor[key]) {
          finalNodeColor[key] = userNodeColor[key]
        } else {
          finalNodeColor[key] = commonColor.NODE[key]
        }
      })

      const finalLinkColor = { ...commonColor.LINK }
      Object.keys(userLinkColor).forEach((key) => {
        if (commonColor.LINK[key] !== userLinkColor[key]) {
          finalLinkColor[key] = userLinkColor[key]
        } else {
          finalLinkColor[key] = commonColor.LINK[key]
        }
      })

      // 최종 단일 객체
      layoutColorNodeObj.value = finalNodeColor
      layoutColorLinkObj.value = finalLinkColor
    } catch {
      return null
    }
  }

  // 사용자별 포트 색상 정보 API
  const searchUserPortColorInfo = async () => {
    const payload = { userId: authStore.user?.userId }

    try {
      const res = await API.AcsApi.getLayoutSetPort(payload)

      if (res.status === 200) {
        const userColorList = Array.isArray(res.data) ? res.data : []
        const commonState = commonColor.PORT || {}
        const defaultBorderColor = '#808080'
        const defaultThickness = 1 // 기본 두께 설정

        // PORT(공통 설정) 기준으로 매핑 (사용자 설정이 있으면 덮어쓰기)
        const portEntries = Object.entries(commonState).map(([key, color]) => {
          const userDefined = userColorList.find((item) => item.category === key)
          return {
            category: key,
            fillColor: userDefined ? userDefined.fillColor : color,
            borderColor: userDefined
              ? userDefined.borderColor || defaultBorderColor
              : defaultBorderColor,
            // 두께 정보 추가 (사용자 정의가 없으면 기본값 1)
            thickness: userDefined ? userDefined.thickness : defaultThickness
          }
        })

        // 2. PORT 공통 설정에는 없지만 사용자 데이터에만 존재하는 카테고리 추가
        const extraListEntries = userColorList
          .filter((item) => !Object.hasOwn(commonState, item.category))
          .map((item) => ({
            category: item.category,
            fillColor: item.fillColor,
            borderColor: item.borderColor || defaultBorderColor,
            // 두께 정보 추가
            thickness: item.thickness || defaultThickness
          }))

        // 병합 결과
        const mergedColorList = [...portEntries, ...extraListEntries]

        // 최종 반영
        layoutColorPortObj.value = mergedColorList
      }
    } catch {
      return null
    }
  }

  // 사용자별 차량 색상 정보 API
  const searchUserVehicleColorInfo = async () => {
    const payload = { userId: authStore.user?.userId }

    try {
      const res = await API.AcsApi.getLayoutSetVehicle(payload)

      if (res.status === 200) {
        const userColorList = res.data || []

        // 결과 객체 초기화
        const mergedColor = {
          STATE: {},
          MODE: {},
          COMM_STATE: {},
          CARRIER: {},
          LINE: {}
        }

        // STATE 병합
        const categoryState = 'VEHICLE_STATE'
        const commonState = commonColor.STATE

        Object.entries(commonState).forEach(([key, value]) => {
          mergedColor.STATE[key] = value
        })

        userColorList
          .filter((item) => item.category === categoryState)
          .forEach((item) => {
            mergedColor.STATE[item.optionType] = item.colorCode
          })

        // MODE 병합
        const categoryMode = 'VEHICLE_MODE'
        const commonMode = commonColor.MODE

        Object.entries(commonMode).forEach(([key, value]) => {
          mergedColor.MODE[key] = value
        })

        userColorList
          .filter((item) => item.category === categoryMode)
          .forEach((item) => {
            mergedColor.MODE[item.optionType] = item.colorCode
          })

        // COMM_STATE 병합
        const categoryVehicle = 'VEHICLE'
        const commonCommState = commonColor.COMM_STATE

        Object.entries(commonCommState).forEach(([key, value]) => {
          mergedColor.COMM_STATE[key] = value
        })

        userColorList
          .filter((item) => item.category === categoryVehicle)
          .forEach((item) => {
            mergedColor.COMM_STATE[item.optionType] = item.colorCode
          })

        // 라인 병합
        const categoryCarrier = 'VEHICLE_CARRIER'
        const commonCarrier = commonColor.CARRIER

        Object.entries(commonCarrier).forEach(([key, value]) => {
          mergedColor.CARRIER[key] = value
        })

        userColorList
          .filter((item) => item.category === categoryCarrier)
          .forEach((item) => {
            mergedColor.CARRIER[item.optionType] = item.colorCode
          })

        // CARRIER 병합
        const categoryLine = 'LINE'
        const commonLine = commonColor.LINE

        Object.entries(commonLine).forEach(([key, value]) => {
          mergedColor.CARRIER[key] = value
        })

        userColorList
          .filter((item) => item.category === categoryLine)
          .forEach((item) => {
            mergedColor.LINE[item.optionType] = item.colorCode
          })

        // 최종 결과 적용
        layoutColorVehicleObj.value = mergedColor
      }
    } catch {
      return null
    }
  }

  // 사용자별 RMS Shelf 색상 정보 API
  const searchUserShelfColorInfo = async () => {
    const payload = { userId: authStore.user?.userId }

    try {
      const res = await API.AcsApi.getLayoutShelf(payload)

      if (res?.status !== 200) {
        console.error('searchUserShelfColorInfo failed', res)
        shelfStore.setCategoryColors([])
        return
      }

      const userColorList = Array.isArray(res.data) ? res.data : []
      // shelfStore에 사용자별 색상 정보 적용
      shelfStore.setCategoryColors(userColorList)
    } catch (err) {
      console.error('ERROR', err)
      shelfStore.setCategoryColors([])
    }
  }

  // 사용자별 포트 색상 정보 API
  const searchUserMonitoringSetInfo = async () => {
    const payload = { userId: authStore.user?.userId }

    try {
      const res = await API.AcsApi.getMonitoringSet(payload)

      isVisibleAlarmSound.value = res.data?.isSoundAlarm
      isVisibleVehicleAlarm.value = res.data?.isVehicleAlarm
      isVisibleMultiView.value = res.data?.isMultiView
    } catch {
      return null
    }
  }

  // [Optimization 1+4] Named handlers to prevent duplication + support throttling
  const handleMouseDownLeft = (event) => {
    if (event.button === 0) onMouseLeftClick(event)
  }

  const handleMouseDownRight = (event) => {
    if (event.button === 2) onMouseRightClick(event)
  }

  const handleMouseMoveThrottled = (event) => {
    // [Optimization 4] Throttle: process only on a new frame
    if (mouseMoveThrottled) {
      onCanvasMouseMove(event)
      mouseMoveThrottled = false
    }
  }

  const handleWindowResize = () => {
    on2dResize()
  }

  const handleContextMenu = (event) => {
    event.preventDefault()
  }

  const handleMouseUpFor3d = (event) => {
    // [Leak fix] Use store-scoped variables instead of event.target mutation
    const startX = dragStartX
    const startY = dragStartY
    const diffX = Math.abs(event.clientX - startX)
    const diffY = Math.abs(event.clientY - startY)
    const isDrag = diffX + diffY > 5

    if (event.button === 0 && !isDrag) {
      onMouseLeftClick(event)
    } else if (event.button === 2) {
      initSelectObject()
      selectedNode.value = null
      selectedVhlName.value = ''
    }
  }

  const handleMouseDownFor3d = (event) => {
    // [Leak fix] Store drag start coordinates in store scope, not on event.target
    dragStartX = event.clientX
    dragStartY = event.clientY
  }

  // [Optimization 1] Cleanup function to remove listeners
  const cleanupEventListeners = () => {
    window.removeEventListener('mousedown', handleMouseDownLeft)
    window.removeEventListener('mousedown', handleMouseDownRight)
    window.removeEventListener('mousemove', handleMouseMoveThrottled)
    window.removeEventListener('resize', handleWindowResize)
    window.removeEventListener('contextmenu', handleContextMenu)
    window.removeEventListener('mousedown', handleMouseDownFor3d)
    window.removeEventListener('mouseup', handleMouseUpFor3d)
  }

  // 2D 캔버스 렌더링
  const renderCanvas2d = async (targetElement) => {
    renderTargetElement.value = targetElement

    // 배경색 설정
    scene.background = new THREE.Color(backgroundColor.value)

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
    scene.add(ambientLight)

    // 양방향 조명 세팅
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 5)
    directionalLight1.position.set(100, 100, 100)
    scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 5)
    directionalLight2.position.set(-100, -100, -100)
    scene.add(directionalLight2)

    const aspect = targetElement.clientWidth / targetElement.clientHeight
    const frustumSize = 600 // 원하는 화면 범위에 따라 조정

    camera = markRaw(
      new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        10000
      )
    )

    // 카메라 위치를 위에서 아래로 내려다보는 탑뷰 형태로 설정
    camera.position.set(0, 1000, 0)
    camera.up.set(0, 0, -1)
    camera.lookAt(0, 0, 0)

    sceneZoom.value = camera.zoom

    renderer = markRaw(
      new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'highp'
      })
    )

    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.setSize(targetElement.clientWidth, targetElement.clientHeight)
    renderer.shadowMap.enabled = false
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO))
    targetElement.appendChild(renderer.domElement)

    // 2D용 OrbitControls (Pan & Zoom만 가능하도록)
    controls = markRaw(new OrbitControls(camera, renderer.domElement))

    Object.assign(controls, {
      enableRotate: false, // 회전 비활성화
      enablePan: true, // Pan 가능
      enableZoom: true, // Zoom 가능
      zoomSpeed: 1.0,
      screenSpacePanning: true, // 2D 기준 패닝
      minZoom: 0.3,
      maxZoom: 5.5,
      mouseButtons: {
        LEFT: THREE.MOUSE.PAN, // 좌클릭 패닝
        MIDDLE: THREE.MOUSE.DOLLY, // 휠 클릭 줌
        RIGHT: null // 우클릭 비활성화
      }
    })

    //AGV 차량 초기화
    agvVehicles.value = []
    invalidateInteractiveObjectCache()

    // Save default zoom for 2D so zone search can always reset to it
    // Must be before any await so it is always set regardless of async errors.
    defaultCameraState.value = { type: '2d', zoom: camera.zoom }

    calculateCenter() // 원점
    createGridHelper(scene, gridMeshes.value, pathData.value, bayList.value, false) // 격자 생성
    renderMapShapeGroup(scene, shapeData.value, commonConst.COORDINATES)

    // 맵 렌더링(순서: 노드 → 노드라벨 → 경로 → 포트 → 포트라벨 → 차량)
    await Promise.all([
      portStore.createPort(),
      nodeStore.createNodes(),
      nodeStore.createNodeLabel(),
      pathStore.createPaths(),
      portStore.createPortLabel(),
      portStore.createPortNameLabel(),
      vehicle2dStore.createVhl()
    ])

    // [Optimization 1] Clear existing listeners before re-registering (prevent duplicates)
    cleanupEventListeners()

    // 마우스 좌클릭 (사용 named handler)
    window.addEventListener('mousedown', handleMouseDownLeft)

    // 마우스 우클릭 (사용 named handler)
    window.addEventListener('mousedown', handleMouseDownRight)

    cameraInfo.value = camera
    controlsInfo.value = controls
    rendererInfo.value = renderer

    controls.addEventListener('change', () => {
      cameraTarget.value = {
        mode: 'OrthographicCamera',
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z
        },

        // OrthographicCamera 에 필요한 값만 기록
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        zoom: camera.zoom
      }
    })

    // 초기값 세팅
    cameraTarget.value = {
      mode: camera instanceof THREE.OrthographicCamera ? 'OrthographicCamera' : 'PerspectiveCamera',

      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z
      },

      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      zoom: camera.zoom
    }
    zoomFitMapBounds()
    // 클릭 가능한 오브젝트 마우스 호버 이벤트
    window.addEventListener('mousemove', handleMouseMoveThrottled)

    // 윈도우 리사이즈 이벤트
    window.addEventListener('resize', handleWindowResize)

    setTimeout(() => {
      on2dResize()
    }, 100)

    animate()
  }

  // 2D 리사이징
  const on2dResize = () => {
    const width = renderTargetElement.value.clientWidth
    const height = renderTargetElement.value.clientHeight
    if (width === 0 || height === 0) return

    const aspect = width / height
    const frustumSize = 600 // renderCanvas2d에서 사용한 값
    camera.left = (-frustumSize * aspect) / 2
    camera.right = (frustumSize * aspect) / 2
    camera.top = frustumSize / 2
    camera.bottom = -frustumSize / 2
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO))
  }

  // 캔버스 맵 렌더링(3D)
  const renderCanvas3d = async (targetElement) => {
    renderTargetElement.value = targetElement

    // 초기화
    if (renderer && targetElement.contains(renderer.domElement)) {
      renderer.dispose()
      targetElement.removeChild(renderer.domElement)
      renderer = null
    }

    if (controls) {
      controls.dispose()
      controls = null
    }

    // 배경색 설정
    scene.background = new THREE.Color(0xdfdfdf)

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0)
    scene.add(ambientLight)

    // 양방향 조명 세팅
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 5)
    directionalLight1.position.set(100, 100, 100)
    scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 5)
    directionalLight2.position.set(-100, -100, -100)
    scene.add(directionalLight2)

    // 원근 카메라 생성 (FOV 75도, 화면 비율에 따라 종횡비 설정, 1~10000 단위 거리 렌더링)
    camera = markRaw(new THREE.PerspectiveCamera(
      75,
      targetElement.clientWidth / targetElement.clientHeight,
      1,
      10000
    ))
    // 카메라 위치를 y축 위쪽으로 설정
    camera.position.copy(initCameraPosition)
    // 카메라의 위쪽 방향을 z-축 음수 방향으로 설정 (기본은 y축, 필요 시 오버라이드)
    camera.up.set(0, 1, 0)
    // 카메라가 Scene 중심(0,0,0)을 바라보도록 설정
    camera.lookAt(0, 0, 0)

    // 안티앨리어싱을 적용한 WebGL 렌더러 생성
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    })

    renderer.outputEncoding = THREE.sRGBEncoding

    // 렌더러의 크기를 현재 창 크기에 맞춤
    renderer.setSize(targetElement.clientWidth, targetElement.clientHeight)

    // 렌더링 그림자 비활성화
    renderer.shadowMap.enabled = false

    // 렌더링 시 픽셀 비율을 설정 (고해상도 화면 지원)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO))

    // 렌더러의 DOM 요소를 ref로 참조된 HTML 요소에 추가
    targetElement.appendChild(renderer.domElement)

    // OrbitControls를 통해 마우스로 카메라를 제어할 수 있도록 설정
    controls = new OrbitControls(camera, renderer.domElement)

    // 화면을 넘는 카메라 이동 비활성화
    controls.screenSpacePanning = false

    // 마우스 이동 y값 제한(Canvas 하단으로 이동 방지)
    controls.addEventListener('change', () => {
      cameraTarget.value = {
        mode: 'PerspectiveCamera',
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z
        },
        fov: camera.fov,
        aspect: camera.aspect
      }
    })

    Object.assign(controls, {
      dampingFactor: 0.05, // 감쇠 계수
      screenSpacePanning: false, // 카메라 팬을 화면 기준으로 이동
      enableRotate: true, // 회전 가능
      minDistance: minDistance.value, // 카메라 줌 인 최소 거리
      maxDistance: maxDistance.value, // 카메라 줌 아웃 최대 거리
      zoomSpeed: 2.0, // 줌 속도
      mouseButtons: {
        // 마우스 버튼 동작 설정
        LEFT: THREE.MOUSE.PAN, // 좌클릭으로 패닝
        MIDDLE: THREE.MOUSE.DOLLY, // 휠 클릭으로 줌
        RIGHT: THREE.MOUSE.ROTATE // 우클릭으로 회전
      },
      minPolarAngle: 0, // 수직 회전 각도 제한 (아래로)
      maxPolarAngle: Math.PI / 2.2 // 수직 회전 각도 제한 (위로)
    })

    // Save default distance now — camera is at initCameraPosition, controls.target at origin.
    // Must be saved before any awaits so it is always set regardless of async errors.
    defaultCameraState.value = { type: '3d', dist: camera.position.distanceTo(controls.target) }

    calculateCenter() // 맵 렌더링
    createGridHelper(scene, gridMeshes.value, pathData.value, bayList.value, false) // 격자 생성
    renderMapShapeGroup(scene, shapeData.value, commonConst.COORDINATES)
    //AGV 차량 초기화
    agvVehicles.value = []
    invalidateInteractiveObjectCache()

    // 맵 렌더링(순서: 노드 → 노드라벨 → 경로 → 포트 → 포트라벨 → 차량)
    await Promise.all([
      portStore.createPort(),
      nodeStore.createNodes(),
      nodeStore.createNodeLabel(),
      pathStore.createPaths(),
      portStore.createPortLabel(),
      vehicle3dStore.createVhl()
    ])

    cameraInfo.value = camera
    controlsInfo.value = controls
    rendererInfo.value = renderer

    // [Optimization 1] 기존 listeners 정리 후 신규 등록
    cleanupEventListeners()

    // 마우스 좌클릭 & 우클릭 (사용 named handlers)
    window.addEventListener('mousedown', handleMouseDownFor3d)
    window.addEventListener('mouseup', handleMouseUpFor3d)

    // 우클릭 시 브라우저 메뉴가 뜨는 것을 방지
    window.addEventListener('contextmenu', handleContextMenu)

    // 클릭 가능한 오브젝트 마우스 호버 이벤트
    window.addEventListener('mousemove', handleMouseMoveThrottled)

    animate()
  }

  // 포트 컬러 색상 적용
  const setPortColor = (portId, fillColor, borderColor) => {
    const portGroup = scene.getObjectByName('portGroup')
    if (!portGroup || !portId) return

    for (const mesh of portGroup.children) {
      if (mesh.userData?.portId !== portId) continue

      if (mesh.userData.type === 'innerPort') {
        mesh.material.color.set(fillColor)
        mesh.material.needsUpdate = true
      }

      if (mesh.userData.type === 'outerPort') {
        mesh.material.color.set(borderColor)
        mesh.material.needsUpdate = true
      }
    }
  }

  // 애니메이션 루프
  const animate = (timestamp = performance.now()) => {
    // Interpolation speeds for position and rotation smoothing
    const POSITION_LERP_SPEED = 0.025
    const ROTATION_SLERP_SPEED = 0.08

    // [Optimization 1] Schedule next frame first to keep the loop alive
    animationFrameId = requestAnimationFrame(animate)

    // sync FPS counter vehicles and lines
    // Rebuild RTK lookup map for this frame
    rtkMap.clear()
    for (const rtk of mapRtkVhlData.value) {
      rtkMap.set(rtk.sdoVhl?.vhlName, rtk)
    }

    // Update each AGV mesh position / rotation via lerp/slerp
    for (const agv of agvVehicles.value) {
      const agvName = agv.userData.name
      const rtkInfo = rtkMap.get(agvName)
      if (!rtkInfo?.vhl) continue

      const { x, y, t } = rtkInfo.vhl

      const targetX = (x - commonConst.COORDINATES.CENTER_X) * commonConst.COORDINATES.SCALE_FACTOR
      const targetZ = -(y - commonConst.COORDINATES.CENTER_Y) * commonConst.COORDINATES.SCALE_FACTOR
      const targetPos = new THREE.Vector3(targetX, agv.position.y, targetZ)

      const normalizedT = ((t % 360) + 360) % 360
      const targetRotY = THREE.MathUtils.degToRad(normalizedT)
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetRotY, 0))

      if (!agv.userData.motion) {
        agv.userData.motion = {
          currentPos: agv.position.clone(),
          targetPos: agv.position.clone(),
          currentQuat: agv.quaternion.clone(),
          targetQuat: agv.quaternion.clone(),
          moving: false
        }
      }

      const motion = agv.userData.motion

      if (!motion.targetPos.equals(targetPos) || !motion.targetQuat.equals(targetQuat)) {
        motion.targetPos.copy(targetPos)
        motion.targetQuat.copy(targetQuat)
        motion.moving = true
      }

      if (enableAnimation.value) {
        if (motion.moving) {
          motion.currentPos.lerp(motion.targetPos, POSITION_LERP_SPEED)
          motion.currentQuat.slerp(motion.targetQuat, ROTATION_SLERP_SPEED)

          agv.position.copy(motion.currentPos)
          agv.quaternion.copy(motion.currentQuat)

          const distance = motion.currentPos.distanceTo(motion.targetPos)
          const rotationDiff = 1 - motion.currentQuat.dot(motion.targetQuat)

          if (distance < 0.001 && rotationDiff < 0.0001) {
            motion.moving = false
            motion.currentPos.copy(motion.targetPos)
            motion.currentQuat.copy(motion.targetQuat)
          }
        } else {
          agv.position.copy(motion.currentPos)
          agv.quaternion.copy(motion.currentQuat)
        }
      } else {
        // Animation OFF: snap directly to target
        motion.currentPos.copy(motion.targetPos)
        motion.currentQuat.copy(motion.targetQuat)
        agv.position.copy(motion.currentPos)
        agv.quaternion.copy(motion.currentQuat)
        motion.moving = false
      }
    }

    // --- Render throttle: cap GPU submit rate to TARGET_RENDER_FPS ---
    // Only label updates, shelf sync, and renderer.render are throttled.
    if (timestamp - lastRenderTimestamp.value < TARGET_FRAME_MS) {
      return
    }
    lastRenderTimestamp.value = timestamp

    // [Optimization 4] Allow one mousemove handler per rendered frame
    mouseMoveThrottled = true

    // [Optimization 2] Update vehicle label positions separately after the AGV loop
    if (camera?.quaternion && agvVehicles.value.length > 0) {
      // Build once per frame to keep sprite->AGV lookup O(1).
      const agvByName = new Map(agvVehicles.value.map((agv) => [agv.userData?.name, agv]))

      for (const obj of scene.children) {
        if (obj.type === 'Sprite' && obj.userData?.vhlName) {
          const agv = agvByName.get(obj.userData.vhlName)
          if (!agv) continue

          const labelWidth = obj.scale.x
          const worldPos = vehicle2dStore.getVhlLabelWorldPosition(agv, labelWidth)

          obj.position.copy(worldPos)
          obj.position.y = 20
        }
      }
    }

    syncShelfOverlayIfNeeded()

    // Submit the rendered frame to the GPU
    renderer?.render(scene, camera)
  }

  const disposeSceneObject = (object3d, disposedResources) => {
    object3d.traverse((node) => {
      if (node.geometry && !disposedResources.geometries.has(node.geometry)) {
        node.geometry.dispose?.()
        disposedResources.geometries.add(node.geometry)
      }

      const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
      for (const material of materials) {
        if (!material || disposedResources.materials.has(material)) continue

        if (material.map && !disposedResources.textures.has(material.map)) {
          material.map.dispose?.()
          disposedResources.textures.add(material.map)
        }

        material.dispose?.()
        disposedResources.materials.add(material)
      }

      if (node.texture && !disposedResources.textures.has(node.texture)) {
        node.texture.dispose?.()
        disposedResources.textures.add(node.texture)
      }
    })
  }

  // Canvas 초기화
  const clearScene = (targetElement) => {
    // [Optimization 1] RAF 정리
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    // [Optimization 3] vehicle2dStore render loop 정지
    vehicle2dStore.stopRendering()

    // [Optimization 1] 모든 event listeners 정리
    cleanupEventListeners()

    // [Leak fix] mode 전환 시 stale raycast cache 즉시 무효화
    invalidateInteractiveObjectCache()

    // [Leak fix] mesh 참조 배열 초기화로 GC 대상 명확화
    agvVehicles.value = []
    nodeMeshes.value = []
    nodeIdMeshes.value = []
    nodeVirtualIdMeshes.value = []
    pathMeshes.value = []
    portMeshes.value = []
    portIdMeshes.value = []
    portNameMeshes.value = []
    linkMeshes.value = []
    vhlLabelMeshes.value = []
    shelfMeshes.value = []
    pathIndexMap.clear()
    nodePositions.clear()
    rtkMap.clear()

    const disposedResources = {
      geometries: new WeakSet(),
      materials: new WeakSet(),
      textures: new WeakSet()
    }

    // Scene 초기화
    while (scene.children.length > 0) {
      const child = scene.children[0]
      scene.remove(child)

      if (child.name === SHAPE_GROUP_NAME) {
        disposeShapeGroup(child)
        continue
      }

      disposeSceneObject(child, disposedResources)
    }

    clearMapShapeRendererCaches()

    clearShelfOverlay()

    // Renderer 해제
    if (renderer) {
      renderer.dispose()

      if (renderer.domElement && targetElement.contains(renderer.domElement)) {
        targetElement.removeChild(renderer.domElement)
      }

      renderer = null
    }

    // Controls 해제
    if (controls) {
      controls.dispose()
      controls = null
    }

    // 카메라 초기화 (필요 시)
    camera = null
  }

  // Center 조정
  const calculateCenter = () => {
    let nodeSumX = 0,
      nodeSumY = 0
    for (const node of pathData.value) {
      nodeSumX += node.realX
      nodeSumY += node.realY
    }
    commonConst.COORDINATES.CENTER_X = nodeSumX / pathData.value.length
    commonConst.COORDINATES.CENTER_Y = nodeSumY / pathData.value.length
  }

  // 스크린 센터 계산 및 이동
  const centerMapToScreen = () => {
    const xs = pathData.value.map((n) => n.realX)
    const ys = pathData.value.map((n) => n.realY)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    return { x: centerX, y: 0, z: -centerY }
  }

  // 마우스 좌클릭 기능 정의
  const onMouseLeftClick = (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY)

    //Left click 시 Raycaster를 사용하여 클릭된 객체를 판별
    if (!(el instanceof HTMLCanvasElement)) return
    mouseDownPos = { x: event.clientX, y: event.clientY }
    onCanvasLeftClick(event)
  }

  // 마우스 우클릭 기능 정의
  const onMouseRightClick = (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY)

    //Left click 시 Raycaster를 사용하여 클릭된 객체를 판별
    if (!(el instanceof HTMLCanvasElement)) return

    onCanvasRightClick(event)
  }

  // 기존 선택 초기화(삭제)
  const initSelectObject = () => {
    nodeStore.removeSelectNode()
    portStore.removeSelectPort()
    pathStore.removeSelectLink()
    isPerspective.value === '2d'
      ? vehicle2dStore.removeSelectVhl()
      : vehicle3dStore.removeSelectVhl()
  }

  // Canvas 내 객체(차량, 노드, 포트, 링크) 클릭 이벤트
  const onCanvasLeftClick = (event) => {
    const SELECT_DISTANCE_THRESHOLD = 12

    const rect = renderer.domElement.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    const mouse = new THREE.Vector2((clickX / rect.width) * 2 - 1, -(clickY / rect.height) * 2 + 1)

    raycaster.setFromCamera(mouse, camera)

    const {
      interactiveObjects,
      rawNodeMeshes
    } = getRaycastInteractiveObjects()

    const intersects = raycaster.intersectObjects(interactiveObjects, true)

    if (intersects.length > 0) {
      // 가장 앞에 있는 객체를 선택합니다
      const closestIntersection = intersects[0]
      let obj = closestIntersection.object

      initSelectObject()

      // Step 6: Shelf overlay has higher click priority than underlying ports.
      const shelfHit = getShelfByIntersection(closestIntersection)
      if (shelfHit) {
        setFocusedShelfId(shelfHit.id)
        const selectedSide = shelfHit.deep === 1 ? 'front' : shelfHit.deep === 2 ? 'rear' : null
        monitoringStore.selectShelfFromMap({
          shelfId: shelfHit.id,
          level: shelfHit.level,
          side: selectedSide,
          groupKey: shelfHit.groupKey ?? null
        })
        clickedObject.value = {
          type: 'shelf',
          shelfId: shelfHit.id,
          nodeNo: shelfHit.nodeNo,
          level: shelfHit.level,
          deep: shelfHit.deep
        }
        return
      }


      // 공통 부모 탐색용 헬퍼 함수
      const findParentData = (target, key) => {
        let current = target
        while (current) {
          if (current.userData && current.userData[key]) return current
          current = current.parent
        }
        return null
      }

      // 1. 라벨 클릭 검사
      const vhlLabelParent = findParentData(obj, 'vhlInfo')
      if (vhlLabelParent) {
        const vhlInfo = vhlLabelParent.userData.vhlInfo
        selectedVhlName.value = vhlInfo.userData.name
        isPerspective.value === '2d'
          ? vehicle2dStore.selectVhlInfo(false)
          : vehicle3dStore.selectVhlInfo(false)
        return
      }

      // 2. 차량 클릭 검사
      let vehicleTargetName = null
      let vehicleSearch = obj
      while (vehicleSearch) {
        if (vehicleSearch.userData?.vehicle) {
          vehicleTargetName = vehicleSearch.userData.vehicle.userData?.name
          break
        }
        if (vehicleSearch.userData?.name) {
          vehicleTargetName = vehicleSearch.userData.name
          break
        }
        vehicleSearch = vehicleSearch.parent
      }

      if (vehicleTargetName) {
        selectedVhlName.value = vehicleTargetName
        monitoringStore.clickedVehicleNameFromMap = vehicleTargetName
        isPerspective.value === '2d'
          ? vehicle2dStore.selectVhlInfo(false)
          : vehicle3dStore.selectVhlInfo(false)
        return
      }

      // 3. 포트 클릭 검사 (순서를 노드보다 앞으로 조정)
      // 포트 메쉬 자체 혹은 부모에게 portId가 있는지 확인합니다
      const portParent = findParentData(obj, 'portId')
      if (portParent) {
        const portId = portParent.userData.portId
        // 스토어에 포트 정보 전달 (객체 전체 혹은 ID 전달)
        portStore.selectPortInfo(portParent)
        monitoringStore.clickedPortNameFromMap = portId
        return
      }

      // 4. 노드 클릭 검사
      const nodeParent = findParentData(obj, 'info')
      if (nodeParent) {
        nodeStore.selectNodeInfo(nodeParent.userData.info)
        return
      }

      // 5. 링크 클릭 검사
      let linkSearch = obj
      while (
        linkSearch &&
        (!linkSearch.userData || Object.keys(linkSearch.userData).length === 0)
      ) {
        linkSearch = linkSearch.parent
      }
      if (linkSearch && linkSearch.userData) {
        pathStore.selectedLinkInfo(linkSearch.userData)
        return
      }
    }

    // 레이캐스팅 실패 시 근접 노드 찾기 보정 로직
    let closestNode = null
    let minDistance = Infinity

    for (const mesh of rawNodeMeshes) {
      const screenPos = mesh.position.clone().project(camera)
      const screenX = ((screenPos.x + 1) / 2) * rect.width
      const screenY = ((-screenPos.y + 1) / 2) * rect.height

      const dx = screenX - clickX
      const dy = screenY - clickY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < SELECT_DISTANCE_THRESHOLD && distance < minDistance) {
        closestNode = mesh
        minDistance = distance
      }
    }

    if (closestNode) {
      initSelectObject()
      nodeStore.selectNodeInfo(closestNode.userData.info)
      return
    }

  }

  // 마우스 우클릭 이벤트
  const onCanvasRightClick = (event) => {
    // 기존 선택 초기화
    initSelectObject()
    if (selectedVhlName.value !== '') {
      selectedVhlName.value = ''
      selectedVhl.value = null
    }

    const rect = renderer.domElement.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    // 마우스 좌표 정규화 (-1 ~ +1)
    const mouse = new THREE.Vector2((clickX / rect.width) * 2 - 1, -(clickY / rect.height) * 2 + 1)

    raycaster.setFromCamera(mouse, camera)

    // 반응성 객체 Raw 데이터 변환
    const rawVhlMeshes = Array.isArray(toRaw(agvVehicles.value)) ? toRaw(agvVehicles.value) : []

    // 차량 클릭
    let intersects = raycaster.intersectObjects(rawVhlMeshes, true)
    if (intersects.length > 0) {
      let obj = intersects[0].object

      while (!obj.userData.name && obj.parent) {
        obj = obj.parent
      }

      // Disconnect 차량 리턴
      const rtkList = mapRtkVhlData.value || []
      const rtkMatch = rtkList.find((r) => r.sdoVhl?.vhlName === obj.userData.name)
      if (!rtkMatch || !rtkMatch.vhl) return
      if (rtkMatch.vhl.commState !== 1) return

      // 우클릭한 차량의 하이라이트 생성
      selectedVhlName.value = obj.userData.name
      vehicle2dStore.createVhlHighlight(obj.userData.name)

      monitoringStore.isVisibleControl = true
      return
    }
  }

  // 오브젝트(노드, 포트, AGV 등) 마우스 호버 이벤트
  const onCanvasMouseMove = (event) => {
    if (!renderer) return

    const SELECT_DISTANCE_THRESHOLD = 20 // px 기준 노드 호버 임계값
    const rect = renderer.domElement.getBoundingClientRect()

    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)

    const {
      interactiveObjects,
      rawNodeMeshes,
      rawPortMeshes,
      rawVhlMeshes,
      rawLinkMeshes,
      rawVhlLabelMeshes,
      rawShelfMeshes
    } = getRaycastInteractiveObjects()

    // 노드: 마우스와 화면상 거리 계산하여 임계값 이내면 hover 처리
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    const isRmsVisible = onOffSetStore.getRms('rms')?.visible ?? true

    // When RMS shelf overlay is enabled, skip node hover detection
    if(!isRmsVisible) {
      let isHoveringNode = false
      for (const mesh of rawNodeMeshes) {
        const screenPos = mesh.position.clone().project(camera)
        const screenX = ((screenPos.x + 1) / 2) * rect.width
        const screenY = ((-screenPos.y + 1) / 2) * rect.height
  
        const dx = screenX - clickX
        const dy = screenY - clickY
        const distance = Math.sqrt(dx * dx + dy * dy)
  
        if (distance < SELECT_DISTANCE_THRESHOLD) {
          isHoveringNode = true
          break
        }
      }
  
      if (isHoveringNode) {
        setHoveredShelfId(null)
        clearHoveredShelfTooltip()
        renderer.domElement.style.cursor = 'pointer'
        return
      }
    }

    // 포트, AGV는 raycaster로 판별
    const intersects = raycaster.intersectObjects(interactiveObjects, true)

    if (intersects.length > 0) {
      const shelfHit = getShelfByIntersection(intersects[0])
      setHoveredShelfId(shelfHit?.id ?? null)
      setHoveredShelfTooltip(shelfHit ?? null)

      let obj = intersects[0].object

      while (
        obj &&
        !rawPortMeshes.includes(obj) &&
        !rawShelfMeshes.includes(obj) &&
        !rawVhlMeshes.includes(obj) &&
        !rawLinkMeshes.includes(obj) &&
        !rawVhlLabelMeshes.includes(obj)
      ) {
        obj = obj.parent
      }

      if (
        rawShelfMeshes.includes(obj) ||
        rawPortMeshes.includes(obj) ||
        rawVhlMeshes.includes(obj) ||
        rawLinkMeshes.includes(obj) ||
        rawVhlLabelMeshes.includes(obj)
      ) {
        renderer.domElement.style.cursor = 'pointer'
        return
      }
    }

    setHoveredShelfId(null)
    clearHoveredShelfTooltip()

    // 해당 없으면 기본 커서로
    renderer.domElement.style.cursor = 'default'
  }

  /**
   * Move the active camera (2D or 3D) to frame a zone defined by its centroid and extents.
   * Runs inside the store so it always uses the live `camera` / `controls` local variables,
   * avoiding the stale-ref problem where cameraInfo may still hold the 2D camera.
   */
  const moveCameraToZone = (centerX, centerZ, options = {}) => {
    if (!camera || !controls) return

    const { preserveZoom = false, preserveDistance = false } = options

    const target = new THREE.Vector3(centerX, 0, centerZ)

    if (isPerspective.value !== '3d') {
      // 2D OrthographicCamera — pan to zone center and reset to default zoom
      const defaultZoom = defaultCameraState.value?.zoom ?? camera.zoom
      const offset = camera.position.clone().sub(controls.target)
      controls.target.copy(target)
      camera.position.copy(target).add(offset)
      camera.zoom = preserveZoom ? camera.zoom : defaultZoom
      camera.updateProjectionMatrix()
      controls.update()
      sceneZoom.value = camera.zoom
    } else {
      // 3D PerspectiveCamera — pan to zone center and reset to default distance
      const currentDist = camera.position.distanceTo(controls.target)
      const defaultDist = defaultCameraState.value?.dist ?? camera.position.distanceTo(controls.target)
      const cameraDir = camera.position.clone().sub(controls.target).normalize()
      controls.target.copy(target)
      const targetDist = preserveDistance ? currentDist : defaultDist
      camera.position.copy(target).addScaledVector(cameraDir, targetDist)
      controls.update()
    }
  }

  const getBoundsFromObjects = (objects = []) => {
    const bounds = new THREE.Box3()
    let hasValidObject = false

    for (const obj of objects) {
      if (!obj) continue
      bounds.expandByObject(obj)
      hasValidObject = true
    }

    if (!hasValidObject || bounds.isEmpty()) return null
    return bounds
  }

  const getMapBounds = () => {
    const safeArray = (value) => Array.isArray(value) ? value : []

    const coreMeshBounds = getBoundsFromObjects([
      ...safeArray(toRaw(pathMeshes.value)),
      ...safeArray(toRaw(nodeMeshes.value)),
      ...safeArray(toRaw(portMeshes.value))
    ])

    const shapeGroup = scene?.getObjectByName(SHAPE_GROUP_NAME)
    const shapeBounds = shapeGroup ? getBoundsFromObjects([shapeGroup]) : null

    let combinedBounds = null
    if (coreMeshBounds) {
      combinedBounds = coreMeshBounds.clone()
    }
    if (shapeBounds) {
      if (combinedBounds) {
        combinedBounds.union(shapeBounds)
      } else {
        combinedBounds = shapeBounds.clone()
      }
    }

    if (shelfStore.rmsEnabled) {
      const shelfBounds = getBoundsFromObjects(safeArray(toRaw(shelfMeshes.value)))
      if (shelfBounds) {
        if (combinedBounds) {
          combinedBounds.union(shelfBounds)
        } else {
          combinedBounds = shelfBounds.clone()
        }
      }
    }

    if (combinedBounds) {
      return combinedBounds
    }

    if (!scene) return null

    const sceneBox = new THREE.Box3().setFromObject(scene)
    if (!sceneBox.isEmpty()) {
      return sceneBox
    }

    if (!Array.isArray(pathData.value) || pathData.value.length === 0) {
      return null
    }

    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity

    for (const node of pathData.value) {
      const realX = Number(node?.realX)
      const realY = Number(node?.realY)
      if (!Number.isFinite(realX) || !Number.isFinite(realY)) continue

      const worldX = (realX - commonConst.COORDINATES.CENTER_X) * commonConst.COORDINATES.SCALE_FACTOR
      const worldZ = -(realY - commonConst.COORDINATES.CENTER_Y) * commonConst.COORDINATES.SCALE_FACTOR

      minX = Math.min(minX, worldX)
      maxX = Math.max(maxX, worldX)
      minZ = Math.min(minZ, worldZ)
      maxZ = Math.max(maxZ, worldZ)
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return null
    }

    return new THREE.Box3(
      new THREE.Vector3(minX, -1, minZ),
      new THREE.Vector3(maxX, 1, maxZ)
    )
  }

  // Fit current camera to the actual rendered map bounds.
  const zoomFitMapBounds = (options = {}) => {
    if (!camera || !controls) return false

    const {
      padding2d = 1.12,
      padding3d = 1.35,
      minSpan = 1
    } = options

    const mapBounds = getMapBounds()
    if (!mapBounds) return false

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    mapBounds.getSize(size)
    mapBounds.getCenter(center)

    size.x = Math.max(size.x, minSpan)
    size.y = Math.max(size.y, minSpan)
    size.z = Math.max(size.z, minSpan)

    if (camera instanceof THREE.OrthographicCamera) {
      const viewWidth = Math.max(Math.abs(camera.right - camera.left), 1e-6)
      const viewHeight = Math.max(Math.abs(camera.top - camera.bottom), 1e-6)

      const fitZoomX = viewWidth / (size.x * padding2d)
      const fitZoomZ = viewHeight / (size.z * padding2d)

      let nextZoom = Math.min(fitZoomX, fitZoomZ)

      if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
        nextZoom = camera.zoom || 1
      }

      if (Number.isFinite(controls.minZoom)) {
        nextZoom = Math.max(nextZoom, controls.minZoom)
      }

      const target = new THREE.Vector3(center.x, 0, center.z)
      const offset = camera.position.clone().sub(controls.target)

      controls.target.copy(target)
      camera.position.copy(target).add(offset)
      camera.zoom = nextZoom
      camera.updateProjectionMatrix()
      controls.update()
      sceneZoom.value = camera.zoom

      return true
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const target = center.clone()
      const sphere = new THREE.Sphere()
      mapBounds.getBoundingSphere(sphere)

      const radius = Math.max(sphere.radius * padding3d, minSpan)
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)

      const fitDistanceV = radius / Math.sin(vFov / 2)
      const fitDistanceH = radius / Math.sin(hFov / 2)
      let fitDistance = Math.max(fitDistanceV, fitDistanceH)

      if (!Number.isFinite(fitDistance) || fitDistance <= 0) {
        fitDistance = camera.position.distanceTo(controls.target)
      }

      if (Number.isFinite(controls.minDistance)) {
        fitDistance = Math.max(fitDistance, controls.minDistance)
      }

      const cameraDir = camera.position.clone().sub(controls.target)
      if (cameraDir.lengthSq() <= 1e-6) {
        cameraDir.copy(initCameraPosition).normalize()
      } else {
        cameraDir.normalize()
      }

      controls.target.copy(target)
      camera.position.copy(target).addScaledVector(cameraDir, fitDistance)
      camera.lookAt(target)
      controls.update()

      return true
    }

    return false
  }

  return {
    initCameraPosition,
    moveCameraToZone,
    zoomFitMapBounds,

    renderTargetElement,

    scene,
    camera,
    cameraInfo,
    renderer,
    rendererInfo,
    controls,
    controlsInfo,
    agvVehicles,
    selectedVhl,
    selectedVhlName,
    selectedVhlPropsData,
    sceneAngle,

    acsMapVersion,
    mapVersion,

    cameraTarget,
    sceneZoom,

    isPerspective,

    backgroundColor,

    maxDistance,
    minDistance,

    pathData,
    portData,
    agvTypeData,
    sdoVhlData,
    mapRtkVhlData,
    dashboardData,
    scmdData,
    scmdGroupData,
    pofData,
    disableSettingData,
    sdoAlaramMstData,
    sensorData,
    shapeData,
    commonCodeData,
    mapUnitData,

    preMapRtkVhlData,

    isMapReady,
    isShowNodeInfo,
    isShowPortInfo,
    isShowAgvInfo,
    isSimActive,
    updateAgvViewNm,

    selectedNode,
    selectedPaths,
    selectedPort,
    selectedLink,
    selectedMap,

    nodePositions,

    gridMeshes,
    nodeMeshes,
    nodeIdMeshes,
    nodeVirtualIdMeshes,
    pathMeshes,
    portMeshes,
    portIdMeshes,
    portNameMeshes,
    pathIndexMap,
    linkMeshes,
    vhlLabelMeshes,
    shelfMeshes,

    // 차량 목적지 라인
    sendGoalLine,
    subGoalLine,
    srcPortLine,

    createGridHelper,

    // API
    renderCanvas2d,
    renderCanvas3d,
    animate,
    clearScene,
    calculateCenter,

    // 사용자별 레이아웃 색상 설정 API
    searchUserNodeColorInfo,
    searchUserPortColorInfo,
    searchUserVehicleColorInfo,
    searchUserShelfColorInfo,
    searchUserMonitoringSetInfo,

    // 공통코드
    getCommonCode,

    // 사용자별 레이아웃 색상 설정 오브젝트
    layoutColorNodeObj,
    layoutColorLinkObj,
    layoutColorPortObj,
    layoutColorVehicleObj,
    layoutColorShelfObj,

    isVisibleAlarmSound,
    isVisibleVehicleAlarm,
    isVisibleMultiView,
    currentAlarmVhl,
    focusSoundData,

    fireState,

    mouse,
    raycaster,
    bayList,

    //컨텍스트 메뉴
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuHeight,
    clickedObject,

    centerMapToScreen,
    globalAlarmCnt,
    globalWarningCnt,
    enableAnimation,

    initSelectObject,

    rebuildShelfOverlay,
    syncShelfOverlayIfNeeded,
    clearShelfOverlay,

    systemTime,
    systemTimeUTC,
    showSystemTime,

    shelfTooltip
  }
})
