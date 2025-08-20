// 🎹 UseInputHandleKeyDown: 키보드 이벤트를 효율적으로 처리하는 특화된 훅
// Why: 입력 컴포넌트에서 자주 사용되는 엔터키 처리와 일반 키 이벤트를 분리하여 코드 중복 제거
// How: 엔터키 감지 로직 + 기존 핸들러 호출을 하나의 통합된 핸들러로 결합

// 훅 매개변수 타입 정의: 엔터키 전용 핸들러와 일반 키 핸들러를 분리한 인터페이스
// Why: 엔터키는 폼 제출, 검색 실행 등 특별한 의미를 가지므로 별도 처리가 필요한 경우가 많음
// How: 제네릭으로 Input과 TextArea 모두 지원하면서 타입 안전성 확보
interface InputHandleKeyDownType<T> {
  onEnterPress?: (e: React.KeyboardEvent<T>) => void // 엔터키 전용 핸들러
  onKeyDown?: (e: React.KeyboardEvent<T>) => void // 모든 키에 대한 일반 핸들러
}

// 🎯 키보드 이벤트 통합 처리 훅: 엔터키 감지와 일반 키 이벤트를 효율적으로 결합
// Why: Input/TextArea 컴포넌트에서 공통으로 필요한 키보드 처리 로직을 재사용 가능하게 추상화
// How: 단일 이벤트 핸들러에서 엔터키 여부를 판단하고 적절한 콜백 실행

// 제네릭 타입 제약: HTMLInputElement 또는 HTMLTextAreaElement만 허용
// Why: 키보드 입력을 받는 폼 요소들에 특화된 훅이므로 타입 범위를 명확히 제한
export default function useInputHandleKeyDown<
  T extends HTMLInputElement | HTMLTextAreaElement,
>({ onEnterPress, onKeyDown }: InputHandleKeyDownType<T>) {
  // 통합 키보드 이벤트 핸들러: 엔터키 우선 처리 + 일반 키 이벤트 순차 실행
  // Why: 하나의 핸들러로 두 가지 유형의 키 이벤트를 효율적으로 처리
  // How: 조건문으로 엔터키 검사 후 각각의 핸들러 호출
  const handleKeydown = (e: React.KeyboardEvent<T>) => {
    // 엔터키 감지 및 전용 핸들러 실행
    // Why: 엔터키는 폼 제출, 검색 등의 특별한 액션을 수행하므로 우선적으로 처리
    // How: 최신 표준인 e.code와 레거시 호환성을 위한 e.keyCode 모두 확인
    if (onEnterPress && (e.code === 'Enter' || e.keyCode === 13)) {
      onEnterPress(e)

      // 브라우저 호환성 분석:
      // e.code === 'Enter': 최신 표준, 키보드 레이아웃에 관계없이 물리적 엔터키 감지
      // e.keyCode === 13: 레거시 표준, 구형 브라우저 호환성을 위한 폴백
      // 두 조건을 OR로 연결하여 모든 환경에서 안정적인 엔터키 감지 보장
    }

    // 일반 키 이벤트 핸들러 실행: 모든 키에 대한 공통 처리 로직
    // Why: 엔터키 외의 모든 키에 대해서도 사용자 정의 로직을 실행할 수 있도록 지원
    // How: optional chaining으로 핸들러가 제공된 경우에만 안전하게 호출
    onKeyDown?.(e)

    // 실행 순서의 중요성:
    // 1. 엔터키 처리 먼저 실행: 특수한 동작을 우선 처리
    // 2. 일반 키 처리 나중에 실행: 전체적인 키보드 로깅, 분석 등에 활용
    // 이 순서로 onEnterPress에서 preventDefault() 등을 호출해도 onKeyDown에서 감지 가능
  }

  // 완성된 핸들러 함수 반환: 컴포넌트에서 onKeyDown 이벤트에 직접 연결 가능
  // Why: 하나의 핸들러로 두 가지 유형의 키보드 이벤트를 모두 처리하는 편의성 제공
  // How: React의 표준 KeyboardEvent 핸들러와 완전히 호환되는 시그니처
  return handleKeydown

  // 실제 사용 예시:
  // const handleKeydown = useInputHandleKeyDown({
  //   onEnterPress: (e) => { console.log('엔터키 눌림!'); submitForm(); },
  //   onKeyDown: (e) => { console.log('키 입력:', e.key); trackKeyPress(e); }
  // })
  //
  // <input onKeyDown={handleKeydown} />
  //
  // 이점:
  // 1. 코드 중복 제거: 여러 입력 컴포넌트에서 동일한 키보드 처리 로직 재사용
  // 2. 타입 안전성: TypeScript 제네릭으로 정확한 타입 추론
  // 3. 브라우저 호환성: 최신 표준과 레거시 모두 지원
  // 4. 확장 가능성: 다른 특수키(Escape, Tab 등) 처리도 쉽게 추가 가능
}
