// Touch 제스처 추적 훅: 모바일 터치 이벤트의 방향과 거리를 정밀하게 추적하는 유틸리티
// Why: 복잡한 터치 인터렉션(드래그, 스와이프, 스크롤)에서 방향과 거리 정보가 필수적
// How: 터치 시작점부터의 누적 이동량과 방향을 실시간으로 계산하여 제공

import { useRef } from 'react'

// 방향 감지 임계값: 10px 이상 이동해야 의미있는 제스처로 인식
// Why: 작은 손떨림이나 탭 동작을 드래그로 오인하지 않기 위함
// How: 절대값 거리가 임계값을 넘어야 방향 결정
const MIN_DISTANCE = 10

// 터치 방향 타입: 빈 문자열은 방향 미결정 상태
type Direction = '' | 'vertical' | 'horizontal'

// 터치 방향 결정 함수: X/Y축 이동량을 비교하여 주된 방향 판단
// Why: 대각선 이동에서도 더 강한 축을 기준으로 명확한 방향 결정 필요
// How: 큰 축의 이동량이 임계값을 넘어야 해당 방향으로 인식
function getDirection(x: number, y: number) {
  if (x > y && x > MIN_DISTANCE) {
    // 가로 이동이 세로보다 크고 임계값 초과 시 가로 방향
    return 'horizontal'
  }
  if (y > x && y > MIN_DISTANCE) {
    // 세로 이동이 가로보다 크고 임계값 초과 시 세로 방향
    return 'vertical'
  }
  // 둘 다 임계값 미달이거나 동일한 경우 방향 미결정
  return ''
}

// Touch 추적 훅 메인 구현부
// Why: 터치 이벤트의 복잡한 계산과 상태 관리를 재사용 가능한 훅으로 추상화
// How: useRef로 리렌더링 없이 상태를 추적하고 계산된 값들을 실시간으로 제공
export function useTouch() {
  // 터치 시작점 좌표: 모든 이동량 계산의 기준점
  // Why: 상대적 이동거리 계산을 위한 고정 참조점 필요
  const startX = useRef(0) // 터치 시작 X 좌표
  const startY = useRef(0) // 터치 시작 Y 좌표

  // 델타 값: 시작점 대비 상대적 이동량 (방향 포함)
  // Why: 양수/음수 방향 정보가 필요한 드래그 로직에 사용
  const deltaX = useRef(0) // X축 이동량 (오른쪽: +, 왼쪽: -)
  const deltaY = useRef(0) // Y축 이동량 (아래쪽: +, 위쪽: -)

  // 오프셋 값: 절대값 이동 거리 (방향 무관)
  // Why: 이동 거리 크기만 필요한 로직에 사용 (방향 판단, 임계값 비교)
  const offsetX = useRef(0) // X축 절대 이동 거리
  const offsetY = useRef(0) // Y축 절대 이동 거리

  // 터치 방향: 계산된 주된 이동 방향
  // Why: 스크롤 vs 드래그 구분, 방향별 로직 분기에 필수
  const direction = useRef<Direction>('')

  // 방향 확인 헬퍼 함수들
  // Why: 방향 상태를 간단하게 확인할 수 있는 편의 메서드 제공
  const isVertical = () => direction.current === 'vertical' // 세로 방향 여부
  const isHorizontal = () => direction.current === 'horizontal' // 가로 방향 여부

  // 상태 초기화 함수: 새로운 터치 세션을 위한 값들 리셋
  // Why: 이전 터치의 잔여 값들이 새로운 터치에 영향을 주지 않도록 정리
  // How: 모든 계산값을 초기상태로 복원 (시작점 제외)
  const reset = () => {
    deltaX.current = 0 // X축 이동량 초기화
    deltaY.current = 0 // Y축 이동량 초기화
    offsetX.current = 0 // X축 절대거리 초기화
    offsetY.current = 0 // Y축 절대거리 초기화
    direction.current = '' // 방향 정보 초기화
  }

  // 터치 시작 이벤트 핸들러: 새로운 터치 세션의 기준점 설정
  // Why: 모든 상대적 계산의 기준이 되는 시작점을 정확히 포착해야 함
  // How: 첫 번째 터치점의 좌표를 시작점으로 저장하고 상태 초기화
  const start = ((event: TouchEvent) => {
    reset() // 이전 터치 세션의 잔여값 정리
    startX.current = event.touches[0].clientX // 터치 시작 X 좌표 저장
    startY.current = event.touches[0].clientY // 터치 시작 Y 좌표 저장
  }) as EventListener

  // 터치 이동 이벤트 핸들러: 실시간 이동량과 방향 계산
  // Why: 터치가 이동할 때마다 현재 상태를 업데이트하여 정확한 추적 제공
  // How: 현재 위치와 시작점의 차이로 이동량 계산, 방향은 한 번만 결정
  const move = ((event: TouchEvent) => {
    const touch = event.touches[0] // 첫 번째 터치점 (멀티터치 미지원)

    // X축 이동량 계산 (Safari 호환성 처리)
    // Why: Safari에서 뒤로가기 제스처 시 clientX가 음수가 되는 버그 대응
    // How: clientX < 0인 경우 0으로 보정하여 예외상황 방지
    deltaX.current = touch.clientX < 0 ? 0 : touch.clientX - startX.current

    // Y축 이동량 계산 (Safari 버그 없음)
    deltaY.current = touch.clientY - startY.current

    // 절대값 이동 거리 계산
    // Why: 방향 판단과 임계값 비교에는 절대값이 필요
    offsetX.current = Math.abs(deltaX.current) // X축 절대 이동 거리
    offsetY.current = Math.abs(deltaY.current) // Y축 절대 이동 거리

    // 방향 결정 (최초 1회만)
    // Why: 터치 시작 후 방향이 한번 결정되면 변경하지 않아 일관된 제스처 해석 제공
    // How: 방향이 아직 결정되지 않은 경우에만 계산 실행
    if (!direction.current) {
      direction.current = getDirection(offsetX.current, offsetY.current)
    }
  }) as EventListener

  // 훅 반환값: 터치 추적에 필요한 모든 메서드와 상태 제공
  // Why: 다양한 터치 인터렉션 패턴에서 필요한 모든 정보를 한 곳에서 제공
  // How: 이벤트 핸들러, 상태값, 헬퍼 함수를 하나의 객체로 묶어서 반환
  return {
    // 이벤트 핸들러들
    move, // touchmove 이벤트용 핸들러
    start, // touchstart 이벤트용 핸들러
    reset, // 수동 상태 초기화 함수

    // 위치 및 거리 상태값들 (ref 객체)
    startX, // 터치 시작 X 좌표
    startY, // 터치 시작 Y 좌표
    deltaX, // X축 상대 이동량 (방향 포함)
    deltaY, // Y축 상대 이동량 (방향 포함)
    offsetX, // X축 절대 이동 거리
    offsetY, // Y축 절대 이동 거리
    direction, // 계산된 터치 방향

    // 방향 확인 헬퍼 함수들
    isVertical, // 세로 방향 여부 확인
    isHorizontal, // 가로 방향 여부 확인
  }
}
