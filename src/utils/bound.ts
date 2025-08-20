// 🎯 Bound: 숫자 값을 지정된 범위 내로 제한하는 클램핑(Clamping) 유틸리티 함수
// Why: UI 컴포넌트에서 사용자 입력, 애니메이션, 스크롤 위치 등을 안전한 범위 내로 제한할 필요가 빈번함
// How: Math.max/min을 단계적으로 적용하여 하한과 상한을 모두 고려한 범위 제한 수행

// 수학적 배경: Clamp 함수는 컴퓨터 그래픽스, 게임 개발, UI 프로그래밍에서 널리 사용되는 기본 연산
// 공식: clamp(x, min, max) = max(min, min(x, max))
// 하지만 이 구현은 undefined 처리를 위해 조건부로 단계별 적용하는 더 안전한 방식 사용

// 주요 사용 사례:
// 1. 숫자 입력 필드: 사용자 입력값을 허용 범위 내로 제한 (Input 컴포넌트)
// 2. 슬라이더/프로그레스: 진행률을 0-100% 범위 내로 제한
// 3. 애니메이션: 스프링 애니메이션의 변위값을 물리적 한계 내로 제한
// 4. 스크롤: 스크롤 위치를 콘텐츠 영역 내로 제한 (무한 스크롤 방지)
// 5. 좌표계: 드래그 앤 드롭에서 요소를 특정 영역 내로 제한

export function bound(
  position: number, // 🎯 제한할 대상 값 (입력값, 좌표, 크기 등)
  min: number | undefined, // 🔻 최소값 (undefined면 하한 제한 없음)
  max: number | undefined // 🔺 최대값 (undefined면 상한 제한 없음)
) {
  // 단계별 범위 제한: 원본 값을 기준으로 시작하여 점진적으로 범위 적용
  // Why: 하한과 상한을 독립적으로 처리하여 undefined 값에 대한 안전성 확보
  // How: 조건부 검사 후 Math.max/min 적용으로 범위 제한
  let ret = position // 결과값 초기화: 원본 값에서 시작

  // 🔻 하한값 적용: 최소값이 정의된 경우 해당 값 이상으로 제한
  // Why: min이 undefined인 경우 하한 제한을 적용하지 않아야 함 (무한 범위 허용)
  // How: Math.max(현재값, 최소값)로 더 큰 값 선택 → 최소값 이상 보장
  if (min !== undefined) {
    ret = Math.max(position, min) // position < min이면 min 반환, 아니면 position 유지
  }

  // 🔺 상한값 적용: 최대값이 정의된 경우 해당 값 이하로 제한
  // Why: max가 undefined인 경우 상한 제한을 적용하지 않아야 함 (무한 범위 허용)
  // How: Math.min(현재값, 최대값)으로 더 작은 값 선택 → 최대값 이하 보장
  if (max !== undefined) {
    ret = Math.min(ret, max) // ret > max이면 max 반환, 아니면 ret 유지
  }

  // 단계별 적용의 중요성:
  // 1단계 (하한): position이 min보다 작으면 min으로 올림
  // 2단계 (상한): 1단계 결과가 max보다 크면 max로 내림
  // 결과: min ≤ result ≤ max 범위 내의 값 보장 (min, max가 정의된 경우)

  return ret // 범위 제한이 적용된 최종값 반환

  // 실제 동작 예시:
  // bound(5, 1, 10)     → 5   (범위 내 값은 그대로 유지)
  // bound(-3, 1, 10)    → 1   (최소값 미만이므로 최소값으로 클램핑)
  // bound(15, 1, 10)    → 10  (최대값 초과이므로 최대값으로 클램핑)
  // bound(5, undefined, 10) → 5   (하한 없음, 상한만 적용)
  // bound(5, 1, undefined)  → 5   (상한 없음, 하한만 적용)
  // bound(5, undefined, undefined) → 5 (제한 없음, 원본값 반환)

  // 특수한 경우 처리:
  // - NaN 입력: Math.max/min은 NaN을 반환하므로 호출 전에 isNaN 체크 권장
  // - Infinity 값: 정상적으로 처리됨 (Infinity는 모든 수보다 크고 -Infinity는 모든 수보다 작음)
  // - min > max 상황: 이 함수는 min을 우선시함 (Math.max 먼저 적용)

  // 성능 특성:
  // - 시간복잡도: O(1) - 상수 시간 연산
  // - 공간복잡도: O(1) - 추가 메모리 사용 없음
  // - 브랜치 예측: 조건문 2개로 분기가 적어 CPU 캐시 친화적
}
