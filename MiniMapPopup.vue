<!-- 
=============================================== 
  ● 파일명: MiniMapPopup.vue
  ● 설  명: 미니맵 팝업
  ● 작성자: 여강동
  ● 작성일: 2025-10-20
===============================================
-->
<template>
  <component-panel
    :use-expand-btn="false"
    class="b-modal-popup cancel"
  >
  <!-- 헤더 슬롯 (title + 닫기버튼) -->
    <template #header>
      <div class="panel-header">
        <span class="panel-title">{{$t('ACS-LABEL-MINIMAP')}}</span>
        <b-button
          :icon-left="isCollapsed ? 'plus' : 'minus'"
          type="is-text"
          @click="toggleContent"
        />
      </div>
    </template>
    <transition name="slide-fade">
      <div v-show="!isCollapsed" class="inner-modal-content collapse-box">
        <div class="minimap_box">
          <canvas
            ref="miniMapCanvas"
            class="mini-map-canvas"
            @pointerdown="onMiniMapDown"
            @pointermove="onMiniMapMove"
            @pointerup="onMiniMapUp"
            @mouseleave="onMiniMapUp"
          />
        </div>
      </div>
    </transition>
  </component-panel>
</template>

<script setup>
import { onMounted, ref, watch, watchEffect, nextTick } from 'vue'
import * as THREE from 'three'
import { useMapStore } from '@/stores/monitoring/mapStore'
import { commonColor } from '@/constants/commonColor'
import { commonConst } from '@/constants/commonConst'
import { getVhlByState } from '@/constants/vhlByState' 

const mapStore = useMapStore()

// 내용 표시 여부를 제어하는 상태
const isCollapsed = ref(false)
const emit = defineEmits(['toggle-minimap'])

// 버튼 클릭 시 토글
const toggleContent = () => {
  if (!isCollapsed.value) {
    // 접기 직전 → canvas 크기 저장
    const canvas = miniMapCanvas.value
    if (canvas) {
      lastCanvasSize.value = {
        w: canvas.clientWidth,
        h: canvas.clientHeight
      }
    }
  }
  
  isCollapsed.value = !isCollapsed.value
  emit('toggle-minimap')
}

// 스토어 인스턴스
const useCommonColor = commonColor

// 미니맵 캔버스 DOM 참조
const miniMapCanvas = ref(null)

// Three.js 렌더링 구성 요소
let renderer, scene, camera

// 맵 중심 좌표
const centerX = ref(0)
const centerZ = ref(0)

// 미니 AGV 객체 리스트
const miniAgvObjects = new Map()

// 노드 위치 정보
let nodePositions = new Map()

// 격자 메쉬 목록
const gridMeshes = ref([])

const boxWidth = 600
const boxHeight = 600

const isRedBox = ref(false)

// 맵 최소/최대 범위
const mapMinX = ref(0)
const mapMaxX = ref(0)
const mapMinY = ref(0)
const mapMaxY = ref(0)

// 미니맵 빨간 박스 이동 변수
let isDraggingBox = false

// 드래그 상태 관련
let dragOffset = new THREE.Vector3()

// 마우스 및 레이캐스터
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// 미니맵에서 사용하는 빨간 박스 객체
const redBox = new THREE.LineLoop()
const lastCanvasSize = ref({ w: 0, h: 0 })

// 미니맵 초기화 함수
const initMiniMap = () => {
  const canvas = miniMapCanvas.value
  if (!canvas) return

  scene = new THREE.Scene()
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)

  // 초기 카메라는 임시 설정 (나중에 fitCameraToMap에서 재설정됨)
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000)
  camera.position.set(0, 500, 0)
  camera.lookAt(0, 0, 0)

  const resizeObserver = new ResizeObserver(() => {
    if (isCollapsed.value) return
    const parent = canvas.parentElement
    if (!parent || parent.clientWidth === 0) return

    // 부모 크기 가져오기
    const w = parent.clientWidth
    const h = parent.clientHeight
    renderer.setSize(w, h, false)
    
    // 해상도 설정 (고화질 대응)
    canvas.width = w * window.devicePixelRatio
    canvas.height = h * window.devicePixelRatio

    // 카메라 비율 업데이트 및 맵 맞춤 재실행
    if (camera) {
      fitCameraToMap() 
    }
  })
  resizeObserver.observe(canvas.parentElement)
}

// 맵 크기에 맞게 카메라 설정
const fitCameraToMap = () => {
  if (!camera || !renderer || !miniMapCanvas.value) return

  const canvas = miniMapCanvas.value
  const aspect = canvas.clientWidth / canvas.clientHeight

  // 실제 맵의 물리적 크기
  const mapWidth = (mapMaxX.value - mapMinX.value) * commonConst.COORDINATES.SCALE_FACTOR
  const mapHeight = (mapMaxY.value - mapMinY.value) * commonConst.COORDINATES.SCALE_FACTOR
  
  // 맵이 하나도 없을 경우 대비
  if (mapWidth === 0 || mapHeight === 0) return

  let viewWidth = mapWidth * 1.2
  let viewHeight = mapHeight * 1.2

  // 비율에 맞춰 시야 확장
  if (viewWidth / viewHeight > aspect) {
    // 가로가 더 긴 경우 -> 세로를 늘림
    viewHeight = viewWidth / aspect
  } else {
    // 세로가 더 긴 경우 -> 가로를 늘림
    viewWidth = viewHeight * aspect
  }

  camera.left = -viewWidth / 2
  camera.right = viewWidth / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

// 중앙 좌표
const calculateCenter = () => {
  const path = mapStore.pathData
  const ports = mapStore.portData

  if (!path.length && !ports.length) return

  const xs = []
  const zs = []

  path.forEach(n => { xs.push(n.realX); zs.push(n.realY) })
  ports.forEach(p => { xs.push(p.realX); zs.push(p.realY) })

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)

  mapMinX.value = minX
  mapMaxX.value = maxX
  mapMinY.value = minZ
  mapMaxY.value = maxZ

  centerX.value = (minX + maxX) / 2
  centerZ.value = (minZ + maxZ) / 2
}

// 노드 생성
const createNodes = () => {
  const pathData = mapStore.pathData
  nodePositions = mapStore.nodePositions
  if (!pathData.length) return

  const oldGroup = scene.getObjectByName('NodeGroup')
  if (oldGroup) {
    scene.remove(oldGroup)
  }

  nodePositions.clear()

  let index = 0
  for (const node of pathData) {
    const x = (node.realX - centerX.value) * commonConst.COORDINATES.SCALE_FACTOR
    const z = -(node.realY - centerZ.value) * commonConst.COORDINATES.SCALE_FACTOR
    const y = 0

    nodePositions.set(node.uid, { x, y, z })
    index++
  }
}

// 경로 생성
const createPaths = () => {
  const prevGroup = scene.getObjectByName('PathGroup')
  if (prevGroup) scene.remove(prevGroup)

  const group = new THREE.Group()
  group.name = 'PathGroup'

  // 선 굵기 조절: Y, Z 크기 변경
  const pathGeometry = new THREE.BoxGeometry(1, 0.1, 1.3)
  const baseMaterial = new THREE.MeshBasicMaterial({ vertexColors: false })
  baseMaterial.depthTest = false
  baseMaterial.depthWrite = false

  const connCount = mapStore.pathData.reduce(
    (sum, node) => sum + (node?.stConn?.length || 0),
    0
  )
  const instancedMesh = new THREE.InstancedMesh(pathGeometry, baseMaterial, connCount)
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  instancedMesh.frustumCulled = false

  const startVec = new THREE.Vector3()
  const endVec = new THREE.Vector3()
  const midPoint = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()

  const colorArray = new Float32Array(connCount * 3)
  const redDrivingTypes = new Set([4, 5, 6, 7]) // 빨간 선 지정용 타입

  let index = 0

  const nodePos = nodePositions
  const uidToRealId = new Map()
  for (const path of mapStore.pathData) uidToRealId.set(path.uid, path.realId)

  for (const path of mapStore.pathData) {
    const start = nodePos.get(path.uid)
    if (!start) continue

    startVec.set(start.x, start.y, start.z)

    for (const conn of path?.stConn) {
      const end = nodePos.get(conn.connNodeUid)
      if (!end) continue

      endVec.set(end.x, end.y, end.z)

      direction.subVectors(endVec, startVec)
      const length = direction.length()

      midPoint.copy(startVec).add(endVec).multiplyScalar(0.5)
      quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize())
      matrix.compose(midPoint, quaternion, new THREE.Vector3(length, 0.1, 0.9))
      instancedMesh.setMatrixAt(index, matrix)

      if (redDrivingTypes.has(conn.drivingType)) {
        color.set(useCommonColor.NODE.DISABLED)
      } else {
        color.set(conn.dirNum === 1 ? useCommonColor.NODE.DIR_NUM_1 : useCommonColor.NODE.DIR_NUM_0)
      }
      color.toArray(colorArray, index * 3)

      index++
    }
  }

  const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
  instancedMesh.instanceColor = colorAttr
  instancedMesh.geometry.setAttribute('instanceColor', colorAttr)

  instancedMesh.count = index
  instancedMesh.renderOrder = 9999  // 포트에 안가려지게 세팅

  group.add(instancedMesh)
  scene.add(group)
}

// 포트 생성
const createPorts = () => {
  const portData = mapStore.portData
  if (!portData.length) return

  const oldGroup = scene.getObjectByName('MiniMapPortGroup')
  if (oldGroup) {
    oldGroup.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose()
        child.material?.dispose()
      }
    })
    scene.remove(oldGroup)
  }

  const group = new THREE.Group()
  group.name = 'MiniMapPortGroup'

  const baseGeometry = new THREE.PlaneGeometry(1, 1)

  const mesh = new THREE.InstancedMesh(baseGeometry, new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  }), portData.length)

  let index = 0

  for (const port of portData) {
    const width = ((port.realW || 100) * commonConst.COORDINATES.SCALE_FACTOR) -1
    const height = ((port.realH || 100) * commonConst.COORDINATES.SCALE_FACTOR) -1

    const x = (port.realX - centerX.value) * commonConst.COORDINATES.SCALE_FACTOR
    const z = -(port.realY - centerZ.value) * commonConst.COORDINATES.SCALE_FACTOR
    const y = 0

    // 색상 설정
    let color = 0xffffff // 기본색
    if (port.bChargePort) {
      color = useCommonColor.PORT.CHARGE || 0xffff00 // 노란색 또는 설정된 색
    } else if (port.bLoadPort && port.bUnloadPort) {
      color = 0xC0C0C0 // 회색
    } else if (port.bLoadPort) {
      color = 0xF222D6 // 분홍
    } else if (port.bUnloadPort) {
      color = 0x008000 // 녹색
    } else if (port.bReadyPort) {
      color = useCommonColor.PORT.READY || 0x00ffff // 청록
    }

    // 개별 포트 색상 적용용 메쉬 생성
    const material = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    })
    const singleMesh = new THREE.Mesh(baseGeometry, material)

    const position = new THREE.Vector3(x, y, z)
    const scale = new THREE.Vector3(width, height, 1)
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

    const matrix = new THREE.Matrix4()
    matrix.compose(position, rotation, scale)

    singleMesh.applyMatrix4(matrix)
    group.add(singleMesh)

    index++
  }

  scene.add(group)
}

// 차량 생성
const createAgvCircles = () => {
  const agvData = mapStore.mapRtkVhlData || []

  agvData.forEach((rtkVhlInfo) => {
    const sdoVhlInfo = rtkVhlInfo.sdoVhl
    const agvVhl = rtkVhlInfo.vhl
    const agvName = sdoVhlInfo.vhlName
    
    if (!agvName || miniAgvObjects.has(agvName)) return

    const x = agvVhl.x
    const y = agvVhl.y
    if (x == null || y == null) return

    // 현재 차량의 상태값 객체 생성 (색상 판별용)
    const vhlState = {
      commState: agvVhl.commState,
      vhlState: agvVhl.vhlState,
      mode: agvVhl.mode,
      warningId: agvVhl.warningId,
      stopState: agvVhl.stopState,
      operationErr: agvVhl.operationErr,
      battery: agvVhl.battery,
      batteryState: agvVhl.battery > sdoVhlInfo.lowestBatt,
      bWorkable: sdoVhlInfo.bworkable
    }

    // 상태에 따른 색상 가져오기
    const { stateColor, modeColor } = getVhlByState(mapStore.layoutColorVehicleObj, vhlState)

    const posX = (x - centerX.value) * commonConst.COORDINATES.SCALE_FACTOR
    const posZ = -(y - centerZ.value) * commonConst.COORDINATES.SCALE_FACTOR

    const group = new THREE.Group()

    // Inner Mesh (내부)
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(40, 32),
      new THREE.MeshBasicMaterial({
        color: modeColor,
        depthTest: false
      })
    )

    // Outer Mesh (테두리)
    const outer = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({
        color: stateColor,
        depthTest: false
      })
    )

    inner.renderOrder = 1
    outer.renderOrder = 2

    inner.rotation.x = -Math.PI / 2
    outer.rotation.x = -Math.PI / 2

    group.add(inner)
    group.add(outer)

    group.position.set(posX, 3, posZ)

    scene?.add(group)
    miniAgvObjects.set(agvName, group)
    
    // 나중에 색상 업데이트를 위해 데이터 저장
    group.userData.inner = inner
    group.userData.outer = outer
  })
}

// 미니맵 DOM이 실제로 화면에 렌더링되어 크기를 가질 때까지 대기
const waitForVisible = () =>
  new Promise(resolve => {
    const check = () => {
      const box = document.querySelector('.minimap_box')
      if (box && box.offsetWidth > 0 && box.offsetHeight > 0) resolve()
      else requestAnimationFrame(check)
    }
    check()
  }
)

// 차량 위치 업데이트
const updateAgvPositions = () => {
  const agvData = mapStore.mapRtkVhlData || []

  // 기존 mini AGV 원 제거 (안전 처리 포함)
  for (const [name, mesh] of miniAgvObjects.entries()) {
    if (!mesh) continue                        // undefined 방지
    if (mesh.parent) mesh.parent.remove(mesh)  // parent 존재 시 제거

    if (mesh.traverse) {
      mesh.traverse(child => {
        if (child.isMesh) {
          child.geometry?.dispose?.()
          child.material?.dispose?.()
        }
      })
    }
  }

  miniAgvObjects.clear()

  // 새 위치로 AGV 원 다시 생성
  agvData.forEach((rtkVhlInfo) => {
    const agvName = rtkVhlInfo.sdoVhl.vhlName
    const x = rtkVhlInfo.vhl.x
    const y = rtkVhlInfo.vhl.y
    if (!agvName || (!x && !y)) return

    const position = new THREE.Vector3(
      (x - centerX.value) * commonConst.COORDINATES.SCALE_FACTOR,
      3,
      -(y - centerZ.value) * commonConst.COORDINATES.SCALE_FACTOR
    )

    const agvState = {
      commState: rtkVhlInfo.vhl.commState,
      vhlState: rtkVhlInfo.vhl.vhlState,
      mode: rtkVhlInfo.vhl.mode,
      warningId: rtkVhlInfo.vhl.warningId,
      stopState: rtkVhlInfo.vhl.stopState,
      operationErr: rtkVhlInfo.vhl.operationErr,
      battery: rtkVhlInfo.vhl.battery,
      batteryState: rtkVhlInfo.vhl.battery > rtkVhlInfo.sdoVhl.lowestBatt,
      bWorkable: rtkVhlInfo.sdoVhl.bworkable,
    }

    // 외부 파란 원
    const outerCircle = new THREE.Mesh(
      new THREE.CircleGeometry(12, 32),
      new THREE.MeshBasicMaterial({
        color: getVhlByState(mapStore.layoutColorVehicleObj, agvState).connectedColor,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    )
    outerCircle.rotation.x = -Math.PI / 2
    outerCircle.position.copy(position)

    // 내부 색상 원
    const innerCircle = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshBasicMaterial({
        color: getVhlByState(mapStore.layoutColorVehicleObj, agvState).stateColor,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    )
    innerCircle.rotation.x = -Math.PI / 2
    innerCircle.position.copy(position)

    const group = new THREE.Group()
    group.add(outerCircle)
    group.add(innerCircle)
    group.userData.type = 'miniAgvCircle'
    group.userData.name = agvName

    scene?.add(group)
    miniAgvObjects.set(agvName, group)
  })
}

// 레드 박스 생성
const createRedViewBox = () => {
  if(!scene) return
  
  const old = scene?.getObjectByName('ViewBoxGroup')
  if (old) scene.remove(old)

  isRedBox.value = true

  const zoom = mapStore.cameraTarget?.zoom || 1
  
  // 빨간 박스가 작게 출력되면 정사각형으로 되었다가 화면 크기만큼 바뀜 +1000 늘려줌
  const width = boxWidth / zoom + 1000
  const height = boxHeight / zoom + 1000

  // 빨간 박스 테두리
  const points = [
    new THREE.Vector3(-width / 2, 0, -height / 2),
    new THREE.Vector3(width / 2, 0, -height / 2),
    new THREE.Vector3(width / 2, 0, height / 2),
    new THREE.Vector3(-width / 2, 0, height / 2)
  ]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)

  const material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 5,
    depthTest: false,
    transparent: true
  })

  const box = new THREE.LineLoop(geometry, material)
  box.name = 'ViewBox'
  box.position.y = 2

  // 드래그 전용 투명 히트박스 생성
  const hitGeo = new THREE.PlaneGeometry(width, height)
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthTest: false
  })

  const hitBox = new THREE.Mesh(hitGeo, hitMat)
  hitBox.name = 'ViewBoxHit'
  hitBox.rotation.x = -Math.PI / 2   // XZ 평면
  hitBox.position.y = 2

  // 그룹
  const group = new THREE.Group()
  group.name = 'ViewBoxGroup'
  group.add(box)
  group.add(hitBox)
  group.renderOrder = 99999;

  scene?.add(group)
  renderer?.render(scene, camera)
}

// 메인맵 카메라 위치/회전에 맞춰 미니맵 빨간 박스 위치 및 방향 동기화
const updateRedViewBoxPosition = (info) => {
  const boxGroup = scene?.getObjectByName('ViewBoxGroup')
  if (!boxGroup || !info) return

  const angle = scene.rotation.y
  const cosA = Math.cos(-angle)
  const sinA = Math.sin(-angle)

  // 위치 동기화: 메인 맵이 보고 있는 중앙 지점(target)을 박스 중심으로 잡음
  boxGroup.position.x = info.target.x * cosA + info.target.z * sinA
  boxGroup.position.z = -info.target.x * sinA + info.target.z * cosA

  // 박스 회전 고정: 맵(scene)이 회전한 만큼 반대로 박스를 돌려줌
  // 이렇게 하면 맵은 돌아가도 빨간 박스는 항상 모니터와 수평(가로)을 유지합니다.
  boxGroup.rotation.y = -angle

  renderer.render(scene, camera)
}

// 메인맵 카메라 줌/뷰 영역에 맞춰 미니맵 빨간 박스 크기 동기화
const updateRedViewBoxScale = (info) => {
  const box = scene?.getObjectByName('ViewBox')
  const hit = scene?.getObjectByName('ViewBoxHit')
  if (!box || !info) return
  if (info.mode !== 'OrthographicCamera') return

  const right = Number(info.right)
  const left = Number(info.left)
  const top = Number(info.top)
  const bottom = Number(info.bottom)
  const zoom = Number(info.zoom)
  if (!Number.isFinite(right) || !Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(zoom) || zoom === 0) return

  const angle = mapStore.sceneAngle || 0
  const everyangle = Math.abs(Math.sin(angle)) > 0.5

  let finalWidth, finalHeight;

  if (everyangle) {
    finalWidth = (right - left) / zoom;
    finalHeight = (top - bottom) / zoom;
  } else {
    finalWidth = (right - left) / zoom;
    finalHeight = (top - bottom) / zoom;
  }

  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-finalWidth / 2, 1, -finalHeight / 2),
    new THREE.Vector3( finalWidth / 2, 1, -finalHeight / 2),
    new THREE.Vector3( finalWidth / 2, 1,  finalHeight / 2),
    new THREE.Vector3(-finalWidth / 2, 1,  finalHeight / 2),
    new THREE.Vector3(-finalWidth / 2, 1, -finalHeight / 2),
  ])

  box.geometry.dispose()
  box.geometry = geom

  if (hit) {
    hit.scale.set(finalWidth, finalHeight, 1)
  }
}

// 미니맵 마우스 좌표 → 월드좌표 변환
const getPointerPosition = (event) => {
  const rect = miniMapCanvas.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const point = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, point)

  return point
}

// 미니맵에서 마우스 클릭 시 빨간 박스 드래그 시작 처리
const onMiniMapDown = (event) => {

  const rect = miniMapCanvas.value.getBoundingClientRect()

  const tx = (event.clientX - rect.left) / rect.width
  const ty = (event.clientY - rect.top) / rect.height

  mouse.x = (tx * 2) - 1
  mouse.y = -(ty * 2) + 1

  raycaster.setFromCamera(mouse, camera)

  const hit = scene.getObjectByName('ViewBoxHit')
  if (!hit) return

  const intersects = raycaster.intersectObject(hit)

  if (intersects.length > 0) {

    isDraggingBox = true

    const boxGroup = scene.getObjectByName('ViewBoxGroup')

    // 마우스 world 좌표
    const worldX = camera.left + tx * (camera.right - camera.left)
    const worldZ = camera.bottom + ty * (camera.top - camera.bottom)

    // 박스 중심과 마우스 차이 저장
    dragOffset.x = boxGroup.position.x - worldX
    dragOffset.z = boxGroup.position.z - worldZ
  }
}

// 미니맵에서 마우스 이동 시 빨간 박스 드래그 및 메인맵 동기화
const onMiniMapMove = (event) => {

  if (!isDraggingBox) return

  const boxGroup = scene.getObjectByName('ViewBoxGroup')
  if (!boxGroup) return

  // raycaster로 world 좌표 얻기
  const point = getPointerPosition(event)

  let worldX = point.x
  let worldZ = point.z

  // 박스 이동 (제한 없음)
  boxGroup.position.set(worldX, boxGroup.position.y, worldZ)

  // 메인맵 동기화
  syncMainMapToMinimap({
    x: worldX,
    z: worldZ
  })

  renderer.render(scene, camera)
}

// 메인 맵 카메라 위치를 박스 위치에 맞게 업데이트하는 헬퍼 함수
const syncMainMapToMinimap = (pos) => {
  const cam = mapStore.cameraInfo
  const controls = mapStore.controlsInfo

  if (cam && controls) {
    // 카메라와 타겟 사이의 오프셋(높이 등) 유지
    const offsetX = cam.position.x - controls.target.x
    const offsetZ = cam.position.z - controls.target.z

    // 메인 맵의 중심점을 미니맵 박스 위치로 이동
    controls.target.set(pos.x, 0, pos.z)
    cam.position.set(pos.x + offsetX, cam.position.y, pos.z + offsetZ)
    
    controls.update()
  }
}

// 미니맵 드래그 종료 시 상태 해제
const onMiniMapUp = () => {
  isDraggingBox = false
}

// 미니맵 접힘/펼침 상태 감지하여 canvas 크기 복원
watch(isCollapsed, async (val) => {
  if (val) return  // 접힐 때는 아무 것도 하지 말기

  // 펼쳐질 때에만 복구
  await nextTick()

  const canvas = miniMapCanvas.value
  if (canvas && lastCanvasSize.value.w > 0) {
    const size = lastCanvasSize.value.w

    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    canvas.width = size * window.devicePixelRatio
    canvas.height = size * window.devicePixelRatio

    renderer.setSize(size, size, false)
    renderer.render(scene, camera)
  }
})

// 미니맵 전체 다시 그리기 (노드/경로/포트 + 카메라)
const drawMiniMap = () => {
  createNodes()
  createPaths()
  createPorts()

  fitCameraToMap()

  renderer.render(scene, camera)
}

// pathData 변경 감지하여 미니맵 재구성
const watchPathData = () => {
  watch(
    () => mapStore.pathData,
    async (val) => {
      if (val && val.length) {
        calculateCenter()
        
        await nextTick()

        drawMiniMap()
      }
    },
    { immediate: true, deep: true }
  )
}

// portData 변경 시 포트만 다시 생성
const watchPortData = () => {
  watch(
    () => mapStore.portData,
    (val) => {
      if (val && val.length) {
        createPorts()

        renderer.render(scene, camera)
      }
    },
    { immediate: true, deep: true }
  )
}

// 차량 위치 및 색상 실시간 업데이트
const moveAgvPositions = () => {
  const agvData = mapStore.mapRtkVhlData || []

  agvData.forEach((rtkVhlInfo) => {
    const sdoVhlInfo = rtkVhlInfo.sdoVhl
    const agvVhl = rtkVhlInfo.vhl
    const agvName = sdoVhlInfo.vhlName
    
    // 미니맵에 등록된 객체 가져오기
    const group = miniAgvObjects.get(agvName)
    if (!group) return

    // 위치 업데이트
    const x = agvVhl.x
    const y = agvVhl.y
    if (x != null && y != null) {
      const posX = (x - centerX.value) * commonConst.COORDINATES.SCALE_FACTOR
      const posZ = -(y - centerZ.value) * commonConst.COORDINATES.SCALE_FACTOR
      group.position.set(posX, 3, posZ)
    }

    // 실시간 상태 객체 생성
    const vhlState = {
      commState: agvVhl.commState,
      vhlState: agvVhl.vhlState,
      mode: agvVhl.mode,
      warningId: agvVhl.warningId,
      stopState: agvVhl.stopState,
      operationErr: agvVhl.operationErr,
      battery: agvVhl.battery,
      batteryState: agvVhl.battery > sdoVhlInfo.lowestBatt,
      bWorkable: sdoVhlInfo.bworkable
    }

    // 상태별 색상 계산
    const { stateColor, modeColor } = getVhlByState(mapStore.layoutColorVehicleObj, vhlState)

    // 메쉬 색상 실시간 반영
    const inner = group.userData.inner
    const outer = group.userData.outer

    if (inner && inner.material.color.getHex() !== new THREE.Color(modeColor).getHex()) {
      inner.material.color.set(modeColor)
    }
    if (outer && outer.material.color.getHex() !== new THREE.Color(stateColor).getHex()) {
      outer.material.color.set(stateColor)
    }
  })
}

watch(
  () => mapStore.mapRtkVhlData,
  async (val) => {
    if (!val || !val.length) return
    if (!scene) return

    if (miniAgvObjects.size === 0) {
      createAgvCircles()
    } else {
      moveAgvPositions()
    }

    renderer?.render(scene, camera)
  },
  { deep: true, immediate: true }
)

// 메인맵 카메라 정보 변경 시 빨간 박스 위치/크기 동기화
watch(
  () => mapStore.cameraTarget,
  (info) => {
    if (!info) return
    if (!info.position || !info.target) return
    if (info.mode !== 'OrthographicCamera') return
    if (!Number.isFinite(info.zoom) || info.zoom === 0) return
    if (!Number.isFinite(info.left) || !Number.isFinite(info.right) || !Number.isFinite(info.top) || !Number.isFinite(info.bottom)) return

    if(!isRedBox.value){ 
      createRedViewBox()
    }
    updateRedViewBoxPosition(info)
    updateRedViewBoxScale(info)
  },
  { immediate: true, deep: true }
)

// 외부 제어 target 변경 시 메인맵 카메라 target 동기화
watch(() => mapStore.controlInfo?.target, (target) => {
  if (target && mapStore.controls) {
    mapStore.controls.target.set(target.x, target.y, target.z)
    mapStore.controls.update()
  }
}, { immediate: true, deep: true })

// 맵 회전값 변경 시 미니맵 회전 및 박스 보정
watch(
  () => mapStore.sceneAngle,
  (sceneAngle) => {
    if (!scene) return
    // 미니맵의 맵 자체를 회전
    scene.rotation.y = sceneAngle 
    // 박스 그룹을 찾아 즉시 반대 방향으로 회전시켜 회전 상쇄
    const boxGroup = scene.getObjectByName('ViewBoxGroup') 
    if (boxGroup) {
      boxGroup.rotation.y = -sceneAngle 
    }
    renderer?.render(scene, camera)
  },
  { deep: true }
)

// 줌 변경 시 빨간 박스 크기 업데이트
watch(
  () => mapStore.sceneZoom,
  (zoomValue) => {
    if (!scene) return

    const cameraInfo = mapStore.cameraInfo
    if (!cameraInfo) return
    if (cameraInfo.mode !== 'OrthographicCamera') return
    if (!Number.isFinite(cameraInfo.zoom) || cameraInfo.zoom === 0) return
    if (!Number.isFinite(cameraInfo.left) || !Number.isFinite(cameraInfo.right) || !Number.isFinite(cameraInfo.top) || !Number.isFinite(cameraInfo.bottom)) return

    updateRedViewBoxScale(cameraInfo)
  }
)

// 미니맵 초기화 및 데이터 바인딩
onMounted(async () => {
  await waitForVisible()
  await nextTick()

  // 렌더러, 카메라 준비
  initMiniMap()        

  await nextTick()

  // 중심 계산
  calculateCenter()

  // 모든 노드/포트/경로 생성
  drawMiniMap()

  // drawMiniMap() 후 렌더 안정화
  await nextTick()

  watchPathData()
  watchPortData()
})
</script>

<style lang="scss" scoped>

// 팝업 헤더 조정
.component-panel.b-modal-popup.cancel :deep(> .panel-header) {
  height: 38px !important;
}

:deep(.header-title) {
  display: none !important;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  margin:unset;
  width:100%;

  .panel-title {
    font-size: 1.2rem;
    font-weight: 500;
    color: #fff !important;
    cursor:default;
  }

  :deep(.button.is-text) {
    font-size: 18px !important;
    padding: 0;
    min-width: 26px;
    height: 26px;
    border-bottom:unset;
    border:none !important;
    text-decoration: none !important;
    
    .icon{
      font-size:24px;
      border-bottom:0;
      color:#fff !important;
    }
    &:hover {
      color: #fff;
      background:none;
    }
    
  }
  button{
    background:unset;
    &:focus{
      background:unset;
    }
  }
}

.b-modal-popup {
  width: 100%;
  min-width:100px;
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
}

.minimap_box {
  position: relative;
  width: 100%;
  height:100%;
  background: #ddd;
  border-radius: 4px;
  overflow: hidden;
  display:flex;
  justify-content: center;
  align-items: center;
}

.mini-map-canvas {
  width: 100% !important;
  object-fit: contain;
  // aspect-ratio:1 / 1;
  display:block;
}

.b-modal-popup :deep(.panel-body){
  background:unset !important;
}

/* 부드러운 열림/닫힘 애니메이션 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width:1920px){
  .inner-modal-content{
    padding:8px !important;
  }
  // 팝업 헤더 조정
  .component-panel.b-modal-popup.cancel :deep(> .panel-header) {
    height: 35px !important;
  }
  :deep(.panel-header .panel-title) {
    font-size: 1.1rem !important;
  }
}
@media (max-width: 1800px) {
    // 팝업 헤더 조정
  .component-panel.b-modal-popup.cancel :deep(> .panel-header) {
    height: 32px !important;
  }
  :deep(.panel-header .panel-title) {
    font-size: 1rem !important;
  }
}
</style>