/**
 * FormItem 컴포넌트
 *
 * [WHY] Form 내에서 각 입력 필드를 감싸는 래퍼 컴포넌트
 * - 라벨, 유효성 검사 오류 메시지, 도움말 등 폼 필드의 UI를 일관성 있게 제공
 * - rc-field-form의 Field 컴포넌트를 래핑하여 ant-design-mobile 스타일에 맞게 확장
 *
 * [HOW] 주요 구성:
 * 1. FormItemLayout: 레이아웃(horizontal/vertical)과 UI 요소 렌더링 담당
 * 2. FormItem: rc-field-form의 Field를 래핑하여 폼 상태 관리 및 자식 요소에 제어 props 주입
 * 3. MemoInput: 불필요한 리렌더링 방지를 위한 메모이제이션 래퍼
 */

import { QuestionCircleOutline } from 'antd-mobile-icons'
import classNames from 'classnames'
// [WHY] rc-field-form: Ant Design의 폼 상태 관리 라이브러리
// FormInstance는 폼 전체를 제어하는 인스턴스, Field는 개별 필드 컴포넌트
import { Field, FormInstance } from 'rc-field-form'
import type { FieldProps } from 'rc-field-form/lib/Field'
// [WHY] FieldContext: Field 컴포넌트들이 공유하는 컨텍스트 (validateTrigger 등 포함)
import FieldContext from 'rc-field-form/lib/FieldContext'
import type { InternalNamePath, Meta } from 'rc-field-form/lib/interface'
import type { FC, MutableRefObject, ReactNode } from 'react'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { devWarning } from '../../utils/dev-log'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { undefinedFallback } from '../../utils/undefined-fallback'
import { mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import List, { ListItemProps } from '../list'
import Popover from '../popover'
// [WHY] FormContext: Form에서 설정한 전역 옵션(layout, disabled 등) 공유
// NoStyleItemContext: noStyle FormItem의 에러를 부모에게 전파하기 위한 컨텍스트
import { FormContext, NoStyleItemContext } from './context'
import type { FormLayout } from './index'
import { isSafeSetRefComponent, toArray } from './utils'

/**
 * [WHY] 중첩된 FormItem들의 메타 정보를 구분하기 위한 구분자
 * [HOW] namePath 배열을 문자열 키로 변환할 때 사용 (예: ['user', 'name'] → 'user__SPLIT__name')
 */
const NAME_SPLIT = '__SPLIT__'

/**
 * [WHY] FormItem의 children이 함수(render props)일 때의 타입 정의
 * [HOW] form 인스턴스를 인자로 받아 동적으로 자식을 렌더링할 수 있음
 * 예: <Form.Item>{(form) => <Input disabled={form.getFieldValue('other')} />}</Form.Item>
 */
type RenderChildren<Values = any> = (form: FormInstance<Values>) => ReactNode
type ChildrenType<Values = any> = RenderChildren<Values> | ReactNode

/**
 * [WHY] rc-field-form의 FieldProps에서 children을 제외한 타입
 * [HOW] FormItem이 자체적으로 children 처리 로직을 구현하므로 제외
 */
type RcFieldProps = Omit<FieldProps, 'children'>

const classPrefix = `adm-form-item`

/**
 * FormItem의 Props 타입 정의
 *
 * [WHY] 세 가지 소스에서 props를 조합하여 완전한 FormItem 인터페이스 구성:
 * 1. RcFieldProps: 폼 필드 제어 관련 (유효성 검사, 값 동기화 등)
 * 2. ListItemProps: UI 레이아웃 관련 (List.Item 기반 렌더링)
 * 3. 자체 확장 props: ant-design-mobile 고유 기능
 *
 * [HOW] Pick 유틸리티 타입으로 필요한 props만 선택적으로 가져옴
 */
export type FormItemProps = Pick<
  RcFieldProps,
  // --- 폼 필드 제어 props (rc-field-form에서 가져옴) ---
  | 'dependencies' // 의존하는 다른 필드들 (해당 필드 변경 시 재렌더링)
  | 'valuePropName' // 값을 전달할 prop 이름 (기본: 'value', 체크박스: 'checked')
  | 'name' // 필드 이름 (폼 데이터의 키)
  | 'rules' // 유효성 검사 규칙 배열
  | 'messageVariables' // 에러 메시지에서 사용할 변수 (예: {label} → 실제 라벨)
  | 'trigger' // 값 수집 트리거 이벤트 (기본: 'onChange')
  | 'validateTrigger' // 유효성 검사 트리거 이벤트
  | 'shouldUpdate' // true면 폼 값 변경마다 재렌더링 (render props와 함께 사용)
  | 'initialValue' // 필드 초기값
  | 'getValueFromEvent' // 이벤트에서 값 추출 커스텀 함수
  | 'getValueProps' // 값을 자식에게 전달할 때 변환 함수
  | 'normalize' // 값 정규화 함수 (저장 전 변환)
  | 'preserve' // true면 필드 언마운트 시에도 값 유지
  | 'validateFirst' // true면 첫 번째 에러에서 검사 중단
> &
  // --- UI 레이아웃 props (List.Item에서 가져옴) ---
  Pick<
    ListItemProps,
    'style' | 'extra' | 'clickable' | 'arrow' | 'arrowIcon' | 'description'
  > & {
    // --- ant-design-mobile 고유 확장 props ---
    label?: ReactNode // 필드 라벨
    help?: ReactNode // 도움말 (Popover로 표시)
    helpIcon?: ReactNode // 도움말 아이콘 (기본: QuestionCircleOutline)
    hasFeedback?: boolean // 유효성 검사 결과를 UI에 표시할지 여부
    required?: boolean // 필수 표시 (* 또는 텍스트)
    noStyle?: boolean // true면 레이아웃 없이 자식만 렌더링 (에러는 부모로 전파)
    disabled?: boolean // 비활성화 상태
    hidden?: boolean // 숨김 처리
    layout?: FormLayout // 레이아웃 방향 ('horizontal' | 'vertical')
    childElementPosition?: 'normal' | 'right' // 자식 요소 정렬 위치
    children?: ChildrenType // 자식 요소 (ReactNode 또는 render props 함수)
    onClick?: (e: React.MouseEvent, widgetRef: MutableRefObject<any>) => void // 클릭 핸들러 (widgetRef로 내부 위젯 접근 가능)
  } & NativeProps

/**
 * MemoInput 컴포넌트의 Props
 *
 * [WHY] 폼 필드의 불필요한 리렌더링을 방지하기 위한 메모이제이션 래퍼
 * - value: 필드의 현재 값 (값이 변경될 때만 리렌더링)
 * - update: 강제 업데이트 카운터 (부모의 상태 변경 추적)
 */
interface MemoInputProps {
  value: any
  update: number
  children: ReactNode
}

/**
 * MemoInput - 폼 입력 필드 메모이제이션 래퍼
 *
 * [WHY] 폼 내 다른 필드 변경 시 현재 필드가 불필요하게 리렌더링되는 것을 방지
 * - 폼은 상태 변경이 빈번하므로 성능 최적화가 중요
 *
 * [HOW] React.memo의 커스텀 비교 함수 사용:
 * - value가 같고 update 카운터가 같으면 리렌더링 스킵
 * - update 카운터는 FormItem 렌더링마다 증가하여 필요시 강제 업데이트 가능
 *
 * [주의사항] value의 얕은 비교만 수행하므로, 객체/배열 값은 참조가 변경되어야 리렌더링됨
 */
const MemoInput = React.memo(
  ({ children }: MemoInputProps) => children as JSX.Element,
  (prev, next) => prev.value === next.value && prev.update === next.update
)

/**
 * FormItemLayout의 Props 타입 정의
 *
 * [WHY] 순수 UI 레이아웃 렌더링을 위한 props 분리
 * - FormItem의 비즈니스 로직과 UI 렌더링을 분리하여 관심사 분리
 * - FormItemProps에서 레이아웃 관련 props만 선택
 *
 * [HOW] FormItemProps에서 Pick으로 필요한 것만 가져오고, 추가로 필요한 props 정의:
 * - errors/warnings: 유효성 검사 결과 (FormItem에서 계산하여 전달)
 * - htmlFor: label 요소와 input 연결용 ID
 */
type FormItemLayoutProps = Pick<
  FormItemProps,
  | 'className'
  | 'style'
  | 'required'
  | 'hasFeedback'
  | 'disabled'
  | 'label'
  | 'help'
  | 'helpIcon'
  | 'hidden'
  | 'layout'
  | 'extra'
  | 'clickable'
  | 'arrow'
  | 'arrowIcon'
  | 'description'
  | 'childElementPosition'
> & {
  onClick?: (e: React.MouseEvent) => void
  htmlFor?: string // label의 for 속성 (접근성)
  errors: string[] // 에러 메시지 배열
  warnings: string[] // 경고 메시지 배열
  children: ReactNode
} & NativeProps

/**
 * FormItemLayout - FormItem의 UI 렌더링 담당 내부 컴포넌트
 *
 * [WHY] 폼 필드의 시각적 구조를 일관성 있게 렌더링
 * - 라벨, 필수 표시, 도움말, 에러/경고 메시지 등 UI 요소 배치
 * - List.Item을 기반으로 모바일 친화적 레이아웃 제공
 *
 * [HOW] List.Item 컴포넌트 활용:
 * - horizontal 레이아웃: prefix에 라벨 배치
 * - vertical 레이아웃: title에 라벨 배치
 * - description에 에러/경고 메시지 표시
 */
const FormItemLayout: FC<FormItemLayoutProps> = props => {
  // [HOW] ConfigProvider에서 locale(다국어)과 form 기본 설정 가져오기
  const { locale, form: componentConfig = {} } = useConfig()

  // [HOW] mergeProps로 컴포넌트 기본 설정과 props 병합
  // 우선순위: props > componentConfig (ConfigProvider)
  const {
    style,
    extra,
    label,
    help,
    helpIcon,
    required,
    children,
    htmlFor,
    hidden,
    arrow,
    arrowIcon,
    childElementPosition = 'normal',
  } = mergeProps(componentConfig, props)

  // [HOW] FormContext에서 Form 레벨 설정 가져오기
  const context = useContext(FormContext)

  // [WHY] 각 설정값의 우선순위 결정: props > FormContext
  // hasFeedback: props에 명시적으로 설정된 경우 우선 사용
  const hasFeedback =
    props.hasFeedback !== undefined ? props.hasFeedback : context.hasFeedback
  // layout: props → context 순으로 폴백
  const layout = props.layout || context.layout
  // disabled: nullish coalescing으로 undefined/null만 폴백
  const disabled = props.disabled ?? context.disabled

  /**
   * requiredMark - 필수 필드 표시 렌더링
   *
   * [WHY] 폼의 필수 필드를 시각적으로 구분하기 위한 마크 표시
   * - 다양한 스타일 지원으로 사용자 경험 최적화
   *
   * [HOW] IIFE(즉시 실행 함수)로 requiredMarkStyle에 따라 다른 UI 반환:
   * - 'asterisk': 빨간 별표(*) - 가장 일반적인 필수 표시
   * - 'text-required': "(필수)" 텍스트 - 필수 필드에 표시
   * - 'text-optional': "(선택)" 텍스트 - 선택 필드에 표시 (역으로 표시)
   * - 'none': 표시 없음
   */
  const requiredMark = (() => {
    const { requiredMarkStyle } = context
    switch (requiredMarkStyle) {
      case 'asterisk':
        // [HOW] required가 true일 때만 별표 표시
        return (
          required && (
            <span className={`${classPrefix}-required-asterisk`}>*</span>
          )
        )
      case 'text-required':
        // [HOW] 필수 필드에 locale에 맞는 텍스트 표시 (예: "(필수)", "(required)")
        return (
          required && (
            <span className={`${classPrefix}-required-text`}>
              ({locale.Form.required})
            </span>
          )
        )
      case 'text-optional':
        // [WHY] 역발상: 선택 필드에만 표시하여 필수가 기본임을 암시
        // [HOW] !required일 때만 표시
        return (
          !required && (
            <span className={`${classPrefix}-required-text`}>
              ({locale.Form.optional})
            </span>
          )
        )
      case 'none':
        return null
      default:
        return null
    }
  })()

  /**
   * labelElement - 라벨 영역 렌더링
   *
   * [WHY] 폼 필드의 라벨과 관련 요소들을 그룹화
   * - 라벨, 필수 마크, 도움말 아이콘을 하나의 요소로 구성
   *
   * [HOW] 구성 요소:
   * 1. label 텍스트
   * 2. requiredMark (필수 표시)
   * 3. help 도움말 (Popover로 표시)
   *
   * [접근성] htmlFor로 label과 input 연결 → 라벨 클릭 시 input 포커스
   */
  const labelElement = !!label && (
    <label className={`${classPrefix}-label`} htmlFor={htmlFor}>
      {label}
      {requiredMark}
      {/* [HOW] 도움말이 있을 경우 Popover로 클릭 시 표시 */}
      {help && (
        <Popover content={help} mode='dark' trigger='click'>
          <span
            className={`${classPrefix}-label-help`}
            onClick={e => {
              // [WHY] 이벤트 전파 중단: 부모 요소(List.Item 등)의 클릭 핸들러 실행 방지
              e.stopPropagation()
              e.preventDefault()
            }}
          >
            {/* [HOW] 커스텀 아이콘이 없으면 기본 물음표 아이콘 사용 */}
            {helpIcon || <QuestionCircleOutline />}
          </span>
        </Popover>
      )}
    </label>
  )

  /**
   * description - 설명 영역 렌더링 (에러/경고 메시지 포함)
   *
   * [WHY] 필드 하단에 부가 정보와 유효성 검사 결과를 표시
   * - 사용자가 입력 오류를 쉽게 인지하고 수정할 수 있도록 안내
   *
   * [HOW] 조건부 렌더링:
   * - props.description이 있거나 hasFeedback이 true일 때만 렌더링
   * - hasFeedback이 true면 errors/warnings 메시지 표시
   */
  const description = (!!props.description || hasFeedback) && (
    <>
      {props.description}
      {hasFeedback && (
        <>
          {/* [HOW] 에러 메시지들을 순차적으로 렌더링 (빨간색 스타일) */}
          {props.errors.map((error, index) => (
            <div
              key={`error-${index}`}
              className={`${classPrefix}-feedback-error`}
            >
              {error}
            </div>
          ))}
          {/* [HOW] 경고 메시지들을 순차적으로 렌더링 (노란색 스타일) */}
          {props.warnings.map((warning, index) => (
            <div
              key={`warning-${index}`}
              className={`${classPrefix}-feedback-warning`}
            >
              {warning}
            </div>
          ))}
        </>
      )}
    </>
  )

  /**
   * [WHY] List.Item 기반 렌더링으로 모바일 친화적 UI 구현
   *
   * [HOW] List.Item의 props 활용:
   * - title: vertical 레이아웃에서 라벨 위치 (입력 필드 위)
   * - prefix: horizontal 레이아웃에서 라벨 위치 (입력 필드 왼쪽)
   * - description: 에러/경고 메시지 영역
   *
   * [스타일링] className 조합:
   * - 기본: adm-form-item
   * - 레이아웃: adm-form-item-horizontal 또는 adm-form-item-vertical
   * - 상태: adm-form-item-hidden, adm-form-item-has-error
   */
  return withNativeProps(
    props,
    <List.Item
      style={style}
      // [HOW] 레이아웃에 따라 라벨 위치 결정
      title={layout === 'vertical' && labelElement}
      prefix={layout === 'horizontal' && labelElement}
      extra={extra}
      description={description}
      className={classNames(classPrefix, `${classPrefix}-${layout}`, {
        [`${classPrefix}-hidden`]: hidden,
        [`${classPrefix}-has-error`]: props.errors.length,
      })}
      disabled={disabled}
      onClick={props.onClick}
      clickable={props.clickable}
      arrowIcon={arrowIcon || arrow}
    >
      {/* [HOW] 자식 요소(입력 컴포넌트)를 감싸는 컨테이너 */}
      <div
        className={classNames(
          `${classPrefix}-child`,
          `${classPrefix}-child-position-${childElementPosition}`
        )}
      >
        <div className={classNames(`${classPrefix}-child-inner`)}>
          {children}
        </div>
      </div>
    </List.Item>
  )
}

/**
 * FormItem - 폼 필드의 핵심 컴포넌트
 *
 * [WHY] rc-field-form의 Field를 래핑하여 ant-design-mobile 스타일의 폼 필드 구현
 * - 폼 상태 관리 (값, 유효성 검사)를 자동으로 처리
 * - 다양한 입력 컴포넌트와의 연동 지원
 *
 * [HOW] 주요 기능:
 * 1. rc-field-form의 Field 컴포넌트로 폼 상태 관리
 * 2. 자식 컴포넌트에 value/onChange 등 제어 props 자동 주입
 * 3. 유효성 검사 결과를 FormItemLayout으로 전달하여 UI에 표시
 * 4. noStyle 모드에서 에러를 부모 FormItem으로 전파
 *
 * [구현 난이도: 높음]
 * - rc-field-form과의 통합, render props 패턴, Context 활용 등 복잡한 구조
 */
export const FormItem: FC<FormItemProps> = props => {
  // [HOW] props를 카테고리별로 구조 분해
  const {
    // --- 스타일 관련 ---
    style,
    // --- FormItem UI 관련 ---
    label,
    help,
    helpIcon,
    extra,
    hasFeedback,
    name, // 폼 필드 이름 (폼 데이터의 키)
    required,
    noStyle, // true면 레이아웃 없이 렌더링
    hidden,
    layout,
    childElementPosition,
    description,
    // --- rc-field-form Field 관련 ---
    disabled,
    rules,
    children,
    messageVariables,
    trigger = 'onChange', // 값 수집 이벤트 (기본: onChange)
    validateTrigger = trigger, // 유효성 검사 트리거 (기본: trigger와 동일)
    onClick,
    shouldUpdate, // true면 폼 값 변경마다 재렌더링
    dependencies, // 의존 필드 목록
    clickable,
    arrow,
    arrowIcon,
    ...fieldProps // 나머지는 Field에 전달
  } = props

  // [HOW] Form 레벨의 name (폼 식별자)
  const { name: formName } = useContext(FormContext)
  // [HOW] FieldContext에서 전역 validateTrigger 가져오기
  const { validateTrigger: contextValidateTrigger } = useContext(FieldContext)

  /**
   * [WHY] validateTrigger 우선순위 결정
   * [HOW] undefinedFallback: 첫 번째 undefined가 아닌 값 반환
   * 우선순위: props.validateTrigger > context.validateTrigger > trigger
   */
  const mergedValidateTrigger = undefinedFallback(
    validateTrigger,
    contextValidateTrigger,
    trigger
  )

  /**
   * [WHY] widgetRef: 내부 입력 컴포넌트 참조
   * [HOW] onClick 핸들러에서 widgetRef를 통해 입력 컴포넌트에 직접 접근 가능
   * 예: 클릭 시 DatePicker 열기
   */
  const widgetRef = useRef<any>(null)

  /**
   * [WHY] updateRef: MemoInput의 강제 업데이트 카운터
   * [HOW] 매 렌더링마다 1 증가
   * - MemoInput은 value와 update가 같으면 리렌더링 스킵
   * - 부모가 리렌더링되면 update도 변경되어 필요시 자식도 업데이트
   */
  const updateRef = useRef(0)
  updateRef.current += 1

  /**
   * [WHY] subMetas: 중첩된 noStyle FormItem들의 메타 정보 저장
   * [HOW] key는 namePath를 NAME_SPLIT으로 조인한 문자열
   * - noStyle FormItem의 에러를 부모에서 수집하여 표시
   */
  const [subMetas, setSubMetas] = useState<Record<string, Meta>>({})
  /**
   * onSubMetaChange - noStyle 자식 FormItem의 메타 정보 변경 콜백
   *
   * [WHY] noStyle FormItem은 자체 UI가 없으므로 에러를 부모에게 전파해야 함
   * [HOW] NoStyleItemContext를 통해 자식에서 호출
   * - destroy: true면 해당 필드 메타 삭제 (언마운트 시)
   * - 그 외: 메타 정보 저장/업데이트
   *
   * [메모리 관리] useCallback으로 메모이제이션하여 불필요한 재생성 방지
   */
  const onSubMetaChange = useCallback(
    (subMeta: Meta & { destroy?: boolean }, namePath: InternalNamePath) => {
      setSubMetas(prevSubMetas => {
        const nextSubMetas = { ...prevSubMetas }
        // [HOW] namePath 배열을 문자열 키로 변환 (예: ['user', 'name'] → 'user__SPLIT__name')
        const nameKey = namePath.join(NAME_SPLIT)
        if (subMeta.destroy) {
          // [HOW] 자식 FormItem 언마운트 시 메타 정보 삭제
          delete nextSubMetas[nameKey]
        } else {
          // [HOW] 메타 정보 저장/업데이트
          nextSubMetas[nameKey] = subMeta
        }
        return nextSubMetas
      })
    },
    [setSubMetas]
  )

  /**
   * renderLayout - FormItemLayout으로 자식을 감싸서 렌더링
   *
   * [WHY] 레이아웃 렌더링 로직을 분리하여 코드 가독성 향상
   *
   * [HOW] 파라미터:
   * - baseChildren: 렌더링할 자식 요소 (입력 컴포넌트)
   * - fieldId: label과 input 연결용 ID
   * - meta: rc-field-form의 필드 메타 정보 (errors, warnings 등)
   * - isRequired: 필수 표시 여부
   *
   * [특수 케이스]
   * - noStyle && !hidden: 레이아웃 없이 자식만 반환 (에러는 부모로 전파)
   */
  function renderLayout(
    baseChildren: ReactNode,
    fieldId?: string,
    meta?: Meta,
    isRequired?: boolean
  ) {
    // [HOW] noStyle이고 hidden이 아니면 레이아웃 없이 자식만 반환
    if (noStyle && !hidden) {
      return baseChildren
    }

    // [HOW] 현재 필드의 에러 + 모든 noStyle 자식들의 에러 수집
    const curErrors = meta?.errors ?? []
    const errors = Object.keys(subMetas).reduce(
      (subErrors: string[], key: string) => {
        const errors = subMetas[key]?.errors ?? []
        if (errors.length) {
          subErrors = [...subErrors, ...errors]
        }
        return subErrors
      },
      curErrors
    )
    // [HOW] 현재 필드의 경고 + 모든 noStyle 자식들의 경고 수집
    const curWarnings = meta?.warnings ?? []
    const warnings = Object.keys(subMetas).reduce(
      (subWarnings: string[], key: string) => {
        const warnings = subMetas[key]?.warnings ?? []
        if (warnings.length) {
          subWarnings = [...subWarnings, ...warnings]
        }
        return subWarnings
      },
      curWarnings
    )

    return withNativeProps(
      props,
      <FormItemLayout
        style={style}
        label={label}
        extra={extra}
        help={help}
        helpIcon={helpIcon}
        description={description}
        required={isRequired}
        disabled={disabled}
        hasFeedback={hasFeedback}
        htmlFor={fieldId}
        errors={errors}
        warnings={warnings}
        // [HOW] onClick 핸들러가 있으면 widgetRef와 함께 호출
        onClick={onClick && (e => onClick(e, widgetRef))}
        hidden={hidden}
        layout={layout}
        childElementPosition={childElementPosition}
        clickable={clickable}
        arrow={arrow}
        arrowIcon={arrowIcon}
      >
        {/* [WHY] NoStyleItemContext로 자식 noStyle FormItem의 에러 수집 가능하게 함 */}
        <NoStyleItemContext.Provider value={onSubMetaChange}>
          {baseChildren}
        </NoStyleItemContext.Provider>
      </FormItemLayout>
    )
  }

  /**
   * [WHY] children이 함수(render props)인지 확인
   * [HOW] render props 패턴 사용 시 form context를 인자로 받아 동적 렌더링 가능
   */
  const isRenderProps = typeof children === 'function'

  /**
   * [WHY] 단순 레이아웃 모드 조기 반환
   * [HOW] name, render props, dependencies가 모두 없으면:
   * - 폼 상태 관리가 필요 없는 순수 레이아웃 용도
   * - Field 없이 바로 renderLayout으로 렌더링
   * 예: <Form.Item label="설명">순수 텍스트</Form.Item>
   */
  if (!name && !isRenderProps && !props.dependencies) {
    return renderLayout(children) as JSX.Element
  }

  /**
   * [WHY] 에러 메시지에서 사용할 변수 설정
   * [HOW] rules의 에러 메시지에서 ${label} 같은 템플릿 변수 치환 가능
   * 예: { required: true, message: '${label}을 입력해주세요' } → '이름을 입력해주세요'
   */
  let Variables: Record<string, string> = {}
  Variables.label = typeof label === 'string' ? label : ''
  if (messageVariables) {
    Variables = { ...Variables, ...messageVariables }
  }

  /**
   * [WHY] 부모 noStyle FormItem에 메타 변경 알림
   * [HOW] NoStyleItemContext에서 부모의 onSubMetaChange 함수 가져오기
   */
  const notifyParentMetaChange = useContext(NoStyleItemContext)
  /**
   * onMetaChange - rc-field-form Field의 메타 변경 콜백
   *
   * [WHY] noStyle FormItem의 에러를 부모로 전파
   * [HOW] noStyle이고 부모 콜백이 있을 때만 호출
   * - meta.name: 현재 필드의 namePath
   * - 부모의 subMetas에 저장되어 부모 UI에서 에러 표시
   */
  const onMetaChange = (meta: Meta & { destroy?: boolean }) => {
    if (noStyle && notifyParentMetaChange) {
      const namePath = meta.name
      notifyParentMetaChange(meta, namePath)
    }
  }

  /**
   * [WHY] rc-field-form의 Field 컴포넌트로 폼 상태 관리
   *
   * [HOW] Field는 render props 패턴으로 동작:
   * - control: { value, onChange, ... } 폼 제어 props
   * - meta: { errors, warnings, touched, ... } 필드 메타 정보
   * - context: FormInstance (폼 전체 조작용)
   *
   * [구현 난이도: 높음]
   * - render props 내에서 다양한 자식 타입 처리 로직 포함
   */
  return (
    <Field
      {...fieldProps}
      name={name}
      shouldUpdate={shouldUpdate}
      dependencies={dependencies}
      rules={rules}
      trigger={trigger}
      validateTrigger={mergedValidateTrigger}
      onMetaChange={onMetaChange}
      messageVariables={Variables}
    >
      {(control, meta, context) => {
        let childNode: ReactNode = null

        /**
         * [WHY] required 표시 여부 결정
         * [HOW] 우선순위:
         * 1. props.required가 명시적으로 설정된 경우 사용
         * 2. rules에 required: true인 규칙이 있으면 자동으로 필수 표시
         */
        const isRequired =
          required !== undefined
            ? required
            : rules &&
              rules.some(
                rule => !!(rule && typeof rule === 'object' && rule.required)
              )

        /**
         * [WHY] fieldId 생성: label의 htmlFor와 input의 id 연결용
         * [HOW] 구조: [formName]_[name1]_[name2]_...
         * 예: formName='user', name=['address', 'city'] → 'user_address_city'
         */
        const nameList = toArray(name).length && meta ? meta.name : []
        const fieldId = (
          nameList.length > 0 && formName ? [formName, ...nameList] : nameList
        ).join('_')

        // [개발자 경고] shouldUpdate와 dependencies 동시 사용 금지
        if (shouldUpdate && dependencies) {
          devWarning(
            'Form.Item',
            "`shouldUpdate` and `dependencies` shouldn't be used together."
          )
        }

        /**
         * [케이스 1] render props 패턴 처리
         * children이 함수인 경우
         */
        if (isRenderProps) {
          // [HOW] shouldUpdate/dependencies와 함께 사용하면 context로 동적 렌더링
          if ((shouldUpdate || dependencies) && !name) {
            childNode = (children as RenderChildren)(context)
          } else {
            // [개발자 경고] render props의 올바른 사용법 안내
            if (!(shouldUpdate || dependencies)) {
              devWarning(
                'Form.Item',
                '`children` of render props only work with `shouldUpdate` or `dependencies`.'
              )
            }
            if (name) {
              devWarning(
                'Form.Item',
                "Do not use `name` with `children` of render props since it's not a field."
              )
            }
          }

          /**
           * [케이스 2] 일반 React 요소 처리 (가장 일반적인 케이스)
           * children이 함수가 아닌 경우
           */
        } else if (dependencies && !name) {
          // [개발자 경고] dependencies 사용 시 name 필수
          devWarning(
            'Form.Item',
            'Must set `name` or use render props when `dependencies` is set.'
          )
        } else if (React.isValidElement(children)) {
          // [개발자 경고] defaultValue 사용 금지 (controlled 컴포넌트이므로)
          if (children.props.defaultValue) {
            devWarning(
              'Form.Item',
              '`defaultValue` will not work on controlled Field. You should use `initialValues` of Form instead.'
            )
          }

          /**
           * [HOW] 자식 컴포넌트에 전달할 props 구성
           * - 원본 props 유지
           * - control (value, onChange 등) 주입
           */
          const childProps = { ...children.props, ...control }

          /**
           * [WHY] ref 병합: 원본 ref와 widgetRef 모두 설정
           * [HOW] isSafeSetRefComponent: 클래스 컴포넌트나 forwardRef 컴포넌트인지 확인
           * - 원본 ref가 있으면 함수/객체 형태에 따라 호출
           * - widgetRef.current에도 저장 (onClick에서 접근용)
           */
          if (isSafeSetRefComponent(children)) {
            childProps.ref = (instance: any) => {
              const originRef = (children as any).ref
              if (originRef) {
                // 함수형 ref 처리
                if (typeof originRef === 'function') {
                  originRef(instance)
                }
                // 객체형 ref 처리 (createRef, useRef)
                if ('current' in originRef) {
                  originRef.current = instance
                }
              }
              widgetRef.current = instance
            }
          }

          // [접근성] fieldId를 자식의 id로 설정 (label과 연결)
          if (!childProps.id) {
            childProps.id = fieldId
          }

          /**
           * [WHY] 이벤트 핸들러 병합
           * [HOW] trigger와 validateTrigger에 해당하는 이벤트 핸들러를 래핑:
           * 1. control의 핸들러 먼저 호출 (폼 상태 업데이트)
           * 2. 원본 children의 핸들러 호출 (사용자 정의 로직)
           *
           * [주의] 사용자의 원본 이벤트 핸들러를 덮어쓰지 않도록 주의
           */
          const triggers = new Set<string>([
            ...toArray(trigger),
            ...toArray(mergedValidateTrigger),
          ])

          triggers.forEach(eventName => {
            childProps[eventName] = (...args: any[]) => {
              // 폼 제어 핸들러 호출 (값 업데이트, 유효성 검사 트리거)
              control[eventName]?.(...args)
              // 사용자 정의 핸들러 호출
              children.props[eventName]?.(...args)
            }
          })

          /**
           * [HOW] MemoInput으로 감싸서 불필요한 리렌더링 방지
           * - value와 update가 변경되지 않으면 자식 리렌더링 스킵
           * - cloneElement로 새로운 props 주입
           */
          childNode = (
            <MemoInput
              value={control[props.valuePropName || 'value']}
              update={updateRef.current}
            >
              {React.cloneElement(children, childProps)}
            </MemoInput>
          )
        } else {
          /**
           * [케이스 3] 일반 텍스트 등 비React요소
           * [개발자 경고] name을 설정했지만 React요소가 아닌 경우
           */
          if (name) {
            devWarning(
              'Form.Item',
              '`name` is only used for validate React element. If you are using Form.Item as layout display, please remove `name` instead.'
            )
          }
          childNode = children
        }

        // [HOW] 최종적으로 FormItemLayout으로 감싸서 반환
        return renderLayout(childNode, fieldId, meta, isRequired)
      }}
    </Field>
  )
}
