// 🎭 ShouldRender: 조건부 렌더링을 위한 고성능 생명주기 관리 컴포넌트
// Why: Modal, Popup 등에서 DOM 노드 생성/삭제 타이밍을 정교하게 제어하여 성능과 UX 최적화
// How: 초기화 상태 추적 + 다단계 렌더링 조건 평가로 불필요한 렌더링과 메모리 누수 방지

import type { FC, ReactElement } from 'react'
import { useInitialized } from './use-initialized'

// Props 인터페이스: 렌더링 제어를 위한 3가지 핵심 플래그
interface Props {
  active: boolean // 🟢 활성 상태: 컴포넌트가 현재 보여져야 하는지 여부 (주 제어 플래그)
  forceRender?: boolean // 🔴 강제 렌더링: 활성 상태와 무관하게 항상 DOM에 유지 (성능 vs 메모리 트레이드오프)
  destroyOnClose?: boolean // 🗑️ 종료 시 제거: 비활성 시 DOM에서 완전 제거 여부 (메모리 최적화)
  children: ReactElement // 🎯 렌더링 대상: 조건부로 렌더링할 실제 컴포넌트
}

// ===== 메인 컴포넌트: 조건부 렌더링 래퍼 =====

// 🎭 ShouldRender 컴포넌트: 복잡한 렌더링 로직을 캡슐화하는 고차 컴포넌트
// Why: 조건부 렌더링 로직을 재사용 가능한 컴포넌트로 추상화하여 코드 중복 제거
// How: useShouldRender 훅의 결과에 따라 children을 렌더링하거나 null 반환

// 사용 패턴 분석:
// <ShouldRender active={isOpen} destroyOnClose>
//   <ExpensiveModal />  {/* 조건에 따라 렌더링/언마운트 */}
// </ShouldRender>
export const ShouldRender: FC<Props> = props => {
  // 렌더링 여부 결정: 3가지 플래그를 종합하여 최종 렌더링 여부 계산
  const shouldRender = useShouldRender(
    props.active, // 현재 활성 상태
    props.forceRender, // 강제 렌더링 플래그
    props.destroyOnClose // 종료 시 제거 플래그
  )

  // 조건부 렌더링: React의 기본 패턴 (truthy ? JSX : null)
  // Why: null 반환 시 React가 해당 위치에 아무것도 렌더링하지 않음
  // How: shouldRender가 true면 children 렌더링, false면 null로 언마운트
  return shouldRender ? props.children : null
}

// ===== 핵심 훅: 고급 렌더링 결정 로직 =====

// 🎯 useShouldRender: 4단계 결정 트리로 최적의 렌더링 시점을 계산하는 핵심 훅
// Why: 단순한 active 체크로는 해결할 수 없는 복잡한 생명주기 요구사항 해결
// How: 초기화 추적 + 우선순위 기반 조건 평가로 성능과 사용성의 균형점 확보

// 매개변수 분석:
// active: 현재 컴포넌트가 활성 상태인지 (Modal이 열려있는지, Tab이 선택되었는지 등)
// forceRender: 성능보다 항상성을 우선하는 경우 (중요한 상태를 유지해야 하는 컴포넌트)
// destroyOnClose: 메모리 최적화를 우선하는 경우 (무거운 컴포넌트의 완전한 정리)
export function useShouldRender(
  active: boolean, // 🟢 활성 상태 플래그
  forceRender?: boolean, // 🔴 강제 렌더링 플래그 (최고 우선순위)
  destroyOnClose?: boolean // 🗑️ 종료 시 제거 플래그 (메모리 최적화)
) {
  // 초기화 상태 추적: 컴포넌트가 한 번이라도 활성화되었는지 기록
  // Why: "아직 한 번도 보여지지 않은" 컴포넌트는 렌더링할 필요가 없음
  // How: useInitialized 훅으로 active가 true가 된 적이 있는지 추적
  const initialized = useInitialized(active)

  // ===== 4단계 결정 트리: 우선순위에 따른 조건부 렌더링 로직 =====

  // 🔴 1순위: 강제 렌더링 - 모든 조건을 무시하고 항상 렌더링
  // Why: 상태 유지가 성능보다 중요한 경우 (폼 데이터, 스크롤 위치 등)
  // 사용 사례: 중요한 사용자 입력이 있는 Modal, 복잡한 상태를 가진 Tab
  if (forceRender) return true

  // 🟢 2순위: 활성 상태 - 현재 보여져야 하는 상태면 렌더링
  // Why: 가장 직관적인 조건, 사용자가 보고 있는 것은 당연히 렌더링되어야 함
  // 사용 사례: 열린 Modal, 선택된 Tab, 표시된 Tooltip
  if (active) return true

  // 🚫 3순위: 미초기화 상태 - 한 번도 활성화된 적이 없으면 렌더링 안 함
  // Why: 불필요한 DOM 노드 생성을 방지하여 초기 로딩 성능 향상
  // 사용 사례: 아직 열리지 않은 Modal, 선택되지 않은 Tab
  if (!initialized) return false

  // 🗑️ 4순위: 제거 정책 - destroyOnClose 설정에 따라 최종 결정
  // Why: 메모리 사용량과 상태 유지 사이의 트레이드오프를 개발자가 제어
  // How: destroyOnClose가 true면 false(제거), false면 true(유지)
  return !destroyOnClose

  // 최종 동작 분석:
  // destroyOnClose === true  → false 반환 (DOM에서 완전 제거, 메모리 절약)
  // destroyOnClose === false → true 반환 (DOM 유지, 빠른 재활성화)
  // destroyOnClose === undefined → true 반환 (기본값: 상태 유지 우선)

  // 실제 사용 예시별 동작:
  // 1. Modal (일반): active=false, destroyOnClose=true → 닫으면 제거
  // 2. Tab (빠른 전환): active=false, destroyOnClose=false → 숨김 상태 유지
  // 3. 중요 폼: forceRender=true → 항상 렌더링 (입력 데이터 보존)
}
