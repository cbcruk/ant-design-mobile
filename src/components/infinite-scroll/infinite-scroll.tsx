import { mergeProps } from '../../utils/with-default-props'
import React, { useEffect, useRef, useState } from 'react'
import type { FC, ReactNode } from 'react'
import { useLockFn, useThrottleFn } from 'ahooks'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { getScrollParent } from '../../utils/get-scroll-parent'
import { useConfig } from '../config-provider'
import DotLoading from '../dot-loading'

function isWindow(element: any | Window): element is Window {
  return element === window
}

const classPrefix = `adm-infinite-scroll`

export type InfiniteScrollProps = {
  loadMore: (isRetry: boolean) => Promise<void>
  hasMore: boolean
  threshold?: number
  children?:
    | ReactNode
    | ((hasMore: boolean, failed: boolean, retry: () => void) => ReactNode)
} & NativeProps

const defaultProps: Required<
  Pick<InfiniteScrollProps, 'threshold' | 'children'>
> = {
  threshold: 250,
  children: (hasMore: boolean, failed: boolean, retry: () => void) => (
    <InfiniteScrollContent hasMore={hasMore} failed={failed} retry={retry} />
  ),
}

// 무한 스크롤 컴포넌트 - 스크롤 기반 자동 데이터 로딩과 에러 처리를 지원하는 페이지네이션 시스템
// 설계 의도: 사용자가 콘텐츠 끝에 도달하기 전에 미리 다음 데이터를 로드하여 끊김 없는 스크롤 경험 제공
// 핵심 특징: 스로틀링 기반 성능 최적화, 중복 요청 방지, 에러 재시도, 동적 스크롤 컨테이너 감지
export const InfiniteScroll: FC<InfiniteScrollProps> = p => {
  const props = mergeProps(defaultProps, p)

  // 로딩 실패 상태: API 호출 실패 시 재시도 UI 표시용
  const [failed, setFailed] = useState(false)

  // 락 기능이 포함된 loadMore 함수: 중복 호출 방지와 에러 처리 통합
  // 핵심 설계: useLockFn으로 이전 호출이 완료되기 전까지 새로운 호출 차단
  const doLoadMore = useLockFn(async (isRetry: boolean) => {
    try {
      await props.loadMore(isRetry)
    } catch (e) {
      setFailed(true) // 실패 상태 설정으로 재시도 UI 활성화
      throw e
    }
  })

  const elementRef = useRef<HTMLDivElement>(null)

  // 중복 체크 방지 플래그 시스템: 동일한 스크롤 이벤트로 인한 중복 로딩 방지
  // 문제: 빠른 스크롤이나 동시 이벤트로 같은 데이터를 여러 번 요청할 수 있음
  // 해결: 각 체크마다 고유 플래그 생성, 이전 체크가 완료되지 않으면 새 체크 무시
  const [flag, setFlag] = useState({}) // 현재 완료된 체크의 플래그
  const nextFlagRef = useRef(flag) // 다음 체크를 위한 플래그

  // 동적 스크롤 컨테이너: 부모 스크롤 요소 자동 감지 및 추적
  const [scrollParent, setScrollParent] = useState<
    Window | Element | null | undefined
  >()

  // 스크롤 위치 체크 함수: 로딩 트리거 조건 검사와 실행
  // 핵심 설계: 스로틀링으로 성능 최적화, 뷰포트 기반 정확한 거리 계산
  const { run: check } = useThrottleFn(
    async () => {
      // 중복 체크 방지: 이전 체크가 아직 진행 중이면 무시
      if (nextFlagRef.current !== flag) return
      if (!props.hasMore) return // 더 이상 로드할 데이터가 없으면 중단

      const element = elementRef.current
      if (!element) return
      if (!element.offsetParent) return // 숨겨진 요소는 무시

      // 스크롤 컨테이너 동적 감지: 상위 스크롤 가능한 요소 찾기
      const parent = getScrollParent(element)
      setScrollParent(parent) // 이벤트 리스너 등록을 위해 저장
      if (!parent) return

      // 뷰포트 기반 거리 계산: 스크롤 컨테이너와 로더 위치의 상대적 거리
      const rect = element.getBoundingClientRect()
      const elementTop = rect.top

      // 스크롤 컨테이너의 하단 위치 계산 (window vs 일반 element 구분)
      const current = isWindow(parent)
        ? window.innerHeight // 전체 화면의 높이
        : parent.getBoundingClientRect().bottom // 부모 요소의 하단 위치

      // 트리거 조건: 로더가 threshold 거리 내에 들어오면 로딩 시작
      // 예: threshold=250이면 로더가 화면 하단 250px 전에 미리 로딩 시작
      if (current >= elementTop - props.threshold) {
        // 새로운 체크 플래그 생성: 이 로딩 완료 전까지 다른 체크 차단
        const nextFlag = {}
        nextFlagRef.current = nextFlag

        try {
          await doLoadMore(false) // 일반 로딩 (재시도 아님)
          setFlag(nextFlag) // 로딩 성공 시 플래그 업데이트
        } catch (e) {
          // 에러는 doLoadMore 내부에서 처리됨 (failed 상태 설정)
        }
      }
    },
    {
      wait: 100, // 100ms 간격으로 스로틀링
      leading: true, // 첫 호출 즉시 실행
      trailing: true, // 마지막 호출도 실행 보장
    }
  )

  // 콘텐츠 변경 시 자동 체크: 동적 콘텐츠 높이 변화 대응
  // 문제: 새 데이터 로드 후 콘텐츠 높이가 변하면서 더 로딩이 필요할 수 있음
  // 해결: 매 렌더링마다 체크하여 충분한 콘텐츠가 없으면 추가 로딩
  useEffect(() => {
    check()
  })

  // 스크롤 이벤트 리스너 동적 등록: 감지된 스크롤 컨테이너에 이벤트 바인딩
  // 핵심 설계: 스크롤 컨테이너가 변경될 때마다 이벤트 리스너 재등록
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    if (!scrollParent) return

    function onScroll() {
      check() // 스크롤할 때마다 로딩 조건 체크
    }

    // 이벤트 리스너 등록 (window 또는 DOM 요소)
    scrollParent.addEventListener('scroll', onScroll)

    // 클린업: 메모리 누수 방지를 위한 이벤트 리스너 제거
    return () => {
      scrollParent.removeEventListener('scroll', onScroll)
    }
  }, [scrollParent])

  // 재시도 함수: 실패한 로딩 요청을 다시 시도
  // 핵심 설계: 실패 상태 초기화 후 재시도 플래그와 함께 loadMore 호출
  async function retry() {
    setFailed(false) // 실패 상태 초기화로 로딩 UI 표시
    try {
      await doLoadMore(true) // 재시도임을 명시하여 loadMore 호출
      setFlag(nextFlagRef.current) // 성공 시 플래그 동기화
    } catch (e) {
      // 재시도 실패 시에도 failed는 doLoadMore 내부에서 설정됨
    }
  }

  return withNativeProps(
    props,
    <div className={classPrefix} ref={elementRef}>
      {typeof props.children === 'function'
        ? props.children(props.hasMore, failed, retry)
        : props.children}
    </div>
  )
}

const InfiniteScrollContent: FC<{
  hasMore: boolean
  failed: boolean
  retry: () => void
}> = props => {
  const { locale } = useConfig()

  if (!props.hasMore) {
    return <span>{locale.InfiniteScroll.noMore}</span>
  }

  if (props.failed) {
    return (
      <span>
        <span className={`${classPrefix}-failed-text`}>
          {locale.InfiniteScroll.failedToLoad}
        </span>
        <a
          onClick={() => {
            props.retry()
          }}
        >
          {locale.InfiniteScroll.retry}
        </a>
      </span>
    )
  }

  return (
    <>
      <span>{locale.common.loading}</span>
      <DotLoading />
    </>
  )
}
