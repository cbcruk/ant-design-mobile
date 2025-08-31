import { createContext } from 'react'
import { RadioValue } from '.'

// 라디오 그룹의 컨텍스트 타입 정의 및 컨텍스트 생성
// 설계 배경: 체크박스 그룹 컨텍스트와 동일한 인터페이스를 제공하여 일관성 유지
// 차이점: 실제로는 단일 선택이지만 배열 형태로 관리하여 코드 재사용성 향상
export const RadioGroupContext = createContext<{
  value: RadioValue[] // 선택된 라디오 값들의 배열 (실제로는 최대 1개 요소만 포함)
  disabled: boolean // 그룹 전체의 비활성화 상태
  check: (val: RadioValue) => void // 특정 라디오를 선택하는 함수 - 다른 선택은 자동 해제
  uncheck: (val: RadioValue) => void // 선택 해제 함수 - 라디오 특성상 일반적으로 사용되지 않음
} | null>(null) // null 초기값으로 그룹 외부에서 사용되는 개별 라디오와 구분
