// 🔀 MergeProps: React 컴포넌트의 Props 우선순위 병합을 위한 고도화된 유틸리티
// Why: 컴포넌트 라이브러리에서 기본값 → 전역 설정 → 사용자 props의 복잡한 우선순위 체계 필요
// How: TypeScript 오버로딩으로 타입 안정성 확보 + JavaScript 런타임에서 순차적 병합 수행

// ===== TypeScript 함수 오버로딩 시스템 =====

// 2개 인수 오버로드: 기본값 + 사용자 입력의 간단한 병합
// 타입 결과: B & A (B가 A를 덮어쓰는 교집합 타입)
// 실제 사용: mergeProps(defaultProps, userProps)
export function mergeProps<A, B>(a: A, b: B): B & A

// 3개 인수 오버로드: 기본값 + 컨텍스트 설정 + 사용자 입력
// 타입 결과: C & B & A (C가 최고 우선순위를 가지는 삼중 교집합)
// 실제 사용: mergeProps(defaultProps, contextProps, userProps)
export function mergeProps<A, B, C>(a: A, b: B, c: C): C & B & A

// 4개 인수 오버로드: 기본값 + 테마 설정 + 컨텍스트 설정 + 사용자 입력
// 타입 결과: D & C & B & A (D가 최고 우선순위, 우측부터 좌측으로 타입 계층)
// 실제 사용: mergeProps(defaultProps, themeProps, contextProps, userProps)
export function mergeProps<A, B, C, D>(a: A, b: B, c: C, d: D): D & C & B & A

// TypeScript 교집합 타입(&) 동작 원리:
// B & A = B의 모든 속성 + A의 속성 중 B에 없는 것들
// 동일한 키가 있으면 B의 타입이 우선 (Type-level override)
// 실제 런타임에서는 오른쪽 값이 왼쪽 값을 덮어쓰는 방식으로 동작

// ===== 메인 병합 함수 구현부 =====

// 🎯 핵심 Props 병합 함수: 다중 객체를 우선순위에 따라 얕은 병합 수행
// Why: React 컴포넌트에서 복잡한 props 상속 구조를 효과적으로 관리하기 위함
// How: 순차적 객체 순회 + undefined 필터링 + shallow merge 방식으로 성능과 예측 가능성 확보

// 병합 철학 및 규칙:
// 1. undefined 배제: 명시적으로 설정되지 않은 값은 병합하지 않음
// 2. null 포함: null은 "의도적으로 비어있음"을 나타내는 유효한 값으로 처리
// 3. 우선순위: 배열의 뒤쪽 객체가 앞쪽 객체의 동일한 키를 덮어씀
// 4. Shallow Merge: 중첩 객체는 전체가 교체됨 (Deep Merge 아님)

// 실제 사용 시나리오:
// const result = mergeProps(
//   { color: 'blue', size: 'medium', disabled: false },     // 컴포넌트 기본값
//   { color: 'red', theme: 'dark' },                        // 테마/컨텍스트 설정
//   { size: 'large', onClick: handler }                     // 사용자 전달 props
// )
// 결과: { color: 'red', size: 'large', disabled: false, theme: 'dark', onClick: handler }

export function mergeProps(...items: any[]) {
  // 결과 저장용 빈 객체 초기화
  // any 타입 사용 이유: 런타임에서는 구체적 타입을 알 수 없으므로 유연성 확보
  const ret: any = {}

  // 순차적 병합: 배열 앞에서 뒤로 순회하며 각 객체의 속성을 누적 병합
  // Why: forEach 사용으로 함수형 스타일 + 명확한 순회 의도 표현
  // How: 각 item 객체의 키를 개별적으로 검사하여 선택적 복사
  items.forEach(item => {
    // Null Safety 검사: item이 null이나 undefined인 경우 안전하게 건너뛰기
    // Why: 런타임에서 잘못된 인수가 전달될 가능성에 대한 방어적 프로그래밍
    // How: Falsy 값들(null, undefined, false, 0, "")을 모두 필터링
    if (item) {
      // 객체의 모든 열거 가능한 키를 순회
      // Object.keys() 사용 이유: for...in 보다 안전 (프로토타입 체인 속성 제외)
      Object.keys(item).forEach(key => {
        // 🔑 핵심 필터링 로직: undefined만 제외하고 다른 모든 값은 유효하게 처리
        // Why: undefined는 "값이 설정되지 않음"을 의미하므로 병합 대상에서 제외
        // How: strict 비교(!==)로 정확히 undefined만 걸러내기

        // 포함되는 값들: null, false, 0, "", [], {}, 기타 모든 truthy/falsy 값
        // 제외되는 값: undefined (유일)
        if (item[key] !== undefined) {
          // 속성 복사: 현재 객체의 값이 이전 값들을 덮어씀 (좌측 우선순위)
          // 얕은 복사: 객체나 배열의 경우 참조만 복사됨 (깊은 복사 아님)
          ret[key] = item[key]
        }
      })
    }
  })

  // 병합 완료된 최종 객체 반환
  // 반환 타입: TypeScript 오버로드에 의해 컴파일 시점에 정확한 타입으로 추론됨
  return ret
}

// ===== 단일 값 우선순위 선택 함수 =====

// 🎯 MergeProp: 단일 값에 대한 Fallback 체인을 구현하는 보조 유틸리티
// Why: API 변경이나 레거시 호환성 유지 시 다단계 fallback 로직이 자주 필요함
// How: 역순 순회를 통해 가장 우선순위가 높은 비-undefined 값을 효율적으로 선택

// 설계 목적별 사용 시나리오:
// 1. API 호환성: mergeProp(defaultValue, legacyProp, newProp)
// 2. 테마 시스템: mergeProp(globalTheme, contextTheme, localTheme)
// 3. 기능 토글: mergeProp(defaultEnabled, envConfig, userPreference)
// 4. 다국어 지원: mergeProp(defaultText, i18nText, customText)

// TypeScript 제네릭 설계 분석:
// T: 처리할 값의 기본 타입 (string, number, boolean, 객체 등)
// DefaultT extends T: 기본값의 타입이 T의 서브타입이어야 함을 보장
// 반환 타입: T | undefined (모든 값이 undefined인 경우 대비)

export function mergeProp<T, DefaultT extends T = T>(
  defaultProp: DefaultT, // 🔵 기본값: 모든 prop이 undefined일 때 사용할 최종 fallback
  ...propList: T[] // 🟡 우선순위 prop 목록: 뒤쪽 요소가 더 높은 우선순위
): T | undefined {
  // 역순 탐색 알고리즘: 배열의 끝에서부터 시작하여 첫 번째 유효값 찾기
  // Why: 마지막 인수가 최고 우선순위이므로 먼저 체크해야 효율적
  // How: 전통적인 for 루프를 역방향으로 실행하여 조기 반환 최적화

  // 성능 최적화: 유효한 값을 찾는 즉시 반환 (Short-circuit Evaluation)
  for (let i = propList.length - 1; i >= 0; i -= 1) {
    // undefined 검사: 오직 undefined만 "값이 없음"으로 간주
    // null, false, 0, "" 등은 모두 유효한 값으로 취급
    if (propList[i] !== undefined) {
      return propList[i] // 🎯 첫 번째 비-undefined 값 즉시 반환
    }
  }

  // 모든 우선순위 prop이 undefined인 경우 기본값으로 폴백
  // Why: 완전한 fallback 체인을 보장하여 undefined 반환을 최소화
  // 주의사항: defaultProp 자체도 undefined일 수 있음 (타입 시스템이 허용)
  return defaultProp

  // 실제 사용 예제:
  // const iconName = mergeProp('default-icon', legacyIcon, newIcon, userIcon)
  // 동작 순서: userIcon → newIcon → legacyIcon → 'default-icon' 순으로 체크
  // 결과: 첫 번째로 undefined가 아닌 값을 반환
}
