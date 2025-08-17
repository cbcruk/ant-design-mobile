import React, {
  useState,
  useEffect,
  ReactNode,
  forwardRef,
  useImperativeHandle,
} from 'react'
import Popup, { PopupProps } from '../popup'
import {
  CascaderValue,
  CascaderValueExtend,
  CascaderOption,
} from '../cascader-view'
import { mergeProps } from '../../utils/with-default-props'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import CascaderView from '../cascader-view'
import { useConfig } from '../config-provider'
import { useCascaderValueExtend } from '../cascader-view/use-cascader-value-extend'
import { useFieldNames } from '../../hooks'
import type { FieldNamesType } from '../../hooks'

const classPrefix = `adm-cascader`

export type CascaderActions = {
  open: () => void
  close: () => void
  toggle: () => void
}
export type CascaderRef = CascaderActions

export type CascaderProps = {
  options: CascaderOption[]
  value?: CascaderValue[]
  defaultValue?: CascaderValue[]
  placeholder?: string
  onSelect?: (value: CascaderValue[], extend: CascaderValueExtend) => void
  onConfirm?: (value: CascaderValue[], extend: CascaderValueExtend) => void
  onCancel?: () => void
  onClose?: () => void
  visible?: boolean
  title?: ReactNode
  confirmText?: ReactNode
  cancelText?: ReactNode
  loading?: boolean
  children?: (
    items: (CascaderOption | null)[],
    actions: CascaderActions
  ) => ReactNode
  onTabsChange?: (index: number) => void
  activeIcon?: ReactNode
  fieldNames?: FieldNamesType
} & Pick<
  PopupProps,
  | 'getContainer'
  | 'afterShow'
  | 'afterClose'
  | 'onClick'
  | 'stopPropagation'
  | 'destroyOnClose'
  | 'forceRender'
> &
  NativeProps

const defaultProps = {
  defaultValue: [],
  destroyOnClose: true,
  forceRender: false,
}

// 캐스케이더 컴포넌트 - 계층적 데이터 구조를 위한 다단계 선택 인터페이스 (팝업 래퍼)
// 설계 의도: 트리 구조 데이터의 직관적 탐색과 선택을 위한 모바일 최적화 UI 제공
// 핵심 특징: CascaderView 기반 코어 로직, Popup 래핑, 내부/외부 상태 분리, 확인/취소 액션
export const Cascader = forwardRef<CascaderRef, CascaderProps>((p, ref) => {
  const { locale } = useConfig()

  // props 병합: 기본값 + 다국어 설정 + 사용자 설정의 우선순위 적용
  // 다국어 지원: 확인/취소 버튼과 플레이스홀더 텍스트의 지역화
  const props = mergeProps(
    defaultProps,
    {
      confirmText: locale.common.confirm, // "확인" 버튼 텍스트
      cancelText: locale.common.cancel, // "취소" 버튼 텍스트
      placeholder: locale.Cascader.placeholder, // 선택 안내 텍스트
    },
    p
  )

  // 팝업 표시 상태: 외부 제어와 내부 상태를 통합 관리
  // 설계 의도: 제어/비제어 패턴 지원으로 다양한 사용 시나리오 대응
  // visible prop이 있으면 외부 제어, 없으면 내부 상태로 동작
  const [visible, setVisible] = usePropsValue({
    value: props.visible, // 외부에서 제어하는 경우
    defaultValue: false, // 기본적으로 숨김 상태
    onChange: v => {
      // 팝업이 닫힐 때 onClose 콜백 실행
      if (v === false) {
        props.onClose?.()
      }
    },
  })

  // 액션 객체: 외부에서 팝업 상태를 제어할 수 있는 인터페이스
  // 설계 의도: children render prop과 ref를 통해 트리거 요소에서 팝업 제어 가능
  // 사용 예: 버튼 클릭으로 팝업 열기, 특정 조건에서 프로그래밍적으로 닫기
  const actions: CascaderActions = {
    toggle: () => {
      setVisible(v => !v) // 현재 상태의 반대로 전환
    },
    open: () => {
      setVisible(true) // 팝업 열기
    },
    close: () => {
      setVisible(false) // 팝업 닫기
    },
  }

  useImperativeHandle(ref, () => actions)

  // 최종 확정된 값: 사용자가 "확인" 버튼을 눌러 최종 선택한 값
  // 핵심 설계: onChange는 확인 버튼 클릭 시에만 호출되어 의도하지 않은 값 변경 방지
  // generateValueExtend: 선택된 값에 대응하는 전체 경로 정보와 메타데이터 제공
  const [value, setValue] = usePropsValue({
    ...props,
    onChange: val => {
      // 확인 버튼 클릭 시에만 onConfirm 호출 (확장 정보와 함께)
      props.onConfirm?.(val, generateValueExtend(val))
    },
  })

  // 필드명 매핑: 다양한 데이터 구조에 대응하기 위한 필드명 커스터마이징
  // 설계 의도: {value, label, children} 외에 {id, name, items} 등 다른 필드명 구조 지원
  // 예: {id: '001', name: '서울', items: [...]} 형태의 데이터도 처리 가능
  const [, valueName, childrenName] = useFieldNames(props.fieldNames)

  // 값 확장 정보 생성기: 선택된 값으로부터 전체 경로와 라벨 정보를 추출하는 함수
  // 핵심 기능: 선택된 value 배열을 받아서 각 단계의 option 객체와 라벨을 반환
  // 용도: onSelect, onConfirm 콜백에서 선택된 항목의 상세 정보 제공
  const generateValueExtend = useCascaderValueExtend(props.options, {
    valueName, // value 필드명 (기본: 'value')
    childrenName, // children 필드명 (기본: 'children')
  })

  // 내부 임시 값: 팝업 내에서 선택 중인 값 (확인 전까지는 외부로 전파되지 않음)
  // 설계 철학: "선택" vs "확정"의 구분으로 사용자가 실수로 선택을 변경해도 취소 가능
  // 동작 방식: 팝업 내에서 자유롭게 탐색하다가 확인 버튼으로만 최종 적용
  const [innerValue, setInnerValue] = useState<CascaderValue[]>(value)

  // 팝업 상태 변화 시 내부 값 동기화
  // 핵심 로직: 팝업이 닫힐 때마다 외부 확정값으로 내부 값을 초기화
  // 의도: 취소나 mask 클릭으로 팝업이 닫히면 이전 선택으로 복원
  useEffect(() => {
    if (!visible) {
      setInnerValue(value) // 팝업이 닫히면 확정된 값으로 복원
    }
  }, [visible, value])

  const cascaderElement = withNativeProps(
    props,
    <div className={classPrefix}>
      <div className={`${classPrefix}-header`}>
        <a
          className={`${classPrefix}-header-button`}
          onClick={() => {
            // 취소 버튼: 선택 내용을 버리고 팝업 닫기
            props.onCancel?.() // 취소 액션 콜백 실행
            setVisible(false) // 팝업 닫기 (useEffect에서 innerValue 복원됨)
          }}
        >
          {props.cancelText}
        </a>
        <div className={`${classPrefix}-header-title`}>{props.title}</div>
        <a
          className={`${classPrefix}-header-button`}
          onClick={() => {
            // 확인 버튼: 현재 내부 선택값을 외부로 확정 적용
            setValue(innerValue, true) // 내부 값을 외부 상태로 확정 (onChange 트리거)
            setVisible(false) // 팝업 닫기
          }}
        >
          {props.confirmText}
        </a>
      </div>
      <div className={`${classPrefix}-body`}>
        <CascaderView
          {...props}
          value={innerValue} // 팝업 내부의 임시 선택값 사용
          onChange={(val, ext) => {
            // CascaderView에서의 실시간 선택 변화 처리
            setInnerValue(val) // 내부 임시값 업데이트

            // 팝업이 열려있을 때만 onSelect 콜백 실행
            // 의도: 팝업이 닫혀있는 상태에서의 내부 값 복원 시에는 콜백 실행 방지
            if (visible) {
              props.onSelect?.(val, ext) // 실시간 선택 변화 알림 (확장 정보 포함)
            }
          }}
        />
      </div>
    </div>
  )

  const popupElement = (
    <Popup
      visible={visible}
      position='bottom'
      onMaskClick={() => {
        // 배경 마스크 클릭: 취소와 동일한 동작
        props.onCancel?.() // 취소 콜백 실행
        setVisible(false) // 팝업 닫기 (내부값은 이전 상태로 복원됨)
      }}
      getContainer={props.getContainer}
      destroyOnClose={props.destroyOnClose}
      forceRender={props.forceRender}
      afterShow={props.afterShow}
      afterClose={props.afterClose}
      onClick={props.onClick}
      stopPropagation={props.stopPropagation}
    >
      {cascaderElement}
    </Popup>
  )

  return (
    <>
      {popupElement}
      {/* children render prop: 트리거 요소를 커스터마이징할 수 있는 인터페이스
          매개변수 1: 현재 선택된 값들의 상세 정보 (각 단계별 option 객체 배열)
          매개변수 2: 팝업 제어 액션 (open, close, toggle)
          사용 예: (items, actions) => <Button onClick={actions.open}>{items.map(item => item?.label).join(' / ')}</Button>
       */}
      {props.children?.(generateValueExtend(value).items, actions)}
    </>
  )
})
