import classNames from 'classnames'
import React from 'react'
import type { FC, ReactNode, CSSProperties } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'

// 배지 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-badge`

// 점(dot) 형태의 배지를 나타내는 특별한 심볼
export const dot = <React.Fragment />

// 배지 컴포넌트의 Props 타입 정의
export type BadgeProps = {
  content?: ReactNode | typeof dot
  color?: string
  bordered?: boolean
  children?: ReactNode
  wrapperClassName?: string
  wrapperStyle?: CSSProperties
} & NativeProps<'--right' | '--top' | '--color'>

// 배지 컴포넌트 - 숫자나 텍스트를 표시하는 작은 상태 표시기
export const Badge: FC<BadgeProps> = props => {
  const { content, color, children } = props

  // 점 형태의 배지인지 확인
  const isDot = content === dot

  // 배지의 CSS 클래스명 동적 생성
  const badgeClass = classNames(classPrefix, {
    [`${classPrefix}-fixed`]: !!children, // 자식 요소가 있을 때 절대 위치 적용
    [`${classPrefix}-dot`]: isDot, // 점 형태 배지 스타일
    [`${classPrefix}-bordered`]: props.bordered, // 테두리 스타일
  })

  // 배지 표시 조건 로직: 0 값의 특별한 처리가 핵심
  // 문제: JavaScript의 falsy 값 특성상 0이 false로 평가되어 숫자 0 배지가 표시되지 않음
  // 해결: content === 0 조건을 명시적으로 추가하여 "0개 알림"도 의미 있는 정보로 표시
  // 이는 읽지 않은 메시지가 0개일 때도 사용자에게 상태를 알려주는 UX 개선
  const element =
    content || content === 0
      ? withNativeProps(
          props,
          <div
            className={badgeClass}
            style={
              {
                '--color': color, // CSS 변수 활용으로 동적 테마 지원
              } as BadgeProps['style']
            }
          >
            {/* 점 배지와 텍스트 배지의 조건부 렌더링
                점 배지: 단순한 상태 표시용 (알림 유무만 표시)
                텍스트 배지: 구체적인 수치나 텍스트 표시 */}
            {!isDot && (
              <div className={`${classPrefix}-content`}>{content}</div>
            )}
          </div>
        )
      : null

  // 배지 위치 결정: 자식 요소 존재 여부에 따른 절대 위치/독립 위치 모드
  // 자식 요소가 있으면: 자식 요소의 우상단에 배지를 절대 위치로 오버레이
  // 자식 요소가 없으면: 배지만 독립적으로 표시 (인라인 배지)
  return children ? (
    <div
      className={classNames(`${classPrefix}-wrapper`, props.wrapperClassName)}
      style={props.wrapperStyle}
    >
      {children}
      {element}
    </div>
  ) : (
    element
  )
}
