// DOM 사용 가능 여부 감지: 브라우저 환경인지 서버 환경인지 안전하게 판단
// Why: SSR(Server-Side Rendering)과 CSR(Client-Side Rendering) 호환성 확보 필요
// How: 브라우저에서만 존재하는 전역 객체들의 존재와 기능을 다단계로 검증

// 4단계 브라우저 환경 검증 과정:
// 1. typeof window !== 'undefined': window 객체 존재 확인 (Node.js에서는 undefined)
// 2. typeof document !== 'undefined': document 객체 존재 확인 (일부 환경에서 누락 가능)
// 3. window.document: window에 실제 document 속성이 연결되어 있는지 확인
// 4. window.document.createElement: DOM 조작 핵심 메서드가 사용 가능한지 최종 확인

// 이중 부정(!!) 사용 이유: truthy/falsy 값을 명확한 boolean으로 변환
// 예시: !!undefined = false, !!{} = true, !!null = false
export const canUseDom = !!(
  (
    typeof window !== 'undefined' && // window 전역 객체 존재 여부
    typeof document !== 'undefined' && // document 전역 객체 존재 여부
    window.document && // window.document 연결 상태
    window.document.createElement
  ) // DOM 생성 API 사용 가능 여부
)

// 사용 예시:
// if (canUseDom) {
//   // 브라우저에서만 실행되는 코드 (DOM 조작, 이벤트 리스너 등)
//   document.addEventListener('click', handler)
// }

// 주의사항:
// - SSR 환경에서는 false가 되어 DOM 관련 코드가 실행되지 않음
// - 브라우저에서는 true가 되어 정상적인 DOM 조작 가능
// - Jest 등 테스트 환경에서도 jsdom 사용 시 true 반환
