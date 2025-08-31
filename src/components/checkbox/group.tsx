import React from 'react'
import type { FC, ReactNode } from 'react'
import { mergeProps } from '../../utils/with-default-props'
import { CheckboxValue } from '.'
import { CheckboxGroupContext } from './group-context'
import { usePropsValue } from '../../utils/use-props-value'

// 체크박스 그룹 컴포넌트의 Props 타입 정의
export interface CheckboxGroupProps {
  value?: CheckboxValue[] // 제어 모드: 외부에서 관리되는 선택된 값들의 배열
  onChange?: (val: CheckboxValue[]) => void // 선택 상태 변경 시 호출되는 콜백 함수
  defaultValue?: CheckboxValue[] // 비제어 모드: 초기 선택된 값들의 배열
  disabled?: boolean // 그룹 전체의 비활성화 상태 - 모든 하위 체크박스에 적용
  children?: ReactNode // 그룹 내부의 체크박스 컴포넌트들
}

// 기본 속성값 정의
const defaultProps = {
  disabled: false, // 기본적으로 활성화 상태
  defaultValue: [], // 기본적으로 아무것도 선택되지 않은 상태
}

// 체크박스 그룹 컴포넌트
// 설계 목적: 여러 체크박스를 하나의 그룹으로 관리하여 다중 선택 기능 제공
// 상태 관리: 선택된 값들을 배열로 관리하며, 개별 체크박스의 상태는 이 배열에 의해 결정
export const Group: FC<CheckboxGroupProps> = p => {
  const props = mergeProps(defaultProps, p) // 기본 props와 사용자 제공 props 병합

  // 제어/비제어 컴포넌트 패턴 적용 - value/defaultValue에 따라 자동으로 모드 결정
  const [value, setValue] = usePropsValue(props) as [
    CheckboxValue[],
    (val: CheckboxValue[]) => void,
  ]

  return (
    <CheckboxGroupContext.Provider
      // TODO: 성능 최적화 필요 - 매 렌더링마다 새 객체 생성으로 인한 불필요한 리렌더링 발생 가능
      // 해결책: useMemo를 활용하여 value가 변경되지 않으면 동일한 객체 참조 유지
      value={{
        value: value, // 현재 선택된 값들의 배열
        disabled: props.disabled, // 그룹 레벨의 비활성화 상태
        check: v => {
          // 특정 값을 선택 상태로 변경하는 함수
          setValue([...value, v]) // 기존 배열을 복사하고 새 값 추가 (불변성 유지)
        },
        uncheck: v => {
          // 특정 값을 선택 해제 상태로 변경하는 함수
          setValue(value.filter(item => item !== v)) // 해당 값을 제외한 새 배열 생성 (불변성 유지)
        },
      }}
    >
      {props.children}
    </CheckboxGroupContext.Provider>
  )
}
