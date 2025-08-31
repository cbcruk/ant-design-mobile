import { createContext } from 'react'
import { CheckboxValue } from '.'

// 체크박스 그룹의 컨텍스트 타입 정의 및 컨텍스트 생성
// 목적: 체크박스 그룹과 개별 체크박스 간의 상태 공유 및 통신 채널 제공
// 설계 배경: React Context API를 활용하여 prop drilling 없이 깊은 컴포넌트 계층에서도 그룹 상태에 접근 가능
export const CheckboxGroupContext = createContext<{
  value: CheckboxValue[] // 현재 선택된 체크박스들의 value 배열 - 다중 선택 상태를 배열로 관리
  disabled: boolean // 그룹 전체의 비활성화 상태 - 개별 체크박스의 disabled보다 우선순위가 높음
  check: (val: CheckboxValue) => void // 특정 값을 체크 상태로 변경하는 함수 - 배열에 값 추가
  uncheck: (val: CheckboxValue) => void // 특정 값을 언체크 상태로 변경하는 함수 - 배열에서 값 제거
} | null>(null) // null 초기값으로 그룹 컨텍스트 외부에서 사용되는 개별 체크박스와 구분
