// 의존성 분석:
// - React: JSX 컴포넌트 생성을 위한 핵심 라이브러리
// - render-imperatively: 명령형 렌더링 유틸리티 (DOM 직접 조작 방식)
// - ImageViewer/MultiImageViewer: 실제 뷰어 컴포넌트들 (선언형 → 명령형 브리지)
import React from 'react'
import { renderImperatively } from '../../utils/render-imperatively'
import {
  ImageViewer,
  ImageViewerProps,
  MultiImageViewer,
  MultiImageViewerProps,
} from './image-viewer'

// 이미지 뷰어 제어 핸들러 인터페이스: 명령형 API 제공
export type ImageViewerShowHandler = {
  close: () => void // 뷰어를 프로그래매틱하게 닫는 함수
}

// 활성 뷰어 인스턴스 추적: 메모리 누수 방지와 중복 표시 제어
// Set 자료구조 사용으로 O(1) 추가/제거 성능과 중복 방지 보장
const handlerSet = new Set<ImageViewerShowHandler>()

// 단일 이미지 뷰어 표시 함수: 명령형 API (Toast, Modal 패턴)
// 설계 의도: React 컴포넌트 트리 밖에서도 뷰어를 쉽게 호출할 수 있도록 함
export function showImageViewer(props: Omit<ImageViewerProps, 'visible'>) {
  // 기존 뷰어들 정리: 동시에 여러 뷰어가 표시되는 것을 방지
  clearImageViewer()

  // 명령형 렌더링: DOM에 직접 마운트하여 즉시 표시
  const handler: ImageViewerShowHandler = renderImperatively(
    <ImageViewer
      {...props} // 사용자 제공 props 전달
      afterClose={() => {
        // 자동 정리: 뷰어 닫힐 때 핸들러 셋에서 제거 (메모리 누수 방지)
        handlerSet.delete(handler)
        // 사용자 정의 afterClose 콜백 실행 (cleanup 로직)
        props.afterClose?.()
      }}
    />
  )

  // 활성 핸들러로 등록: 나중에 일괄 정리를 위해 추적
  handlerSet.add(handler)

  // 제어 핸들러 반환: 호출자가 필요시 수동으로 닫을 수 있도록 함
  return handler
}

// 다중 이미지 뷰어 표시 함수: 갤러리 모드 명령형 API
export function showMultiImageViewer(
  props: Omit<MultiImageViewerProps, 'visible'>
) {
  // 기존 뷰어들 정리: 단일 뷰어와 동일한 정리 정책
  clearImageViewer()

  // 다중 이미지 뷰어 명령형 렌더링
  const handler: ImageViewerShowHandler = renderImperatively(
    <MultiImageViewer
      {...props} // 갤러리 props (images, defaultIndex 등) 전달
      afterClose={() => {
        // 자동 정리: 동일한 메모리 관리 패턴
        handlerSet.delete(handler)
        props.afterClose?.()
      }}
    />
  )

  // 핸들러 등록 및 반환
  handlerSet.add(handler)
  return handler
}

// 모든 활성 이미지 뷰어 강제 닫기: 전역 정리 함수
// 사용 시나리오: 페이지 이탈, 라우트 변경, 앱 종료 시 cleanup
export function clearImageViewer() {
  // 모든 활성 핸들러에 대해 닫기 명령 실행
  handlerSet.forEach(handler => {
    handler.close() // 각 뷰어의 닫기 애니메이션과 DOM 제거 트리거
  })

  // 핸들러 셋 완전 초기화: 메모리 해제와 다음 호출 준비
  handlerSet.clear()
}
