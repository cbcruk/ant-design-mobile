import React, { forwardRef, useMemo } from 'react'
import type { ReactNode, ForwardedRef } from 'react'
import classNames from 'classnames'
import { NativeProps } from '../../utils/native-props'
import List, { ListProps } from '../list'
import RcForm from 'rc-field-form'
import type {
  FormProps as RcFormProps,
  FormInstance as RCFormInstance,
} from 'rc-field-form'
import { defaultFormContext, FormContext, FormContextType } from './context'
import { mergeProps } from '../../utils/with-default-props'
import { Header } from './header'
import { useConfig } from '../config-provider'
import merge from 'deepmerge'
import { FormArray } from './form-array'
import { traverseReactNode } from '../../utils/traverse-react-node'

// 폼 컴포넌트의 CSS 클래스 접두사
const classPrefix = 'adm-form'

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

export type FormProps = Pick<
  RcFormProps,
  | 'form'
  | 'initialValues'
  | 'name'
  | 'preserve'
  | 'validateMessages'
  | 'validateTrigger'
  | 'onFieldsChange'
  | 'onFinish'
  | 'onFinishFailed'
  | 'onValuesChange'
  | 'children'
> &
  NativeProps<
    '--border-inner' | '--border-top' | '--border-bottom' | '--prefix-width'
  > &
  Partial<FormContextType> & {
    footer?: ReactNode
    mode?: ListProps['mode']
  }

const defaultProps = defaultFormContext

// 폼 컴포넌트 - 동적 섹션 분할과 모바일 최적화를 제공하는 고도화된 폼 시스템
// 설계 의도: 긴 폼을 시각적으로 구분된 섹션으로 나누어 모바일에서의 가독성과 사용성 향상
// 핵심 특징: Header 기반 자동 섹션 분할, rc-field-form과의 완전 통합, 다국어 검증 메시지
export const Form = forwardRef<FormInstance, FormProps>((p, ref) => {
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
    ...formProps
  } = props

  const { locale } = useConfig()

  // 다국어 검증 메시지 병합: 기본 메시지와 사용자 정의 메시지를 깊은 병합
  // 문제: 각 언어별로 모든 검증 메시지를 다시 정의하는 것은 비효율적
  // 해결: deepmerge로 기본 다국어 메시지 위에 사용자 정의 메시지만 덮어씌우기
  const validateMessages = useMemo(
    () =>
      merge(
        locale.Form.defaultValidateMessages,
        formProps.validateMessages || {}
      ),
    [locale.Form.defaultValidateMessages, formProps.validateMessages]
  )

  // 동적 리스트 생성을 위한 상태 변수들
  const lists: ReactNode[] = []

  let currentHeader: ReactNode = null
  let items: ReactNode[] = []
  let count = 0

  // 현재 수집된 아이템들을 하나의 List로 묶어서 lists에 추가
  // 이 패턴으로 Header를 만날 때마다 새로운 섹션을 생성
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

  // 자식 요소들을 순회하면서 동적 섹션 분할 수행
  // 핵심 로직: Header와 FormArray를 만나면 현재 섹션을 종료하고 새로운 섹션 시작
  traverseReactNode(props.children as ReactNode, child => {
    if (React.isValidElement(child)) {
      if (child.type === Header) {
        // Header를 만나면 이전 섹션을 완료하고 새로운 헤더 설정
        collect()
        currentHeader = child.props.children
        return
      }
      if (child.type === FormArray) {
        // FormArray는 독립적인 요소이므로 별도로 처리
        collect()
        lists.push(child)
        return
      }
    }
    // 일반 폼 아이템들은 현재 섹션에 누적
    items.push(child)
  })
  // 마지막 섹션 완료
  collect()

  return (
    <RcForm
      className={classNames(classPrefix, className)}
      style={style}
      ref={ref as ForwardedRef<RCFormInstance>}
      {...formProps}
      validateMessages={validateMessages}
    >
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
      {footer && <div className={`${classPrefix}-footer`}>{footer}</div>}
    </RcForm>
  )
})
