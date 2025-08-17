import { useIsomorphicLayoutEffect } from 'ahooks'
import type { ReactNode } from 'react'
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import runes from 'runes2'
import useInputHandleKeyDown from '../../components/input/useInputHandleKeyDown'
import { devError } from '../../utils/dev-log'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProps } from '../../utils/with-default-props'

const classPrefix = 'adm-text-area'

export type TextAreaProps = Pick<
  React.DetailedHTMLProps<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    HTMLTextAreaElement
  >,
  | 'autoComplete'
  | 'autoFocus'
  | 'disabled'
  | 'readOnly'
  | 'name'
  | 'onFocus'
  | 'onBlur'
  | 'onCompositionStart'
  | 'onCompositionEnd'
  | 'onClick'
  | 'onKeyDown'
> & {
  onChange?: (val: string) => void
  value?: string
  defaultValue?: string
  placeholder?: string
  rows?: number
  maxLength?: number
  showCount?: boolean | ((length: number, maxLength?: number) => ReactNode)
  autoSize?:
    | boolean
    | {
        minRows?: number
        maxRows?: number
      }
  id?: string
  onEnterPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  enterKeyHint?:
    | 'enter'
    | 'done'
    | 'go'
    | 'next'
    | 'previous'
    | 'search'
    | 'send'
} & NativeProps<
    | '--font-size'
    | '--color'
    | '--placeholder-color'
    | '--disabled-color'
    | '--text-align'
    | '--count-text-align'
  >

export type TextAreaRef = {
  clear: () => void
  focus: () => void
  blur: () => void
  nativeElement: HTMLTextAreaElement | null
}

const defaultProps = {
  rows: 2,
  showCount: false as NonNullable<TextAreaProps['showCount']>,
  autoSize: false as NonNullable<TextAreaProps['autoSize']>,
  defaultValue: '',
}

// 텍스트 에어리어 컴포넌트 - 동적 높이 조절과 유니코드 안전 텍스트 처리가 가능한 고급 다중행 입력 필드
// 설계 의도: 모바일 환경에서 긴 텍스트 입력 시 최적의 UX 제공과 다국어(이모지 포함) 안전 처리
// 핵심 특징: 자동 높이 조절, runes 기반 유니코드 문자 수 계산, IME 입력 지원, 숨겨진 측정 영역
export const TextArea = forwardRef<TextAreaRef, TextAreaProps>(
  (p: TextAreaProps, ref) => {
    const props = mergeProps(defaultProps, p)
    const { autoSize, showCount, maxLength } = props

    // value null 처리: React의 controlled component 원칙 준수
    // 문제: null 값은 uncontrolled component로 전환되어 React 경고 발생
    // 해결: null을 빈 문자열로 변환하여 항상 controlled 상태 유지
    const [value, setValue] = usePropsValue({
      ...props,
      value: props.value === null ? '' : props.value,
    })
    if (props.value === null) {
      devError(
        'TextArea',
        '`value` prop on `TextArea` should not be `null`. Consider using an empty string to clear the component.'
      )
    }

    const nativeTextAreaRef = useRef<HTMLTextAreaElement>(null)

    // 동적 높이 계산을 위한 이전 높이 캐싱
    // 문제: 매번 높이를 재계산하면 깜빡임 현상 발생
    // 해결: 이전 높이를 저장하여 불필요한 재계산 방지
    // GitHub 이슈: https://github.com/ant-design/ant-design-mobile/issues/5961
    const heightRef = useRef<string>('auto')

    // 숨겨진 측정용 textarea: 실제 컨텐츠 높이 정확 계산을 위한 보조 요소
    // 문제: 표시되는 textarea로는 scrollHeight를 정확히 측정할 수 없음 (스크롤 상태가 변할 수 있음)
    // 해결: 동일한 스타일의 숨겨진 textarea로 순수한 컨텐츠 높이 측정
    // GitHub 이슈: https://github.com/ant-design/ant-design-mobile/issues/6051
    const hiddenTextAreaRef = useRef<HTMLTextAreaElement>(null)

    const handleKeydown = useInputHandleKeyDown({
      onEnterPress: props.onEnterPress,
      onKeyDown: props.onKeyDown,
    })

    useImperativeHandle(ref, () => ({
      clear: () => {
        setValue('')
      },
      focus: () => {
        nativeTextAreaRef.current?.focus()
      },
      blur: () => {
        nativeTextAreaRef.current?.blur()
      },
      get nativeElement() {
        return nativeTextAreaRef.current
      },
    }))

    // 자동 높이 조절 로직: 컨텐츠에 맞춰 textarea 높이를 동적으로 조정
    // 핵심 설계: 사용자가 텍스트를 입력할 때마다 스크롤 없이 모든 내용이 보이도록 자동 확장
    useIsomorphicLayoutEffect(() => {
      if (!autoSize) return
      const textArea = nativeTextAreaRef.current
      const hiddenTextArea = hiddenTextAreaRef.current
      if (!textArea) return

      // 이전 높이로 초기화하여 깜빡임 방지
      textArea.style.height = heightRef.current
      if (!hiddenTextArea) return

      // 숨겨진 textarea의 scrollHeight로 실제 필요 높이 계산
      // 이 방식으로 현재 스크롤 상태에 영향받지 않는 정확한 높이 측정 가능
      let height = hiddenTextArea.scrollHeight

      // 세부 높이 제약 조건 적용: minRows/maxRows 기반 높이 범위 제한
      if (typeof autoSize === 'object') {
        const computedStyle = window.getComputedStyle(textArea)
        const lineHeight = parseFloat(computedStyle.lineHeight)

        // 최소 높이 보장: 컨텐츠가 적어도 설정된 행 수만큼은 표시되도록 함
        if (autoSize.minRows) {
          height = Math.max(height, autoSize.minRows * lineHeight)
        }

        // 최대 높이 제한: 너무 커지면 스크롤로 처리하도록 높이 제한
        // 이 지점부터는 다시 스크롤이 나타나며, 이는 의도된 동작임
        if (autoSize.maxRows) {
          height = Math.min(height, autoSize.maxRows * lineHeight)
        }
      }

      // 계산된 높이 적용: 캐시 업데이트와 실제 DOM 반영
      heightRef.current = `${height}px`
      textArea.style.height = `${height}px`
    }, [value, autoSize])

    // IME 조합 입력 상태 추적: 다국어 입력 중 부정확한 maxLength 제한 방지
    const compositingRef = useRef(false)

    // 문자 수 계산 및 표시: 유니코드 안전 문자 수 계산
    // 핵심 설계: JavaScript의 기본 .length는 이모지나 특수 문자를 잘못 계산하는 문제 해결
    // 예: "👨‍👩‍👧‍👦".length = 11, 하지만 실제로는 1개 문자로 인식되어야 함
    // 해결: runes 라이브러리로 유니코드 grapheme cluster 단위의 정확한 문자 수 계산
    let count
    const valueLength = runes(value).length // 유니코드 안전 문자 수
    if (typeof showCount === 'function') {
      // 커스텀 카운터 렌더 함수 지원
      count = showCount(valueLength, maxLength)
    } else if (showCount) {
      // 기본 카운터 UI: "현재글자수" 또는 "현재글자수/최대글자수" 형태
      count = (
        <div className={`${classPrefix}-count`}>
          {maxLength === undefined
            ? valueLength
            : valueLength + '/' + maxLength}
        </div>
      )
    }

    let rows = props.rows
    if (typeof autoSize === 'object') {
      if (autoSize.maxRows && rows > autoSize.maxRows) {
        rows = autoSize.maxRows
      }
      if (autoSize.minRows && rows < autoSize.minRows) {
        rows = autoSize.minRows
      }
    }

    return withNativeProps(
      props,
      <div className={classPrefix}>
        <textarea
          ref={nativeTextAreaRef}
          className={`${classPrefix}-element`}
          rows={rows}
          value={value}
          placeholder={props.placeholder}
          onChange={e => {
            let v = e.target.value
            // 스마트한 최대 길이 제한: IME 입력 중에는 제한하지 않고, 완료 후에만 제한 적용
            // 문제: IME 조합 중에 길이 제한을 적용하면 중간 조합 상태가 잘리면서 의도하지 않은 텍스트 생성
            // 예: 한글 "안녕하세요"를 입력할 때 중간에 "안ㄴ"이 잘리면 "안"만 남게 됨
            // 해결: composition 중이 아닐 때만 길이 제한 적용, 완료 후 onCompositionEnd에서 최종 제한
            if (maxLength && !compositingRef.current) {
              v = runes(v).slice(0, maxLength).join('')
            }
            setValue(v)
          }}
          id={props.id}
          onCompositionStart={e => {
            compositingRef.current = true
            props.onCompositionStart?.(e)
          }}
          onCompositionEnd={e => {
            // IME 조합 완료 처리: 최종 입력 결과에 대한 길이 제한 적용
            compositingRef.current = false
            if (maxLength) {
              // 조합이 완료된 시점에서 최종 텍스트에 대해 유니코드 안전 길이 제한 수행
              // 이 시점의 값은 완전한 문자 단위이므로 안전하게 자를 수 있음
              const v = (e.target as HTMLTextAreaElement).value
              setValue(runes(v).slice(0, maxLength).join(''))
            }
            props.onCompositionEnd?.(e)
          }}
          autoComplete={props.autoComplete}
          autoFocus={props.autoFocus}
          disabled={props.disabled}
          readOnly={props.readOnly}
          name={props.name}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onClick={props.onClick}
          onKeyDown={handleKeydown}
          enterKeyHint={props.enterKeyHint}
        />
        {count}

        {/**
         * 높이 측정 전용 숨겨진 textarea: 정확한 컨텐츠 높이 계산을 위한 보조 요소
         *
         * 숨겨진 textarea의 역할:
         * 1. 실제 textarea와 동일한 스타일과 폰트 적용 (CSS로 처리)
         * 2. 높이만 auto로 설정하여 컨텐츠의 자연스러운 높이 측정
         * 3. scrollHeight 값으로 필요한 정확한 높이 계산
         * 4. 실제 textarea에는 계산된 고정 높이 적용하여 스크롤 제어
         *
         * 이 이중 구조로 다음 문제들을 해결:
         * - 높이 변경 시 깜빡임 현상 방지
         * - 스크롤 상태와 무관한 정확한 높이 측정
         * - 브라우저별 textarea 높이 계산 차이 해결
         */}
        {autoSize && (
          <textarea
            ref={hiddenTextAreaRef}
            className={`${classPrefix}-element ${classPrefix}-element-hidden`}
            value={value} // 실제 textarea와 동일한 값 유지
            rows={rows} // 동일한 초기 행 수 설정
            aria-hidden // 스크린 리더에서 무시
            readOnly // 사용자 상호작용 차단
          />
        )}
      </div>
    )
  }
)

TextArea.defaultProps = defaultProps
