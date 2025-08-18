import { canUseDom } from './can-use-dom'

// Passive Event Listener 지원 감지: 브라우저의 고급 이벤트 처리 기능 탐지 유틸리티
// Why: 모바일 웹 성능 최적화와 터치 이벤트 preventDefault 사용 시 필수적인 기능 감지 필요
// How: 브라우저의 기능 감지 패턴을 이용한 영리한 런타임 테스트로 지원 여부 확인

// Passive Event Listener 배경 지식:
// - Chrome 56+에서 도입된 성능 최적화 기술 (2017년)
// - 터치/스크롤 이벤트의 성능을 크게 향상시키는 핵심 기능
// - preventDefault() 호출 가능성에 따라 브라우저 최적화 전략이 달라짐
// - 모바일 웹에서 60fps 부드러운 스크롤을 위한 필수 기술

// 성능 영향 분석:
// passive: true  → 브라우저가 스크롤을 즉시 처리 (성능 향상)
// passive: false → 이벤트 핸들러 완료까지 스크롤 지연 (preventDefault 대기)

export let supportsPassive = false // 기본값: 구형 브라우저 호환성을 위한 안전한 false 설정

// 브라우저 환경에서만 감지 테스트 실행 (SSR 호환성 보장)
// Why: Node.js 서버 환경에서는 window 객체가 없으므로 클라이언트에서만 테스트 수행
if (canUseDom) {
  try {
    // 천재적인 기능 감지 패턴: Property Getter Trap을 활용한 브라우저 동작 분석
    // Why: 브라우저가 options 객체의 passive 속성을 읽는지 간접적으로 감지
    // How: getter 함수가 호출되면 브라우저가 passive를 인식한다는 증거로 활용

    const testOptions = {} // 감지용 테스트 옵션 객체 생성

    // Property Descriptor를 이용한 Getter Trap 설치
    // Why: 일반적인 obj.passive = value로는 브라우저의 property 접근을 감지할 수 없음
    // How: Object.defineProperty로 getter 정의, 브라우저 접근 시 콜백 실행
    Object.defineProperty(testOptions, 'passive', {
      // Getter 함수: 브라우저가 passive 속성을 읽을 때 자동 호출
      // 호출 시점: addEventListener 내부에서 options.passive 값을 확인할 때
      get() {
        // 🎯 핵심: 이 getter가 실행되면 브라우저가 passive 옵션을 지원한다는 확실한 증거
        supportsPassive = true // 전역 플래그를 true로 설정

        // getter는 값을 반환해야 하지만 실제로 사용되지 않으므로 undefined 반환
        return undefined
      },

      // 추가 설정: 속성 조작 방지 및 명확한 의도 표현
      configurable: true, // 나중에 속성 재정의 가능하도록 설정
      enumerable: false, // for...in 루프에서 보이지 않도록 설정
    })

    // 가짜 이벤트 리스너 등록으로 브라우저 동작 유도
    // Why: addEventListener 호출 시 브라우저가 options 객체의 속성들을 검사하도록 함
    // How: 존재하지 않는 이벤트명으로 등록하여 실제 부작용 없이 테스트만 수행
    window.addEventListener(
      'test-passive-support', // 가상의 이벤트명 (실제로 발생하지 않음)
      null as any, // 핸들러 null (실행되지 않음)
      testOptions // 감지용 옵션 객체 전달 → 이때 getter 실행됨
    )

    // 브라우저별 동작 분석:
    // 🟢 Modern Browser (Chrome 56+, Firefox 50+, Safari 10+):
    //    → options.passive를 읽어서 getter 실행 → supportsPassive = true
    //
    // 🔴 Legacy Browser (IE, Old Mobile):
    //    → options 객체를 무시하거나 passive 속성에 접근하지 않음 → supportsPassive = false
  } catch (error) {
    // 예외 처리: 구형 브라우저에서 Object.defineProperty나 addEventListener 실패 시
    // Why: Internet Explorer 등에서 ES5 기능이 불완전하게 구현된 경우 대비
    // How: 에러 발생 시 supportsPassive는 기본값 false 유지 (안전한 폴백)
    // 일반적인 에러 원인들:
    // 1. Object.defineProperty 미지원 (IE8 이하)
    // 2. addEventListener의 options 파라미터 미지원
    // 3. strict mode에서의 예상치 못한 동작
    // console.warn('Passive event detection failed:', error) // 디버깅용 (실제로는 주석)
  }
}

// 최종 결과 및 활용 방법:
// supportsPassive === true  → {passive: false} 형태로 사용 가능
// supportsPassive === false → 세 번째 인수를 boolean으로 사용해야 함
//
// 실제 사용 패턴:
// const eventOptions = supportsPassive ? { passive: false } : false
// element.addEventListener('touchmove', handler, eventOptions)
