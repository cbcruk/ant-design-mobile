// 가장 가까운 값 찾기 함수 - 배열에서 목표값에 가장 가까운 수치를 효율적으로 탐색
// 설계 의도: 드래그 앤 드롭, 슬라이더, 앵커 포인트 등에서 "가장 가까운 값으로 스냅" 기능 구현
// 주요 사용처: FloatingPanel의 앵커 스냅, Stepper의 단위 조정, Slider의 눈금 맞춤 등
// 알고리즘: 단순 선형 탐색으로 O(n) 복잡도 (배열이 작은 경우 충분히 효율적)
export function nearest(arr: number[], target: number) {
  // reduce를 이용한 최소 거리 탐색
  // 핵심 로직: 각 요소와 목표값 간의 절댓값 거리를 비교하여 더 가까운 값을 누적적으로 선택
  // 수학적 근거: |a - target| < |b - target|이면 a가 target에 더 가까움
  return arr.reduce((pre, cur) => {
    // 거리 비교: 이전 최소값(pre)과 현재값(cur) 중 target에 더 가까운 것 선택
    // Math.abs 사용 이유: 음수/양수 방향에 관계없이 실제 거리만 고려
    // 동일한 거리일 경우 이전값(pre) 우선 (배열 앞쪽 요소 우선순위)
    return Math.abs(pre - target) < Math.abs(cur - target) ? pre : cur
  })
  // 예시: nearest([100, 200, 300], 250) => 200 (250에 가장 가까운 값)
  //       nearest([-10, 0, 10], -3) => 0 (|-3-0| = 3 < |-3-(-10)| = 7)
}
