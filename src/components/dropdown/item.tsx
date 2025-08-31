import { DownFill } from 'antd-mobile-icons' // 기본 하향 화살표 아이콘
import classNames from 'classnames'
import type { FC, ReactNode } from 'react'
import React from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { useShouldRender } from '../../utils/should-render' // 조건부 렌더링 최적화 훅
import { mergeProp, mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import { IconContext } from './context' // 아이콘 컨텍스트 - 부모로부터 아이콘 받기

// 드롭다운 아이템의 CSS 클래스 접두사
const classPrefix = `adm-dropdown-item`

// 드롭다운 아이템 컴포넌트의 Props 타입 정의
export type DropdownItemProps = {
  key: string // React key - 아이템 식별자
  title: ReactNode // 네비게이션에 표시될 제목
  active?: boolean // 현재 활성 상태 (부모 Dropdown에서 자동 주입)
  highlight?: boolean // 강조 표시 여부 (기본값은 active 상태와 동일)
  forceRender?: boolean // 내용을 미리 렌더링할지 여부 (성능 vs 초기 로딩 트레이드오프)
  destroyOnClose?: boolean // 닫힐 때 내용을 DOM에서 제거할지 여부 (메모리 최적화)
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void // 아이템 클릭 핸들러
  arrowIcon?: ReactNode // 커스텀 화살표 아이콘
  /**
   * @deprecated use `arrowIcon` instead
   */
  arrow?: ReactNode // 레거시 props - arrowIcon 사용 권장
  children?: ReactNode // 팝업에 표시될 실제 내용
} & NativeProps

// 드롭다운 아이템 컴포넌트 - 네비게이션 탭 역할
// 설계 특징: 제목과 화살표로 구성된 간단한 UI, 실제 내용은 팝업에서 별도 렌더링
const Item: FC<DropdownItemProps> = props => {
  const { dropdown: componentConfig = {} } = useConfig() // 글로벌 드롭다운 설정
  const mergedProps = mergeProps(componentConfig, props) // 설정과 props 병합
  const { active, highlight, onClick, title } = mergedProps

  // CSS 클래스 조합 - 활성 상태와 강조 상태 반영
  const cls = classNames(classPrefix, {
    [`${classPrefix}-active`]: active, // 현재 활성화된 아이템 스타일
    [`${classPrefix}-highlight`]: highlight ?? active, // 강조 스타일 (기본값은 활성 상태)
  })

  // 화살표 아이콘 우선순위 결정 로직
  // 우선순위: 개별 props > 컨텍스트 > 레거시 props > 기본 아이콘
  const contextArrowIcon = React.useContext(IconContext) // 부모 Dropdown에서 제공된 아이콘
  const mergedArrowIcon = mergeProp(
    <DownFill />, // 기본 하향 화살표 아이콘
    contextArrowIcon, // 드롭다운 레벨에서 설정된 아이콘
    mergedProps.arrow, // 레거시 props
    mergedProps.arrowIcon // 새로운 props (최우선)
  )

  return withNativeProps(
    props,
    <div className={cls} onClick={onClick}>
      <div className={`${classPrefix}-title`}>
        <span className={`${classPrefix}-title-text`}>{title}</span>
        <span
          className={classNames(`${classPrefix}-title-arrow`, {
            [`${classPrefix}-title-arrow-active`]: active, // 활성 상태일 때 화살표 회전 애니메이션
          })}
        >
          {mergedArrowIcon}
        </span>
      </div>
    </div>
  )
}

export default Item

// 드롭다운 아이템의 내용을 래핑하는 컴포넌트의 Props 타입
type DropdownItemChildrenWrapProps = {
  onClick?: () => void // 내용 클릭 시 실행될 핸들러
} & Pick<
  DropdownItemProps,
  'active' | 'forceRender' | 'destroyOnClose' | 'children'
>

// 드롭다운 아이템의 내용 래퍼 컴포넌트
// 설계 목적: 렌더링 최적화와 애니메이션을 위한 조건부 렌더링 제어
// 복잡한 렌더링 로직: 성능(지연 로딩) vs 사용자 경험(즉시 표시) 균형
export const ItemChildrenWrap: FC<DropdownItemChildrenWrapProps> = props => {
  const { active = false } = props

  // 렌더링 여부 결정 로직
  // - active: 현재 활성 상태
  // - forceRender: 강제 렌더링 (초기 로딩 시간은 늘어나지만 전환 속도 향상)
  // - destroyOnClose: 비활성화 시 DOM에서 제거 (메모리 절약)
  const shouldRender = useShouldRender(
    active,
    props.forceRender,
    props.destroyOnClose
  )

  // CSS 클래스 - 활성 상태에 따른 표시/숨김 제어
  const cls = classNames(`${classPrefix}-content`, {
    [`${classPrefix}-content-hidden`]: !active, // 비활성 상태일 때 숨김 (CSS로 제어)
  })

  // 조건부 렌더링: shouldRender가 false면 null 반환하여 DOM에서 완전 제거
  return shouldRender ? (
    <div className={cls} onClick={props.onClick}>
      {props.children} {/* 실제 드롭다운 내용 */}
    </div>
  ) : null
}
