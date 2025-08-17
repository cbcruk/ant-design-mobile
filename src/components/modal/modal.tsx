import React from 'react'
import type { FC, ReactNode } from 'react'
import { mergeProps } from '../../utils/with-default-props'
import classNames from 'classnames'
import { Action, ModalActionButton } from './modal-action-button'
import Image from '../image'
import Space from '../space'
import AutoCenter from '../auto-center'
import { NativeProps } from '../../utils/native-props'
import CenterPopup, { CenterPopupProps } from '../center-popup'

export type ModalProps = Pick<
  CenterPopupProps,
  | 'afterClose'
  | 'afterShow'
  | 'bodyClassName'
  | 'bodyStyle'
  | 'destroyOnClose'
  | 'disableBodyScroll'
  | 'forceRender'
  | 'getContainer'
  | 'maskClassName'
  | 'maskStyle'
  | 'stopPropagation'
  | 'visible'
> & {
  image?: string
  header?: ReactNode
  title?: ReactNode
  content?: ReactNode
  actions?: Action[]
  onAction?: (action: Action, index: number) => void | Promise<void>
  onClose?: () => void
  closeOnAction?: boolean
  closeOnMaskClick?: boolean
  showCloseButton?: boolean
} & NativeProps

const defaultProps = {
  actions: [] as Action[],
  closeOnAction: false,
  closeOnMaskClick: false,
  getContainer: null,
}

// 모달 컴포넌트 - 사용자의 주의를 집중시키는 중요한 의사결정 인터페이스
// 설계 의도: 현재 작업 흐름을 중단하고 사용자의 명시적 선택이나 확인이 필요한 상황에서 사용
// 핵심 특징: 계층적 정보 구조, 비동기 액션 처리, 유연한 컨텐츠 배치, CenterPopup 기반 확장성
export const Modal: FC<ModalProps> = p => {
  const props = mergeProps(defaultProps, p)

  // 모달 컨텐츠 요소 구성: 시각적 계층구조를 통한 정보 전달 최적화
  // 구조: Image (주목도) → Header (맥락) → Title (핵심 메시지) → Content (상세) → Actions (선택)
  const element = (
    <>
      {/* 이미지 영역: 시각적 임팩트로 사용자 주의 집중
          문제: 텍스트만으로는 복잡한 상황을 즉시 이해하기 어려움
          해결: 상황을 대표하는 이미지로 직관적 이해 도움 */}
      {!!props.image && (
        <div className={cls('image-container')}>
          <Image src={props.image} alt='modal header image' width='100%' />
        </div>
      )}

      {/* 헤더 영역: 컨텍스트 정보나 부가 설명
          AutoCenter로 가운데 정렬하여 시각적 균형 유지 */}
      {!!props.header && (
        <div className={cls('header')}>
          <AutoCenter>{props.header}</AutoCenter>
        </div>
      )}

      {/* 제목: 모달의 핵심 메시지나 질문 */}
      {!!props.title && <div className={cls('title')}>{props.title}</div>}

      {/* 컨텐츠 영역: 문자열과 컴포넌트 모두 지원하는 유연한 구조
          문제: 단순 텍스트는 중앙 정렬이 자연스럽지만, 복잡한 컴포넌트는 자체 레이아웃을 가져야 함
          해결: 타입 검사로 문자열만 AutoCenter 적용, 컴포넌트는 원본 레이아웃 유지 */}
      <div className={cls('content')}>
        {typeof props.content === 'string' ? (
          <AutoCenter>{props.content}</AutoCenter>
        ) : (
          props.content
        )}
      </div>

      {/* 액션 영역: 수직 배치로 모바일 터치에 최적화된 버튼 레이아웃
          Space 컴포넌트로 일관된 간격 유지 */}
      <Space
        direction='vertical'
        block
        className={classNames(
          cls('footer'),
          props.actions.length === 0 && cls('footer-empty')
        )}
      >
        {/* 비동기 액션 처리: 개별 액션과 공통 핸들러의 병렬 실행
            문제: 액션 실행 중 모달이 닫히면 후속 처리가 중단될 수 있음
            해결: Promise.all로 모든 핸들러가 완료된 후에만 모달 닫기 진행 */}
        {props.actions.map((action, index) => (
          <ModalActionButton
            key={action.key}
            action={action}
            onAction={async () => {
              // 개별 액션의 onClick과 모달의 onAction을 병렬 실행
              // 둘 중 하나가 실패해도 다른 하나는 정상 완료되도록 함
              await Promise.all([
                action.onClick?.(),
                props.onAction?.(action, index),
              ])
              // 자동 닫기 옵션이 활성화된 경우에만 모달 닫기
              if (props.closeOnAction) {
                props.onClose?.()
              }
            }}
          />
        ))}
      </Space>
    </>
  )

  return (
    <CenterPopup
      className={classNames(cls(), props.className)}
      style={props.style}
      afterClose={props.afterClose}
      afterShow={props.afterShow}
      showCloseButton={props.showCloseButton}
      closeOnMaskClick={props.closeOnMaskClick}
      onClose={props.onClose}
      visible={props.visible}
      getContainer={props.getContainer}
      bodyStyle={props.bodyStyle}
      bodyClassName={classNames(
        cls('body'),
        props.image && cls('with-image'),
        props.bodyClassName
      )}
      maskStyle={props.maskStyle}
      maskClassName={props.maskClassName}
      stopPropagation={props.stopPropagation}
      disableBodyScroll={props.disableBodyScroll}
      destroyOnClose={props.destroyOnClose}
      forceRender={props.forceRender}
    >
      {element}
    </CenterPopup>
  )
}

function cls(name: string = '') {
  return 'adm-modal' + (name && '-') + name
}
