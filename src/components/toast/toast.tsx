import { CheckOutline, CloseOutline } from 'antd-mobile-icons'
import classNames from 'classnames'
import type { FC, ReactNode } from 'react'
import React, { useMemo } from 'react'
import { GetContainer } from '../../utils/render-to-container'
import { mergeProps } from '../../utils/with-default-props'
import { PropagationEvent } from '../../utils/with-stop-propagation'
import AutoCenter from '../auto-center'
import type { MaskProps } from '../mask'
import Mask from '../mask'
import SpinLoading from '../spin-loading'

// 토스트 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-toast`

export interface ToastProps {
  afterClose?: () => void
  maskStyle?: MaskProps['style']
  maskClassName?: string
  maskClickable?: boolean
  content?: ReactNode
  icon?: 'success' | 'fail' | 'loading' | ReactNode
  duration?: number
  position?: 'top' | 'bottom' | 'center'
  visible?: boolean
  getContainer?: GetContainer
  stopPropagation?: PropagationEvent[]
}

const defaultProps = {
  maskClickable: true,
  stopPropagation: ['click'],
}

// 토스트 컴포넌트 - 사용자 방해를 최소화하면서도 중요한 피드백을 제공하는 오버레이 메시지
// 설계 의도: 사용자의 현재 작업을 중단시키지 않으면서도 작업 결과나 상태를 명확히 전달
// 핵심 특징: 투명 마스크, 위치 조정, 아이콘 기반 상태 표시, 자동 소멸
export const InternalToast: FC<ToastProps> = p => {
  const props = mergeProps(defaultProps, p)
  const { maskClickable, content, icon, position } = props

  // 아이콘 렌더링 로직: 타입에 따른 적절한 아이콘 선택과 커스텀 아이콘 지원
  // 문제: 성공/실패/로딩 상태를 사용자가 즉시 구분할 수 있어야 함
  // 해결: 색상과 형태가 다른 전용 아이콘으로 직관적인 상태 표시
  const iconElement = useMemo(() => {
    if (icon === null || icon === undefined) return null
    switch (icon) {
      case 'success':
        return <CheckOutline className={`${classPrefix}-icon-success`} />
      case 'fail':
        return <CloseOutline className={`${classPrefix}-icon-fail`} />
      case 'loading':
        return (
          <SpinLoading color='white' className={`${classPrefix}-loading`} />
        )
      default:
        // 커스텀 아이콘 지원으로 확장성 제공
        return icon
    }
  }, [icon])

  // 위치별 top 값 계산: 화면 내에서 적절한 위치 선정
  // 문제: 고정된 중앙 위치는 때로 중요한 UI 요소를 가릴 수 있음
  // 해결: top/bottom/center 옵션으로 컨텍스트에 맞는 위치 선택 가능
  const top = useMemo(() => {
    switch (position) {
      case 'top':
        return '20%' // 상단 - 헤더 영역 회피
      case 'bottom':
        return '80%' // 하단 - 네비게이션 영역 회피
      default:
        return '50%' // 중앙 - 기본값
    }
  }, [position])

  return (
    <Mask
      visible={props.visible}
      destroyOnClose
      opacity={0}
      disableBodyScroll={!maskClickable}
      getContainer={props.getContainer}
      afterClose={props.afterClose}
      style={{
        pointerEvents: maskClickable ? 'none' : 'auto',
        ...props.maskStyle,
      }}
      className={classNames(`${classPrefix}-mask`, props.maskClassName)}
      stopPropagation={props.stopPropagation}
    >
      <div className={classNames(`${classPrefix}-wrap`)}>
        <div
          style={{ top }}
          className={classNames(
            `${classPrefix}-main`,
            icon ? `${classPrefix}-main-icon` : `${classPrefix}-main-text`
          )}
        >
          {iconElement && (
            <div className={`${classPrefix}-icon`}>{iconElement}</div>
          )}
          <AutoCenter>{content}</AutoCenter>
        </div>
      </div>
    </Mask>
  )
}
