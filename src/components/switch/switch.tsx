import classNames from 'classnames'
import React, { useState } from 'react'
import type { FC, ReactNode } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProps } from '../../utils/with-default-props'
import { SpinIcon } from './spin-icon'
import { useConfig } from '../config-provider'
import { isPromise } from '../../utils/validate'

// 스위치 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-switch`

export type SwitchProps = {
  loading?: boolean
  disabled?: boolean
  checked?: boolean
  defaultChecked?: boolean
  /** @deprecated use `onChange` instead */
  beforeChange?: (val: boolean) => Promise<void>
  onChange?: (checked: boolean) => void | Promise<void>
  checkedText?: ReactNode
  uncheckedText?: ReactNode
} & NativeProps<'--checked-color' | '--width' | '--height' | '--border-width'>

const defaultProps = {
  defaultChecked: false,
}

// 스위치 컴포넌트 - 비동기 상태 변경과 다중 로딩 상태를 지원하는 고도화된 토글 스위치
// 설계 의도: API 호출이나 검증 로직이 필요한 스위치 동작에서 사용자에게 명확한 피드백 제공
// 핵심 특징: beforeChange와 onChange 양쪽에서의 Promise 지원, 중복 클릭 방지, 시각적 로딩 상태
export const Switch: FC<SwitchProps> = p => {
  const props = mergeProps(defaultProps, p)
  const disabled = props.disabled || props.loading || false

  // 내부 변경 상태: beforeChange나 onChange가 Promise를 반환할 때의 로딩 상태
  // 문제: 외부 loading과 내부 비동기 작업 로딩을 구분해야 함
  // 해결: changing 상태를 별도로 관리하여 두 가지 로딩 상태를 독립적으로 처리
  const [changing, setChanging] = useState(false)
  const { locale } = useConfig()

  const [checked, setChecked] = usePropsValue({
    value: props.checked,
    defaultValue: props.defaultChecked,
    onChange: props.onChange,
  })

  // 복합적인 비동기 클릭 핸들러: 다단계 검증과 상태 변경 지원
  async function onClick() {
    // 다중 비활성화 조건 확인: disabled, loading, changing 중 하나라도 true이면 중단
    if (disabled || props.loading || changing) {
      return
    }
    const nextChecked = !checked

    // beforeChange 단계: 상태 변경 전 검증이나 확인 로직 실행
    // 예: "정말 비활성화하시겠습니까?" 확인 다이얼로그, 권한 검증 API 호출 등
    if (props.beforeChange) {
      setChanging(true)
      try {
        await props.beforeChange(nextChecked)
        setChanging(false)
      } catch (e) {
        // beforeChange 실패 시 상태 변경 없이 로딩 해제
        setChanging(false)
        throw e
      }
    }

    // onChange 단계: 실제 상태 변경 및 후속 처리
    const result = setChecked(nextChecked)
    // onChange가 Promise를 반환하는 경우 (예: API 호출)
    if (isPromise(result)) {
      setChanging(true)
      try {
        await result
        setChanging(false)
      } catch (e) {
        // onChange 실패 시에도 로딩 해제 (상태는 이미 변경됨)
        setChanging(false)
        throw e
      }
    }
  }

  return withNativeProps(
    props,
    <div
      onClick={onClick}
      className={classNames(classPrefix, {
        [`${classPrefix}-checked`]: checked,
        // changing 상태도 disabled 스타일 적용하여 사용자에게 비활성 상태임을 명확히 표시
        [`${classPrefix}-disabled`]: disabled || changing,
      })}
      role='switch'
      aria-label={locale.Switch.name}
      aria-checked={checked}
      aria-disabled={disabled}
    >
      <div className={`${classPrefix}-checkbox`}>
        <div className={`${classPrefix}-handle`}>
          {/* 다중 로딩 표시: 외부 loading과 내부 changing 모두에서 스피너 표시
              이 통합적 접근으로 사용자는 어떤 이유든 스위치가 작업 중임을 알 수 있음 */}
          {(props.loading || changing) && (
            <SpinIcon className={`${classPrefix}-spin-icon`} />
          )}
        </div>
        <div className={`${classPrefix}-inner`}>
          {/* 상태에 따른 조건부 텍스트 표시 */}
          {checked ? props.checkedText : props.uncheckedText}
        </div>
      </div>
    </div>
  )
}
