// Native Props 유틸리티: React 컴포넌트에 네이티브 HTML 속성을 안전하게 전달하는 시스템
// Why: 컴포넌트 라이브러리에서 사용자가 임의의 HTML 속성을 전달할 수 있도록 하면서 타입 안정성 보장
// How: TypeScript 제네릭과 고차 함수를 활용한 속성 병합 및 필터링

import classNames from 'classnames' // CSS 클래스 병합 유틸리티
import type { CSSProperties, ReactElement } from 'react'
import React, { AriaAttributes } from 'react'

// NativeProps 타입 정의: 컴포넌트가 받을 수 있는 네이티브 HTML 속성들
// Why: 사용자가 컴포넌트에 표준 HTML 속성을 자유롭게 전달할 수 있도록 함
// How: 제네릭 S로 CSS 커스텀 속성까지 타입 안전하게 지원
export type NativeProps<S extends string = never> = {
  className?: string // CSS 클래스명
  style?: CSSProperties & Partial<Record<S, string>> // 인라인 스타일 + 커스텀 CSS 속성
  tabIndex?: number // 탭 순서 제어
} & AriaAttributes // 접근성 속성 전체 포함

// Native Props 적용 함수: 사용자 제공 네이티브 속성을 기존 React 요소에 병합
// Why: 컴포넌트 내부에서 생성한 요소에 사용자가 전달한 속성을 안전하게 합성
// How: React.cloneElement를 활용한 요소 복제 및 속성 병합
export function withNativeProps<P extends NativeProps>(
  props: P, // 사용자가 전달한 네이티브 속성들
  element: ReactElement // 속성을 적용할 대상 React 요소
) {
  // 기존 요소의 props를 복사하여 새로운 props 객체 생성
  // Why: 기존 속성을 보존하면서 사용자 속성을 추가하기 위함
  const p = {
    ...element.props,
  }

  // CSS 클래스명 병합: 기존 클래스와 사용자 클래스를 안전하게 결합
  // Why: 컴포넌트 내부 스타일과 사용자 커스텀 스타일을 모두 적용하기 위함
  // How: classNames 유틸리티로 중복 제거 및 조건부 클래스 처리
  if (props.className) {
    p.className = classNames(element.props.className, props.className)
  }

  // 인라인 스타일 병합: 객체 스프레드로 스타일 속성 결합
  // Why: 사용자 스타일이 컴포넌트 기본 스타일을 오버라이드하도록 함
  // How: 사용자 스타일을 나중에 적용하여 우선순위 보장
  if (props.style) {
    p.style = {
      ...p.style, // 기존 스타일 (낮은 우선순위)
      ...props.style, // 사용자 스타일 (높은 우선순위)
    }
  }

  // tabIndex 속성 처리: 접근성과 키보드 네비게이션 제어
  // Why: undefined와 0을 구분하여 명시적인 탭 순서 설정 지원
  if (props.tabIndex !== undefined) {
    p.tabIndex = props.tabIndex
  }

  // Data 및 Aria 속성 필터링 및 전달
  // Why: HTML5 data-* 속성과 WCAG 접근성 aria-* 속성만 안전하게 전달
  // How: 속성명 접두사 검사로 보안 위험이 있는 속성 차단
  for (const key in props) {
    if (!props.hasOwnProperty(key)) continue // 상속받은 속성 제외

    // 안전한 속성만 선별적으로 전달
    // data-*: HTML5 커스텀 데이터 속성 (예: data-testid, data-track)
    // aria-*: WCAG 접근성 속성 (예: aria-label, aria-expanded)
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      p[key] = props[key]
    }
  }

  // 수정된 props로 새로운 React 요소 생성
  // Why: 기존 요소의 타입과 구조는 유지하면서 속성만 업데이트
  // How: React.cloneElement로 불변성을 유지한 요소 복제
  return React.cloneElement(element, p)
}
