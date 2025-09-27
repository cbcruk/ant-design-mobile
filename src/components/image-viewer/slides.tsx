// 의존성 분석:
// - @react-spring/web: GPU 가속 CSS 애니메이션 라이브러리 (부드러운 전환 효과)
// - @use-gesture/react: 터치/마우스 제스처 처리 (드래그, 스와이프, 핀치)
// - React: 핵심 리액트 API (forwardRef, useImperativeHandle, useRef)
// - bound: 수치 범위 제한 유틸리티 (경계값 안전 처리)
// - convertPx: 픽셀 단위 변환 유틸리티 (반응형 디자인 지원)
// - Slide: 단일 이미지 슬라이드 컴포넌트 (확대/축소/팬 기능)
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import React, {
  ReactNode,
  RefObject,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { bound } from '../../utils/bound'
import { convertPx } from '../../utils/convert-px'
import { Slide } from './slide'

// BEM 명명규칙 기반 CSS 클래스 접두사
const classPrefix = `adm-image-viewer`

// 슬라이드 컬렉션 컴포넌트 Props 타입 정의
// 설계 원칙: 수평 스크롤 기반 이미지 갤러리와 개별 이미지 제스처 통합
export type SlidesType = {
  images: string[] // 필수: 표시할 이미지 URL 배열 (갤러리 컨텐츠)
  onTap?: () => void // 선택적: 탭 제스처 핸들러 (일반적으로 뷰어 닫기)
  maxZoom: number // 필수: 각 슬라이드의 최대 확대 배율 (일관된 사용자 경험)
  defaultIndex: number // 필수: 초기 활성 슬라이드 인덱스 (진입점 제어)
  onIndexChange?: (index: number) => void // 선택적: 슬라이드 변경 이벤트 핸들러
  imageRender?: (
    // 선택적: 커스텀 이미지 렌더링 함수 (lazy loading, 에러 처리)
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
}

// 슬라이드 컨트롤 외부 인터페이스: 프로그래매틱 슬라이드 제어
export type SlidesRef = {
  swipeTo: (index: number, immediate?: boolean) => void // 특정 슬라이드로 이동
}

// 수평 슬라이드 갤러리 컴포넌트: 여러 이미지를 좌우 스와이프로 탐색
// 설계 의도: 네이티브 모바일 앱 갤러리와 동일한 페이징 기반 네비게이션
// 핵심 특징: 탄성 스크롤, 속도 기반 페이징, 확대 시 스와이프 잠금, 인디케이터 표시
export const Slides = forwardRef<SlidesRef, SlidesType>((props, ref) => {
  // 슬라이드 너비 계산: 뷰포트 전체 너비 + 여백 (자연스러운 스와이프 경험)
  // 16px 여백 추가로 슬라이드 간 간격 생성 (시각적 구분과 제스처 명확성)
  const slideWidth = window.innerWidth + convertPx(16)

  // React Spring 애니메이션 상태: 수평 스크롤 위치 관리
  const [{ x }, api] = useSpring(() => ({
    x: props.defaultIndex * slideWidth, // 초기 위치: 지정된 인덱스의 슬라이드
    config: { tension: 250, clamp: true }, // 빠른 반응성, 오버슈트 방지
  }))

  // 이미지 총 개수: 경계 검사와 인디케이터 표시에 사용
  const count = props.images.length

  // 특정 슬라이드로 이동하는 함수: 프로그래매틱 제어와 제스처 완료시 호출
  function swipeTo(index: number, immediate = false) {
    // 인덱스 경계 검사: 0 ~ (count-1) 범위로 제한 (안전성 보장)
    const i = bound(index, 0, count - 1)

    // 외부에 변경 사항 통지 (상위 컴포넌트 상태 동기화)
    props.onIndexChange?.(i)

    // 스프링 애니메이션으로 이동 (부드러운 전환 효과)
    api.start({
      x: i * slideWidth, // 목표 위치 계산 (인덱스 × 슬라이드 너비)
      immediate, // 즉시 이동 여부 (애니메이션 생략)
    })
  }

  // 외부 제어 인터페이스 노출: ref를 통한 프로그래매틱 슬라이드 제어
  useImperativeHandle(ref, () => ({
    swipeTo, // swipeTo 함수를 외부에서 호출 가능하도록 노출
  }))

  const dragLockRef = useRef(false)
  const bind = useDrag(
    state => {
      if (dragLockRef.current) return
      const [offsetX] = state.offset
      if (state.last) {
        const minIndex = Math.floor(offsetX / slideWidth)
        const maxIndex = minIndex + 1
        const velocityOffset =
          Math.min(state.velocity[0] * 2000, slideWidth) * state.direction[0]
        swipeTo(
          bound(
            Math.round((offsetX + velocityOffset) / slideWidth),
            minIndex,
            maxIndex
          )
        )
      } else {
        api.start({
          x: offsetX,
          immediate: true,
        })
      }
    },
    {
      transform: ([x, y]) => [-x, y],
      from: () => [x.get(), 0],
      bounds: () => ({
        left: 0,
        right: (count - 1) * slideWidth,
      }),
      rubberband: true,
      axis: 'x',
      pointer: { touch: true },
    }
  )

  return (
    <div className={`${classPrefix}-slides`} {...bind()}>
      <animated.div className={`${classPrefix}-indicator`}>
        {x.to(v => {
          const index: number = bound(Math.round(v / slideWidth), 0, count - 1)
          return `${index + 1} / ${count}`
        })}
      </animated.div>
      <animated.div
        className={`${classPrefix}-slides-inner`}
        style={{ x: x.to(x => -x) }}
      >
        {props.images.map((image, index) => (
          <Slide
            key={index}
            image={image}
            onTap={props.onTap}
            maxZoom={props.maxZoom}
            imageRender={props.imageRender}
            index={index}
            onZoomChange={zoom => {
              if (zoom !== 1) {
                const index: number = Math.round(x.get() / slideWidth)
                api.start({
                  x: index * slideWidth,
                })
              }
            }}
            dragLockRef={dragLockRef}
          />
        ))}
      </animated.div>
    </div>
  )
})
