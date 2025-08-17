import { useTouch } from './use-touch'
import { useEffect, RefObject } from 'react'
import { getScrollParent } from './get-scroll-parent'
import { supportsPassive } from './supports-passive'

// 전역 잠금 카운터: 여러 컴포넌트가 동시에 스크롤 잠금을 요청할 때 중첩 관리
// why: 모달 위에 또 다른 모달이 열리는 경우 등을 안전하게 처리하기 위함
// how: 증감 카운터로 마지막 잠금이 해제될 때만 실제 스크롤 복원
let totalLockCount = 0

// CSS 클래스 상수: body 요소에 적용하여 전역 스크롤 차단
// why: CSS만으로는 모든 터치 스크롤을 막을 수 없어 JS와 조합하여 사용
// how: overflow: hidden을 적용하여 기본 스크롤 UI를 숨김
const BODY_LOCK_CLASS = 'adm-overflow-hidden'

// 스크롤 가능한 상위 요소 검색 함수 (strict 모드 전용)
// why: strict 모드에서 body/documentElement 외의 스크롤 컨테이너 감지 필요
// how: DOM 트리를 거슬러 올라가며 clientHeight < scrollHeight인 첫 번째 요소 찾기
function getScrollableElement(el: HTMLElement | null) {
  let current = el?.parentElement

  // 부모 요소들을 순회하며 스크롤 가능한 요소 탐색
  // why: 중첩된 스크롤 컨테이너 환경에서 정확한 스크롤 영역 판단 필요
  while (current) {
    // 스크롤 가능성 판단: 콘텐츠 높이가 보이는 영역보다 클 때
    // why: scrollHeight > clientHeight는 스크롤이 필요한 상태를 의미
    if (current.clientHeight < current.scrollHeight) {
      return current
    }

    current = current.parentElement
  }

  return null
}

// Vant 라이브러리에서 이식한 스크롤 잠금 훅
// why: 모바일 웹에서 배경 스크롤 방지는 복잡한 터치 이벤트 처리가 필요
// how: 터치 방향과 스크롤 경계를 분석하여 선택적으로 preventDefault 호출
export function useLockScroll(
  rootRef: RefObject<HTMLElement>, // 잠금 대상 컴포넌트의 루트 요소 참조
  shouldLock: boolean | 'strict' // 잠금 모드: true(일반), 'strict'(엄격), false(비활성)
) {
  // 터치 제스처 추적 훅: 터치 방향과 이동 거리 계산
  // why: 수직/수평 스크롤을 구분하여 의도하지 않은 스크롤 차단 방지
  const touch = useTouch()

  // 터치 이동 이벤트 핸들러: 스크롤 차단 여부를 실시간 판단
  // why: touchmove마다 스크롤 경계와 방향을 검사하여 정밀한 제어 필요
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
