// Nearest 함수: 배열에서 목표값에 가장 가까운 수치를 효율적으로 탐색
// Why: UI 컴포넌트에서 연속적인 값을 미리 정의된 고정값으로 "스냅"하는 기능이 필수적
// How: 유클리드 거리 기반 선형 탐색으로 최소 거리 요소를 찾아 반환

// 주요 사용 사례 분석:
// 1. FloatingPanel: 드래그 종료 시 가장 가까운 앵커 높이로 자동 스냅
// 2. Slider: 사용자 드래그 위치를 가장 가까운 눈금값으로 보정
// 3. Stepper: 입력값을 허용된 단위 중 가장 가까운 값으로 조정
// 4. 색상 선택기: RGB 값을 팔레트의 가장 유사한 색상으로 매칭

// 알고리즘 특성:
// - 시간복잡도: O(n) - 모든 요소를 한 번씩 비교
// - 공간복잡도: O(1) - 추가 메모리 사용 없음
// - 정렬 요구사항: 없음 (배열이 정렬되지 않아도 동작)
// - 동점 처리: 배열 앞쪽 요소 우선 (안정 정렬 특성)

export function nearest(arr: number[], target: number) {
  // Array.reduce 기반 최적화된 탐색
  // Why: for 루프보다 함수형 스타일로 가독성 향상, 중간 변수 없이 직접 결과 반환
  // How: 누적값(accumulator)에 현재까지의 최적값 저장, 매 반복에서 더 나은 값으로 갱신
  return arr.reduce((previousBest, currentValue) => {
    // 유클리드 거리 계산: |현재값 - 목표값|
    const previousDistance = Math.abs(previousBest - target) // 이전 최적값과의 거리
    const currentDistance = Math.abs(currentValue - target) // 현재값과의 거리

    // 거리 비교 및 선택 로직
    // Why: 더 짧은 거리가 더 가까운 값을 의미하므로 최소값 선택
    // How: 삼항 연산자로 조건부 선택, 동점일 경우 기존값 유지 (안정성)
    return previousDistance < currentDistance ? previousBest : currentValue

    // 동점 처리 세부사항:
    // previousDistance === currentDistance인 경우 previousBest 선택
    // → 배열의 앞쪽 요소가 우선순위를 가짐 (First-In-First-Out)
    // → 예: nearest([10, 20], 15) => 10 (둘 다 거리 5이지만 10이 먼저 등장)
  })

  // 실제 사용 예시와 결과 분석:
  // nearest([100, 200, 300], 250) => 200
  //   ∵ |200-250|=50 < |300-250|=50이지만 200이 먼저 등장
  //
  // nearest([-10, 0, 10], -3) => 0
  //   ∵ |-10-(-3)|=7, |0-(-3)|=3, |10-(-3)|=13 → 최소값 3인 0 선택
  //
  // nearest([1, 3, 5], 4) => 3 또는 5
  //   ∵ |3-4|=1, |5-4|=1 (동점) → 배열 순서상 3이 먼저이므로 3 선택
}
