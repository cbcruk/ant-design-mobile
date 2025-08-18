// Popup 컴포넌트: 모바일 환경에 최적화된 멀티 방향 팝업/모달 컨테이너
// Why: 다양한 방향(상하좌우)에서 등장하는 팝업이 필요한 모바일 앱의 UI 패턴 지원
// How: React Spring 기반 애니메이션, 제스처 인식, 성능 최적화된 렌더링으로 구현

import { animated, useSpring } from '@react-spring/web' // 물리 기반 애니메이션 라이브러리
import { useDrag } from '@use-gesture/react' // 터치/마우스 제스처 인식
import { useIsomorphicLayoutEffect, useUnmountedRef } from 'ahooks' // SSR 안전 레이아웃 효과, 언마운트 감지
import classNames from 'classnames' // 조건부 CSS 클래스 병합 유틸리티
import type { FC, PropsWithChildren } from 'react'
import React, { useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props' // 네이티브 HTML 속성 지원
import { renderToContainer } from '../../utils/render-to-container' // Portal 기반 렌더링
import { ShouldRender } from '../../utils/should-render' // 조건부 렌더링 최적화
import { useInnerVisible } from '../../utils/use-inner-visible' // 내부 가시성 상태 관리
import { useLockScroll } from '../../utils/use-lock-scroll' // 배경 스크롤 차단 기능
import { mergeProps } from '../../utils/with-default-props' // props 병합 및 기본값 적용
import { withStopPropagation } from '../../utils/with-stop-propagation' // 이벤트 전파 제어
import { useConfig } from '../config-provider' // 전역 설정 및 다국화
import Mask from '../mask' // 배경 마스크 컴포넌트
import { defaultPopupBaseProps, PopupBaseProps } from './popup-base-props' // 기본 속성 및 타입 정의

// CSS 클래스 접두사 - BEM 방식의 일관된 네이밍 체계
const classPrefix = `adm-popup`

// PopupProps 타입 정의 - 기본 팝업 기능에 방향성과 제스처 기능 추가
// Why: 모바일 환경에서 다양한 UI 패턴(드로어, 액션시트, 사이드바 등) 지원 필요
// How: 기본 PopupBaseProps에 방향성(position)과 스와이프 닫기(closeOnSwipe) 기능 확장
export type PopupProps = PopupBaseProps &
  PropsWithChildren<{
    // 팝업이 나타나는 방향 - UI/UX에 따른 다양한 진입 패턴 지원
    position?: 'bottom' | 'top' | 'left' | 'right'

    // 스와이프 제스처로 팝업 닫기 활성화 여부
    // Why: 모바일 사용자의 직관적인 제스처 패턴 지원
    closeOnSwipe?: boolean
  }> &
  NativeProps<'--z-index'> // CSS 커스텀 속성을 통한 z-index 제어

// 기본 Props 설정 - 가장 일반적인 모바일 팝업 패턴에 최적화
// Why: 대부분의 모바일 앱에서 하단에서 올라오는 액션시트/모달이 주요 패턴
// How: 안전하고 직관적인 기본값으로 개발자 경험 향상
const defaultProps = {
  ...defaultPopupBaseProps, // 기본 팝업 속성들 상속
  closeOnSwipe: false, // 의도치 않은 닫기 방지를 위해 기본값은 false
  position: 'bottom', // 가장 일반적인 하단 팝업으로 기본 설정
}

// Popup 컴포넌트 메인 구현부
// Why: 모바일 UI/UX에서 필수적인 오버레이 컨테이너 패턴 제공
// How: 상태 관리, 애니메이션, 제스처, 접근성을 통합한 고성능 구현
export const Popup: FC<PopupProps> = p => {
  // 전역 설정 및 다국화 컨텍스트 획득
  // Why: 접근성 라벨과 컴포넌트별 기본 설정을 위한 전역 상태 필요
  const { locale, popup: componentConfig = {} } = useConfig()

  // Props 병합: 기본값 → 전역 설정 → 사용자 입력 순으로 우선순위 적용
  // Why: 유연한 설정 계층 구조로 일관성과 커스터마이징 모두 지원
  // How: mergeProps 유틸리티로 객체 깊은 병합 및 undefined 값 처리
  const props = mergeProps(defaultProps, componentConfig, p)

  // 동적 CSS 클래스 구성 - 방향별 특화 스타일링
  // Why: 각 방향(상하좌우)마다 다른 애니메이션과 레이아웃이 필요함
  // How: BEM 방식의 조건부 클래스로 CSS에서 방향별 스타일 분기 처리
  const bodyCls = classNames(
    `${classPrefix}-body`, // 기본 팝업 바디 스타일
    props.bodyClassName, // 사용자 지정 추가 클래스
    `${classPrefix}-body-position-${props.position}` // 방향별 특화 스타일 클래스
  )

  // 이중 상태 관리 시스템 - 외부/내부 상태 분리
  // Why: props.visible과 내부 active 상태를 분리하여 애니메이션 생명주기 정교 제어
  // How: visible(외부 제어) → active(내부 DOM 상태)로 단계적 상태 전환 관리
  const [active, setActive] = useState(props.visible)
  const ref = useRef<HTMLDivElement>(null)

  // 조건부 스크롤 잠금 - 팝업 활성화 시에만 배경 스크롤 차단
  // Why: 팝업이 표시된 동안 배경 콘텐츠의 의도치 않은 스크롤 방지
  // How: 'strict' 모드로 iOS Safari의 bounce scroll까지 완전 차단
  useLockScroll(ref, props.disableBodyScroll && active ? 'strict' : false)

  // 즉시 DOM 활성화 - visible 변경 시 동기적 상태 업데이트
  // Why: 애니메이션이 시작되기 전에 DOM 요소가 먼저 렌더링되어야 부드러운 전환 가능
  // How: useIsomorphicLayoutEffect로 브라우저 페인팅 전에 상태 업데이트 보장
  useIsomorphicLayoutEffect(() => {
    if (props.visible) {
      setActive(true) // visible이 true가 되면 즉시 DOM에 마운트
    }
    // 주의: visible이 false가 될 때는 애니메이션 완료 후 setActive(false) 실행
  }, [props.visible])

  // 컴포넌트 언마운트 상태 추적 - 메모리 누수 및 에러 방지
  // Why: 애니메이션 콜백이 언마운트된 컴포넌트에서 실행되는 것을 방지
  const unmountedRef = useUnmountedRef()

  // React Spring 애니메이션 시스템 - 물리 기반 자연스러운 전환
  // Why: 급작스러운 나타남/사라짐보다 부드러운 전환이 사용자 경험 향상
  // How: percent(0-100) 값으로 transform 제어, 방향별 슬라이드 애니메이션 구현
  const { percent } = useSpring({
    percent: props.visible ? 0 : 100, // 0=완전히 표시, 100=완전히 숨김
    config: {
      precision: 0.1, // 애니메이션 정밀도 (0.1% 차이까지 감지)
      mass: 0.4, // 물체의 질량감 (낮을수록 가벼운 느낌)
      tension: 300, // 스프링 장력 (높을수록 빠른 가속)
      friction: 30, // 저항/마찰 (자연스러운 감속을 위한 댐핑)
    },
    // 애니메이션 완료 시 생명주기 콜백 및 상태 정리
    // Why: 애니메이션이 끝난 후 DOM 정리 및 사용자 정의 콜백 실행
    onRest: () => {
      // 컴포넌트가 이미 언마운트되었다면 콜백 실행하지 않음
      if (unmountedRef.current) return

      // 최종 상태로 active 업데이트 (숨김 애니메이션 완료 시 DOM에서 제거)
      setActive(props.visible)

      // 사용자 정의 생명주기 콜백 실행
      if (props.visible) {
        props.afterShow?.() // 완전히 나타난 후 콜백
      } else {
        props.afterClose?.() // 완전히 사라진 후 콜백
      }
    },
  })

  // 터치 제스처 기반 닫기 시스템 - 직관적인 스와이프 상호작용
  // Why: 모바일 사용자는 팝업을 밀어서 닫는 제스처를 자연스럽게 기대함
  // How: @use-gesture/react로 스와이프 감지, 방향과 팝업 위치 매칭
  const bind = useDrag(
    ({ swipe: [, swipeY] }) => {
      // closeOnSwipe가 비활성화된 경우 제스처 무시
      if (!props.closeOnSwipe) return

      // 직관적인 제스처 매핑: 팝업이 나타난 방향의 반대로 스와이프하면 닫기
      // Why: 사용자가 팝업을 "밀어내는" 자연스러운 제스처 패턴 지원
      // How: 각 위치별 스와이프 방향과 닫기 동작 매칭
      if (
        (swipeY === 1 && props.position === 'bottom') || // 하단 팝업 → 아래로 스와이프
        (swipeY === -1 && props.position === 'top') // 상단 팝업 → 위로 스와이프
      ) {
        props.onClose?.() // 닫기 콜백 실행
      }
    },
    {
      axis: 'y', // Y축(세로) 제스처만 감지 - 가로 스크롤 간섭 방지
      enabled: ['top', 'bottom'].includes(props.position), // 상하 팝업만 제스처 활성화
      // 좌우 팝업은 제스처 비활성화 (가로 스크롤과의 충돌 및 복잡성 방지)
    }
  )

  // 마스크 가시성 최적화 - 중첩된 상태 기반 조건부 렌더링
  // Why: active와 visible 조건을 모두 만족할 때만 마스크 표시로 불필요한 렌더링 방지
  const maskVisible = useInnerVisible(active && props.visible)

  // DOM 노드 구성 - 이벤트 제어 및 네이티브 속성이 적용된 컨테이너
  // Why: 재사용 가능한 컴포넌트로서 다양한 이벤트 처리와 접근성 지원 필요
  // How: HOC 패턴으로 이벤트 전파 제어와 네이티브 속성 주입
  const node = withStopPropagation(
    props.stopPropagation, // 지정된 이벤트의 전파 차단
    withNativeProps(
      // CSS 커스텀 속성 등 네이티브 속성 적용
      props,
      <div
        className={classPrefix} // 기본 팝업 컨테이너 스타일
        onClick={props.onClick} // 사용자 정의 클릭 핸들러
        style={{
          // 비활성 상태에서 완전히 숨김 (성능 최적화)
          display: active ? undefined : 'none',

          // 터치 액션 제어 - 제스처 충돌 방지
          // Why: 상하 팝업의 경우 스와이프 제스처가 스크롤과 충돌할 수 있음
          // How: 상하 팝업은 touch-action: none으로 기본 터치 동작 차단
          touchAction: ['top', 'bottom'].includes(props.position)
            ? 'none' // 상하 팝업: 모든 터치 제스처 차단
            : 'auto', // 좌우 팝업: 기본 터치 동작 허용
        }}
        {...bind()} // 드래그 제스처 이벤트 핸들러 바인딩
      >
        {/* 배경 마스크 컴포넌트 - 선택적 렌더링 및 이벤트 처리 */}
        {/* Why: 사용자가 배경을 클릭해서 팝업을 닫거나, 시각적 강조를 위한 어두운 배경 제공 */}
        {props.mask && (
          <Mask
            visible={maskVisible} // 최적화된 가시성 상태
            forceRender={props.forceRender} // 강제 렌더링 옵션 전달
            destroyOnClose={props.destroyOnClose} // DOM 정리 옵션 전달
            // 마스크 클릭 이벤트 처리 - 사용자 콜백과 자동 닫기 로직 결합
            onMaskClick={e => {
              props.onMaskClick?.(e) // 사용자 정의 마스크 클릭 핸들러 실행
              if (props.closeOnMaskClick) {
                // 마스크 클릭으로 닫기 옵션이 활성화된 경우
                props.onClose?.() // 팝업 닫기 실행
              }
            }}
            className={props.maskClassName} // 사용자 지정 마스크 스타일 클래스
            style={props.maskStyle} // 사용자 지정 마스크 인라인 스타일
            disableBodyScroll={false} // 팝업이 스크롤 잠금을 담당하므로 마스크는 비활성화
            stopPropagation={props.stopPropagation} // 동일한 이벤트 전파 제어 설정 적용
          />
        )}
        {/* 애니메이션 팝업 바디 - 방향별 슬라이드 전환과 상호작용 제어 */}
        {/* Why: 각 방향에 맞는 자연스러운 등장/퇴장 애니메이션으로 사용자 경험 향상 */}
        <animated.div
          className={bodyCls} // 방향별 특화 CSS 클래스 적용
          style={{
            ...props.bodyStyle, // 사용자 지정 바디 스타일

            // 동적 포인터 이벤트 제어 - 애니메이션 중 상호작용 차단
            // Why: 부분적으로 표시된 상태에서 의도치 않은 클릭/터치 방지
            // How: 완전히 표시된 상태(percent=0)에서만 이벤트 허용
            pointerEvents: percent.to(v => (v === 0 ? 'unset' : 'none')),

            // 방향별 슬라이드 애니메이션 - percent 기반 동적 transform
            // Why: 각 방향에서 자연스럽게 나타나는 물리적 직관성 제공
            // How: percent(0-100) 값을 방향에 맞는 translate 변환으로 매핑
            transform: percent.to(v => {
              if (props.position === 'bottom') {
                // 하단 팝업: 아래에서 위로 슬라이드
                return `translate(0, ${v}%)` // Y축 양수 방향 (아래로)
              }
              if (props.position === 'top') {
                // 상단 팝업: 위에서 아래로 슬라이드
                return `translate(0, -${v}%)` // Y축 음수 방향 (위로)
              }
              if (props.position === 'left') {
                // 좌측 팝업: 왼쪽에서 오른쪽으로 슬라이드
                return `translate(-${v}%, 0)` // X축 음수 방향 (왼쪽으로)
              }
              if (props.position === 'right') {
                // 우측 팝업: 오른쪽에서 왼쪽으로 슬라이드
                return `translate(${v}%, 0)` // X축 양수 방향 (오른쪽으로)
              }
              return 'none' // 기본값 (변환 없음)
            }),
          }}
          ref={ref} // 스크롤 잠금용 DOM 참조
        >
          {/* 선택적 닫기 버튼 - 명시적인 닫기 액션 제공 */}
          {/* Why: 제스처나 마스크 클릭 외에도 명확한 닫기 버튼으로 접근성 향상 */}
          {props.showCloseButton && (
            <a
              className={classNames(
                `${classPrefix}-close-icon`, // 닫기 버튼 기본 스타일
                'adm-plain-anchor' // 링크 스타일 초기화 클래스
              )}
              onClick={() => {
                props.onClose?.() // 팝업 닫기 실행
              }}
              role='button' // 접근성: 버튼 역할 명시
              aria-label={locale.common.close} // 접근성: 현지화된 닫기 라벨
            >
              {props.closeIcon} {/* 사용자 지정 또는 기본 닫기 아이콘 */}
            </a>
          )}

          {/* 팝업 내부 콘텐츠 - 사용자가 제공하는 실제 내용 */}
          {props.children}
        </animated.div>
      </div>
    )
  )

  // 최종 렌더링 - 조건부 렌더링과 Portal을 통한 유연한 배치
  // Why: 성능 최적화와 z-index 관리를 위한 조건부 렌더링 및 Portal 사용
  // How: ShouldRender로 생명주기 관리, renderToContainer로 원하는 DOM 위치에 배치
  return (
    <ShouldRender
      active={active} // 현재 활성 상태 (애니메이션 고려)
      forceRender={props.forceRender} // 강제 렌더링 여부
      destroyOnClose={props.destroyOnClose} // 닫힐 때 DOM 완전 제거 여부
    >
      {/* Portal을 통한 컨테이너 렌더링 */}
      {/* Why: body나 지정된 컨테이너에 렌더링하여 z-index 및 스타일링 문제 해결 */}
      {renderToContainer(props.getContainer, node)}
    </ShouldRender>
  )
}
