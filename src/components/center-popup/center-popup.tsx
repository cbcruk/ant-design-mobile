import { animated, useSpring } from '@react-spring/web'
import { useIsomorphicLayoutEffect, useUnmountedRef } from 'ahooks'
import classNames from 'classnames'
import type { FC, PropsWithChildren } from 'react'
import React, { useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { renderToContainer } from '../../utils/render-to-container'
import { ShouldRender } from '../../utils/should-render'
import { useInnerVisible } from '../../utils/use-inner-visible'
import { useLockScroll } from '../../utils/use-lock-scroll'
import { mergeProps } from '../../utils/with-default-props'
import { withStopPropagation } from '../../utils/with-stop-propagation'
import { useConfig } from '../config-provider'
import Mask from '../mask'
import {
  PopupBaseProps,
  defaultPopupBaseProps,
} from '../popup/popup-base-props'

const classPrefix = 'adm-center-popup'

export type CenterPopupProps = PopupBaseProps &
  PropsWithChildren<{
    // These props currently are only used internally. They are not exported to users:
    role?: string
  }> &
  NativeProps<
    | '--background-color'
    | '--border-radius'
    | '--max-width'
    | '--min-width'
    | '--z-index'
  >

const defaultProps = {
  ...defaultPopupBaseProps,
  getContainer: null,
}

// 중앙 팝업 컴포넌트 - 스케일 애니메이션 기반의 모달 다이얼로그
// 설계 의도: 사용자의 주의를 집중시키면서도 자연스러운 등장/퇴장 효과 제공
// 핵심 특징: 스케일+투명도 조합 애니메이션, 중앙 정렬, 접근성 지원, 컨테이너 렌더링
export const CenterPopup: FC<CenterPopupProps> = props => {
  const { popup: componentConfig = {} } = useConfig()
  const mergedProps = mergeProps(defaultProps, componentConfig, props)

  const unmountedRef = useUnmountedRef()

  // React Spring 기반 중앙 팝업 애니메이션: 스케일과 투명도의 조합으로 자연스러운 등장감 연출
  // 핵심 설계: 작은 크기에서 점진적으로 확대되면서 나타나는 효과로 사용자 관심 집중
  // 모바일 네이티브 앱의 모달 등장 패턴과 유사한 UX 제공
  const style = useSpring({
    scale: mergedProps.visible ? 1 : 0.8, // 80% 크기에서 100%로 확대
    opacity: mergedProps.visible ? 1 : 0, // 투명에서 불투명으로 전환
    config: {
      mass: 1.2, // 관성 (무게감 있는 자연스러운 움직임)
      tension: 200, // 탄성력 (적당한 속도의 애니메이션)
      friction: 25, // 마찰력 (부드러운 정착감)
      clamp: true, // 값이 범위를 넘지 않도록 제한 (오버슈트 방지)
    },
    // 애니메이션 완료 콜백: active 상태와 생명주기 이벤트 동기화
    onRest: () => {
      if (unmountedRef.current) return // 언마운트 보호
      setActive(mergedProps.visible)
      if (mergedProps.visible) {
        mergedProps.afterShow?.() // 표시 완료 콜백
      } else {
        mergedProps.afterClose?.() // 숨김 완료 콜백
      }
    },
  })

  const [active, setActive] = useState(mergedProps.visible)
  useIsomorphicLayoutEffect(() => {
    if (mergedProps.visible) {
      setActive(true)
    }
  }, [mergedProps.visible])

  const ref = useRef<HTMLDivElement>(null)
  useLockScroll(ref, mergedProps.disableBodyScroll && active)

  const maskVisible = useInnerVisible(active && mergedProps.visible)

  const body = (
    <div
      className={classNames(`${classPrefix}-body`, mergedProps.bodyClassName)}
      style={mergedProps.bodyStyle}
    >
      {mergedProps.children}
    </div>
  )

  const node = withStopPropagation(
    mergedProps.stopPropagation,
    withNativeProps(
      mergedProps,
      <div
        className={classPrefix}
        style={{
          display: active ? undefined : 'none',
          pointerEvents: active ? undefined : 'none',
        }}
      >
        {mergedProps.mask && (
          <Mask
            visible={maskVisible}
            forceRender={mergedProps.forceRender}
            destroyOnClose={mergedProps.destroyOnClose}
            onMaskClick={e => {
              mergedProps.onMaskClick?.(e)
              if (mergedProps.closeOnMaskClick) {
                mergedProps.onClose?.()
              }
            }}
            style={mergedProps.maskStyle}
            className={classNames(
              `${classPrefix}-mask`,
              mergedProps.maskClassName
            )}
            disableBodyScroll={false}
            stopPropagation={mergedProps.stopPropagation}
          />
        )}
        <div
          className={`${classPrefix}-wrap`}
          role={mergedProps.role}
          aria-label={mergedProps['aria-label']}
        >
          {/* 애니메이션 적용된 팝업 컨테이너: 스케일과 투명도를 통한 중앙 등장 효과 */}
          <animated.div
            style={{
              ...style, // scale과 opacity가 자동으로 CSS transform과 opacity로 변환됨
              // 동적 상호작용 제어: 완전히 불투명해진 상태에서만 클릭 이벤트 허용
              // 문제: 애니메이션 중간 상태에서 클릭하면 의도하지 않은 동작 발생 가능
              // 해결: opacity가 1에 도달한 시점에서만 포인터 이벤트 활성화
              pointerEvents: style.opacity.to(v =>
                v === 1 ? 'unset' : 'none'
              ),
            }}
            ref={ref}
          >
            {mergedProps.showCloseButton && (
              <a
                className={classNames(
                  `${classPrefix}-close`,
                  'adm-plain-anchor'
                )}
                onClick={() => {
                  mergedProps.onClose?.()
                }}
              >
                {mergedProps.closeIcon}
              </a>
            )}
            {body}
          </animated.div>
        </div>
      </div>
    )
  )

  return (
    <ShouldRender
      active={active}
      forceRender={mergedProps.forceRender}
      destroyOnClose={mergedProps.destroyOnClose}
    >
      {renderToContainer(mergedProps.getContainer, node)}
    </ShouldRender>
  )
}
