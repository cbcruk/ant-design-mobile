import { canUseDom } from './can-use-dom'

// 패시브 이벤트 지원 여부 감지 - 브라우저가 addEventListener의 passive 옵션을 지원하는지 확인
// 설계 의도: preventDefault() 사용 필요성과 성능 최적화를 위한 브라우저 기능 감지
// 패시브 이벤트: 브라우저가 preventDefault를 호출하지 않을 것으로 가정하고 성능 최적화를 수행
// 중요성: 터치 이벤트에서 preventDefault 사용 시 passive:false 설정이 필수
export let supportsPassive = false // 기본값: 지원하지 않는다고 가정

// DOM 환경에서만 감지 테스트 수행 (SSR 안전성)
if (canUseDom) {
  try {
    // 영리한 테스트: 브라우저가 passive 옵션을 지원하는지 간접적으로 확인
    // 핵심 아이디어: 브라우저가 passive 옵션을 지원하면 getter를 호출하여 값을 확인하려 할 것
    const opts = {} // 테스트용 빈 옵션 객체

    // passive 속성의 getter 정의: 브라우저가 이 속성에 접근하면 지원 플래그 설정
    // Object.defineProperty 사용 이유: 일반 속성 설정으로는 브라우저의 접근을 감지할 수 없음
    Object.defineProperty(opts, 'passive', {
      get() {
        // 이 getter가 호출되는 것 자체가 브라우저가 passive 옵션을 지원한다는 증거
        supportsPassive = true // 지원 플래그 설정
      },
    })

    // 테스트 이벤트 등록: 브라우저가 opts의 passive 속성에 접근하도록 유도
    // 브라우저가 passive 옵션을 지원하면 opts.passive를 읽어서 getter가 실행됨
    // 등록한 이벤트는 즉시 제거되므로 실제 이벤트 처리는 일어나지 않음
    window.addEventListener('test-passive', null as any, opts)
  } catch (e) {
    // 에러 발생 시 supportsPassive는 false로 유지 (고전 브라우저 대응)
    // 예: Internet Explorer 등에서 Object.defineProperty 실패 가능
  }
}

// 사용 예: addEventListener(이벤트, 핸들러, supportsPassive ? {passive: false} : false)
