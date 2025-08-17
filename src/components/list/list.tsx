import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { ReactNode } from 'react'
import classNames from 'classnames'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'

// 리스트 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-list`

export type ListProps = {
  header?: ReactNode
  mode?: 'default' | 'card' // 默认是整宽的列表，card 模式下展示为带 margin 和圆角的卡片
  children?: ReactNode
} & NativeProps<
  | '--active-background-color'
  | '--align-items'
  | '--border-bottom'
  | '--border-inner'
  | '--border-top'
  | '--extra-max-width'
  | '--font-size'
  | '--header-font-size'
  | '--padding-left'
  | '--padding-right'
  | '--prefix-padding-right'
  | '--prefix-width'
>

const defaultProps = {
  mode: 'default',
}

export type ListRef = {
  nativeElement: HTMLDivElement | null
}

// 리스트 컴포넌트 - 계층적 정보 구조화와 다양한 표시 모드를 지원하는 컨테이너
// 설계 의도: iOS/Android의 네이티브 리스트 패턴을 웹에서 구현하여 친숙한 사용자 경험 제공
// 핵심 특징: default(전체 너비)와 card(여백+모서리) 모드로 다양한 디자인 요구사항 대응
export const List = forwardRef<ListRef, ListProps>((p, ref) => {
  const props = mergeProps(defaultProps, p)
  const nativeElementRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    get nativeElement() {
      return nativeElementRef.current
    },
  }))

  return withNativeProps(
    props,
    <div
      className={classNames(classPrefix, `${classPrefix}-${props.mode}`)}
      ref={nativeElementRef}
    >
      {/* 헤더의 조건부 렌더링: 섹션 구분과 정보 계층화를 위한 선택적 요소
          헤더가 없는 경우 불필요한 DOM 요소와 스타일 오버헤드 방지 */}
      {props.header && (
        <div className={`${classPrefix}-header`}>{props.header}</div>
      )}
      {/* 이중 래핑 구조: 외부 스타일링과 내부 콘텐츠 스타일링 분리
          body: 전체 리스트의 컨테이너 스타일 (배경, 테두리 등)
          body-inner: 실제 리스트 아이템들의 레이아웃 (패딩, 간격 등)
          이 분리로 mode별 차별화된 스타일링과 유지보수성 확보 */}
      <div className={`${classPrefix}-body`}>
        <div className={`${classPrefix}-body-inner`}>{props.children}</div>
      </div>
    </div>
  )
})
