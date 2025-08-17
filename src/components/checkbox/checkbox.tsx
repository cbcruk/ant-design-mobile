import React, { forwardRef, useContext, useImperativeHandle } from 'react'
import type { ReactNode } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import classNames from 'classnames'
import { CheckboxGroupContext } from './group-context'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProps } from '../../utils/with-default-props'
import { devWarning } from '../../utils/dev-log'
import { CheckIcon } from './check-icon'
import { IndeterminateIcon } from './indeterminate-icon'
import { isDev } from '../../utils/is-dev'
import { NativeInput } from './native-input'

// 체크박스 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-checkbox`

// 체크박스 값 타입 정의
export type CheckboxValue = string | number

// 체크박스 컴포넌트의 Props 타입 정의
export type CheckboxProps = {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
  value?: CheckboxValue
  indeterminate?: boolean
  block?: boolean
  id?: string
  icon?: (checked: boolean, indeterminate: boolean) => ReactNode
  children?: ReactNode
  onClick?: (event: React.MouseEvent<HTMLLabelElement, MouseEvent>) => void
} & NativeProps<'--icon-size' | '--font-size' | '--gap'>

// 체크박스 컴포넌트의 기본 속성값들
const defaultProps = {
  defaultChecked: false,
  indeterminate: false,
}

// 체크박스 컴포넌트의 ref 타입 정의 - 외부에서 체크박스 상태를 제어할 수 있는 메서드들 제공
export type CheckboxRef = {
  check: () => void
  uncheck: () => void
  toggle: () => void
}

// 체크박스 컴포넌트 - 단독 사용과 그룹 사용 시나리오를 모두 처리하는 복합적 설계
// 설계 의도: 하나의 컴포넌트로 개별 체크박스와 그룹 내 체크박스 모두 지원
// 이를 통해 API 일관성을 유지하면서도 다양한 사용 패턴에 대응
export const Checkbox = forwardRef<CheckboxRef, CheckboxProps>((p, ref) => {
  // Context API를 통해 부모 CheckboxGroup의 존재 여부와 설정 확인
  // 이 패턴으로 그룹 모드와 단독 모드를 자동 감지하여 적절한 동작 전환
  const groupContext = useContext(CheckboxGroupContext)

  const props = mergeProps(defaultProps, p)

  // usePropsValue: 제어/비제어 컴포넌트 패턴의 핵심 훅
  // 문제: React에서 제어/비제어 상태를 일관되게 처리하기 어려움
  // 해결: 내부 상태와 외부 props를 자동으로 동기화하여 두 패턴 모두 지원
  let [checked, setChecked] = usePropsValue({
    value: props.checked,
    defaultValue: props.defaultChecked,
    onChange: props.onChange,
  }) as [boolean, (v: boolean) => void]
  let disabled = props.disabled

  const { value } = props
  // 그룹 컨텍스트 존재 시 개별 체크박스의 상태 관리를 그룹 로직으로 위임
  // 이렇게 하면 개별 체크박스는 그룹의 상태에 따라 자동으로 동작하게 됨
  if (groupContext && value !== undefined) {
    // 개발 모드에서 잘못된 props 사용에 대한 경고
    // 문제: 그룹 모드에서 개별 체크박스의 checked/defaultChecked는 무시되어야 함
    // 해결: 개발자에게 명확한 경고 메시지로 올바른 사용법 안내
    if (isDev) {
      if (p.checked !== undefined) {
        devWarning(
          'Checkbox',
          'When used within `Checkbox.Group`, the `checked` prop of `Checkbox` will not work.'
        )
      }
      if (p.defaultChecked !== undefined) {
        devWarning(
          'Checkbox',
          'When used within `Checkbox.Group`, the `defaultChecked` prop of `Checkbox` will not work.'
        )
      }
    }

    // 그룹 모드에서는 체크 상태를 그룹의 value 배열에서 현재 체크박스 value 포함 여부로 결정
    // 이 방식으로 다중 선택 상태를 배열 기반으로 효율적으로 관리
    checked = groupContext.value.includes(value)
    setChecked = (checked: boolean) => {
      // 체크/언체크 시 그룹의 배열 상태를 업데이트하고 개별 onChange도 호출
      // 이중 호출 구조로 그룹 레벨과 개별 레벨의 이벤트 처리를 모두 지원
      if (checked) {
        groupContext.check(value)
      } else {
        groupContext.uncheck(value)
      }
      props.onChange?.(checked)
    }
    // 그룹 레벨의 disabled 상태가 개별 체크박스보다 우선
    disabled = disabled || groupContext.disabled
  }

  useImperativeHandle(ref, () => ({
    check: () => {
      setChecked(true)
    },
    uncheck: () => {
      setChecked(false)
    },
    toggle: () => {
      setChecked(!checked)
    },
  }))

  const renderIcon = () => {
    if (props.icon) {
      return (
        <div className={`${classPrefix}-custom-icon`}>
          {props.icon(checked, props.indeterminate)}
        </div>
      )
    }

    return (
      <div className={`${classPrefix}-icon`}>
        {props.indeterminate ? <IndeterminateIcon /> : checked && <CheckIcon />}
      </div>
    )
  }

  return withNativeProps(
    props,
    <label
      onClick={props.onClick}
      className={classNames(classPrefix, {
        [`${classPrefix}-checked`]: checked && !props.indeterminate,
        [`${classPrefix}-indeterminate`]: props.indeterminate,
        [`${classPrefix}-disabled`]: disabled,
        [`${classPrefix}-block`]: props.block,
      })}
    >
      <NativeInput
        type='checkbox'
        checked={checked}
        onChange={setChecked}
        disabled={disabled}
        id={props.id}
      />
      {renderIcon()}
      {props.children && (
        <div className={`${classPrefix}-content`}>{props.children}</div>
      )}
    </label>
  )
})
