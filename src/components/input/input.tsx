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

// 입력 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-input`

type NativeInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

type AriaProps = {
  // These props currently are only used internally. They are not exported to users:
  role?: string
}

export type InputProps = Pick<
  NativeInputProps,
  | 'maxLength'
  | 'minLength'
  | 'autoComplete'
  | 'autoFocus'
  | 'pattern'
  | 'inputMode'
  | 'type'
  | 'name'
  | 'onFocus'
  | 'onBlur'
  | 'onPaste'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onCompositionStart'
  | 'onCompositionEnd'
  | 'onClick'
  | 'step'
  | 'id'
  | 'placeholder'
  | 'readOnly'
  | 'disabled'
  | 'enterKeyHint'
> & {
  value?: string
  defaultValue?: string
  onChange?: (val: string) => void
  clearable?: boolean
  clearIcon?: ReactNode
  onlyShowClearWhenFocus?: boolean
  onClear?: () => void
  onEnterPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  min?: number
  max?: number
} & NativeProps<
    '--font-size' | '--color' | '--placeholder-color' | '--text-align'
  > &
  AriaProps

const defaultProps = {
  defaultValue: '',
  clearIcon: <CloseCircleFill />,
  onlyShowClearWhenFocus: true,
}

export type InputRef = {
  clear: () => void
  focus: () => void
  blur: () => void
  nativeElement: HTMLInputElement | null
}

// 입력 컴포넌트 - 다국어와 모바일 플랫폼 특성을 고려한 고도화된 입력 필드
// 설계 의도: 네이티브 input의 모든 기능을 유지하면서 모바일 UX 개선과 다국어 입력 지원
// 핵심 특징: IME 입력, 숫자 범위 검증, 포커스 기반 클리어 버튼, iOS 특화 처리
export const Input = forwardRef<InputRef, InputProps>((props, ref) => {
  const { locale, input: componentConfig = {} } = useConfig()
  const mergedProps = mergeProps(defaultProps, componentConfig, props)
  const [value, setValue] = usePropsValue(mergedProps)

  // 포커스 상태: 클리어 버튼 표시와 사용자 상호작용 피드백을 위한 상태
  const [hasFocus, setHasFocus] = useState(false)

  // IME 입력 상태 추적: 중국어, 일본어, 한국어 등의 조합 문자 입력 처리
  // 문제: IME 입력 중에는 onChange가 중간 상태로 여러 번 발생하여 의도하지 않은 동작 유발
  // 해결: composition 이벤트로 IME 입력 구간을 추적하여 적절한 타이밍에만 로직 실행
  const compositionStartRef = useRef(false)
  const nativeInputRef = useRef<HTMLInputElement>(null)

  const handleKeydown = useInputHandleKeyDown({
    onEnterPress: mergedProps.onEnterPress,
    onKeyDown: mergedProps.onKeyDown,
  })

  useImperativeHandle(ref, () => ({
    clear: () => {
      setValue('')
    },
    focus: () => {
      nativeInputRef.current?.focus()
    },
    blur: () => {
      nativeInputRef.current?.blur()
    },
    get nativeElement() {
      return nativeInputRef.current
    },
  }))

  // 숫자 입력 값 검증 및 정규화 함수
  // 문제: 사용자가 min/max 범위를 벗어난 값을 입력하거나 잘못된 숫자 형식을 입력할 수 있음
  // 해결: blur 시점에 값을 검증하여 범위 내로 보정하고 올바른 숫자 형식으로 변환
  function checkValue() {
    let nextValue = value
    if (mergedProps.type === 'number') {
      const boundValue =
        nextValue &&
        bound(
          parseFloat(nextValue),
          mergedProps.min,
          mergedProps.max
        ).toString()
      // "0으로 시작하는 숫자" 표시 이슈 수정
      // 예: 사용자가 "01"을 입력했을 때 "1"로 정규화하여 일관된 표시
      if (Number(nextValue) !== Number(boundValue)) {
        nextValue = boundValue
      }
    }
    if (nextValue !== value) {
      setValue(nextValue)
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
