/**
 * Form 컴포넌트
 *
 * [WHY] ant-design-mobile의 핵심 폼 컴포넌트
 * - rc-field-form을 래핑하여 모바일 친화적인 폼 UI 제공
 * - Header 기반 자동 섹션 분할로 긴 폼의 가독성 향상
 *
 * [HOW] 주요 기능:
 * 1. rc-field-form 기반 폼 상태 관리 (값, 유효성 검사)
 * 2. FormContext로 하위 FormItem에 전역 설정 공유
 * 3. Header 컴포넌트를 기준으로 List 섹션 자동 분할
 * 4. 다국어 유효성 검사 메시지 지원
 *
 * [구현 난이도: 중간]
 * - traverseReactNode를 활용한 동적 섹션 분할이 핵심 로직
 */

import React, { forwardRef, useMemo } from 'react'
import type { ReactNode, ForwardedRef } from 'react'
import classNames from 'classnames'
import { NativeProps } from '../../utils/native-props'
import List, { ListProps } from '../list'
// [WHY] rc-field-form: Ant Design 생태계의 폼 상태 관리 라이브러리
// 값 동기화, 유효성 검사, 제출 처리 등 폼의 핵심 기능 제공
import RcForm from 'rc-field-form'
import type {
  FormProps as RcFormProps,
  FormInstance as RCFormInstance,
} from 'rc-field-form'
import { defaultFormContext, FormContext, FormContextType } from './context'
import { mergeProps } from '../../utils/with-default-props'
import { Header } from './header'
import { useConfig } from '../config-provider'
// [WHY] deepmerge: 객체의 깊은 병합을 위한 라이브러리
// 다국어 validateMessages를 기본값과 사용자 정의값을 병합할 때 사용
import merge from 'deepmerge'
import { FormArray } from './form-array'
// [WHY] traverseReactNode: React children을 평탄화하여 순회하는 유틸리티
// Fragment, 배열 등을 펼쳐서 개별 요소에 접근 가능
import { traverseReactNode } from '../../utils/traverse-react-node'

const classPrefix = 'adm-form'

/**
 * FormInstance 타입 정의
 *
 * [WHY] 외부에서 폼을 제어하기 위한 API 정의
 * [HOW] rc-field-form의 FormInstance에서 필요한 메서드만 Pick
 *
 * [주요 메서드]
 * - getFieldValue/getFieldsValue: 필드 값 조회
 * - getFieldError/getFieldsError: 에러 조회
 * - setFieldValue/setFieldsValue: 필드 값 설정
 * - resetFields: 필드 초기화
 * - validateFields: 유효성 검사 실행
 * - submit: 폼 제출
 */
export type FormInstance = Pick<
  RCFormInstance,
  | 'getFieldValue'
  | 'getFieldsValue'
  | 'getFieldError'
  | 'getFieldsError'
  | 'isFieldTouched'
  | 'isFieldsTouched'
  | 'resetFields'
  | 'setFields'
  | 'setFieldValue'
  | 'setFieldsValue'
  | 'submit'
  | 'validateFields'
>

/**
 * FormProps 타입 정의
 *
 * [WHY] Form 컴포넌트의 props 정의
 * [HOW] 세 가지 소스에서 조합:
 * 1. RcFormProps: rc-field-form의 폼 제어 props
 * 2. NativeProps: CSS 변수 커스터마이징
 * 3. FormContextType: 하위 FormItem에 전달할 설정
 *
 * [추가 props]
 * - footer: 폼 하단 영역 (제출 버튼 등)
 * - mode: List 컴포넌트의 모드 ('default' | 'card')
 */
export type FormProps = Pick<
  RcFormProps,
  | 'form' // useForm()으로 생성한 폼 인스턴스
  | 'initialValues' // 폼 초기값
  | 'name' // 폼 식별자
  | 'preserve' // 언마운트 시 값 유지 여부
  | 'validateMessages' // 유효성 검사 메시지 커스터마이징
  | 'validateTrigger' // 유효성 검사 트리거
  | 'onFieldsChange' // 필드 변경 콜백
  | 'onFinish' // 제출 성공 콜백
  | 'onFinishFailed' // 제출 실패 콜백
  | 'onValuesChange' // 값 변경 콜백
  | 'children'
> &
  NativeProps<
    '--border-inner' | '--border-top' | '--border-bottom' | '--prefix-width'
  > &
  Partial<FormContextType> & {
    footer?: ReactNode // 폼 하단 영역 (보통 제출 버튼)
    mode?: ListProps['mode'] // List 스타일 모드
  }

const defaultProps = defaultFormContext

/**
 * Form 컴포넌트 구현
 *
 * [WHY] 모바일 최적화된 폼 컴포넌트
 * - 긴 폼을 시각적으로 구분된 섹션으로 나누어 가독성 향상
 * - rc-field-form과 완전 통합하여 폼 상태 관리
 *
 * [HOW] forwardRef로 외부에서 폼 인스턴스에 접근 가능
 */
export const Form = forwardRef<FormInstance, FormProps>((p, ref) => {
  // [HOW] 기본값과 props 병합
  const props = mergeProps(defaultProps, p)
  const {
    className,
    style,
    hasFeedback,
    children,
    layout,
    footer,
    mode,
    disabled,
    requiredMarkStyle,
    ...formProps // rc-field-form에 전달할 나머지 props
  } = props

  // [HOW] ConfigProvider에서 다국어 설정 가져오기
  const { locale } = useConfig()

  /**
   * validateMessages 병합
   *
   * [WHY] 다국어 기본 메시지 위에 사용자 정의 메시지만 덮어씌우기
   * [HOW] deepmerge로 깊은 병합 수행
   * - 기본: locale.Form.defaultValidateMessages (한국어, 영어 등)
   * - 사용자 정의: formProps.validateMessages
   *
   * [성능] useMemo로 불필요한 재계산 방지
   */
  const validateMessages = useMemo(
    () =>
      merge(
        locale.Form.defaultValidateMessages,
        formProps.validateMessages || {}
      ),
    [locale.Form.defaultValidateMessages, formProps.validateMessages]
  )

  /**
   * 동적 섹션 분할을 위한 변수들
   *
   * [WHY] Header를 기준으로 FormItem들을 여러 List로 분할
   * [HOW]
   * - lists: 최종 생성될 List 컴포넌트 배열
   * - currentHeader: 현재 섹션의 헤더
   * - items: 현재 섹션에 누적 중인 아이템들
   * - count: List의 key 생성용 카운터
   */
  const lists: ReactNode[] = []
  let currentHeader: ReactNode = null
  let items: ReactNode[] = []
  let count = 0

  /**
   * collect - 현재 수집된 아이템들을 List로 묶어서 저장
   *
   * [WHY] Header를 만날 때마다 이전 섹션을 완료하기 위해 호출
   * [HOW] items가 있을 때만 List 생성하여 lists에 추가
   */
  function collect() {
    if (items.length === 0) return
    count += 1
    lists.push(
      <List header={currentHeader} key={count} mode={mode}>
        {items}
      </List>
    )
    items = []
  }

  /**
   * 자식 요소 순회 및 섹션 분할
   *
   * [WHY] Header와 FormArray를 기준으로 폼을 여러 섹션으로 분할
   * [HOW] traverseReactNode로 children을 평탄화하여 순회:
   * - Header: 이전 섹션 완료, 새 헤더 설정
   * - FormArray: 독립 요소로 별도 처리
   * - 그 외: 현재 섹션에 누적
   *
   * [사용 예]
   * <Form>
   *   <Form.Item ... />        → 첫 번째 List (헤더 없음)
   *   <Form.Header>개인정보</Form.Header>
   *   <Form.Item ... />        → 두 번째 List (헤더: 개인정보)
   * </Form>
   */
  traverseReactNode(props.children as ReactNode, child => {
    if (React.isValidElement(child)) {
      if (child.type === Header) {
        // [HOW] Header를 만나면 이전 섹션 완료 후 새 헤더 설정
        collect()
        currentHeader = child.props.children
        return
      }
      if (child.type === FormArray) {
        // [WHY] FormArray는 자체적으로 List를 생성하므로 독립 처리
        collect()
        lists.push(child)
        return
      }
    }
    // 일반 요소는 현재 섹션에 누적
    items.push(child)
  })
  // 마지막 섹션 완료
  collect()

  /**
   * [렌더링 구조]
   * RcForm (폼 상태 관리)
   *   └── FormContext.Provider (전역 설정 공유)
   *         └── List 섹션들 (Header로 구분된)
   *   └── footer (제출 버튼 등)
   */
  return (
    <RcForm
      className={classNames(classPrefix, className)}
      style={style}
      ref={ref as ForwardedRef<RCFormInstance>}
      {...formProps}
      validateMessages={validateMessages}
    >
      {/* [HOW] FormContext로 하위 FormItem에 전역 설정 제공 */}
      <FormContext.Provider
        value={{
          name: formProps.name,
          hasFeedback,
          layout,
          requiredMarkStyle,
          disabled,
        }}
      >
        {lists}
      </FormContext.Provider>
      {/* [HOW] footer가 있으면 폼 하단에 별도 영역으로 렌더링 */}
      {footer && <div className={`${classPrefix}-footer`}>{footer}</div>}
    </RcForm>
  )
})
