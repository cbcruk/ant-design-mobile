// 🔄 UseInitialized: "한 번이라도 true가 된 적 있는지" 추적하는 특수 상태 관리 훅
// Why: 컴포넌트의 첫 활성화 시점을 기억하여 불필요한 초기 렌더링 방지와 성능 최적화
// How: useRef로 지속적인 상태 저장 + boolean flag로 "영구 기록" 패턴 구현

import { useRef } from 'react'

// 🎯 초기화 상태 추적 훅: 조건이 한 번이라도 참이 되었는지를 영구 기록하는 메모리 시스템
// Why: React 컴포넌트에서 "이전에 한 번이라도 보여진 적이 있는가?"라는 질문에 답하기 위함
// How: useRef를 활용한 값 영속성 + 단방향 플래그(false → true, 되돌릴 수 없음) 패턴

// 주요 사용 시나리오:
// 1. 지연 로딩: 처음 필요할 때만 리소스 로드, 이후 캐싱
// 2. 애니메이션: 첫 등장 시에만 입장 애니메이션, 재등장 시에는 생략
// 3. 성능 최적화: 무거운 컴포넌트의 불필요한 초기화 방지
// 4. 사용자 경험: "이전에 본 적 있는" 콘텐츠와 "처음 보는" 콘텐츠 구분

export function useInitialized(check?: boolean) {
  // Ref 기반 지속적 상태 저장: 리렌더링 간에도 값이 유지되는 메모리 공간
  // Why: useState와 달리 값 변경 시 리렌더링을 유발하지 않아 성능상 유리
  // How: useRef(초기값)으로 { current: 초기값 } 형태의 mutable 객체 생성

  // 초기값 설정 논리: 첫 호출 시 check 값을 초기 상태로 사용
  // check === true면 이미 초기화된 것으로 간주
  // check === false/undefined면 아직 초기화되지 않은 상태
  const initializedRef = useRef(check)

  // 단방향 플래그 업데이트: false → true는 가능, true → false는 불가능
  // Why: "한 번이라도 true가 된 적이 있는가"를 추적하는 것이 목적이므로 되돌릴 수 없음
  // How: check가 true일 때만 initializedRef.current를 true로 설정
  if (check) {
    initializedRef.current = true
    // 주의: false일 때는 기존 값을 변경하지 않음 (영구성 보장)
  }

  // Boolean 변환: Ref 값을 확실한 boolean으로 변환하여 반환
  // Why: 초기값이 undefined일 수 있으므로 명확한 true/false 값 보장
  // How: !! (이중 부정) 연산자로 truthy/falsy → boolean 변환
  return !!initializedRef.current

  // 동작 예시:
  // 최초 호출: useInitialized(false) → false 반환
  // 이후 호출: useInitialized(true)  → true 반환 (영구히 기록됨)
  // 다음 호출: useInitialized(false) → true 반환 (이전 true 상태 유지)

  // 실제 사용 패턴 in ShouldRender:
  // const initialized = useInitialized(active)
  // - active가 처음으로 true가 되는 순간, initialized도 true가 되어 영구 유지
  // - 이후 active가 false가 되어도 initialized는 true 상태 유지
  // - "한 번이라도 활성화된 적이 있는 컴포넌트"임을 기억
}
