import classNames from 'classnames'
import React, { useState, useRef } from 'react'
import type { FC, PropsWithChildren } from 'react'
import { useIsomorphicLayoutEffect, useUnmountedRef } from 'ahooks'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'
import Mask from '../mask'
import { useLockScroll } from '../../utils/use-lock-scroll'
import { renderToContainer } from '../../utils/render-to-container'
import { useSpring, animated } from '@react-spring/web'
import { withStopPropagation } from '../../utils/with-stop-propagation'
import { ShouldRender } from '../../utils/should-render'
import { defaultPopupBaseProps, PopupBaseProps } from './popup-base-props'
import { useInnerVisible } from '../../utils/use-inner-visible'
import { useConfig } from '../config-provider'
import { useDrag } from '@use-gesture/react'

// 팝업 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-popup`

// 팝업 컴포넌트의 Props 타입 정의 - 다양한 위치와 제스처 옵션 제공
export type PopupProps = PopupBaseProps &
  PropsWithChildren<{
    position?: 'bottom' | 'top' | 'left' | 'right'
    closeOnSwipe?: boolean
  }> &
  NativeProps<'--z-index'>

// 팝업 컴포넌트의 기본 속성값들
const defaultProps = {
  ...defaultPopupBaseProps,
  closeOnSwipe: false,
  position: 'bottom',
}

// 팝업 컴포넌트 - 고도로 최적화된 멀티 방향 오버레이 컨테이너
// 설계 의도: 모바일 환경에서 자연스러운 진입/퇴장 애니메이션과 제스처 기반 상호작용 제공
// 핵심 특징: React Spring 애니메이션, 드래그 제스처 지원, 성능 최적화된 렌더링, 방향별 특화 동작
export const Popup: FC<PopupProps> = p => {
  const { locale, popup: componentConfig = {} } = useConfig()
  const props = mergeProps(defaultProps, componentConfig, p)

  // 위치별 스타일 클래스 생성: 각 방향에 맞는 애니메이션과 레이아웃 적용
  // 문제: 단일 팝업 컴포넌트로 4가지 방향의 서로 다른 동작을 구현해야 함
  // 해결: CSS 클래스 기반 조건부 스타일링으로 방향별 특화된 UI 제공
  const bodyCls = classNames(
    `${classPrefix}-body`,
    props.bodyClassName,
    `${classPrefix}-body-position-${props.position}`
  )

  // 이중 상태 관리: visible과 active 분리로 애니메이션 최적화
  // 핵심 설계: visible은 외부 제어, active는 내부 생명주기 관리
  // 이 패턴으로 애니메이션 중 DOM 제거를 방지하고 부드러운 전환 보장
  const [active, setActive] = useState(props.visible)
  const ref = useRef<HTMLDivElement>(null)

  // 선택적 스크롤 잠금: 팝업이 활성화된 경우에만 배경 스크롤 방지
  // strict 모드로 완전한 스크롤 차단 (iOS Safari의 elastic scroll 포함)
  useLockScroll(ref, props.disableBodyScroll && active ? 'strict' : false)

  // 팝업 표시 시 즉시 active 상태 활성화: DOM 렌더링 우선 처리
  // 문제: 애니메이션 시작 전에 DOM이 준비되어야 자연스러운 전환 가능
  // 해결: visible이 true가 되면 즉시 active 설정으로 DOM 렌더링 보장
  useIsomorphicLayoutEffect(() => {
    if (props.visible) {
      setActive(true)
    }
  }, [props.visible])

  const unmountedRef = useUnmountedRef()

  // React Spring 기반 진입/퇴장 애니메이션: 부드럽고 성능 최적화된 전환 효과
  // 핵심 설계: percent 값(0-100)으로 transform을 제어하여 방향별 슬라이드 구현
  // 애니메이션 설정: 모바일에 최적화된 자연스러운 바운스와 속도
  const { percent } = useSpring({
    percent: props.visible ? 0 : 100, // 0=완전표시, 100=완전숨김
    config: {
      precision: 0.1, // 애니메이션 정밀도
      mass: 0.4, // 관성 (낮을수록 빠른 반응)
      tension: 300, // 탄성력 (높을수록 빠른 애니메이션)
      friction: 30, // 마찰력 (적절한 댐핑 효과)
    },
    // 애니메이션 완료 콜백: 생명주기 이벤트와 active 상태 동기화
    onRest: () => {
      if (unmountedRef.current) return // 언마운트된 컴포넌트 보호
      setActive(props.visible)
      if (props.visible) {
        props.afterShow?.() // 표시 완료 콜백
      } else {
        props.afterClose?.() // 숨김 완료 콜백
      }
    },
  })

  // 스와이프 제스처를 통한 팝업 닫기 기능
  // 설계 의도: 모바일 환경에서 자연스러운 제스처 기반 인터랙션 제공
  // 문제: 터치 기반 UI에서 버튼 터치만으로는 빠른 닫기 동작이 불편함
  // 해결: 팝업 방향에 맞는 스와이프 제스처로 직관적인 닫기 동작 지원
  const bind = useDrag(
    ({ swipe: [, swipeY] }) => {
      if (!props.closeOnSwipe) return
      // 팝업 위치에 따른 스와이프 방향 매칭
      // bottom 팝업: 아래로 스와이프 시 닫기 (swipeY === 1)
      // top 팝업: 위로 스와이프 시 닫기 (swipeY === -1)
      // 이는 사용자의 직관적인 제스처 패턴과 일치
      if (
        (swipeY === 1 && props.position === 'bottom') ||
        (swipeY === -1 && props.position === 'top')
      ) {
        props.onClose?.()
      }
    },
    {
      axis: 'y', // 세로 축만 감지하여 가로 스크롤과의 충돌 방지
      enabled: ['top', 'bottom'].includes(props.position), // 좌우 팝업은 제스처 비활성화
    }
  )

  const maskVisible = useInnerVisible(active && props.visible)

  const node = withStopPropagation(
    props.stopPropagation,
    withNativeProps(
      props,
      <div
        className={classPrefix}
        onClick={props.onClick}
        style={{
          display: active ? undefined : 'none',
          touchAction: ['top', 'bottom'].includes(props.position)
            ? 'none'
            : 'auto',
        }}
        {...bind()}
      >
        {props.mask && (
          <Mask
            visible={maskVisible}
            forceRender={props.forceRender}
            destroyOnClose={props.destroyOnClose}
            onMaskClick={e => {
              props.onMaskClick?.(e)
              if (props.closeOnMaskClick) {
                props.onClose?.()
              }
            }}
            className={props.maskClassName}
            style={props.maskStyle}
            disableBodyScroll={false}
            stopPropagation={props.stopPropagation}
          />
        )}
        {/* 애니메이션 적용된 팝업 바디: 방향별 특화 transform과 상호작용 제어 */}
        <animated.div
          className={bodyCls}
          style={{
            ...props.bodyStyle,
            // 애니메이션 중 포인터 이벤트 차단: 부분적으로 표시된 상태에서의 의도치 않은 클릭 방지
            // 문제: 애니메이션 중간 상태에서 사용자 터치가 발생하면 예상치 못한 동작 가능
            // 해결: 완전히 표시된 상태(percent=0)에서만 상호작용 허용
            pointerEvents: percent.to(v => (v === 0 ? 'unset' : 'none')),

            // 방향별 슬라이드 애니메이션: percent 값을 각 방향의 적절한 transform으로 변환
            // 핵심 설계: 각 방향에서 자연스럽게 등장하는 물리적 직관성 제공
            transform: percent.to(v => {
              if (props.position === 'bottom') {
                // 하단에서 위로: 화면 밖 아래쪽에서 올라오는 효과
                return `translate(0, ${v}%)` // v=100일 때 완전히 아래 숨김
              }
              if (props.position === 'top') {
                // 상단에서 아래로: 화면 밖 위쪽에서 내려오는 효과
                return `translate(0, -${v}%)` // v=100일 때 완전히 위로 숨김
              }
              if (props.position === 'left') {
                // 좌측에서 우로: 화면 밖 왼쪽에서 나타나는 효과
                return `translate(-${v}%, 0)` // v=100일 때 완전히 왼쪽 숨김
              }
              if (props.position === 'right') {
                // 우측에서 좌로: 화면 밖 오른쪽에서 나타나는 효과
                return `translate(${v}%, 0)` // v=100일 때 완전히 오른쪽 숨김
              }
              return 'none'
            }),
          }}
          ref={ref}
        >
          {props.showCloseButton && (
            <a
              className={classNames(
                `${classPrefix}-close-icon`,
                'adm-plain-anchor'
              )}
              onClick={() => {
                props.onClose?.()
              }}
              role='button'
              aria-label={locale.common.close}
            >
              {props.closeIcon}
            </a>
          )}
          {props.children}
        </animated.div>
      </div>
    )
  )

  return (
    <ShouldRender
      active={active}
      forceRender={props.forceRender}
      destroyOnClose={props.destroyOnClose}
    >
      {renderToContainer(props.getContainer, node)}
    </ShouldRender>
  )
}
