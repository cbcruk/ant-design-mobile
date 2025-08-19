// 👁️ UseInnerVisible: 동기화된 가시성 상태 관리를 위한 특수 React 훅
// Why: 외부 상태와 내부 상태 간의 동기화 지연 문제를 해결하여 부드러운 애니메이션과 일관된 UI 제공
// How: useState + useIsomorphicLayoutEffect 조합으로 SSR 안전성과 즉시 동기화를 모두 확보

import { useIsomorphicLayoutEffect } from 'ahooks'
import { useState } from 'react'

// 🎯 내부 가시성 상태 동기화 훅: 외부 프랍 변경을 내부 상태로 안전하게 반영
// Why: React의 상태 업데이트는 비동기적이므로 외부 프랍과 내부 상태 간 타이밍 차이 발생 가능
// How: 레이아웃 Effect로 DOM 업데이트 직전에 상태 동기화하여 시각적 불일치 방지

// 주요 사용 시나리오:
// 1. Modal/Popup: 외부에서 전달된 visible 프랍을 내부 애니메이션 상태와 동기화
// 2. 조건부 렌더링: 부모 컴포넌트의 상태 변경을 자식의 표시 상태에 즉시 반영
// 3. 트랜지션 컴포넌트: 진입/퇴장 애니메이션에서 상태 불일치로 인한 깜박임 방지
// 4. 복합 상태 관리: 여러 단계를 거치는 복잡한 상태 변화의 중간 동기화 지점

// 기술적 배경:
// - React 18의 Concurrent Rendering에서 상태 업데이트 배칭으로 인한 지연 해결
// - useEffect vs useLayoutEffect: DOM 변경 전/후 실행 타이밍 차이 활용
// - ahooks의 useIsomorphicLayoutEffect: SSR 환경에서 useLayoutEffect 안전성 보장

export function useInnerVisible(outerVisible: boolean) {
  // 내부 상태 초기화: 외부 프랍과 동일한 값으로 시작
  // Why: 첫 렌더링에서 외부와 내부 상태가 일치해야 예상치 못한 플리커 방지
  // How: useState의 초기값으로 outerVisible을 직접 전달
  const [innerVisible, setInnerVisible] = useState(outerVisible)

  // 동기화 Effect: 외부 상태 변경을 내부 상태에 즉시 반영
  // Why: outerVisible 변경 시 innerVisible도 동시에 업데이트되어야 일관성 유지
  // How: useIsomorphicLayoutEffect로 DOM 업데이트 직전에 상태 동기화

  // useIsomorphicLayoutEffect 선택 이유:
  // 1. SSR 호환성: 서버에서는 useEffect, 클라이언트에서는 useLayoutEffect 자동 선택
  // 2. 동기 실행: DOM 변경 전에 상태 업데이트하여 레이아웃 깜박임 방지
  // 3. 페인팅 차단: 브라우저의 리페인트 전에 실행되어 시각적 불일치 완전 제거
  useIsomorphicLayoutEffect(() => {
    // 상태 동기화: 외부 프랍 값을 내부 상태로 복사
    // Why: 외부에서 visible이 변경되면 내부 상태도 즉시 반영
    // How: setInnerVisible로 새로운 값 설정, React가 자동으로 리렌더링 트리거
    setInnerVisible(outerVisible)
  }, [outerVisible]) // 의존성: outerVisible 변경 시에만 Effect 실행

  // 동기화된 내부 상태 반환
  // Why: 컴포넌트가 외부 프랍과 동기화된 안정적인 상태값을 사용할 수 있도록
  // How: useState에서 관리되는 innerVisible 값을 그대로 반환
  return innerVisible

  // 실제 사용 패턴 및 이점:
  // const innerVisible = useInnerVisible(props.visible)
  //
  // 🟢 이점:
  // 1. 상태 동기화: 외부 프랍 변경이 즉시 내부 상태에 반영됨
  // 2. 애니메이션 안정성: 트랜지션 도중 상태 불일치로 인한 깜박임 방지
  // 3. SSR 안전성: 서버/클라이언트 환경에서 모두 안전하게 동작
  // 4. 성능 최적화: 불필요한 리렌더링 없이 필요한 시점에만 상태 업데이트
  //
  // 🔴 주의사항:
  // 1. 외부 프랍이 자주 변경되면 많은 리렌더링 발생 가능
  // 2. useLayoutEffect 사용으로 동기 블로킹 발생 (일반적으로 문제없음)
  // 3. 복잡한 상태 로직보다는 단순한 boolean 값 동기화에 최적화됨
}
