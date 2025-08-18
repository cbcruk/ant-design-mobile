// Mask 컴포넌트: 모달이나 팝업의 배경 오버레이 역할을 하는 컴포넌트
// Why: 사용자 인터랙션을 차단하고 배경을 어둡게 하여 특정 콘텐츠에 집중시키기 위함
// How: fixed position으로 전체 화면을 덮고, 애니메이션과 접근성을 지원

import { animated, useSpring } from '@react-spring/web' // 부드러운 애니메이션 처리
import { useUnmountedRef } from 'ahooks' // 컴포넌트 언마운트 상태 감지용 훅
import type { FC, ReactNode } from 'react'
import React, { useMemo, useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import {
  GetContainer,
  renderToContainer,
} from '../../utils/render-to-container' // 특정 컨테이너에 렌더링하는 유틸
import { ShouldRender } from '../../utils/should-render' // 조건부 렌더링 최적화
import { useLockScroll } from '../../utils/use-lock-scroll' // 배경 스크롤 잠금 기능
import { mergeProps } from '../../utils/with-default-props' // props와 기본값 병합
import {
  PropagationEvent,
  withStopPropagation,
} from '../../utils/with-stop-propagation' // 이벤트 전파 제어
import { useConfig } from '../config-provider' // 다국화 및 전역 설정

// CSS 클래스 접두사 - BEM 방식의 명명 규칙 적용
const classPrefix = `adm-mask`

// 투명도 레벨 정의
// Why: 다양한 사용 상황에 맞는 투명도 옵션 제공 (가독성/집중도 조절)
// How: 수치값으로 투명도를 관리하여 일관된 디자인 시스템 구축
const opacityRecord = {
  default: 0.55, // 기본 투명도 - 55%
  thin: 0.35, // 얇은 투명도 - 35% (덜 강조)
  thick: 0.75, // 진한 투명도 - 75% (강한 강조)
}

// 색상 정의 - RGB 값으로 관리
// Why: rgba() 함수에서 사용하기 위해 RGB 값만 분리하여 저장
// How: 문자열로 RGB 값을 저장하고 runtime에 opacity와 결합
const colorRecord: Record<string, string> = {
  black: '0, 0, 0', // 검은색 마스크 (일반적인 용도)
  white: '255, 255, 255', // 흰색 마스크 (특수한 디자인 요구사항)
}

// Mask 컴포넌트의 Props 타입 정의
// Why: TypeScript로 타입 안정성을 보장하고 개발자 경험(DX) 향상
// How: 각 속성의 목적과 타입을 명확히 정의하여 오류 방지
export type MaskProps = {
  // 마스크 표시/숨김 제어
  visible?: boolean

  // 마스크 클릭 시 호출되는 콜백 함수
  // Why: 모달 닫기 등의 사용자 인터랙션 처리
  onMaskClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void

  // 컴포넌트가 닫힐 때 DOM에서 완전히 제거할지 여부
  // Why: 메모리 최적화와 성능 개선 (필요 시 DOM 노드 제거)
  destroyOnClose?: boolean

  // visible이 false여도 DOM에 렌더링할지 여부
  // Why: 초기 애니메이션이나 측정이 필요한 경우 사용
  forceRender?: boolean

  // 배경 스크롤을 차단할지 여부
  // Why: 모달이 열렸을 때 배경 콘텐츠 스크롤 방지
  disableBodyScroll?: boolean

  // 마스크 색상 - 사전 정의된 색상 또는 커스텀 색상
  // Why: 다양한 디자인 요구사항에 대응
  color?: 'white' | 'black' | (string & {})

  // 투명도 설정 - 사전 정의된 레벨 또는 직접 수치
  // Why: 다양한 강조 수준 제공
  opacity?: 'default' | 'thin' | 'thick' | number

  // 렌더링할 컨테이너 지정 함수
  // Why: Portal을 통해 특정 DOM 노드에 렌더링 가능
  getContainer?: GetContainer

  // 마스크가 완전히 나타난 후 호출되는 콜백
  // Why: 애니메이션 완료 후 추가 로직 실행
  afterShow?: () => void

  // 마스크가 완전히 사라진 후 호출되는 콜백
  // Why: 정리 작업이나 후속 액션 처리
  afterClose?: () => void

  // 이벤트 버블링을 중단할 이벤트 타입들
  // Why: 의도하지 않은 이벤트 전파 방지
  stopPropagation?: PropagationEvent[]

  // 마스크 위에 렌더링될 자식 요소들
  children?: ReactNode
} & NativeProps<'--z-index'> // CSS 커스텀 속성 z-index 지원

// 기본 Props 설정
// Why: 가장 일반적인 사용 케이스에 맞는 기본값 제공으로 사용성 향상
// How: 사용자가 명시적으로 설정하지 않은 경우 적용되는 안전한 기본값들
const defaultProps = {
  visible: true, // 기본적으로 표시됨
  destroyOnClose: false, // 성능을 위해 DOM에 유지 (재사용 가능)
  forceRender: false, // 필요할 때만 렌더링 (메모리 효율성)
  color: 'black', // 일반적인 검은색 마스크
  opacity: 'default', // 적절한 가시성을 위한 기본 투명도
  disableBodyScroll: true, // 모달 사용성을 위해 배경 스크롤 차단
  getContainer: null, // body에 직접 렌더링
  stopPropagation: ['click'], // 클릭 이벤트 전파만 차단 (일반적인 케이스)
}

// Mask 컴포넌트 구현
// Why: 모달/팝업의 배경 오버레이를 제공하여 사용자 경험과 접근성 향상
// How: React Spring으로 부드러운 애니메이션, 접근성 지원, 이벤트 제어 등 구현
export const Mask: FC<MaskProps> = p => {
  // 기본값과 사용자 props 병합
  // Why: 기본값 제공으로 사용성 향상, 사용자 설정 우선 적용
  const props = mergeProps(defaultProps, p)

  // 다국화 설정 가져오기
  // Why: 접근성 라벨에 사용할 현지화된 텍스트 제공
  const { locale } = useConfig()

  // DOM 참조 - 스크롤 잠금에 사용
  // Why: useLockScroll이 특정 요소를 기준으로 스크롤을 제어하기 위함
  const ref = useRef<HTMLDivElement>(null)

  // 배경 스크롤 잠금 기능
  // Why: 마스크가 활성화된 상태에서 배경 콘텐츠 스크롤을 방지하여 UX 향상
  // How: visible과 disableBodyScroll 조건을 모두 만족할 때만 잠금 활성화
  useLockScroll(ref, props.visible && props.disableBodyScroll)

  // 배경색 계산 - 성능 최적화를 위한 메모이제이션
  // Why: color와 opacity 조합이 변경될 때만 재계산하여 불필요한 연산 방지
  // How: 사전 정의된 값 또는 사용자 지정 값을 처리하여 최종 CSS 색상 반환
  const background = useMemo(() => {
    // 투명도 값 결정: 사전 정의된 값 또는 직접 입력된 숫자값
    const opacity = opacityRecord[props.opacity] ?? props.opacity

    // RGB 색상 값 조회 (사전 정의된 색상인 경우)
    const rgb = colorRecord[props.color]

    // RGB 값이 있으면 rgba() 형식으로, 없으면 사용자 지정 색상을 그대로 반환
    return rgb ? `rgba(${rgb}, ${opacity})` : props.color
  }, [props.color, props.opacity])

  // 활성 상태 관리 - 애니메이션 중에도 DOM에 유지하기 위함
  // Why: 애니메이션이 진행되는 동안 요소가 화면에서 사라지지 않도록 보장
  const [active, setActive] = useState(props.visible)

  // 언마운트 상태 감지 - 메모리 누수 방지
  // Why: 컴포넌트가 언마운트된 후에도 애니메이션 콜백이 실행되는 것을 방지
  const unmountedRef = useUnmountedRef()

  // React Spring을 이용한 부드러운 애니메이션 구현
  // Why: 급작스러운 나타남/사라짐 대신 자연스러운 전환 효과 제공
  // How: opacity를 0에서 1로 (또는 그 반대) 부드럽게 전환
  const { opacity } = useSpring({
    opacity: props.visible ? 1 : 0, // 목표 투명도 값
    config: {
      precision: 0.01, // 애니메이션 정밀도 (0.01 차이까지 계산)
      mass: 1, // 물체의 질량 (애니메이션 속도에 영향)
      tension: 250, // 스프링 장력 (높을수록 빠른 애니메이션)
      friction: 30, // 마찰력 (높을수록 덜 튀는 애니메이션)
      clamp: true, // 목표값을 초과하지 않도록 제한
    },
    // 애니메이션 시작 시 콜백
    // Why: 나타나는 애니메이션이 시작되면 즉시 active 상태로 전환
    onStart: () => {
      setActive(true)
    },
    // 애니메이션 완료 시 콜백
    // Why: 애니메이션 완료 후 상태 정리 및 사용자 콜백 실행
    onRest: () => {
      // 컴포넌트가 언마운트되었다면 콜백 실행하지 않음
      if (unmountedRef.current) return

      // 애니메이션 완료 후 최종 상태 설정
      setActive(props.visible)

      // 사용자 정의 콜백 실행
      if (props.visible) {
        props.afterShow?.() // 나타난 후 콜백
      } else {
        props.afterClose?.() // 사라진 후 콜백
      }
    },
  })

  // DOM 노드 구성 - 이벤트 제어와 네이티브 속성을 적용한 마스크 요소
  // Why: 재사용 가능한 컴포넌트로서 다양한 설정과 접근성을 지원
  // How: HOC 패턴으로 이벤트 전파 제어 및 네이티브 속성 적용
  const node = withStopPropagation(
    props.stopPropagation, // 지정된 이벤트들의 전파 차단
    withNativeProps(
      // CSS 커스텀 속성 등 네이티브 속성 적용
      props,
      <animated.div
        className={classPrefix}
        ref={ref}
        aria-hidden // 스크린 리더에서 숨김 (접근성)
        style={{
          ...props.style, // 사용자 지정 스타일
          background, // 계산된 배경색
          opacity, // 애니메이션되는 투명도
          display: active ? undefined : 'none', // 비활성 시 완전히 숨김
        }}
        // 마스크 클릭 이벤트 핸들러
        // Why: 배경 클릭 시에만 onMaskClick 호출 (자식 요소 클릭은 제외)
        // How: event.target과 event.currentTarget 비교로 정확한 클릭 대상 확인
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          if (e.target === e.currentTarget) {
            props.onMaskClick?.(e)
          }
        }}
      >
        {/* 접근성을 위한 버튼 요소 - 스크린 리더 사용자를 위함 */}
        {/* Why: 마우스 사용자뿐만 아니라 키보드/스크린 리더 사용자도 마스크를 조작할 수 있도록 */}
        {props.onMaskClick && (
          <div
            className={`${classPrefix}-aria-button`}
            role='button' // 버튼 역할 명시
            aria-label={locale.Mask.name} // 현지화된 접근성 라벨
            onClick={props.onMaskClick}
          />
        )}

        {/* 마스크 위에 표시될 실제 콘텐츠 영역 */}
        {/* Why: 마스크와 콘텐츠를 분리하여 z-index 및 이벤트 처리 최적화 */}
        <div className={`${classPrefix}-content`}>{props.children}</div>
      </animated.div>
    )
  )

  // 최종 렌더링 - 조건부 렌더링과 포털을 통한 컨테이너 렌더링
  // Why: 성능 최적화와 유연한 렌더링 위치 제어를 위함
  // How: ShouldRender로 렌더링 조건 제어, renderToContainer로 원하는 위치에 렌더링
  return (
    <ShouldRender
      active={active} // 현재 활성 상태
      forceRender={props.forceRender} // 강제 렌더링 여부
      destroyOnClose={props.destroyOnClose} // 닫힐 때 DOM 제거 여부
    >
      {/* 지정된 컨테이너 또는 기본 위치에 렌더링 */}
      {/* Why: 모달의 경우 보통 body 직하위나 특정 포털 컨테이너에 렌더링해야 z-index 문제 해결 */}
      {renderToContainer(props.getContainer, node)}
    </ShouldRender>
  )
}
