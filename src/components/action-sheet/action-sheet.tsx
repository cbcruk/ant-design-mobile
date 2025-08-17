import React from 'react'
import type { FC, ReactNode, CSSProperties } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'
import classNames from 'classnames'
import Popup, { PopupProps } from '../popup'
import SafeArea from '../safe-area'
import { renderImperatively } from '../../utils/render-imperatively'

// 액션 시트 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-action-sheet`

// 액션 시트의 개별 액션 아이템 타입 정의
export type Action = {
  key: string | number
  text: ReactNode
  disabled?: boolean
  description?: ReactNode
  danger?: boolean
  bold?: boolean
  onClick?: () => void
}

// 액션 시트 컴포넌트의 Props 타입 정의
export type ActionSheetProps = {
  visible?: boolean
  actions: Action[]
  extra?: ReactNode
  cancelText?: ReactNode
  onAction?: (action: Action, index: number) => void
  onClose?: () => void
  onMaskClick?: () => void
  closeOnAction?: boolean
  closeOnMaskClick?: boolean
  safeArea?: boolean
  popupClassName?: string
  /** @deprecated use `styles` instead */
  popupStyle?: CSSProperties
  styles?: Partial<Record<'body' | 'mask', CSSProperties>>
} & Pick<
  PopupProps,
  'afterClose' | 'getContainer' | 'destroyOnClose' | 'forceRender'
> &
  NativeProps

// 액션 시트 컴포넌트의 기본 속성값들
const defaultProps = {
  visible: false,
  actions: [],
  cancelText: '',
  closeOnAction: false,
  closeOnMaskClick: true,
  safeArea: true,
  destroyOnClose: false,
  forceRender: false,
}

// 액션 시트 컴포넌트 - 모바일 네이티브 앱의 액션 시트 패턴을 웹에서 구현
// 설계 의도: iOS/Android의 액션 시트와 동일한 UX를 제공하여 모바일 사용자에게 친숙한 인터페이스 제공
// 핵심 특징: 단순한 선택 액션부터 위험한 액션까지 시각적으로 구분하여 사용자 실수 방지
export const ActionSheet: FC<ActionSheetProps> = p => {
  const props = mergeProps(defaultProps, p)
  const { styles } = props

  return (
    // Popup을 기반으로 하는 컴포지션 패턴
    // 문제: 액션 시트는 팝업의 특수한 형태이지만 독특한 동작과 스타일이 필요
    // 해결: Popup 컴포넌트를 래핑하여 기본 기능은 재사용하고 액션 시트만의 특화 기능 추가
    <Popup
      visible={props.visible}
      onMaskClick={() => {
        // 이벤트 체인 패턴: 사용자 정의 핸들러 실행 후 기본 동작 수행
        // 이를 통해 개발자가 마스크 클릭에 대한 추가 로직(분석, 로깅 등)을 삽입할 수 있음
        props.onMaskClick?.()
        if (props.closeOnMaskClick) {
          props.onClose?.()
        }
      }}
      afterClose={props.afterClose}
      className={classNames(`${classPrefix}-popup`, props.popupClassName)}
      style={props.popupStyle}
      getContainer={props.getContainer}
      destroyOnClose={props.destroyOnClose}
      forceRender={props.forceRender}
      bodyStyle={styles?.body}
      maskStyle={styles?.mask}
    >
      {withNativeProps(
        props,
        <div className={classPrefix}>
          {/* 추가 콘텐츠 영역 (옵셔널) */}
          {props.extra && (
            <div className={`${classPrefix}-extra`}>{props.extra}</div>
          )}
          {/* 액션 버튼 목록 - 각 액션의 특성에 따른 차별화된 렌더링 */}
          <div className={`${classPrefix}-button-list`}>
            {props.actions.map((action, index) => (
              <div
                key={action.key}
                className={`${classPrefix}-button-item-wrapper`}
              >
                {/* 접근성과 시각적 구분을 고려한 액션 버튼 설계
                    - danger: 삭제, 로그아웃 등 위험한 액션을 빨간색으로 강조
                    - disabled: 조건에 따라 실행할 수 없는 액션 시각적 피드백
                    - bold: 주요 액션(확인, 저장 등)을 굵게 표시하여 사용자 가이드 */}
                <a
                  className={classNames(
                    'adm-plain-anchor',
                    `${classPrefix}-button-item`,
                    {
                      [`${classPrefix}-button-item-danger`]: action.danger,
                      [`${classPrefix}-button-item-disabled`]: action.disabled,
                      [`${classPrefix}-button-item-bold`]: action.bold,
                    }
                  )}
                  onClick={() => {
                    // 다층 이벤트 처리 시스템
                    // 1. 개별 액션의 onClick (특정 비즈니스 로직)
                    // 2. 전체 onAction (분석, 로깅, 공통 로직)
                    // 3. closeOnAction에 따른 자동 닫기
                    // 이 순서로 실행하여 각 레벨에서 필요한 처리를 수행
                    action.onClick?.()
                    props.onAction?.(action, index)
                    if (props.closeOnAction) {
                      props.onClose?.()
                    }
                  }}
                  role='option'
                  aria-disabled={action.disabled}
                >
                  <div className={`${classPrefix}-button-item-name`}>
                    {action.text}
                  </div>
                  {/* 설명 텍스트의 조건부 렌더링
                      주요 액션에는 간단한 설명을 추가하여 사용자의 이해도 향상 */}
                  {action.description && (
                    <div className={`${classPrefix}-button-item-description`}>
                      {action.description}
                    </div>
                  )}
                </a>
              </div>
            ))}
          </div>

          {props.cancelText && (
            <div
              className={`${classPrefix}-cancel`}
              role='option'
              aria-label={props.cancelText}
            >
              <div className={`${classPrefix}-button-item-wrapper`}>
                <a
                  className={classNames(
                    'adm-plain-anchor',
                    `${classPrefix}-button-item`
                  )}
                  onClick={props.onClose}
                >
                  <div className={`${classPrefix}-button-item-name`}>
                    {props.cancelText}
                  </div>
                </a>
              </div>
            </div>
          )}

          {props.safeArea && <SafeArea position='bottom' />}
        </div>
      )}
    </Popup>
  )
}

export type ActionSheetShowHandler = {
  close: () => void
}

export function showActionSheet(
  props: Omit<ActionSheetProps, 'visible' | 'destroyOnClose' | 'forceRender'>
) {
  return renderImperatively(
    <ActionSheet {...props} />
  ) as ActionSheetShowHandler
}
