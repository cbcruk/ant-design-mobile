import { SearchOutline } from 'antd-mobile-icons'
import classNames from 'classnames'
import type { ReactNode } from 'react'
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProp, mergeProps } from '../../utils/with-default-props'
import Button from '../button'
import { useConfig } from '../config-provider'
import Input, { InputProps, InputRef } from '../input'

const classPrefix = `adm-search-bar`

export type SearchBarRef = InputRef

export type SearchBarProps = Pick<
  InputProps,
  | 'onFocus'
  | 'onBlur'
  | 'onClear'
  | 'onCompositionStart'
  | 'onCompositionEnd'
  | 'autoFocus'
> & {
  value?: string
  defaultValue?: string
  maxLength?: number
  placeholder?: string
  clearable?: boolean
  onlyShowClearWhenFocus?: boolean
  showCancelButton?: boolean | ((focus: boolean, value: string) => boolean)
  cancelText?: string
  searchIcon?: ReactNode
  /**
   * @deprecated use `searchIcon` instead
   */
  icon?: ReactNode
  clearOnCancel?: boolean
  onSearch?: (val: string) => void
  onChange?: (val: string) => void
  onCancel?: () => void
} & NativeProps<
    | '--background'
    | '--border-radius'
    | '--placeholder-color'
    | '--height'
    | '--padding-left'
  >

const defaultProps = {
  clearable: true,
  onlyShowClearWhenFocus: false,
  showCancelButton: false as NonNullable<SearchBarProps['showCancelButton']>,
  defaultValue: '',
  clearOnCancel: true,
}

// 검색 바 컴포넌트 - 모바일 최적화된 검색 인터페이스와 동적 취소 버튼 제공
// 설계 의도: 네이티브 모바일 앱의 검색 UX 패턴을 웹에서 구현 (포커스 기반 UI 변화, IME 지원)
// 핵심 특징: 조건부 취소 버튼, 검색 실행 제스처, 다국어 입력 지원, 접근성 최적화
export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (props, ref) => {
    const { locale, searchBar: componentConfig = {} } = useConfig()
    const mergedProps = mergeProps(
      defaultProps,
      componentConfig,
      {
        cancelText: locale.common.cancel, // 다국어 기본 취소 텍스트
      },
      props
    )

    // 아이콘 우선순위 병합: 여러 소스에서 제공되는 아이콘의 우선순위 처리
    // 우선순위: props.searchIcon > props.icon(deprecated) > componentConfig.searchIcon > 기본 SearchOutline
    const searchIcon = mergeProp(
      <SearchOutline />,
      componentConfig.searchIcon,
      props.icon, // 하위 호환성을 위한 deprecated prop
      props.searchIcon
    )

    const [value, setValue] = usePropsValue(mergedProps)

    // 포커스 상태: 취소 버튼 표시와 활성 스타일 적용을 위한 상태
    const [hasFocus, setHasFocus] = useState(false)

    const inputRef = useRef<InputRef>(null)

    // IME 조합 상태: 다국어 입력 중 엔터 키 동작 제어
    // 문제: IME 입력 중에 엔터를 누르면 조합 완료가 아닌 검색이 실행될 수 있음
    // 해결: composition 상태를 추적하여 조합 중에는 검색 실행 차단
    const composingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      clear: () => inputRef.current?.clear(),
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      get nativeElement() {
        return inputRef.current?.nativeElement ?? null
      },
    }))

    // 취소 버튼 렌더링 함수: 동적 표시 조건과 다중 액션 처리
    // 핵심 설계: 함수형 조건부 표시와 취소 시 복합 동작 실행
    const renderCancelButton = () => {
      let isShowCancel: boolean

      // 취소 버튼 표시 조건 결정: 함수형 vs 불린값 처리
      if (typeof mergedProps.showCancelButton === 'function') {
        // 커스텀 함수: 포커스 상태와 값에 따른 세밀한 제어 가능
        // 예: 값이 있을 때만 표시, 특정 조건에서만 표시 등
        isShowCancel = mergedProps.showCancelButton(hasFocus, value)
      } else {
        // 기본 동작: 포커스 상태와 showCancelButton 설정에 따라 결정
        isShowCancel = mergedProps.showCancelButton && hasFocus
      }

      return (
        isShowCancel && (
          <div className={`${classPrefix}-suffix`}>
            <Button
              fill='none' // 버튼 스타일: 배경 없는 텍스트 버튼
              className={`${classPrefix}-cancel-button`}
              onClick={() => {
                // 취소 버튼 클릭 시 복합 액션 실행
                if (mergedProps.clearOnCancel) {
                  inputRef.current?.clear() // 옵션에 따라 입력값 클리어
                }
                inputRef.current?.blur() // 포커스 해제로 키보드 숨김
                mergedProps.onCancel?.() // 커스텀 취소 콜백 실행
              }}
              onMouseDown={e => {
                // 마우스 다운 이벤트 방지: 버튼 클릭 시 input에서 포커스가 제거되는 것 방지
                // 문제: 취소 버튼 클릭 시 input blur가 먼저 발생하면 버튼이 사라져서 클릭 완료 안됨
                // 해결: preventDefault로 기본 포커스 변경 동작 차단
                e.preventDefault()
              }}
            >
              {mergedProps.cancelText}
            </Button>
          </div>
        )
      )
    }

    return withNativeProps(
      mergedProps,
      <div
        className={classNames(classPrefix, {
          [`${classPrefix}-active`]: hasFocus,
        })}
      >
        <div className={`${classPrefix}-input-box`}>
          {searchIcon && (
            <div className={`${classPrefix}-input-box-icon`}>{searchIcon}</div>
          )}
          <Input
            ref={inputRef}
            className={classNames(`${classPrefix}-input`, {
              [`${classPrefix}-input-without-icon`]: !searchIcon,
            })}
            value={value}
            onChange={setValue}
            maxLength={mergedProps.maxLength}
            autoFocus={mergedProps.autoFocus}
            placeholder={mergedProps.placeholder}
            clearable={mergedProps.clearable}
            onlyShowClearWhenFocus={mergedProps.onlyShowClearWhenFocus}
            onFocus={e => {
              setHasFocus(true)
              mergedProps.onFocus?.(e)
            }}
            onBlur={e => {
              setHasFocus(false)
              mergedProps.onBlur?.(e)
            }}
            onClear={mergedProps.onClear}
            type='search' // HTML5 검색 입력 타입으로 브라우저 최적화
            enterKeyHint='search' // 모바일 키보드의 엔터 키에 "검색" 힌트 표시
            onEnterPress={() => {
              // 엔터 키 검색 실행: IME 조합 중이 아닐 때만 검색 수행
              // 핵심 설계: 다국어 입력의 완성도를 고려한 검색 타이밍 제어
              if (!composingRef.current) {
                inputRef.current?.blur() // 검색 후 키보드 숨김으로 화면 공간 확보
                mergedProps.onSearch?.(value) // 현재 입력값으로 검색 실행
              }
              // composing 중이면 검색하지 않고 문자 조합 완료를 기다림
            }}
            aria-label={locale.SearchBar.name} // 접근성: 스크린 리더용 라벨
            onCompositionStart={e => {
              // IME 조합 시작: 다국어 입력 시작을 추적
              composingRef.current = true
              mergedProps.onCompositionStart?.(e)
            }}
            onCompositionEnd={e => {
              // IME 조합 완료: 다국어 입력 완료를 추적
              composingRef.current = false
              mergedProps.onCompositionEnd?.(e)
            }}
          />
        </div>
        {renderCancelButton()}
      </div>
    )
  }
)
