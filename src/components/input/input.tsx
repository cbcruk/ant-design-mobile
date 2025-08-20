// 📝 Input: 모바일 환경에 최적화된 고급 텍스트 입력 컴포넌트
// Why: 네이티브 input의 한계를 극복하고 모바일 UX, 다국어 입력, 접근성을 종합적으로 개선
// How: IME 처리 + 플랫폼별 최적화 + 숫자 검증 + 클리어 기능 + forwardRef 패턴으로 완전한 입력 솔루션 제공

import { CloseCircleFill } from 'antd-mobile-icons'
import classNames from 'classnames'
import React, {
  ReactNode,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { bound } from '../../utils/bound'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { isIOS } from '../../utils/validate'
import { mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import useInputHandleKeyDown from './useInputHandleKeyDown'

// CSS 클래스 네임스페이스: 컴포넌트별 스타일 격리를 위한 접두사
// Why: 다른 컴포넌트와의 CSS 충돌 방지 및 일관된 네이밍 규칙 적용
const classPrefix = `adm-input`

// ===== 타입 정의 시스템 =====

// 네이티브 HTML Input 속성들의 완전한 타입 정의
// Why: TypeScript의 타입 안전성을 확보하면서 React의 표준 input 속성들을 모두 지원
type NativeInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

// 접근성 관련 내부 사용 속성들: ARIA 표준을 따르는 접근성 개선 속성
// Why: 스크린 리더 등 보조 기술과의 호환성 확보 (현재는 내부 용도로만 사용)
type AriaProps = {
  // These props currently are only used internally. They are not exported to users:
  role?: string // ARIA role 속성 (button, textbox, searchbox 등)
}

// 🎯 메인 Props 인터페이스: 네이티브 속성 + 커스텀 기능 + 스타일링 + 접근성의 종합 집합
// Why: HTML input의 핵심 기능은 유지하면서 모바일 UX 개선을 위한 추가 기능들을 제공
// How: Pick으로 필요한 네이티브 속성만 선별 + 커스텀 속성 추가 + 교집합 타입으로 결합
export type InputProps = Pick<
  NativeInputProps,
  // 📄 텍스트 검증 관련 속성들
  | 'maxLength' // 최대 문자 길이 제한
  | 'minLength' // 최소 문자 길이 제한
  | 'pattern' // 정규식 패턴 검증

  // 🤖 자동화 기능 속성들
  | 'autoComplete' // 브라우저 자동완성 (email, tel, name 등)
  | 'autoFocus' // 페이지 로드 시 자동 포커스
  | 'autoCapitalize' // 모바일에서 자동 대문자화 (iOS)
  | 'autoCorrect' // 모바일에서 자동 맞춤법 교정 (iOS)

  // ⌨️ 입력 방식 및 키보드 설정
  | 'inputMode' // 모바일 키보드 타입 (numeric, decimal, tel 등)
  | 'type' // HTML input 타입 (text, number, email, password 등)
  | 'enterKeyHint' // 모바일 엔터키 표시 텍스트 (done, go, next, search 등)
  | 'step' // 숫자 입력 시 스텝 단위

  // 🎫 식별 및 폼 관련
  | 'name' // 폼 제출 시 사용할 name 속성
  | 'id' // DOM 요소 식별자

  // 📝 사용자 인터페이스
  | 'placeholder' // 입력 안내 텍스트
  | 'readOnly' // 읽기 전용 모드
  | 'disabled' // 비활성화 상태

  // 🎯 이벤트 핸들러들: 사용자 상호작용과 입력 생명주기 제어
  | 'onFocus' // 포커스 획득 시
  | 'onBlur' // 포커스 잃을 시
  | 'onPaste' // 붙여넣기 시
  | 'onKeyDown' // 키 눌림 시
  | 'onKeyUp' // 키 떼기 시
  | 'onClick' // 클릭 시

  // 🌏 다국어 입력 지원 (IME: Input Method Editor)
  | 'onCompositionStart' // IME 입력 시작 (한글, 중국어, 일본어 등)
  | 'onCompositionEnd' // IME 입력 완료
> & {
  // ===== 커스텀 Props: ant-design-mobile만의 고유 기능들 =====

  // 🔄 상태 관리
  value?: string // 제어 컴포넌트 값
  defaultValue?: string // 비제어 컴포넌트 초기값
  onChange?: (val: string) => void // 값 변경 콜백 (네이티브와 달리 string만 전달)

  // 🧹 클리어 기능 관련
  clearable?: boolean // 클리어 버튼 표시 여부
  clearIcon?: ReactNode // 커스텀 클리어 아이콘
  onlyShowClearWhenFocus?: boolean // 포커스 시에만 클리어 버튼 표시
  onClear?: () => void // 클리어 버튼 클릭 콜백

  // ⌨️ 키보드 인터랙션
  onEnterPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void // 엔터키 전용 핸들러

  // 🔢 숫자 입력 범위 제한
  min?: number // 최소값 (type="number"일 때)
  max?: number // 최대값 (type="number"일 때)
} & NativeProps<
    // 🎨 CSS 커스텀 속성들: CSS-in-JS 방식의 테마 커스터마이징 지원
    | '--font-size' // 폰트 크기 조정
    | '--color' // 텍스트 색상
    | '--placeholder-color' // placeholder 색상
    | '--text-align' // 텍스트 정렬 (left, center, right)
  > &
  AriaProps // 접근성 속성 추가

// ===== 기본값 설정 =====

// 컴포넌트 기본 설정: 가장 일반적인 사용 패턴에 맞춘 기본값들
// Why: 사용자가 최소한의 props만으로도 완전한 기능을 사용할 수 있도록 함
const defaultProps = {
  defaultValue: '', // 빈 문자열로 시작 (undefined 방지)
  clearIcon: <CloseCircleFill />, // ant-design-mobile 아이콘 라이브러리의 표준 X 아이콘
  onlyShowClearWhenFocus: true, // UX 개선: 포커스 시에만 클리어 버튼 표시로 깔끔한 인터페이스 유지
}

// ===== Ref 인터페이스 =====

// 🎯 InputRef: 부모 컴포넌트에서 Input을 명령형으로 제어할 수 있는 메서드들
// Why: React의 선언적 패러다임과 함께 명령형 제어도 지원하여 복잡한 UX 구현 가능
// How: useImperativeHandle을 통해 선택적으로 노출할 메서드들을 정의
export type InputRef = {
  clear: () => void // 프로그래매틱 클리어: 외부에서 입력값 초기화
  focus: () => void // 프로그래매틱 포커스: 외부에서 입력 필드에 포커스 설정
  blur: () => void // 프로그래매틱 블러: 외부에서 포커스 해제
  nativeElement: HTMLInputElement | null // 네이티브 DOM 요소 접근: 고급 DOM 조작이 필요한 경우
}

// ===== 메인 컴포넌트 구현부 =====

// 🎯 Input 컴포넌트: 모바일 퍼스트 설계로 만들어진 고급 텍스트 입력 컴포넌트
// Why: 네이티브 input의 한계(IME 처리, 모바일 UX, 접근성)를 극복하고 통합된 입력 경험 제공
// How: forwardRef 패턴으로 외부 제어 지원 + 내부 상태 관리 + 플랫폼별 최적화 결합

// 핵심 특징들:
// 1. 🌏 다국어 IME 입력 완벽 지원 (한글, 중국어, 일본어 등)
// 2. 📱 모바일 키보드 최적화 (inputMode, enterKeyHint 등)
// 3. 🔢 숫자 입력 범위 검증 및 자동 보정
// 4. 🧹 스마트 클리어 버튼 (포커스 상태 기반)
// 5. 🍎 iOS 특화 버그 해결 (IME + 클리어 조합 시 이슈)
// 6. ♿ 접근성 표준 준수 (ARIA, 키보드 네비게이션)
// 7. 🎨 CSS 커스텀 속성 지원으로 유연한 테마 적용

export const Input = forwardRef<InputRef, InputProps>((props, ref) => {
  // ===== 설정 및 Props 병합 =====

  // 다국어 및 전역 설정 로드
  // Why: locale 정보로 클리어 버튼 접근성 텍스트 등을 다국어 지원
  // How: useConfig 훅으로 ConfigProvider에서 설정된 전역 값들을 가져옴
  const { locale, input: componentConfig = {} } = useConfig()

  // 우선순위 기반 Props 병합: 기본값 < 전역 설정 < 사용자 전달값
  // Why: 일관된 기본 동작 유지하면서 전역/개별 커스터마이징 모두 지원
  // How: mergeProps 유틸로 undefined가 아닌 값들만 선택적으로 병합
  const mergedProps = mergeProps(defaultProps, componentConfig, props)

  // 제어/비제어 컴포넌트 상태 관리: value/defaultValue props에 따라 자동 판단
  // Why: React의 표준 패턴에 따라 제어형(controlled)/비제어형(uncontrolled) 모두 지원
  // How: usePropsValue 훅이 value 존재 여부에 따라 내부 상태 또는 외부 상태 사용 결정
  const [value, setValue] = usePropsValue(mergedProps)

  // ===== 내부 상태 관리 =====

  // 포커스 추적: UI 피드백과 클리어 버튼 표시 제어를 위한 중요한 상태
  // Why: 클리어 버튼의 onlyShowClearWhenFocus 옵션과 시각적 피드백에 필수
  // How: onFocus/onBlur 이벤트에서 true/false로 토글
  const [hasFocus, setHasFocus] = useState(false)

  // IME 입력 추적: 다국어 입력 시 중간 상태와 최종 상태를 구분하는 핵심 로직
  // Why: 한글, 중국어, 일본어 등 조합 문자 입력 중에는 onChange가 여러 번 발생하여
  //      의도하지 않은 동작(숫자 검증, 길이 제한 등)이 중간에 실행될 수 있음
  // How: onCompositionStart/End 이벤트로 IME 입력 구간을 정확히 추적
  const compositionStartRef = useRef(false)

  // 네이티브 input 요소 참조: 명령형 메서드와 iOS 버그 해결을 위해 필요
  // Why: focus(), blur(), iOS IME 이슈 해결 등에서 직접 DOM 조작이 필요
  // How: useRef로 HTMLInputElement 참조 저장, forwardRef를 통해 외부 노출
  const nativeInputRef = useRef<HTMLInputElement>(null)

  // ===== 훅 및 이벤트 핸들러 설정 =====

  // 키보드 이벤트 통합 처리: 엔터키 특수 처리 + 일반 키 이벤트를 하나의 핸들러로 결합
  // Why: 엔터키는 폼 제출, 검색 등 특별한 의미를 가지므로 별도 핸들러가 필요한 경우가 많음
  // How: useInputHandleKeyDown 훅으로 두 핸들러를 효율적으로 통합
  const handleKeydown = useInputHandleKeyDown({
    onEnterPress: mergedProps.onEnterPress, // 엔터키 전용 핸들러
    onKeyDown: mergedProps.onKeyDown, // 모든 키에 대한 일반 핸들러
  })

  // ===== Ref 메서드 노출 (명령형 API) =====

  // 외부에서 Input을 명령형으로 제어할 수 있는 메서드들을 선택적으로 노출
  // Why: React의 선언적 방식과 함께 때로는 명령형 제어가 필요한 복잡한 UX 구현 지원
  // How: useImperativeHandle로 안전하게 제어된 API만 외부에 노출
  useImperativeHandle(ref, () => ({
    // 프로그래매틱 클리어: 외부에서 입력값을 강제로 초기화
    // 사용 사례: 폼 리셋, 검색어 클리어, 에러 후 필드 초기화 등
    clear: () => {
      setValue('') // 내부 상태를 빈 문자열로 설정
      // 주의: onChange 콜백도 자동으로 호출됨 (setValue 내부 로직)
    },

    // 프로그래매틱 포커스: 외부에서 입력 필드에 포커스 설정
    // 사용 사례: 폼 첫 번째 필드 자동 포커스, 에러 필드로 포커스 이동 등
    focus: () => {
      nativeInputRef.current?.focus() // 네이티브 DOM 메서드 직접 호출
      // 부수 효과: onFocus 이벤트도 자동으로 발생하여 hasFocus 상태 업데이트됨
    },

    // 프로그래매틱 블러: 외부에서 포커스를 강제로 해제
    // 사용 사례: 유효성 검사 후 다음 필드로 이동, 모달 닫기 전 포커스 정리 등
    blur: () => {
      nativeInputRef.current?.blur() // 네이티브 DOM 메서드 직접 호출
      // 부수 효과: onBlur 이벤트도 자동으로 발생하여 checkValue() 실행됨
    },

    // 네이티브 DOM 요소 접근: 고급 DOM 조작이나 서드파티 라이브러리 연동에 필요
    // 사용 사례: 스크롤 위치 조정, 애니메이션 라이브러리 연동, 브라우저 API 직접 사용 등
    get nativeElement() {
      return nativeInputRef.current // getter 방식으로 현재 DOM 요소 반환
      // 주의: null일 수 있으므로 사용 전에 null 체크 필요
    },
  }))

  // ===== 핵심 로직 함수들 =====

  // 🔢 숫자 입력 값 검증 및 정규화: type="number"일 때 사용자 입력을 안전한 형태로 변환
  // Why: 브라우저 기본 숫자 검증만으로는 한계가 있고, 사용자 경험상 실시간 피드백 필요
  // How: onBlur 시점에 범위 검증 + 숫자 형식 정규화를 통해 일관된 값 보장
  function checkValue() {
    let nextValue = value // 현재 값을 기준으로 검증 시작

    // 숫자 타입 전용 처리: type="number"인 경우에만 특별한 검증 로직 적용
    if (mergedProps.type === 'number') {
      // 범위 제한 적용: bound 유틸리티로 min/max 범위 내로 값 제한
      // Why: 사용자가 범위를 벗어난 값을 입력해도 유효한 범위 내로 자동 보정
      // How: parseFloat로 숫자 변환 → bound로 범위 제한 → toString으로 문자열 복원
      const boundValue =
        nextValue && // 빈 값이 아닌 경우에만 처리
        bound(
          parseFloat(nextValue), // 문자열을 실수로 변환
          mergedProps.min, // 최소값 (undefined면 제한 없음)
          mergedProps.max // 최대값 (undefined면 제한 없음)
        ).toString()

      // 숫자 정규화: "01" → "1", "3.00" → "3" 등 일관된 형태로 변환
      // Why: 사용자가 "01"을 입력해도 화면에는 "1"로 표시되어야 혼란 방지
      // How: Number() 생성자로 숫자 변환 비교를 통해 실제 값이 다른지 확인
      if (Number(nextValue) !== Number(boundValue)) {
        nextValue = boundValue // 정규화된 값으로 교체
      }

      // 추가 고려사항들:
      // - parseFloat는 "123abc" → 123으로 변환하므로 부분적으로 유효한 입력도 처리
      // - bound 함수는 NaN을 안전하게 처리하여 min/max 범위 내 값 반환
      // - toString() 변환으로 숫자를 다시 문자열로 만들어 input value와 호환
    }

    // 값 변경 적용: 검증/정규화 후 실제로 값이 변경된 경우에만 상태 업데이트
    // Why: 불필요한 리렌더링 방지와 onChange 콜백 중복 호출 방지
    // How: 엄격한 동등성 비교로 실제 변경 여부 확인
    if (nextValue !== value) {
      setValue(nextValue) // usePropsValue 훅을 통해 제어/비제어 상태 모두 지원
      // 부수 효과: setValue 호출 시 onChange 콜백도 자동으로 실행됨
    }
  }

  // 클리어 버튼 표시 조건 로직: 복합적인 UX 고려사항들의 집합
  // 1. clearable이 false면 절대 표시하지 않음
  // 2. value가 없으면 클리어할 내용이 없으므로 표시하지 않음
  // 3. readOnly 상태에서는 편집할 수 없으므로 표시하지 않음
  // 4. onlyShowClearWhenFocus 옵션에 따라 포커스 상태에서만 표시하거나 항상 표시
  // 이 로직으로 클리어 버튼의 불필요한 표시를 방지하고 사용자 혼란 최소화
  const shouldShowClear = (() => {
    if (!mergedProps.clearable || !value || mergedProps.readOnly) return false
    if (mergedProps.onlyShowClearWhenFocus) {
      return hasFocus
    } else {
      return true
    }
  })()

  return withNativeProps(
    mergedProps,
    <div
      className={classNames(
        `${classPrefix}`,
        mergedProps.disabled && `${classPrefix}-disabled`
      )}
    >
      <input
        ref={nativeInputRef}
        className={`${classPrefix}-element`}
        value={value}
        onChange={e => {
          setValue(e.target.value)
        }}
        onFocus={e => {
          setHasFocus(true)
          mergedProps.onFocus?.(e)
        }}
        onBlur={e => {
          setHasFocus(false)
          checkValue()
          mergedProps.onBlur?.(e)
        }}
        onPaste={mergedProps.onPaste}
        id={mergedProps.id}
        placeholder={mergedProps.placeholder}
        disabled={mergedProps.disabled}
        readOnly={mergedProps.readOnly}
        maxLength={mergedProps.maxLength}
        minLength={mergedProps.minLength}
        max={mergedProps.max}
        min={mergedProps.min}
        autoComplete={mergedProps.autoComplete}
        enterKeyHint={mergedProps.enterKeyHint}
        autoFocus={mergedProps.autoFocus}
        pattern={mergedProps.pattern}
        inputMode={mergedProps.inputMode}
        type={mergedProps.type}
        name={mergedProps.name}
        autoCapitalize={mergedProps.autoCapitalize}
        autoCorrect={mergedProps.autoCorrect}
        onKeyDown={handleKeydown}
        onKeyUp={mergedProps.onKeyUp}
        onCompositionStart={e => {
          compositionStartRef.current = true
          mergedProps.onCompositionStart?.(e)
        }}
        onCompositionEnd={e => {
          compositionStartRef.current = false
          mergedProps.onCompositionEnd?.(e)
        }}
        onClick={mergedProps.onClick}
        step={mergedProps.step}
        role={mergedProps.role}
        aria-valuenow={mergedProps['aria-valuenow']}
        aria-valuemax={mergedProps['aria-valuemax']}
        aria-valuemin={mergedProps['aria-valuemin']}
        aria-label={mergedProps['aria-label']}
      />
      {/* 클리어 버튼: 플랫폼별 특수 처리가 포함된 고도화된 구현 */}
      {shouldShowClear && (
        <div
          className={`${classPrefix}-clear`}
          onMouseDown={e => {
            // 클리어 버튼 클릭 시 input에서 포커스가 제거되는 것을 방지
            // 문제: 클리어 버튼을 클릭하면 input이 blur되어 클리어 버튼이 즉시 사라짐
            // 해결: preventDefault로 기본 동작을 막아 포커스 유지
            e.preventDefault()
          }}
          onClick={() => {
            setValue('')
            mergedProps.onClear?.()

            // iOS 특화 처리: IME 입력 중 클리어 시 발생하는 버그 해결
            // 문제: iOS에서 IME 입력 중 클리어하면 입력기가 비정상 상태로 남아있음
            // 해결: composition 상태 확인 후 강제로 blur하여 입력기 초기화
            // 참조: https://github.com/ant-design/ant-design-mobile/issues/5212
            if (isIOS() && compositionStartRef.current) {
              compositionStartRef.current = false
              nativeInputRef.current?.blur()
            }
          }}
          aria-label={locale.Input.clear}
        >
          {mergedProps.clearIcon}
        </div>
      )}
    </div>
  )
})
