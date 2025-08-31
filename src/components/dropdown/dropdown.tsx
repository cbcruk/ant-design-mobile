import { useClickAway } from 'ahooks' // 외부 영역 클릭 감지 훅
import classNames from 'classnames'
import type {
  ComponentProps,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react'
import React, {
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProp, mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import Popup, { PopupProps } from '../popup' // 팝업 컴포넌트 - 드롭다운 내용 표시
import { defaultPopupBaseProps } from '../popup/popup-base-props'
import { IconContext } from './context' // 아이콘 컨텍스트 - 하위 아이템들과 아이콘 공유
import Item, { ItemChildrenWrap } from './item'

// 드롭다운 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-dropdown`

// 드롭다운 컴포넌트의 Props 타입 정의
export type DropdownProps = {
  activeKey?: string | null // 제어 모드: 현재 활성화된 드롭다운 아이템의 키
  defaultActiveKey?: string | null // 비제어 모드: 초기 활성화된 아이템의 키
  closeOnMaskClick?: boolean // 마스크(배경) 클릭 시 드롭다운 닫기 여부
  closeOnClickAway?: boolean // 외부 영역 클릭 시 드롭다운 닫기 여부
  onChange?: (key: string | null) => void // 활성 상태 변경 시 호출되는 콜백
  arrowIcon?: ReactNode // 드롭다운 화살표 아이콘
  /**
   * @deprecated use `arrowIcon` instead
   */
  arrow?: ReactNode // 레거시 props - arrowIcon 사용 권장
  getContainer?: PopupProps['getContainer'] // 팝업 컨테이너 지정 함수
} & NativeProps

// 기본 속성값 정의
const defaultProps = {
  defaultActiveKey: null, // 기본적으로 아무것도 활성화되지 않음
  closeOnMaskClick: true, // 기본적으로 마스크 클릭 시 닫힘
  closeOnClickAway: false, // 기본적으로 외부 클릭 시 닫히지 않음
  getContainer: defaultPopupBaseProps['getContainer'], // 기본 팝업 컨테이너 사용
}

// 드롭다운 컴포넌트의 ref 인터페이스 - 외부에서 제어할 수 있는 메서드 제공
export type DropdownRef = {
  close: () => void // 드롭다운을 프로그래밍적으로 닫는 메서드
}

// 드롭다운 컴포넌트 메인 구현
// 설계 특징: 네비게이션 바와 팝업 내용을 분리하여 모바일 친화적 UI 제공
// 복잡도: 다중 상태 관리 (활성 아이템, 팝업 위치, 렌더링 최적화) 필요
const Dropdown = forwardRef<DropdownRef, PropsWithChildren<DropdownProps>>(
  (props, ref) => {
    const { dropdown: componentConfig = {} } = useConfig() // 글로벌 설정에서 드롭다운 기본값 가져오기
    const mergedProps = mergeProps(defaultProps, componentConfig, props) // 우선순위: props > config > default

    // 화살표 아이콘 병합 로직 - 레거시 props 지원과 새 props 통합
    const arrowIcon = mergeProp(
      componentConfig.arrowIcon,
      props.arrow, // 레거시 지원
      props.arrowIcon // 새로운 props
    )

    // 제어/비제어 컴포넌트 패턴 적용
    const [value, setValue] = usePropsValue({
      value: mergedProps.activeKey,
      defaultValue: mergedProps.defaultActiveKey,
      onChange: mergedProps.onChange,
    })

    // DOM 참조 - 외부 클릭 감지를 위한 요소들
    const navRef = useRef<HTMLDivElement>(null) // 네비게이션 바 참조
    const contentRef = useRef<HTMLDivElement>(null) // 팝업 내용 참조

    // 외부 영역 클릭 감지 및 드롭다운 닫기
    // 문제 해결: 모바일에서 의도치 않은 터치로 드롭다운이 계속 열려있는 상황 방지
    useClickAway(() => {
      if (!mergedProps.closeOnClickAway) return // 옵션이 비활성화된 경우 무시
      setValue(null) // 드롭다운 닫기
    }, [navRef, contentRef]) // 두 영역 모두 감지 대상에서 제외

    // 팝업 위치 계산 - 네비게이션 바 바로 아래 표시
    // 모바일 환경에서 정확한 위치 계산이 중요한 이유: 화면 크기와 스크롤에 영향받음
    const [top, setTop] = useState<number>() // 팝업의 top 위치값
    const containerRef = useRef<HTMLDivElement>(null) // 전체 컨테이너 참조

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      if (value) {
        // 드롭다운이 열려있을 때만 위치 계산
        const rect = container.getBoundingClientRect() // 컨테이너의 현재 위치 정보 가져오기
        setTop(rect.bottom) // 컨테이너 하단을 팝업 시작점으로 설정
      }
    }, [value]) // 활성 상태가 변경될 때마다 위치 재계산

    // 활성 상태 토글 함수 - 같은 아이템 클릭 시 닫기, 다른 아이템 클릭 시 전환
    const changeActive = (key: string | null) => {
      if (value === key) {
        setValue(null) // 현재 활성화된 아이템 재클릭 시 닫기
      } else {
        setValue(key) // 다른 아이템으로 전환
      }
    }

    // 자식 컴포넌트들을 처리하여 네비게이션과 팝업 내용으로 분리
    let popupForceRender = false // 팝업 강제 렌더링 플래그
    const items: ReactElement<ComponentProps<typeof Item>>[] = [] // 팝업에 표시될 아이템들

    // React.Children.map을 사용하여 자식 요소들을 순회하고 변환
    const navs = React.Children.map(mergedProps.children, child => {
      if (isValidElement<ComponentProps<typeof Item>>(child)) {
        // DropdownItem 컴포넌트인 경우 props 주입
        const childProps = {
          ...child.props,
          onClick: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            changeActive(child.key as string) // 클릭 시 활성 상태 변경
            child.props.onClick?.(event) // 원본 onClick 핸들러도 실행
          },
          active: child.key === value, // 현재 활성 상태 전달
        }
        items.push(child) // 팝업용 아이템 리스트에 추가
        if (child.props.forceRender) popupForceRender = true // 강제 렌더링 플래그 확인
        return cloneElement(child, childProps) // 수정된 props로 요소 복제
      } else {
        return child // DropdownItem이 아닌 요소는 그대로 반환
      }
    })

    // ref를 통한 외부 제어 인터페이스 제공
    useImperativeHandle(
      ref,
      () => ({
        close: () => {
          setValue(null) // 드롭다운을 프로그래밍적으로 닫는 메서드
        },
      }),
      [setValue]
    )

    return withNativeProps(
      mergedProps,
      <div
        className={classNames(classPrefix, {
          [`${classPrefix}-open`]: !!value, // 열림 상태 클래스 적용
        })}
        ref={containerRef}
      >
        {/* 아이콘 컨텍스트를 통해 하위 컴포넌트들과 화살표 아이콘 공유 */}
        <IconContext.Provider value={arrowIcon}>
          <div className={`${classPrefix}-nav`} ref={navRef}>
            {navs} {/* 네비게이션 아이템들 렌더링 */}
          </div>
        </IconContext.Provider>

        {/* 팝업을 통한 드롭다운 내용 표시 */}
        <Popup
          visible={!!value} // 활성 아이템이 있을 때만 표시
          position='top' // 상단에서 아래로 나타나는 애니메이션
          getContainer={mergedProps.getContainer} // 팝업 컨테이너 지정
          className={`${classPrefix}-popup`}
          maskClassName={`${classPrefix}-popup-mask`}
          bodyClassName={`${classPrefix}-popup-body`}
          style={{ top }} // 계산된 위치값 적용
          forceRender={popupForceRender} // 자식의 forceRender 옵션 전파
          onMaskClick={
            mergedProps.closeOnMaskClick
              ? () => {
                  changeActive(null) // 마스크 클릭 시 드롭다운 닫기
                }
              : undefined
          }
        >
          <div ref={contentRef}>
            {/* 각 아이템의 내용을 조건부 렌더링으로 표시 */}
            {items.map(item => {
              const isActive = item.key === value // 현재 활성 아이템인지 확인
              return (
                <ItemChildrenWrap
                  key={item.key}
                  active={isActive} // 활성 상태 전달
                  forceRender={item.props.forceRender} // 강제 렌더링 옵션 전달
                  destroyOnClose={item.props.destroyOnClose} // 닫힐 때 제거 옵션 전달
                >
                  {item.props.children} {/* 아이템의 실제 내용 */}
                </ItemChildrenWrap>
              )
            })}
          </div>
        </Popup>
      </div>
    )
  }
)

export default Dropdown
