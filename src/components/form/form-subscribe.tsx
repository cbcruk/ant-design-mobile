/**
 * FormSubscribe 컴포넌트
 *
 * [WHY] 특정 필드 값 변경을 구독하여 동적으로 UI 업데이트
 * - FormItem의 shouldUpdate보다 세밀한 제어 가능
 * - 특정 필드만 구독하여 불필요한 리렌더링 방지
 *
 * [HOW] useWatch 훅으로 필드 값 변경 감지 후 리렌더링 트리거
 *
 * [사용 예]
 * <Form.Subscribe to={['type', 'count']}>
 *   {(values, form) => (
 *     <div>선택: {values.type}, 수량: {values.count}</div>
 *   )}
 * </Form.Subscribe>
 *
 * [구현 난이도: 높음]
 * - useWatch와 메모이제이션을 조합한 최적화된 구독 패턴
 */

import React, { memo, useContext } from 'react'
import type { FC, ReactNode } from 'react'
// [WHY] FieldContext: Form의 인스턴스에 접근
// useWatch: 특정 필드 값 변경 구독
import { FieldContext, useWatch } from 'rc-field-form'
// [WHY] useUpdate: ahooks의 강제 리렌더링 훅
import { useUpdate } from 'ahooks'
import type { FormInstance } from 'rc-field-form'
import type { NamePath } from 'rc-field-form/es/interface'
// [WHY] useIsomorphicUpdateLayoutEffect: SSR 호환 useLayoutEffect
// 초기 렌더링이 아닌 업데이트 시에만 실행
import { useIsomorphicUpdateLayoutEffect } from '../../utils/use-isomorphic-update-layout-effect'

/**
 * RenderChildren 타입 - FormSubscribe의 render props 함수 타입
 *
 * [파라미터]
 * - changedValues: 구독 중인 필드들의 현재 값
 * - form: FormInstance (추가 폼 조작용)
 */
type RenderChildren<Values = any> = (
  changedValues: Record<string, any>,
  form: FormInstance<Values>
) => ReactNode
type ChildrenType<Values = any> = RenderChildren<Values>

/**
 * FormSubscribeProps - FormSubscribe 컴포넌트의 Props
 *
 * [속성]
 * - to: 구독할 필드 경로 배열 (예: ['username', ['address', 'city']])
 * - children: render props 함수
 */
export interface FormSubscribeProps {
  to: NamePath[] // 구독할 필드 목록
  children: ChildrenType // render props 함수
}

/**
 * FormSubscribe 컴포넌트 구현
 *
 * [동작 원리]
 * 1. Watcher 컴포넌트들이 각 필드를 useWatch로 구독
 * 2. 필드 값 변경 시 Watcher가 onChange(= useUpdate) 호출
 * 3. FormSubscribe가 리렌더링되어 새로운 값으로 children 호출
 *
 * [성능 최적화]
 * - useMemo로 childNode 메모이제이션 (값이 같으면 리렌더링 스킵)
 * - Watcher는 memo로 감싸서 불필요한 리렌더링 방지
 */
export const FormSubscribe: FC<FormSubscribeProps> = props => {
  // [HOW] useUpdate: 강제 리렌더링 함수 (Watcher에서 호출)
  const update = useUpdate()
  // [HOW] FieldContext에서 폼 인스턴스 가져오기
  const form = useContext(FieldContext)

  // [HOW] 구독 중인 필드들의 현재 값 조회
  const value = form.getFieldsValue(props.to)

  /**
   * [성능 최적화] childNode 메모이제이션
   *
   * [WHY] 값이 변경되지 않았으면 children 함수 재실행 방지
   * [HOW] JSON.stringify로 값 비교 (깊은 비교)
   *
   * [주의] JSON.stringify는 순환 참조나 함수가 있으면 실패할 수 있음
   */
  const childNode = React.useMemo(
    () => props.children(value, form),
    [JSON.stringify(value), props.children]
  )

  return (
    <>
      {childNode}
      {/* [HOW] 각 필드에 대해 Watcher 컴포넌트 생성 */}
      {props.to.map(namePath => (
        <Watcher
          key={namePath.toString()}
          form={form}
          namePath={namePath}
          onChange={update}
        />
      ))}
    </>
  )
}

/**
 * Watcher - 단일 필드 구독 컴포넌트
 *
 * [WHY] 각 필드를 개별적으로 구독하여 변경 감지
 * [HOW] useWatch로 필드 구독 → 값 변경 시 onChange 콜백 호출
 *
 * [성능 최적화]
 * - memo로 감싸서 props가 같으면 리렌더링 스킵
 * - 렌더링 결과가 null이므로 DOM에 영향 없음
 *
 * [렌더링] null을 반환하여 UI에 영향 없이 구독 역할만 수행
 */
export const Watcher = memo<{
  form: FormInstance
  namePath: NamePath
  onChange: () => void
}>(props => {
  // [HOW] useWatch로 특정 필드 구독 (값 변경 시 리렌더링됨)
  const value = useWatch(props.namePath, props.form)

  /**
   * [HOW] useIsomorphicUpdateLayoutEffect:
   * - 초기 렌더링이 아닌 업데이트 시에만 onChange 호출
   * - useLayoutEffect 기반으로 DOM 업데이트 전에 동기적 실행
   */
  useIsomorphicUpdateLayoutEffect(() => {
    props.onChange()
  }, [value])

  // [렌더링] UI 없이 구독 역할만 수행
  return null
})
