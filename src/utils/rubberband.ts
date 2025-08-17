import { bound } from './bound'

// 러버밴드 물리 효과 계산 함수 - iOS의 탄성 스크롤 효과를 수학적으로 모델링
// 설계 원리: 스프링 물리학 기반으로 거리가 멀어질수록 저항이 증가하는 비선형 감쇠 함수
// 수학적 배경: f(x) = (x * D * C) / (D + C * x) 공식으로 점근선을 가진 곡선 생성
// 매개변수 의미: distance=벗어난 거리, dimension=기준 크기, constant=탄성 계수
export function rubberband(
  distance: number, // 경계를 벗어난 거리 (항상 양수)
  dimension: number, // 뷰포트나 컨테이너의 크기 (기준 차원)
  constant: number // 탄성 상수 (0.15 정도가 자연스러운 느낌)
) {
  // 핵심 공식: 거리가 증가할수록 실제 이동량은 점점 줄어들어 무한대로 발산하지 않음
  // 결과 특성: distance가 0에 가까우면 거의 선형, 커질수록 점근선에 수렴
  // 물리적 의미: 용수철이 늘어날수록 추가로 늘어나기 어려워지는 현상을 모델링
  return (distance * dimension * constant) / (dimension + constant * distance)
}

// 경계 기반 러버밴드 효과 적용 함수 - 범위를 벗어날 때만 탄성 효과 적용
// 설계 의도: 정상 범위에서는 선형 동작, 범위 초과 시에만 비선형 저항 효과 제공
// 사용 사례: 스크롤 오버슈트, 드래그 경계 처리, 슬라이더 범위 제한 등
// iOS/Android 네이티브 동작과 동일한 물리적 피드백 제공
export function rubberbandIfOutOfBounds(
  position: number, // 현재 위치 (실제 사용자 입력이나 계산된 위치)
  min: number, // 허용 최소값
  max: number, // 허용 최대값
  dimension: number, // 기준 크기 (보통 뷰포트나 컨테이너 크기)
  constant = 0.15 // 탄성 계수 (0.15는 자연스러운 기본값, 0=탄성없음, 1=강한탄성)
) {
  // 탄성 비활성화: constant가 0이면 일반적인 clamp 동작 (hard boundary)
  // 성능 최적화: 탄성 계산 없이 즉시 범위 제한 적용
  if (constant === 0) return bound(position, min, max)

  // 하한선 초과: 최소값보다 작은 경우의 탄성 처리
  // 핵심 설계: 음수 오프셋을 계산하여 최소값에서 아래쪽으로 제한된 거리만큼 이동
  // 결과: min - 작은_양수 형태로 최소값 아래쪽에 위치하지만 무한정 멀어지지 않음
  if (position < min)
    return -rubberband(min - position, dimension, constant) + min

  // 상한선 초과: 최대값보다 큰 경우의 탄성 처리
  // 대칭적 설계: 상한선 초과도 하한선과 동일한 원리로 처리
  // 결과: max + 작은_양수 형태로 최대값 위쪽에 위치하지만 제한된 범위 내
  if (position > max)
    return +rubberband(position - max, dimension, constant) + max

  // 정상 범위 내: 탄성 효과 없이 원래 위치 그대로 반환
  // 성능 최적화: 범위 내에서는 추가 계산 없음
  return position
}
