import type { FC, ReactNode } from 'react'
import React from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'
import Image, { ImageProps } from '../image'
import { Fallback } from './fallback'

// 아바타 컴포넌트의 CSS 클래스 접두사
const classPrefix = 'adm-avatar'

// 아바타 컴포넌트의 Props 타입 정의
export type AvatarProps = {
  src: string
  fallback?: ReactNode
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  onClick?: (
    event: React.MouseEvent<HTMLDivElement | HTMLImageElement, Event>
  ) => void
} & Pick<ImageProps, 'alt' | 'lazy' | 'onError' | 'onLoad'> &
  NativeProps<'--size' | '--border-radius'>

// 아바타 컴포넌트의 기본 속성값들
const defaultProps = {
  fallback: <Fallback />,
  fit: 'cover',
}

// 아바타 컴포넌트 - 이미지 로딩 실패와 빈 값 처리를 강화한 안정적인 프로필 이미지 컴포넌트
// 설계 의도: 사용자 프로필 이미지는 네트워크 상황이나 데이터 품질에 따라 자주 실패하므로 안정적인 fallback 필요
export const Avatar: FC<AvatarProps> = p => {
  const props = mergeProps(defaultProps, p)

  // src 값 정리 로직: 단순해 보이지만 중요한 사용자 경험 개선
  // 문제: API에서 빈 문자열, 공백, null 등의 "빈" 이미지 URL이 올 수 있음
  // 해결: trim()으로 공백 제거 후 falsy 값 체크하여 확실한 fallback 트리거
  // 이렇게 하면 Image 컴포넌트가 "빈" URL로 요청을 시도하지 않고 즉시 fallback 표시
  const mergedSrc = props.src?.trim() || undefined

  return withNativeProps(
    props,
    // Image 컴포넌트를 래핑하여 아바타 스타일링 적용
    <Image
      className={classPrefix}
      src={mergedSrc}
      fallback={props.fallback}
      placeholder={props.fallback}
      alt={props.alt}
      lazy={props.lazy}
      fit={props.fit}
      onClick={props.onClick}
      onError={props.onError}
      onLoad={props.onLoad}
    />
  )
}
