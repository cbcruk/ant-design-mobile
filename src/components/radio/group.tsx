import React from 'react'
import type { FC, ReactNode } from 'react'
import { mergeProps } from '../../utils/with-default-props'
import { RadioValue } from '.'
import { RadioGroupContext } from './group-context'
import { usePropsValue } from '../../utils/use-props-value'

// 라디오 그룹 컴포넌트의 Props 타입 정의
export interface RadioGroupProps {
  value?: RadioValue | null // 제어 모드: 현재 선택된 라디오의 값 (단일 값 또는 null)
  onChange?: (val: RadioValue) => void // 선택 변경 시 호출되는 콜백 (선택된 값 전달)
  defaultValue?: RadioValue | null // 비제어 모드: 초기 선택 값 (단일 값 또는 null)
  disabled?: boolean // 그룹 전체의 비활성화 상태
  children?: ReactNode // 그룹 내부의 라디오 컴포넌트들
}

// 기본 속성값 정의
const defaultProps = {
  disabled: false, // 기본적으로 활성화 상태
  defaultValue: null, // 기본적으로 아무것도 선택되지 않은 상태
}

// 라디오 그룹 컴포넌트
// 설계 목적: 여러 라디오 버튼을 하나의 그룹으로 관리하여 단일 선택 기능 제공
// 체크박스 그룹과의 차이점: 단일 값만 관리하지만 내부적으로는 배열 형태로 저장하여 인터페이스 통일
export const Group: FC<RadioGroupProps> = p => {
  const props = mergeProps(defaultProps, p) // 기본 props와 사용자 props 병합

  // 제어/비제어 컴포넌트 패턴 적용
  // 라디오 그룹은 단일 값이지만 null 처리를 위해 복잡한 로직 필요
  const [value, setValue] = usePropsValue({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: v => {
      if (v === null) return // null 값은 onChange 호출하지 않음 (선택 해제 상태)
      props.onChange?.(v) // 선택된 값만 외부로 전달
    },
  })

  return (
    <RadioGroupContext.Provider
      // TODO: 성능 최적화 필요 - 매 렌더링마다 새 객체 생성
      // 해결책: useMemo를 활용하여 value와 disabled가 변경되지 않으면 동일한 객체 유지
      value={{
        // 내부적으로는 배열 형태로 관리 (체크박스와 동일한 인터페이스 제공)
        // 단일 선택이므로 값이 있으면 [value], 없으면 [] 형태
        value: value === null ? [] : [value],
        check: v => {
          // 특정 라디오를 선택하는 함수
          setValue(v) // 새로운 값으로 설정 (기존 선택은 자동으로 해제됨)
        },
        uncheck: () => {}, // 라디오는 일반적으로 선택 해제되지 않으므로 빈 함수
        disabled: props.disabled, // 그룹 레벨의 비활성화 상태
      }}
    >
      {props.children}
    </RadioGroupContext.Provider>
  )
}
