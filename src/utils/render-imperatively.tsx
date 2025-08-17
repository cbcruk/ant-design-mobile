import type { ReactElement } from 'react'
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { renderToBody } from './render-to-body'

type ImperativeProps = {
  visible?: boolean
  onClose?: () => void
  afterClose?: () => void
}

type TargetElement = ReactElement<ImperativeProps>

export type ImperativeHandler = {
  close: () => void
  replace: (element: TargetElement) => void
  isRendered?: () => boolean
}

// 명령형 렌더링 함수 - React의 선언적 패턴을 명령형 API로 래핑하는 고급 유틸리티
// 설계 의도: Toast.show(), Modal.open() 등 JavaScript 함수 호출로 컴포넌트를 동적 렌더링
// 핵심 기능: DOM에 일시적으로 마운트하고, 사용 후 자동 언마운트
// 비교: 일반 React는 JSX로 선언하지만, 이 유틸리티는 함수 호출로 렌더링 가능
export function renderImperatively(element: TargetElement) {
  // 래퍼 컴포넌트: 전달받은 요소를 상태 관리와 함께 래핑하는 내부 컴포넌트
  // forwardRef: 외부에서 ImperativeHandler 메서드를 호출할 수 있도록 ref 노출
  const Wrapper = React.forwardRef<ImperativeHandler>((_, ref) => {
    // 표시 상태: 자동으로 열리고 닫히는 라이프사이클 관리
    const [visible, setVisible] = useState(false)

    // 닫힘 상태 추적: 레이스 컨디션 방지를 위한 플래그
    // 문제: 빠른 닫기 요청 시 아직 마운트되지 않은 상태에서 close 호출 가능
    const closedRef = useRef(false)

    // 동적 요소 교체: replace 기능을 위해 렌더링할 요소를 동적으로 변경 가능
    const [elementToRender, setElementToRender] = useState(element)

    // 리렌더링 강제를 위한 키: 요소 교체 시 React가 완전히 새로운 인스턴스로 인식하도록 key 변경
    const keyRef = useRef(0)
    // 초기 라이프사이클: 마운트 직후 자동으로 열기 애니메이션 시작
    // 설계 의도: 사용자가 함수를 호출하면 즉시 표시되는 것처럼 보이도록 마운트 후 자동 오픈
    // 레이스 컨디션 방지: 이미 닫히기로 결정된 경우 오픈하지 않고 즉시 정리
    useEffect(() => {
      if (!closedRef.current) {
        setVisible(true) // 정상 경우: 마운트 후 자동 오픈
      } else {
        afterClose() // 빠른 닫기의 경우: 오픈 없이 즉시 정리
      }
    }, [])
    // 닫기 함수: 닫기 애니메이션 시작과 상태 업데이트
    // 2단계 프로세스: 1) 닫기 애니메이션 시작, 2) 애니메이션 완료 후 DOM에서 제거
    function onClose() {
      closedRef.current = true // 닫힘 상태 마킹 (중복 닫기 방지)
      setVisible(false) // 닫기 애니메이션 시작 (visible=false)
      elementToRender.props.onClose?.() // 사용자 정의 닫기 콜백 실행
    }

    // 닫기 완료 함수: 애니메이션 완료 후 DOM 정리와 콜백 실행
    // 순서가 중요: 1) 먼저 DOM에서 제거, 2) 그 다음 사용자 콜백
    function afterClose() {
      unmount() // DOM에서 컴포넌트 제거
      elementToRender.props.afterClose?.() // 사용자 정의 정리 콜백 실행
    }
    // 명령형 핸들러 노출: 외부에서 호출 가능한 메서드들을 ref를 통해 노출
    // 핵심 기능: close(닫기)와 replace(내용 교체) 메서드 제공
    useImperativeHandle(ref, () => ({
      close: onClose, // 닫기 메서드
      replace: element => {
        // 동적 콘텐츠 교체: 새로운 요소로 대체하면서 애니메이션 없이 실시간 변경
        keyRef.current++ // key 변경으로 React에게 완전히 새로운 인스턴스로 인식시킴
        elementToRender.props.afterClose?.() // 이전 요소의 정리 콜백 실행
        setElementToRender(element) // 새로운 요소로 교체
      },
    }))
    // 요소 렌더링: 기존 요소에 상태와 콜백을 주입하여 새로운 인스턴스 생성
    // cloneElement 이유: 원본 props를 보존하면서 내부 상태와 콜백을 override
    // key: replace 기능을 위한 리렌더링 강제, visible/onClose/afterClose: 내부 상태와 연동
    return React.cloneElement(elementToRender, {
      ...elementToRender.props, // 기존 props 보존
      key: keyRef.current, // 리렌더링 강제를 위한 key
      visible, // 내부 상태와 연동된 visible 상태
      onClose, // 내부 닫기 함수
      afterClose, // 내부 정리 함수
    })
  })
  // 래퍼 컴포넌트 마운트: body에 직접 렌더링하고 ref로 제어 채널 설정
  const wrapperRef = React.createRef<ImperativeHandler>() // 래퍼 컴포넌트 제어를 위한 ref
  const unmount = renderToBody(<Wrapper ref={wrapperRef} />) // body에 마운트하고 unmount 함수 반환

  // 외부 API 반환: 함수 호출자가 사용할 수 있는 컨트롤 인터페이스
  return {
    // 비동기 닫기: 레이스 컨디션을 고려한 안전한 닫기 처리
    close: async () => {
      if (!wrapperRef.current) {
        // 아직 마운트되지 않은 경우: 애니메이션 없이 즉시 제거
        // 예: 빠른 open/close 호출로 마운트가 완료되기 전에 닫기 요청
        unmount() // DOM에서 즉시 제거
        element.props.afterClose?.() // 사용자 콜백 보장
      } else {
        // 정상 마운트된 경우: 래퍼의 닫기 메서드 사용 (애니메이션 포함)
        wrapperRef.current?.close()
      }
    },

    // 동적 내용 교체: 닫지 않고 내용만 변경
    // 사용 예: 로딩 상태에서 성공/에러 메시지로 전환
    replace: element => {
      wrapperRef.current?.replace(element)
    },

    // 렌더링 상태 확인: 디버깅이나 중복 제어 방지용
    isRendered: () => !!wrapperRef.current,
  } as ImperativeHandler
}
