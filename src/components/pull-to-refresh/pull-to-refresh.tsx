import React, { useEffect, useRef, useState } from 'react'
import type { FC, ReactNode } from 'react'
import { mergeProps } from '../../utils/with-default-props'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { getScrollParent } from '../../utils/get-scroll-parent'
import { supportsPassive } from '../../utils/supports-passive'
import { convertPx } from '../../utils/convert-px'
import { rubberbandIfOutOfBounds } from '../../utils/rubberband'
import { useConfig } from '../config-provider'
import { sleep } from '../../utils/sleep'

const classPrefix = `adm-pull-to-refresh`

export type PullStatus = 'pulling' | 'canRelease' | 'refreshing' | 'complete'

export type PullToRefreshProps = {
  onRefresh?: () => Promise<any>
  pullingText?: ReactNode
  canReleaseText?: ReactNode
  refreshingText?: ReactNode
  completeText?: ReactNode
  completeDelay?: number
  headHeight?: number
  threshold?: number
  disabled?: boolean
  renderText?: (status: PullStatus) => ReactNode
  children?: ReactNode
}

export const defaultProps = {
  pullingText: '下拉刷新',
  canReleaseText: '释放立即刷新',
  refreshingText: '加载中...',
  completeText: '刷新成功',
  completeDelay: 500,
  disabled: false,
  onRefresh: () => {},
}

// 당겨서 새로고침 컴포넌트 - 네이티브 모바일 앱의 pull-to-refresh 제스처를 웹에서 구현
// 설계 의도: iOS/Android의 표준 당겨서 새로고침 UX를 웹에서 자연스럽게 재현
// 핵심 특징: 다단계 상태 관리, 탄성 효과, 스크롤 감지, 제스처 기반 인터렉션
export const PullToRefresh: FC<PullToRefreshProps> = p => {
  const { locale } = useConfig()
  const props = mergeProps(
    defaultProps,
    {
      // 다국어 기본 텍스트 설정
      refreshingText: `${locale.common.loading}...`,
      pullingText: locale.PullToRefresh.pulling,
      canReleaseText: locale.PullToRefresh.canRelease,
      completeText: locale.PullToRefresh.complete,
    },
    p
  )

  // 크기 설정: px 단위를 rem으로 변환하여 반응형 대응
  const headHeight = props.headHeight ?? convertPx(40) // 헤더 영역 높이
  const threshold = props.threshold ?? convertPx(60) // 새로고침 트리거 임계점

  // 4단계 상태 관리: pulling → canRelease → refreshing → complete
  const [status, setStatus] = useState<PullStatus>('pulling')

  // React Spring 애니메이션: 부드러운 헤더 높이 변화 제어
  const [springStyles, api] = useSpring(() => ({
    from: { height: 0 }, // 초기 높이 0에서 시작
    config: {
      tension: 300, // 탄성력: 빠른 반응
      friction: 30, // 마찰력: 자연스러운 감속
      round: true, // 정수 픽셀 값으로 반올림 (부드러운 렌더링)
      clamp: true, // 값 범위 제한
    },
  }))

  const elementRef = useRef<HTMLDivElement>(null)

  // 당기기 상태 추적: 드래그가 새로고침 의도인지 판단
  const pullingRef = useRef(false)

  // 터치 이벤트 최적화: iOS Safari에서 발생하는 당기기 중 떨림 현상 방지
  // 문제: touchmove 이벤트 핸들러가 없으면 일부 브라우저에서 스크롤 최적화로 인한 떨림 발생
  // 해결: 빈 touchmove 핸들러 등록으로 브라우저 최적화 방지
  useEffect(() => {
    elementRef.current?.addEventListener('touchmove', () => {})
  }, [])

  // 상태 초기화 함수: 새로고침 완료 후 원래 상태로 복귀하는 애니메이션
  // 설계 의도: 부드러운 시각적 전환으로 자연스러운 UX 완성
  // Promise 반환: 애니메이션 완료 후 추가 작업 실행 가능
  const reset = () => {
    return new Promise<void>(resolve => {
      api.start({
        to: {
          height: 0, // 헤더 높이를 0으로 축소
        },
        onResolve() {
          setStatus('pulling') // 초기 상태로 복귀
          resolve() // Promise 완료 신호
        },
      })
    })
  }

  // 새로고침 실행 함수: 비동기 데이터 로딩과 다단계 상태 관리의 핵심
  // 설계 의도: 사용자에게 명확한 진행 상황 피드백과 에러 처리 제공
  // 복잡성 이유: Promise 기반 비동기 처리, 상태 동기화, 애니메이션 타이밍 조율
  async function doRefresh() {
    // 새로고침 헤더 고정: 로딩 중 헤더 영역을 지정된 높이로 유지
    api.start({ height: headHeight })
    setStatus('refreshing') // 로딩 상태로 전환

    try {
      // 사용자 정의 새로고침 로직 실행: API 호출, 데이터 갱신 등
      await props.onRefresh()
      setStatus('complete') // 성공 상태로 전환
    } catch (e) {
      // 에러 발생 시 즉시 원위치 복귀: 사용자에게 실패 상황 시각적으로 전달
      reset()
      throw e // 에러 재던지기로 상위 컴포넌트에서 추가 처리 가능
    }

    // 완료 메시지 표시 시간: 사용자가 성공을 인지할 수 있는 충분한 시간 제공
    if (props.completeDelay > 0) {
      await sleep(props.completeDelay) // 설정된 지연 시간만큼 대기
    }

    // 최종 상태 초기화: 다음 새로고침을 위한 준비
    reset()
  }

  // 제스처 기반 당기기 로직: 터치 드래그로 새로고침 트리거를 제어하는 핵심 로직
  // 설계 철학: 네이티브 앱과 동일한 터치 감도와 시각적 피드백 제공
  // 복잡성 이유: 스크롤 충돌 방지, 탄성 효과, 다단계 상태 전환이 모두 실시간으로 처리되어야 함
  useDrag(
    state => {
      // 새로고침 진행 중이거나 완료 상태에서는 새로운 드래그 무시
      if (status === 'refreshing' || status === 'complete') return

      const { event } = state

      // 드래그 종료 시점: 손가락을 떼는 순간의 액션 결정
      if (state.last) {
        pullingRef.current = false // 당기기 상태 해제

        // 임계점 초과 시 새로고침 실행, 미달 시 원위치 복귀
        if (status === 'canRelease') {
          doRefresh() // 새로고침 프로세스 시작
        } else {
          api.start({ height: 0 }) // 탄성 복귀 애니메이션
        }
        return
      }

      // 드래그 거리 계산: y축 움직임을 픽셀 단위로 변환
      const [, y] = state.movement
      const parsedY = Math.ceil(y) // 부드러운 픽셀 단위 처리

      // 드래그 시작 시점: 스크롤 가능 영역 검사로 당기기 vs 스크롤 구분
      // 핵심 설계: 페이지 최상단에서만 당기기 허용, 스크롤 중인 요소에서는 차단
      if (state.first && parsedY > 0) {
        const target = state.event.target
        if (!target || !(target instanceof Element)) return

        // 상위 스크롤 컨테이너 순회: 중첩된 스크롤 영역까지 모두 검사
        let scrollParent = getScrollParent(target)
        while (true) {
          if (!scrollParent) return

          // 스크롤 위치 확인: 0이 아니면 스크롤 중이므로 당기기 차단
          const scrollTop = getScrollTop(scrollParent)
          if (scrollTop > 0) {
            return // 스크롤 중인 요소가 있으면 당기기 차단
          }

          // Window 객체까지 도달하면 검사 완료
          if (scrollParent instanceof Window) {
            break
          }
          scrollParent = getScrollParent(scrollParent.parentNode as Element)
        }

        // 모든 검사 통과 시 당기기 상태 활성화
        pullingRef.current = true

        // 스크롤 위치 추출 함수: Window와 Element의 API 차이 처리
        function getScrollTop(element: Window | Element) {
          return 'scrollTop' in element ? element.scrollTop : element.scrollY
        }
      }

      // 당기기 상태가 아니면 제스처 무시
      if (!pullingRef.current) return

      // 기본 스크롤 동작 차단: 당기기 중에는 페이지 스크롤 방지
      if (event.cancelable) {
        event.preventDefault() // 브라우저 기본 스크롤 차단
      }
      event.stopPropagation() // 이벤트 버블링 차단

      // 탄성 효과가 적용된 높이 계산: iOS의 rubber band 효과 모방
      // rubberbandIfOutOfBounds: 범위를 벗어날수록 저항이 증가하는 물리적 탄성 구현
      // 매개변수: (현재값, 최소값, 최대값, 탄성범위, 저항계수)
      const height = Math.max(
        rubberbandIfOutOfBounds(parsedY, 0, 0, headHeight * 5, 0.5),
        0
      )

      // 실시간 애니메이션 업데이트와 상태 전환
      api.start({ height }) // React Spring으로 부드러운 높이 변화
      setStatus(height > threshold ? 'canRelease' : 'pulling') // 임계점 기반 상태 변경
    },
    {
      pointer: { touch: true }, // 터치 전용 (마우스 드래그 제외)
      axis: 'y', // y축 드래그만 감지
      target: elementRef, // 이벤트 타겟 요소
      enabled: !props.disabled, // 비활성화 상태 고려
      eventOptions: supportsPassive ? { passive: false } : undefined, // 성능 최적화
    }
  )

  const renderStatusText = () => {
    if (props.renderText) {
      return props.renderText?.(status)
    }

    if (status === 'pulling') return props.pullingText
    if (status === 'canRelease') return props.canReleaseText
    if (status === 'refreshing') return props.refreshingText
    if (status === 'complete') return props.completeText
  }

  return (
    <animated.div ref={elementRef} className={classPrefix}>
      <animated.div style={springStyles} className={`${classPrefix}-head`}>
        <div
          className={`${classPrefix}-head-content`}
          style={{ height: headHeight }}
        >
          {renderStatusText()}
        </div>
      </animated.div>
      <div className={`${classPrefix}-content`}>{props.children}</div>
    </animated.div>
  )
}
