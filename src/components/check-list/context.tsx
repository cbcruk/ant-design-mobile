// CheckList 아이템의 값 타입을 index 파일에서 import
import { CheckListValue } from '.'
// React Context API를 사용하여 컴포넌트 간 상태 공유를 위한 createContext import
import { createContext } from 'react'
// React 노드 타입 정의 (JSX 요소, 문자열, 숫자 등을 포함)
import type { ReactNode } from 'react'

// CheckList와 CheckList.Item 간 상태 공유를 위한 Context 정의
// Why: 부모-자식 컴포넌트 간 깊은 prop drilling을 방지하고 효율적인 상태 공유를 위함
// How: createContext로 Context 객체를 생성하고, null을 기본값으로 설정
export const CheckListContext = createContext<{
  value: CheckListValue[] // 현재 선택된 값들의 배열
  check: (val: CheckListValue) => void // 아이템을 선택 상태로 만드는 함수
  uncheck: (val: CheckListValue) => void // 아이템을 선택 해제 상태로 만드는 함수
  activeIcon?: ReactNode // 선택된 아이템에 표시할 아이콘 (옵셔널)
  extra?: (active: boolean) => ReactNode // 아이템 우측 영역 커스텀 렌더링 함수 (옵셔널)
  disabled?: boolean // 전체 CheckList 비활성화 상태 (옵셔널)
  readOnly?: boolean // 전체 CheckList 읽기 전용 상태 (옵셔널)
} | null>(null) // 기본값으로 null 설정 - CheckList 외부에서 사용 시 null로 감지하여 에러 방지
