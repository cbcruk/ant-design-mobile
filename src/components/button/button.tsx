import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type {
  ReactNode,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  MouseEventHandler,
} from 'react'
import classNames from 'classnames'
import DotLoading from '../dot-loading'
import { mergeProps } from '../../utils/with-default-props'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { isPromise } from '../../utils/validate'

// 버튼 컴포넌트 스타일링을 위한 CSS 클래스 접두사
const classPrefix = `adm-button`

// 네이티브 HTML 버튼 속성 타입 정의
type NativeButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

// 버튼 컴포넌트의 메인 Props 인터페이스 - 스타일링과 동작 옵션들을 포함
export type ButtonProps = {
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  fill?: 'solid' | 'outline' | 'none'
  size?: 'mini' | 'small' | 'middle' | 'large'
  block?: boolean
  loading?: boolean | 'auto'
  loadingText?: string
  loadingIcon?: ReactNode
  disabled?: boolean
  onClick?: (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void | Promise<void>
  type?: 'submit' | 'reset' | 'button'
  shape?: 'default' | 'rounded' | 'rectangular'
  children?: ReactNode
} & Pick<
  NativeButtonProps,
  'onMouseDown' | 'onMouseUp' | 'onTouchStart' | 'onTouchEnd' | 'id' | 'form'
> &
  NativeProps<
    | '--text-color'
    | '--background-color'
    | '--border-radius'
    | '--border-width'
    | '--border-style'
    | '--border-color'
  >

// 버튼 컴포넌트의 ref 타입 정의 - 네이티브 DOM 요소에 대한 접근 제공
export type ButtonRef = {
  nativeElement: HTMLButtonElement | null
}

// 버튼 컴포넌트의 기본 속성값들
const defaultProps: ButtonProps = {
  color: 'default',
  fill: 'solid',
  block: false,
  loading: false,
  loadingIcon: <DotLoading color='currentColor' />,
  type: 'button',
  shape: 'default',
  size: 'middle',
}

// 메인 Button 컴포넌트 - 비동기 작업과 로딩 상태를 자동 관리하는 스마트 버튼
// 설계 의도: 사용자가 비동기 작업(API 호출 등)을 수행할 때 수동으로 로딩 상태를 관리하는 번거로움 해결
// 핵심 기능: Promise를 반환하는 onClick 핸들러 감지 시 자동으로 로딩 상태 표시 및 중복 클릭 방지
export const Button = forwardRef<ButtonRef, ButtonProps>((p, ref) => {
  const props = mergeProps(defaultProps, p)

  // 내부 로딩 상태: 'auto' 모드에서 Promise 기반 onClick 처리 시 자동으로 관리
  // 문제: 비동기 작업 중 사용자가 버튼을 여러 번 클릭할 수 있음
  // 해결: Promise 진행 중 자동으로 로딩 상태 활성화하여 UX 개선 및 중복 요청 방지
  const [innerLoading, setInnerLoading] = useState(false)

  const nativeButtonRef = useRef<HTMLButtonElement>(null)

  // 로딩 상태 결정 로직: 수동 제어와 자동 제어를 선택적으로 지원
  // 'auto': Promise 감지 시 자동 로딩, 그 외: 개발자가 직접 제어
  const loading = props.loading === 'auto' ? innerLoading : props.loading

  // 버튼 비활성화 조건: 명시적 disabled 또는 로딩 중일 때
  // 로딩 중 비활성화로 사용자 경험 일관성 유지
  const disabled = props.disabled || loading

  // ref를 통해 네이티브 DOM 요소에 접근할 수 있도록 설정
  useImperativeHandle(ref, () => ({
    get nativeElement() {
      return nativeButtonRef.current
    },
  }))

  // 스마트 클릭 핸들러: Promise 반환 감지를 통한 자동 로딩 상태 관리
  // 설계 배경: 개발자가 async 함수를 onClick에 전달할 때마다 수동으로 로딩 상태를 관리하는 것은 비효율적
  // 해결 방식: Promise 반환 여부를 런타임에 감지하여 자동으로 로딩 상태 토글
  const handleClick: MouseEventHandler<HTMLButtonElement> = async e => {
    if (!props.onClick) return

    const promise = props.onClick(e)

    // isPromise 유틸리티로 반환값이 Promise인지 확인
    // 이 패턴으로 동기/비동기 onClick 핸들러를 모두 지원하면서도 자동 로딩 처리
    if (isPromise(promise)) {
      try {
        setInnerLoading(true)
        await promise
        setInnerLoading(false)
      } catch (e) {
        // 에러 발생 시에도 로딩 상태 해제하여 버튼이 영구적으로 비활성화되지 않도록 방지
        // 에러는 다시 throw하여 상위 컴포넌트에서 처리할 수 있도록 함
        setInnerLoading(false)
        throw e
      }
    }
  }

  // 네이티브 props와 함께 버튼 엘리먼트 렌더링
  return withNativeProps(
    props,
    <button
      ref={nativeButtonRef}
      type={props.type}
      form={props.form}
      onClick={handleClick}
      // 동적 CSS 클래스명 생성 - 색상, 크기, 상태에 따른 스타일링
      className={classNames(
        classPrefix,
        {
          [`${classPrefix}-${props.color}`]: props.color,
          [`${classPrefix}-block`]: props.block,
          [`${classPrefix}-disabled`]: disabled,
          [`${classPrefix}-fill-outline`]: props.fill === 'outline',
          [`${classPrefix}-fill-none`]: props.fill === 'none',
          [`${classPrefix}-mini`]: props.size === 'mini',
          [`${classPrefix}-small`]: props.size === 'small',
          [`${classPrefix}-large`]: props.size === 'large',
          [`${classPrefix}-loading`]: loading,
        },
        `${classPrefix}-shape-${props.shape}`
      )}
      disabled={disabled}
      onMouseDown={props.onMouseDown}
      onMouseUp={props.onMouseUp}
      onTouchStart={props.onTouchStart}
      onTouchEnd={props.onTouchEnd}
    >
      {/* 로딩 상태에 따른 조건부 렌더링 */}
      {loading ? (
        <div className={`${classPrefix}-loading-wrapper`}>
          {props.loadingIcon}
          {props.loadingText}
        </div>
      ) : (
        <span>{props.children}</span>
      )}
    </button>
  )
})
