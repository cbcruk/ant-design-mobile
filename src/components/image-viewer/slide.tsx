import { animated, useSpring } from '@react-spring/web'
import { useSize } from 'ahooks'
import type { FC, MutableRefObject, ReactNode, RefObject } from 'react'
import React, { useRef } from 'react'
import { bound } from '../../utils/bound'
import type { Matrix } from '../../utils/matrix'
import * as mat from '../../utils/matrix'
import { rubberbandIfOutOfBounds } from '../../utils/rubberband'
import { useDragAndPinch } from '../../utils/use-drag-and-pinch'

const classPrefix = `adm-image-viewer`

type Props = {
  image: string
  maxZoom: number | 'auto'
  onTap?: () => void
  onZoomChange?: (zoom: number) => void
  dragLockRef?: MutableRefObject<boolean>
  imageRender?: (
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
  index?: number
}

// 이미지 슬라이드 컴포넌트 - 매트릭스 변환 기반 고급 제스처 인터렉션
// 설계 의도: 2D 매트릭스 연산을 통한 정밀한 이미지 확대/축소/팬 제어
// 핵심 특징: 멀티터치 제스처, 경계 검증, 탄성 효과, 관성 스크롤, 더블탭 확대
export const Slide: FC<Props> = props => {
  const { dragLockRef, maxZoom, imageRender, index } = props

  // 드래그 시작 시점의 경계 도달 상태 캐싱 (좌우 스와이프 감지용)
  const initialMartix = useRef<boolean[]>([])
  const controlRef = useRef<HTMLDivElement>(null) // 제스처 이벤트 수신 영역
  const imgRef = useRef<HTMLImageElement>(null) // 실제 이미지 요소

  // React Spring 기반 매트릭스 애니메이션: 부드러운 확대/축소/이동 효과
  // 핵심 설계: CSS transform matrix를 직접 조작하여 GPU 가속 활용
  const [{ matrix }, api] = useSpring(() => ({
    matrix: mat.create(), // 단위 행렬로 초기화 (변환 없음)
    config: { tension: 200 }, // 자연스러운 탄성 애니메이션
  }))

  // 실시간 크기 추적: 반응형 레이아웃과 정확한 경계 계산을 위한 크기 모니터링
  const controlSize = useSize(controlRef) // 뷰포트 크기
  const imgSize = useSize(imgRef) // 실제 이미지 크기

  // 핀치 제스처 상태: 확대/축소 중 드래그 충돌 방지용
  const pinchLockRef = useRef(false)

  // 이미지 위치 경계 계산 함수: 확대된 이미지가 뷰포트 밖으로 나가지 않도록 하는 경계값 계산
  // 핵심 설계: 중심점 기준 좌표계에서 이미지와 뷰포트의 상대적 위치 관계 분석
  const getMinAndMax = (
    nextMatrix: Matrix
  ): {
    x: {
      position: number // 현재 x 위치
      minX: number // 최소 x 경계 (가장 왼쪽으로 갈 수 있는 위치)
      maxX: number // 최대 x 경계 (가장 오른쪽으로 갈 수 있는 위치)
    }
    y: {
      position: number // 현재 y 위치
      minY: number // 최소 y 경계 (가장 위로 갈 수 있는 위치)
      maxY: number // 최대 y 경계 (가장 아래로 갈 수 있는 위치)
    }
  } => {
    // 크기 정보가 없으면 기본값 반환
    if (!controlSize || !imgSize)
      return {
        x: { position: 0, minX: 0, maxX: 0 },
        y: { position: 0, minY: 0, maxY: 0 },
      }

    // 중심점 기준 좌표계 설정: 화면과 이미지의 중심을 (0, 0)으로 하는 좌표계
    const controlLeft = -controlSize.width / 2 // 뷰포트 왼쪽 경계
    const controlTop = -controlSize.height / 2 // 뷰포트 상단 경계

    const imgLeft = -imgSize.width / 2 // 원본 이미지 왼쪽 경계
    const imgTop = -imgSize.height / 2 // 원본 이미지 상단 경계

    // 현재 확대 배율과 확대된 이미지 크기 계산
    const zoom = mat.getScaleX(nextMatrix)
    const scaledImgWidth = zoom * imgSize.width
    const scaledImgHeight = zoom * imgSize.height

    // X축 경계 계산: 확대된 이미지가 뷰포트를 벗어나지 않는 최소/최대 위치
    // minX: 이미지 오른쪽 끝이 뷰포트 오른쪽 끝에 닿는 위치 (가장 왼쪽으로 이동 가능)
    // maxX: 이미지 왼쪽 끝이 뷰포트 왼쪽 끝에 닿는 위치 (가장 오른쪽으로 이동 가능)
    const minX = controlLeft - (scaledImgWidth - controlSize.width)
    const maxX = controlLeft

    // Y축 경계도 동일한 원리로 계산
    const minY = controlTop - (scaledImgHeight - controlSize.height)
    const maxY = controlTop

    // 매트릭스를 이미지 중심점에 적용하여 현재 위치 계산
    const [x, y] = mat.apply(nextMatrix, [imgLeft, imgTop])

    return {
      x: { position: x, minX, maxX },
      y: { position: y, minY, maxY },
    }
  }

  // 경계 도달 검사 함수: 현재 위치가 경계에 도달했는지 확인 (버퍼 옵션 포함)
  const getReachBound = (
    position: number,
    min: number,
    max: number,
    buffer = 0 // 여유 공간: 경계 근처에서도 도달로 간주할 범위
  ) => {
    return [
      position <= min - buffer, // 최소 경계 도달 여부
      position >= max + buffer, // 최대 경계 도달 여부
    ]
  }

  // 매트릭스 경계 제한 함수: 이미지가 화면 밖으로 나가지 않도록 매트릭스 보정
  // 핵심 설계: 드래그 중에는 탄성 효과, 완료 시에는 엄격한 경계 적용
  const boundMatrix = (
    nextMatrix: Matrix,
    type: 'translate' | 'scale', // 이동 vs 확대/축소에 따른 다른 처리
    last = false // 제스처 완료 여부 (중요: 처리 방식 결정)
  ): Matrix => {
    if (!controlSize || !imgSize) return nextMatrix

    const zoom = mat.getScaleX(nextMatrix)
    const scaledImgWidth = zoom * imgSize.width
    const scaledImgHeight = zoom * imgSize.height

    const {
      x: { position: x, minX, maxX },
      y: { position: y, minY, maxY },
    } = getMinAndMax(nextMatrix)

    // 이동(translate) 처리: 드래그나 관성 스크롤 시의 위치 보정
    if (type === 'translate') {
      let boundedX = x
      let boundedY = y

      // X축 경계 처리: 이미지가 뷰포트보다 큰 경우만 경계 적용
      if (scaledImgWidth > controlSize.width) {
        boundedX = last
          ? bound(x, minX, maxX) // 제스처 완료: 엄격한 경계 적용
          : rubberbandIfOutOfBounds(x, minX, maxX, zoom * 50) // 드래그 중: iOS 스타일 탄성 효과
      } else {
        // 이미지가 뷰포트보다 작으면 중앙 정렬
        boundedX = -scaledImgWidth / 2
      }

      // Y축도 동일한 로직 적용
      if (scaledImgHeight > controlSize.height) {
        boundedY = last
          ? bound(y, minY, maxY)
          : rubberbandIfOutOfBounds(y, minY, maxY, zoom * 50)
      } else {
        boundedY = -scaledImgHeight / 2
      }

      // 보정된 위치로 이동하는 변환 매트릭스 반환
      return mat.translate(nextMatrix, boundedX - x, boundedY - y)
    }

    // 확대/축소(scale) 완료 시 처리: 확대 후 위치가 유효한지 검증하고 보정
    if (type === 'scale' && last) {
      const [boundedX, boundedY] = [
        scaledImgWidth > controlSize.width
          ? bound(x, minX, maxX) // 확대된 이미지가 큰 경우 경계 내로 제한
          : -scaledImgWidth / 2, // 작은 경우 중앙 정렬
        scaledImgHeight > controlSize.height
          ? bound(y, minY, maxY)
          : -scaledImgHeight / 2,
      ]
      return mat.translate(nextMatrix, boundedX - x, boundedY - y)
    }

    return nextMatrix // 조건에 맞지 않으면 원본 반환
  }

  // 통합 제스처 처리: 드래그(팬)와 핀치(확대/축소) 제스처를 동시에 처리하는 핵심 훅
  // 설계 의도: 복잡한 멀티터치 인터렙션을 안전하고 직관적으로 관리
  // 핵심 기능: 제스처 충돌 방지, 경계 검증, 탄성 효과, 관성 스크롤, 탭 감지
  useDragAndPinch(
    {
      // 드래그(팬) 제스처 핸들러: 이미지 이동과 탭 감지를 처리하는 핵심 로직
      onDrag: state => {
        // 드래그 시작 시: 초기 경계 상태 캐싱 (좌우 스와이프 감지용)
        if (state.first) {
          const {
            x: { position: x, minX, maxX },
          } = getMinAndMax(matrix.get())
          // 현재 X축 경계 도달 상태를 기록 (스와이프 vs 팬 구분)
          initialMartix.current = getReachBound(x, minX, maxX)
          return
        }

        // 핀치 제스처와 충돌 방지: 확대/축소 중에는 드래그 취소
        if (state.pinching) return state.cancel()

        // 탭 제스처 감지: 짧은 시간 내 터치로 뷰어 닫기 기능
        if (state.tap && state.elapsedTime > 0 && state.elapsedTime < 1000) {
          // elapsedTime > 0 조건: 비정상 터치 필터링 (길게 누른 후 취소 등)
          props.onTap?.() // 뷰어 닫기 콜백 실행
          return
        }

        // 현재 확대 배율 확인: 드래그 잠금과 동작 모드 결정
        const currentZoom = mat.getScaleX(matrix.get())

        // 상위 컴포넌트에 드래그 잠금 상태 전달 (다중 이미지 뷰어용)
        if (dragLockRef) {
          dragLockRef.current = currentZoom !== 1 // 확대 시 스와이프 잠금
        }

        // 기본 배율 상태에서의 처리: 즉시 원점 복귀
        if (!pinchLockRef.current && currentZoom <= 1) {
          api.start({
            matrix: mat.create(), // 단위 행렬로 리셋 (원점, 기본 크기)
          })
        } else {
          // 확대 상태에서의 드래그 처리: 이미지 이동과 관성 스크롤
          const currentMatrix = matrix.get()

          // 상대적 이동 거리 계산: 현재 위치 대비 변화량
          const offset = [
            state.offset[0] - mat.getTranslateX(currentMatrix), // X축 이동량
            state.offset[1] - mat.getTranslateY(currentMatrix), // Y축 이동량
          ] as const

          // 다음 변환 매트릭스 계산
          const nextMatrix = mat.translate(
            currentMatrix,
            // 제스처 완료 시: 관성 스크롤 적용 (속도 × 방향 × 감쇠계수)
            ...(state.last
              ? ([
                  offset[0] + state.velocity[0] * state.direction[0] * 200,
                  offset[1] + state.velocity[1] * state.direction[1] * 200,
                ] as const)
              : offset) // 드래그 중: 직접 이동량 적용
          )

          // 애니메이션 적용: 경계 제한과 함께 부드러운 이동
          api.start({
            matrix: boundMatrix(nextMatrix, 'translate', state.last),
            immediate: !state.last, // 드래그 중: 즉시 반영, 완료 시: 애니메이션
          })

          // 경계 복귀 검사: 드래그 시작과 완료 시점의 경계 도달 상태 비교
          const {
            x: { position: x, minX, maxX },
          } = getMinAndMax(nextMatrix)

          // 양방향 경계 도달 시 원점 복귀 (좌우 끝에서 더 밀어내려 할 때)
          if (
            state.last && // 드래그 완료 시점
            initialMartix.current.some(i => i) && // 시작 시 경계 도달 상태
            getReachBound(x, minX, maxX).some(i => i) // 완료 시에도 경계 도달
          ) {
            // 스와이프 잠금 해제 (다중 이미지 뷰어의 좌우 스와이프 활성화)
            if (dragLockRef) {
              dragLockRef.current = false
            }

            // 즉시 원점 복귀: 자연스러운 페이지 전환을 위한 리셋
            api.start({
              matrix: mat.create(),
            })
          }
        }
      },
      // 핀치(확대/축소) 제스처 핸들러: 멀티터치 기반 이미지 스케일링 처리
      onPinch: state => {
        // 핀치 잠금 상태 관리: 확대/축소 중 드래그 제스처 간섭 방지
        pinchLockRef.current = !state.last // 핀치 진행 중에는 true, 완료 시 false

        // 확대/축소 배율 추출: 제스처 상태에서 스케일 값 획득
        const [d] = state.offset
        if (d < 0) return // 음수 배율 무시 (비정상 제스처 필터링)

        // 최대 확대 배율 계산: 'auto' 모드와 고정값 모드 처리
        let mergedMaxZoom: number
        if (maxZoom === 'auto') {
          // 'auto' 모드: 이미지가 뷰포트에 맞도록 최대 배율 자동 계산
          mergedMaxZoom =
            controlSize && imgSize
              ? Math.max(
                  controlSize.height / imgSize.height, // 세로 기준 최대 배율
                  controlSize.width / imgSize.width // 가로 기준 최대 배율
                ) // 더 큰 배율 선택으로 이미지가 화면을 완전히 채우도록 함
              : 1 // 크기 정보 없으면 기본 배율
        } else {
          // 고정값 모드: 사용자 지정 최대 배율 사용
          mergedMaxZoom = maxZoom
        }

        // 최종 확대 배율 결정: 제스처 완료 시 경계값 적용
        const nextZoom = state.last ? bound(d, 1, mergedMaxZoom) : d

        // 외부에 확대 배율 변경 통지 (상위 컴포넌트 상태 동기화)
        props.onZoomChange?.(nextZoom)

        // 기본 배율로 축소 완료 시: 원점 복귀 처리
        if (state.last && nextZoom <= 1) {
          api.start({
            matrix: mat.create(), // 단위 행렬로 리셋 (원점, 기본 크기)
          })
          // 드래그 잠금 해제: 스와이프 네비게이션 다시 활성화
          if (dragLockRef) {
            dragLockRef.current = false
          }
        } else {
          // 확대 상태 처리: 핀치 중심점 기준 스케일링 적용
          if (!controlSize) return // 뷰포트 크기 필수

          const currentMatrix = matrix.get()
          const currentZoom = mat.getScaleX(currentMatrix)

          // 핀치 중심점을 화면 중앙 기준 좌표계로 변환
          const originOffsetX = state.origin[0] - controlSize.width / 2 // 중심점 X 오프셋
          const originOffsetY = state.origin[1] - controlSize.height / 2 // 중심점 Y 오프셋

          // 3단계 변환 매트릭스 적용: 평행이동 → 스케일링 → 역평행이동
          // 1단계: 핀치 중심점을 원점으로 이동
          let nextMatrix = mat.translate(
            currentMatrix,
            -originOffsetX,
            -originOffsetY
          )
          // 2단계: 원점에서 스케일링 적용 (비율 변경)
          nextMatrix = mat.scale(nextMatrix, nextZoom / currentZoom)
          // 3단계: 핀치 중심점으로 다시 이동 (최종 위치)
          nextMatrix = mat.translate(nextMatrix, originOffsetX, originOffsetY)

          // 경계 검증과 함께 애니메이션 적용
          api.start({
            matrix: boundMatrix(nextMatrix, 'scale', state.last), // 확대 시 경계 처리
            immediate: !state.last, // 핀치 중: 즉시 반영, 완료 시: 애니메이션
          })

          // 확대 시 드래그 잠금 활성화: 스와이프 네비게이션 차단
          if (dragLockRef) {
            dragLockRef.current = true
          }
        }
      },
    },
    // 제스처 설정 옵션: 이벤트 수신 영역과 초기값 설정
    {
      target: controlRef, // 제스처 이벤트를 수신할 DOM 요소 (컨트롤 영역)

      // 드래그 제스처 설정
      drag: {
        // 드래그 시작점: 현재 매트릭스의 이동 위치를 초기값으로 사용
        from: () => [
          mat.getTranslateX(matrix.get()), // 현재 X축 이동량
          mat.getTranslateY(matrix.get()), // 현재 Y축 이동량
        ],
        pointer: { touch: true }, // 터치 이벤트 활성화 (모바일 최적화)
      },

      // 핀치 제스처 설정
      pinch: {
        // 핀치 시작점: 현재 확대 배율을 초기값으로 사용
        from: () => [mat.getScaleX(matrix.get()), 0], // [현재 스케일, Y축 사용 안함]
        pointer: { touch: true }, // 터치 이벤트 활성화 (멀티터치 지원)
      },
    }
  )

  // 커스텀 이미지 렌더링 검사: 사용자 정의 렌더러 존재 여부 확인
  const customRendering =
    typeof imageRender === 'function' &&
    imageRender(props.image, { ref: imgRef, index: index ?? 0 })

  return (
    // 슬라이드 컨테이너: 개별 이미지 슬라이드의 최상위 래퍼
    <div className={`${classPrefix}-slide`}>
      {/* 제스처 컨트롤 영역: 터치 이벤트 수신과 크기 측정을 담당 */}
      <div className={`${classPrefix}-control`} ref={controlRef}>
        {/* 애니메이션 래퍼: React Spring 매트릭스 변환 적용 영역 */}
        <animated.div
          className={`${classPrefix}-image-wrapper`}
          style={{
            matrix, // CSS transform matrix 직접 적용 (GPU 가속 활용)
          }}
        >
          {/* 조건부 이미지 렌더링: 커스텀 렌더러 vs 기본 img 태그 */}
          {customRendering ? (
            customRendering // 사용자 정의 이미지 컴포넌트 (lazy loading, 에러 처리 등)
          ) : (
            // 기본 이미지 요소: 표준 HTML img 태그
            <img
              ref={imgRef} // 크기 측정과 커스텀 렌더러에 전달할 ref
              src={props.image} // 이미지 URL
              draggable={false} // 브라우저 기본 드래그 비활성화 (제스처 충돌 방지)
              alt={props.image} // 접근성을 위한 대체 텍스트
            />
          )}
        </animated.div>
      </div>
    </div>
  )
}
