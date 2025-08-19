// 🛡️ WithStopPropagation: 이벤트 버블링 차단을 위한 고차 함수 (HOF) 유틸리티
// Why: 모바일 UI에서 중첩된 클릭 가능한 요소들 간의 의도치 않은 이벤트 전파로 인한 버그 방지
// How: React.cloneElement를 활용하여 기존 이벤트 핸들러를 래핑한 새로운 요소 생성

import type { ReactElement } from 'react'
import React from 'react'

// 지원하는 이벤트 타입 정의: 모바일 환경에서 주로 발생하는 핵심 상호작용 이벤트들
// Why: 모든 이벤트를 지원하기보다는 실제로 자주 버블링 문제가 발생하는 이벤트에 집중
// How: TypeScript Union Type으로 허용된 이벤트만 컴파일 타임에 검증
export type PropagationEvent = 'click' | 'touchstart'

// 이벤트 타입 → Props 이름 매핑 테이블: DOM 이벤트명을 React Props 이름으로 변환
// Why: 'click' 이벤트는 'onClick' props로, 'touchstart'는 'onTouchStart' props로 매핑 필요
// How: Record 타입으로 타입 안전성 확보하며 이벤트-props 관계 명시적 정의
const eventToPropRecord: Record<PropagationEvent, string> = {
  'click': 'onClick', // DOM click 이벤트 → React onClick props
  'touchstart': 'onTouchStart', // DOM touchstart 이벤트 → React onTouchStart props
}

// ===== 메인 HOF 함수: 이벤트 전파 차단 기능이 추가된 새로운 엘리먼트 생성 =====

// 🎯 WithStopPropagation: 선택적 이벤트 전파 차단 기능을 기존 컴포넌트에 추가하는 래퍼 함수
// Why: 기존 컴포넌트를 수정하지 않고도 이벤트 버블링 차단 기능을 추가할 수 있는 비침습적 접근
// How: 함수형 프로그래밍의 고차 함수 패턴으로 원본 요소를 변형하여 새로운 요소 반환

// 주요 사용 시나리오:
// 1. Modal 내부 클릭: Modal 배경 클릭으로 닫기 vs 내부 콘텐츠 클릭 구분
// 2. 중첩된 버튼: 카드 클릭 vs 카드 내부 액션 버튼 클릭 분리
// 3. 드롭다운 메뉴: 메뉴 아이템 클릭 시 메뉴 자체 닫기 이벤트 방지
// 4. 터치 제스처: 복합 터치 인터랙션에서 의도치 않은 중복 액션 방지

export function withStopPropagation(
  events: PropagationEvent[], // 🎯 차단할 이벤트 타입 배열 (여러 이벤트 동시 처리 가능)
  element: ReactElement // 🎭 원본 React 엘리먼트 (함수형/클래스형 컴포넌트 모두 가능)
) {
  // 기존 props 복사: 원본 엘리먼트의 모든 속성을 새로운 객체로 복사 (얕은 복사)
  // Why: 원본 엘리먼트를 변경하지 않고 새로운 props 객체에서 이벤트 핸들러만 수정
  // How: spread operator로 기존 props를 복사하되 이후 특정 핸들러들을 덮어쓸 예정
  const props: Record<string, any> = { ...element.props }

  // 각 이벤트별로 전파 차단 래퍼 생성: 배열을 순회하며 각 이벤트에 대한 래핑된 핸들러 생성
  // Why: 여러 이벤트를 동시에 처리하고 각각에 대해 독립적인 핸들러 래핑 필요
  // How: for...of 루프로 이벤트 배열을 순회하며 각각에 대해 핸들러 생성/교체
  for (const key of events) {
    // 이벤트 타입을 React props 이름으로 변환
    // 예: 'click' → 'onClick', 'touchstart' → 'onTouchStart'
    const prop = eventToPropRecord[key]

    // 🔑 핵심: 기존 핸들러를 래핑한 새로운 이벤트 핸들러 생성
    // Why: stopPropagation 호출과 기존 핸들러 실행을 모두 수행하는 복합 핸들러 필요
    // How: 클로저를 활용하여 기존 핸들러를 캡처하고 새로운 함수에서 순차적으로 실행
    props[prop] = function (e: Event) {
      // 1단계: 이벤트 전파 차단 - 상위 요소로의 버블링 중단
      // Why: 이 이벤트가 부모 요소의 이벤트 핸들러를 실행시키지 않도록 방지
      // How: 표준 DOM API의 stopPropagation() 메서드 호출
      e.stopPropagation()

      // 2단계: 기존 이벤트 핸들러 실행 - 원래 동작 유지
      // Why: stopPropagation만 추가하고 원본 기능은 그대로 보존해야 함
      // How: optional chaining(?.)으로 핸들러 존재 시에만 안전하게 호출
      element.props[prop]?.(e)

      // 실행 순서가 중요한 이유:
      // stopPropagation을 먼저 호출해야 기존 핸들러 실행 중 추가 전파가 차단됨
      // 기존 핸들러가 에러를 발생시켜도 이미 전파는 차단된 상태 유지
    }
  }

  // 수정된 props로 새로운 엘리먼트 생성: React.cloneElement로 원본을 기반으로 복제
  // Why: 원본 엘리먼트를 수정하는 것이 아니라 새로운 엘리먼트를 생성하여 불변성 유지
  // How: React.cloneElement(원본, 새props)로 타입과 구조는 유지하되 이벤트 핸들러만 교체
  return React.cloneElement(element, props)

  // React.cloneElement 선택 이유:
  // 1. 타입 보존: 원본 엘리먼트의 컴포넌트 타입과 구조를 완전히 보존
  // 2. Props 병합: 기존 props와 새로운 props를 자동으로 병합
  // 3. Key/Ref 처리: React의 내부 메타데이터(key, ref 등)를 올바르게 처리
  // 4. 성능 최적화: React의 내부 최적화 메커니즘을 그대로 활용

  // 실제 사용 예시와 효과:
  // const ButtonWithStoppedClick = withStopPropagation(['click'],
  //   <Button onClick={handleClick}>내부 버튼</Button>
  // )
  //
  // 🟢 효과:
  // 1. 버튼 클릭 시 handleClick 실행됨
  // 2. 동시에 이벤트 전파가 차단되어 상위 요소의 클릭 핸들러는 실행되지 않음
  // 3. 원본 Button 컴포넌트의 다른 props나 동작은 모두 유지됨
  //
  // 🔴 주의사항:
  // 1. 기존 핸들러도 실행되므로 완전한 이벤트 차단은 아님 (preventDefault와는 다름)
  // 2. 이벤트 객체의 다른 메서드들(preventDefault 등)은 기존 핸들러에서 여전히 사용 가능
  // 3. 클로저로 인한 메모리 참조 유지 (일반적으로 문제되지 않지만 대용량 데이터 시 고려)
}
