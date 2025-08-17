import type { ReactNode } from 'react'
import React, { useEffect, useRef, useState } from 'react'
import { staged } from 'staged-components'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { toCSSLength } from '../../utils/to-css-length'
import { useIsomorphicUpdateLayoutEffect } from '../../utils/use-isomorphic-update-layout-effect'
import { mergeProps } from '../../utils/with-default-props'
import { BrokenImageIcon } from './broken-image-icon'
import { ImageIcon } from './image-icon'
import { LazyDetector } from './lazy-detector'

const classPrefix = `adm-image`

export type ImageProps = {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  placeholder?: ReactNode
  fallback?: ReactNode
  lazy?: boolean
  draggable?: boolean
  onClick?: (event: React.MouseEvent<HTMLImageElement, Event>) => void
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onContainerClick?: (event: React.MouseEvent<HTMLDivElement, Event>) => void
} & NativeProps<'--width' | '--height'> &
  Pick<
    React.ImgHTMLAttributes<HTMLImageElement>,
    | 'crossOrigin'
    | 'decoding'
    | 'loading'
    | 'referrerPolicy'
    | 'sizes'
    | 'srcSet'
    | 'useMap'
    | 'id'
  >

const defaultProps = {
  fit: 'fill',
  placeholder: (
    <div className={`${classPrefix}-tip`}>
      <ImageIcon />
    </div>
  ),
  fallback: (
    <div className={`${classPrefix}-tip`}>
      <BrokenImageIcon />
    </div>
  ),
  lazy: false,
  draggable: false,
}

// 이미지 컴포넌트 - 성능 최적화와 사용자 경험을 고려한 고도화된 이미지 로딩 시스템
// 설계 의도: 네트워크 대역폭 절약과 페이지 로딩 성능 향상을 위한 lazy loading과 다양한 상태 처리
// 핵심 특징: lazy loading, placeholder/fallback 시스템, 다양한 fit 모드, SSR 대응
export const Image = staged<ImageProps>(p => {
  const props = mergeProps(defaultProps, p)

  // 이미지 로딩 상태 관리: 네트워크 요청의 세 가지 상태를 추적
  const [loaded, setLoaded] = useState(false) // 로딩 완료 상태
  const [failed, setFailed] = useState(false) // 로딩 실패 상태

  const ref = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  let src: string | undefined = props.src
  let srcSet: string | undefined = props.srcSet

  // lazy loading 초기화 상태: 성능 최적화의 핵심 메커니즘
  // 문제: 페이지에 많은 이미지가 있을 때 모든 이미지를 동시에 로드하면 성능 저하
  // 해결: lazy가 true인 경우 초기에는 이미지 로드를 지연하고, 뷰포트에 들어올 때 로드 시작
  const [initialized, setInitialized] = useState(!props.lazy)

  // lazy loading이 활성화된 경우 실제 src/srcSet을 조건부로 설정
  // initialized가 false인 동안은 이미지 요청을 하지 않아 대역폭 절약
  src = initialized ? props.src : undefined
  srcSet = initialized ? props.srcSet : undefined

  // src 변경 시 상태 초기화: 새로운 이미지 로딩을 위한 상태 리셋
  useIsomorphicUpdateLayoutEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  useEffect(() => {
    // Next.js SSR 환경 대응: 서버에서 렌더링된 이미지가 이미 완료된 경우 처리
    // 문제: SSR 후 하이드레이션 시 이미지가 이미 로드되어 있지만 state는 false인 상태
    // 해결: 마운트 시점에 이미지의 complete 상태를 확인하여 동기화
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [])

  // 이미지 렌더링 로직: 상태에 따른 조건부 렌더링의 복합적 구현
  function renderInner() {
    // 실패 상태이거나 소스가 없는 경우 fallback 표시
    if (failed || (src === undefined && !srcSet)) {
      return <>{props.fallback}</>
    }

    const img = (
      <img
        ref={imgRef}
        id={props.id}
        className={`${classPrefix}-img`}
        src={src}
        alt={props.alt}
        onClick={props.onClick}
        onLoad={e => {
          setLoaded(true)
          props.onLoad?.(e)
        }}
        onError={e => {
          setFailed(true)
          props.onError?.(e)
        }}
        style={{
          objectFit: props.fit,
          // 로딩 완료 전까지 이미지 숨김으로 layout shift 방지
          // 문제: 이미지가 로드되는 동안 레이아웃이 점프하는 현상
          // 해결: placeholder와 이미지를 겹쳐두고 로딩 완료 시에만 이미지 표시
          display: loaded ? 'block' : 'none',
        }}
        crossOrigin={props.crossOrigin}
        decoding={props.decoding}
        loading={props.loading}
        referrerPolicy={props.referrerPolicy}
        sizes={props.sizes}
        srcSet={srcSet}
        useMap={props.useMap}
        draggable={props.draggable}
      />
    )

    return (
      <>
        {/* placeholder와 실제 이미지의 오버레이 구조
            이 패턴으로 부드러운 로딩 경험과 레이아웃 안정성 확보 */}
        {!loaded && props.placeholder}
        {img}
      </>
    )
  }

  const style: ImageProps['style'] = {}
  if (props.width) {
    style['--width'] = toCSSLength(props.width)
    style['width'] = toCSSLength(props.width)
  }
  if (props.height) {
    style['--height'] = toCSSLength(props.height)
    style['height'] = toCSSLength(props.height)
  }
  return withNativeProps(
    props,
    <div
      ref={ref}
      className={classPrefix}
      style={style}
      onClick={props.onContainerClick}
    >
      {/* Lazy Loading 감지기: Intersection Observer 기반 뷰포트 진입 감지
          문제: 화면에 보이지 않는 이미지까지 미리 로드하면 불필요한 네트워크 사용
          해결: LazyDetector가 요소가 뷰포트에 들어오는 순간을 감지하여 로딩 시작
          이 지연 로딩으로 초기 페이지 로드 속도 향상과 데이터 사용량 절약 */}
      {props.lazy && !initialized && (
        <LazyDetector
          onActive={() => {
            setInitialized(true)
          }}
        />
      )}
      {renderInner()}
    </div>
  )
})
