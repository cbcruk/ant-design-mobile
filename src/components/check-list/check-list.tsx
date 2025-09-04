// CheckList 컴포넌트의 기본 선택 아이콘으로 사용되는 체크 아웃라인 아이콘
import { CheckOutline } from 'antd-mobile-icons'
// React 핵심 타입 정의: 함수형 컴포넌트와 React 노드 타입
import type { FC, ReactNode } from 'react'
import React from 'react'
// 네이티브 HTML 속성 지원을 위한 유틸리티 (className, style 등)
import { NativeProps, withNativeProps } from '../../utils/native-props'
// 제어/비제어 컴포넌트 패턴을 자동으로 처리하는 커스텀 훅
import { usePropsValue } from '../../utils/use-props-value'
// props 병합 유틸리티: 기본값 < 컨텍스트 설정 < 사용자 props 순으로 우선순위 적용
import { mergeProps } from '../../utils/with-default-props'
// 전역 설정 공급자에서 컴포넌트별 설정을 가져오는 훅
import { useConfig } from '../config-provider'
// CheckList의 기반이 되는 List 컴포넌트와 관련 타입
import List, { ListProps } from '../list'
// CheckList와 CheckList.Item 간 상태 공유를 위한 Context
import { CheckListContext } from './context'

// CSS 클래스 네이밍의 일관성을 위한 접두어 정의
const classPrefix = 'adm-check-list'

// CheckList 아이템의 값으로 허용되는 타입: 문자열 또는 숫자
// Why: 다양한 데이터 타입을 지원하면서도 타입 안정성 확보
export type CheckListValue = string | number

// CheckList 컴포넌트의 props 인터페이스 정의
// Pick을 사용하여 List 컴포넌트의 일부 props를 상속받아 일관성 유지
export type CheckListProps = Pick<ListProps, 'mode' | 'style'> & {
  defaultValue?: CheckListValue[] // 비제어 컴포넌트 모드의 초기 선택값
  value?: CheckListValue[] // 제어 컴포넌트 모드의 현재 선택값
  onChange?: (val: CheckListValue[]) => void // 선택값 변경 시 호출되는 콜백 함수
  multiple?: boolean // 다중 선택 허용 여부 (기본값: false)
  activeIcon?: ReactNode // 선택된 아이템에 표시될 아이콘
  extra?: (active: boolean) => ReactNode // 아이템 우측 영역 커스텀 렌더링 함수
  disabled?: boolean // 전체 컴포넌트 비활성화 여부
  readOnly?: boolean // 전체 컴포넌트 읽기 전용 모드 여부
  children?: ReactNode // CheckList.Item들을 포함한 자식 요소
} & NativeProps

// 컴포넌트의 기본 props 값 정의
// Why: 필수가 아닌 props에 대해 합리적인 기본값을 제공하여 사용 편의성 향상
const defaultProps = {
  multiple: false, // 기본값: 단일 선택 모드
  defaultValue: [], // 기본값: 아무것도 선택되지 않은 상태
  activeIcon: <CheckOutline />, // 기본값: antd-mobile-icons의 체크 아웃라인 아이콘
}

// CheckList 메인 컴포넌트: 체크 가능한 목록을 렌더링하는 함수형 컴포넌트
export const CheckList: FC<CheckListProps> = props => {
  // ConfigProvider에서 CheckList 관련 전역 설정을 가져옴 (없으면 빈 객체로 기본값 설정)
  // Why: 앱 전체에서 일관된 CheckList 설정을 적용할 수 있도록 함
  const { checkList: componentConfig = {} } = useConfig()

  // props 우선순위 적용: 기본값 < 전역설정 < 사용자props 순으로 병합
  // How: mergeProps 유틸리티가 자동으로 우선순위를 처리하여 최종 props 생성
  const mergedProps = mergeProps(defaultProps, componentConfig, props)

  // 제어/비제어 컴포넌트 패턴을 자동으로 처리하는 상태 관리
  // Why: value/defaultValue props에 따라 자동으로 내부상태 또는 외부상태 사용
  // How: usePropsValue 훅이 value 존재 여부를 확인하여 적절한 상태 관리 방식 선택
  const [value, setValue] = usePropsValue(mergedProps)

  // 아이템을 선택 상태로 만드는 함수
  // Why: CheckList.Item에서 호출하여 선택 상태를 업데이트하기 위함
  function check(val: CheckListValue) {
    if (mergedProps.multiple) {
      // 다중 선택 모드: 기존 선택값 배열에 새 값을 추가
      // How: 스프레드 연산자로 불변성을 유지하면서 새 배열 생성
      setValue([...value, val])
    } else {
      // 단일 선택 모드: 새 값만 포함하는 배열로 대체
      // How: 기존 선택값을 모두 지우고 새 값으로만 구성된 배열 설정
      setValue([val])
    }
  }

  // 아이템을 선택 해제 상태로 만드는 함수
  // Why: 이미 선택된 아이템을 다시 클릭했을 때 선택 해제하기 위함
  // How: filter 메서드로 해당 값을 제외한 새 배열 생성하여 불변성 유지
  function uncheck(val: CheckListValue) {
    setValue(value.filter(item => item !== val))
  }

  // mergedProps에서 Context로 전달할 속성들을 구조분해할당으로 추출
  // Why: CheckList.Item에서 필요한 설정들을 Context를 통해 공유하기 위함
  const { activeIcon, extra, disabled, readOnly } = mergedProps

  return (
    // Context Provider로 하위 CheckList.Item들에게 상태와 함수들을 전달
    // Why: prop drilling을 방지하고 깊은 계층의 자식 컴포넌트들이 쉽게 상태에 접근할 수 있도록 함
    <CheckListContext.Provider
      value={{
        value, // 현재 선택된 값들의 배열
        check, // 아이템 선택 함수
        uncheck, // 아이템 선택 해제 함수
        activeIcon, // 선택된 아이템에 표시할 아이콘
        extra, // 아이템 우측 영역 커스텀 렌더링 함수
        disabled, // 전체 비활성화 상태
        readOnly, // 전체 읽기 전용 상태
      }}
    >
      {/* withNativeProps로 네이티브 HTML 속성(className, style 등)을 적용 */}
      {/* Why: 사용자가 추가한 className, style 등의 네이티브 속성을 컴포넌트에 적용하기 위함 */}
      {withNativeProps(
        mergedProps,
        // List 컴포넌트를 기반으로 CheckList UI 구조 생성
        // Why: 기존 List 컴포넌트의 스타일과 기능을 재사용하여 일관성 유지
        <List mode={mergedProps.mode} className={classPrefix}>
          {/* 사용자가 전달한 CheckList.Item들을 렌더링 */}
          {mergedProps.children}
        </List>
      )}
    </CheckListContext.Provider>
  )
}
