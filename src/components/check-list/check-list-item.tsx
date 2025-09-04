// React의 Context 기능과 함수형 컴포넌트 타입을 사용하기 위한 import
import React, { useContext } from 'react'
import type { FC } from 'react'
// CheckList.Item의 기반이 되는 List 컴포넌트와 관련 타입
import List, { ListItemProps } from '../list'
// 네이티브 HTML 속성 지원을 위한 유틸리티 (className, style 등)
import { NativeProps, withNativeProps } from '../../utils/native-props'
// 부모 CheckList 컴포넌트와의 상태 공유를 위한 Context
import { CheckListContext } from './context'
// 개발 모드에서 잘못된 사용에 대한 경고를 표시하는 유틸리티
import { devWarning } from '../../utils/dev-log'
// 조건부 CSS 클래스 적용을 위한 라이브러리
import classNames from 'classnames'
// CheckList 아이템의 값 타입 정의
import { CheckListValue } from '.'

// CSS 클래스 네이밍의 일관성을 위한 접두어 정의
const classPrefix = `adm-check-list-item`

// CheckList.Item 컴포넌트의 props 인터페이스 정의
// Pick을 사용하여 ListItem의 필요한 props만 선택적으로 상속
// Why: 코드 중복을 피하고 List.Item과의 일관성을 유지하기 위함
export type CheckListItemProps = Pick<
  ListItemProps,
  | 'title' // 아이템의 주 제목 텍스트
  | 'children' // 아이템 내용 (title 대신 사용 가능)
  | 'description' // 아이템의 부 설명 텍스트
  | 'prefix' // 아이템 왼쪽에 표시될 요소 (아이콘 등)
  | 'disabled' // 개별 아이템 비활성화 여부
  | 'onClick' // 사용자 정의 클릭 이벤트 핸들러
  | 'style' // 인라인 스타일 객체
> & {
  value: CheckListValue // 필수: 아이템의 고유 식별값 (선택 상태 관리에 사용)
  readOnly?: boolean // 개별 아이템의 읽기 전용 모드 (전역 설정보다 우선)
} & NativeProps

// CheckList.Item 컴포넌트: 개별 체크 가능한 목록 아이템을 렌더링하는 함수형 컴포넌트
export const CheckListItem: FC<CheckListItemProps> = props => {
  // 부모 CheckList로부터 Context를 통해 공유 상태와 함수들을 가져옴
  // Why: prop drilling을 피하고 깊은 계층에서도 쉽게 상태에 접근하기 위함
  const context = useContext(CheckListContext)

  // Context가 null인 경우 = CheckList 외부에서 CheckList.Item을 사용한 잘못된 사용
  // Why: CheckList.Item은 반드시 CheckList 내부에서만 사용되어야 하므로 안전장치 필요
  if (context === null) {
    // 개발 모드에서 경고 메시지를 출력하여 개발자에게 잘못된 사용을 알림
    devWarning(
      'CheckList.Item',
      'CheckList.Item can only be used inside CheckList.'
    )
    // 잘못된 사용 시 null을 반환하여 아무것도 렌더링하지 않음
    return null
  }

  // 현재 아이템이 선택된 상태인지 확인
  // How: Context의 선택값 배열에 현재 아이템의 value가 포함되어 있는지 검사
  const active = context.value.includes(props.value)

  // 읽기 전용 모드 결정: 개별 아이템 설정이 전역 설정보다 우선
  // Why: 세밀한 제어를 위해 아이템별로 다른 readOnly 설정을 허용
  const readOnly = props.readOnly || context.readOnly

  // 기본 extra 영역 결정: 활성 상태에 따라 아이콘 표시 여부 결정
  // How: 활성 상태면 activeIcon 표시, 비활성 상태면 null (아무것도 표시 안함)
  const defaultExtra = active ? context.activeIcon : null

  // 최종 extra 영역 렌더링 내용 결정
  // Why: 사용자 정의 extra 함수가 있으면 우선 사용, 없으면 기본 아이콘 사용
  // How: context.extra 함수가 있으면 active 상태를 인자로 전달하여 호출
  const renderExtra = context.extra ? context.extra(active) : defaultExtra

  // extra 영역을 감싸는 div 요소 생성
  // Why: 일관된 스타일링과 레이아웃을 위해 전용 CSS 클래스가 적용된 wrapper 필요
  const extra = <div className={`${classPrefix}-extra`}>{renderExtra}</div>

  // 최종 JSX 반환: withNativeProps로 네이티브 HTML 속성을 적용한 List.Item
  return withNativeProps(
    props,
    <List.Item
      title={props.title}
      // 동적 CSS 클래스 적용: 기본 클래스 + 상태별 조건부 클래스
      // Why: 상태에 따른 시각적 피드백을 CSS로 제공하기 위함
      className={classNames(
        classPrefix, // 기본 클래스
        readOnly && `${classPrefix}-readonly`, // 읽기전용 상태 클래스
        active && `${classPrefix}-active` // 선택 상태 클래스
      )}
      description={props.description}
      prefix={props.prefix}
      // 클릭 이벤트 핸들러: 토글 동작과 사용자 정의 이벤트 처리
      onClick={e => {
        // 읽기 전용 모드에서는 클릭 무시
        // Why: 읽기 전용 상태에서는 선택 상태 변경을 허용하지 않음
        if (readOnly) return

        if (active) {
          // 현재 선택된 상태면 선택 해제
          // How: Context의 uncheck 함수를 호출하여 현재 value를 선택 목록에서 제거
          context.uncheck(props.value)
        } else {
          // 현재 선택되지 않은 상태면 선택
          // How: Context의 check 함수를 호출하여 현재 value를 선택 목록에 추가
          context.check(props.value)
        }

        // 사용자가 제공한 커스텀 onClick 핸들러가 있으면 실행
        // Why: CheckList의 기본 동작과 함께 사용자 정의 로직도 수행할 수 있도록 함
        // How: optional chaining(?.)으로 안전하게 호출
        props.onClick?.(e)
      }}
      arrow={false} // List.Item의 우측 화살표 숨김
      clickable={!readOnly} // 읽기전용이 아닐 때만 클릭 가능하도록 설정
      extra={extra} // 우측 영역에 체크 아이콘 또는 커스텀 요소 표시
      disabled={props.disabled || context.disabled} // 개별 또는 전역 비활성화 상태 적용
    >
      {/* List.Item의 주 내용 영역에 사용자 제공 children 렌더링 */}
      {props.children}
    </List.Item>
  )
}
