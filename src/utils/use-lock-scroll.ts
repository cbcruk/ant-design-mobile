import { RefObject, useEffect } from 'react'
import { getScrollParent } from './get-scroll-parent'
import { supportsPassive } from './supports-passive'
import { useTouch } from './use-touch'

// 🔒 Use Lock Scroll: 모바일 웹에서 정교한 스크롤 제어를 위한 고급 훅
// Why: 모달/팝업 사용 시 배경 스크롤 차단이 필수이지만, 단순한 CSS overflow:hidden으로는
//      iOS Safari의 elastic scroll이나 복잡한 중첩 스크롤 상황을 완벽히 제어할 수 없음
// How: Vant 라이브러리에서 검증된 터치 이벤트 분석 + CSS 스타일 조합으로 정교한 제어 구현

// ===== 전역 상태 관리 시스템 =====

// 중첩 잠금 관리: 여러 컴포넌트의 스크롤 잠금 요청을 안전하게 조율
// Why: 모달 위의 모달, 팝업 위의 토스트 등 중첩된 오버레이 상황에서 충돌 방지 필요
// How: Reference Counting 패턴으로 마지막 잠금 해제 시에만 실제 스크롤 복원
let totalLockCount = 0

// CSS 기반 기본 스크롤 차단: 표준 스크롤바 UI 제거
// Why: JavaScript만으로는 모든 스크롤을 막을 수 없으므로 CSS와 협력 필요
// How: overflow:hidden으로 스크롤바 숨김 + JS로 터치 제스처 정밀 제어
const BODY_LOCK_CLASS = 'adm-overflow-hidden'

// ===== Strict 모드 전용 헬퍼 함수 =====

// 스크롤 가능한 부모 요소 탐지: DOM 트리 상위 탐색으로 실제 스크롤 컨테이너 찾기
// Why: iOS 12 호환성을 위한 strict 모드에서 정확한 스크롤 영역 판단 필요
// How: 부모 요소들을 거슬러 올라가며 scrollHeight > clientHeight 조건 만족하는 첫 요소 반환
function getScrollableElement(el: HTMLElement | null) {
  let currentElement = el?.parentElement // 대상 요소의 직속 부모부터 탐색 시작

  // DOM 트리 상위 순회: 스크롤 가능한 첫 번째 컨테이너 탐색
  // 종료 조건: null 도달 (document 루트) 또는 스크롤 컨테이너 발견
  while (currentElement) {
    // 스크롤 필요성 판단 공식: 콘텐츠 크기 > 보이는 영역 크기
    // scrollHeight: 전체 콘텐츠의 실제 높이 (overflow 영역 포함)
    // clientHeight: 스크롤바를 제외한 실제 보이는 영역의 높이
    if (currentElement.clientHeight < currentElement.scrollHeight) {
      return currentElement // 스크롤 가능한 첫 번째 부모 요소 반환
    }

    // 다음 상위 요소로 이동: DOM 트리를 한 단계 위로 올라가기
    currentElement = currentElement.parentElement
  }

  // 스크롤 가능한 부모를 찾지 못한 경우: body/html 레벨에서 스크롤 처리됨을 의미
  return null
}

// ===== 메인 훅 구현부 =====

// 🎯 useLockScroll: 모바일 웹의 복잡한 스크롤 시나리오를 정교하게 제어하는 핵심 훅
// 기술적 배경: Vant Mobile UI 라이브러리에서 검증된 알고리즘을 React 훅으로 포팅
// Why: 단순한 overflow:hidden 방식으로는 해결할 수 없는 모바일 브라우저별 스크롤 특성 대응
// How: 터치 방향 분석 + 스크롤 경계 감지 + 선택적 preventDefault로 정밀한 제어 구현

export function useLockScroll(
  rootRef: RefObject<HTMLElement>, // 스크롤 잠금 범위를 정의하는 컴포넌트 루트 요소
  shouldLock: boolean | 'strict' // 잠금 강도: false(비활성), true(표준), 'strict'(강력)
) {
  // 모드별 동작 차이:
  // 🟢 false: 스크롤 잠금 비활성화 (모든 스크롤 허용)
  // 🟡 true: 표준 모드 (스마트한 경계 기반 선택적 차단)
  // 🔴 'strict': 엄격 모드 (iOS 12 호환성, 더 넓은 범위의 스크롤 차단)
  // ===== 터치 이벤트 분석 시스템 =====

  // 터치 제스처 추적: 방향성과 거리 정보 실시간 수집
  // Why: 수직/수평 스크롤 구분으로 의도하지 않은 제스처 차단 방지
  // How: useTouch 훅으로 deltaY, direction 등 핵심 지표 추출
  const touch = useTouch()

  // 🎯 핵심 로직: 터치 이동 이벤트에서 스크롤 차단 여부를 실시간 판단하는 함수
  // Why: touchmove마다 정밀한 분석으로 필요한 스크롤만 선택적으로 차단
  // How: 터치 방향 + 스크롤 경계 상태 + 현재 위치를 종합하여 preventDefault 결정
  const onTouchMove = (event: TouchEvent) => {
    // 터치 상태 업데이트: 현재 터치 위치와 이동 방향 계산
    touch.move(event)

    // 스크롤 방향 인코딩: 2진수 형태로 위/아래 방향 표현
    // why: 비트 연산으로 빠른 방향 비교 가능 ('10'=아래, '01'=위)
    // how: deltaY > 0이면 아래로 스크롤, 그렇지 않으면 위로 스크롤
    const direction = touch.deltaY.current > 0 ? '10' : '01'

    // 실제 스크롤이 발생할 부모 요소 찾기
    // why: 터치된 요소와 실제 스크롤되는 요소가 다를 수 있음 (이벤트 버블링)
    // how: getScrollParent로 DOM 트리를 거슬러 올라가며 스크롤 컨테이너 탐색
    const el = getScrollParent(
      event.target as Element,
      rootRef.current
    ) as HTMLElement
    if (!el) return

    // Strict 모드: iOS 12 호환성을 위한 엄격한 스크롤 차단
    // why: iOS 12에서 일부 스크롤 이벤트가 누락되는 문제 대응
    // how: 성능 비용을 감수하고 더 넓은 범위의 스크롤을 차단
    if (shouldLock === 'strict') {
      const scrollableParent = getScrollableElement(event.target as HTMLElement)
      // body나 documentElement 레벨 스크롤이면 무조건 차단
      // why: 전체 페이지 스크롤은 모달/팝업과 상충되므로 항상 방지
      if (
        scrollableParent === document.body ||
        scrollableParent === document.documentElement
      ) {
        event.preventDefault()
        return
      }
    }

    // 스크롤 상태 정보 수집: 현재 스크롤 위치와 전체 크기
    // why: 스크롤 경계(맨 위/맨 아래) 판단을 위한 기본 데이터 필요
    const { scrollHeight, offsetHeight, scrollTop } = el
    const { height } = el.getBoundingClientRect()

    // 스크롤 경계 상태 초기값: '11'은 중간 위치(위아래 모두 스크롤 가능)
    // why: 2비트로 스크롤 가능 방향을 인코딩 (첫째비트=위, 둘째비트=아래)
    let status = '11'

    // 스크롤 경계 상태 판단 로직
    if (scrollTop === 0) {
      // 맨 위에 있는 경우: 위로는 스크롤 불가
      // why: scrollTop=0은 컨테이너의 최상단을 의미
      // how: 콘텐츠 크기에 따라 '00'(스크롤불가) 또는 '01'(아래만가능) 설정
      status = offsetHeight >= scrollHeight ? '00' : '01'
    } else if (scrollHeight <= Math.round(height + scrollTop)) {
      // 맨 아래에 있는 경우: 아래로는 스크롤 불가
      // why: scrollTop + height = scrollHeight일 때 컨테이너 최하단
      // how: Math.round로 부동소수점 오차 보정, '10'(위만가능) 설정
      status = '10'
    }

    // 스크롤 차단 조건 검사: 경계에서 더 이상 스크롤할 수 없는 방향으로 시도할 때만 차단
    if (
      status !== '11' && // 경계 상태일 때 (중간이 아닐 때)
      touch.isVertical() && // 세로 방향 터치일 때
      !(parseInt(status, 2) & parseInt(direction, 2)) // 스크롤 불가능한 방향일 때
    ) {
      // 비트 연산 설명: status와 direction을 AND 연산하여 교집합 검사
      // why: '01' & '10' = 0 (불가능), '01' & '01' = 1 (가능)
      // how: 결과가 0이면 스크롤할 수 없는 방향으로 시도한 것

      // 이벤트 취소 가능성 검사 후 기본 동작 방지
      // why: passive 이벤트 리스너에서는 preventDefault 호출 불가
      // how: cancelable과 supportsPassive 모두 true일 때만 안전하게 호출
      if (event.cancelable && supportsPassive) {
        // 관련 이슈: https://github.com/ant-design/ant-design-mobile/issues/6282
        // why: 부적절한 preventDefault로 인한 터치 이벤트 무반응 문제 해결
        event.preventDefault()
      }
    }
  }

  // 스크롤 잠금 활성화 함수: 전역 터치 이벤트 리스너 등록
  // why: document 레벨에서 이벤트를 잡아야 모든 터치를 제어 가능
  const lock = () => {
    // 터치 시작 이벤트 등록: 터치 추적 초기화를 위함
    // why: touchstart에서 초기 위치를 저장해야 정확한 이동 거리 계산 가능
    document.addEventListener('touchstart', touch.start)

    // 터치 이동 이벤트 등록: 핵심 스크롤 제어 로직
    // why: touchmove에서 실시간으로 스크롤 차단 여부 판단
    // how: passive: false로 설정하여 preventDefault 호출 권한 확보
    document.addEventListener(
      'touchmove',
      onTouchMove,
      supportsPassive ? { passive: false } : false
    )

    // 첫 번째 잠금일 때만 CSS 클래스 적용
    // why: 여러 컴포넌트가 동시에 잠금을 요청해도 중복 적용 방지
    // how: 카운터가 0일 때만 body에 overflow:hidden 적용
    if (!totalLockCount) {
      document.body.classList.add(BODY_LOCK_CLASS)
    }

    // 잠금 카운터 증가: 중첩된 잠금 요청 추적
    // why: 모달 위의 모달 등 중첩 상황에서 안전한 잠금 해제를 위함
    totalLockCount++
  }

  // 스크롤 잠금 해제 함수: 이벤트 리스너 제거 및 스타일 복원
  // why: 컴포넌트 언마운트 시 리스너 누수 방지와 스크롤 복원 필요
  const unlock = () => {
    // 잠금이 활성화된 상태에서만 해제 작업 수행
    // why: unlock이 여러 번 호출되어도 안전하게 처리
    if (totalLockCount) {
      // 터치 이벤트 리스너 제거
      // why: 메모리 누수 방지와 불필요한 이벤트 처리 중단
      document.removeEventListener('touchstart', touch.start)
      document.removeEventListener('touchmove', onTouchMove)

      // 잠금 카운터 감소
      totalLockCount--

      // 마지막 잠금이 해제될 때만 CSS 클래스 제거
      // why: 다른 컴포넌트가 여전히 잠금을 사용 중일 수 있음
      // how: 카운터가 0이 될 때만 body의 overflow:hidden 해제
      if (!totalLockCount) {
        document.body.classList.remove(BODY_LOCK_CLASS)
      }
    }
  }

  // React Effect: 잠금 상태 변경에 따른 이벤트 리스너 생명주기 관리
  // why: shouldLock 변경 시 자동으로 잠금/해제 처리 필요
  useEffect(() => {
    if (shouldLock) {
      // 잠금 활성화: 터치 이벤트 리스너 등록 및 스타일 적용
      lock()

      // 클린업 함수: 컴포넌트 언마운트 또는 shouldLock 변경 시 자동 해제
      // why: 이벤트 리스너 누수 방지와 의도치 않은 스크롤 차단 지속 방지
      // how: useEffect의 클린업 메커니즘을 활용한 자동 정리
      return () => {
        unlock()
      }
    }
  }, [shouldLock]) // 의존성: shouldLock 변경 시에만 Effect 재실행
}
