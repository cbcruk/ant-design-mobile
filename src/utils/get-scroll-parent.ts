import { canUseDom } from './can-use-dom'

type ScrollElement = HTMLElement | Window

// 기본 루트 요소: 브라우저 환경에서만 window 객체 사용 (SSR 대응)
// SSR 안전성: 서버에서는 window가 없으므로 undefined로 처리
const defaultRoot = canUseDom ? window : undefined

// 스크롤 가능한 CSS overflow 패턴들
// scroll: 항상 스크롤바 표시, auto: 필요시만 표시, overlay: 브라우저별 다른 동작
// 핵심 이유: overflow:hidden이나 visible은 스크롤이 불가능하므로 제외
const overflowStylePatterns = ['scroll', 'auto', 'overlay']

// DOM 요소 타입 검사: Node의 다양한 타입 중 Element만 필터링
// 필요성: Text 노드(nodeType=3)나 Comment 노드(nodeType=8) 등은 CSS 스타일을 가질 수 없음
// DOM 상수: nodeType 1 = ELEMENT_NODE (공식 DOM 상수)
function isElement(node: Element) {
  const ELEMENT_NODE_TYPE = 1
  return node.nodeType === ELEMENT_NODE_TYPE
}
// 스크롤 가능한 부모 요소 찾기 함수 - DOM 트리를 거슬로 올라가며 스크롤 컨테이너 감지
// 설계 의도: 무한 스크롤, 팝업 위치 조정, 자동 스크롤 등에서 정확한 스크롤 컨테이너 필요
// 대상 사용자: 브라우저 호환성 문제로 각 라이브러리에서 자체 구현하는 경우가 많은 유틸리티
// 성능 고려사항: getComputedStyle 호출은 비용이 크므로 필요한 요소에서만 호출
export function getScrollParent(
  el: Element, // 시작 요소 (검색의 출발점)
  root: ScrollElement | null | undefined = defaultRoot // 검색 범위 제한 (일반적으로 window)
): Window | Element | null | undefined {
  let node = el // 현재 검사 중인 노드

  // DOM 트리 상위 순회: 부모 노드로 올라가며 스크롤 컨테이너 탐색
  // 종료 조건: 1) node가 null, 2) root에 도달, 3) Element가 아닌 노드 만남
  while (node && node !== root && isElement(node)) {
    // body 요소 특별 처리: body는 브라우저별로 다른 스크롤 동작을 가지므로 root로 위임
    // 이유: body의 스크롤은 실제로는 html이나 window에서 처리되는 경우가 많음
    if (node === document.body) {
      return root
    }

    // 계산된 CSS 스타일 검사: 브라우저가 최종 적용한 overflow 속성 확인
    // 성능 주의: getComputedStyle은 뺄으니 CSS 재계산을 유발할 수 있음
    const { overflowY } = window.getComputedStyle(node)

    // 스크롤 가능성 이중 검사:
    // 1. CSS 속성 검사: overflow-y가 스크롤 가능한 값인지 확인
    // 2. 실제 스크롤 필요성 검사: 콘텐츠가 컨테이너보다 큰지 확인
    // scrollHeight > clientHeight: 콘텐츠 높이 > 보이는 영역 높이
    if (
      overflowStylePatterns.includes(overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node // 스크롤 가능한 첫 번째 부모 요소 반환
    }

    // 다음 부모 노드로 이동: DOM 트리를 위로 한 단계 올라가기
    // 타입 단언: parentNode는 Node 타입이지만 Element로 강제 변환 (위에서 isElement로 검사함)
    node = node.parentNode as Element
  }

  // 스크롤 컨테이너를 찾지 못한 경우 기본 root 반환 (일반적으로 window)
  // 의미: 전체 페이지가 스크롤 컨테이너 역할
  return root
}
