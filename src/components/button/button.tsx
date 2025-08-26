// React 핵심 훅들 import - 컴포넌트 상태 관리와 ref 처리를 위함
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
// TypeScript 타입 정의들 - 강타입 시스템으로 개발자 경험과 코드 안전성 향상
import type {
  ReactNode,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  MouseEventHandler,
} from 'react'
// 조건부 CSS 클래스명 생성을 위한 유틸리티 - 동적 스타일링 구현
import classNames from 'classnames'
// 기본 로딩 인디케이터 컴포넌트 - 일관된 로딩 UI 제공
import DotLoading from '../dot-loading'
// Props 기본값 병합 유틸리티 - 선택적 props와 기본값의 효율적 결합
import { mergeProps } from '../../utils/with-default-props'
// 네이티브 DOM 속성 처리 유틸리티 - HTML 속성과 CSS 변수를 안전하게 전달
import { NativeProps, withNativeProps } from '../../utils/native-props'
// Promise 타입 검사 유틸리티 - 비동기 함수 감지를 위한 런타임 검증
import { isPromise } from '../../utils/validate'

// CSS 클래스 네이밍을 위한 접두사 - BEM 스타일 컨벤션 적용으로 스타일 충돌 방지
const classPrefix = `adm-button`

// HTML 버튼의 모든 네이티브 속성을 포함하는 타입 정의
// DetailedHTMLProps로 이벤트 핸들러와 DOM 속성을 모두 포함
type NativeButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

// 버튼 컴포넌트의 메인 Props 인터페이스
// 설계 목표: 최대한의 커스터마이징 가능성과 사용 편의성을 모두 제공
export type ButtonProps = {
  // 색상 테마 - 시맨틱 색상으로 사용자 의도 명확화
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger'

  // 배경 채우기 방식 - 디자인 시스템의 계층적 중요도 표현
  // solid: 가장 강한 액션, outline: 보조 액션, none: 최소한의 액션
  fill?: 'solid' | 'outline' | 'none'

  // 버튼 크기 - 정보 계층 구조와 터치 영역 고려
  size?: 'mini' | 'small' | 'middle' | 'large'

  // 블록 레벨 요소로 변환 - 모바일에서 전체 너비 버튼 구현시 사용
  block?: boolean

  // 로딩 상태 제어 - 'auto'는 핵심 혁신 기능
  // boolean: 수동 제어, 'auto': Promise 기반 자동 감지 및 관리
  loading?: boolean | 'auto'

  // 로딩 중 표시할 텍스트 - 사용자에게 진행 상황 명시적 안내
  loadingText?: string

  // 커스텀 로딩 아이콘 - 브랜드 정체성 반영 가능
  loadingIcon?: ReactNode

  // 버튼 비활성화 - 접근성과 UX 고려한 상태 관리
  disabled?: boolean

  // 클릭 이벤트 핸들러 - 동기/비동기 함수 모두 지원하는 유연한 설계
  // Promise 반환시 자동 로딩 상태 관리가 핵심 차별화 포인트
  onClick?: (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void | Promise<void>

  // HTML 버튼 타입 - 폼 제출, 리셋 등 시맨틱 기능 지원
  type?: 'submit' | 'reset' | 'button'

  // 버튼 모양 - 디자인 시스템의 시각적 일관성 유지
  shape?: 'default' | 'rounded' | 'rectangular'

  // 버튼 내용 - React 노드로 유연한 컨텐츠 지원
  children?: ReactNode
} & Pick<
  // 네이티브 HTML 버튼 속성 중 필요한 것들만 선택적으로 포함
  // 터치/마우스 이벤트와 폼 관련 속성들로 모바일 최적화 고려
  NativeButtonProps,
  'onMouseDown' | 'onMouseUp' | 'onTouchStart' | 'onTouchEnd' | 'id' | 'form'
> &
  // CSS 커스텀 프로퍼티를 통한 고급 스타일링 지원
  // 테마 시스템과 완전히 호환되는 커스터마이징 방식 제공
  NativeProps<
    | '--text-color' // 텍스트 색상 오버라이드
    | '--background-color' // 배경색 오버라이드
    | '--border-radius' // 테두리 둥글기 커스터마이징
    | '--border-width' // 테두리 두께 조정
    | '--border-style' // 테두리 스타일 변경
    | '--border-color' // 테두리 색상 커스터마이징
  >

// 버튼 컴포넌트의 ref 타입 정의
// forwardRef 패턴으로 부모 컴포넌트에서 DOM 요소에 직접 접근 가능하게 함
// 폼 검증, 포커스 제어, 스크롤 등의 고급 기능 구현에 필요
export type ButtonRef = {
  nativeElement: HTMLButtonElement | null
}

// 기본 속성값 정의 - 가장 일반적이고 안전한 설정들로 구성
// 이 값들은 대부분의 사용 사례에 적합하도록 신중하게 선택됨
const defaultProps: ButtonProps = {
  color: 'default', // 중립적인 기본 색상으로 다양한 컨텍스트에서 사용 가능
  fill: 'solid', // 명확한 액션 버튼으로 인식되도록 배경 채움
  block: false, // 인라인 버튼이 기본, 필요시에만 블록 레벨로 확장
  loading: false, // 초기 상태는 로딩 없음
  loadingIcon: <DotLoading color='currentColor' />, // 브랜드 일관성을 위한 기본 로딩 아이콘
  type: 'button', // 의도치 않은 폼 제출 방지를 위한 안전한 기본값
  shape: 'default', // 표준 모양으로 디자인 시스템 기본값 적용
  size: 'middle', // 중간 크기로 대부분의 UI에 적합한 균형점
}

// ===== Button 컴포넌트 메인 로직 =====
// 혁신적 설계: Promise 기반 자동 로딩 상태 관리를 통한 개발자 경험 향상
// 기존 문제: API 호출 등 비동기 작업마다 개발자가 수동으로 로딩 상태 관리 필요
// 해결책: onClick에서 Promise 반환을 감지하여 자동으로 로딩 UI 표시 및 중복 클릭 방지
export const Button = forwardRef<ButtonRef, ButtonProps>((p, ref) => {
  // Props와 기본값을 병합하여 최종 설정 생성
  // mergeProps는 undefined 값을 기본값으로 대체하는 안전한 병합 수행
  const props = mergeProps(defaultProps, p)

  // ===== 상태 관리 섹션 =====
  // 자동 로딩 모드('auto')에서 사용하는 내부 로딩 상태
  // 문제 상황: 비동기 작업(API 호출) 중 사용자가 버튼을 연속 클릭
  // 해결 방식: Promise 진행 상황을 추적하여 자동으로 로딩 상태 토글
  // 장점: 개발자가 수동으로 setLoading(true/false) 호출할 필요 없음
  const [innerLoading, setInnerLoading] = useState(false)

  // 실제 DOM 버튼 요소 참조 - ref를 통한 외부 접근 제공용
  const nativeButtonRef = useRef<HTMLButtonElement>(null)

  // ===== 상태 계산 로직 =====
  // 최종 로딩 상태 결정: 수동 제어 vs 자동 제어 선택적 지원
  // loading='auto': innerLoading(Promise 추적 결과) 사용
  // loading=boolean: 개발자가 직접 제어하는 값 사용
  // 이 설계로 기존 코드 호환성 유지하면서 새로운 자동 기능 제공
  const loading = props.loading === 'auto' ? innerLoading : props.loading

  // 버튼 비활성화 판단: 명시적 disabled 속성 또는 로딩 중
  // 로딩 중 자동 비활성화로 일관된 UX 제공 (중복 클릭 방지)
  const disabled = props.disabled || loading

  // ===== ref 처리 섹션 =====
  // forwardRef로 전달받은 ref를 통해 네이티브 DOM 요소 접근 인터페이스 제공
  // 사용 사례: 포커스 제어, 스크롤 위치 조정, 폼 검증 등 고급 DOM 조작
  // get 문법으로 지연 평가 구현 - 참조 시점에 최신 DOM 요소 반환 보장
  useImperativeHandle(ref, () => ({
    get nativeElement() {
      return nativeButtonRef.current
    },
  }))

  // ===== 핵심 이벤트 핸들러 =====
  // 혁신적 스마트 클릭 핸들러: Promise 감지 기반 자동 로딩 상태 관리
  //
  // 기존 문제점:
  // - API 호출할 때마다 개발자가 수동으로 setLoading(true/false) 관리
  // - 실수로 로딩 상태 해제를 빼먹으면 버튼이 영구 로딩 상태로 남음
  // - 에러 상황에서 로딩 상태 복구를 까먹기 쉬움
  //
  // 해결 방식:
  // - onClick 반환값이 Promise인지 런타임 검사
  // - Promise라면 자동으로 로딩 상태 on/off 관리
  // - try/catch로 에러 상황에서도 안전한 상태 복구 보장
  const handleClick: MouseEventHandler<HTMLButtonElement> = async e => {
    // onClick 핸들러가 없으면 아무것도 하지 않음
    if (!props.onClick) return

    // onClick 함수 실행 및 반환값 획득
    const promise = props.onClick(e)

    // Promise 타입 검사를 통한 비동기 함수 감지
    // 동기 함수(void 반환): 즉시 완료, 로딩 상태 변경 없음
    // 비동기 함수(Promise 반환): 자동 로딩 상태 관리 활성화
    if (isPromise(promise)) {
      try {
        setInnerLoading(true) // 비동기 작업 시작 - 로딩 UI 표시
        await promise // Promise 완료까지 대기
        setInnerLoading(false) // 성공 시 로딩 해제
      } catch (e) {
        // 에러 발생 시 안전한 복구 처리
        setInnerLoading(false) // 로딩 상태 해제 (버튼 영구 비활성화 방지)
        throw e // 에러 재throw로 상위 컴포넌트 에러 핸들링 지원
      }
    }
  }

  // ===== JSX 렌더링 섹션 =====
  // withNativeProps HOC를 사용하여 네이티브 속성과 CSS 변수를 안전하게 전달
  // 이 패턴으로 커스텀 컴포넌트가 네이티브 HTML 요소처럼 동작
  return withNativeProps(
    props,
    <button
      // DOM 요소 참조 연결 - ref 접근을 위한 필수 설정
      ref={nativeButtonRef}
      // HTML 버튼의 기본 속성들 설정
      type={props.type} // 폼 동작 제어 (submit/reset/button)
      form={props.form} // 연결할 폼 요소 ID
      onClick={handleClick} // 스마트 클릭 핸들러 연결
      // ===== 동적 CSS 클래스명 생성 =====
      // classNames 라이브러리로 조건부 클래스 적용 및 BEM 네이밍 컨벤션 준수
      className={classNames(
        classPrefix, // 기본 클래스: 'adm-button'
        {
          // 색상 테마별 클래스 (color가 'default'가 아닐 때만 적용)
          [`${classPrefix}-${props.color}`]: props.color,

          // 블록 레벨 버튼 여부 - 전체 너비 사용
          [`${classPrefix}-block`]: props.block,

          // 비활성화 상태 - 커서 변경 및 시각적 피드백 차단
          [`${classPrefix}-disabled`]: disabled,

          // fill 스타일별 클래스 (solid는 기본이므로 클래스 없음)
          [`${classPrefix}-fill-outline`]: props.fill === 'outline',
          [`${classPrefix}-fill-none`]: props.fill === 'none',

          // 크기별 클래스 (middle은 기본이므로 클래스 없음)
          [`${classPrefix}-mini`]: props.size === 'mini',
          [`${classPrefix}-small`]: props.size === 'small',
          [`${classPrefix}-large`]: props.size === 'large',

          // 로딩 상태 클래스 - 로딩 애니메이션 스타일 적용
          [`${classPrefix}-loading`]: loading,
        },
        // shape는 항상 적용되는 클래스 (조건부가 아님)
        `${classPrefix}-shape-${props.shape}`
      )}
      // HTML 버튼 비활성화 속성 - 폼 제출 방지 및 접근성 지원
      disabled={disabled}
      // ===== 터치/마우스 이벤트 핸들러 =====
      // 모바일 환경에서 터치 피드백과 데스크톱 환경에서 마우스 피드백 모두 지원
      onMouseDown={props.onMouseDown} // 마우스 누름 시작
      onMouseUp={props.onMouseUp} // 마우스 누름 해제
      onTouchStart={props.onTouchStart} // 터치 시작
      onTouchEnd={props.onTouchEnd} // 터치 끝
    >
      {/* ===== 조건부 콘텐츠 렌더링 ===== */}
      {/* 로딩 상태와 일반 상태에 따른 다른 UI 표시 */}
      {loading ? (
        // 로딩 중: 로딩 아이콘과 텍스트를 가운데 정렬로 표시
        <div className={`${classPrefix}-loading-wrapper`}>
          {props.loadingIcon} {/* 커스터마이징 가능한 로딩 아이콘 */}
          {props.loadingText} {/* 선택적 로딩 텍스트 */}
        </div>
      ) : (
        // 일반 상태: children을 span으로 감싸서 일관된 텍스트 스타일 적용
        <span>{props.children}</span>
      )}
    </button>
  )
})
