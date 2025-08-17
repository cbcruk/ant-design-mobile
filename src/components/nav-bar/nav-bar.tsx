import { LeftOutline } from 'antd-mobile-icons'
import classNames from 'classnames'
import type { FC, ReactNode } from 'react'
import React from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProp, mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'

// CSS 클래스 접두사: 네비게이션 바 컴포넌트의 스타일링 네임스페이스
// why: CSS 클래스 충돌 방지와 일관된 네이밍 규칙 적용
const classPrefix = `adm-nav-bar`

// NavBar 컴포넌트 Props 타입 정의
// why: 모바일 앱의 상단 네비게이션 바 구현을 위한 유연한 속성들을 타입 안전하게 정의
// how: 뒤로가기, 제목, 좌우 버튼 영역을 지원하며 높이와 하단 테두리를 CSS 변수로 커스터마이징 가능
export type NavBarProps = {
  back?: ReactNode // 뒤로가기 버튼 텍스트 또는 커스텀 요소
  backIcon?: boolean | ReactNode // 뒤로가기 아이콘: true(기본 아이콘), false(숨김), 커스텀 요소
  /**
   * @deprecated use `backIcon` instead
   */
  backArrow?: boolean | ReactNode // 구버전 호환성을 위한 뒤로가기 화살표 (backIcon 사용 권장)
  left?: ReactNode // 좌측 영역 커스텀 콘텐츠
  right?: ReactNode // 우측 영역 커스텀 콘텐츠 (메뉴, 버튼 등)
  onBack?: () => void // 뒤로가기 버튼 클릭 시 호출되는 콜백 함수
  children?: ReactNode // 네비게이션 바 제목 영역 콘텐츠
} & NativeProps<'--height' | '--border-bottom'>

// 기본 뒤로가기 아이콘: 왼쪽 화살표 아웃라인
// why: 모바일 앱의 표준 뒤로가기 패턴을 따르는 직관적인 아이콘 제공
const defaultBackIcon = <LeftOutline />

// NavBar 메인 컴포넌트: 모바일 앱 상단 네비게이션 바 구현
// why: iOS/Android 앱의 표준 네비게이션 패턴을 웹에서 재현하여 일관된 UX 제공
// how: 좌측(뒤로가기), 중앙(제목), 우측(액션) 영역으로 구성된 3분할 레이아웃
export const NavBar: FC<NavBarProps> = props => {
  // 전역 설정 가져오기: ConfigProvider에서 정의된 네비게이션 바 기본 설정
  // why: 앱 전체에서 일관된 네비게이션 바 스타일과 동작을 보장하기 위함
  const { navBar: componentConfig = {} } = useConfig()

  // Props 병합: 전역 설정과 컴포넌트별 Props를 조합
  // why: 전역 기본값을 유지하면서도 개별 컴포넌트에서 오버라이드 가능
  const mergedProps = mergeProps(componentConfig, props)
  const { back, backIcon, backArrow } = mergedProps

  // 병합된 기본 뒤로가기 아이콘: 전역 설정 또는 기본 아이콘 선택
  // why: ConfigProvider에서 앱 전체의 뒤로가기 아이콘을 커스터마이징 가능
  const mergedDefaultBackIcon = componentConfig.backIcon || defaultBackIcon

  // 뒤로가기 아이콘 우선순위 결정: 복잡한 Props 병합 로직
  // why: backIcon/backArrow의 호환성과 boolean/ReactNode 타입 혼재를 안전하게 처리
  // how: mergeProp으로 우선순위 체인을 구성하여 최종 아이콘 결정
  const mergedBackIcon = mergeProp<ReactNode>(
    defaultBackIcon, // 1순위: 기본 아이콘
    componentConfig.backIcon, // 2순위: 전역 설정 아이콘
    backArrow === true ? mergedDefaultBackIcon : backArrow, // 3순위: backArrow prop (호환성)
    backIcon === true ? mergedDefaultBackIcon : backIcon // 4순위: backIcon prop (최신)
  )

  // 컴포넌트 렌더링: 네이티브 Props와 함께 네비게이션 바 구조 생성
  // why: withNativeProps로 CSS 변수와 클래스명을 안전하게 적용
  return withNativeProps(
    mergedProps,
    <div className={classNames(classPrefix)}>
      {/* 좌측 영역: 뒤로가기 버튼과 커스텀 좌측 콘텐츠 */}
      {/* role='button': 스크린 리더에서 버튼으로 인식하도록 접근성 향상 */}
      <div className={`${classPrefix}-left`} role='button'>
        {/* 뒤로가기 버튼 렌더링: back prop이 null이 아닐 때만 표시 */}
        {/* why: back=null로 설정하면 뒤로가기 기능을 완전히 숨길 수 있음 */}
        {back !== null && (
          <div className={`${classPrefix}-back`} onClick={mergedProps.onBack}>
            {/* 뒤로가기 아이콘 렌더링: 병합된 아이콘이 존재할 때만 표시 */}
            {/* why: 아이콘 없이 텍스트만 표시하는 경우도 지원 */}
            {mergedBackIcon && (
              <span className={`${classPrefix}-back-arrow`}>
                {mergedBackIcon}
              </span>
            )}
            {/* 뒤로가기 텍스트: aria-hidden으로 스크린 리더에서 중복 읽기 방지 */}
            {/* why: 아이콘이 이미 뒤로가기 의미를 전달하므로 텍스트는 시각적 보조용 */}
            <span aria-hidden='true'>{back}</span>
          </div>
        )}
        {/* 좌측 커스텀 콘텐츠: 뒤로가기 외의 추가 요소들 */}
        {mergedProps.left}
      </div>

      {/* 중앙 제목 영역: 현재 페이지나 섹션의 제목 표시 */}
      {/* why: 모바일 네비게이션의 핵심 요소인 컨텍스트 정보 제공 */}
      <div className={`${classPrefix}-title`}>{mergedProps.children}</div>

      {/* 우측 액션 영역: 메뉴, 검색, 설정 등의 버튼들 */}
      {/* why: 페이지별 주요 액션들을 쉽게 접근할 수 있는 위치에 배치 */}
      <div className={`${classPrefix}-right`}>{mergedProps.right}</div>
    </div>
  )
}
