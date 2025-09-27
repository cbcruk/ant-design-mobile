// 의존성 분석:
// - classNames: 조건부 CSS 클래스 결합 (동적 스타일링)
// - React: 핵심 리액트 타입과 훅들 (컴포넌트 라이프사이클과 상태 관리)
// - render-to-container: 포탈 기반 컨테이너 렌더링 (모달 오버레이 구현)
// - with-default-props: props 기본값 병합 (타입 안전성과 편의성)
// - Mask: 전체화면 오버레이 컴포넌트 (배경 차단 및 포커스 관리)
// - SafeArea: 모바일 노치/Dynamic Island 대응 (하드웨어 안전 영역)
// - Slide/Slides: 핵심 이미지 표시 및 제스처 처리 컴포넌트
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

// BEM 명명규칙 기반 CSS 클래스 접두사 (일관된 스타일링 네임스페이스)
const classPrefix = `adm-image-viewer`

// 단일 이미지 뷰어 Props 타입 정의
// 설계 원칙: 선택적 설정을 통한 유연성과 커스터마이징 지원
export type ImageViewerProps = {
  image: string // 필수: 표시할 이미지 URL (상대/절대 경로 모두 지원)
  maxZoom?: number | 'auto' // 선택적: 최대 확대 배율 ('auto'시 이미지 크기 기반 자동 계산)
  getContainer?: GetContainer // 선택적: 렌더링 컨테이너 지정 (기본: document.body)
  visible?: boolean // 선택적: 표시 상태 제어 (기본: false)
  onClose?: () => void // 선택적: 닫기 이벤트 핸들러 (탭, ESC, 백버튼 등)
  afterClose?: () => void // 선택적: 닫기 애니메이션 완료 후 콜백 (cleanup 로직)
  renderFooter?: (image: string) => ReactNode // 선택적: 하단 정보 영역 커스텀 렌더러
  imageRender?: (
    // 선택적: 이미지 요소 커스텀 렌더러 (lazy loading, 에러 처리 등)
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
  classNames?: {
    // 선택적: CSS 클래스 오버라이드 (테마 커스터마이징)
    mask?: string // 배경 마스크 스타일 재정의
    body?: string // 메인 컨테이너 스타일 재정의
  }
}

// 기본 Props 설정: 안전하고 일관된 초기 상태 보장
const defaultProps = {
  maxZoom: 3, // 3배 확대까지 허용 (모바일에서 적절한 확대 수준)
  getContainer: null, // null = document.body에 렌더링 (전역 오버레이)
  visible: false, // 기본적으로 숨김 상태 (명시적 호출로만 표시)
}

// 이미지 뷰어 컴포넌트 - 고도화된 제스처 기반 이미지 확대/축소/팬 기능을 제공하는 갤러리 뷰어
// 설계 의도: 네이티브 모바일 앱의 사진 갤러리와 동일한 부드러운 인터렉션 제공
// 핵심 특징: 매트릭스 변환 기반 확대/축소, 멀티터치 제스처, 경계 제한, 관성 스크롤
export const ImageViewer: FC<ImageViewerProps> = p => {
  // Props 병합: 타입 안전성을 보장하며 기본값과 사용자 설정을 결합
  const props = mergeProps(defaultProps, p)

  // JSX 노드 구성: 렌더링할 컴포넌트 트리 정의
  const node = (
    <Mask
      visible={props.visible} // 표시/숨김 상태 연동 (fade in/out 애니메이션)
      disableBodyScroll={false} // 내부에서 자체적으로 스크롤 제어 (제스처 우선순위)
      opacity='thick' // 진한 반투명 배경으로 이미지 집중도 향상 (0.7 알파)
      afterClose={props.afterClose} // 닫기 애니메이션 완료 콜백 전달
      destroyOnClose // 메모리 최적화를 위한 DOM 제거 (언마운트시 정리)
      className={props?.classNames?.mask} // 커스텀 마스크 스타일 적용
    >
      {/* 메인 컨테이너: 이미지와 컨트롤이 포함되는 중앙 영역 */}
      <div
        className={classNames(
          `${classPrefix}-content`, // 기본 컨텐츠 스타일
          props?.classNames?.body // 사용자 정의 바디 스타일 병합
        )}
      >
        {/* 이미지 존재성 검증: URL이나 커스텀 렌더러가 있을 때만 렌더링 */}
        {/* 단일 이미지 슬라이드: 핵심 제스처 인터렉션과 매트릭스 변환 로직 포함 */}
        {(props.image || typeof props.imageRender === 'function') && (
          <Slide
            image={props.image} // 이미지 URL 전달
            onTap={props.onClose} // 탭 제스처로 뷰어 닫기 (사용자 경험)
            maxZoom={props.maxZoom} // 최대 확대 배율 제한 전달
            imageRender={props.imageRender} // 커스텀 이미지 렌더링 지원
          />
        )}
      </div>

      {/* 하단 정보 영역: 이미지가 있을 때만 표시 */}
      {/* 하단 정보 영역: 이미지 메타데이터나 액션 버튼 표시 */}
      {props.image && (
        <div className={`${classPrefix}-footer`}>
          {/* 사용자 정의 푸터 컨텐츠 렌더링 (메타데이터, 액션 등) */}
          {props.renderFooter?.(props.image)}
          {/* 노치 디바이스 대응 안전 영역 (iPhone X 이후 모델) */}
          <SafeArea position='bottom' /> {/* 노치 디바이스 대응 안전 영역 */}
        </div>
      )}
    </Mask>
  )

  // 포탈 렌더링: 지정된 컨테이너나 document.body에 모달 마운트
  return renderToContainer(props.getContainer, node)
}

// 다중 이미지 뷰어 외부 제어 인터페이스 타입 (Slides 컴포넌트와 동일)
export type MultiImageViewerRef = SlidesRef

// 다중 이미지 뷰어 Props 타입 정의
// 설계: 단일 이미지 뷰어를 확장하여 배열 처리와 인덱스 관리 기능 추가
export type MultiImageViewerProps = Omit<
  ImageViewerProps, // 기본 ImageViewer Props 상속
  'image' | 'renderFooter' | 'imageRender' // 단일 이미지 관련 속성 제외
> & {
  images?: string[] // 선택적: 이미지 URL 배열 (갤러리 컨텐츠)
  defaultIndex?: number // 선택적: 초기 표시할 이미지 인덱스 (기본: 0)
  onIndexChange?: (index: number) => void // 선택적: 이미지 변경 이벤트 핸들러
  renderFooter?: (image: string, index: number) => ReactNode // 확장: 인덱스 정보 포함 푸터
  imageRender?: (
    // 확장: 인덱스 정보를 포함한 커스텀 이미지 렌더러
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
}

// 다중 이미지 뷰어 기본 Props: 단일 뷰어 설정 + 인덱스 초기화
const multiDefaultProps = {
  ...defaultProps, // 기본 이미지 뷰어 설정 상속
  defaultIndex: 0, // 첫 번째 이미지부터 시작
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
