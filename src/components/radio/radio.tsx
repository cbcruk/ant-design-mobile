import classNames from 'classnames'
import type { FC, ReactNode } from 'react'
import React, { useContext } from 'react'
import { devWarning } from '../../utils/dev-log'
import { isDev } from '../../utils/is-dev'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProps } from '../../utils/with-default-props'
import { CheckIcon } from '../checkbox/check-icon' // 체크박스의 체크 아이콘을 재사용
import { NativeInput } from '../checkbox/native-input' // 네이티브 input 래퍼 재사용
import { RadioGroupContext } from './group-context'

// 라디오 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-radio`

// 라디오 버튼의 값 타입 정의 - 문자열 또는 숫자
export type RadioValue = string | number

// 라디오 컴포넌트의 Props 타입 정의
export type RadioProps = {
  checked?: boolean // 선택 상태 - 제어 모드
  defaultChecked?: boolean // 기본 선택 상태 - 비제어 모드
  disabled?: boolean // 비활성화 상태
  onChange?: (checked: boolean) => void // 선택 상태 변경 시 호출되는 콜백
  value?: RadioValue // 라디오 버튼의 값 - 그룹에서 식별자로 사용
  block?: boolean // 블록 레벨 표시 여부 (한 줄 전체 차지)
  id?: string // HTML id 속성
  icon?: (checked: boolean) => ReactNode // 커스텀 아이콘 렌더링 함수
  children?: ReactNode // 라디오 버튼 옆에 표시될 내용 (텍스트 등)
  onClick?: (event: React.MouseEvent<HTMLLabelElement, MouseEvent>) => void // 클릭 이벤트 핸들러
} & NativeProps<'--icon-size' | '--font-size' | '--gap'> // CSS 커스텀 프로퍼티 지원

// 기본 속성값
const defaultProps = {
  defaultChecked: false, // 기본적으로 선택되지 않은 상태
}

// 라디오 버튼 컴포넌트
// 설계 특징: 체크박스와 매우 유사한 구조를 가지지만 단일 선택만 가능
// 차이점: 그룹 내에서 하나만 선택되며, 선택된 상태에서 다시 클릭해도 선택 해제되지 않음
export const Radio: FC<RadioProps> = p => {
  const props = mergeProps(defaultProps, p) // 기본 props와 사용자 props 병합
  const groupContext = useContext(RadioGroupContext) // 라디오 그룹 컨텍스트 확인

  // 제어/비제어 컴포넌트 패턴 적용
  let [checked, setChecked] = usePropsValue<boolean>({
    value: props.checked,
    defaultValue: props.defaultChecked,
    onChange: props.onChange,
  }) as [boolean, (v: boolean) => void]
  let disabled = props.disabled

  const { value } = props
  // 그룹 컨텍스트가 존재하고 value가 정의된 경우 그룹 모드로 동작
  if (groupContext && value !== undefined) {
    // 개발 모드에서 잘못된 props 사용에 대한 경고
    // 그룹 모드에서는 개별 라디오의 checked/defaultChecked가 무시됨
    if (isDev) {
      if (p.checked !== undefined) {
        devWarning(
          'Radio',
          'When used within `Radio.Group`, the `checked` prop of `Radio` will not work.'
        )
      }
      if (p.defaultChecked !== undefined) {
        devWarning(
          'Radio',
          'When used within `Radio.Group`, the `defaultChecked` prop of `Radio` will not work.'
        )
      }
    }

    // 그룹에서 현재 라디오가 선택되었는지 확인
    // 주의: 라디오 그룹은 단일 선택이지만 배열 형태로 저장 (체크박스와 인터페이스 통일)
    checked = groupContext.value.includes(value)
    setChecked = (innerChecked: boolean) => {
      if (innerChecked) {
        groupContext.check(value) // 현재 라디오 선택 (다른 라디오는 자동으로 해제됨)
      } else {
        groupContext.uncheck(value) // 라디오는 일반적으로 선택 해제되지 않지만 API 일관성을 위해 제공
      }
      props.onChange?.(innerChecked) // 개별 onChange도 호출
    }
    disabled = disabled || groupContext.disabled // 그룹 레벨 disabled가 우선
  }

  // 아이콘 렌더링 함수
  const renderIcon = () => {
    if (props.icon) {
      // 커스텀 아이콘이 제공된 경우
      return (
        <div className={`${classPrefix}-custom-icon`}>
          {props.icon(checked)}
        </div>
      )
    }

    // 기본 아이콘: 체크박스의 CheckIcon을 재사용
    // 라디오와 체크박스의 시각적 차이는 CSS로 처리 (원형 vs 사각형)
    return (
      <div className={`${classPrefix}-icon`}>{checked && <CheckIcon />}</div>
    )
  }

  return withNativeProps(
    props,
    <label
      onClick={props.onClick}
      className={classNames(classPrefix, {
        [`${classPrefix}-checked`]: checked, // 선택된 상태 클래스
        [`${classPrefix}-disabled`]: disabled, // 비활성화 상태 클래스
        [`${classPrefix}-block`]: props.block, // 블록 레벨 표시 클래스
      })}
    >
      {/* 네이티브 radio input - 접근성과 브라우저 기본 기능 지원 */}
      <NativeInput
        type='radio'
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
}
