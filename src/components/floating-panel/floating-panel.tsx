// FloatingPanel 컴포넌트: 네이티브 모바일 앱의 Bottom Sheet 패턴을 웹에서 구현한 고급 드래그 인터렉션 패널
// Why: 모바일 앱에서 흔히 사용되는 하단에서 올라오는 패널 UI 패턴을 웹에서 동일한 UX로 제공 필요
// How: React Spring 애니메이션 + @use-gesture 드래그 라이브러리를 결합하여 부드럽고 직관적인 인터렉션 구현

import { animated, useSpring } from '@react-spring/web' // 물리 기반 자연스러운 애니메이션 시스템
import { useDrag } from '@use-gesture/react' // 고성능 터치/마우스 제스처 인식 라이브러리
import { useMemoizedFn } from 'ahooks' // 리렌더링 최적화를 위한 함수 메모이제이션
import classNames from 'classnames' // 동적 CSS 클래스 병합 유틸리티
import type { ReactNode } from 'react'
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props' // 네이티브 HTML 속성 지원
import { nearest } from '../../utils/nearest' // 배열에서 가장 가까운 값을 찾는 유틸리티
import { supportsPassive } from '../../utils/supports-passive' // 패시브 이벤트 리스너 지원 여부 감지
import { useLockScroll } from '../../utils/use-lock-scroll' // 배경 스크롤 차단 기능
import { mergeProps } from '../../utils/with-default-props' // props 병합 및 기본값 적용

// CSS 클래스 접두사 - BEM 방식의 일관된 네이밍 체계
const classPrefix = 'adm-floating-panel'

// FloatingPanelRef 타입: 외부에서 패널을 프로그래밍적으로 제어할 수 있는 인터페이스
// Why: 부모 컴포넌트나 외부 로직에서 패널 높이를 직접 조작해야 하는 경우 대응
// How: useImperativeHandle을 통해 내부 api에 대한 제한된 인터페이스 노출
export type FloatingPanelRef = {
  // 패널 높이를 특정 값으로 설정
  // Why: 동적 콘텐츠나 사용자 액션에 따라 프로그래밍적으로 패널 높이 조절 필요
  setHeight: (
    height: number,
    options?: {
      immediate?: boolean // true면 애니메이션 없이 즉시 변경, false면 부드러운 전환
    }
  ) => void
}

// FloatingPanelProps 타입: 패널의 동작과 외관을 제어하는 속성들
// Why: 다양한 사용 상황에 맞는 유연한 설정 옵션 제공으로 재사용성 극대화
export type FloatingPanelProps = {
  // 앵커 포인트 배열: 패널이 스냅될 수 있는 높이값들 (픽셀 단위)
  // Why: 패널이 임의의 위치에 머물지 않고 정의된 몇 개의 높이로만 고정되도록 함
  // How: 드래그 종료 시 가장 가까운 앵커로 자동 스냅, UX 일관성 보장
  anchors: number[]

  // 패널 내부에 표시될 콘텐츠
  children: ReactNode

  // 높이 변경 시 호출되는 콜백 함수
  // Why: 외부에서 패널 높이 변화를 감지하여 관련 UI 업데이트나 로직 실행 필요
  // How: 애니메이션 중/후 구분하여 콜백 호출로 정밀한 상태 추적 가능
  onHeightChange?: (height: number, animating: boolean) => void

  // 콘텐츠 영역에서의 드래그 처리 여부
  // Why: 스크롤 가능한 콘텐츠와 패널 드래그의 충돌을 제어하기 위함
  // How: true면 콘텐츠 스크롤과 패널 드래그를 지능적으로 구분하여 처리
  handleDraggingOfContent?: boolean

  // 패널 배치 위치 - 화면 하단 또는 상단
  // Why: 다양한 UI 패턴 지원 (하단 액션시트, 상단 드롭다운 패널 등)
  placement?: 'bottom' | 'top'
} & NativeProps<'--border-radius' | '--z-index' | '--header-height'> // CSS 커스텀 속성 지원

// 기본 Props 설정 - 가장 일반적인 사용 패턴에 최적화
// Why: 대부분의 경우 콘텐츠 영역에서도 드래그 처리를 원하므로 기본값을 true로 설정
const defaultProps = {
  handleDraggingOfContent: true, // 콘텐츠 드래그 처리 기본 활성화
}

// FloatingPanel 메인 컴포넌트 구현
// Why: 네이티브 모바일 앱의 Bottom Sheet/Action Sheet 패턴을 웹에서 동일한 UX로 제공
// How: forwardRef로 외부 제어 인터페이스 노출, 복잡한 드래그 로직과 애니메이션 통합
export const FloatingPanel = forwardRef<FloatingPanelRef, FloatingPanelProps>(
  (p, ref) => {
    // Props 병합 및 기본값 적용
    const props = mergeProps(defaultProps, p)
    const { anchors, placement = 'bottom' } = props

    // 최대 높이 계산 - 패널이 가질 수 있는 최대 크기 결정
    // Why: DOM 요소의 실제 높이를 미리 계산하여 애니메이션 범위와 변환 로직 최적화
    // How: 앵커 배열의 최대값을 사용, 없으면 viewport 높이로 폴백
    const maxHeight = anchors[anchors.length - 1] ?? window.innerHeight

    // 배치 방향 확인 및 좌표계 설정
    const isBottomPlacement = placement !== 'top'

    // 좌표 변환 시스템 - React Spring 좌표계에 맞는 변환
    // Why: 사용자가 직관적으로 이해하는 높이(양수)를 내부 y좌표(음수)로 변환 필요
    // How: bottom 배치 시 모든 앵커를 음수로 변환하여 '위로 올라갈수록 음수 증가' 좌표계 구축
    const possibles = isBottomPlacement ? anchors.map(x => -x) : anchors

    // DOM 참조 관리 - 드래그 감지와 스크롤 제어에 필요한 요소들
    const elementRef = useRef<HTMLDivElement>(null) // 패널 전체 컨테이너
    const headerRef = useRef<HTMLDivElement>(null) // 드래그 핸들(헤더) 영역
    const contentRef = useRef<HTMLDivElement>(null) // 스크롤 가능한 콘텐츠 영역

    // 이중 드래그 상태 관리 시스템 - 성능과 UI 반응성 최적화
    // Why: 드래그 로직과 UI 업데이트를 분리하여 불필요한 리렌더링 방지
    // How: 상태(pulling)는 UI 렌더링용, ref(pullingRef)는 이벤트 핸들러 내부 로직용
    const [pulling, setPulling] = useState(false) // UI 렌더링 제어 (마스크 표시 등)
    const pullingRef = useRef(false) // 드래그 로직 내부 상태 (리렌더링 방지)

    // 드래그 경계 범위 계산 - 패널이 이동할 수 있는 최소/최대 좌표
    // Why: 사용자 드래그를 앵커 범위 내로 제한하여 일관된 UX 보장
    // How: 앵커 배열에서 최소/최대값을 추출하여 드래그 bounds 설정
    const bounds = {
      top: Math.min(...possibles), // 가장 높은 위치 (최소 y값)
      bottom: Math.max(...possibles), // 가장 낮은 위치 (최대 y값)
    }

    // 콜백 함수 메모이제이션 - 리렌더링 최적화
    // Why: 콜백이 변경될 때마다 불필요한 effect 재실행을 방지
    const onHeightChange = useMemoizedFn(props.onHeightChange ?? (() => {}))

    // React Spring 애니메이션 시스템 - 패널 위치와 전환 효과 제어
    // Why: 부드럽고 자연스러운 패널 이동 애니메이션으로 네이티브 앱과 같은 UX 구현
    // How: y 좌표를 통해 패널 위치 제어, 물리 기반 스프링 애니메이션 적용
    const [{ y }, api] = useSpring(() => ({
      // 초기 위치 설정: 배치 방향에 따른 시작점 결정
      // Why: bottom 배치는 가장 낮은 위치에서 시작, top 배치는 가장 높은 위치에서 시작
      y: isBottomPlacement ? bounds.bottom : bounds.top,

      // 애니메이션 물리 설정: 자연스러운 탄성 효과
      config: { tension: 300 }, // 높은 tension으로 빠르고 탄력적인 반응

      // 실시간 높이 변경 알림: 애니메이션 중에도 외부에 상태 전달
      // Why: 외부 컴포넌트가 패널 높이 변화에 실시간으로 반응할 수 있도록 함
      // How: y 좌표를 높이로 변환(-y = height)하여 직관적인 값으로 전달
      onChange: result => {
        onHeightChange(-result.value.y, y.isAnimating) // 좌표→높이 변환, 애니메이션 상태 포함
      },
    }))

    // 스마트 드래그 인터렉션 시스템 - 터치 영역별 차별화된 드래그 처리
    // Why: 헤더는 항상 드래그 가능, 콘텐츠는 스크롤과 충돌하지 않도록 지능적 처리 필요
    // How: 터치 시작점 분석 → 스크롤 상태 확인 → 드래그 허용/차단 결정의 3단계 로직
    useDrag(
      state => {
        const [, offsetY] = state.offset

        // 드래그 시작점 분석 - 터치된 영역에 따른 드래그 가능성 판단
        // Why: 사용자 의도를 정확히 파악하여 패널 드래그 vs 콘텐츠 스크롤을 구분
        if (state.first) {
          const target = state.event.target as Element
          const header = headerRef.current

          // 헤더 영역 터치 감지 - 명확한 드래그 핸들 영역
          // Why: 헤더는 드래그 전용 영역으로 항상 패널 이동을 위한 터치로 간주
          // How: 직접 헤더이거나 헤더 내부 요소인지 DOM 트리 탐색으로 확인
          if (header === target || header?.contains(target)) {
            pullingRef.current = true // 즉시 드래그 허용
          } else {
            // 콘텐츠 영역 터치 - 스크롤 상황에 따른 조건부 드래그 처리
            // Why: 콘텐츠 스크롤과 패널 드래그가 충돌하지 않도록 스마트한 분기 로직 필요
            if (!props.handleDraggingOfContent) return // 콘텐츠 드래그 비활성화 시 무시

            // 패널 위치 상태 확인
            const reachedTop = y.goal <= bounds.top // 최상단(최대 확장) 도달 여부
            const content = contentRef.current
            if (!content) return

            if (reachedTop) {
              // 최상단 도달 시의 특수 로직 - 스크롤 끝에서만 패널 드래그 허용
              // Why: 콘텐츠를 더 스크롤할 수 없을 때만 패널을 조작하려는 자연스러운 사용자 의도 반영
              // How: 스크롤 상단(scrollTop=0) + 아래방향 드래그 시에만 패널 드래그 활성화
              if (content.scrollTop <= 0 && state.direction[1] > 0) {
                pullingRef.current = true
              }
            } else {
              // 패널이 완전 확장되지 않은 상태 - 자유로운 드래그 허용
              // Why: 패널이 부분적으로만 열린 상태에서는 언제든 크기 조절 가능해야 함
              pullingRef.current = true
            }
          }
        }
        // UI 상태 동기화 - 드래그 상태를 시각적으로 반영
        // Why: 사용자에게 현재 드래그 중임을 알리고 관련 UI 요소 활성화 필요
        setPulling(pullingRef.current) // 마스크 표시 등을 위한 상태 업데이트
        if (!pullingRef.current) return // 드래그 비허용 시 이벤트 처리 중단

        // 브라우저 기본 동작 제어 - 드래그와 충돌하는 네이티브 동작 차단
        // Why: 스크롤, 텍스트 선택 등이 드래그를 방해하지 않도록 함
        const { event } = state
        if (event.cancelable && supportsPassive) {
          event.preventDefault() // 기본 터치/마우스 동작 차단
        }
        event.stopPropagation() // 부모 요소로의 이벤트 전파 방지

        let nextY = offsetY // 다음 위치 초기값은 현재 드래그 위치

        // 드래그 종료 처리 - 앵커 기반 스냅 로직
        // Why: 사용자가 손을 뗐을 때 패널이 정의된 높이로 안착하도록 함
        if (state.last) {
          // 드래그 상태 정리
          pullingRef.current = false
          setPulling(false)

          // 스마트 앵커 스냅 - 가장 가까운 앵커 포인트로 자동 이동
          // Why: 패널이 애매한 중간 위치에 머물지 않고 명확한 상태를 유지
          // How: nearest 유틸리티로 현재 위치에서 가장 가까운 앵커 찾아 적용
          nextY = nearest(possibles, offsetY)
        }

        // 애니메이션 실행 - 드래그 추적 또는 앵커 스냅
        // Why: 드래그 중에는 실시간 반응, 종료 시에는 부드러운 스냅 애니메이션
        api.start({
          y: nextY, // 드래그 중: 실시간 위치, 종료 시: 앵커 위치
        })
      },
      {
        // 드래그 방향 제한: Y축(세로)만 허용하여 가로 제스처와 충돌 방지
        axis: 'y',

        // 드래그 경계: 앵커 범위 내로 움직임 제한
        // Why: 사용자가 패널을 정의된 범위 밖으로 드래그하지 못하도록 함
        bounds,

        // 탄성 효과: iOS 스타일의 경계 초과 시 rubber band 효과
        // Why: 경계에 도달했음을 사용자에게 자연스럽게 알려주는 촉각 피드백
        rubberband: true,

        // 드래그 시작점: 현재 패널 위치를 기준으로 설정
        // Why: 이전 위치에 관계없이 현재 패널 위치에서 드래그 시작
        from: () => [0, y.get()],

        // 터치 최적화: 모바일 터치 이벤트에 최적화된 처리
        pointer: { touch: true },

        // 이벤트 대상: 패널 전체 요소에서 드래그 감지
        target: elementRef,

        // 이벤트 옵션: preventDefault 사용을 위한 non-passive 설정
        // Why: 드래그 중 스크롤 등 기본 동작을 차단하기 위해 패시브 모드 비활성화 필요
        eventOptions: supportsPassive ? { passive: false } : undefined,
      }
    )

    // 외부 제어 인터페이스 구현 - 부모 컴포넌트에서 패널 조작 가능
    // Why: 프로그래밍적으로 패널 높이를 제어해야 하는 경우 대응
    // How: useImperativeHandle로 내부 api를 제한적으로 외부에 노출
    useImperativeHandle(
      ref,
      () => ({
        // 높이 설정 메서드: 특정 높이로 패널 이동
        // Why: 동적 콘텐츠 변화나 사용자 액션에 따른 프로그래밍적 높이 조절 필요
        setHeight: (
          height: number, // 목표 높이 (픽셀 단위)
          options?: {
            immediate?: boolean // 즉시 변경 여부 (애니메이션 스킵)
          }
        ) => {
          // 높이를 y 좌표로 변환하여 애니메이션 실행
          // How: 높이(양수)를 y좌표(음수)로 변환하여 내부 좌표계에 맞춤
          api.start({
            y: -height, // 높이 → 좌표 변환
            immediate: options?.immediate, // 애니메이션 스킵 옵션 적용
          })
        },
      }),
      [api] // api 변경 시에만 재생성
    )

    // 배경 스크롤 차단 - 패널 사용 중 배경 페이지 스크롤 방지
    // Why: 패널과 배경 페이지의 스크롤이 동시에 발생하여 혼란스러운 UX 방지
    useLockScroll(elementRef, true)

    // 헤더 컴포넌트 정의 - 패널의 드래그 핸들 역할
    // Why: 사용자에게 드래그 가능한 영역임을 시각적으로 알려주고 터치 타겟 제공
    // How: 작은 바(bar) 모양의 시각적 인디케이터로 직관적인 드래그 핸들 구현
    const HeaderNode: ReactNode = (
      <div className={`${classPrefix}-header`} ref={headerRef}>
        <div className={`${classPrefix}-bar`} /> {/* 드래그 핸들 시각적 표시 */}
      </div>
    )

    // 최종 JSX 렌더링 - 네이티브 속성과 애니메이션이 통합된 패널 구조
    // Why: withNativeProps로 사용자 정의 CSS 변수와 스타일 지원, 애니메이션으로 부드러운 UX 제공
    return withNativeProps(
      props, // 사용자 정의 네이티브 속성 적용
      <animated.div
        ref={elementRef} // 드래그 타겟 및 스크롤 잠금용 참조
        className={classNames(classPrefix, `${classPrefix}-${placement}`)} // 기본 + 배치별 CSS 클래스
        style={{
          // 패널 최대 크기: 최대 앵커 높이로 고정
          height: Math.round(maxHeight),

          // 동적 위치 변환: y 좌표를 CSS transform으로 변환하여 부드러운 슬라이딩 구현
          // Why: React Spring의 y값을 실제 화면 위치로 변환하여 패널 움직임 표현
          // How: 배치 방향에 따라 다른 변환 공식 적용
          translateY: y.to(y => {
            if (isBottomPlacement) {
              // 하단 배치: 화면 아래쪽 100% 위치를 기준점으로 y만큼 위로 이동
              // 예시: y=-300이면 화면 하단에서 300px 위로 올라온 위치
              return `calc(100% + (${Math.round(y)}px))`
            }
            if (placement === 'top') {
              // 상단 배치: 화면 위쪽 -100% 위치를 기준점으로 y만큼 아래로 이동
              // 예시: y=300이면 화면 상단에서 300px 아래로 내려온 위치
              return `calc(-100% + (${Math.round(y)}px))`
            }
            return y // 폴백값 (실제로는 사용되지 않음)
          }),
        }}
      >
        {/* 드래그 상태 오버레이 마스크 - 시각적 피드백과 배경 인터렉션 차단 */}
        {/* Why: 사용자에게 드래그 중임을 알리고 배경 터치를 방지하여 드래그 경험 향상 */}
        <div
          className={`${classPrefix}-mask`}
          style={{
            display: pulling ? 'block' : 'none', // 드래그 활성 시에만 표시
          }}
        />

        {/* 조건부 헤더 렌더링: 하단 배치 시 패널 상단에 드래그 핸들 배치 */}
        {/* Why: 하단에서 올라오는 패널의 경우 위쪽에 드래그 핸들이 위치해야 직관적 */}
        {isBottomPlacement && HeaderNode}

        {/* 메인 콘텐츠 영역 - 사용자가 제공하는 실제 패널 내용 */}
        {/* Why: 스크롤 가능한 콘텐츠 컨테이너로서 패널의 핵심 기능 제공 */}
        <div className={`${classPrefix}-content`} ref={contentRef}>
          {props.children} {/* 사용자 정의 콘텐츠 렌더링 */}
        </div>

        {/* 조건부 헤더 렌더링: 상단 배치 시 패널 하단에 드래그 핸들 배치 */}
        {/* Why: 상단에서 내려오는 패널의 경우 아래쪽에 드래그 핸들이 위치해야 직관적 */}
        {placement === 'top' && HeaderNode}
      </animated.div>
    )
  }
)
