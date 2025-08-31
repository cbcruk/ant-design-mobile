import { useMemoizedFn } from 'ahooks'
import type { FC } from 'react'
import React, { useEffect, useRef } from 'react'

// 네이티브 input 엘리먼트의 Props 타입 정의
interface Props {
  type: 'checkbox' | 'radio' // input 타입 - 체크박스와 라디오에서 공용으로 사용
  checked: boolean // 체크 상태
  onChange: (checked: boolean) => void // 상태 변경 핸들러
  disabled?: boolean // 비활성화 상태
  id?: string // HTML id 속성 - label과의 연결을 위해 사용
}

// 네이티브 HTML input 엘리먼트를 래핑한 컴포넌트
// 설계 목적: 브라우저 기본 접근성 기능을 유지하면서 커스텀 이벤트 처리 제공
// 접근성 고려사항: 스크린 리더 지원, 키보드 네비게이션 지원을 위해 실제 input 엘리먼트 유지
export const NativeInput: FC<Props> = props => {
  const inputRef = useRef<HTMLInputElement>(null) // DOM 엘리먼트 참조를 위한 ref

  // 클릭 이벤트 핸들러 메모이제이션 - 불필요한 재렌더링 방지
  // 문제 해결: React 합성 이벤트와 네이티브 이벤트의 이벤트 버블링 충돌 방지
  const handleClick = useMemoizedFn((e: MouseEvent) => {
    e.stopPropagation() // 이벤트 버블링 중단 - 부모 엘리먼트로의 이벤트 전파 방지
    e.stopImmediatePropagation() // 같은 엘리먼트의 다른 리스너로의 이벤트 전파도 중단
    const latestChecked = (e.target as HTMLInputElement).checked // 실제 DOM에서 최신 체크 상태 확인
    if (latestChecked === props.checked) return // 상태가 변경되지 않았다면 early return
    props.onChange(latestChecked) // 상태 변경을 상위 컴포넌트에 알림
  })

  // 네이티브 이벤트 리스너 등록/해제 - React 합성 이벤트의 한계를 보완
  // 문제: React의 onChange는 일부 브라우저에서 예상과 다르게 동작할 수 있음
  // 해결: 네이티브 click 이벤트를 직접 처리하여 일관된 동작 보장
  useEffect(() => {
    if (props.disabled) return // 비활성화 상태에서는 이벤트 리스너 등록하지 않음
    if (!inputRef.current) return // DOM 엘리먼트가 아직 마운트되지 않았다면 대기
    const input = inputRef.current
    input.addEventListener('click', handleClick) // 네이티브 이벤트 리스너 등록
    return () => {
      input.removeEventListener('click', handleClick) // 컴포넌트 언마운트 시 메모리 누수 방지
    }
  }, [props.disabled, props.onChange]) // 의존성 변경 시 이벤트 리스너 재등록

  return (
    <input
      ref={inputRef}
      type={props.type}
      checked={props.checked}
      onChange={() => {}} // 빈 핸들러로 React 경고 방지 - 실제 처리는 click 이벤트에서 수행
      disabled={props.disabled}
      id={props.id} // label의 htmlFor와 연결되어 접근성 향상
    />
  )
}
