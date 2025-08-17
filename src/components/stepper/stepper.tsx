import classNames from 'classnames'
import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { MinusOutline, AddOutline } from 'antd-mobile-icons'
import { useMergedState } from 'rc-util'
import getMiniDecimal, {
  toFixed,
  type DecimalClass,
} from '@rc-component/mini-decimal'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'
import Input, { InputProps, InputRef } from '../input'
import Button from '../button'
import { useConfig } from '../config-provider'

const classPrefix = `adm-stepper`

type ValueProps<ValueType> = {
  allowEmpty: true
  value?: ValueType | null
  defaultValue?: ValueType | null
  onChange?: (value: ValueType | null) => void
}

type ValuePropsWithNull<ValueType> = {
  allowEmpty?: false
  value?: ValueType
  defaultValue?: ValueType
  onChange?: (value: ValueType) => void
}

export type BaseStepperProps<ValueType> = Pick<
  InputProps,
  'onFocus' | 'onBlur'
> &
  (ValuePropsWithNull<ValueType> | ValueProps<ValueType>) & {
    min?: ValueType
    max?: ValueType
    step?: ValueType
    digits?: number
    disabled?: boolean
    inputReadOnly?: boolean

    // Format & Parse
    parser?: (text: string) => ValueType
    formatter?: (value?: ValueType) => string
  } & NativeProps<
    | '--height'
    | '--input-width'
    | '--input-font-size'
    | '--input-background-color'
    | '--border-radius'
    | '--border'
    | '--border-inner'
    | '--active-border'
    | '--button-font-size'
    | '--button-background-color'
    | '--button-width'
    | '--input-font-color'
    | '--button-text-color'
  >

export type NumberStepperProps = BaseStepperProps<number> & {
  // stringMode
  stringMode?: false
}
export type StringStepperProps = BaseStepperProps<string> & {
  // stringMode
  stringMode: true
}

export type StepperProps = NumberStepperProps | StringStepperProps

export type StepperRef = Pick<InputRef, 'blur' | 'focus' | 'nativeElement'>

type DEFAULT_PROPS = 'step'
type MergedStepperProps<ValueType> = Omit<
  BaseStepperProps<ValueType>,
  DEFAULT_PROPS
> &
  Required<Pick<BaseStepperProps<ValueType>, DEFAULT_PROPS>> & {
    stringMode?: boolean
  }

const defaultProps = {
  step: 1,
  disabled: false,
  allowEmpty: false,
}

// 스테퍼 컴포넌트 - 정밀한 decimal 계산과 범위 제한을 지원하는 고도화된 숫자 입력 컨트롤
// 설계 의도: JavaScript의 부동소수점 오차 문제를 해결하고 금융/측정 앱에서 요구하는 정확한 숫자 연산 제공
// 핵심 특징: mini-decimal 라이브러리 기반 정밀 계산, 문자열/숫자 모드, 포커스 기반 표시 형식 전환
export function InnerStepper<ValueType extends number | string>(
  p: StepperProps,
  ref: React.ForwardedRef<StepperRef>
) {
  const props = mergeProps(defaultProps, p)
  const {
    defaultValue = 0 as ValueType,
    value,
    onChange,
    disabled,
    step,
    max,
    min,
    inputReadOnly,
    digits, // 소수점 자릿수 제한
    stringMode, // 문자열 모드: 매우 큰 숫자나 정밀도가 중요한 경우 사용
    formatter, // 표시용 포맷터 (예: 천 단위 구분자, 통화 기호)
    parser, // 입력값 파서 (포맷터의 역변환)
  } = props as MergedStepperProps<ValueType>

  const { locale } = useConfig()

  // ========================== Ref ==========================
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    },
    blur: () => {
      inputRef.current?.blur()
    },
    get nativeElement() {
      return inputRef.current?.nativeElement ?? null
    },
  }))

  // ========================== 정밀 계산 및 포맷팅 함수들 ==========================

  // 소수점 자릿수 고정 함수: digits 설정에 따른 정확한 소수점 처리
  // 핵심 설계: toFixed는 IEEE 754 오차가 없는 문자열 기반 계산 사용
  const fixedValue = (value: ValueType): string => {
    const fixedValue =
      digits !== undefined ? toFixed(value.toString(), '.', digits) : value

    return fixedValue.toString()
  }

  // 타입 변환 함수: DecimalClass를 number 또는 string으로 안전하게 변환
  // stringMode가 true면 정밀도 손실 없이 문자열로, false면 number로 변환
  const getValueAsType = (value: DecimalClass) =>
    (stringMode ? value.toString() : value.toNumber()) as ValueType

  // 입력값 파싱 함수: 사용자 입력을 내부 decimal 형식으로 변환
  // 핵심 설계: 커스텀 파서 우선, 기본적으로는 mini-decimal로 검증
  const parseValue = (text: string): string | null => {
    if (text === '') return null

    // 커스텀 파서가 있으면 우선 사용 (예: 천 단위 구분자 제거, 통화 기호 제거)
    if (parser) {
      return String(parser(text))
    }

    // 기본 decimal 파싱: 유효하지 않은 숫자 형식은 null 반환
    const decimal = getMiniDecimal(text)
    return decimal.isInvalidate() ? null : decimal.toString()
  }

  // 값 포맷팅 함수: 표시용 문자열 생성 (사용자가 보는 형태)
  // 예: 1000 → "1,000" (천 단위 구분자), 1.5 → "$1.50" (통화 형식)
  const formatValue = (value: ValueType | null): string => {
    if (value === null) return ''

    return formatter ? formatter(value) : fixedValue(value)
  }

  // ======================== Value & InputValue ========================
  const [mergedValue, setMergedValue] = useMergedState<ValueType | null>(
    defaultValue,
    {
      value,
      onChange: nextValue => {
        onChange?.(nextValue as ValueType)
      },
    }
  )

  const [inputValue, setInputValue] = useState(() => formatValue(mergedValue))

  // >>>>> 값 검증 및 설정 함수: 범위 제한과 정밀도 보정을 통한 안전한 값 설정
  // 핵심 설계: 모든 값 변경은 이 함수를 거쳐 일관된 검증 적용
  function setValueWithCheck(nextValue: DecimalClass) {
    if (nextValue.isNaN()) return // NaN 값 차단

    let target = nextValue

    // 범위 제한 적용: min/max 경계 내로 값 강제 조정
    // 문제: 사용자가 범위를 벗어난 값을 입력하거나 버튼으로 범위 초과 시도
    // 해결: decimal 정밀 비교로 경계값으로 자동 조정
    if (min !== undefined) {
      const minDecimal = getMiniDecimal(min)
      if (target.lessEquals(minDecimal)) {
        // target <= min인 경우
        target = minDecimal
      }
    }

    if (max !== undefined) {
      const maxDecimal = getMiniDecimal(max)
      if (maxDecimal.lessEquals(target)) {
        // max <= target인 경우
        target = maxDecimal
      }
    }

    // 소수점 자릿수 보정: digits 설정에 따른 반올림 처리
    // 문제: 계산 결과나 사용자 입력이 설정된 소수점 자릿수를 초과할 수 있음
    // 해결: fixedValue로 정확한 자릿수 조정 후 다시 decimal 객체로 변환
    if (digits !== undefined) {
      target = getMiniDecimal(fixedValue(getValueAsType(target)))
    }

    // 최종 값 설정: 타입에 맞게 변환하여 상태 업데이트
    setMergedValue(getValueAsType(target))
  }

  // >>>>> Input
  const handleInputChange = (v: string) => {
    setInputValue(v)
    const valueStr = parseValue(v)

    if (valueStr === null) {
      if (props.allowEmpty) {
        setMergedValue(null)
      } else {
        setMergedValue(defaultValue)
      }
    } else {
      setValueWithCheck(getMiniDecimal(valueStr))
    }
  }

  // ============================== 포커스 기반 표시 형식 전환 ===============================
  const [focused, setFocused] = useState(false)
  const inputRef = React.useRef<InputRef>(null)

  // 포커스 상태 변경 핸들러: 편집 모드와 표시 모드 간 전환
  // 핵심 설계: 포커스 시 원본 값 표시, 블러 시 포맷된 값 표시
  function triggerFocus(nextFocus: boolean) {
    setFocused(nextFocus)

    // 포커스 시 원본 값 표시: 사용자가 실제 값을 편집할 수 있도록 함
    // 예: 표시된 "$1,000.00"을 "1000"으로 변경하여 편집 용이성 제공
    if (nextFocus) {
      setInputValue(
        mergedValue !== null && mergedValue !== undefined
          ? String(mergedValue) // 포맷팅 없는 순수 값
          : ''
      )
    }
  }

  // 포커스 시 텍스트 전체 선택: 빠른 값 교체를 위한 UX 최적화
  useEffect(() => {
    if (focused) {
      inputRef.current?.nativeElement?.select?.()
    }
  }, [focused])

  // 블러 시 포맷된 값으로 복원: 사용자에게 친숙한 형태로 표시
  // 예: 편집 중 "1000"이었던 값을 "$1,000.00" 형태로 복원
  useEffect(() => {
    if (!focused) {
      setInputValue(formatValue(mergedValue))
    }
  }, [focused, mergedValue, digits])

  // ============================ 스텝 연산 및 버튼 상태 제어 ============================

  // 스텝 단위 증감 함수: step 값에 따른 정밀한 덧셈/뺄셈 연산
  // 핵심 설계: mini-decimal을 사용한 부동소수점 오차 없는 계산
  const handleOffset = (positive: boolean) => {
    let stepValue = getMiniDecimal(step)
    if (!positive) {
      stepValue = stepValue.negate() // 음수로 변환 (빼기 연산용)
    }

    // 현재 값에 스텝 값을 더하여 새로운 값 계산
    // mergedValue가 null이면 0부터 시작 (allowEmpty가 true인 경우의 처리)
    setValueWithCheck(
      getMiniDecimal(mergedValue ?? 0).add(stepValue.toString())
    )
  }

  const handleMinus = () => {
    handleOffset(false) // 감소 연산
  }

  const handlePlus = () => {
    handleOffset(true) // 증가 연산
  }

  // 감소 버튼 비활성화 조건: 최소값 도달 여부 확인
  // 문제: 사용자가 최소값 이하로 값을 변경하려 할 때 방지 필요
  // 해결: 현재 값이 최소값과 같거나 작으면 버튼 비활성화
  const minusDisabled = () => {
    if (disabled) return true // 전체 비활성화
    if (mergedValue === null) return false // null 값일 때는 감소 허용 (0부터 시작)
    if (min !== undefined) {
      return mergedValue <= min // 최소값 이하면 비활성화
    }
    return false
  }

  // 증가 버튼 비활성화 조건: 최대값 도달 여부 확인
  const plusDisabled = () => {
    if (disabled) return true // 전체 비활성화
    if (mergedValue === null) return false // null 값일 때는 증가 허용
    if (max !== undefined) {
      return mergedValue >= max // 최대값 이상이면 비활성화
    }
    return false
  }

  // ============================== Render ==============================
  return withNativeProps(
    props,
    <div
      className={classNames(classPrefix, {
        [`${classPrefix}-active`]: focused,
      })}
    >
      <Button
        className={`${classPrefix}-minus`}
        onClick={handleMinus}
        disabled={minusDisabled()}
        fill='none'
        shape='rectangular'
        color='primary'
        aria-label={locale.Stepper.decrease}
      >
        <MinusOutline />
      </Button>
      <div className={`${classPrefix}-middle`}>
        <Input
          ref={inputRef}
          className={`${classPrefix}-input`}
          onFocus={e => {
            triggerFocus(true)
            props.onFocus?.(e)
          }}
          value={inputValue}
          onChange={val => {
            disabled || handleInputChange(val)
          }}
          disabled={disabled}
          onBlur={e => {
            triggerFocus(false)
            props.onBlur?.(e)
          }}
          readOnly={inputReadOnly}
          role='spinbutton'
          aria-valuenow={Number(inputValue)}
          aria-valuemax={Number(max)}
          aria-valuemin={Number(min)}
          inputMode='decimal'
        />
      </div>
      <Button
        className={`${classPrefix}-plus`}
        onClick={handlePlus}
        disabled={plusDisabled()}
        fill='none'
        shape='rectangular'
        color='primary'
        aria-label={locale.Stepper.increase}
      >
        <AddOutline />
      </Button>
    </div>
  )
}

export const Stepper = forwardRef(InnerStepper)
