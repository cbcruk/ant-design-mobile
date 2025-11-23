/**
 * Form 컴포넌트의 Context 정의
 *
 * [WHY] Form과 FormItem 간의 설정 공유를 위한 Context 제공
 * - Form 레벨에서 설정한 옵션들을 하위 FormItem들이 사용할 수 있도록 함
 * - 각 FormItem에서 개별적으로 props를 전달받지 않아도 일관된 스타일 적용 가능
 *
 * [HOW] 두 가지 Context 제공:
 * 1. FormContext: Form 전역 설정 (layout, hasFeedback 등)
 * 2. NoStyleItemContext: noStyle FormItem의 에러 전파용
 */

import React from 'react'
import { FormLayout } from '.'
import type { Meta, InternalNamePath } from 'rc-field-form/lib/interface'

/**
 * FormContext의 타입 정의
 *
 * [속성 설명]
 * - name: 폼 식별자 (fieldId 생성에 사용)
 * - hasFeedback: 유효성 검사 결과 UI 표시 여부
 * - layout: 레이아웃 방향 ('vertical' | 'horizontal')
 * - requiredMarkStyle: 필수 표시 스타일
 * - disabled: 폼 전체 비활성화 여부
 */
export type FormContextType = {
  name?: string
  hasFeedback: boolean
  layout: FormLayout
  requiredMarkStyle: 'asterisk' | 'text-required' | 'text-optional' | 'none'
  disabled: boolean
}

/**
 * FormContext 기본값
 *
 * [WHY] Context.Provider 없이 사용될 때를 대비한 기본값 제공
 * [HOW] 합리적인 기본값 설정:
 * - hasFeedback: true (에러 메시지 기본 표시)
 * - layout: 'vertical' (모바일에 적합한 세로 레이아웃)
 * - requiredMarkStyle: 'asterisk' (가장 일반적인 필수 표시)
 */
export const defaultFormContext: FormContextType = {
  name: undefined,
  hasFeedback: true,
  layout: 'vertical',
  requiredMarkStyle: 'asterisk',
  disabled: false,
}

/**
 * FormContext - Form 전역 설정 공유용 Context
 *
 * [사용처]
 * - Form: Provider로 값 제공
 * - FormItem, FormItemLayout: Consumer로 값 사용
 */
export const FormContext =
  React.createContext<FormContextType>(defaultFormContext)

/**
 * OnSubMetaChange 타입 정의
 *
 * [WHY] noStyle FormItem에서 부모로 메타 정보(에러/경고)를 전파하기 위한 콜백 타입
 * [HOW] 파라미터:
 * - meta: 필드의 메타 정보 (errors, warnings, touched 등)
 * - destroy: true면 언마운트됨을 의미 (부모에서 해당 메타 삭제)
 * - namePath: 필드의 이름 경로 (예: ['user', 'name'])
 */
export type OnSubMetaChange = (
  meta: Meta & { destroy?: boolean },
  namePath: InternalNamePath
) => void

/**
 * NoStyleItemContext - noStyle FormItem의 에러 전파용 Context
 *
 * [WHY] noStyle FormItem은 자체 UI가 없어 에러를 표시할 수 없음
 * → 부모 FormItem으로 에러를 전파하여 부모에서 표시
 *
 * [사용 흐름]
 * 1. 부모 FormItem이 onSubMetaChange 콜백을 Provider로 제공
 * 2. 자식 noStyle FormItem이 Context에서 콜백 가져옴
 * 3. rc-field-form의 onMetaChange에서 부모 콜백 호출
 * 4. 부모가 subMetas 상태에 저장하여 에러 표시
 *
 * [기본값] null (부모가 없거나 Provider가 없는 경우)
 */
export const NoStyleItemContext = React.createContext<OnSubMetaChange | null>(
  null
)
