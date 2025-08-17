import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react'
import type { ReactNode, CSSProperties } from 'react'
import classNames from 'classnames'
import Popup, { PopupProps } from '../popup'
import { mergeProps } from '../../utils/with-default-props'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import {
  PickerColumn,
  PickerColumnItem,
  PickerValue,
  PickerValueExtend,
} from './index'
import PickerView from '../picker-view'
import {
  generateColumnsExtend,
  useColumnsExtend,
} from '../picker-view/columns-extend'
import { useConfig } from '../config-provider'
import { useMemoizedFn } from 'ahooks'
import SafeArea from '../safe-area'
import { defaultRenderLabel } from './picker-utils'

export type PickerActions = {
  open: () => void
  close: () => void
  toggle: () => void
}
export type PickerRef = PickerActions

// 피커 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-picker`

export type PickerProps = {
  columns: PickerColumn[] | ((value: PickerValue[]) => PickerColumn[])
  value?: PickerValue[]
  defaultValue?: PickerValue[]
  loading?: boolean
  loadingContent?: ReactNode
  onSelect?: (value: PickerValue[], extend: PickerValueExtend) => void
  onConfirm?: (value: PickerValue[], extend: PickerValueExtend) => void
  onCancel?: () => void
  onClose?: () => void
  closeOnMaskClick?: boolean
  visible?: boolean
  title?: ReactNode
  confirmText?: ReactNode
  cancelText?: ReactNode
  children?: (
    items: (PickerColumnItem | null)[],
    actions: PickerActions
  ) => ReactNode
  renderLabel?: (item: PickerColumnItem) => ReactNode
  mouseWheel?: boolean
  popupClassName?: string
  popupStyle?: CSSProperties
} & Pick<
  PopupProps,
  | 'getContainer'
  | 'afterShow'
  | 'afterClose'
  | 'onClick'
  | 'stopPropagation'
  | 'forceRender'
  | 'destroyOnClose'
> &
  NativeProps<
    | '--header-button-font-size'
    | '--title-font-size'
    | '--item-font-size'
    | '--item-height'
  >

const defaultProps = {
  defaultValue: [],
  closeOnMaskClick: true,
  renderLabel: defaultRenderLabel,
  destroyOnClose: false,
  forceRender: false,
}

// 피커 컴포넌트 - 복잡한 이중 상태 관리와 동기화를 통한 사용자 친화적 선택 인터페이스
// 설계 의도: 사용자가 선택을 확정하기 전까지는 임시 상태로 유지하고, 취소 시 원래 값으로 복원
// 핵심 특징: innerValue/value 이중 상태, memo 최적화, render props 패턴 지원
export const Picker = memo(
  forwardRef<PickerRef, PickerProps>((p, ref) => {
    const { locale } = useConfig()
    const props = mergeProps(
      defaultProps,
      {
        confirmText: locale.common.confirm,
        cancelText: locale.common.cancel,
      },
      p
    )

    // 피커 표시 상태 관리: visible prop과 내부 상태를 동기화
    const [visible, setVisible] = usePropsValue({
      value: props.visible,
      defaultValue: false,
      onChange: v => {
        if (v === false) {
          props.onClose?.()
        }
      },
    })

    // 피커 제어 액션들: ref를 통해 외부에서 피커를 제어할 수 있는 인터페이스 제공
    const actions: PickerActions = {
      toggle: () => {
        setVisible(v => !v)
      },
      open: () => {
        setVisible(true)
      },
      close: () => {
        setVisible(false)
      },
    }

    useImperativeHandle(ref, () => actions)

    // 확정된 값 관리: 사용자가 "확인"을 눌렀을 때의 최종 값
    const [value, setValue] = usePropsValue({
      ...props,
      onChange: val => {
        const extend = generateColumnsExtend(props.columns, val)
        props.onConfirm?.(val, extend)
      },
    })

    const extend = useColumnsExtend(props.columns, value)

    // 내부 임시 값 관리: 피커 조작 중의 임시 선택 상태
    // 핵심 설계: 사용자가 피커를 조작하는 동안은 innerValue만 변경되고, 확인 시에만 실제 value 업데이트
    // 이 패턴으로 "취소" 시 원래 값으로 즉시 복원 가능
    const [innerValue, setInnerValue] = useState<PickerValue[]>(value)

    // 피커가 열릴 때 innerValue를 현재 value로 동기화
    // 문제: 피커가 열릴 때 이전 선택 상태가 남아있으면 혼란 야기
    // 해결: visible이 true가 될 때마다 최신 확정값으로 초기화
    useEffect(() => {
      if (innerValue !== value) {
        setInnerValue(value)
      }
    }, [visible])

    // 외부에서 value가 변경되었을 때 피커가 닫혀있으면 innerValue도 동기화
    // 이는 외부 상태 변경(예: 프로그래매틱 값 설정)에 대한 대응
    useEffect(() => {
      if (!visible) {
        setInnerValue(value)
      }
    }, [value])

    // 피커 값 변경 핸들러: 임시 상태 업데이트와 선택 이벤트 발생
    // useMemoizedFn으로 불필요한 리렌더링 방지
    const onChange = useMemoizedFn((val, ext) => {
      setInnerValue(val)
      // 피커가 열려있을 때만 onSelect 이벤트 발생
      // 이는 피커가 닫힌 상태에서의 프로그래매틱 변경과 구분하기 위함
      if (visible) {
        props.onSelect?.(val, ext)
      }
    })

    const pickerElement = withNativeProps(
      props,
      <div className={classPrefix}>
        <div className={`${classPrefix}-header`}>
          {/* 취소 버튼: innerValue를 원래 값으로 복원하지 않고 단순히 피커만 닫음
              이는 다음 열기 시 useEffect가 자동으로 동기화해주기 때문 */}
          <a
            role='button'
            className={`${classPrefix}-header-button`}
            onClick={() => {
              props.onCancel?.()
              setVisible(false)
            }}
          >
            {props.cancelText}
          </a>
          <div className={`${classPrefix}-header-title`}>{props.title}</div>
          {/* 확인 버튼: innerValue를 실제 value로 확정하고 피커 닫기
              로딩 중에는 버튼 비활성화로 중복 확정 방지 */}
          <a
            role='button'
            className={classNames(
              `${classPrefix}-header-button`,
              props.loading && `${classPrefix}-header-button-disabled`
            )}
            onClick={() => {
              if (props.loading) return
              // setValue의 두 번째 인자 true는 강제 onChange 호출을 의미
              setValue(innerValue, true)
              setVisible(false)
            }}
            aria-disabled={props.loading}
          >
            {props.confirmText}
          </a>
        </div>
        <div className={`${classPrefix}-body`}>
          {/* PickerView에는 임시 값(innerValue)을 전달하여 사용자의 조작이 즉시 반영되도록 함 */}
          <PickerView
            loading={props.loading}
            loadingContent={props.loadingContent}
            columns={props.columns}
            renderLabel={props.renderLabel}
            value={innerValue}
            mouseWheel={props.mouseWheel}
            onChange={onChange}
          />
        </div>
      </div>
    )

    const popupElement = (
      <Popup
        style={props.popupStyle}
        className={classNames(`${classPrefix}-popup`, props.popupClassName)}
        visible={visible}
        position='bottom'
        onMaskClick={() => {
          if (!props.closeOnMaskClick) return
          props.onCancel?.()
          setVisible(false)
        }}
        getContainer={props.getContainer}
        destroyOnClose={props.destroyOnClose}
        afterShow={props.afterShow}
        afterClose={props.afterClose}
        onClick={props.onClick}
        forceRender={props.forceRender}
        stopPropagation={props.stopPropagation}
      >
        {pickerElement}
        <SafeArea position='bottom' />
      </Popup>
    )

    return (
      <>
        {popupElement}
        {props.children?.(extend.items, actions)}
      </>
    )
  })
)

Picker.displayName = 'Picker'
