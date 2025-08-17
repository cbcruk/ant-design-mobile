import { SetStateAction, useRef } from 'react'
import { useMemoizedFn, useUpdate } from 'ahooks'

type Options<T> = {
  value?: T
  defaultValue: T
  onChange?: (v: T) => void
}

// 제어/비제어 컴포넌트 통합 훅 - React의 가장 중요한 설계 패턴 중 하나를 구현하는 핵심 유틸리티
// 설계 의도: value prop이 있으면 제어 컴포넌트(외부 상태), 없으면 비제어 컴포넌트(내부 상태)로 동작
// 핵심 문제 해결: 부모에서 값을 제어할지 자체 상태를 가질지를 props에 따라 동적으로 결정
// 사용 예: Input, Switch, DatePicker 등 모든 폼 컴포넌트의 상태 관리 기반
export function usePropsValue<T>(options: Options<T>) {
  const { value, defaultValue, onChange } = options

  // 강제 리렌더링 트리거: ref 변경은 리렌더링을 유발하지 않으므로 수동으로 업데이트 필요
  // 이유: stateRef.current 변경만으로는 React가 변화를 감지하지 못함
  const update = useUpdate()

  // 상태 저장소: ref를 사용하여 리렌더링 간 값 유지와 즉시 동기화 보장
  // 초기값 결정: value prop이 있으면 제어 모드, 없으면 defaultValue로 비제어 모드
  const stateRef = useRef<T>(value !== undefined ? value : defaultValue)

  // 제어 컴포넌트 동기화: 외부에서 value가 변경되면 즉시 내부 상태에 반영
  // 핵심 설계: value가 undefined가 아닌 경우에만 외부 값으로 덮어씀 (제어 모드)
  if (value !== undefined) {
    stateRef.current = value // 외부 상태가 내부 상태보다 항상 우선
  }

  // 상태 변경 함수: useState와 동일한 API를 제공하면서 제어/비제어 모드를 투명하게 처리
  // useMemoizedFn: 함수 레퍼런스 안정화로 불필요한 리렌더링 방지 (의존성 배열 최적화)
  const setState = useMemoizedFn(
    (v: SetStateAction<T>, forceTrigger: boolean = false) => {
      // forceTrigger: 같은 값이라도 강제로 onChange 실행 (특수한 경우에 사용)
      // 사용 예: 사용자가 같은 날짜를 다시 클릭했을 때도 이벤트를 발생시키고 싶은 경우

      // useState와 동일한 함수형 업데이트 지원: setState(prev => prev + 1)
      // 타입 체크: 함수인지 값인지 구분하여 적절한 처리
      const nextValue =
        typeof v === 'function'
          ? (v as (prevState: T) => T)(stateRef.current) // 이전 값을 기반으로 계산
          : v // 직접 값 설정

      // 중복 업데이트 방지: 같은 값으로 변경하려 할 때 불필요한 렌더링과 이벤트 방지
      // 성능 최적화: 특히 복잡한 컴포넌트에서 중요한 최적화 포인트
      if (!forceTrigger && nextValue === stateRef.current) return

      // 상태 업데이트 3단계:
      stateRef.current = nextValue // 1. 내부 상태 업데이트
      update() // 2. 컴포넌트 리렌더링 트리거
      return onChange?.(nextValue) // 3. 외부 onChange 콜백 실행 (제어 컴포넌트에서 부모 상태 동기화)
    }
  )
  // useState와 동일한 반환 형태: [현재값, 설정함수] 튜플
  // as const: 튜플 타입 보장으로 TypeScript에서 정확한 타입 추론
  // 사용법: const [value, setValue] = usePropsValue({...})
  return [stateRef.current, setState] as const
}
