import classNames from 'classnames'
import type { CSSProperties, FC, ReactNode } from 'react'
import React from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'

// 카드 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-card`

// 카드 컴포넌트의 Props 타입 정의
export type CardProps = {
  title?: ReactNode
  icon?: ReactNode
  extra?: ReactNode
  headerStyle?: CSSProperties
  headerClassName?: string
  bodyStyle?: CSSProperties
  bodyClassName?: string
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onBodyClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onHeaderClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  children?: ReactNode
} & NativeProps

// 카드 컴포넌트 - 정보 그룹핑과 시각적 계층 구조를 제공하는 범용 컨테이너
// 설계 의도: 복잡한 정보를 시각적으로 구분하고 사용자의 스캔 가능성을 높이는 UI 패턴
// 핵심 특징: 헤더와 바디의 독립적 렌더링으로 다양한 카드 레이아웃 지원
export const Card: FC<CardProps> = props => {
  // 헤더 렌더링 로직: 조건부 렌더링으로 불필요한 DOM 생성 방지
  // 문제: 빈 헤더가 렌더링되면 불필요한 여백과 스타일이 적용됨
  // 해결: title과 extra 모두 없을 때는 헤더 자체를 렌더링하지 않아 깔끔한 레이아웃 유지
  const renderHeader = () => {
    if (!(props.title || props.extra)) {
      return null
    }
    return (
      <div
        className={classNames(`${classPrefix}-header`, props.headerClassName)}
        style={props.headerStyle}
        onClick={props.onHeaderClick}
      >
        {/* 아이콘 영역: 선택적 렌더링으로 아이콘이 있는 경우에만 DOM 생성
            이 패턴으로 CSS 레이아웃 계산 최적화 */}
        {props.icon && (
          <div className={`${classPrefix}-header-icon`}>{props.icon}</div>
        )}
        {/* 제목 영역: 항상 렌더링하여 일관된 레이아웃 기준점 제공 */}
        <div className={`${classPrefix}-header-title`}>{props.title}</div>
        {/* 추가 콘텐츠 영역: 우측 정렬 액션 버튼이나 부가 정보 표시용
            조건부 렌더링으로 flexbox 레이아웃의 공간 분배 최적화 */}
        {props.extra && (
          <div className={`${classPrefix}-header-extra`}>{props.extra}</div>
        )}
      </div>
    )
  }

  // 바디 렌더링 로직: 콘텐츠 존재 여부 기반 렌더링
  // 문제: 헤더만 있는 카드의 경우 빈 바디가 렌더링되어 불필요한 여백 발생
  // 해결: children 존재 여부로 바디 렌더링을 제어하여 헤더 전용 카드 지원
  const renderBody = () => {
    if (!props.children) {
      return null
    }
    return (
      <div
        className={classNames(`${classPrefix}-body`, props.bodyClassName)}
        style={props.bodyStyle}
        onClick={props.onBodyClick}
      >
        {props.children}
      </div>
    )
  }

  return withNativeProps(
    props,
    <div className={classPrefix} onClick={props.onClick}>
      {/* 헤더 영역 렌더링 */}
      {renderHeader()}
      {/* 바디 영역 렌더링 */}
      {renderBody()}
    </div>
  )
}
