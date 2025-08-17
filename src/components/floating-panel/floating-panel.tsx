import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { useMemoizedFn } from 'ahooks'
import classNames from 'classnames'
import type { ReactNode } from 'react'
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { nearest } from '../../utils/nearest'
import { supportsPassive } from '../../utils/supports-passive'
import { useLockScroll } from '../../utils/use-lock-scroll'
import { mergeProps } from '../../utils/with-default-props'

const classPrefix = 'adm-floating-panel'

export type FloatingPanelRef = {
  setHeight: (
    height: number,
    options?: {
      immediate?: boolean
    }
  ) => void
}

export type FloatingPanelProps = {
  anchors: number[]
  children: ReactNode
  onHeightChange?: (height: number, animating: boolean) => void
  handleDraggingOfContent?: boolean
  placement?: 'bottom' | 'top'
} & NativeProps<'--border-radius' | '--z-index' | '--header-height'>

const defaultProps = {
  handleDraggingOfContent: true,
}

// 플로팅 패널 컴포넌트 - 고도화된 드래그 인터렉션과 앵커 기반 높이 조절이 가능한 반부동 패널
// 설계 의도: 네이티브 모바일 앱의 Bottom Sheet와 유사한 UX를 웹에서 구현
// 핵심 특징: 다중 앵커 포인트, 스마트한 드래그 감지, 콘텐츠 스크롤 연동, 상하 배치 지원
export const FloatingPanel = forwardRef<FloatingPanelRef, FloatingPanelProps>(
  (p, ref) => {
    const props = mergeProps(defaultProps, p)
    const { anchors, placement = 'bottom' } = props

    // 최대 높이: 앵커 배열의 마지막 값 또는 화면 높이 사용
    const maxHeight = anchors[anchors.length - 1] ?? window.innerHeight

    const isBottomPlacement = placement !== 'top'
    // 좌표 변환: bottom 배치시 음수 좌표 사용 (위로 갈수록 음수값 증가)
    // 이는 React Spring의 y 좌표계와 일치시키기 위한 변환
    const possibles = isBottomPlacement ? anchors.map(x => -x) : anchors

    const elementRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    // 드래그 상태 관리: UI 피드백과 로직 분리를 위한 이중 상태
    // pulling: UI 렌더링용 (마스크 표시 등)
    // pullingRef: 드래그 로직 내부에서 사용 (리렌더링 방지)
    const [pulling, setPulling] = useState(false)
    const pullingRef = useRef(false)

    // 드래그 경계 설정: 패널이 움직일 수 있는 최소/최대 위치
    const bounds = {
      top: Math.min(...possibles), // 가장 높은 위치 (가장 작은 값)
      bottom: Math.max(...possibles), // 가장 낮은 위치 (가장 큰 값)
    }

    const onHeightChange = useMemoizedFn(props.onHeightChange ?? (() => {}))

    // React Spring 애니메이션 상태: 패널의 y 위치 제어
    // 핵심 설계: 좌표값을 높이로 변환하여 외부에 전달 (-y = height)
    const [{ y }, api] = useSpring(() => ({
      y: isBottomPlacement ? bounds.bottom : bounds.top, // 초기 위치 설정
      config: { tension: 300 }, // 자연스러운 탄성 애니메이션
      // 높이 변경 콜백: y 좌표를 높이로 변환하여 외부에 알림
      onChange: result => {
        onHeightChange(-result.value.y, y.isAnimating)
      },
    }))

    // 고도화된 드래그 인터렉션: 스마트한 터치 영역 감지와 스크롤 연동
    // 핵심 설계: 헤더 영역은 항상 드래그 가능, 콘텐츠 영역은 조건부 드래그 허용
    useDrag(
      state => {
        const [, offsetY] = state.offset

        // 드래그 시작 시점: 터치 대상에 따른 드래그 허용/차단 결정
        if (state.first) {
          const target = state.event.target as Element
          const header = headerRef.current

          // 헤더 영역 터치: 항상 패널 드래그 허용
          if (header === target || header?.contains(target)) {
            pullingRef.current = true
          } else {
            // 콘텐츠 영역 터치: 스크롤 상태와 패널 위치에 따른 조건부 허용
            if (!props.handleDraggingOfContent) return

            const reachedTop = y.goal <= bounds.top // 패널이 최상단에 도달했는지 확인
            const content = contentRef.current
            if (!content) return

            if (reachedTop) {
              // 최상단 도달 시: 위로 스크롤이 불가능하고 아래로 드래그하는 경우만 패널 드래그 허용
              // 이는 "더 이상 스크롤할 콘텐츠가 없으니 패널을 내리겠다"는 자연스러운 제스처
              if (content.scrollTop <= 0 && state.direction[1] > 0) {
                pullingRef.current = true
              }
            } else {
              // 패널이 최상단이 아닌 경우: 언제든 패널 드래그 허용
              pullingRef.current = true
            }
          }
        }
        // UI 상태 동기화: 드래그 중임을 UI에 반영 (마스크 표시 등)
        setPulling(pullingRef.current)
        if (!pullingRef.current) return // 드래그가 허용되지 않은 경우 무시

        // 이벤트 제어: 기본 동작 방지로 원활한 드래그 보장
        const { event } = state
        if (event.cancelable && supportsPassive) {
          event.preventDefault() // 스크롤, 선택 등 기본 동작 차단
        }
        event.stopPropagation() // 이벤트 버블링 방지

        let nextY = offsetY

        // 드래그 종료 시점: 가장 가까운 앵커로 자동 스냅
        if (state.last) {
          pullingRef.current = false
          setPulling(false)
          // 핵심 기능: 사용자가 손을 뗀 위치에서 가장 가까운 앵커 포인트 찾기
          // 이로써 패널이 임의의 위치에 머물지 않고 정의된 높이로 스냅됨
          nextY = nearest(possibles, offsetY)
        }

        // 애니메이션 적용: 드래그 중에는 실시간 추적, 드래그 종료시 앵커로 스냅
        api.start({
          y: nextY,
        })
      },
      {
        axis: 'y', // 세로 방향 드래그만 허용 (가로 스와이프와 충돌 방지)
        bounds, // 드래그 범위 제한 (앵커 기반 경계)
        rubberband: true, // 경계 넘어서는 드래그 시 탄성 효과 (iOS 스타일)
        from: () => [0, y.get()], // 드래그 시작점을 현재 y 위치로 설정
        pointer: { touch: true }, // 터치 이벤트 최적화 활성화
        target: elementRef, // 드래그 이벤트를 수신할 대상 요소
        // 패시브 이벤트 처리: preventDefault 사용을 위해 passive: false 설정
        eventOptions: supportsPassive ? { passive: false } : undefined,
      }
    )

    useImperativeHandle(
      ref,
      () => ({
        setHeight: (
          height: number,
          options?: {
            immediate?: boolean
          }
        ) => {
          api.start({
            y: -height,
            immediate: options?.immediate,
          })
        },
      }),
      [api]
    )

    useLockScroll(elementRef, true)

    const HeaderNode: ReactNode = (
      <div className={`${classPrefix}-header`} ref={headerRef}>
        <div className={`${classPrefix}-bar`} />
      </div>
    )

    return withNativeProps(
      props,
      <animated.div
        ref={elementRef}
        className={classNames(classPrefix, `${classPrefix}-${placement}`)}
        style={{
          height: Math.round(maxHeight),
          // 배치별 변형 로직: y 좌표를 실제 화면 위치로 변환
          // 핵심 설계: 100% 기준점에서 y 오프셋을 적용하여 자연스러운 슬라이딩 구현
          translateY: y.to(y => {
            if (isBottomPlacement) {
              // 하단 배치: 화면 아래 100% 위치(완전 숨김)에서 y만큼 위로 이동
              // y가 음수일수록 더 많이 올라옴 (예: y=-300이면 300px 위로)
              return `calc(100% + (${Math.round(y)}px))`
            }
            if (placement === 'top') {
              // 상단 배치: 화면 위 -100% 위치(완전 숨김)에서 y만큼 아래로 이동
              // y가 양수일수록 더 많이 내려옴 (예: y=300이면 300px 아래로)
              return `calc(-100% + (${Math.round(y)}px))`
            }
            return y // 기본값 (실제로는 사용되지 않음)
          }),
        }}
      >
        {/* 드래그 중 오버레이 마스크: 드래그 상태를 시각적으로 표시하고 배경 인터렉션 차단 */}
        <div
          className={`${classPrefix}-mask`}
          style={{
            display: pulling ? 'block' : 'none', // 드래그 중에만 표시
          }}
        />

        {/* 배치별 헤더 위치: bottom 배치 시 상단에 헤더 표시 */}
        {isBottomPlacement && HeaderNode}

        {/* 콘텐츠 영역: 스크롤 가능한 실제 내용 */}
        <div className={`${classPrefix}-content`} ref={contentRef}>
          {props.children}
        </div>

        {/* top 배치 시 하단에 헤더 표시 */}
        {placement === 'top' && HeaderNode}
      </animated.div>
    )
  }
)
