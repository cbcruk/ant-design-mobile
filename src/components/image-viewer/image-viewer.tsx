import classNames from 'classnames'
import type { FC, ReactNode, RefObject } from 'react'
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  GetContainer,
  renderToContainer,
} from '../../utils/render-to-container'
import { mergeProps } from '../../utils/with-default-props'
import Mask from '../mask'
import SafeArea from '../safe-area'
import { Slide } from './slide'
import { Slides, SlidesRef } from './slides'

const classPrefix = `adm-image-viewer`

export type ImageViewerProps = {
  image: string
  maxZoom?: number | 'auto'
  getContainer?: GetContainer
  visible?: boolean
  onClose?: () => void
  afterClose?: () => void
  renderFooter?: (image: string) => ReactNode
  imageRender?: (
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
  classNames?: {
    mask?: string
    body?: string
  }
}

const defaultProps = {
  maxZoom: 3,
  getContainer: null,
  visible: false,
}

// 이미지 뷰어 컴포넌트 - 고도화된 제스처 기반 이미지 확대/축소/팬 기능을 제공하는 갤러리 뷰어
// 설계 의도: 네이티브 모바일 앱의 사진 갤러리와 동일한 부드러운 인터렉션 제공
// 핵심 특징: 매트릭스 변환 기반 확대/축소, 멀티터치 제스처, 경계 제한, 관성 스크롤
export const ImageViewer: FC<ImageViewerProps> = p => {
  const props = mergeProps(defaultProps, p)

  const node = (
    <Mask
      visible={props.visible}
      disableBodyScroll={false} // 내부에서 자체적으로 스크롤 제어
      opacity='thick' // 진한 반투명 배경으로 이미지 집중도 향상
      afterClose={props.afterClose}
      destroyOnClose // 메모리 최적화를 위한 DOM 제거
      className={props?.classNames?.mask}
    >
      <div
        className={classNames(
          `${classPrefix}-content`,
          props?.classNames?.body
        )}
      >
        {/* 단일 이미지 슬라이드: 핵심 제스처 인터렉션과 매트릭스 변환 로직 포함 */}
        {(props.image || typeof props.imageRender === 'function') && (
          <Slide
            image={props.image}
            onTap={props.onClose} // 탭 제스처로 뷰어 닫기
            maxZoom={props.maxZoom} // 최대 확대 배율 제한
            imageRender={props.imageRender} // 커스텀 이미지 렌더링 지원
          />
        )}
      </div>

      {/* 하단 정보 영역: 이미지 메타데이터나 액션 버튼 표시 */}
      {props.image && (
        <div className={`${classPrefix}-footer`}>
          {props.renderFooter?.(props.image)}
          <SafeArea position='bottom' /> {/* 노치 디바이스 대응 안전 영역 */}
        </div>
      )}
    </Mask>
  )
  return renderToContainer(props.getContainer, node)
}

export type MultiImageViewerRef = SlidesRef

export type MultiImageViewerProps = Omit<
  ImageViewerProps,
  'image' | 'renderFooter' | 'imageRender'
> & {
  images?: string[]
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  renderFooter?: (image: string, index: number) => ReactNode
  imageRender?: (
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
}

const multiDefaultProps = {
  ...defaultProps,
  defaultIndex: 0,
}

// 다중 이미지 뷰어 컴포넌트 - 스와이프 기반 이미지 갤러리와 확대/축소 기능의 통합
// 설계 의도: 여러 이미지를 자연스럽게 넘겨보면서 각각에 대해 확대/축소 가능한 갤러리
// 핵심 특징: 좌우 스와이프 네비게이션, 개별 이미지 확대/축소, 인덱스 동기화, 프로그래매틱 제어
export const MultiImageViewer = forwardRef<
  MultiImageViewerRef,
  MultiImageViewerProps
>((p, ref) => {
  const props = mergeProps(multiDefaultProps, p)

  // 현재 활성 이미지 인덱스 관리
  const [index, setIndex] = useState(props.defaultIndex)

  const slidesRef = useRef<SlidesRef>(null)

  // 외부에서 프로그래매틱하게 슬라이드 제어할 수 있는 인터페이스 제공
  useImperativeHandle(ref, () => ({
    swipeTo: (index: number, immediate?: boolean) => {
      setIndex(index)
      slidesRef.current?.swipeTo(index, immediate)
    },
  }))

  // 슬라이드 변경 콜백: 스와이프나 프로그래매틱 변경 시 인덱스 동기화
  const onSlideChange = useCallback(
    (newIndex: number) => {
      if (newIndex === index) return // 동일한 인덱스 무시 (불필요한 리렌더링 방지)
      setIndex(newIndex)
      props.onIndexChange?.(newIndex) // 외부에 변경 사항 알림
    },
    [props.onIndexChange, index]
  )

  const node = (
    <Mask
      visible={props.visible}
      disableBodyScroll={false}
      opacity='thick'
      afterClose={props.afterClose}
      destroyOnClose
      className={props?.classNames?.mask}
    >
      <div
        className={classNames(
          `${classPrefix}-content`,
          props?.classNames?.body
        )}
      >
        {props.images && (
          <Slides
            ref={slidesRef}
            defaultIndex={index}
            onIndexChange={onSlideChange}
            images={props.images}
            onTap={props.onClose}
            maxZoom={props.maxZoom}
            imageRender={props.imageRender}
          />
        )}
      </div>
      {props.images && (
        <div className={`${classPrefix}-footer`}>
          {props.renderFooter?.(props.images[index], index)}
          <SafeArea position='bottom' />
        </div>
      )}
    </Mask>
  )
  return renderToContainer(props.getContainer, node)
})
