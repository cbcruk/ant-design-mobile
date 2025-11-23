/**
 * Form 컴포넌트 유틸리티 함수들
 *
 * [WHY] FormItem에서 사용되는 헬퍼 함수들
 * - toArray: 값을 배열로 정규화
 * - isSafeSetRefComponent: ref를 안전하게 설정할 수 있는 컴포넌트인지 확인
 */

// [WHY] react-is: React 요소 타입 확인 유틸리티
// - isMemo: React.memo로 감싼 컴포넌트인지 확인
// - isFragment: React.Fragment인지 확인
import { isMemo, isFragment } from 'react-is'

/**
 * toArray - 값을 배열로 정규화
 *
 * [WHY] trigger, validateTrigger 등이 단일 값 또는 배열일 수 있어 일관된 처리 필요
 *
 * [HOW] 입력값에 따른 반환:
 * - undefined, false → 빈 배열
 * - 배열 → 그대로 반환
 * - 단일 값 → 배열로 감싸서 반환
 *
 * @example
 * toArray('onChange')     // ['onChange']
 * toArray(['onChange', 'onBlur']) // ['onChange', 'onBlur']
 * toArray(undefined)      // []
 */
export function toArray<T>(candidate?: T | T[] | false): T[] {
  if (candidate === undefined || candidate === false) return []

  return Array.isArray(candidate) ? candidate : [candidate]
}

/**
 * shouldConstruct - 클래스 컴포넌트인지 확인
 *
 * [WHY] 클래스 컴포넌트는 ref를 받을 수 있음
 * [HOW] prototype.isReactComponent 존재 여부로 확인
 * - React.Component를 상속한 클래스는 이 속성을 가짐
 *
 * @param Component - 확인할 컴포넌트
 * @returns 클래스 컴포넌트면 true
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function shouldConstruct(Component: Function) {
  const prototype = Component.prototype
  return !!(prototype && prototype.isReactComponent)
}

/**
 * isSimpleFunctionComponent - 단순 함수 컴포넌트인지 확인
 *
 * [WHY] 단순 함수 컴포넌트는 ref를 받을 수 없음
 * - forwardRef로 감싸지 않은 함수 컴포넌트
 *
 * [HOW] React 내부 로직 참조:
 * https://github.com/facebook/react/blob/ce13860281f833de8a3296b7a3dad9caced102e9/packages/react-reconciler/src/ReactFiber.new.js#L225
 *
 * [조건]
 * 1. typeof === 'function' (함수)
 * 2. !shouldConstruct (클래스가 아님)
 * 3. defaultProps === undefined (forwardRef는 defaultProps를 가질 수 있음)
 *
 * @param type - 컴포넌트 타입
 * @returns 단순 함수 컴포넌트면 true
 */
function isSimpleFunctionComponent(type: any) {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  )
}

/**
 * isSafeSetRefComponent - ref를 안전하게 설정할 수 있는 컴포넌트인지 확인
 *
 * [WHY] FormItem이 자식 컴포넌트에 ref를 주입해야 하는데,
 * 모든 컴포넌트가 ref를 받을 수 있는 것은 아님
 *
 * [HOW] ref를 받을 수 없는 컴포넌트 필터링:
 * - Fragment: ref 불가
 * - 단순 함수 컴포넌트: ref 불가 (forwardRef 필요)
 *
 * [ref를 받을 수 있는 컴포넌트]
 * - 클래스 컴포넌트
 * - forwardRef로 감싼 함수 컴포넌트
 * - DOM 요소 (div, input 등)
 * - memo로 감싼 컴포넌트 (내부 타입에 따라 재귀 확인)
 *
 * @param component - React 요소
 * @returns ref를 안전하게 설정할 수 있으면 true
 *
 * @example
 * isSafeSetRefComponent(<Input />)           // true (forwardRef 사용)
 * isSafeSetRefComponent(<div />)             // true (DOM 요소)
 * isSafeSetRefComponent(<SimpleFunc />)      // false (단순 함수)
 * isSafeSetRefComponent(<React.Fragment />)  // false (Fragment)
 */
export function isSafeSetRefComponent(component: any): boolean {
  // [HOW] Fragment는 ref 불가
  if (isFragment(component)) return false
  // [HOW] memo로 감싼 컴포넌트는 내부 타입으로 재귀 확인
  if (isMemo(component)) return isSafeSetRefComponent(component.type)

  // [HOW] 단순 함수 컴포넌트가 아니면 ref 설정 가능
  return !isSimpleFunctionComponent(component.type)
}
