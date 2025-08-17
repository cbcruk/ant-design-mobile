import React from 'react'
import type { FC, ReactNode } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'

// 자동 중앙 정렬 컴포넌트의 CSS 클래스 접두사
const classPrefix = 'adm-auto-center'

// 자동 중앙 정렬 컴포넌트의 Props 타입 정의
export type AutoCenterProps = { children?: ReactNode } & NativeProps

// 자동 중앙 정렬 컴포넌트 - CSS 중앙 정렬의 복잡성을 해결하는 유틸리티 컴포넌트
// 설계 의도: CSS만으로는 복잡한 중앙 정렬 시나리오에서 일관된 결과를 얻기 어려운 문제 해결
// 핵심 가치: 개발자가 레이아웃에 신경 쓰지 않고 콘텐츠에 집중할 수 있도록 추상화 제공
export const AutoCenter: FC<AutoCenterProps> = props =>
  withNativeProps(
    props,
    <div className={classPrefix}>
      {/* 이중 컨테이너 구조: 외부는 중앙 정렬 로직, 내부는 콘텐츠 래핑
          문제: 다양한 콘텐츠 크기와 부모 컨테이너 상황에서 일관된 중앙 정렬 구현의 어려움
          해결: 표준화된 CSS 기법을 컴포넌트로 캡슐화하여 재사용 가능한 중앙 정렬 솔루션 제공
          이 패턴으로 flexbox, text-align 등의 CSS 지식 없이도 안정적인 중앙 정렬 가능 */}
      <div className={`${classPrefix}-content`}>{props.children}</div>
    </div>
  )
