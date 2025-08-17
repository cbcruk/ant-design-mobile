// TypeScript 오버로드: 다양한 인수 수에 대한 정확한 타입 추론 지원
// 반환 타입: 맨 뒤 인수가 가장 높은 우선순위를 가지도록 설계 (D & C & B & A)
export function mergeProps<A, B>(a: A, b: B): B & A
export function mergeProps<A, B, C>(a: A, b: B, c: C): C & B & A
export function mergeProps<A, B, C, D>(a: A, b: B, c: C, d: D): D & C & B & A

// props 병합 함수 - React 컴포넌트에서 기본값 + 전역 설정 + 사용자 props를 우선순위에 따라 병합
// 설계 철학: undefined는 "값이 없음"을 의미하므로 병합에서 제외, null은 "명시적 빈 값"이므로 병합에 포함
// 주요 사용 예: mergeProps(defaultProps, globalConfig, userProps)
// 성능 고려: shallow merge로 중첩 객체는 덮어쓰기됨 (deep merge 불가)
export function mergeProps(...items: any[]) {
  const ret: any = {} // 결과 객체

  // 배열 순서대로 병합: 뒤에 오는 값이 앞의 값을 덮어쓰는 우선순위 적용
  items.forEach(item => {
    // null 체크: item이 null이나 undefined인 경우 건너뛰기
    if (item) {
      Object.keys(item).forEach(key => {
        // undefined 제외 로직: undefined는 "값이 설정되지 않음"을 의미하므로 병합 대상에서 제외
        // 중요: null, false, 0, ""등은 유효한 값으로 간주하여 병합에 포함
        if (item[key] !== undefined) {
          ret[key] = item[key] // 뒤에 오는 값이 앞의 값을 덮어쓰기
        }
      })
    }
  })
  return ret
}

// 단일 값 버전 병합 함수 - 여러 단계의 fallback 값 중 첫 번째 유효한 값을 반환
// 설계 의도: deprecated props와 새 props 간의 호환성 유지나 다단계 fallback 처리
// 사용 예: mergeProp(defaultIcon, legacyIcon, newIcon) - 새 prop이 있으면 사용, 없으면 레거시, 둘 다 없으면 기본값
// 우선순위: 배열의 뒤에서부터 체크하여 첫 번째 비-undefined 값을 채택 (마지막 인수 최고 우선순위)
export function mergeProp<T, DefaultT extends T = T>(
  defaultProp: DefaultT, // fallback 기본값 (모든 prop이 undefined일 때 사용)
  ...propList: T[] // 우선순위에 따라 체크할 prop 목록
): T | undefined {
  // 역순으로 순회: 배열의 마지막 요소부터 체크 (최고 우선순위)
  // 논리: 마지막에 전달된 값이 가장 중요하므로 먼저 체크
  for (let i = propList.length - 1; i >= 0; i -= 1) {
    if (propList[i] !== undefined) {
      return propList[i] // 첫 번째 유효한 값 즉시 반환
    }
  }

  // 모든 prop이 undefined인 경우 기본값 반환
  // 주의: defaultProp도 undefined일 수 있음 (이 경우 undefined 반환)
  return defaultProp
}
